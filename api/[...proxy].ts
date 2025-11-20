// Simple BFF proxy for Vercel
// Forwards requests to TARGET_API_BASE without modification

import { IncomingMessage, ServerResponse } from 'http';

const TARGET_API_BASE = process.env.TARGET_API_BASE || '';

interface VercelRequest extends IncomingMessage {
  query: Record<string, string | string[]>;
  cookies: Record<string, string>;
  body: any;
}

export default async function handler(req: VercelRequest, res: ServerResponse) {
  if (!TARGET_API_BASE) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'TARGET_API_BASE not configured' }));
    return;
  }

  // Extract path from URL - remove /api prefix
  const path = req.url?.replace(/^\/api/, '') || '/';
  const targetUrl = `${TARGET_API_BASE}${path}`;

  console.log(`[Proxy] ${req.method} ${req.url} → ${targetUrl}`);

  // Read body if present
  let body: Buffer | undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;
  }

  // Forward headers from client
  const headers: Record<string, string> = {};
  if (req.headers['content-type']) {
    headers['Content-Type'] = req.headers['content-type'] as string;
  }
  if (req.headers['authorization']) {
    headers['Authorization'] = req.headers['authorization'] as string;
  }

  console.log(`[Proxy] Headers:`, headers);
  if (body) {
    console.log(`[Proxy] Body: ${body.toString('utf-8')}`);
  }

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body
    });

    console.log(`[Proxy] Response: ${response.status} ${response.statusText}`);

    // Forward response
    res.statusCode = response.status;

    // Copy response headers
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Send response body
    const responseBody = await response.arrayBuffer();
    res.end(Buffer.from(responseBody));

  } catch (error) {
    console.error(`[Proxy] Error:`, error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Proxy request failed' }));
  }
}

export const config = {
  api: {
    bodyParser: false
  }
};

