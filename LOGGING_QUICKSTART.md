# Quick Logging Reference

## How to View Logs After Deploy

### 1. Real-time Logs (CLI) - RECOMMENDED
```bash
# Install Vercel CLI once
npm i -g vercel

# Login
vercel login

# Stream logs (automatically follows your project)
vercel logs --follow

# Filter for specific patterns
vercel logs --follow | grep "Proxy:"
vercel logs --follow | grep "error"
vercel logs --follow | grep "oauth2/token"
```

### 2. Vercel Dashboard
1. Visit https://vercel.com/dashboard
2. Click your project
3. Click on latest deployment
4. Go to "Functions" tab
5. Click on the `api/[...proxy]` function
6. View logs in real-time

### 3. Direct Deployment URL
```bash
# Get logs from specific deployment
vercel logs https://your-app-xyz123.vercel.app --follow
```

## What You'll See

### Frontend (Browser Console - F12)
```
[AuthProvider] Initializing, checking for stored tokens
[AuthProvider] Login called, starting OAuth flow
[OAuth] startLogin initiated
[OAuth] PKCE verifier generated and stored
[OAuth] Redirecting to authorization endpoint...
[Callback] OAuth callback initiated
[OAuth] Token exchange request: { proxyPath: '/api/oauth2/token' }
[OAuth] Token received: { hasAccessToken: true }
```

### Backend (Vercel Logs)
```
[Proxy:a7k3x2] Request received: { method: 'POST', url: '/api/oauth2/token' }
[Proxy:a7k3x2] Target URL: https://api.example.com/oauth2/token
[Proxy:a7k3x2] Fetching upstream...
[Proxy:a7k3x2] Upstream response: { status: 200, ok: true, duration: '342ms' }
[Proxy:a7k3x2] Request completed successfully
```

## Common Commands

```bash
# View last 100 logs
vercel logs --limit 100

# View logs from last hour
vercel logs --since 1h

# View logs from last 24 hours
vercel logs --since 24h

# Get JSON output for processing
vercel logs --output json

# View logs for production only
vercel logs --prod
```

## Debugging Token Exchange Issues

### Step 1: Check Frontend Flow
Open browser console (F12) and look for:
- ✅ `[OAuth] startLogin initiated`
- ✅ `[OAuth] PKCE verifier generated`
- ✅ `[OAuth] State generated`
- ❌ Any error messages

### Step 2: Check Backend Proxy
Run `vercel logs --follow` and trigger login:
- ✅ `[Proxy:xxx] Request received: { method: 'POST', url: '/api/oauth2/token' }`
- ✅ `[Proxy:xxx] Path not in allowlist` ← Fix: Add `/oauth2` to ALLOWLIST_PATH_PREFIXES
- ✅ `[Proxy:xxx] Target URL:` ← Verify correct upstream URL
- ✅ `[Proxy:xxx] Upstream response:` ← Check status code
- ❌ Any error messages

### Step 3: Check Environment Variables
In Vercel Dashboard → Settings → Environment Variables:
- `TARGET_API_BASE` = https://api.example.com
- `ALLOWLIST_PATH_PREFIXES` = /tasks,/users,/oauth2
- `CORS_ALLOW_ORIGIN` = https://your-domain.com (or * for testing)

### Step 4: Common Errors

**"Path not allowed"**
- Add path to `ALLOWLIST_PATH_PREFIXES` in Vercel env vars
- Redeploy after changing env vars

**"Missing env TARGET_API_BASE"**
- Set `TARGET_API_BASE` in Vercel environment variables
- Redeploy

**"Token exchange failed" with 502**
- Check Vercel logs for upstream error details
- Verify `TARGET_API_BASE` URL is correct
- Check if upstream API is accessible from Vercel

**"Invalid state"**
- Clear browser localStorage
- Try login flow again
- Check for clock skew if issue persists

## Testing Locally

Run dev server and check browser console:
```bash
npm run dev
# Open http://localhost:5173
# Open browser console (F12)
# Click "Sign In"
# Watch logs
```

Note: Local BFF proxy may not work exactly like Vercel; test on Vercel preview deployments.

## Quick Test Commands

```bash
# Deploy to preview
vercel

# Get preview URL (e.g., https://your-app-abc123.vercel.app)
# Open preview URL + /login
# Open another terminal and stream logs:
vercel logs https://your-app-abc123.vercel.app --follow

# Try login and watch logs in real-time
```

## Need Help?

1. Check `VERCEL_LOGGING.md` for detailed guide
2. Check `README.md` for configuration
3. Review logs in Vercel Dashboard
4. Use `vercel logs --follow` for real-time debugging

