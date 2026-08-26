import { useEffect, useState } from 'react';
import { getChanges, cancelChange, ApiError, UnauthorizedError } from '../api/client';
import type { PendingChange, ChangeKind } from '../types/api';
import '../styles.css';

const KIND_LABEL: Record<ChangeKind, string> = {
  PENDING_APPROVAL: 'Pending approval',
  SCHEDULED: 'Scheduled'
};

const KIND_CLASS: Record<ChangeKind, string> = {
  PENDING_APPROVAL: 'outcome-badge-pending',
  SCHEDULED: 'outcome-badge-scheduled'
};

interface OutstandingChangesPanelProps {
  profileId?: string;
  refreshSignal?: number;
}

export default function OutstandingChangesPanel({ profileId, refreshSignal }: OutstandingChangesPanelProps) {
  const [changes, setChanges] = useState<PendingChange[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);

  // silent=true skips the loading flag so a post-withdraw refresh updates the list in place
  // instead of flashing the whole panel back to a loading skeleton. isActive lets a caller in
  // an effect ignore a stale response if a newer request has since superseded it.
  const loadChanges = async (silent = false, isActive: () => boolean = () => true) => {
    try {
      if (!silent) setLoading(true);
      setLoadError(null);
      const collection = await getChanges(profileId);
      if (!isActive()) return;
      setChanges(collection._embedded?.changes ?? []);
    } catch (err) {
      if (!isActive()) return;
      setLoadError(err instanceof Error ? err.message : 'Failed to load outstanding changes');
    } finally {
      if (isActive() && !silent) setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    void loadChanges(false, () => active);
    return () => {
      active = false;
    };
  }, [profileId, refreshSignal]);

  // withdrawingId gates ALL rows' buttons, not just the row being withdrawn -- withdrawing two
  // changes concurrently would otherwise let a second withdraw fire while the first is in flight.
  const withdraw = async (change: PendingChange) => {
    try {
      setWithdrawingId(change.id);
      setWithdrawError(null);
      await cancelChange(change.id, profileId);
      await loadChanges(true);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        setWithdrawError(err.message);
        return;
      }
      const detail = err instanceof ApiError ? err.detail : undefined;
      setWithdrawError(detail || (err instanceof Error ? err.message : 'Failed to withdraw change'));
    } finally {
      setWithdrawingId(null);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-card">
        <div className="card-header">
          <h2 className="card-title">
            <span className="card-icon">⏳</span>
            Outstanding Changes
          </h2>
        </div>
        <p className="loading-text">Loading outstanding changes...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="dashboard-card">
        <div className="card-header">
          <h2 className="card-title">
            <span className="card-icon">⏳</span>
            Outstanding Changes
          </h2>
        </div>
        <div className="api-error-banner api-error-inline">
          <div className="api-error-icon">⚠️</div>
          <div className="api-error-body">
            <div className="api-error-title">Failed to load outstanding changes</div>
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
          <span className="card-icon">⏳</span>
          Outstanding Changes
        </h2>
        <span className="summary-badge">GET /profiles/changes</span>
      </div>

      {(changes ?? []).length === 0 ? (
        <p className="loading-text">
          {profileId ? 'This person has no outstanding changes.' : 'You have no outstanding changes.'}
        </p>
      ) : (
        <div className="field-list">
          {(changes ?? []).map((change) => (
            <div key={change.id} className="field-list-row">
              <div className="field-list-main">
                <span className="field-list-label">{change.label ?? change.key}</span>
                <span className="field-list-value">
                  {change.displayValue ?? change.value ?? 'Not set'}
                  {change.kind === 'SCHEDULED' && change.effectiveFrom && ` · effective ${change.effectiveFrom}`}
                  {change.kind === 'PENDING_APPROVAL' && change.requestedOn && ` · requested ${change.requestedOn}`}
                </span>
              </div>
              <div className="field-list-actions">
                <span className={`outcome-badge ${KIND_CLASS[change.kind]}`}>{KIND_LABEL[change.kind]}</span>
                <button
                  type="button"
                  className="field-list-withdraw-btn"
                  onClick={() => void withdraw(change)}
                  disabled={withdrawingId !== null}
                >
                  {withdrawingId === change.id ? 'Withdrawing...' : 'Withdraw'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {withdrawError && (
        <div className="api-error-banner api-error-inline field-list-error">
          <div className="api-error-icon">⚠️</div>
          <div className="api-error-body">
            <div className="api-error-title">Withdraw failed</div>
            <div className="api-error-message">{withdrawError}</div>
          </div>
        </div>
      )}
    </div>
  );
}
