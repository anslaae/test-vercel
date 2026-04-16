import * as React from 'react';
import { useLocation } from 'react-router-dom';
import useAuth from '../auth/useAuth';
import '../styles.css';

const LoginPage: React.FC = () => {
  const { login, isAuthenticated, loading } = useAuth();
  const location = useLocation();
  const returnTo =
    typeof location.state === 'object' && location.state && 'from' in location.state && typeof location.state.from === 'string'
      ? location.state.from
      : '/me';
  const error = new URLSearchParams(location.search).get('error');

  if (loading) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="spinner"></div>
          <p className="loading-text">Loading authentication...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="login-container">
        <div className="login-card success-card">
          <div className="success-icon">✓</div>
          <h1 className="login-title">You're Already Signed In!</h1>
          <p className="login-subtitle">Your session is active and ready to go.</p>
          <a href="/me" className="login-button primary-button">
            Go to Dashboard →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="logo-icon">🔐</div>
          <h1 className="login-title">Welcome Back</h1>
          <p className="login-subtitle">Sign in to access your personal dashboard</p>
        </div>

          {error && <p className="error-message">{error}</p>}

        <button onClick={() => login(returnTo)} className="login-button primary-button">
          <span className="button-icon">🚀</span>
          Sign In with OAuth
        </button>

        <div className="features">
          <div className="feature-item">
            <span className="feature-icon">🔒</span>
            <span className="feature-text">Secure Authentication</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">⚡</span>
            <span className="feature-text">Quick Access</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">✨</span>
            <span className="feature-text">Modern Experience</span>
          </div>
        </div>

        <details className="technical-details">
          <summary>Technical Details</summary>
          <ul className="details-list">
            <li>OAuth 2.0 + PKCE is handled entirely by Vercel functions</li>
            <li>Access and refresh tokens stay server-side only</li>
            <li>Your browser only keeps an HttpOnly session cookie</li>
            <li>Authenticated API calls flow through the BFF proxy</li>
          </ul>
        </details>
      </div>
    </div>
  );
};

export default LoginPage;
