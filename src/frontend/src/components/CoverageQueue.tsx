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
  const [coveredIds, setCoveredIds] = useState<Set<string>>(new Set()); // Track covered events
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Fetch unclaimed events
  const fetchEvents = useCallback(async () => {
    if (!actor) return;
    setLoading(true);
    setError(null);
    setCoveredIds(new Set()); // Clear covered state on refresh
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
      // series_id comes from Candid as opt blob: [] for None, [Uint8Array] for Some
      const seriesId = event.series_id;
      // occurrence_start is opt nat64: pass [start_utc] if series event, [] if one-off
      const occurrenceStart = (seriesId && seriesId.length > 0) ? [event.start_utc] : [];
      
      const result = await actor.assign_host(
        seriesId,
        occurrenceStart,
        event.instance_id,
        Principal.fromText(hostPrincipal)
      );
      
      if ('Ok' in result) {
        showToast(`Assigned to ${hostUser?.name || 'host'}`);
        // Mark as covered instead of removing
        setCoveredIds(prev => new Set(prev).add(eventKey));
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
          {events.map(event => {
            const eventKey = bytesToHex(event.instance_id as number[]);
            const isAssigning = assigningId === eventKey;
            const isCovered = coveredIds.has(eventKey);
            const selectedHost = selectedHosts[eventKey] || '';
            const assignedHostName = isCovered 
              ? users.find(u => u.principal.toText() === selectedHost)?.name 
              : null;
            
            return (
              <div key={eventKey} style={styles.card}>
                {/* Left: event info */}
                <div style={styles.cardLeft}>
                  <span style={styles.dateText}>
                    {formatDateInZone(nanosToDate(event.start_utc))}
                  </span>
                  <div style={styles.eventTitle}>{event.title}</div>
                  <div style={styles.eventTime}>
                    {formatTimeInZone(event.start_utc)} – {formatTimeInZone(event.end_utc)}
                    <span style={styles.tzLabel}>{abbrev}</span>
                  </div>
                </div>
                
                {/* Middle: notes (if any) */}
                {event.notes && (
                  <div style={styles.notesMid}>{event.notes}</div>
                )}
                
                {/* Right: badge + assign controls */}
                <div style={styles.cardRight}>
                  <span style={isCovered ? styles.coveredBadge : styles.needsHostBadge}>
                    {isCovered ? 'Covered' : 'Needs Host'}
                  </span>
                  {!isCovered && (
                    <div style={styles.assignRow}>
                      <select
                        style={styles.hostSelect}
                        value={selectedHost}
                        onChange={(e) => setSelectedHosts(prev => ({ ...prev, [eventKey]: e.target.value }))}
                        disabled={isAssigning}
                      >
                        <option value="">Select a host...</option>
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
                        {isAssigning ? '...' : 'Assign'}
                      </button>
                    </div>
                  )}
                  {isCovered && assignedHostName && (
                    <div style={styles.assignedHost}>
                      Assigned to {assignedHostName}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
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
    gap: '12px',
  },
  card: {
    background: theme.surface,
    borderRadius: '12px',
    padding: '12px 16px',
    border: `1px solid ${theme.border}`,
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  cardLeft: {
    flex: '0 0 auto',
    minWidth: '220px',
  },
  notesMid: {
    flex: '1 1 auto',
    fontSize: '13px',
    color: theme.textMuted,
    fontStyle: 'italic',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  cardRight: {
    flex: '0 0 auto',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginLeft: 'auto',
  },
  dateText: {
    fontSize: '12px',
    fontWeight: 500,
    color: theme.textMuted,
  },
  needsHostBadge: {
    background: 'rgba(248, 113, 113, 0.15)',
    color: '#F87171',
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 500,
  },
  coveredBadge: {
    background: 'rgba(52, 211, 153, 0.15)',
    color: '#34D399',
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 500,
  },
  eventTitle: {
    fontSize: '15px',
    fontWeight: 600,
    color: theme.textPrimary,
    lineHeight: 1.3,
  },
  eventTime: {
    fontSize: '13px',
    color: theme.textSecondary,
  },
  tzLabel: {
    marginLeft: '6px',
    fontSize: '11px',
    color: theme.textMuted,
  },
  assignRow: {
    display: 'flex',
    gap: '6px',
    alignItems: 'center',
  },
  hostSelect: {
    width: '160px',
    padding: '6px 10px',
    background: theme.inputSurface,
    color: theme.textPrimary,
    border: `1px solid ${theme.borderInput}`,
    borderRadius: '6px',
    fontSize: '13px',
    cursor: 'pointer',
  },
  assignBtn: {
    padding: '6px 12px',
    background: theme.accent,
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'opacity 150ms ease-out',
  },
  assignBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  assignedHost: {
    fontSize: '14px',
    color: '#34D399',
    fontWeight: 500,
    marginTop: '4px',
    textAlign: 'right',
  },
};
