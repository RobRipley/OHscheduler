import { useState, useRef, useEffect, useMemo } from 'react';
import { useTimezone, TIMEZONE_LIST, getTimezoneAbbrev } from '../hooks/useTimezone';
import { theme } from '../theme';

export default function TimezoneButton() {
  const { timezone, setTimezone, abbrev } = useTimezone();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    if (!s) return TIMEZONE_LIST;
    return TIMEZONE_LIST.filter(t => {
      const labelLower = t.label.toLowerCase();
      const tzLower = t.tz.toLowerCase().replace(/_/g, ' ');
      const aliasMatch = t.aliases.some(a => a.includes(s));
      return labelLower.includes(s) || tzLower.includes(s) || aliasMatch;
    });
  }, [search]);

  const handleSelect = (tz: string) => {
    setTimezone(tz);
    setOpen(false);
    setSearch('');
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [open]);

  return (
    <div style={styles.wrapper} ref={ref}>
      <button
        style={styles.button}
        onClick={() => setOpen(!open)}
        title={`Display timezone: ${timezone}`}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        {abbrev}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div style={styles.dropdown}>
          <div style={styles.dropdownHeader}>Display Timezone</div>
          <input
            ref={searchRef}
            type="text"
            placeholder="Search timezones..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={styles.searchInput}
            autoFocus
          />
          <div style={styles.list}>
            {filtered.map(t => (
              <button
                key={t.tz}
                style={{
                  ...styles.option,
                  ...(t.tz === timezone ? styles.optionActive : {}),
                }}
                onClick={() => handleSelect(t.tz)}
              >
                <span>{t.label}</span>
                <span style={styles.optionAbbrev}>{getTimezoneAbbrev(t.tz)}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <div style={styles.noResults}>No timezones found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  wrapper: {
    position: 'relative',
  },
  button: {
    padding: '6px 10px',
    background: theme.surfaceElevated,
    color: theme.textMuted,
    border: `1px solid ${theme.border}`,
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    transition: 'all 150ms ease-out',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: '6px',
    background: theme.surfaceElevated,
    border: `1px solid ${theme.border}`,
    borderRadius: '8px',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
    zIndex: 200,
    minWidth: '260px',
    display: 'flex',
    flexDirection: 'column',
  },
  dropdownHeader: {
    padding: '10px 12px 8px',
    fontSize: '11px',
    fontWeight: 600,
    color: theme.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    borderBottom: `1px solid ${theme.border}`,
  },
  searchInput: {
    margin: '8px',
    padding: '6px 10px',
    background: theme.inputSurface,
    color: theme.textPrimary,
    border: `1px solid ${theme.borderInput}`,
    borderRadius: '6px',
    fontSize: '13px',
    outline: 'none',
  },
  list: {
    maxHeight: '280px',
    overflowY: 'auto',
  },
  noResults: {
    padding: '12px',
    textAlign: 'center',
    fontSize: '13px',
    color: theme.textMuted,
  },
  option: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    padding: '10px 12px',
    background: 'transparent',
    border: 'none',
    color: theme.textSecondary,
    fontSize: '13px',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background 100ms ease-out',
  },
  optionActive: {
    background: theme.accentFocus,
    color: theme.textPrimary,
  },
  optionAbbrev: {
    color: theme.textMuted,
    fontSize: '11px',
  },
};
