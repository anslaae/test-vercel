import type { ServerResponse } from 'http';
import { ensureActiveSession, deleteSessionById, getClearedSessionCookieHeader, getSessionIdFromRequest } from './shared/session.js';
import { getRequestUrl, readRawBody, sendJson, type VercelRequest } from './shared/http.js';

const AUTH_API_BASE = (process.env.AUTH_API_BASE || 'https://api.devtest.catalystone.dev').replace(/\/+$/, '');
const USER_API_BASE = (process.env.USER_API_BASE || 'https://api.devtest.catalystone.io').replace(/\/+$/, '');
const DEDICATED_AUTH_PATHS = new Set([
  '/auth-login',
  '/auth-callback',
  '/auth-session',
  '/auth-session-details',
  '/auth-logout'
]);

function getForwardHeader(req: VercelRequest, headerName: string) {
  const value = req.headers[headerName.toLowerCase()];
  if (!value) {
    return undefined;
  }

  return Array.isArray(value) ? value.join(', ') : value;
}

export default async function handler(req: VercelRequest, res: ServerResponse) {
  const requestUrl = getRequestUrl(req);
  const path = requestUrl.pathname.replace(/^\/api/, '') || '/';

  if (DEDICATED_AUTH_PATHS.has(path)) {
    sendJson(res, 404, { error: 'Use the dedicated auth endpoint for this route' });
    return;
  }

  const session = await ensureActiveSession(req);
  if (!session) {
    const headers: Record<string, string> = {
      'Cache-Control': 'no-store'
    };

    if (getSessionIdFromRequest(req)) {
      headers['Set-Cookie'] = getClearedSessionCookieHeader(req);
    }

    sendJson(res, 401, { error: 'Unauthenticated' }, headers);
    return;
  }

  const targetBase = path.startsWith('/auth2/') || path.startsWith('/oauth')
    ? AUTH_API_BASE
    : USER_API_BASE;
  const targetUrl = `${targetBase}${path}${requestUrl.search}`;

  console.log(`[Proxy] ${req.method} ${requestUrl.pathname}${requestUrl.search} → ${targetUrl}`);

  const body = req.method !== 'GET' && req.method !== 'HEAD'
    ? await readRawBody(req)
    : undefined;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.accessToken}`
  };

  const contentType = getForwardHeader(req, 'content-type');
  const accept = getForwardHeader(req, 'accept');
  if (contentType) {
    headers['Content-Type'] = contentType;
  }
  if (accept) {
    headers.Accept = accept;
  }

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body
    });

    const responseBuffer = Buffer.from(await response.arrayBuffer());

    res.statusCode = response.status;

    const headersToSkip = new Set(['content-encoding', 'transfer-encoding', 'content-length', 'set-cookie']);
    response.headers.forEach((value, key) => {
      if (!headersToSkip.has(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    if (response.status === 401) {
      await deleteSessionById(session.id);
      res.setHeader('Set-Cookie', getClearedSessionCookieHeader(req));
    }

    res.end(responseBuffer);
  } catch (error) {
    console.error('[Proxy] Request failed', error);
    sendJson(res, 502, { error: 'Proxy request failed' }, { 'Cache-Control': 'no-store' });
  }
}

export const config = {
  api: {
    bodyParser: false
  }
};

