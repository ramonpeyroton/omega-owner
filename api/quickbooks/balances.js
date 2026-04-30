// GET /api/quickbooks/balances
//
// Pulls bank/credit-card account balances from QuickBooks for the
// connected company. Returns:
//   {
//     connected: true,
//     accounts: [
//       { id, name, type, subType, currentBalance, currency, lastUpdated }
//     ]
//   }
//
// We filter to AccountType in {Bank, Credit Card} since those are
// what people care about for "saúde da empresa" — equity / income /
// expense accounts aren't bank balances.
//
// Read-only. Never writes back to QB. The Sprint 2 contract is "QB
// is the source of truth, app just shows".

import { qbFetch, loadActiveTokens } from '../_lib/quickbooks.js';
import { json } from '../_lib/http.js';

const QUERY_ACCOUNTS =
  "select Id, Name, AccountType, AccountSubType, CurrentBalance, CurrencyRef, MetaData " +
  "from Account where AccountType in ('Bank','Credit Card') and Active = true";

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return json(res, 405, { error: 'Method not allowed' });
  }
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
