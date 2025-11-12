import { useEffect, useState } from 'react';
import { handleCallback } from '../auth/oauth'; // fixed path
import { useNavigate } from 'react-router-dom';

const Callback: React.FC = () => {
  const nav = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    if (!code) {
      setError('Missing authorization code');
      return;
    }
    handleCallback(code, state)
      .then(() => nav('/'))
      .catch(e => setError(e.message));
  }, [nav]);

  if (error) return <div>Error: {error}</div>;
  return <div>Completing sign-in...</div>;
};

export default Callback;
