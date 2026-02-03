import { useState, useEffect } from 'react';
import { useBackend, EventInstance, User, nanosToDate, bytesToHex } from '../hooks/useBackend';
import { useAuth } from '../hooks/useAuth';
import { Principal } from '@dfinity/principal';
import { theme } from '../theme';

export default function CoverageQueue() {
  const { actor, loading: actorLoading } = useBackend();
  const { user, isAdmin } = useAuth();
  const [events, setEvents] = useState<EventInstance[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  const fetchEvents = async () => {
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
      console.error('Failed to fetch unclaimed events:', err);
      setError('Failed to load coverage queue');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    if (!actor) return;
    try {
      const result = await actor.list_users();
      if ('Ok' in result) {
        const activeUsers = result.Ok.filter((u: User) => 'Active' in u.status);
        setUsers(activeUsers);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  };

  useEffect(() => {
    if (!actor || actorLoading) return;
    fetchEvents();
    fetchUsers();
  }, [actor, actorLoading]);

  const handleAssignSelf = async (event: EventInstance) => {
    if (!actor || !user) return;
    const eventKey = bytesToHex(event.instance_id as number[]);
    setAssigningId(eventKey);
    setError(null);
    try {
      const result = await actor.assign_host(
        event.series_id.length > 0 ? [event.series_id[0]] : [],
        event.series_id.length > 0 ? [event.start_utc] : [],
        event.instance_id,
        user.principal
      );
      if ('Ok' in result) {
        setEvents(prev => prev.filter(e => bytesToHex(e.instance_id as number[]) !== eventKey));
      } else {
        setError(getErrorMessage(result.Err));
      }
    } catch (err) {
      console.error('Assignment failed:', err);
      setError('Failed to assign host');
    } finally {
      setAssigningId(null);
    }
  };

  const handleAssignUser = async (event: EventInstance, assigneePrincipal: string) => {
    if (!actor || !isAdmin) return;
    const eventKey = bytesToHex(event.instance_id as number[]);
    setAssigningId(eventKey);
    setError(null);
    try {
      const result = await actor.assign_host(
        event.series_id.length > 0 ? [event.series_id[0]] : [],
        event.series_id.length > 0 ? [event.start_utc] : [],
        event.instance_id,
        Principal.fromText(assigneePrincipal)
      );
      if ('Ok' in result) {
        setEvents(prev => prev.filter(e => bytesToHex(e.instance_id as number[]) !== eventKey));
      } else {
        setError(getErrorMessage(result.Err));
      }
    } catch (err) {
      console.error('Assignment failed:', err);
      setError('Failed to assign host');
    } finally {
      setAssigningId(null);
    }
  };

  const groupedEvents = events.reduce((acc, event) => {
    const dateKey = nanosToDate(event.start_utc).toISOString().split('T')[0];
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(event);
    return acc;
  }, {} as Record<string, EventInstance[]>);

  if (actorLoading || loading) {
    return (
      <div>
        <h2 style={styles.header}>Coverage Queue</h2>
        <div style={styles.loading}>Loading sessions...</div>
      </div>
    );
  }

  return (
    <div>
      <div style={styles.headerRow}>
        <h2 style={styles.header}>Coverage Queue</h2>
        <button style={styles.refreshBtn} onClick={fetchEvents} disabled={loading}>
          Refresh
        </button>
      </div>
      
      <p style={styles.subtitle}>Sessions that need a host assigned.</p>

      {error && <div style={styles.error}>{error}</div>}

      {events.length === 0 ? (
        <div style={styles.emptyState}>
          <h3 style={styles.emptyTitle}>All Covered</h3>
          <p style={styles.emptyText}>No sessions need hosts right now.</p>
        </div>
      ) : (
        <div style={styles.queueList}>
          {Object.entries(groupedEvents).map(([dateKey, dateEvents]) => (
            <div key={dateKey} style={styles.dateGroup}>
              <div style={styles.dateHeader}>
                <span>{new Date(dateKey + 'T00:00:00').toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}</span>
                <span style={styles.eventCount}>{dateEvents.length} needs host</span>
              </div>
              
              {dateEvents.map(event => {
                const eventKey = bytesToHex(event.instance_id as number[]);
                const isAssigning = assigningId === eventKey;
                
                return (
                  <div key={eventKey} style={styles.eventCard}>
                    <div style={styles.eventInfo}>
                      <div style={styles.eventTime}>
                        {nanosToDate(event.start_utc).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true,
                        })}
                        {' – '}
                        {nanosToDate(event.end_utc).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true,
                        })}
                      </div>
                      <div style={styles.eventTitle}>{event.title}</div>
                      {event.notes && <div style={styles.eventNotes}>{event.notes}</div>}
                    </div>
                    
                    <div style={styles.eventActions}>
                      <button
                        style={styles.assignBtn}
                        onClick={() => handleAssignSelf(event)}
                        disabled={isAssigning}
                      >
                        {isAssigning ? 'Saving...' : 'Assign myself'}
                      </button>
                      
                      {isAdmin && (
                        <select
                          style={styles.assignSelect}
                          onChange={(e) => {
                            if (e.target.value) handleAssignUser(event, e.target.value);
                          }}
                          disabled={isAssigning}
                          defaultValue=""
                        >
                          <option value="" disabled>Assign to...</option>
                          {users.map(u => (
                            <option key={u.principal.toText()} value={u.principal.toText()}>
                              {u.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
      
      <div style={styles.statsBar}>
        {events.length} session{events.length !== 1 ? 's' : ''} need coverage
      </div>
    </div>
  );
}

function getErrorMessage(err: any): string {
  if ('Unauthorized' in err) return 'You are not authorized to perform this action';
  if ('NotFound' in err) return 'Event not found';
  if ('InvalidInput' in err) return err.InvalidInput;
  if ('Conflict' in err) return err.Conflict;
  if ('InternalError' in err) return err.InternalError;
  return 'An error occurred';
}

const styles: { [key: string]: React.CSSProperties } = {
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  header: {
    margin: 0,
    color: theme.textPrimary,
    fontSize: '20px',
    fontWeight: 600,
  },
  refreshBtn: {
    padding: '8px 16px',
    background: theme.surface,
    color: theme.textSecondary,
    border: `1px solid ${theme.border}`,
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 150ms ease-out',
  },
  subtitle: {
    color: theme.textMuted,
    marginBottom: '20px',
    fontSize: '14px',
  },
  loading: {
    background: theme.surface,
    padding: '40px',
    borderRadius: '12px',
    textAlign: 'center',
    color: theme.textMuted,
    border: `1px solid ${theme.border}`,
  },
  error: {
    background: 'rgba(248, 113, 113, 0.1)',
    color: '#F87171',
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '16px',
    border: '1px solid rgba(248, 113, 113, 0.2)',
    fontSize: '14px',
  },
  emptyState: {
    background: theme.surface,
    padding: '60px 40px',
    borderRadius: '12px',
    textAlign: 'center',
    border: `1px solid ${theme.border}`,
  },
  emptyTitle: {
    color: theme.textPrimary,
    margin: '0 0 8px 0',
    fontSize: '18px',
    fontWeight: 600,
  },
  emptyText: {
    color: theme.textMuted,
    margin: 0,
    fontSize: '14px',
  },
  queueList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  dateGroup: {
    background: theme.surface,
    borderRadius: '12px',
    overflow: 'hidden',
    border: `1px solid ${theme.border}`,
  },
  dateHeader: {
    background: theme.surfaceElevated,
    padding: '12px 16px',
    fontWeight: 500,
    fontSize: '14px',
    color: theme.textPrimary,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: `1px solid ${theme.border}`,
  },
  eventCount: {
    background: 'rgba(248, 113, 113, 0.15)',
    color: '#F87171',
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 500,
  },
  eventCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '18px 16px',
    borderBottom: `1px solid ${theme.border}`,
    gap: '16px',
    background: theme.inputSurface,
  },
  eventInfo: {
    flex: 1,
  },
  eventTime: {
    fontSize: '14px',
    fontWeight: 500,
    color: theme.accent,
    marginBottom: '4px',
  },
  eventTitle: {
    fontSize: '15px',
    fontWeight: 500,
    color: theme.textPrimary,
  },
  eventNotes: {
    fontSize: '13px',
    color: theme.textMuted,
    marginTop: '4px',
  },
  eventActions: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    flexShrink: 0,
  },
  assignBtn: {
    padding: '10px 20px',
    background: theme.accent,
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    transition: 'background 150ms ease-out',
  },
  assignSelect: {
    padding: '12px 14px',
    border: `1px solid ${theme.borderInput}`,
    borderRadius: '8px',
    fontSize: '14px',
    background: theme.inputSurface,
    color: theme.textPrimary,
    cursor: 'pointer',
    minWidth: '130px',
  },
  statsBar: {
    marginTop: '24px',
    padding: '12px 16px',
    background: theme.surface,
    borderRadius: '8px',
    color: theme.textMuted,
    fontSize: '14px',
    textAlign: 'center',
    border: `1px solid ${theme.border}`,
  },
};
