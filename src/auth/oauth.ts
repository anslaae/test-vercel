import { AUTHORIZE_ENDPOINT, CLIENT_ID, REDIRECT_URI, SCOPES, TOKEN_ENDPOINT, CLIENT_SECRET } from './config';
import { generateVerifier, generateChallenge } from './pkce';

export const KEY = 'oauth_tokens';
export const VERIFIER_KEY = 'pkce_verifier';
export const STATE_KEY = 'oauth_state';

export interface Tokens {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_at: number;
}

function generateState(len = 32) {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  // Narrow to URL-safe base64-like random string (alphanumeric)
  return btoa(String.fromCharCode(...Array.from(arr))).replace(/[^a-zA-Z0-9]/g, '').slice(0, len);
}

export function getStoredTokens(): Tokens | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const t = JSON.parse(raw);
    if (Date.now() > t.expires_at) {
      localStorage.removeItem(KEY);
      return null;
    }
    return t;
  } catch {
    return null;
  }
}

export function clearTokens() {
  localStorage.removeItem(KEY);
  localStorage.removeItem(VERIFIER_KEY);
  localStorage.removeItem(STATE_KEY);
}

export async function startLogin() {
  console.log('[OAuth] startLogin initiated');

  const verifier = generateVerifier();
  localStorage.setItem(VERIFIER_KEY, verifier);
  console.log('[OAuth] PKCE verifier generated and stored');

  const challenge = await generateChallenge(verifier);
  console.log('[OAuth] PKCE challenge generated');

  const state = generateState();
  localStorage.setItem(STATE_KEY, state);
  console.log('[OAuth] State generated and stored');

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state
  });

  const authUrl = `${AUTHORIZE_ENDPOINT}?${params.toString()}`;
  console.log('[OAuth] Redirecting to authorization endpoint:', {
    endpoint: AUTHORIZE_ENDPOINT,
    clientId: CLIENT_ID,
    redirectUri: REDIRECT_URI,
    scopes: SCOPES
  });

  globalThis.location.href = authUrl;
}

export async function handleCallback(code: string, returnedState: string | null) {
  console.log('[OAuth] handleCallback started', { hasCode: !!code, hasState: !!returnedState });

  const storedState = localStorage.getItem(STATE_KEY);
  console.log('[OAuth] State validation:', { hasStoredState: !!storedState, statesMatch: storedState === returnedState });

  if (!storedState) throw new Error('Missing stored state');
  if (!returnedState || returnedState !== storedState) throw new Error('Invalid state');

  const verifier = localStorage.getItem(VERIFIER_KEY);
  console.log('[OAuth] PKCE verifier check:', { hasVerifier: !!verifier });

  if (!verifier) throw new Error('Missing PKCE verifier');
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    //client_id: CLIENT_ID,
    code_verifier: verifier
  });
  const basic = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);

  // Extract path from TOKEN_ENDPOINT to route through BFF proxy
  const tokenUrl = new URL(TOKEN_ENDPOINT);
  const proxyPath = `/api${tokenUrl.pathname}`;
  console.log('[OAuth] Token exchange request:', { proxyPath, endpoint: TOKEN_ENDPOINT });

  const res = await fetch(proxyPath, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basic}`
    },
    body
  });

  console.log('[OAuth] Token exchange response:', { status: res.status, ok: res.ok });

  if (!res.ok) {
    const errorText = await res.text();
    console.error('[OAuth] Token exchange failed:', { status: res.status, body: errorText });
    throw new Error('Token exchange failed');
  }

  const json = await res.json();
  console.log('[OAuth] Token received:', {
    hasAccessToken: !!json.access_token,
    hasRefreshToken: !!json.refresh_token,
    hasIdToken: !!json.id_token,
    expiresIn: json.expires_in
  });

  const expires_at = Date.now() + (json.expires_in * 1000 - 5000);
  const tokens: Tokens = { access_token: json.access_token, refresh_token: json.refresh_token, id_token: json.id_token, expires_at };
  localStorage.setItem(KEY, JSON.stringify(tokens));
  console.log('[OAuth] Tokens stored in localStorage');

  globalThis.dispatchEvent(new Event('oauth_tokens_updated'));
  console.log('[OAuth] Dispatched oauth_tokens_updated event');

  localStorage.removeItem(VERIFIER_KEY);
  localStorage.removeItem(STATE_KEY);
  console.log('[OAuth] Cleanup complete, callback finished successfully');

  return tokens;
}
