import { useEffect, useState } from 'react';
import { getUserInfo } from '../api/client';

export default function Dashboard() {
  const [userInfo, setUserInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUserInfo() {
      try {
        setLoading(true);
        setError(null);
        const data = await getUserInfo();
        console.log('[Dashboard] User info received:', data);
        setUserInfo(data);
      } catch (err) {
        console.error('[Dashboard] Failed to fetch user info:', err);
        setError(err instanceof Error ? err.message : 'Failed to load user info');
      } finally {
        setLoading(false);
      }
    }

    fetchUserInfo();
  }, []);

  if (loading) {
    return <div style={{ padding: '20px' }}>Loading user info...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: '20px', color: 'red' }}>
        <h2>Error</h2>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1>Dashboard</h1>
      <h2>User Information</h2>
      <pre style={{
        background: '#f5f5f5',
        padding: '15px',
        borderRadius: '5px',
        overflow: 'auto'
      }}>
        {JSON.stringify(userInfo, null, 2)}
      </pre>
    </div>
  );
}

