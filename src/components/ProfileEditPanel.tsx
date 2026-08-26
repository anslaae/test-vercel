import { useMemo, useState, useEffect } from 'react';
import { getEditableFields, getFieldValues, updateMyProfile, ApiError, UnauthorizedError } from '../api/client';
import type { FieldDescriptor, FieldValue, FieldStatus, FieldOutcome } from '../types/api';
import '../styles.css';

// First pass: single-valued fields with a plain-string wire format. MULTI_SELECT, PERSON,
// MULTI_PERSON, ORGANIZATION, POSITION, MONEY and TEXT_MAP need their own lookup/entry UI
// and are listed read-only for now.
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

function canEditInline(field: FieldDescriptor) {
  return EDITABLE_TYPES.has(field.type) && field.editable;
}

// Keep the default view short -- the full catalog can run into dozens of fields. Search or
// "Show all" reveals the rest.
const PREVIEW_COUNT = 6;

interface ProfileEditPanelProps {
  onProfileUpdated?: () => void;
}

export default function ProfileEditPanel({ onProfileUpdated }: ProfileEditPanelProps) {
  const [fields, setFields] = useState<FieldDescriptor[] | null>(null);
  const [values, setValues] = useState<Record<string, FieldValue>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [lastOutcomes, setLastOutcomes] = useState<Record<string, FieldOutcome>>({});

  const loadCatalog = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const [catalog, fieldValues] = await Promise.all([getEditableFields(), getFieldValues()]);
      const valuesByKey: Record<string, FieldValue> = {};
      for (const value of fieldValues._embedded?.values ?? []) {
        valuesByKey[value.key] = value;
      }

      setFields(catalog._embedded?.fields ?? []);
      setValues(valuesByKey);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load editable fields');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCatalog();
  }, []);

  const isSearching = search.trim().length > 0;

  const filteredFields = useMemo(() => {
    if (!fields) return [];
    const term = search.trim().toLowerCase();
    if (!term) return fields;
    return fields.filter(
      (field) => field.label.toLowerCase().includes(term) || field.key.toLowerCase().includes(term)
    );
  }, [fields, search]);

  const visibleFields = isSearching || expanded ? filteredFields : filteredFields.slice(0, PREVIEW_COUNT);
  const hasMoreToShow = !isSearching && !expanded && filteredFields.length > PREVIEW_COUNT;
  const editableCount = (fields ?? []).filter(canEditInline).length;

  const startEdit = (field: FieldDescriptor) => {
    setEditingKey(field.key);
    setDraftValue(values[field.key]?.value ?? '');
    setSubmitError(null);
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setSubmitError(null);
  };

  const saveField = async (field: FieldDescriptor) => {
    const baseline = values[field.key]?.value ?? '';
    if (draftValue === baseline || submitting) {
      setEditingKey(null);
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError(null);
      const updateResult = await updateMyProfile([{ key: field.key, value: draftValue }]);
      const outcome = updateResult.fields.find((entry) => entry.key === field.key);
      if (outcome) {
        setLastOutcomes((current) => ({ ...current, [field.key]: outcome }));
      }
      await loadCatalog();
      setEditingKey(null);
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

  return (
    <div className="dashboard-card">
      <div className="card-header">
        <h2 className="card-title">
          <span className="card-icon">✏️</span>
          Edit Your Profile
        </h2>
        <span className="summary-badge">GET /profiles/fields · PATCH /profiles</span>
      </div>

      {(fields ?? []).length === 0 ? (
        <p className="loading-text">You have no editable fields on this profile.</p>
      ) : (
        <>
          <div className="field-list-overview">
            {fields?.length ?? 0} fields total · {editableCount} editable now. Each change is saved on its own —
            click Edit, change the value, then Save.
          </div>

          <input
            type="search"
            className="login-option-input field-search-input"
            placeholder="Search fields by name..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setExpanded(false);
            }}
            aria-label="Search fields"
          />
          <div className="field-list-count">
            {isSearching
              ? `${filteredFields.length} match${filteredFields.length === 1 ? '' : 'es'} for "${search.trim()}"`
              : `Showing ${visibleFields.length} of ${filteredFields.length} fields`}
          </div>

          <div className="field-list">
            {visibleFields.map((field) => {
              const isEditing = editingKey === field.key;
              const outcome = lastOutcomes[field.key];
              const editable = canEditInline(field);

              return (
                <div key={field.key} className={`field-list-row${isEditing ? ' field-list-row-editing' : ''}`}>
                  <div className="field-list-main">
                    <span className="field-list-label">
                      {field.label}
                      {field.mandatory && <span className="field-mandatory"> *</span>}
                      {field.needsApproval && <span className="field-approval-hint"> (needs approval)</span>}
                    </span>
                    {!isEditing && (
                      <span className="field-list-value">
                        {values[field.key]?.displayValue ?? values[field.key]?.value ?? 'Not set'}
                      </span>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="field-edit-inline">
                      {field.type === 'BOOLEAN' ? (
                        <select
                          className="login-option-input"
                          value={draftValue}
                          onChange={(event) => setDraftValue(event.target.value)}
                          autoFocus
                        >
                          <option value="">Not set</option>
                          <option value="true">Yes</option>
                          <option value="false">No</option>
                        </select>
                      ) : field.type === 'SINGLE_SELECT' ? (
                        <select
                          className="login-option-input"
                          value={draftValue}
                          onChange={(event) => setDraftValue(event.target.value)}
                          autoFocus
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
                          className="login-option-input"
                          type={inputTypeFor(field.type)}
                          value={draftValue}
                          onChange={(event) => setDraftValue(event.target.value)}
                          autoFocus
                        />
                      )}
                      <button
                        type="button"
                        className="refresh-button field-list-save"
                        onClick={() => void saveField(field)}
                        disabled={submitting}
                      >
                        {submitting ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        type="button"
                        className="secondary-button field-list-cancel"
                        onClick={cancelEdit}
                        disabled={submitting}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="field-list-actions">
                      {outcome && (
                        <span className={`outcome-badge ${STATUS_CLASS[outcome.status]}`}>
                          {STATUS_LABEL[outcome.status]}
                        </span>
                      )}
                      {editable ? (
                        <button type="button" className="field-list-edit-btn" onClick={() => startEdit(field)}>
                          Edit
                        </button>
                      ) : (
                        <span className="field-list-note">
                          {!EDITABLE_TYPES.has(field.type)
                            ? `${field.type} not supported yet`
                            : field.blockedReason || 'Not editable'}
                        </span>
                      )}
                    </div>
                  )}

                  {isEditing && submitError && (
                    <div className="field-edit-error">{submitError}</div>
                  )}
                </div>
              );
            })}
          </div>

          {hasMoreToShow && (
            <button type="button" className="field-list-show-more" onClick={() => setExpanded(true)}>
              Show all {filteredFields.length} fields
            </button>
          )}
          {expanded && !isSearching && (
            <button type="button" className="field-list-show-more" onClick={() => setExpanded(false)}>
              Show fewer fields
            </button>
          )}
        </>
      )}
    </div>
  );
}
