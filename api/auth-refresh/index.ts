import type { ServerResponse } from 'http';
import {
  getClearedSessionCookieHeader,
  getSessionCookieHeader,
  getSessionIdFromRequest,
  refreshSessionWithRefreshToken
} from '../shared/session.js';
import { sendJson, type VercelRequest } from '../shared/http.js';
import { summarizeToken } from '../shared/tokenClaims.js';

export default async function handler(req: VercelRequest, res: ServerResponse) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' }, { Allow: 'POST' });
    return;
  }

  try {
    const refreshedSession = await refreshSessionWithRefreshToken(req);

    if (!refreshedSession) {
      const headers: Record<string, string> = {
        'Cache-Control': 'no-store'
      };

      if (getSessionIdFromRequest(req)) {
        headers['Set-Cookie'] = getClearedSessionCookieHeader(req);
      }

      sendJson(res, 401, { authenticated: false, error: 'Unable to refresh session' }, headers);
      return;
    }

    sendJson(
      res,
      200,
      {
        authenticated: true,
        refreshed: true,
        session: {
          id: refreshedSession.id,
          createdAt: refreshedSession.createdAt,
          expiresAt: refreshedSession.expiresAt,
          hasRefreshToken: !!refreshedSession.refreshToken
        },
        tokens: {
          access: summarizeToken(refreshedSession.accessToken),
          id: summarizeToken(refreshedSession.idToken),
          refresh: summarizeToken(refreshedSession.refreshToken)
        }
      },
      {
        'Cache-Control': 'no-store',
        'Set-Cookie': getSessionCookieHeader(refreshedSession, req)
      }
    );
  } catch (error) {
    console.error('[auth-refresh] Refresh token exchange failed', error);
    sendJson(
      res,
      500,
      { authenticated: false, error: 'Unable to refresh access token' },
      { 'Cache-Control': 'no-store' }
    );
  }
}

