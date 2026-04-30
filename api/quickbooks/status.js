// GET /api/quickbooks/status
//
// Tells the Finance Company tab whether we have an active QB
// connection. Used to render either "Conectar QuickBooks" CTA or the
// list of saldos. Doesn't return tokens (those never leave the server).

import { loadActiveTokens } from '../_lib/quickbooks.js';
import { json } from '../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return json(res, 405, { error: 'Method not allowed' });
  }
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
