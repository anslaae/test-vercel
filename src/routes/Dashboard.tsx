import {useEffect, useMemo, useState} from 'react';
import {
    DEFAULT_PROFILE_EMBEDS,
    getSessionDetails,
    getProfile,
    getProfilePhotoContent,
    refreshSessionTokens,
    UnauthorizedError,
    ApiError,
    type ProfileEmbedKey
} from '../api/client';
import useAuth from '../auth/useAuth';
import type {ProfileResponse, SessionDetails} from '../types/api';
import FlowDebugDialog from '../components/FlowDebugDialog';
import AppInfoModal from '../components/AppInfoModal';
import '../styles.css';

const EMBED_OPTIONS: Array<{ key: ProfileEmbedKey; label: string }> = [
    {key: 'account', label: 'Account'},
    {key: 'organization', label: 'Organization'},
    {key: 'job', label: 'Job'},
    {key: 'manager', label: 'Manager'},
    {key: 'photo', label: 'Photo'}
];

const EMBED_STORAGE_KEY = 'dashboard_profile_embeds';
const VALID_EMBED_KEYS = new Set<ProfileEmbedKey>(EMBED_OPTIONS.map((option) => option.key));

function loadEmbedSelection(): ProfileEmbedKey[] {
    const raw = sessionStorage.getItem(EMBED_STORAGE_KEY);
    if (!raw) {
        return DEFAULT_PROFILE_EMBEDS;
    }

    const parsed = raw
        .split(',')
        .map((value) => value.trim())
        .filter((value): value is ProfileEmbedKey => VALID_EMBED_KEYS.has(value as ProfileEmbedKey));

    if (parsed.length === 0) {
        return DEFAULT_PROFILE_EMBEDS;
    }

    // Keep stable rendering order based on the configured embed options.
    return EMBED_OPTIONS
        .map((option) => option.key)
        .filter((key) => parsed.includes(key));
}

export default function Dashboard() {
    const [debugMode, setDebugMode] = useState(() => sessionStorage.getItem('oauth_debug_enabled') === '1');
    const debuggerEnabled = debugMode;
    const [selectedEmbeds, setSelectedEmbeds] = useState<ProfileEmbedKey[]>(() => loadEmbedSelection());
    const [appliedEmbeds, setAppliedEmbeds] = useState<ProfileEmbedKey[]>(() => loadEmbedSelection());
    const selectedEmbedQueryValue = selectedEmbeds.join(',');
    const selectedProfileEndpointWithEmbeds = selectedEmbedQueryValue ? `/api/profiles?embed=${selectedEmbedQueryValue}` : '/api/profiles';
    const appliedEmbedQueryValue = appliedEmbeds.join(',');
    const appliedProfileEndpointWithEmbeds = appliedEmbedQueryValue ? `/api/profiles?embed=${appliedEmbedQueryValue}` : '/api/profiles';
    const selectedEmbedSignature = [...selectedEmbeds].sort().join(',');
    const appliedEmbedSignature = [...appliedEmbeds].sort().join(',');
    const hasPendingEmbedChanges = selectedEmbedSignature !== appliedEmbedSignature;
    const [userInfo, setUserInfo] = useState<ProfileResponse | null>(null);
    const [userInfoError, setUserInfoError] = useState<{message: string; endpoint: string; status?: number} | null>(null);
    const [sessionDetails, setSessionDetails] = useState<SessionDetails | null>(null);
    const [loading, setLoading] = useState(
        () => sessionStorage.getItem('oauth_debug') !== '1'
    );
    const [error, setError] = useState<string | null>(null);
    const [refreshingUserData, setRefreshingUserData] = useState(false);
    const [refreshingSessionData, setRefreshingSessionData] = useState(false);
    const [photoUrl, setPhotoUrl] = useState<string | null>(null);
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
    const [showStep4Dialog, setShowStep4Dialog] = useState(false);
    const [allowInitialDashboardLoad, setAllowInitialDashboardLoad] = useState(
        () => sessionStorage.getItem('oauth_debug') !== '1'
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
        setShowStep3Dialog(false);
        setShowStep4Dialog(true);
    };

    const handleDismissStep4 = () => {
        sessionStorage.removeItem('oauth_debug');
        setShowStep4Dialog(false);
        setAllowInitialDashboardLoad(true);
    };

    useEffect(() => {
        if (!allowInitialDashboardLoad) {
            return;
        }

        let active = true;

        async function fetchAllData() {
            try {
                setLoading(true);
                setError(null);
                setUserInfoError(null);

                const [userResult, sessionResult] = await Promise.allSettled([
                    getProfile(appliedEmbeds),
                    getSessionDetails()
                ]);

                if (!active) return;

                // Handle session result — auth failures are blocking
                if (sessionResult.status === 'rejected') {
                    const err = sessionResult.reason;
                    if (err instanceof UnauthorizedError) {
                        const nextSession = await refreshSession();
                        if (!active) return;
                        if (!nextSession) {
                            setError('Your session has expired. Please sign in again.');
                            return;
                        }
                        // Retry both after session refresh
                        const [retryUser, retrySession] = await Promise.allSettled([
                            getProfile(appliedEmbeds),
                            getSessionDetails()
                        ]);
                        if (!active) return;
                        if (retrySession.status === 'fulfilled') setSessionDetails(retrySession.value);
                        if (retryUser.status === 'fulfilled') {
                            setUserInfo(retryUser.value);
                        } else {
                            const retryErr = retryUser.reason;
                            setUserInfoError({
                                message: retryErr instanceof Error ? retryErr.message : 'Failed to load personal details',
                                endpoint: retryErr instanceof ApiError ? retryErr.endpoint : appliedProfileEndpointWithEmbeds,
                                status: retryErr instanceof ApiError ? retryErr.status : undefined
                            });
                        }
                        return;
                    }
                    setError(err instanceof Error ? err.message : 'Failed to load session');
                    return;
                }

                setSessionDetails(sessionResult.value);

                // Handle user info result — non-blocking: show the page with an inline error
                if (userResult.status === 'fulfilled') {
                    setUserInfo(userResult.value);
                    setUserInfoError(null);
                } else {
                    const err = userResult.reason;
                    if (err instanceof UnauthorizedError) {
                        const nextSession = await refreshSession();
                        if (!active) return;
                        if (!nextSession) {
                            setError('Your session has expired. Please sign in again.');
                            return;
                        }
                        try {
                            const retryData = await getProfile(appliedEmbeds);
                            if (!active) return;
                            setUserInfo(retryData);
                            setUserInfoError(null);
                        } catch (retryErr) {
                            if (!active) return;
                            setUserInfoError({
                                message: retryErr instanceof Error ? retryErr.message : 'Failed to load personal details',
                                endpoint: retryErr instanceof ApiError ? retryErr.endpoint : appliedProfileEndpointWithEmbeds,
                                status: retryErr instanceof ApiError ? retryErr.status : undefined
                            });
                        }
                        return;
                    }
                    console.error('[Dashboard] Personal details API failed:', err);
                    setUserInfoError({
                        message: err instanceof Error ? err.message : 'Failed to load personal details',
                        endpoint: err instanceof ApiError ? err.endpoint : appliedProfileEndpointWithEmbeds,
                        status: err instanceof ApiError ? err.status : undefined
                    });
                }

                // Photo is always non-blocking. The Profile API has no self-service photo
                // shorthand — even the caller's own photo is addressed by profileId.
                const profileId = userResult.status === 'fulfilled' ? userResult.value.profileId : null;
                if (profileId) {
                    try {
                        const photoBlob = await getProfilePhotoContent(profileId);
                        if (!active) return;
                        setPhotoUrl((current) => {
                            if (current) URL.revokeObjectURL(current);
                            return photoBlob ? URL.createObjectURL(photoBlob) : null;
                        });
                    } catch (photoError) {
                        if (!active) return;
                        if (photoError instanceof UnauthorizedError) return;
                        console.warn('[Dashboard] Failed to load profile photo:', photoError);
                        setPhotoUrl((current) => {
                            if (current) URL.revokeObjectURL(current);
                            return null;
                        });
                    }
                }
            } catch (err) {
                if (!active) return;
                console.error('[Dashboard] Unexpected error:', err);
                setError(err instanceof Error ? err.message : 'Something went wrong');
            } finally {
                if (active) setLoading(false);
            }
        }

        fetchAllData();

        return () => {
            active = false;
        };
    }, [allowInitialDashboardLoad, refreshSession, appliedEmbedQueryValue, appliedEmbeds]);

    useEffect(() => {
        return () => {
            if (photoUrl) {
                URL.revokeObjectURL(photoUrl);
            }
        };
    }, [photoUrl]);

    useEffect(() => {
        sessionStorage.setItem(EMBED_STORAGE_KEY, selectedEmbeds.join(','));
    }, [selectedEmbeds]);

    const toggleEmbed = (embedKey: ProfileEmbedKey) => {
        setSelectedEmbeds((current) => {
            if (current.includes(embedKey)) {
                return current.filter((value) => value !== embedKey);
            }

            return [...current, embedKey];
        });
    };

    const toggleDebugMode = () => {
        const newMode = !debugMode;
        setDebugMode(newMode);
        if (newMode) {
            sessionStorage.setItem('oauth_debug_enabled', '1');
        } else {
            sessionStorage.removeItem('oauth_debug_enabled');
        }
    };

    const handleRefreshUserData = () => {
        if (!debuggerEnabled) {
            void runRefreshUserData();
            return;
        }

        setShowUserDataExplainDialog(true);
    };

    const runRefreshUserData = async () => {
        const requestEmbeds = selectedEmbeds;
        const requestQueryValue = requestEmbeds.join(',');
        const requestEndpoint = requestQueryValue ? `/api/profiles?embed=${requestQueryValue}` : '/api/profiles';

        try {
            setRefreshingUserData(true);
            setError(null);
            setUserInfoError(null);
            setAppliedEmbeds(requestEmbeds);
            const userData = await getProfile(requestEmbeds);
            setUserInfo(userData);

            if (userData.profileId) {
                try {
                    const photoBlob = await getProfilePhotoContent(userData.profileId);
                    setPhotoUrl((current) => {
                        if (current) {
                            URL.revokeObjectURL(current);
                        }

                        return photoBlob ? URL.createObjectURL(photoBlob) : null;
                    });
                } catch (photoError) {
                    if (photoError instanceof UnauthorizedError) {
                        await refreshSession();
                        return;
                    }

                    console.warn('[Dashboard] Failed to refresh profile photo:', photoError);
                    setPhotoUrl((current) => {
                        if (current) {
                            URL.revokeObjectURL(current);
                        }
                        return null;
                    });
                }
            }

             if (debuggerEnabled) {
                 const currentAccessExpiry = sessionDetails?.tokens.access.expiresAt;
                 setUserDataDialogDetails([
                      {label: 'Request endpoint', value: `GET ${requestEndpoint}`},
                     {label: 'Authorization header', value: 'Bearer <access_token>'},
                     {label: 'BFF token management', value: 'Automatic refresh if needed'},
                     {label: 'Current access token expiry', value: formatTimestamp(currentAccessExpiry)}
                 ]);
                 setShowUserDataCompleteDialog(true);
             }
        } catch (err) {
            if (err instanceof UnauthorizedError) {
                await refreshSession();
                return;
            }
            console.error('[Dashboard] Failed to refresh user data:', err);
            setUserInfoError({
                message: err instanceof Error ? err.message : 'Failed to refresh personal details',
                endpoint: err instanceof ApiError ? err.endpoint : requestEndpoint,
                status: err instanceof ApiError ? err.status : undefined
            });
        } finally {
            setRefreshingUserData(false);
        }
    };

    const handleRefreshSessionData = () => {
        if (!sessionDetails?.session.hasRefreshToken) {
            setError('No refresh token is available for this session. Sign in again to get a fresh session.');
            return;
        }

        if (!debuggerEnabled) {
            void runRefreshSessionData();
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
             if (debuggerEnabled) {
                 setShowRefreshCompleteDialog(true);
             }
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

    const isBlockedByLoginDebugger = !allowInitialDashboardLoad && (showStep3Dialog || showStep4Dialog);

    if (isBlockedByLoginDebugger) {
        return (
            <div className="dashboard-container">
                {showStep3Dialog && (
                    <FlowDebugDialog
                        step={3}
                        totalSteps={4}
                        title="Login Complete — Tokens Exchanged"
                        description="The BFF has successfully exchanged the authorization code for tokens at the authorization server's token endpoint. Your access token, ID token, and refresh token (if issued) are stored securely server-side. Only an HttpOnly session cookie was set in your browser — no tokens ever reached the client."
                        details={[
                            {label: 'Tokens stored', value: 'Server-side only (BFF)'},
                            {label: 'Browser receives', value: 'HttpOnly session cookie'},
                            {label: 'PKCE verifier', value: 'Consumed and discarded'},
                            {label: 'Next step', value: 'Dashboard requests personal details through the BFF'},
                            ...(customState ? [{label: 'App context payload (inside OAuth state)', value: customState}] : [])
                        ]}
                        onContinue={handleDismissStep3}
                    />
                )}
                {showStep4Dialog && (
                    <FlowDebugDialog
                        step={4}
                        totalSteps={4}
                        title="Calling the Personal Details API"
                        description="The dashboard is now ready to load your information. Clicking Continue will trigger a browser request to the BFF. The browser sends only your HttpOnly session cookie, and the BFF adds the access token before calling the protected personal-details API. If the token has expired, the BFF can refresh it server-side before forwarding the request."
                        details={[
                            {label: 'Browser request', value: `GET ${selectedProfileEndpointWithEmbeds}`},
                            {label: 'Browser sends', value: 'Session cookie only' },
                            {label: 'BFF adds', value: 'Bearer access token' },
                            {label: 'Protected API', value: '/profiles endpoint' },
                            {label: 'Token refresh', value: 'Handled server-side if needed' }
                        ]}
                        onContinue={handleDismissStep4}
                    />
                )}

                <div className="dashboard-card">
                    <p className="loading-text">Waiting for debugger step to continue...</p>
                </div>
            </div>
        );
    }

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
                    <div className="error-actions">
                        <button onClick={() => window.location.reload()} className="login-button secondary-button">
                            Try Again
                        </button>
                        <button onClick={() => logout()} className="login-button">
                            Logout and start over
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const getUserDataViewModel = () => {
        if (!userInfo) return null;

        const formatDisplayValue = (value: unknown) => {
            if (value === null || value === undefined || value === '') {
                return 'Not available';
            }

            return String(value);
        };

        const fullName = [userInfo.firstName, userInfo.middleName, userInfo.lastName]
            .map((value) => (typeof value === 'string' ? value.trim() : ''))
            .filter((value) => value.length > 0)
            .join(' ');

        const embeddedResourceCount = [
            userInfo._embedded?.account,
            userInfo._embedded?.organization,
            userInfo._embedded?.job,
            userInfo._embedded?.manager,
            userInfo._embedded?.photo
        ].filter(Boolean).length;

        const personalInfoRows: Array<{ label: string; value: unknown; className?: string }> = [
            {label: 'Name', value: fullName, className: 'info-item-wide'},
            {label: 'Profile ID', value: userInfo.profileId},
            {label: 'Email', value: userInfo.email},
            {label: 'Language', value: userInfo.language},
            {label: 'Locale', value: userInfo.locale},
            {label: 'Date format', value: userInfo.dateFormat},
            {label: 'Embedded resources', value: `${embeddedResourceCount}/5`}
        ];

        const embeddedRows: Array<[string, unknown]> = [
            ['Account status', userInfo._embedded?.account?.status],
            ['Organization', userInfo._embedded?.organization?.name],
            ['Job title', userInfo._embedded?.job?.title],
            ['Manager', userInfo._embedded?.manager?.displayName],
            ['Photo MIME type', userInfo._embedded?.photo?.mimeType]
        ];

        const links = userInfo._links || {};
        const linksRows: Array<[string, unknown]> = [
            ['Self', links.self?.href],
            ['Organization', links.organization?.href],
            ['Job', links.job?.href],
            ['Manager', links.manager?.href],
            ['Photo', links.photo?.href]
        ];

        return {
            personalInfoRows,
            embeddedRows,
            linksRows,
            formatDisplayValue
        };
    };

    const renderUserInfoGrid = () => {
        const model = getUserDataViewModel();
        if (!model) return null;

        return (
            <div className="user-info-grid">
                {model.personalInfoRows.map(({label, value, className}) => (
                    <div key={label} className={`info-item${className ? ` ${className}` : ''}`}>
                        <div className="info-label">{label}</div>
                        <div className="info-value">{model.formatDisplayValue(value)}</div>
                    </div>
                ))}
            </div>
        );
    };

    const renderUserRawDataSections = () => {
        const model = getUserDataViewModel();
        if (!model) return null;

        return (
            <>
                <details className="raw-data-section">
                    <summary className="raw-data-summary">
                        <h3 className="section-heading">Embedded Resources (if requested)</h3>
                        <span className="summary-badge">{model.embeddedRows.length} fields</span>
                    </summary>
                    <div className="kv-list">
                        {model.embeddedRows.map(([key, value]) => (
                            <div key={key} className="kv-row">
                                <span className="kv-key">{key}</span>
                                <span className="kv-value">{model.formatDisplayValue(value)}</span>
                            </div>
                        ))}
                    </div>
                </details>

                <details className="raw-data-section" open>
                    <summary className="raw-data-summary">
                        <h3 className="section-heading">HAL Links</h3>
                        <span className="summary-badge">{model.linksRows.length} links</span>
                    </summary>
                    <div className="kv-list">
                        {model.linksRows.map(([key, value]) => (
                            <div key={key} className="kv-row">
                                <span className="kv-key">{key}</span>
                                <span className="kv-value">{model.formatDisplayValue(value)}</span>
                            </div>
                        ))}
                    </div>
                </details>

                <details className="raw-data-section">
                    <summary className="raw-data-summary">
                        <h3 className="section-heading">Raw API Response</h3>
                        <span className="summary-badge">JSON</span>
                    </summary>
                    <pre className="json-display">{JSON.stringify(userInfo, null, 2)}</pre>
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
                    totalSteps={4}
                    title="Login Complete — Tokens Exchanged"
                    description="The BFF has successfully exchanged the authorization code for tokens at the authorization server's token endpoint. Your access token, ID token, and refresh token (if issued) are stored securely server-side. Only an HttpOnly session cookie was set in your browser — no tokens ever reached the client."
                    details={[
                        {label: 'Tokens stored', value: 'Server-side only (BFF)'},
                        {label: 'Browser receives', value: 'HttpOnly session cookie'},
                        {label: 'PKCE verifier', value: 'Consumed and discarded'},
                        {label: 'Next step', value: 'Dashboard requests personal details through the BFF'},
                        ...(customState ? [{label: 'Your custom state value', value: customState}] : [])
                    ]}
                    onContinue={handleDismissStep3}
                />
            )}
            {showStep4Dialog && (
                <FlowDebugDialog
                    step={4}
                    totalSteps={4}
                    title="Calling the Personal Details API"
                    description="The dashboard is now ready to load your information. Clicking Continue will trigger a browser request to the BFF. The browser sends only your HttpOnly session cookie, and the BFF adds the access token before calling the protected personal-details API. If the token has expired, the BFF can refresh it server-side before forwarding the request."
                    details={[
                        {label: 'Browser request', value: `GET ${selectedProfileEndpointWithEmbeds}`},
                        {label: 'Browser sends', value: 'Session cookie only' },
                        {label: 'BFF adds', value: 'Bearer access token' },
                        {label: 'Protected API', value: '/profiles endpoint' },
                        {label: 'Token refresh', value: 'Handled server-side if needed' }
                    ]}
                    onContinue={handleDismissStep4}
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
                        {label: 'Browser request', value: `GET ${selectedProfileEndpointWithEmbeds}`},
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
                        {photoUrl ? (
                            <img src={photoUrl} alt="Profile" className="card-avatar-image"/>
                        ) : (
                            <span className="card-icon">👤</span>
                        )}
                        Your Personal Information
                    </h2>
                    <div className="card-header-actions">
                        <button
                            onClick={toggleDebugMode}
                            className={`status-badge debug-mode-toggle ${debuggerEnabled ? 'debugger-on' : 'debugger-off'}`}
                            title={debuggerEnabled
                                ? "Debug Mode is ON: Refresh buttons show step-by-step explanation dialogs. Click to switch to Fast Mode."
                                : "Debug Mode is OFF: Refresh buttons execute instantly without dialogs. Click to switch to Debug Mode."}
                        >
                            {debuggerEnabled ? '🔍 Debug Mode: Enabled' : '⚡ Debug Mode: Disabled'}
                        </button>
                    </div>
                </div>

                <div className="card-content">
                    <div className="card-layout-grid">
                        <div className="user-data-container">
                            {userInfoError ? (
                                <div className="api-error-banner api-error-inline">
                                    <div className="api-error-icon">⚠️</div>
                                    <div className="api-error-body">
                                        <div className="api-error-title">
                                            Personal details API failed
                                            {userInfoError.status && (
                                                <span className="api-error-status">HTTP {userInfoError.status}</span>
                                            )}
                                        </div>
                                        <div className="api-error-endpoint">
                                            <code>GET {userInfoError.endpoint}</code>
                                        </div>
                                        <div className="api-error-message">{userInfoError.message}</div>
                                    </div>
                                </div>
                            ) : (
                                renderUserInfoGrid()
                            )}
                        </div>

                        <div className="data-controls-panel">
                            <div className="data-controls-section">
                                <h4 className="data-controls-title">Data Refresh</h4>
                                <button
                                    onClick={handleRefreshUserData}
                                    disabled={refreshingUserData}
                                    className="refresh-button"
                                    title="Request personal data from API: Browser sends session cookie, BFF attaches access token, calls protected API endpoint. BFF auto-refreshes token if expired."
                                >
                                    <span className={`refresh-icon ${refreshingUserData ? 'spinning' : ''}`}>🔄</span>
                                    Refresh Personal Data
                                </button>
                            </div>

                            <div className="data-controls-section">
                                <div className="embed-controls">
                                    <div className="embed-controls-heading">Embedded resources to request</div>
                                    <div className="embed-controls-options">
                                        {EMBED_OPTIONS.map((option) => (
                                            <label key={option.key} className="embed-option">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedEmbeds.includes(option.key)}
                                                    onChange={() => toggleEmbed(option.key)}
                                                />
                                                <span>{option.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                    <div className="embed-controls-meta">Next refresh request: <code>{selectedProfileEndpointWithEmbeds}</code></div>
                                    {hasPendingEmbedChanges && (
                                        <div className="embed-controls-pending">Pending changes - click Refresh Personal Data to apply</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {renderUserRawDataSections()}

                    {customState && (
                        <div className="custom-state-banner">
                            <div className="custom-state-icon">🔄</div>
                            <div className="custom-state-body">
                                <div className="custom-state-label">App context payload returned successfully</div>
                                <div className="custom-state-value">{customState}</div>
                                <div className="custom-state-hint">
                                    This is your app-specific context value. It was wrapped inside the OAuth
                                    <code>state</code> token (used for CSRF/correlation) and returned after
                                    successful authentication.
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="dashboard-card session-details-card">
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
                                    !sessionDetails?.session.hasRefreshToken
                                        ? 'No refresh token available for this session'
                                        : 'Exchange refresh token for new access token: Browser sends session cookie with refresh token, BFF calls authorization server to obtain fresh tokens, new tokens stored server-side.'
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
