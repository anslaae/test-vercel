// Backend-for-Frontend proxy on Vercel
// Path usage: /api/anything -> forwards to TARGET_API_BASE + /anything
// Example: /api/tasks/123?expand=true => https://example.com/api/tasks/123?expand=true
// SECURITY: Restrict hosts and sanitize inputs; this file enforces an allowlist.

const ALLOWED_METHODS = ['GET','POST','PUT','PATCH','DELETE','OPTIONS'];
const TARGET_API_BASE = process.env.TARGET_API_BASE; // e.g. https://api.example.com
const API_BEARER_TOKEN = process.env.TARGET_API_BEARER_TOKEN; // optional upstream auth
const ALLOWLIST_PATH_PREFIXES = (process.env.ALLOWLIST_PATH_PREFIXES || '/api,/tasks,/users,/oauth').split(',').map(s => s.trim()).filter(Boolean);
const CORS_ALLOW_ORIGIN = process.env.CORS_ALLOW_ORIGIN || '*'; // configure to your domain in production
const CACHE_TTL_SECONDS = parseInt(process.env.PROXY_CACHE_TTL || '0', 10); // simple in-memory GET cache (not for production scale)

// Basic in-memory cache
const cache: Map<string,{expires:number; body:Buffer; status:number; headers:Record<string,string>}> = new Map();

function matchesAllowlist(path: string) {
  return ALLOWLIST_PATH_PREFIXES.some(p => path === p || path.startsWith(p + '/'));
}

export default async function handler(req: any, res: any) {
  if (!TARGET_API_BASE) {
    res.status(500).json({ error: 'Missing env TARGET_API_BASE' });
    return;
  }
  const method = req.method?.toUpperCase() || 'GET';
  if (!ALLOWED_METHODS.includes(method)) {
    res.setHeader('Access-Control-Allow-Origin', CORS_ALLOW_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS.join(','));
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  // Preflight
  if (method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', CORS_ALLOW_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS.join(','));
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(204).end();
    return;
  }

  const segments = req.query.proxy || [];
  const path = Array.isArray(segments) ? segments.join('/') : segments;
  if (!matchesAllowlist('/' + path)) {
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

  const cacheKey = method === 'GET' ? target.toString() : '';
  if (CACHE_TTL_SECONDS > 0 && cacheKey) {
    const cached = cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      res.setHeader('Access-Control-Allow-Origin', CORS_ALLOW_ORIGIN);
      Object.entries(cached.headers).forEach(([k,v]) => res.setHeader(k, v));
      res.status(cached.status).send(cached.body);
      return;
    }
  }

  const headers: Record<string,string> = {};
  if (API_BEARER_TOKEN) headers['Authorization'] = `Bearer ${API_BEARER_TOKEN}`;
  // Forward limited headers from client if needed (whitelist)
  const forwardContentType = req.headers['content-type'];
  if (forwardContentType) headers['Content-Type'] = forwardContentType as string;

  let body: any = undefined;
  if (!['GET','HEAD'].includes(method)) {
    if (req.body) {
      if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) body = req.body;
      else body = JSON.stringify(req.body);
    }
  }

  try {
    const upstream = await fetch(target.toString(), { method, headers, body });
    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const buf = Buffer.from(await upstream.arrayBuffer());

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
    }
  } catch (err: any) {
    res.setHeader('Access-Control-Allow-Origin', CORS_ALLOW_ORIGIN);
    res.status(502).json({ error: 'Upstream request failed', detail: err.message });
  }
}

export const config = {
  api: {
    bodyParser: true, // allow JSON parsing
  }
};

