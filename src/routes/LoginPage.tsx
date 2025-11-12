import * as React from 'react';
import useAuth from '../auth/useAuth';

const LoginPage: React.FC = () => {
  const { login, isAuthenticated, tokens, loading } = useAuth();

  if (loading) return <div>Loading auth...</div>;
  if (isAuthenticated) {
    return (
      <div>
        <h1>Already signed in</h1>
        <p>Access token present. You can navigate to the dashboard.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 400, margin: '2rem auto', fontFamily: 'system-ui' }}>
      <h1>Sign In</h1>
      <p>To continue, sign in using OAuth2 (PKCE).</p>
      <button onClick={login} style={{ padding: '0.6rem 1rem', fontSize: '1rem' }}>Sign In</button>
      <details style={{ marginTop: '1rem' }}>
        <summary>Technical details</summary>
        <ul>
          <li>PKCE verifier stored locally until callback completes.</li>
          <li>State parameter added for CSRF protection.</li>
          <li>After redirect, /oauth/callback exchanges code for tokens.</li>
        </ul>
      </details>
      {tokens?.access_token && <small>Token: {tokens.access_token.slice(0,32)}...</small>}
    </div>
  );
};

export default LoginPage;
