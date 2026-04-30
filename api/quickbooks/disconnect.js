// POST /api/quickbooks/disconnect
//
// Revokes the QB connection at Intuit's side and deletes the local
// token row. Idempotent — if there's no active connection, returns
// { ok: true } anyway so the UI can render the disconnected state
// without complaining.

import { loadActiveTokens, deleteTokens, revokeAtIntuit } from '../_lib/quickbooks.js';
import { json } from '../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return json(res, 405, { error: 'Method not allowed' });
  }
  try {
    const row = await loadActiveTokens();
    if (!row) return json(res, 200, { ok: true, alreadyDisconnected: true });

    // Best-effort revoke — don't block on failure.
    try { await revokeAtIntuit(row.refresh_token); } catch { /* logged inside */ }
    await deleteTokens(row.realm_id);
    return json(res, 200, { ok: true });
  } catch (err) {
    return json(res, 500, { error: err?.message || 'Disconnect failed' });
  }
}
