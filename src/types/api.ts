export type JwtClaims = Record<string, unknown>;

export interface HalLink {
  href: string;
}

export interface AccountDetails {
  id: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'LOCKED' | null;
}

export interface OrganizationDetails {
  id: string | null;
  name: string | null;
  parentId: string | null;
  managerName: string | null;
  _links?: {
    self?: HalLink;
  };
}

export interface JobDetails {
  title: string | null;
  roleId: string | null;
  roleName: string | null;
  locationName: string | null;
  _links?: {
    self?: HalLink;
  };
}

export interface ManagerDetails {
  id: string | null;
  displayName: string | null;
  email: string | null;
  _links?: {
    self?: HalLink;
  };
}

export interface PhotoDetails {
  mimeType: string | null;
  _links?: {
    self?: HalLink;
    content?: HalLink;
  };
}

export interface ProfileResponse {
  profileId: string | null;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  email: string | null;
  // Self-only: omitted by the API when viewing another person's profile.
  language?: string | null;
  locale?: string | null;
  dateFormat?: string | null;
  _links?: {
    self?: HalLink;
    organization?: HalLink;
    job?: HalLink;
    manager?: HalLink;
    photo?: HalLink;
  };
  _embedded?: {
    account?: AccountDetails;
    organization?: OrganizationDetails;
    job?: JobDetails;
    manager?: ManagerDetails;
    photo?: PhotoDetails;
  };
}

export interface TokenSummary {
  present: boolean;
  format: 'jwt' | 'opaque';
  claimKeys: string[];
  claims?: JwtClaims;
  header?: Record<string, unknown>;
  subject?: string;
  issuer?: string;
  audience?: string | string[];
  scope?: string | string[];
  expiresAt?: number;
  issuedAt?: number;
}

export interface SessionDetails {
  authenticated: boolean;
  session: {
    id: string;
    createdAt: number;
    expiresAt: number;
    hasRefreshToken: boolean;
  };
  tokens: {
    access: TokenSummary;
    id: TokenSummary;
    refresh: TokenSummary;
  };
}

