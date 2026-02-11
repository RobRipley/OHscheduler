import React, { useState, createContext, useContext, useCallback } from 'react';
import Modal from './Modal';
import { theme } from '../../theme';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | null>(null);

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be inside ConfirmProvider');
  return ctx.confirm;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{
    open: boolean;
    options: ConfirmOptions;
    resolve: ((value: boolean) => void) | null;
  }>({
    open: false,
    options: { title: '', message: '' },
    resolve: null,
  });

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ open: true, options, resolve });
    });
  }, []);

  const handleConfirm = () => {
    state.resolve?.(true);
    setState(prev => ({ ...prev, open: false, resolve: null }));
  };

  const handleCancel = () => {
    state.resolve?.(false);
    setState(prev => ({ ...prev, open: false, resolve: null }));
  };

  const { options } = state;
  const isDanger = options.variant === 'danger';

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <Modal
        open={state.open}
        onClose={handleCancel}
        title={options.title}
        maxWidth="400px"
        showClose={false}
      >
        <p style={messageStyle}>{options.message}</p>
        <div style={actions}>
          <button style={cancelBtn} onClick={handleCancel}>
            {options.cancelLabel || 'Cancel'}
          </button>
          <button
            style={isDanger ? dangerBtn : confirmBtn}
            onClick={handleConfirm}
            autoFocus
          >
            {options.confirmLabel || 'Confirm'}
          </button>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
}

const messageStyle: React.CSSProperties = {
  fontSize: '14px',
  color: theme.textSecondary,
  lineHeight: 1.6,
  margin: '4px 0 24px 0',
};

const actions: React.CSSProperties = {
  display: 'flex',
  gap: '12px',
  justifyContent: 'flex-end',
};

const cancelBtn: React.CSSProperties = {
  padding: '10px 20px',
  background: 'transparent',
  color: theme.textSecondary,
  border: `1px solid ${theme.border}`,
  borderRadius: theme.radiusSm,
  cursor: 'pointer',
  fontSize: '14px',
};

const confirmBtn: React.CSSProperties = {
  padding: '10px 20px',
  background: theme.accent,
  color: '#fff',
  border: 'none',
  borderRadius: theme.radiusSm,
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: 500,
};

const dangerBtn: React.CSSProperties = {
  padding: '10px 20px',
  background: theme.danger,
  color: '#fff',
  border: 'none',
  borderRadius: theme.radiusSm,
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: 500,
};
