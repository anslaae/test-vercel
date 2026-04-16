import { refreshTokens, type TokenSet, generateRandomToken } from './auth';
import { deleteKey, getJson, setJson } from './store';
import { isSecureRequest, parseCookies, type VercelRequest } from './http';

export interface SessionRecord extends TokenSet {
  id: string;
  createdAt: number;
}

interface OAuthTransactionRecord {
  state: string;
  verifier: string;
  returnTo: string;
  createdAt: number;
}

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'bff_session';
const SESSION_TTL_SECONDS = Number(process.env.SESSION_TTL_SECONDS || 60 * 60 * 8);
const OAUTH_TRANSACTION_TTL_SECONDS = Number(process.env.OAUTH_TRANSACTION_TTL_SECONDS || 60 * 10);
const ACCESS_TOKEN_REFRESH_BUFFER_MS = Number(process.env.ACCESS_TOKEN_REFRESH_BUFFER_SECONDS || 60) * 1000;

function sessionKey(id: string) {
  return `bff:session:${id}`;
}

function oauthTransactionKey(state: string) {
  return `bff:oauth:${state}`;
}

function buildCookie(name: string, value: string, maxAgeSeconds: number, req: VercelRequest) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`
  ];

  if (isSecureRequest(req)) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

export function getSessionCookieHeader(sessionId: string, req: VercelRequest) {
  return buildCookie(SESSION_COOKIE_NAME, sessionId, SESSION_TTL_SECONDS, req);
}

export function getClearedSessionCookieHeader(req: VercelRequest) {
  return buildCookie(SESSION_COOKIE_NAME, '', 0, req);
}

export function getSessionIdFromRequest(req: VercelRequest) {
  return parseCookies(req)[SESSION_COOKIE_NAME] || null;
}

export async function createOAuthTransaction(verifier: string, returnTo: string) {
  const state = generateRandomToken(24);
  const transaction: OAuthTransactionRecord = {
    state,
    verifier,
    returnTo,
    createdAt: Date.now()
  };

  await setJson(oauthTransactionKey(state), transaction, OAUTH_TRANSACTION_TTL_SECONDS);
  return transaction;
}

export async function consumeOAuthTransaction(state: string) {
  const transaction = await getJson<OAuthTransactionRecord>(oauthTransactionKey(state));
  if (transaction) {
    await deleteKey(oauthTransactionKey(state));
  }

  return transaction;
}

export async function createSession(tokens: TokenSet) {
  const session: SessionRecord = {
    id: generateRandomToken(32),
    createdAt: Date.now(),
    ...tokens
  };

  await setJson(sessionKey(session.id), session, SESSION_TTL_SECONDS);
  return session;
}

export async function deleteSessionById(sessionId: string) {
  await deleteKey(sessionKey(sessionId));
}

export async function deleteSession(req: VercelRequest) {
  const sessionId = getSessionIdFromRequest(req);
  if (!sessionId) {
    return null;
  }

  await deleteSessionById(sessionId);
  return sessionId;
}

export async function ensureActiveSession(req: VercelRequest) {
  const sessionId = getSessionIdFromRequest(req);
  if (!sessionId) {
    return null;
  }

  let session = await getJson<SessionRecord>(sessionKey(sessionId));
  if (!session) {
    return null;
  }

  if (session.expiresAt > Date.now() + ACCESS_TOKEN_REFRESH_BUFFER_MS) {
    return session;
  }

  if (!session.refreshToken) {
    await deleteSessionById(sessionId);
    return null;
  }

  try {
    const refreshed = await refreshTokens(req, session.refreshToken);
    session = {
      ...session,
      ...refreshed,
      refreshToken: refreshed.refreshToken || session.refreshToken,
      idToken: refreshed.idToken || session.idToken
    };

    await setJson(sessionKey(session.id), session, SESSION_TTL_SECONDS);
    return session;
  } catch (error) {
    console.error('[Session] Access token refresh failed', error);
    await deleteSessionById(sessionId);
    return null;
  }
}

