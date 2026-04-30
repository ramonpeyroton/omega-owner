// /api/quickbooks/:action  (Vercel dynamic route)
//
// Single Function that fans out to all QB sub-handlers, so the whole
// integration counts as ONE serverless function instead of five —
// Vercel Hobby plan caps at 12 total. Sub-handlers map 1:1 with what
// used to be separate files; logic is identical.
//
// Routes:
//   GET  /api/quickbooks/auth        → start OAuth, 302 to Intuit
//   GET  /api/quickbooks/callback    → finish OAuth, persist tokens
//   GET  /api/quickbooks/status      → JSON connection state
//   POST /api/quickbooks/disconnect  → revoke + delete row
//   GET  /api/quickbooks/balances    → JSON list of bank/cc balances

import crypto from 'node:crypto';
import {
  envConfig, exchangeCodeForTokens, saveTokens,
  loadActiveTokens, deleteTokens, revokeAtIntuit, qbFetch,
} from '../_lib/quickbooks.js';
import { json } from '../_lib/http.js';

const AUTHORIZE_BASE = 'https://appcenter.intuit.com/connect/oauth2';
const SCOPE = 'com.intuit.quickbooks.accounting';

// Account types we surface in the Finance Company tab. We deliberately
// skip Equity / Income / Expense / Cost-of-Goods-Sold / Fixed Asset:
//   * Equity / Income / Expense are P&L lines, not balances
//   * Fixed Asset (vehicles, equipment) doesn't move week-to-week
// What's left answers "tem dinheiro pra pagar X?" in one glance.
const ACCOUNT_TYPES = [
  'Bank',
  'Credit Card',
  'Accounts Receivable',
  'Accounts Payable',
  'Other Current Asset',
];

const QUERY_ACCOUNTS =
  "select Id, Name, AccountType, AccountSubType, CurrentBalance, CurrencyRef, MetaData " +
  `from Account where AccountType in (${ACCOUNT_TYPES.map((t) => `'${t}'`).join(',')}) and Active = true`;

// QB returns invoices/bills paged. We cap at 50 — more than that is a
// signal Brenda needs to drill in via QB itself, not the dashboard.
const OVERDUE_INVOICE_QUERY = (todayIso) =>
  "select Id, DocNumber, CustomerRef, TotalAmt, Balance, DueDate, TxnDate " +
  "from Invoice " +
  `where Balance > '0' and DueDate < '${todayIso}' ` +
  "order by DueDate asc maxresults 50";

const BILLS_DUE_QUERY =
  "select Id, DocNumber, VendorRef, TotalAmt, Balance, DueDate, TxnDate " +
  "from Bill " +
  "where Balance > '0' " +
  "order by DueDate asc maxresults 50";

function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  const match = raw.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

export default async function handler(req, res) {
  const action = req.query?.action || '';
  switch (action) {
    case 'auth':              return handleAuth(req, res);
    case 'callback':          return handleCallback(req, res);
    case 'status':            return handleStatus(req, res);
    case 'disconnect':        return handleDisconnect(req, res);
    case 'balances':          return handleBalances(req, res);
    case 'pnl':               return handlePnl(req, res);
    case 'overdue-invoices':  return handleOverdueInvoices(req, res);
    case 'bills-due':         return handleBillsDue(req, res);
    default:                  return json(res, 404, { error: 'Unknown action', action });
  }
}

// ─── auth ────────────────────────────────────────────────────────
function handleAuth(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  const cfg = envConfig();
  if (!cfg.ready) {
    return json(res, 500, {
      error: 'QuickBooks env vars not configured',
      hint: 'Set QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET and QUICKBOOKS_REDIRECT_URI on Vercel.',
    });
  }
  const state = crypto.randomBytes(16).toString('hex');
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    scope: SCOPE,
    redirect_uri: cfg.redirectUri,
    response_type: 'code',
    state,
  });
  res.setHeader('Set-Cookie', [
    `qb_oauth_state=${state}; Path=/; Max-Age=600; HttpOnly; SameSite=Lax; Secure`,
  ]);
  res.statusCode = 302;
  res.setHeader('Location', `${AUTHORIZE_BASE}?${params.toString()}`);
  res.end();
}

// ─── callback ────────────────────────────────────────────────────
async function handleCallback(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });

  const cfg = envConfig();
  const url = new URL(req.url, `https://${req.headers.host}`);
  const code = url.searchParams.get('code');
  const realmId = url.searchParams.get('realmId');
  const state = url.searchParams.get('state');
  const intuitError = url.searchParams.get('error');

  const appBase = `https://${req.headers.host}`;
  const back = (qs) => {
    res.statusCode = 302;
    res.setHeader('Set-Cookie', [
      'qb_oauth_state=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure',
    ]);
    res.setHeader('Location', `${appBase}/?${qs}`);
    res.end();
  };

  if (intuitError) return back(`qb=error&reason=${encodeURIComponent(intuitError)}`);
  if (!code || !realmId) return back('qb=error&reason=missing_params');

  const savedState = readCookie(req, 'qb_oauth_state');
  if (!savedState || savedState !== state) return back('qb=error&reason=state_mismatch');

  try {
    const tokens = await exchangeCodeForTokens(code);
    await saveTokens({
      realmId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresInSec: tokens.expires_in,
      refreshExpiresInSec: tokens.x_refresh_token_expires_in,
      environment: cfg.environment || 'sandbox',
    });
    return back('qb=connected');
  } catch (err) {
    console.error('[quickbooks-callback]', err?.message || err);
    return back(`qb=error&reason=${encodeURIComponent(err?.message || 'exchange_failed')}`);
  }
}

// ─── status ──────────────────────────────────────────────────────
async function handleStatus(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  try {
    const row = await loadActiveTokens();
    if (!row) return json(res, 200, { connected: false });
    return json(res, 200, {
      connected: true,
      realmId: row.realm_id,
      environment: row.environment,
      connectedAt: row.connected_at,
      lastRefreshedAt: row.last_refreshed_at,
    });
  } catch (err) {
    return json(res, 500, { error: err?.message || 'Status check failed' });
  }
}

// ─── disconnect ──────────────────────────────────────────────────
async function handleDisconnect(req, res) {
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return json(res, 405, { error: 'Method not allowed' });
  }
  try {
    const row = await loadActiveTokens();
    if (!row) return json(res, 200, { ok: true, alreadyDisconnected: true });
    try { await revokeAtIntuit(row.refresh_token); } catch { /* logged inside */ }
    await deleteTokens(row.realm_id);
    return json(res, 200, { ok: true });
  } catch (err) {
    return json(res, 500, { error: err?.message || 'Disconnect failed' });
  }
}

// ─── balances ────────────────────────────────────────────────────
async function handleBalances(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  try {
    const row = await loadActiveTokens();
    if (!row) return json(res, 200, { connected: false, accounts: [] });
    const path = `/v3/company/{realmId}/query?query=${encodeURIComponent(QUERY_ACCOUNTS)}`;
    const data = await qbFetch(path);
    const raw = data?.QueryResponse?.Account || [];
    const accounts = raw.map((a) => ({
      id: a.Id,
      name: a.Name,
      type: a.AccountType,
      subType: a.AccountSubType,
      currentBalance: Number(a.CurrentBalance) || 0,
      currency: a.CurrencyRef?.value || 'USD',
      lastUpdated: a.MetaData?.LastUpdatedTime || null,
    }));
    return json(res, 200, {
      connected: true,
      realmId: row.realm_id,
      environment: row.environment,
      accounts,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return json(res, 500, { error: err?.message || 'Failed to fetch balances' });
  }
}

// ─── pnl ─────────────────────────────────────────────────────────
// Calls /reports/ProfitAndLoss twice — once for current month, once
// for year-to-date — and parses out (totalIncome, totalExpense,
// netIncome) from each. The QBO report response is deeply nested; we
// dig down to Summary.ColData where the totals live.
async function handlePnl(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  try {
    const row = await loadActiveTokens();
    if (!row) return json(res, 200, { connected: false });

    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const yearStart = new Date(today.getFullYear(), 0, 1);
    const fmt = (d) => d.toISOString().slice(0, 10);

    const monthPath =
      `/v3/company/{realmId}/reports/ProfitAndLoss?start_date=${fmt(monthStart)}&end_date=${fmt(today)}&accounting_method=Accrual`;
    const ytdPath =
      `/v3/company/{realmId}/reports/ProfitAndLoss?start_date=${fmt(yearStart)}&end_date=${fmt(today)}&accounting_method=Accrual`;

    const [monthData, ytdData] = await Promise.all([
      qbFetch(monthPath),
      qbFetch(ytdPath),
    ]);

    return json(res, 200, {
      connected: true,
      month: parsePnlReport(monthData),
      ytd: parsePnlReport(ytdData),
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return json(res, 500, { error: err?.message || 'Failed to fetch P&L' });
  }
}

// QBO P&L report has rows of type 'Section' with `group` like
// 'Income' / 'Expenses' / 'GrossProfit' / 'NetIncome'. The total of
// each section sits in the section's Summary.ColData. We pluck the
// three we care about into a flat shape.
function parsePnlReport(report) {
  const out = { totalIncome: 0, totalExpense: 0, netIncome: 0, currency: report?.Header?.Currency || 'USD' };
  const rows = report?.Rows?.Row || [];
  for (const row of rows) {
    const group = row.group;
    const total = Number(row?.Summary?.ColData?.[1]?.value) || 0;
    if (group === 'Income') out.totalIncome = total;
    else if (group === 'Expenses') out.totalExpense = total;
    else if (group === 'NetIncome') out.netIncome = total;
  }
  // If NetIncome row wasn't present (some reports skip it when zero),
  // compute it. Income − Expenses ≈ NetIncome (ignores COGS / Other);
  // good-enough for a glanceable card.
  if (!out.netIncome) out.netIncome = out.totalIncome - out.totalExpense;
  return out;
}

// ─── overdue invoices ────────────────────────────────────────────
async function handleOverdueInvoices(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  try {
    const row = await loadActiveTokens();
    if (!row) return json(res, 200, { connected: false, invoices: [] });

    const todayIso = new Date().toISOString().slice(0, 10);
    const path = `/v3/company/{realmId}/query?query=${encodeURIComponent(OVERDUE_INVOICE_QUERY(todayIso))}`;
    const data = await qbFetch(path);
    const raw = data?.QueryResponse?.Invoice || [];
    const invoices = raw.map((i) => ({
      id: i.Id,
      docNumber: i.DocNumber,
      customer: i.CustomerRef?.name || '—',
      customerId: i.CustomerRef?.value || null,
      total: Number(i.TotalAmt) || 0,
      balance: Number(i.Balance) || 0,
      dueDate: i.DueDate,
      txnDate: i.TxnDate,
      daysPastDue: i.DueDate
        ? Math.max(0, Math.floor((Date.now() - new Date(i.DueDate).getTime()) / 86400000))
        : 0,
    }));
    return json(res, 200, {
      connected: true,
      invoices,
      totalOpenBalance: invoices.reduce((s, i) => s + i.balance, 0),
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return json(res, 500, { error: err?.message || 'Failed to fetch overdue invoices' });
  }
}

// ─── bills due ───────────────────────────────────────────────────
async function handleBillsDue(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  try {
    const row = await loadActiveTokens();
    if (!row) return json(res, 200, { connected: false, bills: [] });

    const path = `/v3/company/{realmId}/query?query=${encodeURIComponent(BILLS_DUE_QUERY)}`;
    const data = await qbFetch(path);
    const raw = data?.QueryResponse?.Bill || [];
    const today = Date.now();
    const bills = raw.map((b) => ({
      id: b.Id,
      docNumber: b.DocNumber,
      vendor: b.VendorRef?.name || '—',
      vendorId: b.VendorRef?.value || null,
      total: Number(b.TotalAmt) || 0,
      balance: Number(b.Balance) || 0,
      dueDate: b.DueDate,
      txnDate: b.TxnDate,
      daysPastDue: b.DueDate
        ? Math.max(0, Math.floor((today - new Date(b.DueDate).getTime()) / 86400000))
        : 0,
    }));
    return json(res, 200, {
      connected: true,
      bills,
      totalOpenBalance: bills.reduce((s, b) => s + b.balance, 0),
      overdueCount: bills.filter((b) => b.daysPastDue > 0).length,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return json(res, 500, { error: err?.message || 'Failed to fetch bills' });
  }
}
