import type { MeResponse, SessionDetails } from '../types/api';

const API_BASE = '/api';

export type MeEmbedKey = 'account' | 'organization' | 'job' | 'manager' | 'photo';

export const DEFAULT_ME_EMBEDS: MeEmbedKey[] = ['account', 'organization', 'job', 'manager', 'photo'];

export class UnauthorizedError extends Error {
  constructor() {
    super('Your session has expired. Please sign in again.');
    this.name = 'UnauthorizedError';
  }
}

async function request(path: string, init?: RequestInit) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.headers || {})
    }
  });

  if (response.status === 401) {
    throw new UnauthorizedError();
  }

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response;
}

export async function getUserInfo(embeds: MeEmbedKey[] = DEFAULT_ME_EMBEDS) {
  const query = embeds.length > 0 ? `?embed=${encodeURIComponent(embeds.join(','))}` : '';
  const response = await request(`/me${query}`, {
    headers: {
      Accept: 'application/hal+json, application/json'
    }
  });
  return response.json() as Promise<MeResponse>;
}

export async function getUserPhotoContent() {
  const response = await fetch(`${API_BASE}/me/photo/content`, {
    credentials: 'include',
    headers: {
      Accept: 'image/*, application/octet-stream'
    }
  });

  if (response.status === 401) {
    throw new UnauthorizedError();
  }

  // The API can signal a missing photo with 404 (content endpoint) or 204.
  if (response.status === 404 || response.status === 204) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.blob();
}

export async function getSessionDetails() {
  const response = await request('/auth-session-details');
  return response.json() as Promise<SessionDetails>;
}

export async function refreshSessionTokens() {
  const response = await request('/auth-refresh', { method: 'POST' });
  return response.json() as Promise<SessionDetails>;
}

