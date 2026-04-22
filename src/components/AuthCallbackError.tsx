import React from 'react';

interface AuthCallbackErrorProps {
  message: string;
  details?: string | null;
}

const AuthCallbackError: React.FC<AuthCallbackErrorProps> = ({ message, details }) => {
  return (
    <div className="login-container">
      <div className="login-card error-card">
        <div className="not-found-icon">!</div>
        <h1 className="login-title">Sign-in Failed</h1>
        <p className="login-subtitle">{message}</p>
        {details && <p className="error-message">Details: {details}</p>}
        <div className="not-found-actions">
          <a href="/login" className="login-button primary-button">
            Try Sign In Again
          </a>
          <a href="/me" className="login-button secondary-button">
            Go to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
};

export default AuthCallbackError;

