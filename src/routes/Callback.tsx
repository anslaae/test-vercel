import { useEffect, useMemo, useState } from 'react';
import AuthCallbackError from '../components/AuthCallbackError';
import AuthCallbackLoading from '../components/AuthCallbackLoading';
import FlowDebugDialog from '../components/FlowDebugDialog';
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
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  const debugMode = sessionStorage.getItem('oauth_debug') === '1';
  const [readyToForward, setReadyToForward] = useState(!debugMode || !!errorCode);

  useEffect(() => {
    if (errorCode) {
      console.error('[Callback] OAuth error:', errorCode, errorDescription ?? '(no description)');
      return;
    }

    if (!readyToForward) {
      return;
    }

    const query = globalThis.location.search || '';
    globalThis.location.replace(`/api/auth-callback${query}`);
  }, [errorCode, errorDescription, readyToForward]);

  if (!errorCode && debugMode && !readyToForward && code) {
    const maskedCode = code.slice(0, 10) + '…';
    const maskedState = state ? state.slice(0, 10) + '…' : '(none)';

    return (
      <FlowDebugDialog
        step={2}
        totalSteps={3}
        title="Authorization Code Received"
        description="The authorization server has redirected your browser back with a one-time authorization code. Clicking Continue will forward this code to the BFF, which will exchange it for access, ID, and refresh tokens using the stored PKCE verifier. The tokens never reach your browser."
        details={[
          { label: 'Authorization code', value: maskedCode },
          { label: 'State parameter', value: maskedState },
          { label: 'Next step', value: 'BFF exchanges code at token endpoint (server-side)' }
        ]}
        onContinue={() => setReadyToForward(true)}
      />
    );
  }

  if (!errorCode) {
    return <AuthCallbackLoading />;
  }

  const mappedMessage = getOAuthErrorMessage(errorCode);

  return <AuthCallbackError message={mappedMessage} />;
}


