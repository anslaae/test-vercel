import {useEffect, useMemo, useState} from 'react';
import {getSessionDetails, getUserInfo, refreshSessionTokens, UnauthorizedError} from '../api/client';
import useAuth from '../auth/useAuth';
import type {SessionDetails} from '../types/api';
import FlowDebugDialog from '../components/FlowDebugDialog';
import AppInfoModal from '../components/AppInfoModal';
import '../styles.css';

export default function Dashboard() {
    const [userInfo, setUserInfo] = useState<Record<string, unknown> | null>(null);
    const [sessionDetails, setSessionDetails] = useState<SessionDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshingUserData, setRefreshingUserData] = useState(false);
    const [refreshingSessionData, setRefreshingSessionData] = useState(false);
    const {logout, refreshSession} = useAuth();

    // Read customState from URL and clean it out immediately
    const customState = useMemo(() => {
        const params = new URLSearchParams(globalThis.location.search);
        const value = params.get('customState');
        if (value) {
            const clean = new URL(globalThis.location.href);
            clean.searchParams.delete('customState');
            globalThis.history.replaceState({}, '', clean.toString());
        }
        return value;
    }, []);

    // Step 3 debug dialog
    const [showStep3Dialog, setShowStep3Dialog] = useState(
        () => sessionStorage.getItem('oauth_debug') === '1'
    );
    const [showAppInfo, setShowAppInfo] = useState(false);
    const [showRefreshExplainDialog, setShowRefreshExplainDialog] = useState(false);
    const [showRefreshCompleteDialog, setShowRefreshCompleteDialog] = useState(false);
    const [refreshDialogDetails, setRefreshDialogDetails] = useState<Array<{ label: string; value: string }>>([]);
    const [showUserDataExplainDialog, setShowUserDataExplainDialog] = useState(false);
    const [showUserDataCompleteDialog, setShowUserDataCompleteDialog] = useState(false);
    const [userDataDialogDetails, setUserDataDialogDetails] = useState<Array<{ label: string; value: string }>>([]);

    const formatTimestamp = (timestampMs?: number) => {
        if (!timestampMs || Number.isNaN(timestampMs)) {
            return 'Not available';
        }

        return new Date(timestampMs).toISOString();
    };

    const handleDismissStep3 = () => {
        sessionStorage.removeItem('oauth_debug');
        setShowStep3Dialog(false);
    };

    useEffect(() => {
        let active = true;

        async function fetchUserInfo() {
            try {
                setLoading(true);
                setError(null);
                const [userData, sessionData] = await Promise.all([getUserInfo(), getSessionDetails()]);
                if (!active) {
                    return;
                }

                setUserInfo(userData);
                setSessionDetails(sessionData);
            } catch (err) {
                if (err instanceof UnauthorizedError) {
                    await refreshSession();
                    return;
                }

                if (!active) {
                    return;
                }

                console.error('[Dashboard] Failed to fetch user info:', err);
                setError(err instanceof Error ? err.message : 'Failed to load user info');
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        }

        fetchUserInfo();

        return () => {
            active = false;
        };
    }, [refreshSession]);

    const handleRefreshUserData = () => {
        setShowUserDataExplainDialog(true);
    };

    const runRefreshUserData = async () => {
        try {
            setRefreshingUserData(true);
            setError(null);
            const userData = await getUserInfo();
            setUserInfo(userData);

            const currentAccessExpiry = sessionDetails?.tokens.access.expiresAt;
            setUserDataDialogDetails([
                {label: 'Request endpoint', value: 'GET /api/personal-details/me'},
                {label: 'Authorization header', value: 'Bearer <access_token>'},
                {label: 'BFF token management', value: 'Automatic refresh if needed'},
                {label: 'Current access token expiry', value: formatTimestamp(currentAccessExpiry)}
            ]);
            setShowUserDataCompleteDialog(true);
        } catch (err) {
            if (err instanceof UnauthorizedError) {
                await refreshSession();
                return;
            }
            console.error('[Dashboard] Failed to refresh user data:', err);
            setError(err instanceof Error ? err.message : 'Failed to refresh user data');
        } finally {
            setRefreshingUserData(false);
        }
    };

    const handleRefreshSessionData = () => {
        if (!sessionDetails?.session.hasRefreshToken) {
            setError('No refresh token is available for this session. Sign in again to get a fresh session.');
            return;
        }

        setShowRefreshExplainDialog(true);
    };

    const runRefreshSessionData = async () => {
        const previousAccessExpiry = sessionDetails?.tokens.access.expiresAt;

        try {
            setRefreshingSessionData(true);
            setError(null);
            const sessionData = await refreshSessionTokens();
            setSessionDetails(sessionData);

            setRefreshDialogDetails([
                {label: 'Token endpoint grant', value: 'refresh_token'},
                {label: 'Previous access token expiry', value: formatTimestamp(previousAccessExpiry)},
                {label: 'New access token expiry', value: formatTimestamp(sessionData.tokens.access.expiresAt)},
                {label: 'Refresh token still present', value: sessionData.session.hasRefreshToken ? 'Yes' : 'No'}
            ]);
            setShowRefreshCompleteDialog(true);
        } catch (err) {
            if (err instanceof UnauthorizedError) {
                await refreshSession();
                return;
            }
            console.error('[Dashboard] Failed to refresh session tokens:', err);
            setError(err instanceof Error ? err.message : 'Failed to refresh session tokens');
        } finally {
            setRefreshingSessionData(false);
        }
    };

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

        const fullName =
            typeof userInfo?.name === 'object' && userInfo?.name !== null && 'fullName' in userInfo.name
                ? (userInfo.name as { fullName?: unknown }).fullName
                : undefined;

        const otherFields: Record<string, unknown> = {...userInfo};
        delete otherFields.name;

        return (
            <>
                {fullName && (
                    <div className="user-info-grid">
                        <div className="info-item">
                            <div className="info-label">Name</div>
                            <div className="info-value">{String(fullName)}</div>
                        </div>
                    </div>
                )}

                <details className="raw-data-section" open={!fullName}>
                    <summary className="raw-data-summary">
                        <h3 className="section-heading">Additional Information</h3>
                        <span className="summary-badge">{Object.keys(otherFields).length} fields</span>
                    </summary>
                    <pre className="json-display">{JSON.stringify(otherFields, null, 2)}</pre>
                </details>
            </>
        );
    };

    const renderSessionData = () => {
        if (!sessionDetails) {
            return null;
        }

        const idClaims = sessionDetails.tokens.id.claims || {};
        const preferredUsername = typeof idClaims.preferred_username === 'string' ? idClaims.preferred_username : undefined;
        const locale = typeof idClaims.locale === 'string' ? idClaims.locale : undefined;
        const userEmailId = typeof idClaims.user_email_id === 'string' ? idClaims.user_email_id : undefined;

        const accessScope = Array.isArray(sessionDetails.tokens.access.scope)
            ? sessionDetails.tokens.access.scope.join(', ')
            : sessionDetails.tokens.access.scope;

        const formatDisplayValue = (value: unknown) => {
            if (value === null || value === undefined || value === '') {
                return 'Not available';
            }

            return String(value);
        };

        const sessionInfoRows: Array<[string, unknown]> = [
            ['Refresh token available', sessionDetails.session.hasRefreshToken ? 'Yes' : 'No'],
            ['Session created', formatTimestamp(sessionDetails.session.createdAt)],
            ['Session expires', formatTimestamp(sessionDetails.session.expiresAt)]
        ];

        const idTokenRows: Array<[string, unknown]> = [
            ['Present', sessionDetails.tokens.id.present ? 'Yes' : 'No'],
            ['Format', sessionDetails.tokens.id.format],
            ['Preferred username', preferredUsername],
            ['Locale', locale],
            ['User email id', userEmailId],
            ['Issued at', formatTimestamp(sessionDetails.tokens.id.issuedAt)],
            ['Expires at', formatTimestamp(sessionDetails.tokens.id.expiresAt)]
        ];

        const accessTokenRows: Array<[string, unknown]> = [
            ['Present', sessionDetails.tokens.access.present ? 'Yes' : 'No'],
            ['Format', sessionDetails.tokens.access.format],
            ['Scope', accessScope],
            ['Issuer', sessionDetails.tokens.access.issuer],
            ['Issued at', formatTimestamp(sessionDetails.tokens.access.issuedAt)],
            ['Expires at', formatTimestamp(sessionDetails.tokens.access.expiresAt)]
        ];

        const refreshTokenRows: Array<[string, unknown]> = [
            ['Present', sessionDetails.tokens.refresh.present ? 'Yes' : 'No'],
            ['Format', sessionDetails.tokens.refresh.format]
        ];

        return (
            <div className="token-sections">
                <section className="token-section">
                    <h4>Session</h4>
                    <div className="kv-list">
                        {sessionInfoRows.map(([key, value]) => (
                            <div key={key} className="kv-row">
                                <span className="kv-key">{key}</span>
                                <span className="kv-value">{formatDisplayValue(value)}</span>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="token-section">
                    <h4>ID Token</h4>
                    <div className="kv-list">
                        {idTokenRows.map(([key, value]) => (
                            <div key={key} className="kv-row">
                                <span className="kv-key">{key}</span>
                                <span className="kv-value">{formatDisplayValue(value)}</span>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="token-section">
                    <h4>Access Token</h4>
                    <div className="kv-list">
                        {accessTokenRows.map(([key, value]) => (
                            <div key={key} className="kv-row">
                                <span className="kv-key">{key}</span>
                                <span className="kv-value">{formatDisplayValue(value)}</span>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="token-section">
                    <h4>Refresh Token</h4>
                    <div className="kv-list">
                        {refreshTokenRows.map(([key, value]) => (
                            <div key={key} className="kv-row">
                                <span className="kv-key">{key}</span>
                                <span className="kv-value">{formatDisplayValue(value)}</span>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        );
    };

    return (
        <div className="dashboard-container">
            {showStep3Dialog && (
                <FlowDebugDialog
                    step={3}
                    totalSteps={3}
                    title="Login Complete — Tokens Exchanged"
                    description="The BFF has successfully exchanged the authorization code for tokens at the authorization server's token endpoint. Your access token, ID token, and refresh token (if issued) are stored securely server-side. Only an HttpOnly session cookie was set in your browser — no tokens ever reached the client."
                    details={[
                        {label: 'Tokens stored', value: 'Server-side only (BFF)'},
                        {label: 'Browser receives', value: 'HttpOnly session cookie'},
                        {label: 'PKCE verifier', value: 'Consumed and discarded'},
                        ...(customState ? [{label: 'Your custom state value', value: customState}] : [])
                    ]}
                    onContinue={handleDismissStep3}
                />
            )}
            {showRefreshExplainDialog && (
                <FlowDebugDialog
                    step={1}
                    totalSteps={2}
                    title="Preparing Refresh Token Exchange"
                    description="Clicking Continue will call a dedicated BFF endpoint. The browser sends only your session cookie; the refresh token itself stays server-side. The BFF then calls the authorization server token endpoint with grant_type=refresh_token to obtain fresh tokens."
                    details={[
                        {label: 'Browser request', value: 'POST /api/auth-refresh'},
                        {label: 'Refresh token location', value: 'Server-side session only'},
                        {label: 'OAuth grant used', value: 'refresh_token'},
                        {label: 'Client exposure', value: 'No tokens exposed to browser JavaScript'}
                    ]}
                    onContinue={() => {
                        setShowRefreshExplainDialog(false);
                        void runRefreshSessionData();
                    }}
                />
            )}
            {showRefreshCompleteDialog && (
                <FlowDebugDialog
                    step={2}
                    totalSteps={2}
                    title="Refresh Complete — Session Updated"
                    description="The BFF stored the refreshed tokens server-side and updated your session. The dashboard now shows the latest token metadata from the BFF."
                    details={refreshDialogDetails}
                    onContinue={() => setShowRefreshCompleteDialog(false)}
                />
            )}
            {showUserDataExplainDialog && (
                <FlowDebugDialog
                    step={1}
                    totalSteps={2}
                    title="Fetching Personal Data Through BFF"
                    description="Clicking Continue will request your personal details from the backend API. Your browser sends only the session cookie; the BFF automatically attaches the access token to the request. If the access token has expired, the BFF will silently refresh it using the refresh token before forwarding your request."
                    details={[
                        {label: 'Request flow', value: 'Browser → BFF → Backend API'},
                        {label: 'Session cookie', value: 'Sent with request (HttpOnly)'},
                        {label: 'Access token', value: 'Attached by BFF (never exposed to browser)'},
                        {label: 'Auto-refresh', value: 'BFF refreshes if token expired'}
                    ]}
                    onContinue={() => {
                        setShowUserDataExplainDialog(false);
                        void runRefreshUserData();
                    }}
                />
            )}
            {showUserDataCompleteDialog && (
                <FlowDebugDialog
                    step={2}
                    totalSteps={2}
                    title="Personal Data Retrieved"
                    description="The BFF successfully forwarded your request to the backend API using your access token. Your personal information is now displayed on the dashboard."
                    details={userDataDialogDetails}
                    onContinue={() => setShowUserDataCompleteDialog(false)}
                />
            )}
            <AppInfoModal open={showAppInfo} onClose={() => setShowAppInfo(false)}/>

            <div className="dashboard-header">
                <div>
                    <h1 className="dashboard-title">
                        <span className="title-icon">👋</span>
                        Welcome to Your Dashboard
                    </h1>
                </div>
                <button onClick={() => logout()} className="logout-button">
                    <span>Sign Out</span>
                    <span className="logout-icon">→</span>
                </button>
            </div>

            <div className="dashboard-card">
                <div className="card-header">
                    <h2 className="card-title">
                        <span className="card-icon">👤</span>
                        Your Personal Information
                    </h2>
                    <div className="card-header-actions">
                        <button
                            onClick={handleRefreshUserData}
                            disabled={refreshingUserData}
                            className="refresh-button"
                            title="Refresh user data"
                        >
                            <span className={`refresh-icon ${refreshingUserData ? 'spinning' : ''}`}>🔄</span>
                            Refresh
                        </button>
                        <span className="status-badge success">Active</span>
                    </div>
                </div>

                <div className="card-content">
                    {customState && (
                        <div className="custom-state-banner">
                            <div className="custom-state-icon">🔄</div>
                            <div className="custom-state-body">
                                <div className="custom-state-label">State parameter returned successfully</div>
                                <div className="custom-state-value">{customState}</div>
                                <div className="custom-state-hint">
                                    This value was embedded in the OAuth <code>state</code> parameter before
                                    login and returned here after successful authentication, demonstrating how
                                    application context can survive the redirect round-trip.
                                </div>
                            </div>
                        </div>
                    )}
                    {renderUserData()}
                </div>
            </div>

            <div className="dashboard-card">
                <div className="card-header">
                    <h2 className="card-title">
                        <span className="card-icon">🔐</span>
                        Session & Technical Details
                    </h2>
                </div>

                <div className="card-content">
                    <details className="token-details">
                        <summary className="token-summary">
                            <h3 className="session-title">Session and Token Information</h3>
                            <span className="summary-badge">4 sections</span>
                        </summary>
                        {renderSessionData()}
                        <div className="technical-section">
                            <button
                                type="button"
                                onClick={handleRefreshSessionData}
                                disabled={refreshingSessionData || !sessionDetails?.session.hasRefreshToken}
                                className="learn-more-link-section token-refresh-button"
                                title={
                                    sessionDetails?.session.hasRefreshToken
                                        ? 'Use the refresh token in the BFF to request a new access token'
                                        : 'No refresh token available for this session'
                                }
                            >
                                <span
                                    className={`section-learn-icon refresh-icon ${refreshingSessionData ? 'spinning' : ''}`}>🔄</span>
                                <span>Refresh Tokens in BFF</span>
                            </button>
                        </div>
                    </details>

                    <div className="technical-section">
                        <button
                            type="button"
                            className="learn-more-link-section"
                            onClick={() => setShowAppInfo(true)}
                        >
                            <span className="section-learn-icon">ℹ️</span>
                            <span>Learn how this demo works</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="dashboard-footer">
                <p className="footer-text">
                    This information is securely fetched through the BFF using your server-side session.
                </p>
            </div>
        </div>
    );
}
