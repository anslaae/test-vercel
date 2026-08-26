import type {
  ApprovalQueue,
  ChangeCollection,
  ChangeDecisionValue,
  EmployeeList,
  FieldCatalog,
  FieldChange,
  FieldHistory,
  FieldValues,
  LookupTerm,
  OrganizationOptions,
  PersonCollection,
  ProfileResponse,
  ProfileUpdateResult,
  SessionDetails
} from '../types/api';

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

// Every profile sub-resource below has both a self shorthand (/profiles/<suffix>) and an
// other-person form (/profiles/{profileId}/<suffix>) with an identical response shape, so a
// single generalized function serves both self-service and "view/edit another person" callers.
function profilesPath(suffix: string, profileId?: string) {
  return profileId ? `/profiles/${encodeURIComponent(profileId)}${suffix}` : `/profiles${suffix}`;
}

export async function getEditableFields(profileId?: string) {
  const response = await request(profilesPath('/fields', profileId), {
    headers: {
      Accept: 'application/hal+json, application/json'
    }
  });
  return response.json() as Promise<FieldCatalog>;
}

export async function getFieldValues(profileId?: string) {
  const response = await request(profilesPath('/values', profileId), {
    headers: {
      Accept: 'application/hal+json, application/json'
    }
  });
  return response.json() as Promise<FieldValues>;
}

export async function updateProfile(fields: FieldChange[], profileId?: string) {
  const response = await request(profilesPath('', profileId), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/hal+json, application/json'
    },
    body: JSON.stringify({ fields })
  });
  return response.json() as Promise<ProfileUpdateResult>;
}

export async function getFieldHistory(profileId?: string, keys: string[] = []) {
  const query = keys.length > 0 ? `?${keys.map((key) => `key=${encodeURIComponent(key)}`).join('&')}` : '';
  const response = await request(`${profilesPath('/history', profileId)}${query}`, {
    headers: {
      Accept: 'application/hal+json, application/json'
    }
  });
  return response.json() as Promise<FieldHistory>;
}

export async function getOrganizationOptions(name: string, profileId?: string) {
  const response = await request(`${profilesPath('/organization/options', profileId)}?name=${encodeURIComponent(name)}`, {
    headers: {
      Accept: 'application/hal+json, application/json'
    }
  });
  return response.json() as Promise<OrganizationOptions>;
}

export interface LookupOption {
  id: string;
  label: string;
  sublabel?: string;
}

// /lookup is its own top-level API (not under /profiles) but the BFF proxy forwards any
// /api/* path straight through, so no proxy changes are needed to reach it.
export async function lookupPeople(term: LookupTerm) {
  const response = await request('/lookup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/hal+json, application/json'
    },
    body: JSON.stringify(term)
  });
  return response.json() as Promise<PersonCollection>;
}

// Shared by the PERSON-field lookup in ProfileEditPanel and the standalone "Find a Person"
// search -- guesses which identifier the typed term is from its shape.
export async function searchPeopleByTerm(term: string): Promise<LookupOption[]> {
  const isEmail = term.includes('@');
  const isMultiWord = term.trim().includes(' ');
  const body: LookupTerm = isEmail ? { email: term } : isMultiWord ? { name: term } : { employeeId: term };
  const result = await lookupPeople(body);
  return (result._embedded?.people ?? []).map((person) => ({ id: person.profileId, label: person.displayName }));
}

export async function searchOrganizationsByTerm(term: string, profileId?: string): Promise<LookupOption[]> {
  const result = await getOrganizationOptions(term, profileId);
  return (result._embedded?.organizationOptionResponseList ?? []).map((option) => ({
    id: option.id,
    label: option.name,
    sublabel: option.parentName
  }));
}

export async function getMyEmployees() {
  const response = await request('/profiles/employees', {
    headers: {
      Accept: 'application/hal+json, application/json'
    }
  });
  return response.json() as Promise<EmployeeList>;
}

export async function getChangesAwaitingApproval() {
  const response = await request('/profiles/changes/awaiting-approval', {
    headers: {
      Accept: 'application/hal+json, application/json'
    }
  });
  return response.json() as Promise<ApprovalQueue>;
}

export async function decideChange(changeId: string, decision: ChangeDecisionValue, comment?: string) {
  await request(`/profiles/changes/${encodeURIComponent(changeId)}/decision`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ decision, ...(comment ? { comment } : {}) })
  });
}

export async function getChanges(profileId?: string) {
  const response = await request(profilesPath('/changes', profileId), {
    headers: {
      Accept: 'application/hal+json, application/json'
    }
  });
  return response.json() as Promise<ChangeCollection>;
}

export async function cancelChange(changeId: string, profileId?: string) {
  await request(`${profilesPath('/changes', profileId)}/${encodeURIComponent(changeId)}`, { method: 'DELETE' });
}

export async function getSessionDetails() {
  const response = await request('/auth-session-details');
  return response.json() as Promise<SessionDetails>;
}

export async function refreshSessionTokens() {
  const response = await request('/auth-refresh', { method: 'POST' });
  return response.json() as Promise<SessionDetails>;
}

