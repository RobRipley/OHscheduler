import React, { useEffect, useRef, useCallback } from 'react';
import { theme } from '../../theme';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: string;
  showClose?: boolean;
}

export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
  maxWidth = '480px',
  showClose = true,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  // Save focus, restore on close
  useEffect(() => {
    if (open) {
      previousFocus.current = document.activeElement as HTMLElement;
      // Focus first focusable element in modal
      setTimeout(() => {
        const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable && focusable.length > 0) {
          // Skip the close button, focus the first meaningful element
          const target = focusable.length > 1 ? focusable[1] : focusable[0];
          target.focus();
        }
      }, 50);
    } else if (previousFocus.current) {
      previousFocus.current.focus();
      previousFocus.current = null;
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Focus trap
  const handleTab = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !modalRef.current) return;
    const focusable = modalRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="modal-overlay" style={overlay} onClick={onClose}>
      <div
        ref={modalRef}
        className="modal-content"
        style={{ ...modal, maxWidth }}
        onClick={e => e.stopPropagation()}
        onKeyDown={handleTab}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {showClose && (
          <button style={closeBtn} onClick={onClose} aria-label="Close">
            ×
          </button>
        )}
        {title && <h3 style={titleStyle}>{title}</h3>}
        {description && <p style={descStyle}>{description}</p>}
        {children}
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0, 0, 0, 0.6)',
  backdropFilter: 'blur(8px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  animation: 'overlayFadeIn 200ms ease-out',
};

const modal: React.CSSProperties = {
  background: theme.surfaceElevated,
  borderRadius: theme.radiusLg,
  padding: '28px',
  width: '90%',
  position: 'relative',
  maxHeight: '90vh',
  overflowY: 'auto',
  border: `1px solid ${theme.border}`,
  animation: 'modalFadeIn 250ms cubic-bezier(0.16, 1, 0.3, 1)',
};

const closeBtn: React.CSSProperties = {
  position: 'absolute',
  top: '16px',
  right: '16px',
  background: 'transparent',
  border: 'none',
  fontSize: '22px',
  cursor: 'pointer',
  color: theme.textMuted,
  padding: '4px 8px',
  lineHeight: 1,
  borderRadius: theme.radiusSm,
};

const titleStyle: React.CSSProperties = {
  margin: '0 0 8px 0',
  fontSize: '18px',
  fontWeight: 600,
  color: theme.textPrimary,
  paddingRight: '32px',
};

const descStyle: React.CSSProperties = {
  fontSize: '14px',
  color: theme.textMuted,
  marginTop: 0,
  marginBottom: '20px',
  lineHeight: 1.5,
};
