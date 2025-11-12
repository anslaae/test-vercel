export const AUTH_ISSUER = import.meta.env.VITE_AUTH_ISSUER as string;
export const CLIENT_ID = import.meta.env.VITE_AUTH_CLIENT_ID as string;
export const CLIENT_SECRET = import.meta.env.VITE_AUTH_CLIENT_SECRET as string; // new: required for Basic auth token exchange
export const REDIRECT_URI = import.meta.env.VITE_AUTH_REDIRECT_URI as string;
export const SCOPES = (import.meta.env.VITE_AUTH_SCOPES as string) || 'openid profile';
export const TOKEN_ENDPOINT = `${AUTH_ISSUER}/oauth2/token`;
export const AUTHORIZE_ENDPOINT = `${AUTH_ISSUER}/oauth2/authorize`;
