import type { ServerResponse } from 'http';
import {
  ensureActiveSession,
  getClearedSessionCookieHeader,
  getSessionIdFromRequest
} from '../shared/session.js';
import { sendJson, type VercelRequest } from '../shared/http.js';

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
        expiresAt: session.expiresAt
      },
      {
        'Cache-Control': 'no-store'
      }
    );
  } catch (error) {
    console.error('[auth-session] Failed to read session', error);
    sendJson(res, 500, { authenticated: false, error: 'Unable to read session' }, { 'Cache-Control': 'no-store' });
  }
}
