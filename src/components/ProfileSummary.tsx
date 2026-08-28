import type { ProfileResponse } from '../types/api';
import '../styles.css';

interface ProfileSummaryProps {
  profile: ProfileResponse | null;
  photoUrl?: string | null;
  // Hide the avatar/name/email block when a caller already shows it elsewhere (e.g. a modal's
  // persistent header) -- only the organization/job/manager facts are shown then.
  showHeader?: boolean;
}

export default function ProfileSummary({ profile, photoUrl, showHeader = true }: ProfileSummaryProps) {
  const fullName = profile
    ? [profile.firstName, profile.middleName, profile.lastName]
        .map((part) => (typeof part === 'string' ? part.trim() : ''))
        .filter((part) => part.length > 0)
        .join(' ')
    : '';

  const facts: Array<{ icon: string; label: string; value: string }> = [];
  if (profile?._embedded?.organization?.name) {
    facts.push({ icon: '🏢', label: 'Organization', value: profile._embedded.organization.name });
  }
  if (profile?._embedded?.job?.title) {
    facts.push({ icon: '💼', label: 'Job title', value: profile._embedded.job.title });
  }
  if (profile?._embedded?.manager?.displayName) {
    facts.push({ icon: '👤', label: 'Manager', value: profile._embedded.manager.displayName });
  }

  return (
    <div className="profile-summary">
      {showHeader && (
        <div className="profile-summary-header">
          {photoUrl ? (
            <img src={photoUrl} alt={fullName} className="profile-summary-avatar" />
          ) : (
            <div className="profile-summary-avatar profile-summary-avatar-placeholder">👤</div>
          )}
          <div className="profile-summary-heading">
            <div className="profile-summary-name">{fullName || 'Not available'}</div>
            {profile?.email && <div className="profile-summary-email">{profile.email}</div>}
          </div>
        </div>
      )}

      {facts.length > 0 ? (
        <div className="profile-facts">
          {facts.map((fact) => (
            <span key={fact.label} className="profile-fact" title={fact.label}>
              <span className="profile-fact-icon">{fact.icon}</span>
              {fact.value}
            </span>
          ))}
        </div>
      ) : (
        !showHeader && <p className="loading-text">No additional details visible for this person.</p>
      )}
    </div>
  );
}
