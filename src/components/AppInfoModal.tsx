import React, { useEffect } from 'react';

interface AppInfoModalProps {
  open: boolean;
  onClose: () => void;
}

const AppInfoModal: React.FC<AppInfoModalProps> = ({ open, onClose }) => {
  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    globalThis.addEventListener('keydown', onKeyDown);
    return () => {
      globalThis.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="app-info-overlay" onClick={onClose}>
      <div
        className="app-info-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-info-title"
        onClick={event => event.stopPropagation()}
      >
        <div className="app-info-header">
          <h2 id="app-info-title">About This Demo</h2>
          <button type="button" className="app-info-close" onClick={onClose} aria-label="Close dialog">
            ×
          </button>
        </div>

        <div className="app-info-content">
          <section className="app-info-section">
            <h3>Purpose</h3>
            <p>
              This app demonstrates OAuth 2.0 Authorization Code flow with PKCE in a browser app
              that uses a Backend-for-Frontend (BFF) architecture.
            </p>
          </section>

          <section className="app-info-section">
            <h3>Architecture</h3>
            <ul>
              <li>React UI initiates sign-in and displays user/session details.</li>
              <li>Vercel API functions act as the BFF and handle OAuth redirects/token exchange.</li>
              <li>Access, ID, and refresh tokens are stored server-side only.</li>
              <li>Browser stores only an HttpOnly session cookie, not raw OAuth tokens.</li>
            </ul>
          </section>

          <section className="app-info-section">
            <h3>Authorization Code Flow (with PKCE)</h3>
            <ol>
              <li>User clicks Sign In; app starts OAuth request with a random state.</li>
              <li>BFF generates PKCE verifier/challenge and redirects to authorization server.</li>
              <li>User authenticates and authorization server redirects back with an auth code.</li>
              <li>BFF exchanges the code + verifier at token endpoint and stores tokens server-side.</li>
              <li>BFF sets HttpOnly session cookie; UI loads user data via BFF endpoints.</li>
            </ol>
          </section>

          <section className="app-info-section">
            <h3>How this differs from Client Credentials Flow</h3>
            <ul>
              <li>
                <strong>Authorization Code:</strong> involves a user, browser redirects, and user
                consent/authentication.
              </li>
              <li>
                <strong>Client Credentials:</strong> machine-to-machine only, no user, no login UI,
                no browser redirect.
              </li>
              <li>
                <strong>Authorization Code:</strong> can return ID/access/refresh tokens tied to a
                user session.
              </li>
              <li>
                <strong>Client Credentials:</strong> returns an app token representing the client
                application itself.
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
};

export default AppInfoModal;

