import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from './ui';
import { theme } from '../theme';

export default function Login() {
  const { login, isAuthenticated, isAuthorized, isLoading } = useAuth();
  const navigate = useNavigate();
  const [signingIn, setSigningIn] = useState(false);
  
  React.useEffect(() => {
    if (isAuthenticated && isAuthorized) {
      navigate('/dashboard');
    } else if (isAuthenticated && !isAuthorized) {
      navigate('/not-authorized');
    }
  }, [isAuthenticated, isAuthorized, navigate]);
  
  const handleLogin = async () => {
    setSigningIn(true);
    try {
      await login();
    } finally {
      setSigningIn(false);
    }
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
        <img src="/yieldschool_inc_logo.jpeg" alt="Yieldschool" style={styles.logo} />
        <h1 style={styles.title}>Office Hours</h1>
        <p style={styles.subtitle}>Sign in to manage Yieldschool office hours</p>
        
        <Button
          variant="primary"
          onClick={handleLogin}
          loading={signingIn}
          style={{ width: '100%', padding: '14px 24px', fontSize: '15px', borderRadius: '10px', marginBottom: '16px' }}
        >
          Sign in with Internet Identity
        </Button>
        
        <p style={styles.hint}>
          Secure, passwordless sign-in
        </p>
        
        <div style={styles.divider} />
        
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
    borderRadius: theme.radiusLg,
    padding: '40px',
    textAlign: 'center',
    maxWidth: '400px',
    width: '100%',
    border: `1px solid ${theme.border}`,
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2)',
  },
  logo: {
    width: '64px',
    height: '64px',
    borderRadius: theme.radiusMd,
    objectFit: 'cover' as any,
    marginBottom: '20px',
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
  divider: {
    height: '1px',
    background: theme.border,
    marginBottom: '20px',
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
