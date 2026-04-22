import { useEffect, useMemo } from 'react';
import AuthCallbackError from '../components/AuthCallbackError';
import AuthCallbackLoading from '../components/AuthCallbackLoading';
import { getOAuthErrorMessage } from '../../shared/oauthErrors';

/**
 * Compatibility route for OAuth providers configured with /oauth/callback.
 * On success, forward to the server callback endpoint for code exchange.
 * On OAuth error response, show a user-facing error message.
 */
export default function Callback() {
  const searchParams = useMemo(() => new URLSearchParams(globalThis.location.search), []);
  const errorCode = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  useEffect(() => {
    if (errorCode) {
      return;
    }

    const query = globalThis.location.search || '';
    globalThis.location.replace(`/api/auth-callback${query}`);
  }, [errorCode]);

  if (!errorCode) {
    return <AuthCallbackLoading />;
  }

  const mappedMessage = getOAuthErrorMessage(errorCode);

  return <AuthCallbackError message={mappedMessage} details={errorDescription} />;
}
