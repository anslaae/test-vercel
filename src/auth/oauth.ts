import { AUTH_LOGIN_ENDPOINT, AUTH_LOGOUT_ENDPOINT, AUTH_SESSION_ENDPOINT } from './config';

export interface SessionInfo {
  authenticated: true;
  expiresAt?: number;
}

function normalizeReturnTo(returnTo?: string) {
  if (!returnTo || !returnTo.startsWith('/') || returnTo.startsWith('//')) {
    return '/me';
  }

  return returnTo;
}

export function startLogin(returnTo?: string) {
  const target = normalizeReturnTo(returnTo);
  globalThis.location.assign(`${AUTH_LOGIN_ENDPOINT}?returnTo=${encodeURIComponent(target)}`);
}

export async function getSession() {
  const response = await fetch(AUTH_SESSION_ENDPOINT, {
    credentials: 'include',
    cache: 'no-store'
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch session: ${response.status}`);
  }

  return response.json() as Promise<SessionInfo>;
}

export async function endSession() {
  const response = await fetch(AUTH_LOGOUT_ENDPOINT, {
    method: 'POST',
    credentials: 'include'
  });

  if (!response.ok && response.status !== 204) {
    throw new Error(`Failed to end session: ${response.status}`);
  }
}
