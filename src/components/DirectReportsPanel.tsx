import { useEffect, useState } from 'react';
import { getMyEmployees } from '../api/client';
import type { Employee } from '../types/api';
import '../styles.css';

interface DirectReportsPanelProps {
  onViewProfile: (profileId: string, displayName: string) => void;
}

export default function DirectReportsPanel({ onViewProfile }: DirectReportsPanelProps) {
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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
          {(employees ?? []).map((employee) => (
            <div key={employee.profileId} className="field-list-row">
              <div className="field-list-main">
                <span className="field-list-label">{employee.displayName}</span>
              </div>
              <div className="field-list-actions">
                <button
                  type="button"
                  className="field-list-edit-btn"
                  onClick={() => onViewProfile(employee.profileId, employee.displayName)}
                >
                  View Profile
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
