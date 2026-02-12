import { useState, useEffect, useRef } from 'react';
import { useBackend, EventInstance, nanosToDate, bytesToHex, User, isSessionExpiredError } from '../hooks/useBackend';
import { useAuth } from '../hooks/useAuth';
import { theme } from '../theme';

interface InAppNotification {
  id: string;
  type: 'assigned' | 'unassigned' | 'upcoming' | 'unclaimed';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  eventId?: string;
}

export default function NotificationBell() {
  const { actor, loading: actorLoading, triggerSessionExpired } = useBackend();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) setIsOpen(false);
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen]);

  // Generate notifications based on events
  useEffect(() => {
    if (!actor || actorLoading || !user) return;

    async function generateNotifications() {
      setLoading(true);
      try {
        const now = new Date();
        const windowStart = BigInt(now.getTime()) * BigInt(1_000_000);
        const futureDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days ahead
        const windowEnd = BigInt(futureDate.getTime()) * BigInt(1_000_000);

        // Fetch upcoming events
        const eventsResult = await actor.list_events(windowStart, windowEnd);
        const unclaimedResult = await actor.list_unclaimed_events();

        const newNotifications: InAppNotification[] = [];

        if ('Ok' in eventsResult) {
          const events = eventsResult.Ok as EventInstance[];
          const userPrincipal = user?.principal?.toText();
          const myEvents = events.filter(e => {
            if (e.host_principal.length === 0 || !userPrincipal) return false;
            return e.host_principal[0].toText() === userPrincipal;
          });

          // Add notifications for upcoming events where user is host
          myEvents.forEach(event => {
            const eventDate = nanosToDate(event.start_utc);
            const hoursUntil = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60);
            
            if (hoursUntil > 0 && hoursUntil <= 24) {
              newNotifications.push({
                id: `upcoming-${bytesToHex(event.instance_id as number[])}`,
                type: 'upcoming',
                title: 'Upcoming Session',
                message: `"${event.title}" starts in ${Math.round(hoursUntil)} hour${Math.round(hoursUntil) !== 1 ? 's' : ''}`,
                timestamp: new Date(),
                read: false,
                eventId: bytesToHex(event.instance_id as number[]),
              });
            }
          });
        }

        // Add notifications for unclaimed events (if user has preference)
        if ('Ok' in unclaimedResult && user?.notification_settings?.email_unclaimed_reminder) {
          const unclaimed = unclaimedResult.Ok as EventInstance[];
          const soonUnclaimed = unclaimed.slice(0, 3); // Show first 3

          soonUnclaimed.forEach(event => {
            const eventDate = nanosToDate(event.start_utc);
            newNotifications.push({
              id: `unclaimed-${bytesToHex(event.instance_id as number[])}`,
              type: 'unclaimed',
              title: 'Coverage Needed',
              message: `"${event.title}" on ${eventDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} needs a host`,
              timestamp: new Date(),
              read: false,
              eventId: bytesToHex(event.instance_id as number[]),
            });
          });
        }

        setNotifications(newNotifications);
      } catch (err) {
        if (isSessionExpiredError(err)) {
          triggerSessionExpired();
        }
        console.error('Failed to fetch notifications:', err);
      } finally {
        setLoading(false);
      }
    }

    generateNotifications();
    // Refresh every 5 minutes
    const interval = setInterval(generateNotifications, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [actor, actorLoading, user]);

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => 
      n.id === id ? { ...n, read: true } : n
    ));
  };

  const getNotificationIcon = (type: InAppNotification['type']) => {
    switch (type) {
      case 'assigned': return '✓';
      case 'unassigned': return '−';
      case 'upcoming': return '⏰';
      case 'unclaimed': return '!';
      default: return '•';
    }
  };

  const getNotificationColor = (type: InAppNotification['type']) => {
    switch (type) {
      case 'assigned': return theme.accent;
      case 'unassigned': return theme.textMuted;
      case 'upcoming': return '#FB923C';
      case 'unclaimed': return '#F87171';
      default: return theme.textSecondary;
    }
  };

  return (
    <div style={styles.container} ref={dropdownRef}>
      <button 
        style={styles.bellButton} 
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span style={styles.badge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div style={styles.dropdown}>
          <div style={styles.dropdownHeader}>
            <span style={styles.dropdownTitle}>Notifications</span>
            {unreadCount > 0 && (
              <button style={styles.markReadBtn} onClick={markAllRead}>
                Mark all read
              </button>
            )}
          </div>
          
          <div style={styles.notificationList}>
            {loading ? (
              <div style={styles.emptyState}>Loading...</div>
            ) : notifications.length === 0 ? (
              <div style={styles.emptyState}>No notifications</div>
            ) : (
              notifications.map(notification => (
                <div
                  key={notification.id}
                  style={{
                    ...styles.notificationItem,
                    ...(notification.read ? styles.notificationRead : {}),
                  }}
                  onClick={() => markAsRead(notification.id)}
                >
                  <div 
                    style={{
                      ...styles.notificationIcon,
                      color: getNotificationColor(notification.type),
                      background: `${getNotificationColor(notification.type)}20`,
                    }}
                  >
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div style={styles.notificationContent}>
                    <div style={styles.notificationTitle}>{notification.title}</div>
                    <div style={styles.notificationMessage}>{notification.message}</div>
                  </div>
                  {!notification.read && <div style={styles.unreadDot} />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    position: 'relative',
  },
  bellButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    background: 'transparent',
    border: `1px solid ${theme.border}`,
    borderRadius: '8px',
    cursor: 'pointer',
    color: theme.textSecondary,
    position: 'relative',
    transition: 'all 150ms ease-out',
  },
  badge: {
    position: 'absolute',
    top: '-4px',
    right: '-4px',
    minWidth: '18px',
    height: '18px',
    background: '#F87171',
    color: '#fff',
    fontSize: '11px',
    fontWeight: 600,
    borderRadius: '9px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 4px',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: '8px',
    width: '320px',
    background: theme.surface,
    borderRadius: '12px',
    border: `1px solid ${theme.border}`,
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
    zIndex: 200,
    overflow: 'hidden',
  },
  dropdownHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: `1px solid ${theme.border}`,
  },
  dropdownTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: theme.textPrimary,
  },
  markReadBtn: {
    background: 'transparent',
    border: 'none',
    color: theme.accent,
    fontSize: '12px',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '4px',
    transition: 'background 150ms ease-out',
  },
  notificationList: {
    maxHeight: '320px',
    overflowY: 'auto',
  },
  emptyState: {
    padding: '32px 16px',
    textAlign: 'center',
    color: theme.textMuted,
    fontSize: '14px',
  },
  notificationItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '12px 16px',
    cursor: 'pointer',
    borderBottom: `1px solid ${theme.border}`,
    transition: 'background 150ms ease-out',
    position: 'relative',
  },
  notificationRead: {
    opacity: 0.6,
  },
  notificationIcon: {
    width: '28px',
    height: '28px',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: 600,
    flexShrink: 0,
  },
  notificationContent: {
    flex: 1,
    minWidth: 0,
  },
  notificationTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: theme.textPrimary,
    marginBottom: '2px',
  },
  notificationMessage: {
    fontSize: '12px',
    color: theme.textSecondary,
    lineHeight: 1.4,
  },
  unreadDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: theme.accent,
    flexShrink: 0,
    marginTop: '4px',
  },
};
