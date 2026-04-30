// GET /api/quickbooks/callback?code=...&realmId=...&state=...
//
// Where Intuit sends Brenda after she clicks "Allow" on QuickBooks.
// Verifies state against the cookie set by /api/quickbooks/auth, then
// exchanges the auth code for an access_token + refresh_token pair
// which we persist by realm_id (the QB company ID).
//
// On success: 302 back to the Finance area with `?qb=connected`.
// On error:   302 back with `?qb=error&reason=...` so the UI can show
// a friendly toast.

import { envConfig, exchangeCodeForTokens, saveTokens } from '../_lib/quickbooks.js';
import { json } from '../_lib/http.js';

function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  const match = raw.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  const cfg = envConfig();
  const url = new URL(req.url, `https://${req.headers.host}`);
  const code = url.searchParams.get('code');
  const realmId = url.searchParams.get('realmId');
  const state = url.searchParams.get('state');
  const intuitError = url.searchParams.get('error');

  // Where to bounce back. Read host so this works for both prod and
  // local (the redirect URI itself is checked against Intuit's list,
  // so the host here is trustworthy).
  const appBase = `https://${req.headers.host}`;
  const back = (qs) => {
    res.statusCode = 302;
    // Clear the state cookie regardless of outcome.
    res.setHeader('Set-Cookie', [
      'qb_oauth_state=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure',
    ]);
    res.setHeader('Location', `${appBase}/?${qs}`);
    res.end();
  };

  if (intuitError) {
    return back(`qb=error&reason=${encodeURIComponent(intuitError)}`);
  }
  if (!code || !realmId) {
    return back('qb=error&reason=missing_params');
  }

  // CSRF check.
  const savedState = readCookie(req, 'qb_oauth_state');
  if (!savedState || savedState !== state) {
    return back('qb=error&reason=state_mismatch');
  }

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
