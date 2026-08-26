import type { ChangeCollection, FieldCatalog, FieldChange, FieldValues, ProfileResponse, ProfileUpdateResult, SessionDetails } from '../types/api';

const API_BASE = '/api';

export type ProfileEmbedKey = 'account' | 'organization' | 'job' | 'manager' | 'photo';

export const DEFAULT_PROFILE_EMBEDS: ProfileEmbedKey[] = ['account', 'organization', 'job', 'manager', 'photo'];

export class UnauthorizedError extends Error {
  constructor() {
    super('Your session has expired. Please sign in again.');
    this.name = 'UnauthorizedError';
  }
}

export class ApiError extends Error {
  constructor(
    public readonly endpoint: string,
    public readonly status: number,
    public readonly detail?: string
  ) {
    super(`Request failed with status ${status}`);
    this.name = 'ApiError';
  }
}

async function extractProblemDetail(response: Response) {
  try {
    const body = await response.clone().json();
    return typeof body?.detail === 'string' ? body.detail : undefined;
  } catch {
    return undefined;
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
    throw new ApiError(path, response.status, await extractProblemDetail(response));
  }

  return response;
}

function buildEmbedQuery(embeds: ProfileEmbedKey[]) {
  return embeds.length > 0 ? `?embed=${encodeURIComponent(embeds.join(','))}` : '';
}

export async function getProfile(embeds: ProfileEmbedKey[] = DEFAULT_PROFILE_EMBEDS) {
  const response = await request(`/profiles${buildEmbedQuery(embeds)}`, {
    headers: {
      Accept: 'application/hal+json, application/json'
    }
  });
  return response.json() as Promise<ProfileResponse>;
}

export async function getProfileById(profileId: string, embeds: ProfileEmbedKey[] = DEFAULT_PROFILE_EMBEDS) {
  const response = await request(`/profiles/${encodeURIComponent(profileId)}${buildEmbedQuery(embeds)}`, {
    headers: {
      Accept: 'application/hal+json, application/json'
    }
  });
  return response.json() as Promise<ProfileResponse>;
}

export async function getProfilePhotoContent(profileId: string) {
  // The Profile API has no self-service photo shorthand -- even the caller's own photo
  // is addressed by profileId (unlike /profiles, /profiles/fields, /profiles/values, etc).
  const path = `/profiles/${encodeURIComponent(profileId)}/photo/content`;
  const response = await fetch(`${API_BASE}${path}`, {
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

export async function getEditableFields() {
  const response = await request('/profiles/fields', {
    headers: {
      Accept: 'application/hal+json, application/json'
    }
  });
  return response.json() as Promise<FieldCatalog>;
}

export async function getFieldValues() {
  const response = await request('/profiles/values', {
    headers: {
      Accept: 'application/hal+json, application/json'
    }
  });
  return response.json() as Promise<FieldValues>;
}

export async function updateMyProfile(fields: FieldChange[]) {
  const response = await request('/profiles', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/hal+json, application/json'
    },
    body: JSON.stringify({ fields })
  });
  return response.json() as Promise<ProfileUpdateResult>;
}

export async function getMyChanges() {
  const response = await request('/profiles/changes', {
    headers: {
      Accept: 'application/hal+json, application/json'
    }
  });
  return response.json() as Promise<ChangeCollection>;
}

export async function cancelMyChange(changeId: string) {
  await request(`/profiles/changes/${encodeURIComponent(changeId)}`, { method: 'DELETE' });
}

export async function getSessionDetails() {
  const response = await request('/auth-session-details');
  return response.json() as Promise<SessionDetails>;
}

export async function refreshSessionTokens() {
  const response = await request('/auth-refresh', { method: 'POST' });
  return response.json() as Promise<SessionDetails>;
}

