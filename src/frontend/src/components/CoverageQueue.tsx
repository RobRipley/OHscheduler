import { useState, useEffect, useRef, useCallback } from 'react';
import { useBackend, EventInstance, User, nanosToDate, bytesToHex, isSessionExpiredError } from '../hooks/useBackend';
import { useAuth } from '../hooks/useAuth';
import { useTimezone } from '../hooks/useTimezone';
import { Principal } from '@dfinity/principal';
import { theme } from '../theme';

// ==================== TYPES ====================

interface AssignPopoverState {
  eventKey: string;
  selectedPrincipal: string | null;
  searchQuery: string;
  highlightedIndex: number;
}

interface NotesEditorState {
  eventKey: string;
  value: string;
  saving: boolean;
  saved: boolean;
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error';
}

// ==================== MAIN COMPONENT ====================

export default function CoverageQueue() {
  const { actor, loading: actorLoading, triggerSessionExpired } = useBackend();
  const { user, isAdmin } = useAuth();
  const { timezone, abbrev } = useTimezone();
  
  // Core state
  const [events, setEvents] = useState<EventInstance[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // UI state
  const [assignPopover, setAssignPopover] = useState<AssignPopoverState | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [notesEditor, setNotesEditor] = useState<NotesEditorState | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  // Refs
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ==================== DATA FETCHING ====================

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
      if (isSessionExpiredError(err)) {
        triggerSessionExpired();
        setError('Your session has expired. Please sign in again.');
      } else {
        console.error('Failed to fetch unclaimed events:', err);
        setError('Failed to load coverage queue');
      }
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
      if (isSessionExpiredError(err)) {
        triggerSessionExpired();
      } else {
        console.error('Failed to fetch users:', err);
      }
    }
  };

  useEffect(() => {
    if (!actor || actorLoading) return;
    fetchEvents();
    fetchUsers();
  }, [actor, actorLoading]);

  // ==================== TOAST MANAGEMENT ====================

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = Math.random().toString(36).substring(2);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  // ==================== ASSIGNMENT LOGIC ====================

  const openAssignPopover = (event: EventInstance) => {
    const eventKey = bytesToHex(event.instance_id as number[]);
    setAssignPopover({
      eventKey,
      selectedPrincipal: null,
      searchQuery: '',
      highlightedIndex: 0,
    });
    // Focus search input after render
    setTimeout(() => searchInputRef.current?.focus(), 50);
  };

  const closeAssignPopover = () => {
    setAssignPopover(null);
  };

  const handleAssign = async (event: EventInstance, assigneePrincipal: string) => {
    if (!actor) return;
    
    const eventKey = bytesToHex(event.instance_id as number[]);
    const assignee = users.find(u => u.principal.toText() === assigneePrincipal);
    const assigneeName = assignee?.name || 'User';
    
    setAssigningId(eventKey);
    closeAssignPopover();
    
    // Optimistic: start removal animation
    setRemovingIds(prev => new Set(prev).add(eventKey));
    
    try {
      const result = await actor.assign_host(
        event.series_id.length > 0 ? [event.series_id[0]] : [],
        event.series_id.length > 0 ? [event.start_utc] : [],
        event.instance_id,
        Principal.fromText(assigneePrincipal)
      );
      
      if ('Ok' in result) {
        // Wait for animation, then remove
        setTimeout(() => {
          setEvents(prev => prev.filter(e => bytesToHex(e.instance_id as number[]) !== eventKey));
          setRemovingIds(prev => {
            const next = new Set(prev);
            next.delete(eventKey);
            return next;
          });
        }, 200);
        showToast(`Assigned to ${assigneeName}`);
      } else {
        // Rollback
        setRemovingIds(prev => {
          const next = new Set(prev);
          next.delete(eventKey);
          return next;
        });
        setError(getErrorMessage(result.Err));
      }
    } catch (err) {
      // Rollback
      setRemovingIds(prev => {
        const next = new Set(prev);
        next.delete(eventKey);
        return next;
      });
      if (isSessionExpiredError(err)) {
        triggerSessionExpired();
        setError('Your session has expired. Please sign in again.');
      } else {
        console.error('Assignment failed:', err);
        showToast('Failed to assign host', 'error');
      }
    } finally {
      setAssigningId(null);
    }
  };

  // ==================== NOTES LOGIC ====================

  const openNotesEditor = (event: EventInstance) => {
    const eventKey = bytesToHex(event.instance_id as number[]);
    setNotesEditor({
      eventKey,
      value: event.notes || '',
      saving: false,
      saved: false,
    });
  };

  const closeNotesEditor = () => {
    setNotesEditor(null);
  };

  const saveNotes = async (event: EventInstance, notes: string) => {
    // TODO: Implement backend call for updating notes on single occurrence
    // For now, just update local state and show saved feedback
    setNotesEditor(prev => prev ? { ...prev, saving: true } : null);
    
    // Simulate save delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Update local event
    setEvents(prev => prev.map(e => {
      if (bytesToHex(e.instance_id as number[]) === bytesToHex(event.instance_id as number[])) {
        return { ...e, notes };
      }
      return e;
    }));
    
    setNotesEditor(prev => prev ? { ...prev, saving: false, saved: true } : null);
    setTimeout(() => {
      setNotesEditor(prev => prev ? { ...prev, saved: false } : null);
    }, 2000);
  };

  // ==================== KEYBOARD & CLICK OUTSIDE ====================

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        closeAssignPopover();
      }
    };
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!assignPopover) return;
      
      const filteredUsers = getFilteredUsers();
      
      if (e.key === 'Escape') {
        closeAssignPopover();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setAssignPopover(prev => prev ? {
          ...prev,
          highlightedIndex: Math.min(prev.highlightedIndex + 1, filteredUsers.length - 1),
        } : null);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setAssignPopover(prev => prev ? {
          ...prev,
          highlightedIndex: Math.max(prev.highlightedIndex - 1, 0),
        } : null);
      } else if (e.key === 'Enter' && assignPopover.highlightedIndex >= 0) {
        e.preventDefault();
        const selectedUser = filteredUsers[assignPopover.highlightedIndex];
        if (selectedUser) {
          setAssignPopover(prev => prev ? {
            ...prev,
            selectedPrincipal: selectedUser.principal.toText(),
          } : null);
        }
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [assignPopover]);

  // ==================== HELPERS ====================

  const getFilteredUsers = useCallback(() => {
    if (!assignPopover) return [];
    const query = assignPopover.searchQuery.toLowerCase();
    
    // Sort users: current user first, then alphabetically
    const sorted = [...users].sort((a, b) => {
      const aIsMe = user && a.principal.toText() === user.principal.toText();
      const bIsMe = user && b.principal.toText() === user.principal.toText();
      if (aIsMe && !bIsMe) return -1;
      if (!aIsMe && bIsMe) return 1;
      return a.name.localeCompare(b.name);
    });
    
    if (!query) return sorted;
    return sorted.filter(u => u.name.toLowerCase().includes(query));
  }, [assignPopover, users, user]);

  const formatTimeInZone = (nanos: bigint): string => {
    const date = nanosToDate(nanos);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone,
    });
  };

  const formatDateInZone = (dateStr: string): string => {
    // dateStr is ISO date like "2026-02-05"
    const date = new Date(dateStr + 'T12:00:00Z');
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      timeZone: timezone,
    });
  };

  // ==================== GROUPED EVENTS ====================

  const groupedEvents = events.reduce((acc, event) => {
    const date = nanosToDate(event.start_utc);
    // Format in display timezone
    const dateKey = date.toLocaleDateString('en-CA', { timeZone: timezone }); // YYYY-MM-DD format
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(event);
    return acc;
  }, {} as Record<string, EventInstance[]>);

  // ==================== RENDER ====================

  if (actorLoading || loading) {
    return (
      <div>
        <h2 style={styles.header}>Coverage Queue</h2>
        <div style={styles.loading}>Loading sessions...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Toasts */}
      <div style={styles.toastContainer}>
        {toasts.map(toast => (
          <div 
            key={toast.id} 
            style={{
              ...styles.toast,
              ...(toast.type === 'error' ? styles.toastError : {}),
            }}
          >
            {toast.message}
          </div>
        ))}
      </div>

      {/* Header Row */}
      <div style={styles.headerRow}>
        <div>
          <h2 style={styles.header}>Coverage Queue</h2>
          <p style={styles.subtitle}>Sessions that need a host assigned</p>
        </div>
        <div style={styles.headerActions}>
          <button style={styles.refreshBtn} onClick={fetchEvents} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>

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
                <span>{formatDateInZone(dateKey)}</span>
              </div>
              
              {dateEvents.map(event => {
                const eventKey = bytesToHex(event.instance_id as number[]);
                const isAssigning = assigningId === eventKey;
                const isRemoving = removingIds.has(eventKey);
                const isPopoverOpen = assignPopover?.eventKey === eventKey;
                const isNotesOpen = notesEditor?.eventKey === eventKey;
                
                return (
                  <div 
                    key={eventKey} 
                    style={{
                      ...styles.eventCard,
                      ...(isRemoving ? styles.eventCardRemoving : {}),
                    }}
                  >
                    <div style={styles.eventInfo}>
                      <div style={styles.eventTopRow}>
                        <div style={styles.eventTime}>
                          {formatTimeInZone(event.start_utc)}
                          {' – '}
                          {formatTimeInZone(event.end_utc)}
                          <span style={styles.tzIndicator}>{abbrev}</span>
                        </div>
                        <span style={styles.needsHostBadge}>Needs Host</span>
                      </div>
                      
                      <div style={styles.eventTitle}>{event.title}</div>
                      
                      {/* Notes Section */}
                      {isNotesOpen ? (
                        <div style={styles.notesEditor}>
                          <textarea
                            style={styles.notesTextarea}
                            value={notesEditor.value}
                            onChange={(e) => setNotesEditor(prev => prev ? { ...prev, value: e.target.value } : null)}
                            onBlur={() => {
                              if (notesEditor.value !== (event.notes || '')) {
                                saveNotes(event, notesEditor.value);
                              }
                            }}
                            placeholder="Add notes..."
                            rows={2}
                            autoFocus
                          />
                          <div style={styles.notesActions}>
                            {notesEditor.saving && <span style={styles.notesSaving}>Saving...</span>}
                            {notesEditor.saved && <span style={styles.notesSaved}>Saved</span>}
                            <button 
                              style={styles.notesCloseBtn}
                              onClick={closeNotesEditor}
                            >
                              Done
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={styles.notesRow}>
                          {event.notes ? (
                            <button 
                              style={styles.notesDisplay}
                              onClick={() => openNotesEditor(event)}
                            >
                              {event.notes}
                            </button>
                          ) : (
                            <button 
                              style={styles.addNoteBtn}
                              onClick={() => openNotesEditor(event)}
                            >
                              + Add note
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Assignment Actions */}
                    <div style={styles.eventActions}>
                      <div style={styles.assignWrapper}>
                        <button
                          style={{
                            ...styles.assignBtn,
                            ...(isPopoverOpen ? styles.assignBtnActive : {}),
                          }}
                          onClick={() => isPopoverOpen ? closeAssignPopover() : openAssignPopover(event)}
                          disabled={isAssigning}
                        >
                          {isAssigning ? 'Saving...' : 'Assign...'}
                        </button>
                        
                        {/* Assignment Popover */}
                        {isPopoverOpen && (
                          <div ref={popoverRef} style={styles.assignPopover}>
                            <input
                              ref={searchInputRef}
                              type="text"
                              style={styles.assignSearch}
                              placeholder="Search hosts..."
                              value={assignPopover.searchQuery}
                              onChange={(e) => setAssignPopover(prev => prev ? {
                                ...prev,
                                searchQuery: e.target.value,
                                highlightedIndex: 0,
                              } : null)}
                            />
                            
                            <div style={styles.assignList}>
                              {getFilteredUsers().map((u, idx) => {
                                const isMe = user && u.principal.toText() === user.principal.toText();
                                const isHighlighted = idx === assignPopover.highlightedIndex;
                                const isSelected = assignPopover.selectedPrincipal === u.principal.toText();
                                
                                return (
                                  <button
                                    key={u.principal.toText()}
                                    style={{
                                      ...styles.assignOption,
                                      ...(isHighlighted ? styles.assignOptionHighlighted : {}),
                                      ...(isSelected ? styles.assignOptionSelected : {}),
                                    }}
                                    onClick={() => setAssignPopover(prev => prev ? {
                                      ...prev,
                                      selectedPrincipal: u.principal.toText(),
                                    } : null)}
                                    onMouseEnter={() => setAssignPopover(prev => prev ? {
                                      ...prev,
                                      highlightedIndex: idx,
                                    } : null)}
                                  >
                                    <span>{u.name}</span>
                                    {isMe && <span style={styles.meLabel}>(Me)</span>}
                                    {isSelected && <span style={styles.checkmark}>✓</span>}
                                  </button>
                                );
                              })}
                              {getFilteredUsers().length === 0 && (
                                <div style={styles.noResults}>No hosts found</div>
                              )}
                            </div>
                            
                            <div style={styles.assignFooter}>
                              <button
                                style={styles.cancelBtn}
                                onClick={closeAssignPopover}
                              >
                                Cancel
                              </button>
                              <button
                                style={{
                                  ...styles.saveBtn,
                                  ...(assignPopover.selectedPrincipal ? {} : styles.saveBtnDisabled),
                                }}
                                disabled={!assignPopover.selectedPrincipal}
                                onClick={() => {
                                  if (assignPopover.selectedPrincipal) {
                                    handleAssign(event, assignPopover.selectedPrincipal);
                                  }
                                }}
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
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

// ==================== HELPERS ====================

function getErrorMessage(err: any): string {
  if ('Unauthorized' in err) return 'You are not authorized to perform this action';
  if ('NotFound' in err) return 'Event not found';
  if ('InvalidInput' in err) return err.InvalidInput;
  if ('Conflict' in err) return err.Conflict;
  if ('InternalError' in err) return err.InternalError;
  return 'An error occurred';
}

// ==================== STYLES ====================

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    position: 'relative',
  },
  
  // Toasts
  toastContainer: {
    position: 'fixed',
    top: '80px',
    right: '20px',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  toast: {
    background: theme.surfaceElevated,
    color: theme.textPrimary,
    padding: '12px 16px',
    borderRadius: '8px',
    fontSize: '14px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
    border: `1px solid ${theme.border}`,
    animation: 'slideIn 200ms ease-out',
  },
  toastError: {
    background: 'rgba(248, 113, 113, 0.15)',
    borderColor: 'rgba(248, 113, 113, 0.3)',
    color: '#F87171',
  },
  
  // Header
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '20px',
  },
  header: {
    margin: 0,
    color: theme.textPrimary,
    fontSize: '20px',
    fontWeight: 600,
  },
  subtitle: {
    color: theme.textMuted,
    marginTop: '4px',
    marginBottom: 0,
    fontSize: '14px',
  },
  headerActions: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
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
  
  // States
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
  
  // Queue list
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
    borderBottom: `1px solid ${theme.border}`,
  },
  
  // Event card
  eventCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '18px 16px',
    borderBottom: `1px solid ${theme.border}`,
    gap: '16px',
    background: theme.inputSurface,
    transition: 'opacity 200ms ease-out, transform 200ms ease-out, max-height 200ms ease-out',
  },
  eventCardRemoving: {
    opacity: 0,
    transform: 'translateX(20px)',
    maxHeight: 0,
    padding: 0,
    overflow: 'hidden',
  },
  eventInfo: {
    flex: 1,
    minWidth: 0,
  },
  eventTopRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '6px',
  },
  eventTime: {
    fontSize: '14px',
    fontWeight: 500,
    color: theme.accent,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  tzIndicator: {
    fontSize: '11px',
    color: theme.textMuted,
    fontWeight: 400,
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
    fontSize: '15px',
    fontWeight: 500,
    color: theme.textPrimary,
    marginBottom: '8px',
  },
  
  // Notes
  notesRow: {
    marginTop: '4px',
  },
  notesDisplay: {
    background: 'transparent',
    border: 'none',
    padding: 0,
    color: theme.textMuted,
    fontSize: '13px',
    cursor: 'pointer',
    textAlign: 'left',
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  addNoteBtn: {
    background: 'transparent',
    border: 'none',
    padding: 0,
    color: theme.textMuted,
    fontSize: '13px',
    cursor: 'pointer',
    opacity: 0.7,
  },
  notesEditor: {
    marginTop: '8px',
  },
  notesTextarea: {
    width: '100%',
    padding: '10px 12px',
    background: theme.surface,
    border: `1px solid ${theme.borderInput}`,
    borderRadius: '8px',
    color: theme.textPrimary,
    fontSize: '13px',
    resize: 'vertical',
    minHeight: '60px',
    fontFamily: 'inherit',
  },
  notesActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: '8px',
    marginTop: '6px',
  },
  notesSaving: {
    fontSize: '12px',
    color: theme.textMuted,
  },
  notesSaved: {
    fontSize: '12px',
    color: theme.accent,
  },
  notesCloseBtn: {
    padding: '4px 10px',
    background: 'transparent',
    border: `1px solid ${theme.border}`,
    borderRadius: '6px',
    color: theme.textSecondary,
    fontSize: '12px',
    cursor: 'pointer',
  },
  
  // Assignment
  eventActions: {
    flexShrink: 0,
  },
  assignWrapper: {
    position: 'relative',
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
  assignBtnActive: {
    background: theme.accentHover,
  },
  assignPopover: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: '8px',
    background: theme.surfaceElevated,
    border: `1px solid ${theme.border}`,
    borderRadius: '10px',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
    zIndex: 100,
    width: '260px',
    overflow: 'hidden',
  },
  assignSearch: {
    width: '100%',
    padding: '12px 14px',
    background: theme.inputSurface,
    border: 'none',
    borderBottom: `1px solid ${theme.border}`,
    color: theme.textPrimary,
    fontSize: '14px',
    outline: 'none',
  },
  assignList: {
    maxHeight: '200px',
    overflowY: 'auto',
  },
  assignOption: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: '10px 14px',
    background: 'transparent',
    border: 'none',
    color: theme.textPrimary,
    fontSize: '14px',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background 100ms ease-out',
  },
  assignOptionHighlighted: {
    background: theme.inputSurface,
  },
  assignOptionSelected: {
    background: theme.accentFocus,
  },
  meLabel: {
    color: theme.textMuted,
    fontSize: '12px',
    marginLeft: '6px',
  },
  checkmark: {
    color: theme.accent,
    fontSize: '14px',
  },
  noResults: {
    padding: '16px',
    color: theme.textMuted,
    fontSize: '14px',
    textAlign: 'center',
  },
  assignFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    padding: '10px 12px',
    borderTop: `1px solid ${theme.border}`,
    background: theme.surface,
  },
  cancelBtn: {
    padding: '8px 14px',
    background: 'transparent',
    border: `1px solid ${theme.border}`,
    borderRadius: '6px',
    color: theme.textSecondary,
    fontSize: '13px',
    cursor: 'pointer',
  },
  saveBtn: {
    padding: '8px 16px',
    background: theme.accent,
    border: 'none',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  saveBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  
  // Stats
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
