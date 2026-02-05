import { useState, useRef, useEffect } from 'react';
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useBackend } from '../hooks/useBackend';
import { useTimezone, COMMON_TIMEZONES, getTimezoneAbbrev, getTimezoneCityName } from '../hooks/useTimezone';
import Calendar from './Calendar';
import CoverageQueue from './CoverageQueue';
import AdminPanel from './AdminPanel';
import NotificationBell from './NotificationBell';
import { theme } from '../theme';

export default function AuthenticatedLayout() {
  const { user, isAdmin, logout, principal, login, isSessionExpired: authSessionExpired, clearExpiredSession } = useAuth();
  const { sessionExpired: backendSessionExpired } = useBackend();
  const { timezone, setTimezone, abbrev } = useTimezone();
  const navigate = useNavigate();
  
  const [showTzSelector, setShowTzSelector] = useState(false);
  const tzSelectorRef = useRef<HTMLDivElement>(null);
  
  // Session is expired if either auth or backend detects it
  const sessionExpired = authSessionExpired || backendSessionExpired;
  
  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleReAuthenticate = async () => {
    // Clear expired session data first
    await clearExpiredSession();
    // Attempt to log in again
    await login();
  };

  const handleTimezoneChange = (tz: string) => {
    setTimezone(tz);
    setShowTzSelector(false);
  };

  // Close timezone dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tzSelectorRef.current && !tzSelectorRef.current.contains(e.target as Node)) {
        setShowTzSelector(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div style={styles.container}>
      {/* Session Expired Banner */}
      {sessionExpired && (
        <div style={styles.sessionExpiredBanner}>
          <div style={styles.sessionExpiredContent}>
            <span style={styles.sessionExpiredIcon}>⚠️</span>
            <span style={styles.sessionExpiredText}>
              Your session has expired. Please sign in again to continue.
            </span>
            <button onClick={handleReAuthenticate} style={styles.reAuthButton}>
              Sign In
            </button>
          </div>
        </div>
      )}
      
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <h1 style={styles.logo}>Office Hours</h1>
          <nav style={styles.nav}>
            <NavLink 
              to="/dashboard" 
              end
              style={({ isActive }) => ({
                ...styles.navLink,
                ...(isActive ? styles.navLinkActive : {}),
              })}
            >
              Calendar
            </NavLink>
            <NavLink 
              to="/dashboard/queue"
              style={({ isActive }) => ({
                ...styles.navLink,
                ...(isActive ? styles.navLinkActive : {}),
              })}
            >
              Coverage Queue
            </NavLink>
            {isAdmin && (
              <NavLink 
                to="/dashboard/admin"
                style={({ isActive }) => ({
                  ...styles.navLink,
                  ...(isActive ? styles.navLinkActive : {}),
                })}
              >
                Admin
              </NavLink>
            )}
          </nav>
          <div style={styles.userSection}>
            <NotificationBell />
            
            {/* Timezone Selector */}
            <div style={styles.tzSelectorWrapper} ref={tzSelectorRef}>
              <button 
                style={styles.tzButton}
                onClick={() => setShowTzSelector(!showTzSelector)}
                title={`Display timezone: ${timezone}`}
              >
                {abbrev} ▾
              </button>
              {showTzSelector && (
                <div style={styles.tzDropdown}>
                  <div style={styles.tzDropdownHeader}>Display Timezone</div>
                  {COMMON_TIMEZONES.map(tz => (
                    <button
                      key={tz}
                      style={{
                        ...styles.tzOption,
                        ...(tz === timezone ? styles.tzOptionActive : {}),
                      }}
                      onClick={() => handleTimezoneChange(tz)}
                    >
                      <span>{getTimezoneCityName(tz)}</span>
                      <span style={styles.tzAbbrev}>{getTimezoneAbbrev(tz)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <span style={styles.userName}>
              {user?.name || principal?.toText().slice(0, 8) + '...'}
            </span>
            <button onClick={handleLogout} style={styles.logoutButton}>
              Sign out
            </button>
          </div>
        </div>
      </header>
      
      <main style={styles.main}>
        <Routes>
          <Route index element={<Calendar />} />
          <Route path="queue" element={<CoverageQueue />} />
          {isAdmin && <Route path="admin/*" element={<AdminPanel />} />}
        </Routes>
      </main>
    </div>
  );
}


const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    background: theme.bg,
  },
  sessionExpiredBanner: {
    background: 'rgba(251, 146, 60, 0.15)',
    borderBottom: '1px solid rgba(251, 146, 60, 0.3)',
    padding: '12px 20px',
  },
  sessionExpiredContent: {
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  sessionExpiredIcon: {
    fontSize: '16px',
  },
  sessionExpiredText: {
    color: '#FB923C',
    fontSize: '14px',
    fontWeight: 500,
    flex: 1,
  },
  reAuthButton: {
    padding: '8px 16px',
    background: '#FB923C',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
    transition: 'background 150ms ease-out',
  },
  header: {
    background: theme.surface,
    borderBottom: `1px solid ${theme.border}`,
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  headerContent: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 20px',
    display: 'flex',
    alignItems: 'center',
    height: '60px',
    gap: '24px',
  },
  logo: {
    fontSize: '18px',
    fontWeight: 600,
    margin: 0,
    color: theme.textPrimary,
  },
  nav: {
    display: 'flex',
    gap: '4px',
    flex: 1,
  },
  navLink: {
    padding: '8px 16px',
    textDecoration: 'none',
    color: theme.textMuted,
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 500,
    transition: 'color 150ms ease-out',
    borderBottom: '2px solid transparent',
  },
  navLinkActive: {
    color: theme.textPrimary,
    borderBottomColor: theme.accent,
  },
  userSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  
  // Timezone selector
  tzSelectorWrapper: {
    position: 'relative',
  },
  tzButton: {
    padding: '6px 10px',
    background: theme.surfaceElevated,
    color: theme.textSecondary,
    border: `1px solid ${theme.border}`,
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    transition: 'all 150ms ease-out',
  },
  tzDropdown: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: '6px',
    background: theme.surfaceElevated,
    border: `1px solid ${theme.border}`,
    borderRadius: '8px',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
    zIndex: 200,
    minWidth: '200px',
    maxHeight: '320px',
    overflowY: 'auto',
  },
  tzDropdownHeader: {
    padding: '10px 12px 8px',
    fontSize: '11px',
    fontWeight: 600,
    color: theme.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    borderBottom: `1px solid ${theme.border}`,
  },
  tzOption: {
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
  tzOptionActive: {
    background: theme.accentFocus,
    color: theme.textPrimary,
  },
  tzAbbrev: {
    color: theme.textMuted,
    fontSize: '11px',
  },
  
  userName: {
    fontSize: '14px',
    color: theme.textSecondary,
  },
  logoutButton: {
    padding: '6px 12px',
    fontSize: '13px',
    background: 'transparent',
    color: theme.textSecondary,
    border: `1px solid ${theme.border}`,
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 150ms ease-out',
  },
  main: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '24px 20px',
  },
};
