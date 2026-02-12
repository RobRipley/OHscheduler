import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Actor, HttpAgent } from '@dfinity/agent';
import { useAuth } from '../hooks/useAuth';
import { TIMEZONE_LIST, getTimezoneAbbrev } from '../hooks/useTimezone';
import { getSeriesColor, NO_HOST_COLOR } from '../utils/seriesColors';
import { Modal, Button, SkeletonCalendar } from './ui';
import { theme } from '../theme';

const BACKEND_CANISTER_ID = import.meta.env.VITE_BACKEND_CANISTER_ID || 'uxrrr-q7777-77774-qaaaq-cai';

const publicIdlFactory = ({ IDL }: { IDL: any }) => {
  const PublicEventView = IDL.Record({
    'instance_id': IDL.Vec(IDL.Nat8),
    'start_utc': IDL.Nat64,
    'end_utc': IDL.Nat64,
    'title': IDL.Text,
    'notes': IDL.Text,
    'link': IDL.Opt(IDL.Text),
    'host_name': IDL.Opt(IDL.Text),
    'status': IDL.Variant({ 'Active': IDL.Null, 'Cancelled': IDL.Null }),
  });
  const GlobalSettings = IDL.Record({
    'forward_window_months': IDL.Nat8,
    'claims_paused': IDL.Bool,
    'default_event_duration_minutes': IDL.Nat32,
    'org_name': IDL.Opt(IDL.Text),
    'org_tagline': IDL.Opt(IDL.Text),
    'org_logo_url': IDL.Opt(IDL.Text),
  });
  return IDL.Service({
    'list_events_public': IDL.Func([IDL.Nat64, IDL.Nat64], [IDL.Vec(PublicEventView)], ['query']),
    'get_org_settings': IDL.Func([], [GlobalSettings], ['query']),
  });
};

interface PublicEvent {
  instance_id: number[];
  start_utc: bigint;
  end_utc: bigint;
  title: string;
  notes: string;
  link: [string] | [];
  host_name: [string] | [];
  status: { Active: null } | { Cancelled: null };
}

export default function PublicCalendar() {
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [orgName, setOrgName] = useState('Office Hours');
  const [orgTagline, setOrgTagline] = useState('');
  const [orgLogoUrl, setOrgLogoUrl] = useState('/yieldschool_inc_logo.jpeg');
  const { isAuthenticated, isAuthorized, login } = useAuth();
  const navigate = useNavigate();

  // Timezone state — defaults to browser timezone
  const [timezone, setTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [showTzSelector, setShowTzSelector] = useState(false);
  const [tzSearch, setTzSearch] = useState('');
  const tzRef = useRef<HTMLDivElement>(null);

  const abbrev = getTimezoneAbbrev(timezone);

  const filteredTimezones = useMemo(() => {
    const search = tzSearch.toLowerCase().trim();
    if (!search) return TIMEZONE_LIST;
    return TIMEZONE_LIST.filter(t => {
      const labelLower = t.label.toLowerCase();
      const tzLower = t.tz.toLowerCase().replace(/_/g, ' ');
      const aliasMatch = t.aliases.some(a => a.includes(search));
      return labelLower.includes(search) || tzLower.includes(search) || aliasMatch;
    });
  }, [tzSearch]);

  // Close tz dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tzRef.current && !tzRef.current.contains(e.target as Node)) {
        setShowTzSelector(false);
        setTzSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Timezone-aware helpers
  const getDateKeyInTz = (nanos: bigint) => {
    const d = new Date(Number(nanos / BigInt(1_000_000)));
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).formatToParts(d);
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    return `${year}-${month}-${day}`;
  };

  const formatTime = (nanos: bigint) => {
    return new Date(Number(nanos / BigInt(1_000_000))).toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true,
      timeZone: timezone,
    });
  };

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
        
        // Fetch org settings for branding
        try {
          const settings = await actor.get_org_settings() as any;
          if (settings.org_name?.[0]) setOrgName(settings.org_name[0]);
          if (settings.org_tagline?.[0]) setOrgTagline(settings.org_tagline[0]);
          if (settings.org_logo_url?.[0]) setOrgLogoUrl(settings.org_logo_url[0]);
        } catch { /* keep defaults */ }
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
      const dateKey = getDateKeyInTz(event.start_utc);
      const existing = grouped.get(dateKey) || [];
      existing.push(event);
      grouped.set(dateKey, existing);
    });
    return grouped;
  }, [events, timezone]);

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

  const todayKey = getDateKeyInTz(BigInt(Date.now()) * BigInt(1_000_000));
  const isCurrentMonth = (date: Date) => date.getMonth() === currentMonth.getMonth();
  const [selectedEvent, setSelectedEvent] = useState<PublicEvent | null>(null);

  // Compute stats for the month
  const monthStats = useMemo(() => {
    const active = events.filter(e => 'Active' in e.status);
    const needsHost = active.filter(e => e.host_name.length === 0);
    return { total: active.length, needsHost: needsHost.length };
  }, [events]);

  // Find next upcoming session (from now forward)
  const nextSession = useMemo(() => {
    const now = BigInt(Date.now()) * BigInt(1_000_000);
    const upcoming = events
      .filter(e => 'Active' in e.status && e.start_utc > now)
      .sort((a, b) => (a.start_utc < b.start_utc ? -1 : 1));
    return upcoming.length > 0 ? upcoming[0] : null;
  }, [events]);

  return (
    <div style={styles.container}>
      <main style={styles.main}>
        <div style={styles.headerRow}>
          <div style={styles.titleGroup}>
            <img src={orgLogoUrl} alt={orgName} style={styles.logo} />
            <div style={styles.titleText}>
              <span style={styles.title}>{orgName}</span>
              {orgTagline && <span style={styles.subtitle}>{orgTagline}</span>}
            </div>
          </div>
          <div style={styles.headerControls}>
            <div style={styles.tzWrapper} ref={tzRef}>
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
                  <input
                    type="text"
                    placeholder="Search (e.g. PST, London, GMT+5)..."
                    value={tzSearch}
                    onChange={(e) => setTzSearch(e.target.value)}
                    style={styles.tzSearchInput}
                    autoFocus
                  />
                  <div style={styles.tzList}>
                    {filteredTimezones.map(t => (
                      <button
                        key={t.tz}
                        style={{
                          ...styles.tzOption,
                          ...(t.tz === timezone ? styles.tzOptionActive : {}),
                        }}
                        onClick={() => { setTimezone(t.tz); setShowTzSelector(false); setTzSearch(''); }}
                      >
                        <span>{t.label}</span>
                        <span style={styles.tzAbbrev}>{getTimezoneAbbrev(t.tz)}</span>
                      </button>
                    ))}
                    {filteredTimezones.length === 0 && (
                      <div style={styles.tzNoResults}>No timezones found</div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <button onClick={handleSignIn} style={styles.loginButton}>
              {isAuthenticated && isAuthorized ? 'Dashboard' : 'Sign In'}
            </button>
          </div>
        </div>

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
          <SkeletonCalendar />
        ) : (
          <>
            {/* Event count summary */}
            <div style={styles.monthSummary}>
              <span>{monthStats.total} session{monthStats.total !== 1 ? 's' : ''} this month</span>
              {monthStats.needsHost > 0 && (
                <span style={styles.needsHostSummary}> · {monthStats.needsHost} need{monthStats.needsHost !== 1 ? '' : 's'} host</span>
              )}
            </div>

            {/* Next upcoming session banner */}
            {nextSession && (
              <div style={styles.nextSessionBanner} onClick={() => setSelectedEvent(nextSession)}>
                <div style={styles.nextSessionLabel}>Next Session</div>
                <div style={styles.nextSessionInfo}>
                  <strong>{nextSession.title}</strong>
                  <span style={styles.nextSessionTime}>
                    {new Date(Number(nextSession.start_utc / BigInt(1_000_000))).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: timezone })}
                    {' · '}
                    {formatTime(nextSession.start_utc)} {abbrev}
                  </span>
                  {nextSession.host_name.length > 0 && (
                    <span style={styles.nextSessionHost}>with {nextSession.host_name[0]}</span>
                  )}
                </div>
                <span style={styles.nextSessionArrow}>→</span>
              </div>
            )}

          <div style={styles.calendar} className="public-calendar-grid">
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
                          const color = isNoHost ? NO_HOST_COLOR : getSeriesColor(event.title);
                          return (
                            <div key={idx} style={{
                              ...styles.eventCard,
                              background: color.bg,
                              borderLeftColor: color.border,
                              cursor: 'pointer',
                            }} onClick={() => setSelectedEvent(event)} className="event-card-hover">
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

          {/* Mobile agenda view */}
          <div className="public-calendar-agenda" style={styles.agendaList}>
            {(() => {
              const allEvents = events
                .filter(e => 'Active' in e.status)
                .sort((a, b) => (a.start_utc < b.start_utc ? -1 : 1));
              if (allEvents.length === 0) return <div style={styles.agendaEmpty}>No events this month</div>;
              let lastDate = '';
              return allEvents.map((event, idx) => {
                const dateStr = new Date(Number(event.start_utc / BigInt(1_000_000))).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: timezone });
                const showDate = dateStr !== lastDate;
                lastDate = dateStr;
                const isNoHost = event.host_name.length === 0;
                const color = isNoHost ? NO_HOST_COLOR : getSeriesColor(event.title);
                return (
                  <div key={idx}>
                    {showDate && <div style={styles.agendaDate}>{dateStr}</div>}
                    <div style={{ ...styles.agendaItem, borderLeftColor: color.border }} onClick={() => setSelectedEvent(event)}>
                      <div style={styles.agendaTime}>{formatTime(event.start_utc)}</div>
                      <div style={{ flex: 1 }}>
                        <div style={styles.agendaTitle}>{event.title}</div>
                        <div style={{ fontSize: '12px', color: isNoHost ? '#F87171' : theme.accent }}>
                          {isNoHost ? 'No host' : event.host_name[0]}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
          </>
        )}

        {/* Event Detail Modal (read-only for public) */}
        {selectedEvent && (
          <Modal open={true} onClose={() => setSelectedEvent(null)} title={selectedEvent.title} maxWidth="420px">
            <div style={pubModalStyles.detail}>
              <span style={pubModalStyles.label}>DATE</span>
              <span style={pubModalStyles.value}>{new Date(Number(selectedEvent.start_utc / BigInt(1_000_000))).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: timezone })}</span>
            </div>
            <div style={pubModalStyles.detail}>
              <span style={pubModalStyles.label}>TIME</span>
              <span style={pubModalStyles.value}>
                {formatTime(selectedEvent.start_utc)} – {formatTime(selectedEvent.end_utc)} {abbrev}
              </span>
            </div>
            <div style={pubModalStyles.detail}>
              <span style={pubModalStyles.label}>HOST</span>
              <span style={{ ...pubModalStyles.value, color: selectedEvent.host_name.length === 0 ? '#F87171' : theme.textPrimary }}>
                {selectedEvent.host_name.length > 0 ? selectedEvent.host_name[0] : 'No host assigned'}
              </span>
            </div>
            {selectedEvent.notes && (
              <div style={pubModalStyles.detail}>
                <span style={pubModalStyles.label}>NOTES</span>
                <span style={pubModalStyles.value}>{selectedEvent.notes}</span>
              </div>
            )}
            {selectedEvent.link && selectedEvent.link.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <a
                  href={selectedEvent.link[0]}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={pubModalStyles.meetingLink}
                >
                  Join Meeting →
                </a>
              </div>
            )}
          </Modal>
        )}

        {!loading && events.length === 0 && (
          <div style={styles.empty}>
            <p style={styles.emptyText}>No office hours scheduled for this month.</p>
            <p style={styles.emptyHint}>Check back later or sign in to view more details.</p>
          </div>
        )}
      </main>
    </div>
  );
}


const styles: { [key: string]: React.CSSProperties } = {
  container: { minHeight: '100vh', display: 'flex', flexDirection: 'column', background: theme.bg },
  main: { flex: 1, maxWidth: '1100px', margin: '0 auto', padding: '24px 20px', width: '100%' },
  
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  titleGroup: { display: 'flex', alignItems: 'center', gap: '12px' },
  logo: { width: '40px', height: '40px', borderRadius: theme.radiusSm, objectFit: 'cover' as const },
  titleText: { display: 'flex', flexDirection: 'column' as const },
  title: { fontSize: '20px', fontWeight: 600, color: theme.textPrimary, lineHeight: 1.2 },
  subtitle: { fontSize: '13px', color: theme.textMuted, lineHeight: 1.3 },
  headerControls: { display: 'flex', alignItems: 'center', gap: '12px' },
  loginButton: { padding: '8px 16px', color: '#fff', background: theme.accent, border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 },
  
  // Timezone selector
  tzWrapper: { position: 'relative' },
  tzButton: { padding: '6px 12px', background: theme.surface, color: theme.textSecondary, border: `1px solid ${theme.border}`, borderRadius: '6px', cursor: 'pointer', fontSize: '13px' },
  tzDropdown: { position: 'absolute', top: '100%', right: 0, marginTop: '6px', background: theme.surfaceElevated, border: `1px solid ${theme.border}`, borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 200, minWidth: '260px', display: 'flex', flexDirection: 'column' },
  tzDropdownHeader: { padding: '10px 12px 8px', fontSize: '11px', fontWeight: 600, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: `1px solid ${theme.border}` },
  tzSearchInput: { margin: '8px', padding: '6px 10px', background: theme.inputSurface, color: theme.textPrimary, border: `1px solid ${theme.borderInput}`, borderRadius: '6px', fontSize: '13px', outline: 'none' },
  tzList: { maxHeight: '280px', overflowY: 'auto' },
  tzOption: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '10px 12px', background: 'transparent', border: 'none', color: theme.textSecondary, fontSize: '13px', cursor: 'pointer', textAlign: 'left' },
  tzOptionActive: { background: theme.accentFocus, color: theme.textPrimary },
  tzAbbrev: { color: theme.textMuted, fontSize: '11px' },
  tzNoResults: { padding: '12px', textAlign: 'center', fontSize: '13px', color: theme.textMuted },
  
  monthNav: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' },
  navButton: { padding: '8px 16px', background: theme.surface, color: theme.textSecondary, border: `1px solid ${theme.border}`, borderRadius: '8px', cursor: 'pointer', fontSize: '14px' },
  monthTitle: { fontSize: '18px', fontWeight: 600, margin: 0, color: theme.textPrimary },
  loading: { textAlign: 'center', padding: '60px 20px', color: theme.textMuted, background: theme.surface, borderRadius: '12px', border: `1px solid ${theme.border}` },
  empty: { textAlign: 'center', padding: '60px 20px', background: theme.surface, borderRadius: '12px', marginTop: '20px', border: `1px solid ${theme.border}` },
  emptyText: { color: theme.textSecondary, margin: 0, fontSize: '15px' },
  emptyHint: { color: theme.textMuted, fontSize: '13px', marginTop: '8px' },
  
  calendar: { background: theme.surface, borderRadius: '12px', overflow: 'hidden', border: `1px solid ${theme.border}` },
  weekHeader: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: theme.surfaceElevated, borderBottom: `1px solid ${theme.border}` },
  weekHeaderCell: { padding: '12px 8px', textAlign: 'center', fontSize: '11px', fontWeight: 600, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' },
  weekRow: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: `1px solid ${theme.border}` },
  dayCell: { minHeight: '140px', padding: '8px', borderRight: `1px solid ${theme.border}`, background: theme.surface },
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

  // Month summary
  monthSummary: { fontSize: '13px', color: theme.textMuted, marginBottom: '12px' },
  needsHostSummary: { color: '#F87171' },

  // Next session banner
  nextSessionBanner: { display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 18px', background: `linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(99, 102, 241, 0.06))`, border: `1px solid rgba(99, 102, 241, 0.25)`, borderRadius: '10px', marginBottom: '16px', cursor: 'pointer', transition: 'border-color 0.15s' },
  nextSessionLabel: { fontSize: '10px', fontWeight: 700, color: theme.accent, textTransform: 'uppercase' as const, letterSpacing: '0.08em', whiteSpace: 'nowrap' as const, background: 'rgba(99, 102, 241, 0.15)', padding: '4px 8px', borderRadius: '4px' },
  nextSessionInfo: { flex: 1, display: 'flex', flexWrap: 'wrap' as const, alignItems: 'center', gap: '6px 12px', fontSize: '14px', color: theme.textPrimary },
  nextSessionTime: { fontSize: '13px', color: theme.textSecondary },
  nextSessionHost: { fontSize: '13px', color: theme.accent },
  nextSessionArrow: { fontSize: '18px', color: theme.textMuted },

  // Mobile agenda
  agendaList: { background: theme.surface, borderRadius: '12px', border: `1px solid ${theme.border}`, padding: '8px 0', overflow: 'hidden' },
  agendaDate: { fontSize: '12px', fontWeight: 700, color: theme.textMuted, textTransform: 'uppercase' as const, letterSpacing: '0.06em', padding: '12px 16px 4px' },
  agendaItem: { display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', borderLeft: '3px solid transparent', cursor: 'pointer' },
  agendaTime: { fontSize: '13px', fontWeight: 600, color: theme.textSecondary, minWidth: '70px' },
  agendaTitle: { fontSize: '14px', fontWeight: 600, color: theme.textPrimary },
  agendaEmpty: { padding: '24px 16px', textAlign: 'center' as const, color: theme.textMuted, fontSize: '14px' },
};

const pubModalStyles: { [key: string]: React.CSSProperties } = {
  detail: { display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '16px' },
  label: { fontSize: '10px', fontWeight: 600, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' },
  value: { fontSize: '15px', color: theme.textPrimary },
  meetingLink: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 20px', background: theme.accent, color: '#fff', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: 600, transition: 'filter 0.15s' },
};
