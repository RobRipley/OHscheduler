import React from 'react';
import { theme } from '../../theme';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
}

const sizeMap: Record<ButtonSize, React.CSSProperties> = {
  sm: { padding: '6px 12px', fontSize: '13px', borderRadius: '6px' },
  md: { padding: '10px 18px', fontSize: '14px', borderRadius: theme.radiusSm },
  lg: { padding: '12px 24px', fontSize: '15px', borderRadius: theme.radiusSm },
};

const variantMap: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: theme.accent,
    color: '#fff',
    border: 'none',
    fontWeight: 500,
  },
  secondary: {
    background: 'transparent',
    color: theme.textSecondary,
    border: `1px solid ${theme.border}`,
  },
  ghost: {
    background: 'transparent',
    color: theme.textSecondary,
    border: 'none',
  },
  danger: {
    background: 'transparent',
    color: theme.danger,
    border: `1px solid ${theme.dangerMuted}`,
  },
};

export default function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  children,
  disabled,
  style,
  className = '',
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    transition: 'all 150ms ease-out',
    fontFamily: 'inherit',
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
    opacity: isDisabled ? 0.5 : 1,
    ...sizeMap[size],
    ...variantMap[variant],
    ...style,
  };

  // Use CSS classes for hover states (handled by global.css)
  const cssClass = [
    'btn',
    `btn-${variant}`,
    isDisabled ? 'btn-disabled' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button
      className={cssClass}
      style={baseStyle}
      disabled={isDisabled}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" style={{ animation: 'spin 0.8s linear infinite' }}>
      <circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="22" strokeDashoffset="8" />
    </svg>
  );
}
