import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { theme } from '../theme';

export default function Login() {
  const { login, isAuthenticated, isAuthorized, isLoading } = useAuth();
  const navigate = useNavigate();
  
  React.useEffect(() => {
    if (isAuthenticated && isAuthorized) {
      navigate('/dashboard');
    } else if (isAuthenticated && !isAuthorized) {
      navigate('/not-authorized');
    }
  }, [isAuthenticated, isAuthorized, navigate]);
  
  const handleLogin = async () => {
    await login();
  };
  
  if (isLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading...</div>
      </div>
    );
  }
  
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Office Hours Scheduler</h1>
        <p style={styles.subtitle}>Sign in to manage office hours</p>
        
        <button onClick={handleLogin} style={styles.loginButton}>
          Sign in with Internet Identity
        </button>
        
        <p style={styles.hint}>
          Uses passkey authentication via Internet Identity
        </p>
        
        <a href="/" style={styles.publicLink}>
          View public calendar
        </a>
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
    background: theme.bg,
    padding: '20px',
  },
  card: {
    background: theme.surface,
    borderRadius: '16px',
    padding: '40px',
    textAlign: 'center',
    maxWidth: '400px',
    width: '100%',
    border: `1px solid ${theme.border}`,
  },
  title: {
    fontSize: '24px',
    marginBottom: '8px',
    color: theme.textPrimary,
    fontWeight: 600,
  },
  subtitle: {
    color: theme.textMuted,
    marginBottom: '32px',
    fontSize: '15px',
  },
  loginButton: {
    width: '100%',
    padding: '14px 24px',
    fontSize: '15px',
    background: theme.accent,
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: 500,
    marginBottom: '16px',
    transition: 'background 150ms ease-out',
  },
  hint: {
    fontSize: '13px',
    color: theme.textMuted,
    marginBottom: '24px',
  },
  publicLink: {
    color: theme.accent,
    textDecoration: 'none',
    fontSize: '14px',
  },
  loading: {
    color: theme.textMuted,
    fontSize: '16px',
  },
};
