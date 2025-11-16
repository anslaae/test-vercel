# Vercel Logging Guide

## How Logging Works in Vercel

Vercel automatically captures all `console.log`, `console.error`, `console.warn`, and `console.info` statements from your serverless functions and makes them available in the Vercel dashboard.

## Viewing Logs

### Method 1: Vercel Dashboard (Real-time)
1. Go to your project in [Vercel Dashboard](https://vercel.com/dashboard)
2. Click on your deployment
3. Navigate to the **"Functions"** tab
4. Click on any function to see its logs
5. Use the **"Real-time Logs"** feature for live streaming

### Method 2: Vercel CLI (Real-time streaming)
```bash
# Install Vercel CLI if you haven't
npm i -g vercel

# Login
vercel login

# Stream logs from your production deployment
vercel logs --follow

# Stream logs from a specific deployment URL
vercel logs https://your-deployment-url.vercel.app --follow

# Filter by function
vercel logs --follow | grep "Proxy:"
```

### Method 3: Vercel API
You can programmatically fetch logs using the [Vercel API](https://vercel.com/docs/rest-api#endpoints/deployments/get-deployment-events).

## Current Logging Implementation

### Frontend OAuth Flow (Browser Console)
All frontend logging appears in your browser's developer console:
- Open DevTools (F12 or Cmd+Option+I)
- Go to the **Console** tab
- Filter by `[OAuth]`, `[Callback]`, or `[AuthProvider]`

### Backend BFF Proxy (Vercel Logs)
All serverless function logs appear in Vercel's logging system with:
- Request ID for tracing
- Method, URL, and headers
- Target upstream URL
- Cache hits/misses
- Response status and timing
- Error details with stack traces

Example log output:
```
[Proxy:a7k3x2] Request received: { method: 'POST', url: '/api/oauth2/token', headers: [...] }
[Proxy:a7k3x2] Method: POST
[Proxy:a7k3x2] Requested path: { path: 'oauth2/token', segments: ['oauth2', 'token'] }
[Proxy:a7k3x2] Target URL: https://api.example.com/oauth2/token
[Proxy:a7k3x2] Forwarding Content-Type: application/x-www-form-urlencoded
[Proxy:a7k3x2] Request body size: 245 bytes
[Proxy:a7k3x2] Fetching upstream...
[Proxy:a7k3x2] Upstream response: { status: 200, ok: true, duration: '342ms', contentType: 'application/json' }
[Proxy:a7k3x2] Response body size: 1024 bytes
[Proxy:a7k3x2] Request completed successfully
```

## Best Practices

### 1. Use Structured Logging
```typescript
// Good - structured with context
console.log('[Proxy:123] Token exchange', { 
  status: 200, 
  duration: '100ms',
  hasToken: true 
});

// Bad - hard to parse
console.log('Token exchange completed with status 200 in 100ms');
```

### 2. Add Request IDs
Already implemented in the proxy with:
```typescript
const requestId = Math.random().toString(36).substring(7);
console.log(`[Proxy:${requestId}] ...`);
```

This helps trace a single request through multiple log entries.

### 3. Log Levels
Use appropriate console methods:
- `console.log()` - General information
- `console.info()` - Informational (same as log in Vercel)
- `console.warn()` - Warnings (highlighted in dashboard)
- `console.error()` - Errors (highlighted and can trigger alerts)

### 4. Don't Log Sensitive Data
```typescript
// Bad - logs secrets
console.log('[Proxy] Headers:', req.headers);

// Good - logs safe metadata
console.log('[Proxy] Headers:', Object.keys(req.headers));
```

Never log:
- Authorization tokens or API keys
- Client secrets
- User passwords
- Full request/response bodies containing PII

### 5. Performance Logging
```typescript
const startTime = Date.now();
// ... operation ...
const duration = Date.now() - startTime;
console.log(`[Proxy] Operation completed in ${duration}ms`);
```

## Environment-Based Logging

You can add a debug flag to control verbosity:

```typescript
const DEBUG = process.env.DEBUG_LOGGING === 'true';

function debugLog(...args: any[]) {
  if (DEBUG) console.log(...args);
}

// Usage
debugLog('[Proxy] Detailed debug info');  // Only logs if DEBUG_LOGGING=true
console.log('[Proxy] Always logged');     // Always logs
```

Add to Vercel environment variables:
```
DEBUG_LOGGING=true
```

## Monitoring and Alerts

### Set Up Log Drains (Pro/Enterprise)
Vercel Pro and Enterprise plans support [Log Drains](https://vercel.com/docs/observability/log-drains) to send logs to:
- Datadog
- Splunk
- Logtail
- Custom HTTP endpoints

### Set Up Alerts
In Vercel Dashboard:
1. Go to Settings → Integrations
2. Add monitoring integrations like:
   - Sentry (errors)
   - Datadog (metrics + logs)
   - New Relic (APM)

## Common Issues

### Logs Not Appearing
- **Check deployment status**: Logs only appear for successful deployments
- **Wait a few seconds**: There can be a slight delay
- **Check the correct deployment**: Make sure you're viewing the right environment (production/preview)
- **Function timeout**: If function times out, logs may be incomplete

### Log Truncation
- Vercel limits log size per invocation
- Large log outputs may be truncated
- Solution: Log summaries instead of full objects

### Missing Context
- Add request IDs to correlate related logs
- Include timestamps for ordering (Vercel adds these automatically)
- Use consistent prefixes like `[Proxy:id]`

## Production Recommendations

For production deployments:

1. **Use a proper logging service** (Datadog, Splunk, Logtail)
2. **Set up error tracking** (Sentry, Rollbar)
3. **Enable log drains** to retain logs beyond Vercel's retention period
4. **Add structured logging** with JSON format for easier parsing
5. **Implement log levels** to filter by severity
6. **Monitor function duration** to detect performance issues
7. **Set up alerts** for error rates and timeouts

## Example: Production Logger

```typescript
// api/lib/logger.ts
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  requestId?: string;
  userId?: string;
  [key: string]: any;
}

class Logger {
  private prefix: string;
  
  constructor(prefix: string) {
    this.prefix = prefix;
  }
  
  private log(level: LogLevel, message: string, context?: LogContext) {
    const timestamp = new Date().toISOString();
    const logObject = {
      timestamp,
      level,
      prefix: this.prefix,
      message,
      ...context
    };
    
    const method = level === 'error' ? console.error : 
                   level === 'warn' ? console.warn : 
                   console.log;
    
    method(JSON.stringify(logObject));
  }
  
  debug(message: string, context?: LogContext) {
    if (process.env.DEBUG_LOGGING === 'true') {
      this.log('debug', message, context);
    }
  }
  
  info(message: string, context?: LogContext) {
    this.log('info', message, context);
  }
  
  warn(message: string, context?: LogContext) {
    this.log('warn', message, context);
  }
  
  error(message: string, context?: LogContext) {
    this.log('error', message, context);
  }
}

// Usage
const logger = new Logger('Proxy');
logger.info('Request received', { requestId: '123', method: 'POST' });
logger.error('Upstream failed', { requestId: '123', status: 502 });
```

## Useful Commands

```bash
# Tail production logs
vercel logs --follow

# Get last 100 logs
vercel logs --limit 100

# Filter by time range
vercel logs --since 1h

# Get logs for specific deployment
vercel logs <deployment-url>

# JSON output for processing
vercel logs --output json
```

## Resources

- [Vercel Logging Documentation](https://vercel.com/docs/observability/runtime-logs)
- [Vercel CLI Reference](https://vercel.com/docs/cli)
- [Log Drains Guide](https://vercel.com/docs/observability/log-drains)
- [Vercel Monitoring](https://vercel.com/docs/observability)

