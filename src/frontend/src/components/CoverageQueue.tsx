import { useState, useEffect, useCallback } from 'react';
import { useBackend, EventInstance, User, nanosToDate, bytesToHex, isSessionExpiredError } from '../hooks/useBackend';
import { useAuth } from '../hooks/useAuth';
import { useTimezone } from '../hooks/useTimezone';
import { Principal } from '@dfinity/principal';
import { theme } from '../theme';

export default function CoverageQueue() {
  const { actor, loading: actorLoading, triggerSessionExpired } = useBackend();
  const { user } = useAuth();
  const { timezone, abbrev } = useTimezone();
  
  const [events, setEvents] = useState<EventInstance[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [selectedHosts, setSelectedHosts] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Fetch unclaimed events
  const fetchEvents = useCallback(async () => {
    if (!actor) return;
    setLoading(true);
    setError(null);
    try {
      const result = await actor.list_unclaimed_events();
      if ('Ok' in result) {
        const sorted = [...result.Ok].sort((a, b) => Number(a.start_utc - b.start_utc));
        setEvents(sorted);
      } else {
        setError(getErrorMessage(result.Err));
      }
    } catch (err) {
      if (isSessionExpiredError(err)) {
        triggerSessionExpired();
        setError('Your session has expired. Please sign in again.');
      } else {
        setError('Failed to load coverage queue');
      }
    } finally {
      setLoading(false);
    }
  }, [actor, triggerSessionExpired]);

  // Fetch users for dropdown
  const fetchUsers = useCallback(async () => {
    if (!actor) return;
    try {
      const result = await actor.list_users();
      if ('Ok' in result) {
        const activeUsers = result.Ok.filter((u: User) => 'Active' in u.status);
        setUsers(activeUsers);
      }
    } catch (err) {
      if (isSessionExpiredError(err)) {
        triggerSessionExpired();
      }
    }
  }, [actor, triggerSessionExpired]);

  useEffect(() => {
    if (!actor || actorLoading) return;
    fetchEvents();
    fetchUsers();
  }, [actor, actorLoading, fetchEvents, fetchUsers]);

  // Show toast
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Handle assignment
  const handleAssign = async (event: EventInstance) => {
    if (!actor) return;
    
    const eventKey = bytesToHex(event.instance_id as number[]);
    const hostPrincipal = selectedHosts[eventKey];
    
    if (!hostPrincipal) {
      showToast('Please select a host first', 'error');
      return;
    }
    
    const hostUser = users.find(u => u.principal.toText() === hostPrincipal);
    setAssigningId(eventKey);
    
    try {
      const result = await actor.assign_host(
        event.series_id ? [event.series_id] : [],
        event.series_id ? [event.start_utc] : [],
        event.instance_id,
        Principal.fromText(hostPrincipal)
      );
      
      if ('Ok' in result) {
        showToast(`Assigned to ${hostUser?.name || 'host'}`);
        // Remove from list
        setEvents(prev => prev.filter(e => bytesToHex(e.instance_id as number[]) !== eventKey));
        // Clear selection
        setSelectedHosts(prev => {
          const next = { ...prev };
          delete next[eventKey];
          return next;
        });
      } else {
        showToast(getErrorMessage(result.Err), 'error');
      }
    } catch (err) {
      if (isSessionExpiredError(err)) {
        triggerSessionExpired();
        showToast('Session expired. Please sign in again.', 'error');
      } else {
        showToast('Failed to assign host', 'error');
      }
    } finally {
      setAssigningId(null);
    }
  };

  // Format helpers
  const formatDateInZone = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric',
      year: 'numeric',
      timeZone: timezone 
    });
  };

  const formatTimeInZone = (nanos: bigint) => {
    const date = nanosToDate(nanos);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      timeZone: timezone 
    });
  };

  // Group events by date
  const groupedEvents = events.reduce((acc, event) => {
    const date = nanosToDate(event.start_utc);
    const dateKey = date.toLocaleDateString('en-CA', { timeZone: timezone }); // YYYY-MM-DD format
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(event);
    return acc;
  }, {} as Record<string, EventInstance[]>);

  if (actorLoading || loading) {
    return <div style={styles.loading}>Loading coverage queue...</div>;
  }

  return (
    <div style={styles.container}>
      {/* Toast */}
      {toast && (
        <div style={{
          ...styles.toast,
          ...(toast.type === 'error' ? styles.toastError : {}),
        }}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Coverage Queue</h2>
          <p style={styles.subtitle}>Sessions that need a host assigned</p>
        </div>
        <button style={styles.refreshBtn} onClick={fetchEvents} disabled={loading}>
          Refresh
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {events.length === 0 ? (
        <div style={styles.emptyState}>
          <h3 style={styles.emptyTitle}>All Covered</h3>
          <p style={styles.emptyText}>No sessions need hosts right now.</p>
        </div>
      ) : (
        <div style={styles.list}>
          {Object.entries(groupedEvents).map(([dateKey, dateEvents]) => (
            <div key={dateKey} style={styles.dateGroup}>
              {dateEvents.map(event => {
                const eventKey = bytesToHex(event.instance_id as number[]);
                const isAssigning = assigningId === eventKey;
                const selectedHost = selectedHosts[eventKey] || '';
                
                return (
                  <div key={eventKey} style={styles.card}>
                    {/* Card Header */}
                    <div style={styles.cardHeader}>
                      <span style={styles.dateText}>
                        {formatDateInZone(nanosToDate(event.start_utc))}
                      </span>
                      <span style={styles.needsHostBadge}>Needs Host</span>
                    </div>
                    
                    {/* Event Details */}
                    <div style={styles.eventTitle}>{event.title}</div>
                    <div style={styles.eventTime}>
                      {formatTimeInZone(event.start_utc)} – {formatTimeInZone(event.end_utc)}
                      <span style={styles.tzLabel}>{abbrev}</span>
                    </div>
                    
                    {event.notes && (
                      <div style={styles.notes}>{event.notes}</div>
                    )}
                    
                    {/* Assignment Row */}
                    <div style={styles.assignRow}>
                      <select
                        style={styles.hostSelect}
                        value={selectedHost}
                        onChange={(e) => setSelectedHosts(prev => ({ ...prev, [eventKey]: e.target.value }))}
                        disabled={isAssigning}
                      >
                        <option value="">Select a host...</option>
                        {/* Put current user at top */}
                        {user && (
                          <option value={user.principal.toText()}>
                            {user.name} (Me)
                          </option>
                        )}
                        {users
                          .filter(u => !user || u.principal.toText() !== user.principal.toText())
                          .map(u => (
                            <option key={u.principal.toText()} value={u.principal.toText()}>
                              {u.name}
                            </option>
                          ))
                        }
                      </select>
                      <button
                        style={{
                          ...styles.assignBtn,
                          ...(isAssigning || !selectedHost ? styles.assignBtnDisabled : {}),
                        }}
                        onClick={() => handleAssign(event)}
                        disabled={isAssigning || !selectedHost}
                      >
                        {isAssigning ? 'Assigning...' : 'Assign'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getErrorMessage(err: any): string {
  if (typeof err === 'string') return err;
  if (err?.Unauthorized) return 'Not authorized';
  if (err?.NotFound) return 'Not found';
  if (err?.InvalidInput) return err.InvalidInput;
  if (err?.Conflict) return err.Conflict;
  if (err?.InternalError) return err.InternalError;
  return 'An error occurred';
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    padding: '0',
    position: 'relative',
  },
  loading: {
    textAlign: 'center',
    padding: '60px 20px',
    color: theme.textMuted,
  },
  toast: {
    position: 'fixed',
    top: '20px',
    right: '20px',
    background: theme.accent,
    color: '#fff',
    padding: '12px 20px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 500,
    zIndex: 1000,
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
  },
  toastError: {
    background: '#F87171',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '24px',
  },
  title: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 600,
    color: theme.textPrimary,
  },
  subtitle: {
    margin: '4px 0 0 0',
    fontSize: '14px',
    color: theme.textMuted,
  },
  refreshBtn: {
    padding: '8px 16px',
    background: 'transparent',
    color: theme.textSecondary,
    border: `1px solid ${theme.border}`,
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  error: {
    background: 'rgba(248, 113, 113, 0.1)',
    color: '#F87171',
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '16px',
    fontSize: '14px',
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    background: theme.surface,
    borderRadius: '12px',
    border: `1px solid ${theme.border}`,
  },
  emptyTitle: {
    margin: '0 0 8px 0',
    fontSize: '18px',
    fontWeight: 600,
    color: theme.textPrimary,
  },
  emptyText: {
    margin: 0,
    fontSize: '14px',
    color: theme.textMuted,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  dateGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  card: {
    background: theme.surface,
    borderRadius: '12px',
    padding: '20px',
    border: `1px solid ${theme.border}`,
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  dateText: {
    fontSize: '14px',
    fontWeight: 500,
    color: theme.textSecondary,
  },
  needsHostBadge: {
    background: 'rgba(248, 113, 113, 0.15)',
    color: '#F87171',
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 500,
  },
  eventTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: theme.textPrimary,
    marginBottom: '6px',
  },
  eventTime: {
    fontSize: '14px',
    color: theme.textSecondary,
    marginBottom: '12px',
  },
  tzLabel: {
    marginLeft: '8px',
    fontSize: '12px',
    color: theme.textMuted,
  },
  notes: {
    fontSize: '14px',
    color: theme.textMuted,
    fontStyle: 'italic',
    marginBottom: '16px',
    padding: '10px 12px',
    background: theme.bg,
    borderRadius: '6px',
  },
  assignRow: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    paddingTop: '12px',
    borderTop: `1px solid ${theme.border}`,
  },
  hostSelect: {
    flex: 1,
    padding: '10px 14px',
    background: theme.inputSurface,
    color: theme.textPrimary,
    border: `1px solid ${theme.borderInput}`,
    borderRadius: '8px',
    fontSize: '14px',
    cursor: 'pointer',
  },
  assignBtn: {
    padding: '10px 20px',
    background: theme.accent,
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'opacity 150ms ease-out',
  },
  assignBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
};
