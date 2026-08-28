import { useEffect, useRef, useState } from 'react';
import type { LookupOption } from '../api/client';
import '../styles.css';

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
  // Bumped on every search kicked off; a response only gets applied if it's still the latest
  // one requested, so a slow earlier search can't overwrite a faster, more recent one.
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    const term = query.trim();
    if (term.length < minLength) {
      requestIdRef.current += 1;
      setOptions([]);
      setSearchError(null);
      setSearching(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      const requestId = ++requestIdRef.current;
      setSearching(true);
      setSearchError(null);
      search(term)
        .then((results) => {
          if (requestIdRef.current !== requestId) return;
          setOptions(results);
        })
        .catch((err) => {
          if (requestIdRef.current !== requestId) return;
          setSearchError(err instanceof Error ? err.message : 'Search failed');
        })
        .finally(() => {
          if (requestIdRef.current !== requestId) return;
          setSearching(false);
        });
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
