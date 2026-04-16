type JwtClaims = Record<string, unknown>;

interface TokenSummary {
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

function decodeBase64UrlSegment(segment: string) {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, 'base64').toString('utf8');
}

function tryParseJson(input: string) {
  try {
    return JSON.parse(input) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function summarizeToken(token?: string | null): TokenSummary {
  if (!token) {
    return {
      present: false,
      format: 'opaque',
      claimKeys: []
    };
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return {
      present: true,
      format: 'opaque',
      claimKeys: []
    };
  }

  const header = tryParseJson(decodeBase64UrlSegment(parts[0]));
  const claims = tryParseJson(decodeBase64UrlSegment(parts[1]));
  if (!header || !claims) {
    return {
      present: true,
      format: 'opaque',
      claimKeys: []
    };
  }

  const scope =
    ((typeof claims.scope === 'string' || Array.isArray(claims.scope)) && claims.scope) ||
    ((typeof claims.scp === 'string' || Array.isArray(claims.scp)) && claims.scp) ||
    undefined;

  return {
    present: true,
    format: 'jwt',
    header,
    claims,
    claimKeys: Object.keys(claims),
    subject: typeof claims.sub === 'string' ? claims.sub : undefined,
    issuer: typeof claims.iss === 'string' ? claims.iss : undefined,
    audience:
      typeof claims.aud === 'string' || Array.isArray(claims.aud)
        ? (claims.aud as string | string[])
        : undefined,
    scope,
    expiresAt: typeof claims.exp === 'number' ? claims.exp * 1000 : undefined,
    issuedAt: typeof claims.iat === 'number' ? claims.iat * 1000 : undefined
  };
}

export type { TokenSummary };

