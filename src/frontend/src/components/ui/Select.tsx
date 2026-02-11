import React, { useState, useRef, useEffect, useCallback } from 'react';
import { theme } from '../../theme';

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface SelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchable?: boolean;
  disabled?: boolean;
  style?: React.CSSProperties;
}

export default function Select({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  searchable = false,
  disabled = false,
  style,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(o => o.value === value);

  const filtered = search
    ? options.filter(o =>
        o.label.toLowerCase().includes(search.toLowerCase()) ||
        (o.sublabel && o.sublabel.toLowerCase().includes(search.toLowerCase()))
      )
    : options;

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Auto-scroll highlighted item into view
  useEffect(() => {
    if (highlightIdx >= 0 && listRef.current) {
      const items = listRef.current.children;
      if (items[highlightIdx]) {
        (items[highlightIdx] as HTMLElement).scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightIdx]);

  const handleOpen = () => {
    if (disabled) return;
    setIsOpen(true);
    setHighlightIdx(-1);
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  const handleSelect = (opt: SelectOption) => {
    onChange(opt.value);
    setIsOpen(false);
    setSearch('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSearch('');
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx(prev => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && highlightIdx >= 0 && filtered[highlightIdx]) {
      e.preventDefault();
      handleSelect(filtered[highlightIdx]);
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', ...style }}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => isOpen ? setIsOpen(false) : handleOpen()}
        style={{
          ...trigger,
          borderColor: isOpen ? theme.borderFocus : theme.borderInput,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
        }}
        disabled={disabled}
      >
        <span style={{ color: selectedOption ? theme.textPrimary : theme.textMuted, flex: 1, textAlign: 'left' }}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }}>
          <path d="M2.5 4.5L6 8L9.5 4.5" stroke={theme.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div style={dropdown} onKeyDown={handleKeyDown}>
          {searchable && (
            <div style={searchWrap}>
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setHighlightIdx(0); }}
                onKeyDown={handleKeyDown}
                placeholder="Search..."
                style={searchInput}
              />
            </div>
          )}
          <div ref={listRef} style={listStyle}>
            {filtered.length === 0 ? (
              <div style={emptyStyle}>No matches</div>
            ) : (
              filtered.map((opt, idx) => (
                <button
                  key={opt.value}
                  type="button"
                  style={{
                    ...optionStyle,
                    background: idx === highlightIdx ? theme.accentMuted : opt.value === value ? 'rgba(255,255,255,0.03)' : 'transparent',
                  }}
                  onMouseEnter={() => setHighlightIdx(idx)}
                  onClick={() => handleSelect(opt)}
                >
                  <span style={{ color: theme.textPrimary }}>{opt.label}</span>
                  {opt.sublabel && <span style={{ fontSize: '12px', color: theme.textMuted }}>{opt.sublabel}</span>}
                  {opt.value === value && (
                    <svg width="14" height="14" viewBox="0 0 14 14" style={{ marginLeft: 'auto', flexShrink: 0 }}>
                      <path d="M3 7.5L5.5 10L11 4" stroke={theme.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    </svg>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const trigger: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  background: theme.inputSurface,
  border: `1px solid ${theme.borderInput}`,
  borderRadius: theme.radiusSm,
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '14px',
  fontFamily: 'inherit',
  transition: 'border-color 150ms ease-out',
};

const dropdown: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 4px)',
  left: 0,
  right: 0,
  background: theme.surfaceElevated,
  border: `1px solid ${theme.border}`,
  borderRadius: theme.radiusSm,
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  zIndex: 1001,
  animation: 'modalFadeIn 150ms cubic-bezier(0.16, 1, 0.3, 1)',
  overflow: 'hidden',
};

const searchWrap: React.CSSProperties = {
  padding: '8px 8px 0',
};

const searchInput: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  background: theme.inputSurface,
  color: theme.textPrimary,
  border: `1px solid ${theme.borderInput}`,
  borderRadius: '6px',
  fontSize: '13px',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
};

const listStyle: React.CSSProperties = {
  maxHeight: '220px',
  overflowY: 'auto',
  padding: '4px',
};

const optionStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '14px',
  fontFamily: 'inherit',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  textAlign: 'left',
  transition: 'background 100ms',
};

const emptyStyle: React.CSSProperties = {
  padding: '16px',
  textAlign: 'center',
  color: theme.textMuted,
  fontSize: '13px',
};
