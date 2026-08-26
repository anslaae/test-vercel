import { useEffect, useState } from 'react';
import { getMyEmployees, getProfileById, ApiError, UnauthorizedError } from '../api/client';
import type { Employee, ProfileResponse } from '../types/api';
import '../styles.css';

export default function DirectReportsPanel() {
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Record<string, ProfileResponse>>({});
  const [profileLoadingId, setProfileLoadingId] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadEmployees() {
      try {
        setLoading(true);
        setLoadError(null);
        const result = await getMyEmployees();
        if (!active) return;
        setEmployees(result._embedded?.people ?? []);
      } catch (err) {
        if (!active) return;
        setLoadError(err instanceof Error ? err.message : 'Failed to load direct reports');
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadEmployees();
    return () => {
      active = false;
    };
  }, []);

  const toggleExpand = async (employee: Employee) => {
    if (expandedId === employee.profileId) {
      setExpandedId(null);
      return;
    }

    setExpandedId(employee.profileId);
    setProfileError(null);

    if (profiles[employee.profileId]) {
      return;
    }

    try {
      setProfileLoadingId(employee.profileId);
      const profile = await getProfileById(employee.profileId, ['organization', 'job', 'manager']);
      setProfiles((current) => ({ ...current, [employee.profileId]: profile }));
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        setProfileError(err.message);
        return;
      }
      const detail = err instanceof ApiError ? err.detail : undefined;
      setProfileError(detail || (err instanceof Error ? err.message : 'Failed to load profile'));
    } finally {
      setProfileLoadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-card">
        <div className="card-header">
          <h2 className="card-title">
            <span className="card-icon">👥</span>
            Direct Reports
          </h2>
        </div>
        <p className="loading-text">Loading direct reports...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="dashboard-card">
        <div className="card-header">
          <h2 className="card-title">
            <span className="card-icon">👥</span>
            Direct Reports
          </h2>
        </div>
        <div className="api-error-banner api-error-inline">
          <div className="api-error-icon">⚠️</div>
          <div className="api-error-body">
            <div className="api-error-title">Failed to load direct reports</div>
            <div className="api-error-message">{loadError}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-card">
      <div className="card-header">
        <h2 className="card-title">
          <span className="card-icon">👥</span>
          Direct Reports
        </h2>
        <span className="summary-badge">GET /profiles/employees</span>
      </div>

      {(employees ?? []).length === 0 ? (
        <p className="loading-text">You have no direct reports.</p>
      ) : (
        <div className="field-list">
          {(employees ?? []).map((employee) => {
            const isExpanded = expandedId === employee.profileId;
            const profile = profiles[employee.profileId];

            return (
              <div
                key={employee.profileId}
                className={`field-list-row${isExpanded ? ' field-list-row-editing' : ''}`}
              >
                <div className="field-list-main">
                  <span className="field-list-label">{employee.displayName}</span>
                  {isExpanded &&
                    (profileLoadingId === employee.profileId ? (
                      <span className="field-list-value">Loading profile...</span>
                    ) : profileError ? (
                      <span className="field-edit-error">{profileError}</span>
                    ) : profile ? (
                      <span className="field-list-value">
                        {profile.email ?? 'No email'}
                        {profile._embedded?.organization?.name && ` · ${profile._embedded.organization.name}`}
                        {profile._embedded?.job?.title && ` · ${profile._embedded.job.title}`}
                        {profile._embedded?.manager?.displayName &&
                          ` · reports to ${profile._embedded.manager.displayName}`}
                      </span>
                    ) : null)}
                </div>
                <div className="field-list-actions">
                  <button type="button" className="field-list-edit-btn" onClick={() => void toggleExpand(employee)}>
                    {isExpanded ? 'Hide' : 'View Profile'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
