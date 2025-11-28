import * as React from 'react';
import useAuth from '../auth/useAuth';
import '../styles.css';

const LoginPage: React.FC = () => {
  const { login, isAuthenticated, tokens, loading } = useAuth();

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

        <button onClick={login} className="login-button primary-button">
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
            <li>OAuth 2.0 with PKCE flow for enhanced security</li>
            <li>State parameter for CSRF protection</li>
            <li>Secure token exchange on callback</li>
            <li>Encrypted local storage for session data</li>
          </ul>
        </details>
      </div>
    </div>
  );
};

export default LoginPage;
