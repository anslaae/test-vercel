import { useEffect, useMemo, useState } from 'react';
import { getFieldHistory } from '../api/client';
import type { FieldHistoryEntry } from '../types/api';
import '../styles.css';

// The history list can run long on a long-serving employee -- keep only the most recent
// entries visible by default. Search or "Show all" reveals the rest.
const PREVIEW_COUNT = 6;

interface FieldHistoryPanelProps {
  profileId?: string;
  refreshSignal?: number;
}

export default function FieldHistoryPanel({ profileId, refreshSignal }: FieldHistoryPanelProps) {
  const [history, setHistory] = useState<FieldHistoryEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadHistory() {
      try {
        setLoading(true);
        setLoadError(null);
        const result = await getFieldHistory(profileId);
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
  }, [profileId, refreshSignal]);

  const isSearching = search.trim().length > 0;

  const filteredHistory = useMemo(() => {
    if (!history) return [];
    const term = search.trim().toLowerCase();
    if (!term) return history;
    return history.filter(
      (entry) => (entry.label ?? entry.key).toLowerCase().includes(term) || entry.key.toLowerCase().includes(term)
    );
  }, [history, search]);

  const visibleHistory = isSearching || expanded ? filteredHistory : filteredHistory.slice(0, PREVIEW_COUNT);
  const hasMoreToShow = !isSearching && !expanded && filteredHistory.length > PREVIEW_COUNT;

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
        <p className="loading-text">
          {profileId
            ? 'No recorded changes visible to you for this person.'
            : 'No recorded changes yet — fields you edit will show up here.'}
        </p>
      ) : (
        <>
          <div className="field-list-overview">{history?.length ?? 0} recorded changes, newest first.</div>

          <input
            type="search"
            className="login-option-input field-search-input"
            placeholder="Search history by field name..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setExpanded(false);
            }}
            aria-label="Search field history"
          />
          <div className="field-list-count">
            {isSearching
              ? `${filteredHistory.length} match${filteredHistory.length === 1 ? '' : 'es'} for "${search.trim()}"`
              : `Showing ${visibleHistory.length} of ${filteredHistory.length} changes`}
          </div>

          <div className="field-list">
            {visibleHistory.map((entry, index) => {
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

          {hasMoreToShow && (
            <button type="button" className="field-list-show-more" onClick={() => setExpanded(true)}>
              Show all {filteredHistory.length} changes
            </button>
          )}
          {expanded && !isSearching && (
            <button type="button" className="field-list-show-more" onClick={() => setExpanded(false)}>
              Show fewer changes
            </button>
          )}
        </>
      )}
    </div>
  );
}
