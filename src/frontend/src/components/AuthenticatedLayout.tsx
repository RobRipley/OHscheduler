import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useBackend } from '../hooks/useBackend';
import Calendar from './Calendar';
import CoverageQueue from './CoverageQueue';
import AdminPanel from './AdminPanel';
import CoverageReport from './CoverageReport';
import NotificationBell from './NotificationBell';
import { Avatar } from './ui';
import { theme } from '../theme';

// SVG icons for bottom tab bar
const CalendarIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const QueueIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
  </svg>
);
const ReportsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
);
const AdminIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

export default function AuthenticatedLayout() {
  const { user, isAdmin, logout, principal, login, isSessionExpired: authSessionExpired, clearExpiredSession } = useAuth();
  const { sessionExpired: backendSessionExpired } = useBackend();
  const navigate = useNavigate();

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

      {/* Desktop header */}
      <header style={styles.header} className="app-header">
        <div style={styles.headerContent} className="app-header-content">
          <div style={styles.logoGroup} className="app-logo-group">
            <img src="/yieldschool_inc_logo.jpeg" alt="Yieldschool" style={styles.logoImg} />
            <h1 style={styles.logo}>Office Hours</h1>
          </div>
          <nav style={styles.nav} className="app-nav app-nav-desktop">
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
            <NavLink
              to="/dashboard/reports"
              style={({ isActive }) => ({
                ...styles.navLink,
                ...(isActive ? styles.navLinkActive : {}),
              })}
            >
              Reports
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
          <div style={styles.userSection} className="app-user-section">
            <NotificationBell />

            <div style={styles.divider} className="app-divider" />

            <div style={styles.userGroup}>
              <Avatar name={user?.name || 'U'} size={28} />
              <span style={styles.userName} className="app-user-name">
                {user?.name || principal?.toText().slice(0, 8) + '...'}
              </span>
            </div>
            <button onClick={handleLogout} style={styles.logoutButton} aria-label="Sign out">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main style={styles.main} className="app-main">
        <Routes>
          <Route index element={<Calendar />} />
          <Route path="queue" element={<CoverageQueue />} />
          <Route path="reports" element={<CoverageReport />} />
          {isAdmin && <Route path="admin/*" element={<AdminPanel />} />}
        </Routes>
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="app-bottom-tabs" style={styles.bottomTabs}>
        <NavLink to="/dashboard" end className={({ isActive }) => `app-bottom-tab ${isActive ? 'app-bottom-tab-active' : ''}`}>
          <CalendarIcon />
          <span>Calendar</span>
        </NavLink>
        <NavLink to="/dashboard/queue" className={({ isActive }) => `app-bottom-tab ${isActive ? 'app-bottom-tab-active' : ''}`}>
          <QueueIcon />
          <span>Queue</span>
        </NavLink>
        <NavLink to="/dashboard/reports" className={({ isActive }) => `app-bottom-tab ${isActive ? 'app-bottom-tab-active' : ''}`}>
          <ReportsIcon />
          <span>Reports</span>
        </NavLink>
        {isAdmin && (
          <NavLink to="/dashboard/admin" className={({ isActive }) => `app-bottom-tab ${isActive ? 'app-bottom-tab-active' : ''}`}>
            <AdminIcon />
            <span>Admin</span>
          </NavLink>
        )}
      </nav>
    </div>
  );
}


const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    background: theme.bg,
    paddingBottom: 0, // CSS class adds padding on mobile for bottom tabs
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
  logoGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  logoImg: {
    width: '28px',
    height: '28px',
    borderRadius: '6px',
    objectFit: 'cover' as const,
  },
  logo: {
    fontSize: '16px',
    fontWeight: 600,
    margin: 0,
    color: theme.textPrimary,
  },
  nav: {
    display: 'flex',
    gap: '4px',
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'stretch',
  },
  navLink: {
    padding: '0 16px',
    textDecoration: 'none',
    color: theme.textMuted,
    fontSize: '14px',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    borderBottom: '2px solid transparent',
    marginBottom: '-1px',
    transition: 'color 150ms ease-out',
  },
  navLinkActive: {
    color: theme.textPrimary,
    borderBottomColor: theme.accent,
  },
  userSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  divider: {
    width: '1px',
    height: '24px',
    background: theme.border,
    margin: '0 4px',
  },
  
  userName: {
    fontSize: '14px',
    color: theme.textSecondary,
  },
  userGroup: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: '8px',
  },
  logoutButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    background: 'transparent',
    color: theme.textMuted,
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
  bottomTabs: {
    display: 'none', // Shown via CSS on mobile
    position: 'fixed' as const,
    bottom: 0,
    left: 0,
    right: 0,
    background: theme.surface,
    borderTop: `1px solid ${theme.border}`,
    zIndex: 100,
    padding: '0 0 env(safe-area-inset-bottom)',
  },
};
