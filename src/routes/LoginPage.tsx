import * as React from 'react';
import { useLocation } from 'react-router-dom';
import useAuth from '../auth/useAuth';
import FlowDebugDialog from '../components/FlowDebugDialog';
import AppInfoModal from '../components/AppInfoModal';
import { CUSTOM_STATE_MAX_LENGTH, validateCustomState } from '../../shared/customState';
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
  const [showCustomStateError, setShowCustomStateError] = React.useState(false);
  const [showAppInfo, setShowAppInfo] = React.useState(false);
  const [expandCustomState, setExpandCustomState] = React.useState(false);
  const [expandDebugger, setExpandDebugger] = React.useState(false);

  const customStateValidation = React.useMemo(
    () => validateCustomState(customStateText),
    [customStateText]
  );

  const authIssuer = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_AUTH_ISSUER ?? '(configured server-side)';

  const doLogin = () => {
    login(returnTo, { customState: customStateValidation.normalized });
  };

  const handleSignIn = () => {
    if (!customStateValidation.valid) {
      setShowCustomStateError(true);
      return;
    }

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
    ...(customStateValidation.normalized
      ? [{ label: 'Custom state value', value: customStateValidation.normalized }]
      : [])
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
      <AppInfoModal open={showAppInfo} onClose={() => setShowAppInfo(false)} />
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <div className="logo-icon">🔐</div>
            <h1 className="login-title">Welcome</h1>
            <p className="login-subtitle">Sign in to access your personal dashboard</p>
            <button
              type="button"
              className="learn-more-link"
              onClick={() => setShowAppInfo(true)}
            >
              Learn how this demo works
            </button>
          </div>

           {error && <p className="error-message">{error}</p>}

           <div className="login-options">
             <div className="login-option-group">
               <button
                 type="button"
                 className="login-option-header"
                 onClick={() => setExpandCustomState(!expandCustomState)}
                 aria-expanded={expandCustomState}
               >
                 <span className="login-option-header-icon">
                   {expandCustomState ? '▼' : '▶'}
                 </span>
                 <span className="login-option-header-title">
                   Custom State Parameter <span className="login-option-optional">(optional)</span>
                 </span>
               </button>
               {expandCustomState && (
                 <div className="login-option-content">
                   <p className="login-option-hint">
                     Text entered here is embedded in the OAuth <code>state</code> parameter and
                     returned to you after login — demonstrating how application context can
                     survive the redirect round-trip.
                   </p>
                   <p className="login-option-warning">
                     Do not enter secrets or personal data. State values may appear in browser URLs,
                     logs, and monitoring tools.
                   </p>
                   <input
                     id="custom-state"
                     type="text"
                     className="login-option-input"
                     placeholder="e.g. hello-world"
                     value={customStateText}
                     maxLength={CUSTOM_STATE_MAX_LENGTH}
                     onChange={e => {
                       setCustomStateText(e.target.value);
                       if (showCustomStateError) {
                         setShowCustomStateError(false);
                       }
                     }}
                   />
                   <div className="login-option-meta">
                     <span>{customStateText.length}/{CUSTOM_STATE_MAX_LENGTH}</span>
                     <span>Allowed: letters, numbers, spaces, dot, dash, underscore</span>
                   </div>
                   {showCustomStateError && !customStateValidation.valid && (
                     <p className="login-option-error">{customStateValidation.error}</p>
                   )}
                 </div>
               )}
             </div>

             <div className="login-option-group login-option-checkbox-group">
               <button
                 type="button"
                 className="login-option-header"
                 onClick={() => setExpandDebugger(!expandDebugger)}
                 aria-expanded={expandDebugger}
               >
                 <span className="login-option-header-icon">
                   {expandDebugger ? '▼' : '▶'}
                 </span>
                 <span className="login-option-header-title">
                   Step-by-step flow debugger
                 </span>
               </button>
               {expandDebugger && (
                 <div className="login-option-content">
                   <label className="login-option-checkbox-label">
                     <input
                       type="checkbox"
                       checked={debugMode}
                       onChange={e => setDebugMode(e.target.checked)}
                     />
                     <span>Enable debugger</span>
                   </label>
                   <p className="login-option-hint">
                     Pause at each stage of the Authorization Code flow and inspect what's
                     happening before continuing to the next step.
                   </p>
                 </div>
               )}
             </div>
           </div>

          <button onClick={handleSignIn} className="login-button primary-button">
            <span className="button-icon">🚀</span>
            Sign In with OAuth
          </button>
        </div>
      </div>
    </>
  );
};

export default LoginPage;


