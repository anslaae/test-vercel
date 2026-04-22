import * as React from 'react';
import { useLocation } from 'react-router-dom';
import useAuth from '../auth/useAuth';
import FlowDebugDialog from '../components/FlowDebugDialog';
import '../styles.css';

const LoginPage: React.FC = () => {
  const { login, isAuthenticated, loading } = useAuth();
  const location = useLocation();
  const returnTo =
    typeof location.state === 'object' && location.state && 'from' in location.state && typeof location.state.from === 'string'
      ? location.state.from
      : '/me';
  const error = new URLSearchParams(location.search).get('error');

  const [customStateText, setCustomStateText] = React.useState('');
  const [debugMode, setDebugMode] = React.useState(false);
  const [showStep1Dialog, setShowStep1Dialog] = React.useState(false);

  const authIssuer = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_AUTH_ISSUER ?? '(configured server-side)';

  const doLogin = () => {
    login(returnTo, { customState: customStateText.trim() || undefined });
  };

  const handleSignIn = () => {
    if (debugMode) {
      sessionStorage.setItem('oauth_debug', '1');
      setShowStep1Dialog(true);
    } else {
      sessionStorage.removeItem('oauth_debug');
      doLogin();
    }
  };

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

  const step1Details = [
    { label: 'Flow type', value: 'Authorization Code + PKCE' },
    { label: 'PKCE method', value: 'S256 (SHA-256)' },
    { label: 'Authorization server', value: authIssuer },
    { label: 'Redirect URI', value: `${globalThis.location.origin}/oauth/callback` },
    ...(customStateText.trim() ? [{ label: 'Custom state value', value: customStateText.trim() }] : [])
  ];

  return (
    <>
      {showStep1Dialog && (
        <FlowDebugDialog
          step={1}
          totalSteps={3}
          title="Initiating OAuth 2.0 Authorization Code Flow"
          description="Your browser is about to be redirected to the authorization server. The BFF will generate a PKCE code verifier (random secret) and its SHA-256 challenge, and store a signed state token in an HttpOnly cookie to protect against CSRF attacks. You will then be asked to authenticate at the authorization server."
          details={step1Details}
          onContinue={() => { setShowStep1Dialog(false); doLogin(); }}
        />
      )}
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <div className="logo-icon">🔐</div>
            <h1 className="login-title">Welcome Back</h1>
            <p className="login-subtitle">Sign in to access your personal dashboard</p>
          </div>

          {error && <p className="error-message">{error}</p>}

          <div className="login-options">
            <div className="login-option-group">
              <label className="login-option-label" htmlFor="custom-state">
                Custom State Parameter <span className="login-option-optional">(optional)</span>
              </label>
              <p className="login-option-hint">
                Text entered here is embedded in the OAuth <code>state</code> parameter and
                returned to you after login — demonstrating how application context can
                survive the redirect round-trip.
              </p>
              <input
                id="custom-state"
                type="text"
                className="login-option-input"
                placeholder="e.g. hello-world"
                value={customStateText}
                onChange={e => setCustomStateText(e.target.value)}
              />
            </div>

            <div className="login-option-group login-option-checkbox-group">
              <label className="login-option-checkbox-label">
                <input
                  type="checkbox"
                  checked={debugMode}
                  onChange={e => setDebugMode(e.target.checked)}
                />
                <span>Step-by-step flow debugger</span>
              </label>
              <p className="login-option-hint">
                Pause at each stage of the Authorization Code flow and inspect what's
                happening before continuing to the next step.
              </p>
            </div>
          </div>

          <button onClick={handleSignIn} className="login-button primary-button">
            <span className="button-icon">🚀</span>
            Sign In with OAuth
          </button>


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
    </>
  );
};

export default LoginPage;


