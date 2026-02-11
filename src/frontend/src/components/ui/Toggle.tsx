import React from 'react';
import { theme } from '../../theme';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}

export default function Toggle({ checked, onChange, label, description, disabled = false }: ToggleProps) {
  return (
    <label style={{ ...container, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}>
      <div style={{ flex: 1 }}>
        {label && <div style={labelStyle}>{label}</div>}
        {description && <div style={descStyle}>{description}</div>}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => !disabled && onChange(!checked)}
        style={{
          ...track,
          background: checked ? theme.accent : theme.borderInput,
        }}
        disabled={disabled}
        type="button"
      >
        <span style={{
          ...thumb,
          transform: checked ? 'translateX(18px)' : 'translateX(2px)',
        }} />
      </button>
    </label>
  );
}

const container: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '16px',
};

const track: React.CSSProperties = {
  width: '42px',
  height: '24px',
  borderRadius: '12px',
  border: 'none',
  cursor: 'inherit',
  position: 'relative',
  transition: 'background 200ms ease-out',
  flexShrink: 0,
  padding: 0,
};

const thumb: React.CSSProperties = {
  display: 'block',
  width: '20px',
  height: '20px',
  borderRadius: '50%',
  background: '#fff',
  transition: 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)',
  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
  position: 'absolute',
  top: '2px',
};

const labelStyle: React.CSSProperties = {
  fontSize: '15px',
  fontWeight: 500,
  color: theme.textPrimary,
};

const descStyle: React.CSSProperties = {
  fontSize: '13px',
  color: theme.textMuted,
  marginTop: '2px',
};
