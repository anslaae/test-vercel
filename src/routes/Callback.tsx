import { useEffect } from 'react';

/**
 * Compatibility route for OAuth providers still configured with /oauth/callback.
 * Forward the browser to the server-side callback endpoint with the original query
 * string so BFF can exchange the code and set the HttpOnly session cookie.
 */
const Callback: React.FC = () => {
  useEffect(() => {
    const query = globalThis.location.search || '';
    globalThis.location.replace(`/api/auth-callback${query}`);
  }, []);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <p>Completing sign-in...</p>
    </div>
  );
};

export default Callback;
