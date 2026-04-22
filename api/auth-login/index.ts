import { getAuthConfig, generatePkceChallenge, generatePkceVerifier } from '../shared/auth.js';
import { createOAuthTransaction, getOAuthTransactionCookieHeader } from '../shared/session.js';
import { getRequestUrl, redirect, safeReturnTo, sendJson, type VercelRequest } from '../shared/http.js';
import { validateCustomState } from '../../shared/customState.js';
import type { ServerResponse } from 'http';

export default async function handler(req: VercelRequest, res: ServerResponse) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' }, { Allow: 'GET' });
    return;
  }

  try {
    const requestUrl = getRequestUrl(req);
    const returnTo = safeReturnTo(requestUrl.searchParams.get('returnTo'));
    const customStateResult = validateCustomState(requestUrl.searchParams.get('customState'));

    if (!customStateResult.valid) {
      sendJson(res, 400, { error: customStateResult.error }, { 'Cache-Control': 'no-store' });
      return;
    }

    const customState = customStateResult.normalized;
    const verifier = generatePkceVerifier();
    const challenge = generatePkceChallenge(verifier);
    const transaction = await createOAuthTransaction(verifier, returnTo, customState);
    const { authorizeEndpoint, clientId, redirectUri, scope } = getAuthConfig(req);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state: transaction.state
    });

    redirect(res, `${authorizeEndpoint}?${params.toString()}`, 302, {
      'Cache-Control': 'no-store',
      'Set-Cookie': getOAuthTransactionCookieHeader(transaction, req)
    });
  } catch (error) {
    console.error('[auth-login] Failed to start OAuth flow', error);
    sendJson(res, 500, { error: 'Unable to start sign-in flow' }, { 'Cache-Control': 'no-store' });
  }
}

