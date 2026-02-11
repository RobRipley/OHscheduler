import { useState, useEffect, useCallback, useMemo } from 'react';
import { useBackend, EventInstance, User, nanosToDate, bytesToHex, isSessionExpiredError } from '../hooks/useBackend';
import { useAuth } from '../hooks/useAuth';
import { useTimezone } from '../hooks/useTimezone';
import { Principal } from '@dfinity/principal';
import { Select, Button, SkeletonCard } from './ui';
import type { SelectOption } from './ui';
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
  const [fadingIds, setFadingIds] = useState<Set<string>>(new Set()); // Track events fading out
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
        // Mark as covered, start fade-out after delay
        setCoveredIds(prev => new Set(prev).add(eventKey));
        setTimeout(() => {
          setFadingIds(prev => new Set(prev).add(eventKey));
        }, 1500);
        setTimeout(() => {
          setEvents(prev => prev.filter(e => bytesToHex(e.instance_id as number[]) !== eventKey));
          setCoveredIds(prev => { const next = new Set(prev); next.delete(eventKey); return next; });
          setFadingIds(prev => { const next = new Set(prev); next.delete(eventKey); return next; });
        }, 2500);
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

  // One-click self-assign
  const handleClaim = async (event: EventInstance) => {
    if (!actor || !user) return;
    const eventKey = bytesToHex(event.instance_id as number[]);
    setAssigningId(eventKey);
    try {
      const seriesId = event.series_id;
      const occurrenceStart = (seriesId && seriesId.length > 0) ? [event.start_utc] : [];
      const result = await actor.assign_host(seriesId, occurrenceStart, event.instance_id, user.principal);
      if ('Ok' in result) {
        showToast(`Claimed by you!`);
        setCoveredIds(prev => new Set(prev).add(eventKey));
        setSelectedHosts(prev => ({ ...prev, [eventKey]: user.principal.toText() }));
        setTimeout(() => { setFadingIds(prev => new Set(prev).add(eventKey)); }, 1500);
        setTimeout(() => {
          setEvents(prev => prev.filter(e => bytesToHex(e.instance_id as number[]) !== eventKey));
          setCoveredIds(prev => { const next = new Set(prev); next.delete(eventKey); return next; });
          setFadingIds(prev => { const next = new Set(prev); next.delete(eventKey); return next; });
        }, 2500);
      } else {
        showToast(getErrorMessage(result.Err), 'error');
      }
    } catch (err) {
      if (isSessionExpiredError(err)) { triggerSessionExpired(); showToast('Session expired.', 'error'); }
      else { showToast('Failed to claim', 'error'); }
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

  // Group events by time period
  const groupedEvents = useMemo(() => {
    const now = new Date();
    const endOfWeek = new Date(now);
    endOfWeek.setDate(now.getDate() + (7 - now.getDay()));
    endOfWeek.setHours(23, 59, 59, 999);
    const endOfNextWeek = new Date(endOfWeek);
    endOfNextWeek.setDate(endOfNextWeek.getDate() + 7);

    const groups: { label: string; events: EventInstance[] }[] = [
      { label: 'This Week', events: [] },
      { label: 'Next Week', events: [] },
      { label: 'Later', events: [] },
    ];

    events.forEach(event => {
      const eventDate = nanosToDate(event.start_utc);
      if (eventDate <= endOfWeek) groups[0].events.push(event);
      else if (eventDate <= endOfNextWeek) groups[1].events.push(event);
      else groups[2].events.push(event);
    });

    return groups.filter(g => g.events.length > 0);
  }, [events]);

  if (actorLoading || loading) {
    return (
      <div style={styles.container}>
        <h2 style={styles.title}>Coverage Queue</h2>
        <p style={styles.subtitle}>Sessions that need a host assigned</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
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
          {groupedEvents.map(group => (
            <div key={group.label}>
              <div style={styles.groupLabel}>{group.label}</div>
              {group.events.map(event => {
            const eventKey = bytesToHex(event.instance_id as number[]);
            const isAssigning = assigningId === eventKey;
            const isCovered = coveredIds.has(eventKey);
            const isFading = fadingIds.has(eventKey);
            const selectedHost = selectedHosts[eventKey] || '';
            const assignedHostName = isCovered 
              ? users.find(u => u.principal.toText() === selectedHost)?.name 
              : null;
            
            return (
              <div key={eventKey} style={{
                ...styles.card,
                ...(isFading ? styles.cardFading : {}),
                ...(isCovered ? styles.cardCovered : {}),
              }}>
                {/* Row 1: Event info + badge */}
                <div style={styles.cardRow1}>
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
                  {event.notes && (
                    <div style={styles.notesMid}>{event.notes}</div>
                  )}
                  <span style={isCovered ? styles.coveredBadge : styles.needsHostBadge}>
                    {isCovered ? 'Covered' : 'Needs Host'}
                  </span>
                </div>

                {/* Row 2: Action row */}
                {!isCovered && (
                  <div style={styles.cardRow2}>
                    {user && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleClaim(event)}
                        loading={isAssigning && !selectedHost}
                        disabled={isAssigning}
                      >
                        Claim
                      </Button>
                    )}
                    <div style={styles.assignRow}>
                      <Select
                        options={(() => {
                          const opts: SelectOption[] = [];
                          if (user) {
                            opts.push({ value: user.principal.toText(), label: `${user.name} (Me)` });
                          }
                          users
                            .filter(u => !user || u.principal.toText() !== user.principal.toText())
                            .forEach(u => {
                              opts.push({ value: u.principal.toText(), label: u.name });
                            });
                          return opts;
                        })()}
                        value={selectedHost}
                        onChange={(val) => setSelectedHosts(prev => ({ ...prev, [eventKey]: val }))}
                        placeholder="Select a host..."
                        searchable={users.length > 5}
                        disabled={isAssigning}
                        style={{ flex: 1, minWidth: '160px' }}
                      />
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleAssign(event)}
                        loading={isAssigning && !!selectedHost}
                        disabled={!selectedHost}
                      >
                        Assign
                      </Button>
                    </div>
                  </div>
                )}
                {isCovered && assignedHostName && (
                  <div style={styles.assignedHost}>
                    ✓ Assigned to {assignedHostName}
                  </div>
                )}
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
    gap: '12px',
  },
  card: {
    background: theme.surface,
    borderRadius: '12px',
    padding: '14px 16px',
    border: `1px solid ${theme.border}`,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
    transition: 'opacity 0.8s ease-out, transform 0.8s ease-out',
  },
  cardCovered: {
    borderColor: 'rgba(52, 211, 153, 0.3)',
  },
  cardFading: {
    opacity: 0,
    transform: 'translateX(40px)',
  },
  cardRow1: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  cardRow2: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    paddingTop: '4px',
    borderTop: `1px solid ${theme.border}`,
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
    padding: '4px 0',
  },
  groupLabel: {
    fontSize: '11px',
    fontWeight: 700,
    color: theme.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    padding: '16px 0 8px 0',
  },
};
