import { useEffect, useMemo, useState } from 'react';
import { getMyFieldHistory } from '../api/client';
import type { FieldHistoryEntry } from '../types/api';
import '../styles.css';

interface FieldHistoryPanelProps {
  refreshSignal?: number;
}

export default function FieldHistoryPanel({ refreshSignal }: FieldHistoryPanelProps) {
  const [history, setHistory] = useState<FieldHistoryEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let active = true;

    async function loadHistory() {
      try {
        setLoading(true);
        setLoadError(null);
        const result = await getMyFieldHistory();
        if (!active) return;
        setHistory(result._embedded?.history ?? []);
      } catch (err) {
        if (!active) return;
        setLoadError(err instanceof Error ? err.message : 'Failed to load field history');
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadHistory();
    return () => {
      active = false;
    };
  }, [refreshSignal]);

  const filteredHistory = useMemo(() => {
    if (!history) return [];
    const term = search.trim().toLowerCase();
    if (!term) return history;
    return history.filter(
      (entry) => (entry.label ?? entry.key).toLowerCase().includes(term) || entry.key.toLowerCase().includes(term)
    );
  }, [history, search]);

  if (loading) {
    return (
      <div className="dashboard-card">
        <div className="card-header">
          <h2 className="card-title">
            <span className="card-icon">📜</span>
            Field History
          </h2>
        </div>
        <p className="loading-text">Loading field history...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="dashboard-card">
        <div className="card-header">
          <h2 className="card-title">
            <span className="card-icon">📜</span>
            Field History
          </h2>
        </div>
        <div className="api-error-banner api-error-inline">
          <div className="api-error-icon">⚠️</div>
          <div className="api-error-body">
            <div className="api-error-title">Failed to load field history</div>
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
          <span className="card-icon">📜</span>
          Field History
        </h2>
        <span className="summary-badge">GET /profiles/history</span>
      </div>

      {(history ?? []).length === 0 ? (
        <p className="loading-text">No recorded changes yet — fields you edit will show up here.</p>
      ) : (
        <>
          <input
            type="search"
            className="login-option-input field-search-input"
            placeholder="Search history by field name..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search field history"
          />
          <div className="field-list-count">
            Showing {filteredHistory.length} of {history?.length ?? 0} recorded changes, newest first.
          </div>

          <div className="field-list">
            {filteredHistory.map((entry, index) => {
              const fromValue = entry.previousDisplayValue ?? entry.previousValue;
              const toValue = entry.displayValue ?? entry.value ?? 'Not set';

              return (
                <div key={`${entry.key}-${entry.changedOn ?? index}`} className="field-list-row">
                  <div className="field-list-main">
                    <span className="field-list-label">{entry.label ?? entry.key}</span>
                    <span className="field-list-value">
                      {fromValue ? `${fromValue} → ${toValue}` : toValue}
                    </span>
                    <span className="field-history-meta">
                      {entry.changedOn && `Changed ${entry.changedOn}`}
                      {entry.changedBy?.name && ` by ${entry.changedBy.name}`}
                      {entry.imported && ' (imported)'}
                      {entry.approvedBy?.name && ` · approved by ${entry.approvedBy.name}`}
                      {entry.reason && ` · "${entry.reason}"`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
