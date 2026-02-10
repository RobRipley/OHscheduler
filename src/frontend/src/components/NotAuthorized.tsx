import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { theme } from '../theme';

export default function NotAuthorized() {
  const { principal, logout, isSessionExpired, login } = useAuth();
  const [copied, setCopied] = useState(false);
  
  const principalText = principal?.toText() || 'Unknown';
  
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(principalText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Show session expired message if that's the issue
  if (isSessionExpired) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.title}>Session Expired</h1>
          
          <p style={styles.description}>
            Your session has expired. This happens after a period of inactivity.
            Please sign in again to continue.
          </p>
          
          <div style={styles.actions}>
            <button onClick={login} style={styles.refreshButton}>
              Sign In Again
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Authorization Required</h1>
        
        <p style={styles.description}>
          You have successfully authenticated with Internet Identity, but your account
          has not yet been authorized to access this application.
        </p>
        
        <div style={styles.principalSection}>
          <label style={styles.label}>Your Principal ID:</label>
          <div style={styles.principalBox}>
            <code style={styles.principalText}>{principalText}</code>
            <button onClick={copyToClipboard} style={styles.copyButton}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
        
        <div style={styles.instructions}>
          <h3 style={styles.instructionsTitle}>What to do next:</h3>
          <ol style={styles.instructionsList}>
            <li>Copy your Principal ID above</li>
            <li>Send it to an administrator</li>
            <li>Wait for them to authorize your account</li>
            <li>Refresh this page after authorization</li>
          </ol>
        </div>
        
        <div style={styles.actions}>
          <button onClick={() => window.location.reload()} style={styles.refreshButton}>
            Check Again
          </button>
          <button onClick={logout} style={styles.logoutButton}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}


const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    background: theme.bg,
  },
  card: {
    background: theme.surface,
    borderRadius: '16px',
    padding: '40px',
    maxWidth: '600px',
    width: '100%',
    border: `1px solid ${theme.border}`,
  },
  title: {
    fontSize: '24px',
    marginBottom: '16px',
    color: theme.textPrimary,
    fontWeight: 600,
  },
  description: {
    fontSize: '15px',
    color: theme.textSecondary,
    lineHeight: 1.6,
    marginBottom: '24px',
  },
  principalSection: {
    marginBottom: '24px',
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: 500,
    color: theme.textSecondary,
    marginBottom: '8px',
  },
  principalBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    background: theme.bg,
    padding: '12px 16px',
    borderRadius: '10px',
    border: `1px solid ${theme.border}`,
  },
  principalText: {
    flex: 1,
    fontSize: '13px',
    wordBreak: 'break-all',
    color: theme.textPrimary,
    fontFamily: 'monospace',
  },
  copyButton: {
    padding: '8px 16px',
    fontSize: '14px',
    background: theme.accent,
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    transition: 'background 150ms ease-out',
  },
  instructions: {
    background: theme.surfaceElevated,
    padding: '16px 20px',
    borderRadius: '10px',
    marginBottom: '24px',
    border: `1px solid ${theme.border}`,
  },
  instructionsTitle: {
    color: theme.textPrimary,
    fontSize: '15px',
    fontWeight: 600,
    margin: '0 0 12px 0',
  },
  instructionsList: {
    color: theme.textSecondary,
    margin: 0,
    paddingLeft: '20px',
    lineHeight: 1.8,
    fontSize: '14px',
  },
  actions: {
    display: 'flex',
    gap: '12px',
    marginBottom: '24px',
  },
  refreshButton: {
    flex: 1,
    padding: '12px 20px',
    fontSize: '14px',
    background: theme.accent,
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: 500,
    transition: 'background 150ms ease-out',
  },
  logoutButton: {
    padding: '12px 20px',
    fontSize: '14px',
    background: 'transparent',
    color: theme.textSecondary,
    border: `1px solid ${theme.border}`,
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: 500,
    transition: 'all 150ms ease-out',
  },
};
