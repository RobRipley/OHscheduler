import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Actor, HttpAgent } from '@dfinity/agent';
import { useAuth } from '../hooks/useAuth';
import { theme } from '../theme';

const BACKEND_CANISTER_ID = import.meta.env.VITE_BACKEND_CANISTER_ID || 'uxrrr-q7777-77774-qaaaq-cai';

const publicIdlFactory = ({ IDL }: { IDL: any }) => {
  const PublicEventView = IDL.Record({
    'instance_id': IDL.Vec(IDL.Nat8),
    'start_utc': IDL.Nat64,
    'end_utc': IDL.Nat64,
    'title': IDL.Text,
    'notes': IDL.Text,
    'host_name': IDL.Opt(IDL.Text),
    'status': IDL.Variant({ 'Active': IDL.Null, 'Cancelled': IDL.Null }),
  });
  return IDL.Service({
    'list_events_public': IDL.Func([IDL.Nat64, IDL.Nat64], [IDL.Vec(PublicEventView)], ['query']),
  });
};

interface PublicEvent {
  instance_id: number[];
  start_utc: bigint;
  end_utc: bigint;
  title: string;
  notes: string;
  host_name: [string] | [];
  status: { Active: null } | { Cancelled: null };
}

export default function PublicCalendar() {
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { isAuthenticated, isAuthorized, login } = useAuth();
  const navigate = useNavigate();

  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Redirect to dashboard after successful login
  useEffect(() => {
    if (isAuthenticated && isAuthorized) {
      navigate('/dashboard');
    } else if (isAuthenticated && !isAuthorized) {
      navigate('/not-authorized');
    }
  }, [isAuthenticated, isAuthorized, navigate]);

  useEffect(() => {
    async function fetchEvents() {
      setLoading(true);
      try {
        const network = import.meta.env.VITE_DFX_NETWORK || 'local';
        const host = network === 'ic' ? 'https://icp-api.io' : 'http://localhost:4943';
        const agent = new HttpAgent({ host });
        if (network !== 'ic') {
          await agent.fetchRootKey();
        }
        
        const actor = Actor.createActor(publicIdlFactory, { agent, canisterId: BACKEND_CANISTER_ID });
        
        const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59, 999);
        
        const startNanos = BigInt(start.getTime()) * BigInt(1_000_000);
        const endNanos = BigInt(end.getTime()) * BigInt(1_000_000);
        
        const result = await actor.list_events_public(startNanos, endNanos) as PublicEvent[];
        setEvents(result);
      } catch (err) {
        console.error('Failed to fetch events:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchEvents();
  }, [currentMonth]);

  const handleSignIn = async () => {
    if (isAuthenticated && isAuthorized) {
      navigate('/dashboard');
      return;
    }
    if (isAuthenticated && !isAuthorized) {
      navigate('/not-authorized');
      return;
    }
    await login();
  };

  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, PublicEvent[]>();
    events.forEach(event => {
      const dateKey = new Date(Number(event.start_utc / BigInt(1_000_000))).toISOString().split('T')[0];
      const existing = grouped.get(dateKey) || [];
      existing.push(event);
      grouped.set(dateKey, existing);
    });
    return grouped;
  }, [events]);

  const calendarGrid = useMemo(() => {
    const weeks: Date[][] = [];
    const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    
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
  }, [currentMonth]);

  const formatTime = (nanos: bigint) => {
    return new Date(Number(nanos / BigInt(1_000_000))).toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const todayKey = new Date().toISOString().split('T')[0];
  const isCurrentMonth = (date: Date) => date.getMonth() === currentMonth.getMonth();

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <h1 style={styles.title}>Office Hours</h1>
          <p style={styles.subtitle}>Public Calendar</p>
          <div style={styles.headerMeta}>
            <span style={styles.timezone}>{userTimezone}</span>
            <button onClick={handleSignIn} style={styles.loginButton}>
              {isAuthenticated && isAuthorized ? 'Go to Dashboard' : 'Sign In'}
            </button>
          </div>
        </div>
      </header>
      
      <main style={styles.main}>
        <div style={styles.monthNav}>
          <button 
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
            style={styles.navButton}
          >
            Previous
          </button>
          <h2 style={styles.monthTitle}>
            {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h2>
          <button 
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
            style={styles.navButton}
          >
            Next
          </button>
        </div>

        {loading ? (
          <div style={styles.loading}>Loading events...</div>
        ) : (
          <div style={styles.calendar}>
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
                        <span style={isToday ? styles.dayNumberToday : styles.dayNumber}>
                          {date.getDate()}
                        </span>
                      </div>
                      <div style={styles.dayCellEvents}>
                        {dayEvents.filter(e => 'Active' in e.status).slice(0, 4).map((event, idx) => {
                          const isNoHost = event.host_name.length === 0;
                          const hostName = isNoHost ? 'No host' : event.host_name[0];
                          return (
                            <div key={idx} style={{
                              ...styles.eventCard,
                              ...(isNoHost ? styles.eventNoHost : styles.eventAssigned),
                            }}>
                              <div style={styles.eventTitle}>{event.title}</div>
                              <div style={styles.eventTime}>{formatTime(event.start_utc)}</div>
                              <div style={isNoHost ? styles.eventHostNoHost : styles.eventHost}>
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
        )}

        {!loading && events.length === 0 && (
          <div style={styles.empty}>
            <p style={styles.emptyText}>No office hours scheduled for this month.</p>
            <p style={styles.emptyHint}>Check back later or sign in to view more details.</p>
          </div>
        )}
      </main>
      
      <footer style={styles.footer}>
        <p>Powered by Internet Computer</p>
      </footer>
    </div>
  );
}


const styles: { [key: string]: React.CSSProperties } = {
  container: { minHeight: '100vh', display: 'flex', flexDirection: 'column', background: theme.bg },
  header: { background: theme.surface, borderBottom: `1px solid ${theme.border}`, padding: '40px 20px' },
  headerContent: { maxWidth: '1100px', margin: '0 auto', textAlign: 'center' },
  title: { fontSize: '28px', fontWeight: 600, margin: 0, color: theme.textPrimary },
  subtitle: { color: theme.textMuted, marginTop: '8px', fontSize: '14px' },
  headerMeta: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '20px', flexWrap: 'wrap' },
  timezone: { fontSize: '12px', color: theme.textMuted, background: theme.bg, padding: '6px 12px', borderRadius: '6px', border: `1px solid ${theme.border}` },
  loginButton: { padding: '10px 20px', color: '#fff', background: theme.accent, border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500, transition: 'background 150ms ease-out' },
  main: { flex: 1, maxWidth: '1100px', margin: '0 auto', padding: '24px 20px', width: '100%' },
  monthNav: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' },
  navButton: { padding: '10px 20px', background: theme.surface, color: theme.textSecondary, border: `1px solid ${theme.border}`, borderRadius: '8px', cursor: 'pointer', fontSize: '14px', transition: 'all 150ms ease-out' },
  monthTitle: { fontSize: '20px', fontWeight: 600, margin: 0, color: theme.textPrimary },
  loading: { textAlign: 'center', padding: '60px 20px', color: theme.textMuted, background: theme.surface, borderRadius: '12px', border: `1px solid ${theme.border}` },
  empty: { textAlign: 'center', padding: '60px 20px', background: theme.surface, borderRadius: '12px', marginTop: '20px', border: `1px solid ${theme.border}` },
  emptyText: { color: theme.textSecondary, margin: 0, fontSize: '15px' },
  emptyHint: { color: theme.textMuted, fontSize: '13px', marginTop: '8px' },
  
  // Calendar
  calendar: { background: theme.surface, borderRadius: '12px', overflow: 'hidden', border: `1px solid ${theme.border}` },
  weekHeader: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: theme.surfaceElevated, borderBottom: `1px solid ${theme.border}` },
  weekHeaderCell: { padding: '12px 8px', textAlign: 'center', fontSize: '11px', fontWeight: 600, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' },
  weekRow: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: `1px solid ${theme.border}` },
  dayCell: { minHeight: '220px', padding: '8px', borderRight: `1px solid ${theme.border}`, background: theme.surface },
  todayCell: { background: theme.surfaceElevated },
  outsideMonth: { background: theme.bg, opacity: 0.5 },
  dayCellHeader: { marginBottom: '8px' },
  dayNumber: { fontSize: '14px', fontWeight: 500, color: theme.textSecondary },
  dayNumberToday: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', fontSize: '14px', fontWeight: 600, color: '#fff', background: theme.accent, borderRadius: '50%' },
  dayCellEvents: { display: 'flex', flexDirection: 'column', gap: '4px' },
  
  eventCard: { padding: '6px 8px', borderRadius: '6px', borderLeft: '3px solid' },
  eventAssigned: { background: 'rgba(99, 102, 241, 0.15)', borderLeftColor: theme.accent },
  eventNoHost: { background: 'rgba(248, 113, 113, 0.15)', borderLeftColor: '#F87171' },
  eventTitle: { fontSize: '12px', fontWeight: 600, color: theme.textPrimary, marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  eventTime: { fontSize: '11px', fontWeight: 500, color: theme.textSecondary, marginBottom: '1px' },
  eventHost: { fontSize: '11px', fontWeight: 500, color: theme.accent },
  eventHostNoHost: { fontSize: '11px', fontWeight: 500, color: '#F87171' },
  moreEvents: { fontSize: '11px', color: theme.textMuted, padding: '4px 8px' },
  
  footer: { textAlign: 'center', padding: '20px', color: theme.textMuted, fontSize: '13px', borderTop: `1px solid ${theme.border}` },
};
