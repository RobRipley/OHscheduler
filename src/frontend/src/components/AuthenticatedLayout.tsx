import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Calendar from './Calendar';
import CoverageQueue from './CoverageQueue';
import AdminPanel from './AdminPanel';
import { theme } from '../theme';

export default function AuthenticatedLayout() {
  const { user, isAdmin, logout, principal } = useAuth();
  const navigate = useNavigate();
  
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  const handleLogout = async () => {
    await logout();
    navigate('/');
  };
  
  return (
    <div style={styles.container}>
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
            <span style={styles.timezone}>{userTimezone}</span>
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
  timezone: {
    fontSize: '12px',
    color: theme.textMuted,
    background: theme.surfaceElevated,
    padding: '4px 8px',
    borderRadius: '4px',
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
