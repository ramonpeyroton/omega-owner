// GET /api/quickbooks/auth
//
// Kicks off the QuickBooks OAuth flow. Builds the Intuit authorize URL
// with our client_id, scope and redirect_uri, then 302s the browser
// there. Brenda picks the company in QB, clicks Allow, and Intuit
// bounces back to /api/quickbooks/callback with the auth code.
//
// State parameter: signed-ish random string the callback verifies to
// prevent CSRF. We just generate fresh per request and stash via
// `state` query — accepted because the callback also requires the
// app's session cookie to actually do anything sensitive (and even
// then, the only thing the callback writes is a token row).

import crypto from 'node:crypto';
import { envConfig } from '../_lib/quickbooks.js';
import { json } from '../_lib/http.js';

const AUTHORIZE_BASE = 'https://appcenter.intuit.com/connect/oauth2';
const SCOPE = 'com.intuit.quickbooks.accounting';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  const cfg = envConfig();
  if (!cfg.ready) {
    return json(res, 500, {
      error: 'QuickBooks env vars not configured',
      hint: 'Set QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET and QUICKBOOKS_REDIRECT_URI on Vercel.',
    });
  }

  // CSRF token. The callback re-checks this against the cookie we
  // just set so a stranger can't forge a callback URL that lands a
  // token on our server.
  const state = crypto.randomBytes(16).toString('hex');

  // Build authorize URL.
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    scope: SCOPE,
    redirect_uri: cfg.redirectUri,
    response_type: 'code',
    state,
  });

  const url = `${AUTHORIZE_BASE}?${params.toString()}`;

  // Stash state in a short-lived HttpOnly cookie so the callback can
  // verify. 10 min is plenty for the user to click Allow.
  res.setHeader('Set-Cookie', [
    `qb_oauth_state=${state}; Path=/; Max-Age=600; HttpOnly; SameSite=Lax; Secure`,
  ]);
  res.statusCode = 302;
  res.setHeader('Location', url);
  res.end();
}
