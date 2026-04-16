import type { IncomingMessage, ServerResponse } from 'http';

export interface VercelRequest extends IncomingMessage {
  query?: Record<string, string | string[]>;
  cookies?: Record<string, string>;
  body?: unknown;
}

export function getRequestOrigin(req: VercelRequest) {
  const forwardedHost = req.headers['x-forwarded-host'];
  const hostHeader = Array.isArray(forwardedHost)
    ? forwardedHost[0]
    : forwardedHost || req.headers.host;
  const forwardedProto = req.headers['x-forwarded-proto'];
  const protoHeader = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
  const protocol = protoHeader || (hostHeader?.includes('localhost') ? 'http' : 'https');

  if (hostHeader) {
    return `${protocol}://${hostHeader}`;
  }

  const fallbackOrigin = process.env.FRONTEND_URL?.replace(/\/+$/, '');
  if (fallbackOrigin) {
    return fallbackOrigin;
  }

  throw new Error('Unable to determine request origin');
}

export function getRequestUrl(req: VercelRequest) {
  return new URL(req.url || '/', getRequestOrigin(req));
}

export function parseCookies(req: VercelRequest) {
  if (req.cookies && Object.keys(req.cookies).length > 0) {
    return req.cookies;
  }

  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) {
    return {} as Record<string, string>;
  }

  return cookieHeader.split(';').reduce<Record<string, string>>((cookies, chunk) => {
    const [name, ...rest] = chunk.trim().split('=');
    if (!name) {
      return cookies;
    }

    cookies[name] = decodeURIComponent(rest.join('='));
    return cookies;
  }, {});
}

export async function readRawBody(req: VercelRequest) {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return chunks.length > 0 ? Buffer.concat(chunks) : undefined;
}

export function isSecureRequest(req: VercelRequest) {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const protoHeader = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
  if (protoHeader) {
    return protoHeader === 'https';
  }

  const host = req.headers.host || '';
  return !host.includes('localhost') && !host.startsWith('127.0.0.1');
}

export function safeReturnTo(value: string | null | undefined) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return '/me';
  }

  return value;
}

export function sendJson(
  res: ServerResponse,
  statusCode: number,
  payload: unknown,
  headers: Record<string, string | string[]> = {}
) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');

  Object.entries(headers).forEach(([name, value]) => {
    res.setHeader(name, value);
  });

  res.end(JSON.stringify(payload));
}

export function redirect(
  res: ServerResponse,
  location: string,
  statusCode = 302,
  headers: Record<string, string | string[]> = {}
) {
  res.statusCode = statusCode;
  res.setHeader('Location', location);

  Object.entries(headers).forEach(([name, value]) => {
    res.setHeader(name, value);
  });

  res.end();
}

