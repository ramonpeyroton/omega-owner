// Shared QuickBooks helpers for Vercel Functions.
//
// What lives here:
//   * envConfig()          — reads + validates the QB env vars
//   * loadActiveTokens()   — pulls the most recent active token row
//   * refreshAccessToken() — exchanges a refresh_token for new tokens
//                            and persists them
//   * getValidAccessToken()— returns a fresh access_token, refreshing
//                            transparently if the stored one expires
//                            within the next 60s
//   * qbFetch(path, ...)   — typed wrapper around fetch() that targets
//                            the QB API base, attaches the bearer
//                            token, and parses JSON with a useful
//                            error shape on non-2xx
//
// Endpoints in api/quickbooks/* import from here. The browser never
// touches these — every QB API call is server-side.

import { supabase, requireSupabase } from './supabase.js';

const TOKEN_ENDPOINT = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const REVOKE_ENDPOINT = 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke';

// QB Online accounting API minor version. Bumping this opts in to the
// latest schema fixes; pinning it avoids surprises from auto-rolling
// versions. 75 is current as of 2026-04. https://developer.intuit.com/app/developer/qbo/docs/learn/explore-the-quickbooks-online-api/minor-versions
const MINOR_VERSION = 75;

// ─── Env config ──────────────────────────────────────────────────
export function envConfig() {
  const cfg = {
    clientId:     process.env.QUICKBOOKS_CLIENT_ID || '',
    clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET || '',
    redirectUri:  process.env.QUICKBOOKS_REDIRECT_URI || '',
    apiBase:      process.env.QUICKBOOKS_API_BASE || 'https://sandbox-quickbooks.api.intuit.com',
    environment:  process.env.QUICKBOOKS_ENV || 'sandbox',
  };
  cfg.ready = !!(cfg.clientId && cfg.clientSecret && cfg.redirectUri);
  return cfg;
}

// ─── DB token row ────────────────────────────────────────────────
export async function loadActiveTokens() {
  const ready = requireSupabase();
  if (!ready.ok) throw new Error(ready.error);
  const { data, error } = await supabase
    .from('quickbooks_tokens')
    .select('*')
    .eq('active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveTokens({
  realmId, accessToken, refreshToken,
  expiresInSec, refreshExpiresInSec,
  connectedByUserId, environment,
}) {
  const ready = requireSupabase();
  if (!ready.ok) throw new Error(ready.error);

  const now = Date.now();
  const tokenExpiresAt = new Date(now + (expiresInSec * 1000)).toISOString();
  const refreshExpiresAt = refreshExpiresInSec
    ? new Date(now + (refreshExpiresInSec * 1000)).toISOString()
    : null;

  // Upsert by realm_id — same realm reconnecting should rotate the
  // tokens in place, not stack up rows.
  const { data: existing } = await supabase
    .from('quickbooks_tokens')
    .select('id')
    .eq('realm_id', realmId)
    .maybeSingle();

  const payload = {
    realm_id: realmId,
    access_token: accessToken,
    refresh_token: refreshToken,
    token_expires_at: tokenExpiresAt,
    refresh_expires_at: refreshExpiresAt,
    last_refreshed_at: new Date().toISOString(),
    active: true,
    environment: environment || 'sandbox',
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { error } = await supabase
      .from('quickbooks_tokens')
      .update(payload)
      .eq('id', existing.id);
    if (error) throw error;
    return existing.id;
  }
  const { data: inserted, error } = await supabase
    .from('quickbooks_tokens')
    .insert([{ ...payload, connected_by_user_id: connectedByUserId || null }])
    .select('id')
    .single();
  if (error) throw error;
  return inserted.id;
}

export async function deleteTokens(realmId) {
  const ready = requireSupabase();
  if (!ready.ok) throw new Error(ready.error);
  await supabase.from('quickbooks_tokens').delete().eq('realm_id', realmId);
}

// ─── Token exchange ──────────────────────────────────────────────
function basicAuthHeader(clientId, clientSecret) {
  return 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
}

// Exchange the OAuth `code` (from the callback redirect) for a token
// pair. Returns { access_token, refresh_token, expires_in, x_refresh_token_expires_in }.
export async function exchangeCodeForTokens(code) {
  const cfg = envConfig();
  if (!cfg.ready) throw new Error('QuickBooks env vars not set');
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: cfg.redirectUri,
  });
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: basicAuthHeader(cfg.clientId, cfg.clientSecret),
    },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }
  return res.json();
}

// Use the stored refresh_token to mint a new access_token.
// Persists the new pair (refresh_token rotates each call — losing the
// new one means losing the connection at next refresh).
export async function refreshAccessToken(row) {
  const cfg = envConfig();
  if (!cfg.ready) throw new Error('QuickBooks env vars not set');

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: row.refresh_token,
  });
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: basicAuthHeader(cfg.clientId, cfg.clientSecret),
    },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  await saveTokens({
    realmId: row.realm_id,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresInSec: data.expires_in,
    refreshExpiresInSec: data.x_refresh_token_expires_in,
    environment: row.environment || 'sandbox',
  });
  return { ...row, access_token: data.access_token, refresh_token: data.refresh_token };
}

// Returns a usable access_token. Refreshes transparently if the stored
// one expires in less than 60 seconds (or already has).
export async function getValidAccessToken() {
  const row = await loadActiveTokens();
  if (!row) return null;
  const expiresAt = new Date(row.token_expires_at).getTime();
  const willExpireSoon = expiresAt - Date.now() < 60_000;
  if (!willExpireSoon) return { token: row.access_token, realmId: row.realm_id, row };
  const refreshed = await refreshAccessToken(row);
  return { token: refreshed.access_token, realmId: refreshed.realm_id, row: refreshed };
}

// ─── Revoke (disconnect) ─────────────────────────────────────────
export async function revokeAtIntuit(refreshToken) {
  const cfg = envConfig();
  if (!cfg.ready) throw new Error('QuickBooks env vars not set');
  const res = await fetch(REVOKE_ENDPOINT, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: basicAuthHeader(cfg.clientId, cfg.clientSecret),
    },
    body: JSON.stringify({ token: refreshToken }),
  });
  // 200 or 204 = ok, anything else we just log (worst case the user
  // re-grants on next connect; not fatal).
  if (!res.ok) {
    const text = await res.text();
    console.warn('[quickbooks] revoke failed:', res.status, text);
  }
}

// ─── API fetch wrapper ───────────────────────────────────────────
// Path examples:
//   `/v3/company/{realmId}/query?query=select * from Account`
//   `/v3/company/{realmId}/account?...`
// Pass `path` without leading host.
export async function qbFetch(path, options = {}) {
  const session = await getValidAccessToken();
  if (!session) throw new Error('Not connected to QuickBooks');
  const cfg = envConfig();

  // Auto-inject realmId placeholder if path uses {realmId}.
  const realPath = path.replace('{realmId}', session.realmId);

  // Append minorversion if not already specified.
  const sep = realPath.includes('?') ? '&' : '?';
  const url = `${cfg.apiBase}${realPath}${realPath.includes('minorversion') ? '' : `${sep}minorversion=${MINOR_VERSION}`}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${session.token}`,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`QB API ${res.status}: ${text}`);
  }
  return res.json();
}
