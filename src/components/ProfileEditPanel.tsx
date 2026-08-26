import { useEffect, useMemo, useState } from 'react';
import { getEditableFields, getFieldValues, updateMyProfile, ApiError, UnauthorizedError } from '../api/client';
import type { FieldDescriptor, FieldValue, FieldChange, FieldStatus, ProfileUpdateResult } from '../types/api';
import '../styles.css';

// First pass: single-valued fields with a plain-string wire format. MULTI_SELECT, PERSON,
// MULTI_PERSON, ORGANIZATION, POSITION, MONEY and TEXT_MAP need their own lookup/entry UI
// and are shown read-only for now.
const EDITABLE_TYPES = new Set<FieldDescriptor['type']>(['TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'SINGLE_SELECT']);

const STATUS_LABEL: Record<FieldStatus, string> = {
  APPLIED: 'Applied',
  PENDING_APPROVAL: 'Pending approval',
  SCHEDULED: 'Scheduled'
};

const STATUS_CLASS: Record<FieldStatus, string> = {
  APPLIED: 'outcome-badge-applied',
  PENDING_APPROVAL: 'outcome-badge-pending',
  SCHEDULED: 'outcome-badge-scheduled'
};

function inputTypeFor(type: FieldDescriptor['type']) {
  if (type === 'DATE') return 'date';
  if (type === 'NUMBER') return 'number';
  return 'text';
}

interface ProfileEditPanelProps {
  onProfileUpdated?: () => void;
}

export default function ProfileEditPanel({ onProfileUpdated }: ProfileEditPanelProps) {
  const [fields, setFields] = useState<FieldDescriptor[] | null>(null);
  const [values, setValues] = useState<Record<string, FieldValue>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<ProfileUpdateResult | null>(null);

  const loadCatalog = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const [catalog, fieldValues] = await Promise.all([getEditableFields(), getFieldValues()]);
      const catalogFields = catalog._embedded?.fields ?? [];
      const valuesByKey: Record<string, FieldValue> = {};
      for (const value of fieldValues._embedded?.values ?? []) {
        valuesByKey[value.key] = value;
      }

      setFields(catalogFields);
      setValues(valuesByKey);
      setDrafts(
        Object.fromEntries(
          catalogFields
            .filter((field) => EDITABLE_TYPES.has(field.type))
            .map((field) => [field.key, valuesByKey[field.key]?.value ?? ''])
        )
      );
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load editable fields');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCatalog();
  }, []);

  const setDraft = (key: string, value: string) => {
    setDrafts((current) => ({ ...current, [key]: value }));
    setResult(null);
  };

  const dirtyKeys = useMemo(() => {
    if (!fields) return [];
    return fields
      .filter((field) => EDITABLE_TYPES.has(field.type) && field.editable)
      .filter((field) => (drafts[field.key] ?? '') !== (values[field.key]?.value ?? ''))
      .map((field) => field.key);
  }, [fields, drafts, values]);

  const resetDrafts = () => {
    setDrafts(Object.fromEntries(Object.keys(drafts).map((key) => [key, values[key]?.value ?? ''])));
    setResult(null);
    setSubmitError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (dirtyKeys.length === 0 || submitting) return;

    const changes: FieldChange[] = dirtyKeys.map((key) => ({ key, value: drafts[key] }));

    try {
      setSubmitting(true);
      setSubmitError(null);
      const updateResult = await updateMyProfile(changes);
      setResult(updateResult);
      await loadCatalog();
      onProfileUpdated?.();
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        setSubmitError(err.message);
        return;
      }
      const detail = err instanceof ApiError ? err.detail : undefined;
      setSubmitError(detail || (err instanceof Error ? err.message : 'Failed to update profile'));
    } finally {
      setSubmitting(false);
    }
  };

  const labelFor = (key: string) => fields?.find((field) => field.key === key)?.label ?? key;

  if (loading) {
    return (
      <div className="dashboard-card">
        <div className="card-header">
          <h2 className="card-title">
            <span className="card-icon">✏️</span>
            Edit Your Profile
          </h2>
        </div>
        <p className="loading-text">Loading editable fields...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="dashboard-card">
        <div className="card-header">
          <h2 className="card-title">
            <span className="card-icon">✏️</span>
            Edit Your Profile
          </h2>
        </div>
        <div className="api-error-banner api-error-inline">
          <div className="api-error-icon">⚠️</div>
          <div className="api-error-body">
            <div className="api-error-title">Failed to load editable fields</div>
            <div className="api-error-message">{loadError}</div>
          </div>
        </div>
      </div>
    );
  }

  const editableFields = (fields ?? []).filter((field) => EDITABLE_TYPES.has(field.type));
  const readOnlyFields = (fields ?? []).filter((field) => !EDITABLE_TYPES.has(field.type));

  return (
    <div className="dashboard-card">
      <div className="card-header">
        <h2 className="card-title">
          <span className="card-icon">✏️</span>
          Edit Your Profile
        </h2>
        <span className="summary-badge">GET /profiles/fields · PATCH /profiles</span>
      </div>

      {editableFields.length === 0 && readOnlyFields.length === 0 && (
        <p className="loading-text">You have no editable fields on this profile.</p>
      )}

      {editableFields.length > 0 && (
        <form className="profile-edit-form" onSubmit={handleSubmit}>
          {editableFields.map((field) => {
            const isDirty = dirtyKeys.includes(field.key);
            const outcome = result?.fields.find((entry) => entry.key === field.key);

            return (
              <div key={field.key} className={`field-row${isDirty ? ' field-row-dirty' : ''}`}>
                <label className="field-label" htmlFor={`field-${field.key}`}>
                  {field.label}
                  {field.mandatory && <span className="field-mandatory"> *</span>}
                  {field.needsApproval && <span className="field-approval-hint"> (needs approval)</span>}
                </label>
                {field.description && <div className="field-description">{field.description}</div>}

                {!field.editable ? (
                  <div className="field-readonly">
                    {values[field.key]?.displayValue ?? values[field.key]?.value ?? 'Not set'}
                    {field.blockedReason && <div className="field-blocked-reason">{field.blockedReason}</div>}
                  </div>
                ) : field.type === 'BOOLEAN' ? (
                  <select
                    id={`field-${field.key}`}
                    className="login-option-input"
                    value={drafts[field.key] ?? ''}
                    onChange={(event) => setDraft(field.key, event.target.value)}
                  >
                    <option value="">Not set</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                ) : field.type === 'SINGLE_SELECT' ? (
                  <select
                    id={`field-${field.key}`}
                    className="login-option-input"
                    value={drafts[field.key] ?? ''}
                    onChange={(event) => setDraft(field.key, event.target.value)}
                  >
                    <option value="">Not set</option>
                    {field.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={`field-${field.key}`}
                    className="login-option-input"
                    type={inputTypeFor(field.type)}
                    value={drafts[field.key] ?? ''}
                    onChange={(event) => setDraft(field.key, event.target.value)}
                  />
                )}

                {outcome && (
                  <span className={`outcome-badge ${STATUS_CLASS[outcome.status]}`}>
                    {STATUS_LABEL[outcome.status]}
                    {outcome.effectiveFrom && ` · effective ${outcome.effectiveFrom}`}
                  </span>
                )}
              </div>
            );
          })}

          <div className="profile-edit-actions">
            <button
              type="submit"
              className="refresh-button"
              disabled={dirtyKeys.length === 0 || submitting}
            >
              {submitting ? 'Saving...' : `Save changes${dirtyKeys.length > 0 ? ` (${dirtyKeys.length})` : ''}`}
            </button>
            <button
              type="button"
              className="secondary-button profile-edit-reset"
              onClick={resetDrafts}
              disabled={dirtyKeys.length === 0 || submitting}
            >
              Discard changes
            </button>
          </div>

          {submitError && (
            <div className="api-error-banner api-error-inline">
              <div className="api-error-icon">⚠️</div>
              <div className="api-error-body">
                <div className="api-error-title">Update failed</div>
                <div className="api-error-message">{submitError}</div>
              </div>
            </div>
          )}

          {result && (
            <div className={`profile-edit-outcome outcome-banner-${STATUS_CLASS[result.outcome]}`}>
              Overall outcome: <strong>{STATUS_LABEL[result.outcome]}</strong>
              {result.fields.length > 0 && (
                <ul className="profile-edit-outcome-list">
                  {result.fields.map((entry) => (
                    <li key={entry.key}>
                      {labelFor(entry.key)}: {STATUS_LABEL[entry.status]}
                      {entry.changeId && ` (${entry.changeId})`}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </form>
      )}

      {readOnlyFields.length > 0 && (
        <details className="raw-data-section">
          <summary className="raw-data-summary">
            <h3 className="section-heading">Other editable fields (not yet supported in this demo)</h3>
            <span className="summary-badge">{readOnlyFields.length} fields</span>
          </summary>
          <div className="kv-list">
            {readOnlyFields.map((field) => (
              <div key={field.key} className="kv-row">
                <span className="kv-key">
                  {field.label} <span className="field-type-tag">{field.type}</span>
                </span>
                <span className="kv-value">
                  {values[field.key]?.displayValue ?? values[field.key]?.value ?? 'Not set'}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
