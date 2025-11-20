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
    // Since bodyParser is disabled, we need to read the raw body
    if (req.body) {
      // If body is already parsed (shouldn't happen with bodyParser: false)
      if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) {
        body = req.body;
      } else {
        body = JSON.stringify(req.body);
      }
    } else if (req.readable) {
      // Read raw body from stream
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      }
      body = Buffer.concat(chunks);
    }

    if (body) {
      console.log(`[Proxy:${requestId}] Request body size: ${body.length} bytes`);
    }
  }

  // Log complete request details before sending
  console.log(`[Proxy:${requestId}] === UPSTREAM REQUEST ===`);
  console.log(`[Proxy:${requestId}] Method: ${method}`);
  console.log(`[Proxy:${requestId}] URL: ${target.toString()}`);
  console.log(`[Proxy:${requestId}] Headers:`, JSON.stringify(headers, null, 2));

  if (body) {
    try {
      const bodyStr = typeof body === 'string' ? body : body.toString('utf-8');
      if (bodyStr.length <= 2000) {
        console.log(`[Proxy:${requestId}] Request Payload:`, bodyStr);
      } else {
        console.log(`[Proxy:${requestId}] Request Payload (truncated):`, bodyStr.substring(0, 2000) + '...');
      }

      // Try to parse and pretty-print if it's JSON
      if (headers['Content-Type']?.includes('application/json')) {
        try {
          const jsonPayload = JSON.parse(bodyStr);
          console.log(`[Proxy:${requestId}] Request Payload (JSON):`, JSON.stringify(jsonPayload, null, 2));
        } catch {
          // Not valid JSON, already logged as text
        }
      }

      // If it's form-urlencoded, parse and log it nicely
      if (headers['Content-Type']?.includes('application/x-www-form-urlencoded')) {
        try {
          const params = new URLSearchParams(bodyStr);
          const formData: Record<string, string> = {};
          params.forEach((value, key) => {
            // Mask sensitive fields
            if (['code_verifier', 'code', 'client_secret', 'password'].includes(key)) {
              formData[key] = '[REDACTED]';
            } else {
              formData[key] = value;
            }
          });
          console.log(`[Proxy:${requestId}] Request Form Data:`, JSON.stringify(formData, null, 2));
        } catch {
          // Failed to parse form data
        }
      }
    } catch (e) {
      console.log(`[Proxy:${requestId}] Request Payload (binary):`, body.length, 'bytes');
    }
  } else {
    console.log(`[Proxy:${requestId}] Request Payload: (none)`);
  }
  console.log(`[Proxy:${requestId}] === END REQUEST ===`);

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

    // Log response body for debugging (limit size for large responses)
    if (buf.length > 0) {
      try {
        const bodyText = buf.toString('utf-8');
        if (bodyText.length <= 5000) {
          console.log(`[Proxy:${requestId}] Response body:`, bodyText);
        } else {
          console.log(`[Proxy:${requestId}] Response body (truncated):`, bodyText.substring(0, 5000) + '...');
        }
        // Try to parse as JSON for better logging
        if (contentType.includes('application/json')) {
          try {
            const jsonBody = JSON.parse(bodyText);
            console.log(`[Proxy:${requestId}] Response JSON:`, JSON.stringify(jsonBody, null, 2));
          } catch {
            // Not valid JSON, already logged as text
          }
        }
      } catch (e) {
        console.log(`[Proxy:${requestId}] Response body (binary):`, buf.length, 'bytes');
      }
    }

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
    bodyParser: false, // disable automatic parsing to preserve raw body (especially for form-urlencoded)
  }
};

