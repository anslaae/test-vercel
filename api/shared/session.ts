import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual
} from 'crypto';
import { refreshTokens, type TokenSet, generateRandomToken } from './auth.js';
import { deleteKey, getJson, hasSharedStore, setJson } from './store.js';
import { isSecureRequest, parseCookies, type VercelRequest } from './http.js';

export interface SessionRecord extends TokenSet {
  id: string;
  createdAt: number;
}

export interface OAuthTransactionRecord {
  state: string;
  verifier: string;
  returnTo: string;
  createdAt: number;
  customState?: string;
}

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'bff_session';
const OAUTH_TRANSACTION_COOKIE_NAME = process.env.OAUTH_TRANSACTION_COOKIE_NAME || 'bff_oauth_tx';
const SESSION_TTL_SECONDS = Number(process.env.SESSION_TTL_SECONDS || 60 * 60 * 8);
const OAUTH_TRANSACTION_TTL_SECONDS = Number(process.env.OAUTH_TRANSACTION_TTL_SECONDS || 60 * 10);
const ACCESS_TOKEN_REFRESH_BUFFER_MS = Number(process.env.ACCESS_TOKEN_REFRESH_BUFFER_SECONDS || 60) * 1000;
const COOKIE_SESSION_PREFIX = 'v1';
const MAX_COOKIE_VALUE_SIZE = 3800;

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

function transactionSigningSecret() {
  return (
    process.env.OAUTH_TRANSACTION_SIGNING_SECRET ||
    process.env.SESSION_SIGNING_SECRET ||
    process.env.CLIENT_SECRET ||
    ''
  );
}

function sessionEncryptionSecret() {
  return (
    process.env.SESSION_ENCRYPTION_SECRET ||
    process.env.SESSION_SIGNING_SECRET ||
    process.env.CLIENT_SECRET ||
    ''
  );
}

function deriveCipherKey(secret: string) {
  return createHash('sha256').update(secret).digest();
}

function encodeEncryptedSessionCookieValue(session: SessionRecord) {
  const secret = sessionEncryptionSecret();
  if (!secret) {
    throw new Error('Missing SESSION_ENCRYPTION_SECRET, SESSION_SIGNING_SECRET, or CLIENT_SECRET for cookie-backed sessions');
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveCipherKey(secret), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(session), 'utf8'),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();
  const value = `${COOKIE_SESSION_PREFIX}.${iv.toString('base64url')}.${authTag.toString('base64url')}.${encrypted.toString('base64url')}`;

  if (value.length > MAX_COOKIE_VALUE_SIZE) {
    throw new Error('Session cookie payload is too large. Configure KV_REST_API_URL / KV_REST_API_TOKEN for shared session storage.');
  }

  return value;
}

function decodeEncryptedSessionCookieValue(rawValue: string) {
  const [prefix, ivPart, authTagPart, encryptedPart] = rawValue.split('.');
  if (prefix !== COOKIE_SESSION_PREFIX || !ivPart || !authTagPart || !encryptedPart) {
    return null;
  }

  const secret = sessionEncryptionSecret();
  if (!secret) {
    return null;
  }

  try {
    const decipher = createDecipheriv('aes-256-gcm', deriveCipherKey(secret), Buffer.from(ivPart, 'base64url'));
    decipher.setAuthTag(Buffer.from(authTagPart, 'base64url'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedPart, 'base64url')),
      decipher.final()
    ]);

    return JSON.parse(decrypted.toString('utf8')) as SessionRecord;
  } catch {
    return null;
  }
}

function encodeTransactionCookieValue(transaction: OAuthTransactionRecord) {
  const payload = Buffer.from(JSON.stringify(transaction), 'utf8').toString('base64url');
  const secret = transactionSigningSecret();

  if (!secret) {
    return payload;
  }

  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function decodeTransactionCookieValue(rawValue: string) {
  const secret = transactionSigningSecret();
  const [payload, signature] = rawValue.split('.');

  if (!payload) {
    return null;
  }

  if (secret) {
    if (!signature) {
      return null;
    }

    const expected = createHmac('sha256', secret).update(payload).digest('base64url');
    const expectedBuffer = Buffer.from(expected);
    const actualBuffer = Buffer.from(signature);

    if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
      return null;
    }
  }

  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as OAuthTransactionRecord;
  } catch {
    return null;
  }
}

function getTransactionFromCookie(req: VercelRequest, expectedState: string) {
  const rawCookieValue = parseCookies(req)[OAUTH_TRANSACTION_COOKIE_NAME];
  if (!rawCookieValue) {
    return null;
  }

  const transaction = decodeTransactionCookieValue(rawCookieValue);
  if (!transaction) {
    return null;
  }

  const expiresAt = transaction.createdAt + OAUTH_TRANSACTION_TTL_SECONDS * 1000;
  if (transaction.state !== expectedState || Date.now() > expiresAt) {
    return null;
  }

  return transaction;
}

function getSessionFromCookie(req: VercelRequest, requireFreshAccessToken = true) {
  const rawCookieValue = parseCookies(req)[SESSION_COOKIE_NAME];
  if (!rawCookieValue || hasSharedStore()) {
    return null;
  }

  const session = decodeEncryptedSessionCookieValue(rawCookieValue);
  if (!session) {
    return null;
  }

  if (requireFreshAccessToken && session.expiresAt <= Date.now() + ACCESS_TOKEN_REFRESH_BUFFER_MS) {
    return null;
  }

  return session;
}

async function getSessionForRefresh(req: VercelRequest) {
  if (!hasSharedStore()) {
    return getSessionFromCookie(req, false);
  }

  const sessionId = getSessionIdFromRequest(req);
  if (!sessionId) {
    return null;
  }

  return getJson<SessionRecord>(sessionKey(sessionId));
}

export function getSessionCookieHeader(session: SessionRecord, req: VercelRequest) {
  const value = hasSharedStore() ? session.id : encodeEncryptedSessionCookieValue(session);
  return buildCookie(SESSION_COOKIE_NAME, value, SESSION_TTL_SECONDS, req);
}

export function getClearedSessionCookieHeader(req: VercelRequest) {
  return buildCookie(SESSION_COOKIE_NAME, '', 0, req);
}

export function getOAuthTransactionCookieHeader(transaction: OAuthTransactionRecord, req: VercelRequest) {
  return buildCookie(
    OAUTH_TRANSACTION_COOKIE_NAME,
    encodeTransactionCookieValue(transaction),
    OAUTH_TRANSACTION_TTL_SECONDS,
    req
  );
}

export function getClearedOAuthTransactionCookieHeader(req: VercelRequest) {
  return buildCookie(OAUTH_TRANSACTION_COOKIE_NAME, '', 0, req);
}

export function getSessionIdFromRequest(req: VercelRequest) {
  return parseCookies(req)[SESSION_COOKIE_NAME] || null;
}

export async function createOAuthTransaction(verifier: string, returnTo: string, customState?: string) {
  const state = generateRandomToken(24);
  const transaction: OAuthTransactionRecord = {
    state,
    verifier,
    returnTo,
    createdAt: Date.now(),
    ...(customState ? { customState } : {})
  };

  await setJson(oauthTransactionKey(state), transaction, OAUTH_TRANSACTION_TTL_SECONDS);
  return transaction;
}

export async function consumeOAuthTransaction(req: VercelRequest, state: string) {
  const fromStore = await getJson<OAuthTransactionRecord>(oauthTransactionKey(state));
  if (fromStore) {
    await deleteKey(oauthTransactionKey(state));
    return fromStore;
  }

  return getTransactionFromCookie(req, state);
}

export async function createSession(tokens: TokenSet) {
  const session: SessionRecord = {
    id: generateRandomToken(32),
    createdAt: Date.now(),
    ...tokens
  };

  if (hasSharedStore()) {
    await setJson(sessionKey(session.id), session, SESSION_TTL_SECONDS);
  }

  return session;
}

export async function deleteSessionById(sessionId: string) {
  if (!hasSharedStore()) {
    return;
  }

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
  if (!hasSharedStore()) {
    return getSessionFromCookie(req);
  }

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

export async function refreshSessionWithRefreshToken(req: VercelRequest) {
  const session = await getSessionForRefresh(req);
  if (!session || !session.refreshToken) {
    return null;
  }

  try {
    const refreshed = await refreshTokens(req, session.refreshToken);
    const updatedSession: SessionRecord = {
      ...session,
      ...refreshed,
      refreshToken: refreshed.refreshToken || session.refreshToken,
      idToken: refreshed.idToken || session.idToken
    };

    if (hasSharedStore()) {
      await setJson(sessionKey(updatedSession.id), updatedSession, SESSION_TTL_SECONDS);
    }

    return updatedSession;
  } catch (error) {
    console.error('[Session] Explicit refresh token exchange failed', error);

    if (hasSharedStore()) {
      await deleteSessionById(session.id);
    }

    return null;
  }
}

