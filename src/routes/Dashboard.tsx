import { useEffect, useState } from 'react';
import { getUserInfo } from '../api/client';
import useAuth from '../auth/useAuth';
import '../styles.css';

export default function Dashboard() {
  const [userInfo, setUserInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { logout } = useAuth();

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
    return (
      <div className="dashboard-container">
        <div className="dashboard-card">
          <div className="spinner"></div>
          <p className="loading-text">Loading your information...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-card error-card">
          <div className="error-icon">⚠️</div>
          <h2 className="dashboard-title">Oops! Something went wrong</h2>
          <p className="error-message">{error}</p>
          <button onClick={() => window.location.reload()} className="login-button secondary-button">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const renderUserData = () => {
    if (!userInfo) return null;

    // Try to extract common fields for a nice display
    const commonFields = ['id', 'email', 'name', 'firstName', 'lastName', 'username', 'displayName'];
    const displayFields: Record<string, any> = {};
    const otherFields: Record<string, any> = {};

    Object.entries(userInfo).forEach(([key, value]) => {
      if (commonFields.includes(key)) {
        displayFields[key] = value;
      } else {
        otherFields[key] = value;
      }
    });

    return (
      <>
        {Object.keys(displayFields).length > 0 && (
          <div className="user-info-grid">
            {Object.entries(displayFields).map(([key, value]) => (
              <div key={key} className="info-item">
                <div className="info-label">{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                <div className="info-value">{String(value)}</div>
              </div>
            ))}
          </div>
        )}

        {Object.keys(otherFields).length > 0 && (
          <details className="raw-data-section" open={Object.keys(displayFields).length === 0}>
            <summary className="raw-data-summary">
              <span>Additional Information</span>
              <span className="summary-badge">{Object.keys(otherFields).length} fields</span>
            </summary>
            <pre className="json-display">
              {JSON.stringify(otherFields, null, 2)}
            </pre>
          </details>
        )}
      </>
    );
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">
            <span className="title-icon">👋</span>
            Welcome to Your Dashboard
          </h1>
          <p className="dashboard-subtitle">Here's your personal information</p>
        </div>
        <button onClick={logout} className="logout-button">
          <span>Sign Out</span>
          <span className="logout-icon">→</span>
        </button>
      </div>

      <div className="dashboard-card">
        <div className="card-header">
          <h2 className="card-title">
            <span className="card-icon">👤</span>
            User Profile
          </h2>
          <span className="status-badge success">Active</span>
        </div>

        <div className="card-content">
          {renderUserData()}
        </div>
      </div>

      <div className="dashboard-footer">
        <p className="footer-text">
          This information is securely fetched from the API using your access token.
        </p>
      </div>
    </div>
  );
}

