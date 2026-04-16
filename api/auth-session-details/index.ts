import { ServerResponse } from 'http';
import {
  ensureActiveSession,
  getClearedSessionCookieHeader,
  getSessionIdFromRequest
} from '../shared/session.js';
import { sendJson, type VercelRequest } from '../shared/http.js';
import { summarizeToken } from '../shared/tokenClaims.js';

export default async function handler(req: VercelRequest, res: ServerResponse) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' }, { Allow: 'GET' });
    return;
  }

  try {
    const session = await ensureActiveSession(req);

    if (!session) {
      const headers: Record<string, string> = {
        'Cache-Control': 'no-store'
      };

      if (getSessionIdFromRequest(req)) {
        headers['Set-Cookie'] = getClearedSessionCookieHeader(req);
      }

      sendJson(res, 401, { authenticated: false }, headers);
      return;
    }

    sendJson(
      res,
      200,
      {
        authenticated: true,
        session: {
          id: session.id,
          createdAt: session.createdAt,
          expiresAt: session.expiresAt,
          hasRefreshToken: !!session.refreshToken
        },
        tokens: {
          access: summarizeToken(session.accessToken),
          id: summarizeToken(session.idToken),
          refresh: summarizeToken(session.refreshToken)
        }
      },
      {
        'Cache-Control': 'no-store'
      }
    );
  } catch (error) {
    console.error('[auth-session-details] Failed to read session details', error);
    sendJson(
      res,
      500,
      { authenticated: false, error: 'Unable to read session details' },
      { 'Cache-Control': 'no-store' }
    );
  }
}

