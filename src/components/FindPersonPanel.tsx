import { searchPeopleByTerm } from '../api/client';
import LookupSelect from './LookupSelect';
import '../styles.css';

interface FindPersonPanelProps {
  onSelect: (profileId: string, displayName: string) => void;
}

export default function FindPersonPanel({ onSelect }: FindPersonPanelProps) {
  return (
    <div className="dashboard-card">
      <div className="card-header">
        <h2 className="card-title">
          <span className="card-icon">🔍</span>
          Find a Person
        </h2>
        <span className="summary-badge">POST /lookup</span>
      </div>
      <p className="field-list-overview">
        Search by name, email, or employee ID to view or edit anyone you have access to.
      </p>
      <LookupSelect
        onChange={(id, label) => onSelect(id, label)}
        search={searchPeopleByTerm}
        placeholder="Search by name, email, or employee ID"
        minLength={3}
      />
    </div>
  );
}
