import type { ServerResponse } from 'http';
import { exchangeCodeForTokens } from '../shared/auth.js';
import {
  consumeOAuthTransaction,
  createSession,
  getClearedOAuthTransactionCookieHeader,
  getClearedSessionCookieHeader,
  getSessionCookieHeader
} from '../shared/session.js';
import { getRequestUrl, redirect, safeReturnTo, sendJson, type VercelRequest } from '../shared/http.js';

export default async function handler(req: VercelRequest, res: ServerResponse) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' }, { Allow: 'GET' });
    return;
  }

  const requestUrl = getRequestUrl(req);
  const error = requestUrl.searchParams.get('error');
  const errorDescription = requestUrl.searchParams.get('error_description');

  if (error) {
    redirect(res, `/login?error=${encodeURIComponent(errorDescription || error)}`, 302, {
      'Cache-Control': 'no-store',
      'Set-Cookie': [
        getClearedSessionCookieHeader(req),
        getClearedOAuthTransactionCookieHeader(req)
      ]
    });
    return;
  }

  const code = requestUrl.searchParams.get('code');
  const state = requestUrl.searchParams.get('state');

  if (!code || !state) {
    redirect(res, '/login?error=Missing%20authorization%20response', 302, {
      'Cache-Control': 'no-store',
      'Set-Cookie': [
        getClearedSessionCookieHeader(req),
        getClearedOAuthTransactionCookieHeader(req)
      ]
    });
    return;
  }

  const transaction = await consumeOAuthTransaction(req, state);

  if (!transaction) {
    redirect(res, '/login?error=Your%20sign-in%20session%20expired.%20Please%20try%20again.', 302, {
      'Cache-Control': 'no-store',
      'Set-Cookie': [
        getClearedSessionCookieHeader(req),
        getClearedOAuthTransactionCookieHeader(req)
      ]
    });
    return;
  }

  try {
    const tokens = await exchangeCodeForTokens(req, code, transaction.verifier);
    const session = await createSession(tokens);


    redirect(res, safeReturnTo(transaction.returnTo), 302, {
      'Cache-Control': 'no-store',
      'Set-Cookie': [
        getSessionCookieHeader(session, req),
        getClearedOAuthTransactionCookieHeader(req)
      ]
    });
  } catch (callbackError) {
    console.error('[auth-callback] OAuth callback failed', callbackError);
    redirect(res, '/login?error=Unable%20to%20complete%20sign-in', 302, {
      'Cache-Control': 'no-store',
      'Set-Cookie': [
        getClearedSessionCookieHeader(req),
        getClearedOAuthTransactionCookieHeader(req)
      ]
    });
  }
}
