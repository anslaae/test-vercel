export type JwtClaims = Record<string, unknown>;

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

