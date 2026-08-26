import { useEffect, useRef, useState } from 'react';
import '../styles.css';

export interface LookupOption {
  id: string;
  label: string;
  sublabel?: string;
}

interface LookupSelectProps {
  currentLabel?: string;
  onChange: (id: string, label: string) => void;
  search: (term: string) => Promise<LookupOption[]>;
  placeholder: string;
  minLength: number;
}

export default function LookupSelect({ currentLabel, onChange, search, placeholder, minLength }: LookupSelectProps) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<LookupOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    const term = query.trim();
    if (term.length < minLength) {
      setOptions([]);
      setSearchError(null);
      setSearching(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      setSearching(true);
      setSearchError(null);
      search(term)
        .then(setOptions)
        .catch((err) => setSearchError(err instanceof Error ? err.message : 'Search failed'))
        .finally(() => setSearching(false));
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, minLength, search]);

  return (
    <div className="lookup-select">
      <input
        className="login-option-input"
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        autoFocus
      />
      {!query && currentLabel && <div className="lookup-select-current">Currently: {currentLabel}</div>}
      {searching && <div className="lookup-select-status">Searching...</div>}
      {searchError && <div className="field-edit-error">{searchError}</div>}
      {options.length > 0 && (
        <div className="lookup-select-options">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              className="lookup-select-option"
              onClick={() => {
                onChange(option.id, option.label);
                setQuery('');
                setOptions([]);
              }}
            >
              {option.label}
              {option.sublabel && <span className="lookup-select-sublabel"> · {option.sublabel}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
