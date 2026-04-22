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
import { getOAuthErrorMessage } from '../../shared/oauthErrors.js';

function redirectToCallbackError(
  req: VercelRequest,
  res: ServerResponse,
  error: string,
  errorDescription?: string | null,
  errorUri?: string | null,
  state?: string | null
) {
  const params = new URLSearchParams({
    error,
    error_description: errorDescription || getOAuthErrorMessage(error)
  });

  if (errorUri) {
    params.set('error_uri', errorUri);
  }

  if (state) {
    params.set('state', state);
  }

  redirect(res, `/oauth/callback?${params.toString()}`, 302, {
    'Cache-Control': 'no-store',
    'Set-Cookie': [
      getClearedSessionCookieHeader(req),
      getClearedOAuthTransactionCookieHeader(req)
    ]
  });
}

export default async function handler(req: VercelRequest, res: ServerResponse) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' }, { Allow: 'GET' });
    return;
  }

  const requestUrl = getRequestUrl(req);
  const error = requestUrl.searchParams.get('error');
  const errorDescription = requestUrl.searchParams.get('error_description');
  const errorUri = requestUrl.searchParams.get('error_uri');
  const state = requestUrl.searchParams.get('state');

  if (error) {
    redirectToCallbackError(req, res, error, errorDescription, errorUri, state);
    return;
  }

  const code = requestUrl.searchParams.get('code');

  if (!code || !state) {
    redirectToCallbackError(req, res, 'invalid_request', 'Missing authorization response');
    return;
  }

  const transaction = await consumeOAuthTransaction(req, state);

  if (!transaction) {
    redirectToCallbackError(req, res, 'invalid_request', 'Your sign-in session expired. Please try again.');
    return;
  }

  try {
    const tokens = await exchangeCodeForTokens(req, code, transaction.verifier);
    const session = await createSession(tokens);

    const returnPath = safeReturnTo(transaction.returnTo);
    const successRedirect = transaction.customState
      ? `${returnPath}${returnPath.includes('?') ? '&' : '?'}customState=${encodeURIComponent(transaction.customState)}`
      : returnPath;

    redirect(res, successRedirect, 302, {
      'Cache-Control': 'no-store',
      'Set-Cookie': [
        getSessionCookieHeader(session, req),
        getClearedOAuthTransactionCookieHeader(req)
      ]
    });
  } catch (callbackError) {
    console.error('[auth-callback] OAuth callback failed', callbackError);
    redirectToCallbackError(req, res, 'server_error', 'Unable to complete sign-in');
  }
}
