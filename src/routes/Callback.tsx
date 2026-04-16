import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * This route is kept as a safety net only.
 * The OAuth callback is handled server-side by /api/auth-callback which sets the
 * HttpOnly session cookie and redirects the browser straight to /me (or returnTo).
 * If the browser somehow lands here, forward it on immediately.
 */
const Callback: React.FC = () => {
  const nav = useNavigate();

  useEffect(() => {
    nav('/me', { replace: true });
  }, [nav]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <p>Completing sign-in…</p>
    </div>
  );
};

export default Callback;
