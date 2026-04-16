import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles.css';

const NotFound: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="login-container">
      <div className="login-card error-card">
        <div className="not-found-icon">404</div>
        <h1 className="login-title">Page Not Found</h1>
        <p className="login-subtitle">Sorry, the page you're looking for doesn't exist.</p>
        <p className="error-message">This could be a typo in the URL or a page that has been moved.</p>

        <div className="not-found-actions">
          <button onClick={() => navigate('/me')} className="login-button primary-button">
            <span className="button-icon">🏠</span>
            Go to Dashboard
          </button>
          <button onClick={() => navigate(-1)} className="login-button secondary-button">
            <span className="button-icon">←</span>
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;

