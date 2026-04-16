import { createHash, randomBytes } from 'crypto';
import { getRequestOrigin, type VercelRequest } from './http';

export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresAt: number;
}

function requiredEnvAny(names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) {
      return value;
    }
  }

  throw new Error(`Missing required environment variable: ${names.join(' or ')}`);
}

export function getAuthConfig(req: VercelRequest) {
  const issuer = requiredEnvAny(['AUTH_ISSUER', 'VITE_AUTH_ISSUER']).replace(/\/+$/, '');
  const clientId = requiredEnvAny(['CLIENT_ID', 'VITE_AUTH_CLIENT_ID']);
  const clientSecret = process.env.CLIENT_SECRET?.trim() || process.env.VITE_AUTH_CLIENT_SECRET?.trim();
  const redirectUri =
    process.env.REDIRECT_URI?.trim() ||
    process.env.VITE_AUTH_REDIRECT_URI?.trim() ||
    `${getRequestOrigin(req)}/api/auth-callback`;
  const scope = (process.env.SCOPES || process.env.VITE_AUTH_SCOPES || 'openid profile').trim();

  return {
    issuer,
    clientId,
    clientSecret,
    redirectUri,
    scope,
    authorizeEndpoint: `${issuer}/oauth2/authorize`,
    tokenEndpoint: `${issuer}/oauth2/token`
  };
}

export function generateRandomToken(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}

export function generatePkceVerifier() {
  return generateRandomToken(48);
}

export function generatePkceChallenge(verifier: string) {
  return createHash('sha256').update(verifier).digest('base64url');
}

function normalizeTokenResponse(payload: any): TokenSet {
  if (!payload?.access_token) {
    throw new Error('Token response did not include an access_token');
  }

  const expiresIn = Number(payload.expires_in ?? 3600);

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    idToken: payload.id_token,
    expiresAt: Date.now() + Math.max(0, expiresIn - 30) * 1000
  };
}

async function requestTokens(req: VercelRequest, params: Record<string, string>) {
  const { tokenEndpoint, clientId, clientSecret, redirectUri } = getAuthConfig(req);
  const body = new URLSearchParams(params);

  if (!body.has('client_id')) {
    body.set('client_id', clientId);
  }

  if (params.grant_type === 'authorization_code' && !body.has('redirect_uri')) {
    body.set('redirect_uri', redirectUri);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded'
  };

  if (clientSecret) {
    headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
  }

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers,
    body
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token request failed (${response.status}): ${errorText.slice(0, 500)}`);
  }

  return normalizeTokenResponse(await response.json());
}

export function exchangeCodeForTokens(req: VercelRequest, code: string, verifier: string) {
  return requestTokens(req, {
    grant_type: 'authorization_code',
    code,
    code_verifier: verifier
  });
}

export function refreshTokens(req: VercelRequest, refreshToken: string) {
  return requestTokens(req, {
    grant_type: 'refresh_token',
    refresh_token: refreshToken
  });
}
