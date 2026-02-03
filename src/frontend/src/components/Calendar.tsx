import { useState, useEffect, useMemo } from 'react';
import { useBackend, EventInstance, nanosToDate, dateToNanos, bytesToHex, User } from '../hooks/useBackend';
import { useAuth } from '../hooks/useAuth';
import { theme } from '../theme';

interface CalendarEvent extends EventInstance {
  dateKey: string;
}

export default function Calendar() {
  const { actor, loading: actorLoading } = useBackend();
  const { user } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [users, setUsers] = useState<Map<string, User>>(new Map());
  const [viewMode, setViewMode] = useState<'week' | 'month'>('month');
  const [currentDate, setCurrentDate] = useState(new Date());

  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const { windowStart, windowEnd } = useMemo(() => {
    const start = new Date(currentDate);
    const end = new Date(currentDate);
    
    if (viewMode === 'week') {
      start.setDate(start.getDate() - start.getDay());
      start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
    }
    
    return { windowStart: dateToNanos(start), windowEnd: dateToNanos(end) };
  }, [currentDate, viewMode]);

  useEffect(() => {
    if (!actor || actorLoading) return;
    async function fetchEvents() {
      setLoading(true);
      setError(null);
      try {
        const result = await actor.list_events(windowStart, windowEnd);
        if ('Ok' in result) {
          const eventList: CalendarEvent[] = result.Ok.map((e: EventInstance) => ({
            ...e,
            dateKey: nanosToDate(e.start_utc).toISOString().split('T')[0],
          }));
          eventList.sort((a, b) => Number(a.start_utc - b.start_utc));
          setEvents(eventList);
        } else {
          setError(getErrorMessage(result.Err));
        }
      } catch (err) {
        console.error('Failed to fetch events:', err);
        setError('Failed to load events');
      } finally {
        setLoading(false);
      }
    }
    fetchEvents();
  }, [actor, actorLoading, windowStart, windowEnd]);

  useEffect(() => {
    if (!actor || actorLoading) return;
    async function fetchUsers() {
      try {
        const result = await actor.list_users();
        if ('Ok' in result) {
          const userMap = new Map<string, User>();
          result.Ok.forEach((u: User) => userMap.set(u.principal.toText(), u));
          setUsers(userMap);
        }
      } catch (err) {
        console.error('Failed to fetch users:', err);
      }
    }
    fetchUsers();
  }, [actor, actorLoading]);

  const goBack = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') newDate.setDate(newDate.getDate() - 7);
    else newDate.setMonth(newDate.getMonth() - 1);
    setCurrentDate(newDate);
  };

  const goForward = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') newDate.setDate(newDate.getDate() + 7);
    else newDate.setMonth(newDate.getMonth() + 1);
    setCurrentDate(newDate);
  };

  const goToToday = () => setCurrentDate(new Date());

  const getHostName = (hostPrincipal: [any] | []): string => {
    if (hostPrincipal.length === 0) return 'No host';
    const userInfo = users.get(hostPrincipal[0].toText());
    return userInfo?.name || 'Unknown';
  };

  const formatDateHeader = (): string => {
    if (viewMode === 'week') {
      const start = new Date(currentDate);
      start.setDate(start.getDate() - start.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>();
    events.forEach(event => {
      const existing = grouped.get(event.dateKey) || [];
      existing.push(event);
      grouped.set(event.dateKey, existing);
    });
    return grouped;
  }, [events]);

  const calendarGrid = useMemo(() => {
    if (viewMode === 'week') {
      const dates: Date[] = [];
      const start = new Date(currentDate);
      start.setDate(start.getDate() - start.getDay());
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        dates.push(d);
      }
      return [dates];
    }
    
    const weeks: Date[][] = [];
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    let currentWeek: Date[] = [];
    const current = new Date(startDate);
    
    while (current <= lastDay || currentWeek.length > 0) {
      currentWeek.push(new Date(current));
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
        if (current > lastDay) break;
      }
      current.setDate(current.getDate() + 1);
    }
    
    return weeks;
  }, [currentDate, viewMode]);

  const refreshEvents = async () => {
    if (!actor) return;
    setLoading(true);
    try {
      const result = await actor.list_events(windowStart, windowEnd);
      if ('Ok' in result) {
        const eventList: CalendarEvent[] = result.Ok.map((e: EventInstance) => ({
          ...e,
          dateKey: nanosToDate(e.start_utc).toISOString().split('T')[0],
        }));
        eventList.sort((a, b) => Number(a.start_utc - b.start_utc));
        setEvents(eventList);
      }
    } finally {
      setLoading(false);
    }
  };

  if (actorLoading || loading) {
    return (
      <div style={styles.container}>
        <h2 style={styles.header}>Calendar</h2>
        <div style={styles.loading}>Loading events...</div>
      </div>
    );
  }

  const isCurrentMonth = (date: Date) => date.getMonth() === currentDate.getMonth();
  const todayKey = new Date().toISOString().split('T')[0];

  return (
    <div style={styles.container}>
      <div style={styles.headerRow}>
        <h2 style={styles.header}>Calendar</h2>
        <div style={styles.timezoneNote}>{userTimezone}</div>
        <div style={styles.viewToggle}>
          <button style={viewMode === 'week' ? styles.viewBtnActive : styles.viewBtn} onClick={() => setViewMode('week')}>Week</button>
          <button style={viewMode === 'month' ? styles.viewBtnActive : styles.viewBtn} onClick={() => setViewMode('month')}>Month</button>
        </div>
      </div>

      <div style={styles.navigation}>
        <button style={styles.navBtn} onClick={goBack}>Previous</button>
        <button style={styles.todayBtn} onClick={goToToday}>Today</button>
        <span style={styles.dateHeader}>{formatDateHeader()}</span>
        <button style={styles.navBtn} onClick={goForward}>Next</button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {viewMode === 'month' ? (
        <div style={styles.monthCalendar}>
          <div style={styles.weekHeader}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} style={styles.weekHeaderCell}>{day}</div>
            ))}
          </div>
          {calendarGrid.map((week, weekIdx) => (
            <div key={weekIdx} style={styles.weekRow}>
              {week.map(date => {
                const dateKey = date.toISOString().split('T')[0];
                const dayEvents = eventsByDate.get(dateKey) || [];
                const isToday = dateKey === todayKey;
                const inMonth = isCurrentMonth(date);
                
                return (
                  <div key={dateKey} style={{
                    ...styles.dayCell,
                    ...(isToday ? styles.todayCell : {}),
                    ...(!inMonth ? styles.outsideMonth : {}),
                  }}>
                    <div style={styles.dayCellHeader}>
                      <span style={isToday ? styles.dayNumberToday : styles.dayNumber}>{date.getDate()}</span>
                    </div>
                    <div style={styles.dayCellEvents}>
                      {dayEvents.slice(0, 4).map(event => {
                        const isNoHost = event.host_principal.length === 0;
                        const hostName = getHostName(event.host_principal);
                        return (
                          <div
                            key={bytesToHex(event.instance_id as number[])}
                            style={{
                              ...styles.monthEventCard,
                              ...(isNoHost ? styles.monthEventNoHost : styles.monthEventAssigned),
                            }}
                            onClick={() => setSelectedEvent(event)}
                          >
                            <div style={styles.monthEventTime}>
                              {nanosToDate(event.start_utc).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                            </div>
                            <div style={isNoHost ? styles.monthEventHostNoHost : styles.monthEventHost}>
                              {hostName}
                            </div>
                          </div>
                        );
                      })}
                      {dayEvents.length > 4 && (
                        <div style={styles.moreEvents}>+{dayEvents.length - 4} more</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ) : (
        <div style={styles.weekCalendar}>
          {calendarGrid[0].map(date => {
            const dateKey = date.toISOString().split('T')[0];
            const dayEvents = eventsByDate.get(dateKey) || [];
            const isToday = dateKey === todayKey;
            
            return (
              <div key={dateKey} style={{ ...styles.dayColumn, ...(isToday ? styles.today : {}) }}>
                <div style={styles.dayHeader}>
                  <span style={styles.dayName}>{date.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                  <span style={isToday ? styles.dayNumberTodayWeek : styles.dayNumberWeek}>{date.getDate()}</span>
                </div>
                <div style={styles.dayEvents}>
                  {dayEvents.length === 0 ? (
                    <div style={styles.noEvents}>—</div>
                  ) : (
                    dayEvents.map(event => (
                      <div
                        key={bytesToHex(event.instance_id as number[])}
                        style={{
                          ...styles.eventCard,
                          ...('Cancelled' in event.status ? styles.eventCancelled : {}),
                          ...(event.host_principal.length === 0 ? styles.eventNoHost : {}),
                        }}
                        onClick={() => setSelectedEvent(event)}
                      >
                        <div style={styles.eventTime}>
                          {nanosToDate(event.start_utc).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                        </div>
                        <div style={styles.eventTitle}>{event.title}</div>
                        <div style={event.host_principal.length === 0 ? styles.eventHostNoHost : styles.eventHost}>{getHostName(event.host_principal)}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          hostName={getHostName(selectedEvent.host_principal)}
          currentUser={user}
          actor={actor}
          users={users}
          onClose={() => setSelectedEvent(null)}
          onRefresh={() => { setSelectedEvent(null); refreshEvents(); }}
        />
      )}
    </div>
  );
}

interface EventDetailModalProps {
  event: CalendarEvent;
  hostName: string;
  currentUser: any;
  actor: any;
  users: Map<string, User>;
  onClose: () => void;
  onRefresh: () => void;
}

function EventDetailModal({ event, hostName, currentUser, actor, onClose, onRefresh }: EventDetailModalProps) {
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [icsLoading, setIcsLoading] = useState(false);

  const isHost = event.host_principal.length > 0 && currentUser?.principal?.toText() === event.host_principal[0]?.toText();
  const isNoHost = event.host_principal.length === 0;
  const isCancelled = 'Cancelled' in event.status;

  const handleAssignHost = async () => {
    if (!currentUser) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const result = await actor.assign_host(
        event.series_id.length > 0 ? [event.series_id[0]] : [],
        event.series_id.length > 0 ? [event.start_utc] : [],
        event.instance_id,
        currentUser.principal
      );
      if ('Ok' in result) onRefresh();
      else setActionError(getErrorMessage(result.Err));
    } catch (err) {
      setActionError('Failed to assign host');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveHost = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      const result = await actor.unassign_host(
        event.series_id.length > 0 ? [event.series_id[0]] : [],
        event.series_id.length > 0 ? [event.start_utc] : [],
        event.instance_id
      );
      if ('Ok' in result) onRefresh();
      else setActionError(getErrorMessage(result.Err));
    } catch (err) {
      setActionError('Failed to remove host');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadIcs = async () => {
    setIcsLoading(true);
    try {
      const result = await actor.get_event_ics(event.instance_id);
      if ('Ok' in result) {
        const blob = new Blob([result.Ok], { type: 'text/calendar' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${event.title.replace(/\s+/g, '_')}.ics`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        setActionError('Failed to generate calendar file');
      }
    } catch (err) {
      setActionError('Failed to download calendar file');
    } finally {
      setIcsLoading(false);
    }
  };

  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div style={modalStyles.modal} onClick={e => e.stopPropagation()}>
        <button style={modalStyles.closeBtn} onClick={onClose}>×</button>
        <h3 style={modalStyles.title}>{event.title}</h3>
        {isCancelled && <div style={modalStyles.cancelledBadge}>Cancelled</div>}
        <div style={modalStyles.detail}>
          <span style={modalStyles.detailLabel}>Date</span>
          <span style={modalStyles.detailValue}>{nanosToDate(event.start_utc).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
        <div style={modalStyles.detail}>
          <span style={modalStyles.detailLabel}>Time</span>
          <span style={modalStyles.detailValue}>
            {nanosToDate(event.start_utc).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
            {' – '}
            {nanosToDate(event.end_utc).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
          </span>
        </div>
        <div style={modalStyles.detail}>
          <span style={modalStyles.detailLabel}>Host</span>
          <span style={{ ...modalStyles.detailValue, color: isNoHost ? '#F87171' : theme.textPrimary }}>{hostName}</span>
        </div>
        {event.notes && (
          <div style={modalStyles.detail}>
            <span style={modalStyles.detailLabel}>Notes</span>
            <span style={modalStyles.detailValue}>{event.notes}</span>
          </div>
        )}
        {actionError && <div style={modalStyles.error}>{actionError}</div>}
        <div style={modalStyles.actions}>
          {!isCancelled && isNoHost && (
            <button style={modalStyles.primaryBtn} onClick={handleAssignHost} disabled={actionLoading}>
              {actionLoading ? 'Saving...' : 'Assign host'}
            </button>
          )}
          {!isCancelled && isHost && (
            <button style={modalStyles.secondaryBtn} onClick={handleRemoveHost} disabled={actionLoading}>
              {actionLoading ? 'Removing...' : 'Remove host'}
            </button>
          )}
          {!isCancelled && event.host_principal.length > 0 && (
            <button style={modalStyles.secondaryBtn} onClick={handleDownloadIcs} disabled={icsLoading}>
              {icsLoading ? 'Generating...' : 'Add to calendar'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function getErrorMessage(err: any): string {
  if ('Unauthorized' in err) return 'You are not authorized';
  if ('NotFound' in err) return 'Event not found';
  if ('InvalidInput' in err) return err.InvalidInput;
  if ('Conflict' in err) return err.Conflict;
  if ('InternalError' in err) return err.InternalError;
  return 'An error occurred';
}

const styles: { [key: string]: React.CSSProperties } = {
  container: { padding: 0 },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' },
  header: { margin: 0, color: theme.textPrimary, fontSize: '20px', fontWeight: 600 },
  timezoneNote: { fontSize: '12px', color: theme.textMuted, background: theme.surface, padding: '4px 10px', borderRadius: '4px', border: `1px solid ${theme.border}` },
  viewToggle: { display: 'flex', gap: '2px', background: theme.surface, padding: '2px', borderRadius: '8px', border: `1px solid ${theme.border}` },
  viewBtn: { padding: '8px 16px', border: 'none', background: 'transparent', color: theme.textMuted, borderRadius: '6px', cursor: 'pointer', fontSize: '14px', transition: 'all 150ms ease-out' },
  viewBtnActive: { padding: '8px 16px', border: 'none', background: theme.accent, color: '#fff', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' },
  navigation: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' },
  navBtn: { padding: '8px 16px', border: `1px solid ${theme.border}`, background: theme.surface, color: theme.textSecondary, borderRadius: '6px', cursor: 'pointer', fontSize: '14px', transition: 'all 150ms ease-out' },
  todayBtn: { padding: '8px 16px', border: `1px solid ${theme.accent}`, background: 'transparent', color: theme.accent, borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 },
  dateHeader: { fontSize: '18px', fontWeight: 600, flex: 1, textAlign: 'center', color: theme.textPrimary },
  loading: { background: theme.surface, padding: '40px', borderRadius: '12px', textAlign: 'center', color: theme.textMuted, border: `1px solid ${theme.border}` },
  error: { background: 'rgba(248, 113, 113, 0.1)', color: '#F87171', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', border: '1px solid rgba(248, 113, 113, 0.2)' },
  
  // Month view
  monthCalendar: { background: theme.surface, borderRadius: '12px', overflow: 'hidden', border: `1px solid ${theme.border}` },
  weekHeader: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: theme.surfaceElevated, borderBottom: `1px solid ${theme.border}` },
  weekHeaderCell: { padding: '12px 8px', textAlign: 'center', fontSize: '11px', fontWeight: 600, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' },
  weekRow: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: `1px solid ${theme.border}` },
  dayCell: { minHeight: '120px', padding: '8px', borderRight: `1px solid ${theme.border}`, background: theme.surface },
  todayCell: { background: theme.surfaceElevated },
  outsideMonth: { background: theme.bg, opacity: 0.5 },
  dayCellHeader: { marginBottom: '8px' },
  dayNumber: { fontSize: '14px', fontWeight: 500, color: theme.textSecondary },
  dayNumberToday: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', fontSize: '14px', fontWeight: 600, color: '#fff', background: theme.accent, borderRadius: '50%' },
  dayCellEvents: { display: 'flex', flexDirection: 'column', gap: '4px' },
  
  monthEventCard: { padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', borderLeft: '3px solid' },
  monthEventAssigned: { background: 'rgba(99, 102, 241, 0.15)', borderLeftColor: theme.accent },
  monthEventNoHost: { background: 'rgba(248, 113, 113, 0.15)', borderLeftColor: '#F87171' },
  monthEventTime: { fontSize: '11px', fontWeight: 600, color: theme.textSecondary, marginBottom: '2px' },
  monthEventHost: { fontSize: '12px', fontWeight: 500, color: theme.accent },
  monthEventHostNoHost: { fontSize: '12px', fontWeight: 500, color: '#F87171' },
  moreEvents: { fontSize: '11px', color: theme.textMuted, padding: '4px 8px' },

  // Week view
  weekCalendar: { display: 'flex', gap: '8px', background: theme.surface, borderRadius: '12px', padding: '16px', border: `1px solid ${theme.border}` },
  dayColumn: { flex: 1, minWidth: '140px', background: theme.bg, borderRadius: '8px', padding: '12px' },
  today: { background: theme.surfaceElevated, border: `1px solid ${theme.accent}` },
  dayHeader: { textAlign: 'center', marginBottom: '12px', paddingBottom: '8px', borderBottom: `1px solid ${theme.border}` },
  dayName: { display: 'block', fontSize: '11px', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' },
  dayNumberWeek: { display: 'block', fontSize: '20px', fontWeight: 600, color: theme.textSecondary, marginTop: '4px' },
  dayNumberTodayWeek: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', fontSize: '16px', fontWeight: 600, color: '#fff', background: theme.accent, borderRadius: '50%', marginTop: '4px' },
  dayEvents: { display: 'flex', flexDirection: 'column', gap: '8px' },
  noEvents: { textAlign: 'center', color: theme.textMuted, padding: '8px', fontSize: '14px' },
  eventCard: { background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: '8px', padding: '10px 12px', cursor: 'pointer', borderLeft: `4px solid ${theme.accent}` },
  eventNoHost: { borderLeftColor: '#F87171', background: 'rgba(248, 113, 113, 0.08)' },
  eventCancelled: { opacity: 0.5, borderLeftColor: theme.textMuted, textDecoration: 'line-through' },
  eventTime: { fontSize: '13px', color: theme.textMuted, marginBottom: '4px', fontWeight: 500 },
  eventTitle: { fontSize: '14px', fontWeight: 600, color: theme.textPrimary, marginBottom: '4px' },
  eventHost: { fontSize: '13px', color: theme.accent, fontWeight: 500 },
  eventHostNoHost: { fontSize: '13px', color: '#F87171', fontWeight: 500 },
};

const modalStyles: { [key: string]: React.CSSProperties } = {
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: `rgba(18, 24, 38, 0.95)`, borderRadius: '16px', padding: '24px', maxWidth: '420px', width: '90%', position: 'relative', maxHeight: '90vh', overflowY: 'auto', border: `1px solid ${theme.border}` },
  closeBtn: { position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: theme.textMuted, padding: '4px 8px', lineHeight: 1 },
  title: { margin: '0 0 20px 0', fontSize: '18px', fontWeight: 600, color: theme.textPrimary, paddingRight: '24px' },
  cancelledBadge: { display: 'inline-block', background: 'rgba(248, 113, 113, 0.15)', color: '#F87171', padding: '4px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 500, marginBottom: '16px' },
  detail: { marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '4px' },
  detailLabel: { fontSize: '12px', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' },
  detailValue: { fontSize: '15px', color: theme.textPrimary },
  error: { background: 'rgba(248, 113, 113, 0.1)', color: '#F87171', padding: '10px 12px', borderRadius: '8px', marginTop: '16px', fontSize: '14px', border: '1px solid rgba(248, 113, 113, 0.2)' },
  actions: { marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '10px' },
  primaryBtn: { padding: '12px 20px', background: theme.accent, color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500, transition: 'background 150ms ease-out' },
  secondaryBtn: { padding: '12px 20px', background: 'transparent', color: theme.textSecondary, border: `1px solid ${theme.border}`, borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500, transition: 'all 150ms ease-out' },
};
