import { useState, useEffect } from 'react';
import { useBackend, UserDirectoryEntry, CoverageStats, EventInstance, dateToNanos, isSessionExpiredError } from '../hooks/useBackend';
import { theme } from '../theme';

export default function CoverageReport() {
  const { actor, loading: actorLoading, triggerSessionExpired } = useBackend();
  const [events, setEvents] = useState<EventInstance[]>([]);
  const [users, setUsers] = useState<UserDirectoryEntry[]>([]);
  const [coverageHistory, setCoverageHistory] = useState<CoverageStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!actor || actorLoading) return;
    async function fetchData() {
      setLoading(true);
      try {
        const now = new Date();
        const start = dateToNanos(now);
        const end = dateToNanos(new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000));
        const [eventsResult, usersResult, historyResult] = await Promise.all([
          actor.list_events(start, end),
          actor.list_user_directory(),
          actor.get_coverage_history(6),
        ]);
        if ('Ok' in eventsResult) setEvents(eventsResult.Ok);
        if ('Ok' in usersResult) setUsers(usersResult.Ok);
        if ('Ok' in historyResult) setCoverageHistory(historyResult.Ok);
      } catch (err) {
        if (isSessionExpiredError(err)) {
          triggerSessionExpired();
          setError('Your session has expired. Please sign in again.');
        } else {
          console.error('Failed to fetch report data:', err);
        }
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [actor, actorLoading]);

  if (actorLoading || loading) return <div style={styles.loading}>Loading report data...</div>;
  if (error) return <div style={styles.error}>{error}</div>;

  // Filter out events excluded from coverage
  const coveredEvents = events.filter(e => !e.exclude_from_coverage);
  const totalEvents = coveredEvents.length;
  const assignedEvents = coveredEvents.filter(e => e.host_principal.length > 0).length;
  const needsHostEvents = totalEvents - assignedEvents;
  const coverageRate = totalEvents > 0 ? Math.round((assignedEvents / totalEvents) * 100) : 0;

  const hostCounts: Record<string, { name: string; count: number }> = {};
  // Initialize all active users with 0 count
  users.filter(u => 'Active' in u.status).forEach(u => {
    hostCounts[u.principal.toText()] = { name: u.name, count: 0 };
  });
  coveredEvents.forEach(e => {
    if (e.host_principal.length > 0) {
      const principal = e.host_principal[0]!.toText();
      if (!hostCounts[principal]) {
        const user = users.find(u => u.principal.toText() === principal);
        hostCounts[principal] = { name: user?.name || 'Unknown', count: 0 };
      }
      hostCounts[principal].count++;
    }
  });
  const sortedHosts = Object.values(hostCounts).sort((a, b) => b.count - a.count);
  const maxCount = sortedHosts.length > 0 ? Math.max(sortedHosts[0].count, 1) : 1;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h3 style={styles.sectionTitle}>Coverage Reports</h3>
          <p style={{ ...styles.reportSubtitle, marginBottom: 0 }}>Next 60 days</p>
        </div>
        <button style={styles.exportBtn} onClick={async () => {
          if (!actor) return;
          try {
            const now = new Date();
            const start = dateToNanos(now);
            const end = dateToNanos(new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000));
            const result = await actor.export_events_csv(start, end);
            if ('Ok' in result) {
              const blob = new Blob([result.Ok], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `office-hours-export-${now.toISOString().split('T')[0]}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }
          } catch (err) { console.error('CSV export failed', err); }
        }}>Export CSV</button>
      </div>
      <div style={styles.statsGrid}>
        <div style={styles.statCard}><div style={styles.statValue}>{totalEvents}</div><div style={styles.statLabel}>Total Sessions</div></div>
        <div style={styles.statCard}><div style={{ ...styles.statValue, color: theme.accent }}>{assignedEvents}</div><div style={styles.statLabel}>Assigned</div></div>
        <div style={styles.statCard}><div style={{ ...styles.statValue, color: '#F87171' }}>{needsHostEvents}</div><div style={styles.statLabel}>Needs Host</div></div>
        <div style={styles.statCard}><div style={styles.statValue}>{coverageRate}%</div><div style={styles.statLabel}>Coverage Rate</div></div>
      </div>
      <h4 style={styles.reportSectionTitle}>Host Distribution</h4>
      {sortedHosts.length === 0 ? <p style={styles.noData}>No hosting data yet.</p> : (
        <div style={styles.hostList}>
          {sortedHosts.map(host => (
            <div key={host.name} style={styles.hostRow}>
              <span style={styles.hostName}>{host.name}</span>
              <div style={styles.hostBar}><div style={{ ...styles.hostBarFill, width: `${(host.count / maxCount) * 100}%` }} /></div>
              <span style={styles.hostCount}>{host.count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Historical Coverage */}
      {coverageHistory.length > 0 && (
        <>
          <h4 style={{ ...styles.reportSectionTitle, marginTop: '32px' }}>Coverage History</h4>
          <p style={styles.reportSubtitle}>Monthly coverage rate (last 6 months)</p>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', height: '160px', marginBottom: '24px' }}>
            {coverageHistory.map((m, i) => {
              const rate = m.total_sessions > 0 ? Math.round((m.assigned / m.total_sessions) * 100) : 0;
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: theme.textPrimary }}>{rate}%</span>
                  <div style={{ width: '100%', background: theme.surfaceElevated, borderRadius: '6px', height: '120px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', bottom: 0, width: '100%', height: `${rate}%`, background: rate >= 80 ? theme.accent : rate >= 50 ? '#FBBF24' : '#F87171', borderRadius: '6px', transition: 'height 0.5s ease' }} />
                  </div>
                  <span style={{ fontSize: '11px', color: theme.textMuted }}>{m.period_label}</span>
                  <span style={{ fontSize: '10px', color: theme.textMuted }}>{m.assigned}/{m.total_sessions}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  loading: { color: theme.textMuted, textAlign: 'center', padding: '40px 0' },
  error: { color: '#F87171', textAlign: 'center', padding: '40px 0' },
  sectionTitle: { fontSize: '20px', fontWeight: 600, margin: 0, color: theme.textPrimary },
  exportBtn: {
    padding: '8px 16px',
    background: theme.accent,
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
    transition: 'background 150ms ease-out',
  },
  reportSubtitle: { color: theme.textMuted, marginTop: '4px', marginBottom: '16px', fontSize: '14px' },
  reportSectionTitle: { marginTop: '32px', marginBottom: '16px', fontSize: '16px', color: theme.textPrimary, fontWeight: 600 },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' },
  statCard: { background: theme.surfaceElevated, borderRadius: '10px', padding: '20px', textAlign: 'center' as const, border: `1px solid ${theme.border}` },
  statValue: { fontSize: '32px', fontWeight: 700, color: theme.textPrimary },
  statLabel: { fontSize: '13px', color: theme.textMuted, marginTop: '4px' },
  noData: { color: theme.textMuted, fontStyle: 'italic' },
  hostList: { display: 'flex', flexDirection: 'column' as const, gap: '12px' },
  hostRow: { display: 'flex', alignItems: 'center', gap: '16px' },
  hostName: { width: '120px', fontSize: '14px', fontWeight: 500, color: theme.textPrimary },
  hostBar: { flex: 1, height: '24px', background: theme.bg, borderRadius: '4px', overflow: 'hidden' },
  hostBarFill: { height: '100%', background: theme.accent, borderRadius: '4px', transition: 'width 0.3s' },
  hostCount: { width: '40px', textAlign: 'right' as const, fontSize: '14px', fontWeight: 600, color: theme.textPrimary },
};
