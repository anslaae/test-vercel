import { useEffect, useState } from 'react';
import { handleCallback } from '../auth/oauth'; // fixed path
import { useNavigate } from 'react-router-dom';

const Callback: React.FC = () => {
  const nav = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('[Callback] OAuth callback initiated');
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    console.log('[Callback] Received params:', {
      hasCode: !!code,
      codeLength: code?.length,
      hasState: !!state,
      stateLength: state?.length
    });

    if (!code) {
      console.error('[Callback] Missing authorization code');
      setError('Missing authorization code');
      return;
    }

    console.log('[Callback] Starting token exchange...');
    handleCallback(code, state)
      .then(() => {
        console.log('[Callback] Token exchange successful, navigating to /me');
        nav('/me');
      })
      .catch(e => {
        console.error('[Callback] Token exchange failed:', e);
        setError(e.message);
      });
  }, [nav]);

  if (error) return <div>Error: {error}</div>;
  return <div>Completing sign-in...</div>;
};

export default Callback;
