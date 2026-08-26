import { useEffect, useState } from 'react';
import { getProfileById, getProfilePhotoContent, ApiError, UnauthorizedError } from '../api/client';
import type { ProfileResponse } from '../types/api';
import ProfileEditPanel from './ProfileEditPanel';
import OutstandingChangesPanel from './OutstandingChangesPanel';
import FieldHistoryPanel from './FieldHistoryPanel';
import Tabs from './Tabs';
import '../styles.css';

interface PersonDetailModalProps {
  profileId: string;
  onClose: () => void;
}

export default function PersonDetailModal({ profileId, onClose }: PersonDetailModalProps) {
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const result = await getProfileById(profileId, ['organization', 'job', 'manager']);
      setProfile(result);

      try {
        const photoBlob = await getProfilePhotoContent(profileId);
        setPhotoUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return photoBlob ? URL.createObjectURL(photoBlob) : null;
        });
      } catch {
        // Photo is non-blocking -- the rest of the profile is still worth showing.
      }
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        setLoadError(err.message);
        return;
      }
      const detail = err instanceof ApiError ? err.detail : undefined;
      setLoadError(detail || (err instanceof Error ? err.message : 'Failed to load profile'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProfile();
  }, [profileId]);

  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    globalThis.addEventListener('keydown', onKeyDown);
    return () => globalThis.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const fullName = profile
    ? [profile.firstName, profile.middleName, profile.lastName].filter((part) => !!part).join(' ')
    : '';

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      icon: '👤',
      content: (
        <div className="dashboard-card">
          <div className="card-header">
            <h2 className="card-title">
              <span className="card-icon">👤</span>
              Overview
            </h2>
          </div>
          <div className="user-info-grid">
            <div className="info-item info-item-wide">
              <div className="info-label">Name</div>
              <div className="info-value">{fullName || 'Not available'}</div>
            </div>
            <div className="info-item">
              <div className="info-label">Email</div>
              <div className="info-value">{profile?.email ?? 'Not available'}</div>
            </div>
            <div className="info-item">
              <div className="info-label">Organization</div>
              <div className="info-value">{profile?._embedded?.organization?.name ?? 'Not available'}</div>
            </div>
            <div className="info-item">
              <div className="info-label">Job Title</div>
              <div className="info-value">{profile?._embedded?.job?.title ?? 'Not available'}</div>
            </div>
            <div className="info-item">
              <div className="info-label">Manager</div>
              <div className="info-value">{profile?._embedded?.manager?.displayName ?? 'Not available'}</div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'edit',
      label: 'Edit Profile',
      icon: '✏️',
      content: (
        <ProfileEditPanel
          profileId={profileId}
          onProfileUpdated={() => {
            void loadProfile();
            setRefreshKey((current) => current + 1);
          }}
        />
      )
    },
    {
      id: 'changes',
      label: 'Changes & History',
      icon: '⏳',
      content: (
        <>
          <OutstandingChangesPanel profileId={profileId} refreshSignal={refreshKey} />
          <FieldHistoryPanel profileId={profileId} refreshSignal={refreshKey} />
        </>
      )
    }
  ];

  return (
    <div className="person-detail-overlay" onClick={onClose}>
      <div
        className="person-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="person-detail-name"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="person-detail-header">
          {photoUrl ? (
            <img src={photoUrl} alt={fullName} className="card-avatar-image person-detail-avatar" />
          ) : (
            <span className="card-icon">👤</span>
          )}
          <div className="person-detail-heading">
            <h2 id="person-detail-name" className="person-detail-name">
              {loading ? 'Loading...' : fullName || 'Person'}
            </h2>
            {profile?.email && <div className="person-detail-email">{profile.email}</div>}
          </div>
          <button type="button" className="app-info-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {loadError ? (
          <div className="api-error-banner api-error-inline">
            <div className="api-error-icon">⚠️</div>
            <div className="api-error-body">
              <div className="api-error-title">Failed to load profile</div>
              <div className="api-error-message">{loadError}</div>
            </div>
          </div>
        ) : loading ? (
          <p className="loading-text">Loading profile...</p>
        ) : (
          <Tabs tabs={tabs} />
        )}
      </div>
    </div>
  );
}
