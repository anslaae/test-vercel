// RFC 6749 section 4.1.2.1 OAuth authorization error response values.
export const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_request: 'The sign-in request was missing or malformed. Please try again.',
  unauthorized_client: 'This application is not authorized to request sign-in this way.',
  access_denied: 'Sign-in was canceled or denied by the authorization server.',
  unsupported_response_type: 'The authorization server does not support this sign-in response type.',
  invalid_scope: 'The requested sign-in scope is invalid or not allowed.',
  server_error: 'The authorization server encountered an error while processing sign-in.',
  temporarily_unavailable: 'The authorization server is temporarily unavailable. Please try again shortly.'
};

export function getOAuthErrorMessage(errorCode?: string | null) {
  const fallbackMessage = 'Sign-in could not be completed. Please try again.';

  if (!errorCode) {
    return fallbackMessage;
  }

  return OAUTH_ERROR_MESSAGES[errorCode] ?? fallbackMessage;
}

