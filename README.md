# Vite + React Template

This is a template for [Vite](https://vitejs.dev/) + [React](https://reactjs.org/) projects.

## Features

- Vite 4.x
- React 18.x
- JSX
- TypeScript
- ESLint
- Prettier
- Vitest

## Clone to Local

```bash
git clone https://github.com/your-username/vite-react-template.git
```

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Preview

```bash
npm run preview
```

## Vercel Routing (Updated)
The project uses `vercel.json` with `routes` for SPA fallback:

```jsonc
{
  "routes": [
    { "handle": "filesystem" },
    { "src": "/.*", "dest": "/index.html" }
  ]
}
```

This ensures direct navigation to client routes like `/login` does not 404 and is not an HTTP redirect; Vercel serves `index.html` directly after first checking for real files/functions.

## Backend-for-Frontend Proxy (Vercel)
A serverless BFF proxy is provided at `api/[...proxy].ts` allowing the frontend to call internal endpoints without CORS issues.

### How it works
- Frontend calls `/api/tasks/123` (same origin, no CORS).
- Function rewrites to `${TARGET_API_BASE}/tasks/123` and returns the response.
- Adds optional Authorization header from `TARGET_API_BEARER_TOKEN`.
- Restricts allowed path prefixes via `ALLOWLIST_PATH_PREFIXES` env var (comma-separated, defaults to `/tasks,/users,/oauth2`).
- **OAuth token exchange**: The `handleCallback` in `oauth.ts` routes token requests through the proxy to avoid CORS issues during authentication.

### Environment Variables
Add to your Vercel project settings or `.env.local`:
```
TARGET_API_BASE=https://api.example.com/v1/
TARGET_API_BEARER_TOKEN=upstream-secret-or-service-token
ALLOWLIST_PATH_PREFIXES=/tasks,/users,/profile,/oauth2
CORS_ALLOW_ORIGIN=https://your-frontend-domain.com
PROXY_CACHE_TTL=30
```

### Example Fetch (Frontend)
```ts
await fetch('/api/tasks/42');
```

### CORS
The browser sees the response as same-origin, avoiding upstream CORS restrictions. Adjust `CORS_ALLOW_ORIGIN` if you consume this proxy from a different origin.

### Security Considerations
- Do not leave the proxy fully open; restrict prefixes.
- Avoid exposing sensitive upstream errors (currently passes status + body when upstream not ok).
- Consider adding rate limiting, auth checks (e.g., verify session token), and logging for production.
- Never allow arbitrary full URLs from client (no open proxy).

### OPTIONS / Preflight
The function handles `OPTIONS` automatically and returns 204 with CORS headers.

### Caching
Simple in-memory cache for successful GET responses when `PROXY_CACHE_TTL` > 0. This resets per function instance and is best-effort.

## Vercel Logging

### Viewing Logs

**Option 1: Vercel Dashboard**
- Go to your project → Deployment → Functions tab
- Click on any function to see logs
- Use Real-time Logs for live streaming

**Option 2: Vercel CLI** (recommended for development)
```bash
# Install CLI
npm i -g vercel

# Stream logs in real-time
vercel logs --follow

# Filter proxy logs
vercel logs --follow | grep "Proxy:"
```

### Frontend Logs (Browser)
- OAuth flow logs appear in browser DevTools Console
- Filter by `[OAuth]`, `[Callback]`, or `[AuthProvider]`

### Backend Logs (Vercel)
- BFF proxy logs include request IDs for tracing
- Shows method, path, target URL, timing, and errors
- Example: `[Proxy:a7k3x2] Upstream response: { status: 200, duration: '342ms' }`

### Detailed Guide
See [VERCEL_LOGGING.md](./VERCEL_LOGGING.md) for:
- Complete logging setup
- Production best practices
- Monitoring and alerts
- Log drains configuration
- Troubleshooting tips

