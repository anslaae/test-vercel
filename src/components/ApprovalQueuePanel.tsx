import { useEffect, useState } from 'react';
import { getChangesAwaitingApproval, decideChange, ApiError, UnauthorizedError } from '../api/client';
import type { ChangeAwaitingApproval } from '../types/api';
import '../styles.css';

interface ApprovalQueuePanelProps {
  onViewProfile?: (profileId: string, displayName: string) => void;
}

export default function ApprovalQueuePanel({ onViewProfile }: ApprovalQueuePanelProps) {
  const [changes, setChanges] = useState<ChangeAwaitingApproval[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState('');
  const [decisionError, setDecisionError] = useState<string | null>(null);

  // silent=true skips the loading flag so a post-decision refresh updates the list in place
  // instead of flashing the whole panel back to a loading skeleton.
  const loadQueue = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setLoadError(null);
      const result = await getChangesAwaitingApproval();
      setChanges(result._embedded?.changes ?? []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load approval queue');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    void loadQueue();
  }, []);

  // decidingId gates ALL rows' buttons, not just the row being decided -- deciding two changes
  // concurrently would otherwise let a second decision fire while the first is still in flight.
  const decide = async (change: ChangeAwaitingApproval, decision: 'APPROVED' | 'REJECTED', comment?: string) => {
    try {
      setDecidingId(change.changeId);
      setDecisionError(null);
      await decideChange(change.changeId, decision, comment);
      setRejectingId(null);
      setRejectComment('');
      await loadQueue(true);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        setDecisionError(err.message);
        return;
      }
      const detail = err instanceof ApiError ? err.detail : undefined;
      setDecisionError(detail || (err instanceof Error ? err.message : 'Failed to record decision'));
    } finally {
      setDecidingId(null);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-card">
        <div className="card-header">
          <h2 className="card-title">
            <span className="card-icon">✅</span>
            Approval Queue
          </h2>
        </div>
        <p className="loading-text">Loading approval queue...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="dashboard-card">
        <div className="card-header">
          <h2 className="card-title">
            <span className="card-icon">✅</span>
            Approval Queue
          </h2>
        </div>
        <div className="api-error-banner api-error-inline">
          <div className="api-error-icon">⚠️</div>
          <div className="api-error-body">
            <div className="api-error-title">Failed to load approval queue</div>
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
          <span className="card-icon">✅</span>
          Approval Queue
        </h2>
        <span className="summary-badge">GET /profiles/changes/awaiting-approval</span>
      </div>

      {(changes ?? []).length === 0 ? (
        <p className="loading-text">Nothing is waiting on your approval.</p>
      ) : (
        <div className="field-list">
          {(changes ?? []).map((change) => {
            const isRejecting = rejectingId === change.changeId;
            const isDeciding = decidingId === change.changeId;
            const anyDecisionInFlight = decidingId !== null;

            return (
              <div
                key={change.changeId}
                className={`field-list-row${isRejecting ? ' field-list-row-editing' : ''}`}
              >
                <div className="field-list-main">
                  <span className="field-list-label">
                    {onViewProfile ? (
                      <button
                        type="button"
                        className="field-list-person-link"
                        onClick={() => onViewProfile(change.profileId, change.personName)}
                      >
                        {change.personName}
                      </button>
                    ) : (
                      change.personName
                    )}{' '}
                    · {change.label ?? change.key}
                  </span>
                  <span className="field-list-value">
                    {change.displayValue ?? change.value ?? 'Not set'}
                    {change.requestedOn && ` · requested ${change.requestedOn}`}
                  </span>
                </div>

                {isRejecting ? (
                  <div className="field-edit-inline">
                    <input
                      className="login-option-input"
                      placeholder="Reason (optional)"
                      value={rejectComment}
                      onChange={(event) => setRejectComment(event.target.value)}
                      autoFocus
                    />
                    <button
                      type="button"
                      className="field-list-withdraw-btn"
                      onClick={() => void decide(change, 'REJECTED', rejectComment || undefined)}
                      disabled={anyDecisionInFlight}
                    >
                      {isDeciding ? 'Rejecting...' : 'Confirm Reject'}
                    </button>
                    <button
                      type="button"
                      className="secondary-button field-list-cancel"
                      onClick={() => {
                        setRejectingId(null);
                        setRejectComment('');
                      }}
                      disabled={anyDecisionInFlight}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="field-list-actions">
                    <button
                      type="button"
                      className="field-list-edit-btn"
                      onClick={() => void decide(change, 'APPROVED')}
                      disabled={anyDecisionInFlight}
                    >
                      {isDeciding ? 'Approving...' : 'Approve'}
                    </button>
                    <button
                      type="button"
                      className="field-list-withdraw-btn"
                      onClick={() => {
                        setRejectingId(change.changeId);
                        setRejectComment('');
                      }}
                      disabled={anyDecisionInFlight}
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {decisionError && (
        <div className="api-error-banner api-error-inline field-list-error">
          <div className="api-error-icon">⚠️</div>
          <div className="api-error-body">
            <div className="api-error-title">Decision failed</div>
            <div className="api-error-message">{decisionError}</div>
          </div>
        </div>
      )}
    </div>
  );
}
