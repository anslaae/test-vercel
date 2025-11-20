// Backend-for-Frontend proxy on Vercel
// Path usage: /api/anything -> forwards to TARGET_API_BASE + /anything
// Example: /api/tasks/123?expand=true => https://example.com/api/tasks/123?expand=true
// SECURITY: Restrict hosts and sanitize inputs; this file enforces an allowlist.

const ALLOWED_METHODS = ['GET','POST','PUT','PATCH','DELETE','OPTIONS'];
const TARGET_API_BASE = process.env.TARGET_API_BASE; // e.g. https://api.example.com
const API_BEARER_TOKEN = process.env.TARGET_API_BEARER_TOKEN; // optional upstream auth
const ALLOWLIST_PATH_PREFIXES = (process.env.ALLOWLIST_PATH_PREFIXES || '/api,/auth2,/tasks,/users,/oauth').split(',').map(s => s.trim()).filter(Boolean);
const CORS_ALLOW_ORIGIN = process.env.CORS_ALLOW_ORIGIN || '*'; // configure to your domain in production
const CACHE_TTL_SECONDS = parseInt(process.env.PROXY_CACHE_TTL || '0', 10); // simple in-memory GET cache (not for production scale)

// Basic in-memory cache
const cache: Map<string,{expires:number; body:Buffer; status:number; headers:Record<string,string>}> = new Map();

function matchesAllowlist(path: string) {
  // Normalize path to always start with /
  const normalizedPath = path.startsWith('/') ? path : '/' + path;
  const matches = ALLOWLIST_PATH_PREFIXES.some(p => {
    const normalizedPrefix = p.startsWith('/') ? p : '/' + p;
    return normalizedPath === normalizedPrefix || normalizedPath.startsWith(normalizedPrefix + '/');
  });
  console.log('[Allowlist Check]', { path, normalizedPath, allowlist: ALLOWLIST_PATH_PREFIXES, matches });
  return matches;
}

export default async function handler(req: any, res: any) {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[Proxy:${requestId}] Request received:`, {
    method: req.method,
    url: req.url,
    headers: Object.keys(req.headers)
  });

  if (!TARGET_API_BASE) {
    console.error(`[Proxy:${requestId}] Missing TARGET_API_BASE environment variable`);
    res.status(500).json({ error: 'Missing env TARGET_API_BASE' });
    return;
  }

  const method = req.method?.toUpperCase() || 'GET';
  console.log(`[Proxy:${requestId}] Method: ${method}`);

  if (!ALLOWED_METHODS.includes(method)) {
    console.warn(`[Proxy:${requestId}] Method not allowed: ${method}`);
    res.setHeader('Access-Control-Allow-Origin', CORS_ALLOW_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS.join(','));
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Preflight
  if (method === 'OPTIONS') {
    console.log(`[Proxy:${requestId}] Handling OPTIONS preflight`);
    res.setHeader('Access-Control-Allow-Origin', CORS_ALLOW_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS.join(','));
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(204).end();
    return;
  }

  // Extract path from URL - req.url is like '/api/auth2/oauth2/token'
  // We need to strip '/api/' prefix to get the actual path to proxy
  let path = '';
  if (req.url) {
    const urlPath = req.url.split('?')[0]; // Remove query string
    console.log(`[Proxy:${requestId}] Full URL path:`, urlPath);

    // Strip /api prefix
    if (urlPath.startsWith('/api/')) {
      path = urlPath.substring(5); // Remove '/api/'
    } else if (urlPath.startsWith('/api')) {
      path = urlPath.substring(4); // Remove '/api'
    }
  }

  // Fallback to query params if URL parsing fails
  if (!path) {
    const segments = req.query.proxy || [];
    path = Array.isArray(segments) ? segments.join('/') : segments;
  }

  console.log(`[Proxy:${requestId}] Extracted path:`, { path, originalUrl: req.url, query: req.query });

  if (!matchesAllowlist(path)) {
    console.warn(`[Proxy:${requestId}] Path not in allowlist:`, {
      path: path,
      normalizedPath: (path.startsWith('/') ? path : '/' + path),
      allowlist: ALLOWLIST_PATH_PREFIXES
    });
    res.setHeader('Access-Control-Allow-Origin', CORS_ALLOW_ORIGIN);
    res.status(403).json({ error: 'Path not allowed' });
    return;
  }

  // Construct target URL
  const target = new URL(path, TARGET_API_BASE.endsWith('/') ? TARGET_API_BASE : TARGET_API_BASE + '/');
  // Append query params except "proxy"
  Object.entries(req.query).forEach(([key,value]) => {
    if (key === 'proxy') return;
    if (Array.isArray(value)) value.forEach(v => target.searchParams.append(key, String(v)));
    else target.searchParams.append(key, String(value));
  });

  console.log(`[Proxy:${requestId}] Target URL:`, target.toString());

  const cacheKey = method === 'GET' ? target.toString() : '';
  if (CACHE_TTL_SECONDS > 0 && cacheKey) {
    const cached = cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      console.log(`[Proxy:${requestId}] Cache HIT for ${cacheKey}`);
      res.setHeader('Access-Control-Allow-Origin', CORS_ALLOW_ORIGIN);
      Object.entries(cached.headers).forEach(([k,v]) => res.setHeader(k, v));
      res.status(cached.status).send(cached.body);
      return;
    } else if (cached) {
      console.log(`[Proxy:${requestId}] Cache EXPIRED for ${cacheKey}`);
    }
  }

  const headers: Record<string,string> = {};

  // Forward Authorization header from client (e.g., Basic auth for OAuth token exchange)
  // Unless API_BEARER_TOKEN is set, which would override it
  if (API_BEARER_TOKEN) {
    headers['Authorization'] = `Bearer ${API_BEARER_TOKEN}`;
    console.log(`[Proxy:${requestId}] Added Bearer token from env`);
  } else if (req.headers['authorization']) {
    headers['Authorization'] = req.headers['authorization'] as string;
    console.log(`[Proxy:${requestId}] Forwarding Authorization header from client`);
  }

  // Forward limited headers from client if needed (whitelist)
  const forwardContentType = req.headers['content-type'];
  if (forwardContentType) {
    headers['Content-Type'] = forwardContentType as string;
    console.log(`[Proxy:${requestId}] Forwarding Content-Type: ${forwardContentType}`);
  }

  let body: any = undefined;
  if (!['GET','HEAD'].includes(method)) {
    if (req.body) {
      if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) body = req.body;
      else body = JSON.stringify(req.body);
      console.log(`[Proxy:${requestId}] Request body size: ${body.length} bytes`);
    }
  }

  try {
    console.log(`[Proxy:${requestId}] Fetching upstream...`);
    const startTime = Date.now();
    const upstream = await fetch(target.toString(), { method, headers, body });
    const duration = Date.now() - startTime;

    console.log(`[Proxy:${requestId}] Upstream response:`, {
      status: upstream.status,
      ok: upstream.ok,
      duration: `${duration}ms`,
      contentType: upstream.headers.get('content-type')
    });

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const buf = Buffer.from(await upstream.arrayBuffer());
    console.log(`[Proxy:${requestId}] Response body size: ${buf.length} bytes`);

    // Set CORS for the browser consuming this response
    res.setHeader('Access-Control-Allow-Origin', CORS_ALLOW_ORIGIN);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Type');
    res.setHeader('Content-Type', contentType);
    res.status(upstream.status).send(buf);

    if (CACHE_TTL_SECONDS > 0 && method === 'GET' && upstream.ok) {
      cache.set(cacheKey, {
        expires: Date.now() + CACHE_TTL_SECONDS * 1000,
        body: buf,
        status: upstream.status,
        headers: { 'Content-Type': contentType }
      });
      console.log(`[Proxy:${requestId}] Cached response for ${CACHE_TTL_SECONDS}s`);
    }

    console.log(`[Proxy:${requestId}] Request completed successfully`);
  } catch (err: any) {
    console.error(`[Proxy:${requestId}] Upstream request failed:`, {
      error: err.message,
      stack: err.stack,
      target: target.toString()
    });
    res.setHeader('Access-Control-Allow-Origin', CORS_ALLOW_ORIGIN);
    res.status(502).json({ error: 'Upstream request failed', detail: err.message });
  }
}

export const config = {
  api: {
    bodyParser: true, // allow JSON parsing
  }
};

