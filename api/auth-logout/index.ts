import type { ServerResponse } from 'http';
import { deleteSession, getClearedSessionCookieHeader } from '../shared/session.js';
import { getRequestUrl, redirect, safeReturnTo, sendJson, type VercelRequest } from '../shared/http.js';

export default async function handler(req: VercelRequest, res: ServerResponse) {
  if (!['GET', 'POST', 'DELETE'].includes(req.method || '')) {
    sendJson(res, 405, { error: 'Method not allowed' }, { Allow: 'GET, POST, DELETE' });
    return;
  }

  try {
    await deleteSession(req);
    const sessionCookie = getClearedSessionCookieHeader(req);

    if (req.method === 'GET') {
      const requestUrl = getRequestUrl(req);
      const returnTo = safeReturnTo(requestUrl.searchParams.get('returnTo') || '/login');
      redirect(res, returnTo, 302, {
        'Cache-Control': 'no-store',
        'Set-Cookie': sessionCookie
      });
      return;
    }

    res.statusCode = 204;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Set-Cookie', sessionCookie);
    res.end();
  } catch (error) {
    console.error('[auth-logout] Failed to clear session', error);
    sendJson(res, 500, { error: 'Unable to clear session' }, { 'Cache-Control': 'no-store' });
  }
}

