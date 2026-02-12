import React, { useState, useEffect, useMemo } from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import { useBackend, User, EventSeries, GlobalSettings, CoverageStats, nanosToDate, bytesToHex, dateToNanos, CreateSeriesInput, isSessionExpiredError } from '../hooks/useBackend';
import { useAuth } from '../hooks/useAuth';
import { Principal } from '@dfinity/principal';
import { useConfirm, Toggle, Modal, Button, SkeletonTable } from './ui';
import { theme } from '../theme';

export default function AdminPanel() {
  const { isAdmin } = useAuth();
  
  if (!isAdmin) {
    return (
      <div style={styles.unauthorized}>
        <h2 style={{ color: theme.textPrimary }}>Admin Access Required</h2>
        <p>You don't have permission to access this page.</p>
      </div>
    );
  }

  return (
    <div>
      <h2 style={styles.pageTitle}>Admin Panel</h2>
      
      <div style={styles.segmentedControl}>
        <NavLink to="/dashboard/admin" end className={({ isActive }) => `admin-tab${isActive ? ' admin-tab-active' : ''}`}>Users</NavLink>
        <NavLink to="/dashboard/admin/series" className={({ isActive }) => `admin-tab${isActive ? ' admin-tab-active' : ''}`}>Event Series</NavLink>
        <NavLink to="/dashboard/admin/settings" className={({ isActive }) => `admin-tab${isActive ? ' admin-tab-active' : ''}`}>Settings</NavLink>
        <NavLink to="/dashboard/admin/reports" className={({ isActive }) => `admin-tab${isActive ? ' admin-tab-active' : ''}`}>Reports</NavLink>
      </div>
      
      <div style={styles.content}>
        <Routes>
          <Route index element={<UserManagement />} />
          <Route path="series" element={<EventSeriesManagement />} />
          <Route path="settings" element={<SystemSettings />} />
          <Route path="reports" element={<Reports />} />
        </Routes>
      </div>
    </div>
  );
}

const tabStyle = ({ isActive }: { isActive: boolean }) => ({
  ...styles.tab,
  ...(isActive ? styles.tabActive : {}),
});

// ============== USER MANAGEMENT ==============
function UserManagement() {
  const { actor, loading: actorLoading, triggerSessionExpired } = useBackend();
  const confirm = useConfirm();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [linkingUser, setLinkingUser] = useState<User | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Check if a principal is a placeholder (starts with 0xFFFF)
  const isPlaceholderPrincipal = (principal: Principal): boolean => {
    const bytes = principal.toUint8Array();
    return bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFF;
  };

  const fetchUsers = async () => {
    if (!actor) return;
    setLoading(true);
    try {
      const result = await actor.list_users();
      if ('Ok' in result) setUsers(result.Ok);
      else setError(getErrorMessage(result.Err));
    } catch (err) {
      if (isSessionExpiredError(err)) {
        triggerSessionExpired();
        setError('Your session has expired. Please sign in again.');
      } else {
        setError('Failed to load users');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!actor || actorLoading) return;
    fetchUsers();
  }, [actor, actorLoading]);

  const handleToggleStatus = async (user: User) => {
    if (!actor) return;
    const key = user.principal.toText();
    setActionLoading(key);
    try {
      const isActive = 'Active' in user.status;
      const result = isActive ? await actor.disable_user(user.principal) : await actor.enable_user(user.principal);
      if ('Ok' in result) fetchUsers();
      else setError(getErrorMessage(result.Err));
    } catch (err) {
      if (isSessionExpiredError(err)) {
        triggerSessionExpired();
        setError('Your session has expired. Please sign in again.');
      } else {
        setError('Failed to update user status');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (!actor) return;
    const confirmed = await confirm({
      title: 'Delete User',
      message: `Delete user "${user.name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!confirmed) return;
    
    const key = user.principal.toText();
    setActionLoading(key + '-delete');
    try {
      const result = await actor.delete_user(user.principal);
      if ('Ok' in result) fetchUsers();
      else setError(getErrorMessage(result.Err));
    } catch (err) {
      if (isSessionExpiredError(err)) {
        triggerSessionExpired();
        setError('Your session has expired. Please sign in again.');
      } else {
        setError('Failed to delete user');
      }
    } finally {
      setActionLoading(null);
    }
  };

  if (actorLoading || loading) return <SkeletonTable rows={5} cols={5} />;

  return (
    <div>
      <div style={styles.sectionHeader}>
        <h3 style={styles.sectionTitle}>Authorized Users</h3>
        <button style={styles.addBtn} onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? 'Cancel' : 'Add User'}
        </button>
      </div>
      {error && <div style={styles.error}>{error}</div>}
      {showAddForm && <AddUserForm actor={actor} triggerSessionExpired={triggerSessionExpired} onSuccess={() => { setShowAddForm(false); fetchUsers(); }} onCancel={() => setShowAddForm(false)} />}
      {linkingUser && <LinkPrincipalModal user={linkingUser} actor={actor} triggerSessionExpired={triggerSessionExpired} onSuccess={() => { setLinkingUser(null); fetchUsers(); }} onCancel={() => setLinkingUser(null)} />}
      {editingUser && <EditUserModal user={editingUser} actor={actor} triggerSessionExpired={triggerSessionExpired} onSuccess={() => { setEditingUser(null); fetchUsers(); }} onCancel={() => setEditingUser(null)} />}
      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Name</th>
              <th style={styles.th}>Email</th>
              <th style={styles.th}>Role</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Hosted</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => {
              const key = user.principal.toText();
              const isActive = 'Active' in user.status;
              const isAdminRole = 'Admin' in user.role;
              const isPending = isPlaceholderPrincipal(user.principal);
              return (
                <tr key={key} style={!isActive ? styles.disabledRow : {}}>
                  <td style={styles.td}>
                    <div style={styles.userName}>{user.name}</div>
                    {isPending ? (
                      <div style={styles.pendingText}>Pending II link</div>
                    ) : (
                      <div style={styles.principalText}>{key.slice(0, 15)}...</div>
                    )}
                  </td>
                  <td style={styles.td}>{user.email || <span style={styles.emptyField}>—</span>}</td>
                  <td style={styles.td}><span style={isAdminRole ? styles.adminBadge : styles.userBadge}>{isAdminRole ? 'Admin' : 'User'}</span></td>
                  <td style={styles.td}>
                    {isPending ? (
                      <span style={styles.pendingBadge}>Pending</span>
                    ) : (
                      <span style={isActive ? styles.activeBadge : styles.disabledBadge}>{isActive ? 'Active' : 'Disabled'}</span>
                    )}
                  </td>
                  <td style={styles.td}>
                    <span style={{ color: theme.textSecondary }}>{user.sessions_hosted_count?.toString() || '0'}</span>
                  </td>
                  <td style={styles.td}>
                    <div style={styles.actionGroup}>
                      <button style={styles.actionBtn} onClick={() => setEditingUser(user)} title="Edit">
                        Edit
                      </button>
                      {isPending ? (
                        <button style={styles.linkBtn} onClick={() => setLinkingUser(user)}>
                          Link
                        </button>
                      ) : (
                        <button style={styles.actionBtn} onClick={() => handleToggleStatus(user)} disabled={actionLoading === key}>
                          {actionLoading === key ? '...' : (isActive ? 'Disable' : 'Enable')}
                        </button>
                      )}
                      <button 
                        style={styles.deleteBtn} 
                        onClick={() => handleDeleteUser(user)} 
                        disabled={actionLoading === key + '-delete'}
                        title="Delete"
                        aria-label={`Delete user ${user.name}`}
                      >
                        {actionLoading === key + '-delete' ? '...' : '×'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AddUserForm({ actor, triggerSessionExpired, onSuccess, onCancel }: { actor: any; triggerSessionExpired: () => void; onSuccess: () => void; onCancel: () => void }) {
  const [principal, setPrincipal] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'Admin' | 'User'>('User');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate a placeholder principal from name + timestamp
  // Uses a simple hash to create a unique 29-byte principal
  const generatePlaceholderPrincipal = (userName: string): Principal => {
    const timestamp = Date.now().toString();
    const input = `pending:${userName}:${timestamp}`;
    // Create a simple hash and convert to bytes
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    // Create 29 bytes (max principal size) with recognizable prefix
    const bytes = new Uint8Array(29);
    // Prefix: 0xFF 0xFF to mark as placeholder (unusual pattern)
    bytes[0] = 0xFF;
    bytes[1] = 0xFF;
    // Fill rest with hash-derived values
    for (let i = 2; i < 29; i++) {
      bytes[i] = (hash + i * 31) & 0xFF;
    }
    return Principal.fromUint8Array(bytes);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actor) return;
    setLoading(true);
    setError(null);
    try {
      let principalObj: Principal;
      if (principal.trim()) {
        principalObj = Principal.fromText(principal.trim());
      } else {
        // Generate placeholder principal for pending users
        principalObj = generatePlaceholderPrincipal(name.trim());
      }
      const roleVariant = role === 'Admin' ? { Admin: null } : { User: null };
      const result = await actor.authorize_user(principalObj, name.trim(), email.trim(), roleVariant);
      if ('Ok' in result) onSuccess();
      else setError(getErrorMessage(result.Err));
    } catch (err: any) {
      if (isSessionExpiredError(err)) {
        triggerSessionExpired();
        setError('Your session has expired. Please sign in again.');
      } else {
        setError(err.message || 'Invalid principal format');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={true} onClose={onCancel} title="Add New User">
      <form onSubmit={handleSubmit}>
        {error && <div style={styles.formError}>{error}</div>}
        <div style={styles.formRow}>
          <label style={styles.label}>Principal ID <span style={styles.optionalLabel}>(optional)</span></label>
          <input type="text" value={principal} onChange={e => setPrincipal(e.target.value)} placeholder="Leave blank if user hasn't signed in yet" style={styles.input} />
          <div style={styles.fieldHint}>If blank, user can be linked to their Internet Identity later</div>
        </div>
        <div style={styles.formRow}><label style={styles.label}>Name</label><input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="John Doe" style={styles.input} required /></div>
        <div style={styles.formRow}><label style={styles.label}>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="john@example.com" style={styles.input} /></div>
        <div style={styles.formRow}><label style={styles.label}>Role</label><select value={role} onChange={e => setRole(e.target.value as 'Admin' | 'User')} style={styles.select}><option value="User">User</option><option value="Admin">Admin</option></select></div>
        <div style={styles.formActions}>
          <Button variant="secondary" onClick={onCancel} type="button">Cancel</Button>
          <Button variant="primary" type="submit" loading={loading}>Add User</Button>
        </div>
      </form>
    </Modal>
  );
}

// ============== LINK PRINCIPAL MODAL ==============
function LinkPrincipalModal({ user, actor, triggerSessionExpired, onSuccess, onCancel }: { 
  user: User; 
  actor: any; 
  triggerSessionExpired: () => void; 
  onSuccess: () => void; 
  onCancel: () => void;
}) {
  const [newPrincipal, setNewPrincipal] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actor || !newPrincipal.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Validate the new principal
      const newPrincipalObj = Principal.fromText(newPrincipal.trim());
      
      // Strategy: Create new user with same details but new principal, then delete old
      // First check if new principal already exists
      const roleVariant = 'Admin' in user.role ? { Admin: null } : { User: null };
      
      // Create user with new principal
      const createResult = await actor.authorize_user(
        newPrincipalObj, 
        user.name, 
        user.email, 
        roleVariant
      );
      
      if ('Err' in createResult) {
        setError(getErrorMessage(createResult.Err));
        return;
      }
      
      // Delete the old placeholder user
      // Note: We need a delete_user function, but we can use disable for now
      // and the old record will just be marked disabled
      await actor.disable_user(user.principal);
      
      onSuccess();
    } catch (err: any) {
      if (isSessionExpiredError(err)) {
        triggerSessionExpired();
        setError('Your session has expired. Please sign in again.');
      } else {
        setError(err.message || 'Invalid principal format');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={true}
      onClose={onCancel}
      title={`Link Principal to ${user.name}`}
      description="Enter the Internet Identity principal for this user. You can find this when they sign in and visit the &quot;Not Authorized&quot; page, or ask them to share it from their II dashboard."
    >
        {error && <div style={styles.formError}>{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div style={styles.formRow}>
            <label style={styles.label}>Principal ID</label>
            <input 
              type="text" 
              value={newPrincipal} 
              onChange={e => setNewPrincipal(e.target.value)} 
              placeholder="xxxxx-xxxxx-xxxxx-xxxxx-cai" 
              style={styles.input} 
              required 
              autoFocus
            />
          </div>
          
          <div style={styles.formActions}>
            <Button variant="secondary" onClick={onCancel} type="button">Cancel</Button>
            <Button variant="primary" type="submit" loading={loading} disabled={!newPrincipal.trim()}>
              Link Principal
            </Button>
          </div>
        </form>
    </Modal>
  );
}

// ============== EDIT USER MODAL ==============
function EditUserModal({ user, actor, triggerSessionExpired, onSuccess, onCancel }: { 
  user: User; 
  actor: any; 
  triggerSessionExpired: () => void; 
  onSuccess: () => void; 
  onCancel: () => void;
}) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState<'Admin' | 'User'>('Admin' in user.role ? 'Admin' : 'User');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actor || !name.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const roleVariant = role === 'Admin' ? { Admin: null } : { User: null };
      const result = await actor.update_user(user.principal, name.trim(), email.trim(), roleVariant);
      
      if ('Ok' in result) {
        onSuccess();
      } else {
        setError(getErrorMessage(result.Err));
      }
    } catch (err: any) {
      if (isSessionExpiredError(err)) {
        triggerSessionExpired();
        setError('Your session has expired. Please sign in again.');
      } else {
        setError(err.message || 'Failed to update user');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={true} onClose={onCancel} title="Edit User">
        {error && <div style={styles.formError}>{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div style={styles.formRow}>
            <label style={styles.label}>Name</label>
            <input 
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder="John Doe" 
              style={styles.input} 
              required 
              autoFocus
            />
          </div>
          
          <div style={styles.formRow}>
            <label style={styles.label}>Email</label>
            <input 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              placeholder="john@example.com" 
              style={styles.input} 
            />
          </div>
          
          <div style={styles.formRow}>
            <label style={styles.label}>Role</label>
            <select value={role} onChange={e => setRole(e.target.value as 'Admin' | 'User')} style={styles.select}>
              <option value="User">User</option>
              <option value="Admin">Admin</option>
            </select>
          </div>
          
          <div style={styles.formActions}>
            <Button variant="secondary" onClick={onCancel} type="button">Cancel</Button>
            <Button variant="primary" type="submit" loading={loading} disabled={!name.trim()}>
              Save Changes
            </Button>
          </div>
        </form>
    </Modal>
  );
}

// ============== EVENT SERIES MANAGEMENT ==============
function EventSeriesManagement() {
  const { actor, loading: actorLoading, triggerSessionExpired } = useBackend();
  const confirm = useConfirm();
  const [series, setSeries] = useState<EventSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSeries, setEditingSeries] = useState<EventSeries | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchSeries = async () => {
    if (!actor) return;
    setLoading(true);
    try {
      const result = await actor.list_event_series();
      if ('Ok' in result) setSeries(result.Ok);
      else setError(getErrorMessage(result.Err));
    } catch (err) {
      if (isSessionExpiredError(err)) {
        triggerSessionExpired();
        setError('Your session has expired. Please sign in again.');
      } else {
        setError('Failed to load event series');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!actor || actorLoading) return;
    fetchSeries();
  }, [actor, actorLoading]);

  const handleDelete = async (s: EventSeries) => {
    if (!actor) return;
    const confirmed = await confirm({
      title: 'Delete Series',
      message: `Delete series "${s.title}"? This will remove all future instances. This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!confirmed) return;
    const key = bytesToHex(s.series_id as number[]);
    setDeletingId(key);
    try {
      const result = await actor.delete_event_series(s.series_id);
      if ('Ok' in result) fetchSeries();
      else setError(getErrorMessage(result.Err));
    } catch (err) {
      if (isSessionExpiredError(err)) {
        triggerSessionExpired();
        setError('Your session has expired. Please sign in again.');
      } else {
        setError('Failed to delete series');
      }
    } finally {
      setDeletingId(null);
    }
  };

  const handleTogglePause = async (s: any) => {
    if (!actor) return;
    try {
      const result = await actor.toggle_series_pause(s.series_id);
      if ('Ok' in result) fetchSeries();
      else setError(getErrorMessage(result.Err));
    } catch (err) {
      if (isSessionExpiredError(err)) {
        triggerSessionExpired();
        setError('Your session has expired. Please sign in again.');
      } else {
        setError('Failed to toggle pause');
      }
    }
  };

  const getFrequencyLabel = (freq: any) => {
    if ('Weekly' in freq) return 'Weekly';
    if ('Biweekly' in freq) return 'Biweekly';
    if ('Monthly' in freq) return 'Monthly';
    return 'Unknown';
  };

  const getWeekdayLabel = (wd: any) => {
    const map: Record<string, string> = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };
    for (const [key, label] of Object.entries(map)) {
      if (key in wd) return label;
    }
    return 'Unknown';
  };

  const formatTime = (nanos: bigint) => {
    const date = nanosToDate(nanos);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  if (actorLoading || loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} style={{ padding: '16px', background: theme.surfaceElevated, borderRadius: '10px', border: `1px solid ${theme.border}` }}>
          <div className="skeleton" style={{ width: '40%', height: '16px', borderRadius: '6px', background: `linear-gradient(90deg, ${theme.inputSurface} 25%, ${theme.surfaceElevated} 50%, ${theme.inputSurface} 75%)`, backgroundSize: '200% 100%', animation: 'skeletonShimmer 1.5s ease-in-out infinite', marginBottom: '8px' }} />
          <div className="skeleton" style={{ width: '60%', height: '12px', borderRadius: '6px', background: `linear-gradient(90deg, ${theme.inputSurface} 25%, ${theme.surfaceElevated} 50%, ${theme.inputSurface} 75%)`, backgroundSize: '200% 100%', animation: 'skeletonShimmer 1.5s ease-in-out infinite' }} />
        </div>
      ))}
    </div>
  );

  return (
    <div>
      <div style={styles.sectionHeader}>
        <h3 style={styles.sectionTitle}>Recurring Event Series</h3>
        <button style={styles.addBtn} onClick={() => { setShowAddForm(!showAddForm); setEditingSeries(null); }}>
          {showAddForm ? 'Cancel' : 'Create Series'}
        </button>
      </div>
      {error && <div style={styles.error}>{error}</div>}
      {showAddForm && (
        <AddSeriesForm 
          actor={actor}
          triggerSessionExpired={triggerSessionExpired}
          onSuccess={() => { setShowAddForm(false); fetchSeries(); }} 
          onCancel={() => setShowAddForm(false)} 
        />
      )}
      {editingSeries && (
        <EditSeriesForm
          actor={actor}
          triggerSessionExpired={triggerSessionExpired}
          series={editingSeries}
          onSuccess={() => { setEditingSeries(null); fetchSeries(); }}
          onCancel={() => setEditingSeries(null)}
        />
      )}
      {series.length === 0 ? (
        <div style={styles.emptyState}>
          <p style={styles.emptyText}>No event series created yet.</p>
          <p style={styles.emptyHint}>Create a recurring series to start scheduling office hours.</p>
        </div>
      ) : (
        <div style={styles.seriesList}>
          {series.map(s => {
            const key = bytesToHex(s.series_id as number[]);
            return (
              <div key={key} style={{ ...styles.seriesCard, ...(s.paused ? { opacity: 0.6 } : {}) }}>
                <div style={styles.seriesInfo}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={styles.seriesTitle}>{s.title}</div>
                    {s.paused && <span style={{ fontSize: '11px', fontWeight: 600, color: '#FBBF24', background: 'rgba(251, 191, 36, 0.15)', padding: '2px 8px', borderRadius: '4px' }}>Paused</span>}
                  </div>
                  <div style={styles.seriesMeta}>
                    {getFrequencyLabel(s.frequency)} on {getWeekdayLabel(s.weekday)}s at {formatTime(s.start_date)} · {s.default_duration_minutes} min
                  </div>
                  <div style={styles.seriesMeta}>
                    Started: {nanosToDate(s.start_date).toLocaleDateString()}
                    {s.end_date.length > 0 ? ` · Ends: ${nanosToDate(s.end_date[0] as bigint).toLocaleDateString()}` : ''}
                  </div>
                  {s.notes && <div style={styles.seriesNotes}>{s.notes}</div>}
                </div>
                <div style={styles.seriesActions}>
                  <button style={styles.iconBtn} onClick={() => handleTogglePause(s)}>{s.paused ? 'Resume' : 'Pause'}</button>
                  <button style={styles.iconBtn} onClick={() => { setEditingSeries(s); setShowAddForm(false); }}>Edit</button>
                  <button style={styles.iconBtnDanger} onClick={() => handleDelete(s)} disabled={deletingId === key}>
                    {deletingId === key ? '...' : 'Delete'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AddSeriesForm({ actor, triggerSessionExpired, onSuccess, onCancel }: { actor: any; triggerSessionExpired: () => void; onSuccess: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [link, setLink] = useState('');
  const [frequency, setFrequency] = useState<'Weekly' | 'Biweekly' | 'Monthly'>('Weekly');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('14:00');
  const [endDate, setEndDate] = useState('');
  const [duration, setDuration] = useState('60');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const derivedWeekday = startDate ? new Date(startDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' }) : null;
  const weekdayMap: Record<string, string> = { Sunday: 'Sun', Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat' };

  // Preview next 5 occurrences
  const previewDates = useMemo(() => {
    if (!startDate || !startTime) return [];
    const dates: Date[] = [];
    const start = new Date(startDate + 'T' + startTime + ':00');
    if (isNaN(start.getTime())) return [];
    const intervalDays = frequency === 'Weekly' ? 7 : frequency === 'Biweekly' ? 14 : 0;
    const end = endDate ? new Date(endDate + 'T23:59:59') : null;
    let current = new Date(start);
    for (let i = 0; i < 5 && (intervalDays > 0); i++) {
      if (end && current > end) break;
      dates.push(new Date(current));
      if (frequency === 'Monthly') {
        current = new Date(current);
        current.setMonth(current.getMonth() + 1);
      } else {
        current = new Date(current.getTime() + intervalDays * 24 * 60 * 60 * 1000);
      }
    }
    return dates;
  }, [startDate, startTime, frequency, endDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actor || !startDate || !derivedWeekday) return;
    setLoading(true);
    setError(null);
    try {
      const weekdayKey = weekdayMap[derivedWeekday];
      const weekdayVariants: Record<string, any> = { Mon: { Mon: null }, Tue: { Tue: null }, Wed: { Wed: null }, Thu: { Thu: null }, Fri: { Fri: null }, Sat: { Sat: null }, Sun: { Sun: null } };
      const frequencyVariants: Record<string, any> = { Weekly: { Weekly: null }, Biweekly: { Biweekly: null }, Monthly: { Monthly: null } };
      const startDateTime = new Date(`${startDate}T${startTime}:00`);
      const input: CreateSeriesInput = {
        title: title.trim(),
        notes: notes.trim(),
        link: link.trim() ? [link.trim()] : [],
        frequency: frequencyVariants[frequency],
        weekday: weekdayVariants[weekdayKey],
        weekday_ordinal: [],
        start_date: dateToNanos(startDateTime),
        end_date: endDate ? [dateToNanos(new Date(endDate + 'T23:59:59'))] : [],
        default_duration_minutes: duration ? [parseInt(duration)] : [],
      };
      const result = await actor.create_event_series(input);
      if ('Ok' in result) onSuccess();
      else setError(getErrorMessage(result.Err));
    } catch (err: any) {
      if (isSessionExpiredError(err)) {
        triggerSessionExpired();
        setError('Your session has expired. Please sign in again.');
      } else {
        setError(err.message || 'Failed to create series');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <h4 style={styles.formTitle}>Create Event Series</h4>
      {error && <div style={styles.formError}>{error}</div>}
      <div style={styles.formRow}><label style={styles.label}>Title</label><input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Weekly Office Hours" style={styles.input} required /></div>
      <div style={styles.formRow}><label style={styles.label}>Notes (optional)</label><textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Open Q&A session" style={styles.textarea} /></div>
      <div style={styles.formRow}><label style={styles.label}>Meeting Link (optional)</label><input type="url" value={link} onChange={e => setLink(e.target.value)} placeholder="https://meet.google.com/..." style={styles.input} /></div>
      <div style={styles.formRowGroup}>
        <div style={styles.formRowHalf}><label style={styles.label}>Frequency</label><select value={frequency} onChange={e => setFrequency(e.target.value as any)} style={styles.select}><option value="Weekly">Weekly</option><option value="Biweekly">Biweekly</option><option value="Monthly">Monthly</option></select></div>
        <div style={styles.formRowHalf}><label style={styles.label}>Duration</label><select value={duration} onChange={e => setDuration(e.target.value)} style={styles.select}><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">1 hour</option><option value="90">1.5 hours</option><option value="120">2 hours</option></select></div>
      </div>
      <div style={styles.formRowGroup}>
        <div style={styles.formRowHalf}><label style={styles.label}>First Session Date</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={styles.input} required />{derivedWeekday && <div style={styles.derivedDay}>Every {derivedWeekday}</div>}</div>
        <div style={styles.formRowHalf}><label style={styles.label}>Start Time</label><input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={styles.input} required /></div>
      </div>
      <div style={styles.formRow}><label style={styles.label}>End Date (optional)</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={styles.input} /></div>
      {previewDates.length > 0 && (
        <div style={styles.previewSection}>
          <div style={styles.previewTitle}>Preview — next {previewDates.length} occurrence{previewDates.length !== 1 ? 's' : ''}</div>
          {previewDates.map((d, i) => (
            <div key={i} style={styles.previewDate}>
              {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              {' at '}
              {d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </div>
          ))}
        </div>
      )}
      <div style={styles.formActions}><button type="button" onClick={onCancel} style={styles.cancelBtn}>Cancel</button><button type="submit" disabled={loading} style={styles.submitBtn}>{loading ? 'Creating...' : 'Create Series'}</button></div>
    </form>
  );
}

function EditSeriesForm({ actor, triggerSessionExpired, series, onSuccess, onCancel }: { actor: any; triggerSessionExpired: () => void; series: EventSeries; onSuccess: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState(series.title);
  const [notes, setNotes] = useState(series.notes);
  const [endDate, setEndDate] = useState(series.end_date.length > 0 ? nanosToDate(series.end_date[0] as bigint).toISOString().split('T')[0] : '');
  const [duration, setDuration] = useState(series.default_duration_minutes.toString());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actor) return;
    setLoading(true);
    setError(null);
    try {
      const updateInput = {
        title: [title.trim()],
        notes: [notes.trim()],
        end_date: endDate ? [[dateToNanos(new Date(endDate + 'T23:59:59'))]] : [[]],
        default_duration_minutes: [parseInt(duration)],
      };
      const result = await actor.update_event_series(series.series_id, updateInput);
      if ('Ok' in result) onSuccess();
      else setError(getErrorMessage(result.Err));
    } catch (err: any) {
      if (isSessionExpiredError(err)) {
        triggerSessionExpired();
        setError('Your session has expired. Please sign in again.');
      } else {
        setError(err.message || 'Failed to update series');
      }
    } finally {
      setLoading(false);
    }
  };

  const weekdayLabel = (() => {
    const wd = series.weekday;
    const map: Record<string, string> = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };
    for (const [key, label] of Object.entries(map)) { if (key in wd) return label; }
    return 'Unknown';
  })();

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <h4 style={styles.formTitle}>Edit Series</h4>
      {error && <div style={styles.formError}>{error}</div>}
      <div style={styles.formRow}><label style={styles.label}>Title</label><input type="text" value={title} onChange={e => setTitle(e.target.value)} style={styles.input} required /></div>
      <div style={styles.formRow}><label style={styles.label}>Notes</label><textarea value={notes} onChange={e => setNotes(e.target.value)} style={styles.textarea} /></div>
      <div style={styles.readOnlyInfo}><strong>Schedule:</strong> Every {weekdayLabel} at {nanosToDate(series.start_date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}<br /><small>Schedule cannot be changed. Delete and recreate if needed.</small></div>
      <div style={styles.formRowGroup}>
        <div style={styles.formRowHalf}><label style={styles.label}>Duration</label><select value={duration} onChange={e => setDuration(e.target.value)} style={styles.select}><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">1 hour</option><option value="90">1.5 hours</option><option value="120">2 hours</option></select></div>
        <div style={styles.formRowHalf}><label style={styles.label}>End Date (optional)</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={styles.input} /></div>
      </div>
      <div style={styles.formActions}><button type="button" onClick={onCancel} style={styles.cancelBtn}>Cancel</button><button type="submit" disabled={loading} style={styles.submitBtn}>{loading ? 'Saving...' : 'Save Changes'}</button></div>
    </form>
  );
}

// ============== SYSTEM SETTINGS ==============
function SystemSettings() {
  const { actor, loading: actorLoading, triggerSessionExpired } = useBackend();
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!actor || actorLoading) return;
    async function fetchSettings() {
      setLoading(true);
      try {
        const result = await actor.get_global_settings();
        if ('Ok' in result) setSettings(result.Ok);
        else setError(getErrorMessage(result.Err));
      } catch (err) {
        if (isSessionExpiredError(err)) {
          triggerSessionExpired();
          setError('Your session has expired. Please sign in again.');
        } else {
          setError('Failed to load settings');
        }
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, [actor, actorLoading]);

  const handleSave = async () => {
    if (!actor || !settings) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const result = await actor.update_global_settings(settings);
      if ('Ok' in result) { setSuccess(true); setTimeout(() => setSuccess(false), 3000); }
      else setError(getErrorMessage(result.Err));
    } catch (err) {
      if (isSessionExpiredError(err)) {
        triggerSessionExpired();
        setError('Your session has expired. Please sign in again.');
      } else {
        setError('Failed to save settings');
      }
    } finally {
      setSaving(false);
    }
  };

  if (actorLoading || loading || !settings) return <div style={styles.loading}>Loading settings...</div>;

  return (
    <div>
      <h3 style={styles.sectionTitle}>Global Settings</h3>
      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>Settings saved successfully!</div>}
      <div style={styles.settingsForm}>
        <div style={styles.settingRow}>
          <div style={styles.settingInfo}><div style={styles.settingLabel}>Forward Window</div><div style={styles.settingDesc}>How many months ahead to generate event instances</div></div>
          <div style={styles.settingControl}><input type="number" value={settings.forward_window_months} onChange={e => setSettings({ ...settings, forward_window_months: parseInt(e.target.value) || 2 })} min="1" max="12" style={styles.numberInput} /><span style={styles.settingUnit}>months</span></div>
        </div>
        <div style={styles.settingRow}>
          <div style={styles.settingInfo}><div style={styles.settingLabel}>Default Event Duration</div><div style={styles.settingDesc}>Default length of office hour sessions</div></div>
          <div style={styles.settingControl}><input type="number" value={settings.default_event_duration_minutes} onChange={e => setSettings({ ...settings, default_event_duration_minutes: parseInt(e.target.value) || 60 })} min="15" max="480" step="15" style={styles.numberInput} /><span style={styles.settingUnit}>minutes</span></div>
        </div>
        <div style={styles.settingRow}>
          <div style={styles.settingInfo}><div style={styles.settingLabel}>Pause Assignments</div><div style={styles.settingDesc}>Temporarily prevent users from assigning hosts</div></div>
          <div style={styles.settingControl}>
            <Toggle
              checked={settings.claims_paused}
              onChange={(checked) => setSettings({ ...settings, claims_paused: checked })}
            />
            <span style={settings.claims_paused ? styles.pausedLabel : styles.activeLabel}>{settings.claims_paused ? 'Paused' : 'Active'}</span>
          </div>
        </div>
        <button style={styles.submitBtn} onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Settings'}</button>
      </div>

      <h3 style={{ ...styles.sectionTitle, marginTop: '32px' }}>Organization</h3>
      <p style={styles.settingDesc}>Customize your public calendar branding</p>
      <div style={styles.settingsForm}>
        <div style={styles.settingRow}>
          <div style={styles.settingInfo}><div style={styles.settingLabel}>Organization Name</div></div>
          <div style={{ flex: 1 }}><input type="text" value={settings.org_name?.[0] || ''} onChange={e => setSettings({ ...settings, org_name: e.target.value ? [e.target.value] : [] })} placeholder="e.g. Yieldschool" style={styles.textInput} /></div>
        </div>
        <div style={styles.settingRow}>
          <div style={styles.settingInfo}><div style={styles.settingLabel}>Tagline</div></div>
          <div style={{ flex: 1 }}><input type="text" value={settings.org_tagline?.[0] || ''} onChange={e => setSettings({ ...settings, org_tagline: e.target.value ? [e.target.value] : [] })} placeholder="e.g. DeFi Education & Office Hours" style={styles.textInput} /></div>
        </div>
        <div style={styles.settingRow}>
          <div style={styles.settingInfo}><div style={styles.settingLabel}>Logo URL</div></div>
          <div style={{ flex: 1 }}><input type="text" value={settings.org_logo_url?.[0] || ''} onChange={e => setSettings({ ...settings, org_logo_url: e.target.value ? [e.target.value] : [] })} placeholder="https://..." style={styles.textInput} /></div>
        </div>
        <button style={styles.submitBtn} onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Organization'}</button>
      </div>
    </div>
  );
}

// ============== REPORTS ==============
function Reports() {
  const { actor, loading: actorLoading, triggerSessionExpired } = useBackend();
  const [events, setEvents] = useState<any[]>([]);
  const [users, setUsers] = useState<User[]>([]);
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
          actor.list_users(),
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

  const totalEvents = events.length;
  const assignedEvents = events.filter(e => e.host_principal.length > 0).length;
  const needsHostEvents = totalEvents - assignedEvents;
  const coverageRate = totalEvents > 0 ? Math.round((assignedEvents / totalEvents) * 100) : 0;

  const hostCounts: Record<string, { name: string; count: number }> = {};
  // Initialize all active users with 0 count
  users.filter(u => 'Active' in u.status).forEach(u => {
    hostCounts[u.principal.toText()] = { name: u.name, count: 0 };
  });
  events.forEach(e => {
    if (e.host_principal.length > 0) {
      const principal = e.host_principal[0].toText();
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
      <h3 style={styles.sectionTitle}>Coverage Reports</h3>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={styles.reportSubtitle}>Next 60 days</p>
        <button style={styles.addBtn} onClick={async () => {
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

      <h4 style={{ ...styles.reportSectionTitle, marginTop: '32px' }}>System Info</h4>
      <div style={styles.systemInfo}>
        <div style={styles.systemRow}>
          <span style={styles.systemLabel}>Frontend Canister</span>
          <code style={styles.systemValue}>{import.meta.env.VITE_FRONTEND_CANISTER_ID || '6sm6t-iiaaa-aaaad-aebwq-cai'}</code>
        </div>
        <div style={styles.systemRow}>
          <span style={styles.systemLabel}>Backend Canister</span>
          <code style={styles.systemValue}>{import.meta.env.VITE_BACKEND_CANISTER_ID || '6vnyh-fqaaa-aaaad-aebwa-cai'}</code>
        </div>
        <div style={styles.systemRow}>
          <span style={styles.systemLabel}>Network</span>
          <code style={styles.systemValue}>{import.meta.env.VITE_DFX_NETWORK || 'local'}</code>
        </div>
        <div style={styles.systemRow}>
          <span style={styles.systemLabel}>Active Users</span>
          <span style={styles.systemValue}>{users.filter(u => 'Active' in u.status).length}</span>
        </div>
        <div style={styles.systemRow}>
          <span style={styles.systemLabel}>CycleOps Dashboard</span>
          <a href="https://cycleops.dev" target="_blank" rel="noopener noreferrer" style={{ color: theme.accent, fontSize: '13px' }}>View cycle balance →</a>
        </div>
      </div>
    </div>
  );
}

function getErrorMessage(err: any): string {
  if ('Unauthorized' in err) return 'You are not authorized';
  if ('NotFound' in err) return 'Not found';
  if ('InvalidInput' in err) return err.InvalidInput;
  if ('Conflict' in err) return err.Conflict;
  if ('InternalError' in err) return err.InternalError;
  return 'An error occurred';
}

const styles: { [key: string]: React.CSSProperties } = {
  unauthorized: { padding: '60px 20px', textAlign: 'center', color: theme.textMuted },
  pageTitle: { margin: '0 0 24px 0', color: theme.textPrimary, fontSize: '20px', fontWeight: 600 },
  tabs: { display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: `1px solid ${theme.border}`, paddingBottom: '12px' },
  segmentedControl: { display: 'inline-flex', gap: '2px', padding: '3px', background: theme.surface, borderRadius: '8px', border: `1px solid ${theme.border}`, marginBottom: '24px' },
  tab: { padding: '8px 16px', background: 'transparent', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', color: theme.textMuted, textDecoration: 'none', transition: 'color 150ms ease-out' },
  tabActive: { color: theme.textPrimary, borderBottom: `2px solid ${theme.accent}`, marginBottom: '-13px', paddingBottom: '10px' },
  content: { background: theme.surface, borderRadius: '12px', padding: '24px', border: `1px solid ${theme.border}` },
  loading: { textAlign: 'center', padding: '40px', color: theme.textMuted },
  error: { background: 'rgba(248, 113, 113, 0.1)', color: '#F87171', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', border: '1px solid rgba(248, 113, 113, 0.2)', fontSize: '14px' },
  success: { background: 'rgba(99, 102, 241, 0.1)', color: theme.accent, padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', border: `1px solid ${theme.accentFocus}`, fontSize: '14px' },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  sectionTitle: { margin: 0, fontSize: '16px', color: theme.textPrimary, fontWeight: 600 },
  addBtn: { padding: '8px 16px', background: theme.accent, color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500, transition: 'background 150ms ease-out' },
  tableContainer: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '14px' },
  th: { textAlign: 'left', padding: '14px 12px', borderBottom: `1px solid ${theme.border}`, color: theme.textMuted, fontWeight: 500, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', background: theme.surface },
  td: { padding: '14px 12px', borderBottom: `1px solid ${theme.border}`, color: theme.textSecondary, background: theme.inputSurface },
  userName: { color: theme.textPrimary, fontWeight: 500 },
  disabledRow: { opacity: 0.5 },
  principalText: { fontSize: '11px', color: theme.textMuted, fontFamily: 'monospace' },
  adminBadge: { background: 'rgba(251, 191, 36, 0.15)', color: '#FBBF24', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 500 },
  userBadge: { background: 'rgba(99, 102, 241, 0.15)', color: theme.accent, padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 500 },
  activeBadge: { background: 'rgba(52, 211, 153, 0.15)', color: '#34D399', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 500 },
  disabledBadge: { background: 'rgba(248, 113, 113, 0.15)', color: '#F87171', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 500 },
  actionBtn: { padding: '6px 12px', background: 'transparent', color: theme.textSecondary, border: `1px solid ${theme.border}`, borderRadius: '6px', cursor: 'pointer', fontSize: '13px', transition: 'all 150ms ease-out' },
  form: { background: theme.surfaceElevated, borderRadius: '12px', padding: '20px', marginBottom: '24px', border: `1px solid ${theme.border}` },
  formTitle: { marginTop: 0, marginBottom: '16px', fontSize: '16px', color: theme.textPrimary, fontWeight: 600 },
  formError: { background: 'rgba(248, 113, 113, 0.1)', color: '#F87171', padding: '10px 12px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px', border: '1px solid rgba(248, 113, 113, 0.2)' },
  formRow: { marginBottom: '16px' },
  formRowGroup: { display: 'flex', gap: '16px', marginBottom: '16px' },
  formRowHalf: { flex: 1 },
  label: { display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500, color: theme.textSecondary },
  input: { width: '100%', padding: '12px 14px', border: `1px solid ${theme.borderInput}`, borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' as const, background: theme.inputSurface, color: theme.textPrimary, outline: 'none' },
  textarea: { width: '100%', padding: '12px 14px', border: `1px solid ${theme.borderInput}`, borderRadius: '8px', fontSize: '14px', minHeight: '80px', resize: 'vertical' as const, boxSizing: 'border-box' as const, background: theme.inputSurface, color: theme.textPrimary, outline: 'none' },
  select: { width: '100%', padding: '12px 14px', border: `1px solid ${theme.borderInput}`, borderRadius: '8px', fontSize: '14px', background: theme.inputSurface, color: theme.textPrimary, cursor: 'pointer' },
  formActions: { display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' },
  cancelBtn: { padding: '10px 20px', background: 'transparent', color: theme.textSecondary, border: `1px solid ${theme.border}`, borderRadius: '8px', cursor: 'pointer', fontSize: '14px', transition: 'all 150ms ease-out' },
  submitBtn: { padding: '10px 20px', background: theme.accent, color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500, transition: 'background 150ms ease-out' },
  derivedDay: { marginTop: '6px', fontSize: '13px', color: theme.accent, fontWeight: 500 },
  readOnlyInfo: { background: theme.bg, padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px', color: theme.textSecondary, border: `1px solid ${theme.border}` },
  emptyState: { textAlign: 'center', padding: '40px 20px' },
  emptyText: { color: theme.textSecondary, margin: 0, fontSize: '15px' },
  emptyHint: { color: theme.textMuted, fontSize: '13px', marginTop: '8px' },
  seriesList: { display: 'flex', flexDirection: 'column', gap: '12px' },
  seriesCard: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '16px 16px 16px 20px', background: theme.surfaceElevated, borderRadius: '10px', border: `1px solid ${theme.border}`, borderLeft: `3px solid ${theme.accent}` },
  seriesInfo: { flex: 1, minWidth: 0 },
  seriesTitle: { fontSize: '16px', fontWeight: 700, color: theme.textPrimary, marginBottom: '6px' },
  seriesMeta: { fontSize: '13px', color: theme.textSecondary, lineHeight: 1.5 },
  seriesNotes: { fontSize: '13px', color: theme.textMuted, marginTop: '8px', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  seriesActions: { display: 'flex', gap: '8px', flexShrink: 0, marginLeft: '16px' },
  iconBtn: { padding: '6px 12px', background: 'transparent', color: theme.textSecondary, border: `1px solid ${theme.border}`, borderRadius: '6px', cursor: 'pointer', fontSize: '13px', transition: 'all 150ms ease-out' },
  iconBtnDanger: { padding: '6px 12px', background: 'transparent', color: theme.textMuted, border: `1px solid ${theme.border}`, borderRadius: '6px', cursor: 'pointer', fontSize: '13px', transition: 'all 150ms ease-out' },
  settingsForm: { maxWidth: '600px' },
  settingRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 0', borderBottom: `1px solid ${theme.border}` },
  settingInfo: { flex: 1 },
  settingLabel: { fontSize: '15px', fontWeight: 500, color: theme.textPrimary },
  settingDesc: { fontSize: '13px', color: theme.textMuted, marginTop: '2px' },
  settingControl: { display: 'flex', alignItems: 'center', gap: '8px' },
  numberInput: { width: '80px', padding: '10px 12px', border: `1px solid ${theme.borderInput}`, borderRadius: '8px', fontSize: '14px', textAlign: 'center' as const, background: theme.inputSurface, color: theme.textPrimary },
  settingUnit: { fontSize: '14px', color: theme.textMuted },
  toggleLabel: { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' },
  checkbox: { width: '18px', height: '18px', accentColor: theme.accent },
  pausedLabel: { color: '#F87171', fontWeight: 500, fontSize: '14px' },
  activeLabel: { color: '#34D399', fontWeight: 500, fontSize: '14px' },
  reportSubtitle: { color: theme.textMuted, marginTop: '-16px', marginBottom: '24px', fontSize: '14px' },
  reportSectionTitle: { marginTop: '32px', marginBottom: '16px', fontSize: '16px', color: theme.textPrimary, fontWeight: 600 },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' },
  statCard: { background: theme.surfaceElevated, borderRadius: '10px', padding: '20px', textAlign: 'center' as const, border: `1px solid ${theme.border}` },
  statValue: { fontSize: '32px', fontWeight: 700, color: theme.textPrimary },
  statLabel: { fontSize: '13px', color: theme.textMuted, marginTop: '4px' },
  noData: { color: theme.textMuted, fontStyle: 'italic' },
  hostList: { display: 'flex', flexDirection: 'column', gap: '12px' },
  hostRow: { display: 'flex', alignItems: 'center', gap: '16px' },
  hostName: { width: '120px', fontSize: '14px', fontWeight: 500, color: theme.textPrimary },
  hostBar: { flex: 1, height: '24px', background: theme.bg, borderRadius: '4px', overflow: 'hidden' },
  hostBarFill: { height: '100%', background: theme.accent, borderRadius: '4px', transition: 'width 0.3s' },
  hostCount: { width: '40px', textAlign: 'right' as const, fontSize: '14px', fontWeight: 600, color: theme.textPrimary },
  // Pending user styles
  pendingText: { fontSize: '11px', color: '#FBBF24', fontStyle: 'italic' },
  pendingBadge: { background: 'rgba(251, 191, 36, 0.15)', color: '#FBBF24', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 500 },
  emptyField: { color: theme.textMuted },
  linkBtn: { padding: '6px 12px', background: theme.accent, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 500, transition: 'background 150ms ease-out' },
  optionalLabel: { color: theme.textMuted, fontWeight: 400, fontSize: '12px' },
  fieldHint: { fontSize: '12px', color: theme.textMuted, marginTop: '6px' },
  // Modal styles
  modalOverlay: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: theme.surface, borderRadius: '16px', padding: '28px', maxWidth: '480px', width: '90%', border: `1px solid ${theme.border}` },
  modalTitle: { marginTop: 0, marginBottom: '8px', fontSize: '18px', color: theme.textPrimary, fontWeight: 600 },
  modalDescription: { fontSize: '14px', color: theme.textMuted, marginBottom: '20px', lineHeight: 1.5 },
  // Action group styles
  actionGroup: { display: 'flex', gap: '6px', alignItems: 'center' },
  deleteBtn: { padding: '6px 10px', background: 'transparent', color: '#F87171', border: '1px solid rgba(248, 113, 113, 0.3)', borderRadius: '6px', cursor: 'pointer', fontSize: '16px', fontWeight: 600, lineHeight: 1, transition: 'all 150ms ease-out' },
  // System info
  systemInfo: { background: theme.surfaceElevated, borderRadius: '10px', padding: '4px 0', border: `1px solid ${theme.border}` },
  systemRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: `1px solid ${theme.border}` },
  systemLabel: { fontSize: '13px', color: theme.textMuted, fontWeight: 500 },
  systemValue: { fontSize: '13px', color: theme.textSecondary, fontFamily: 'monospace' },
  // Preview
  previewSection: { margin: '16px 0', padding: '12px 16px', background: theme.surfaceElevated, borderRadius: '8px', border: `1px solid ${theme.border}` },
  previewTitle: { fontSize: '11px', fontWeight: 700, color: theme.textMuted, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: '8px' },
  previewDate: { fontSize: '13px', color: theme.textSecondary, padding: '3px 0' },
};
