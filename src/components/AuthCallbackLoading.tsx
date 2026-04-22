import React from 'react';

const AuthCallbackLoading: React.FC = () => {
  return (
    <div className="login-container">
      <div className="login-card">
        <div className="spinner"></div>
        <p className="loading-text">Completing sign-in...</p>
      </div>
    </div>
  );
};

export default AuthCallbackLoading;

