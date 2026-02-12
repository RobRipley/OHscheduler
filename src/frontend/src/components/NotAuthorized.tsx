import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Actor, HttpAgent } from '@dfinity/agent';
import { AuthClient } from '@dfinity/auth-client';
import { useAuth } from '../hooks/useAuth';
import { Button } from './ui';
import { theme } from '../theme';

// Minimal IDL just for redeem_invite_code
  const redeemIdlFactory = ({ IDL }: { IDL: any }) => {
  const Role = IDL.Variant({ 'Admin': IDL.Null, 'User': IDL.Null });
  const UserStatus = IDL.Variant({ 'Active': IDL.Null, 'Disabled': IDL.Null });
  const OOOBlock = IDL.Record({ 'start_utc': IDL.Nat64, 'end_utc': IDL.Nat64 });
  const NotificationSettings = IDL.Record({
    'email_on_assigned': IDL.Bool, 'email_on_removed': IDL.Bool,
    'email_on_cancelled': IDL.Bool, 'email_on_time_changed': IDL.Bool,
    'email_unclaimed_reminder': IDL.Bool, 'reminder_hours_before': IDL.Opt(IDL.Nat32),
  });
  const User = IDL.Record({
    'principal': IDL.Principal, 'name': IDL.Text, 'email': IDL.Text,
    'role': Role, 'status': UserStatus, 'out_of_office': IDL.Vec(OOOBlock),
    'notification_settings': NotificationSettings,
    'last_active': IDL.Nat64, 'sessions_hosted_count': IDL.Nat32,
    'created_at': IDL.Nat64, 'updated_at': IDL.Nat64,
  });
  const ApiError = IDL.Variant({
    'Unauthorized': IDL.Null, 'NotFound': IDL.Null,
    'InvalidInput': IDL.Text, 'Conflict': IDL.Text, 'InternalError': IDL.Text,
  });
  const Result_User = IDL.Variant({ 'Ok': User, 'Err': ApiError });
  return IDL.Service({
    'redeem_invite_code': IDL.Func([IDL.Text, IDL.Text, IDL.Text], [Result_User], []),
  });
};

const BACKEND_CANISTER_ID = import.meta.env.VITE_BACKEND_CANISTER_ID || 'uxrrr-q7777-77774-qaaaq-cai';

export default function NotAuthorized() {
  const { principal, logout, isSessionExpired, login } = useAuth();
  const [copied, setCopied] = useState(false);
  
  // Invite code state
  const [inviteCode, setInviteCode] = useState('');
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [redeemSuccess, setRedeemSuccess] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  
  // Split code into segments for the segmented input
  const [seg1, setSeg1] = useState('');
  const [seg2, setSeg2] = useState('');
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  
  const principalText = principal?.toText() || 'Unknown';
  
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(principalText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Auto-format and handle paste for invite codes
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').trim().toUpperCase();
    // Try to parse "YS-XXXX-XXXX" format
    const match = pasted.match(/^(?:YS-?)?([A-Z0-9]{4})-?([A-Z0-9]{4})$/);
    if (match) {
      setSeg1(match[1]);
      setSeg2(match[2]);
      inputRefs.current[1]?.focus();
    } else if (pasted.length <= 4) {
      setSeg1(pasted.slice(0, 4));
      if (pasted.length === 4) inputRefs.current[1]?.focus();
    }
  }, []);
  
  const handleSeg1Change = (val: string) => {
    const clean = val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    setSeg1(clean);
    if (clean.length === 4) inputRefs.current[1]?.focus();
    setRedeemError(null);
  };
  
  const handleSeg2Change = (val: string) => {
    const clean = val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    setSeg2(clean);
    setRedeemError(null);
  };
  
  const handleSeg2Backspace = (e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && seg2 === '') {
      inputRefs.current[0]?.focus();
    }
  };

  const fullCode = seg1.length === 4 && seg2.length === 4 ? `YS-${seg1}-${seg2}` : '';
  const canRedeem = !!fullCode && userName.trim().length > 0 && userEmail.trim().includes('@');

  const handleRedeem = async () => {
    if (!canRedeem) return;
    setRedeemLoading(true);
    setRedeemError(null);
    
    try {
      const authClient = await AuthClient.create();
      const identity = authClient.getIdentity();
      const host = import.meta.env.VITE_DFX_NETWORK === 'ic' 
        ? 'https://icp-api.io' 
        : 'http://localhost:4943';
      const agent = await HttpAgent.create({ host, identity });
      if (import.meta.env.VITE_DFX_NETWORK !== 'ic') {
        await agent.fetchRootKey();
      }
      const actor = Actor.createActor(redeemIdlFactory, { agent, canisterId: BACKEND_CANISTER_ID });
      
      const result: any = await actor.redeem_invite_code(fullCode, userName.trim(), userEmail.trim());
      
      if ('Ok' in result) {
        setRedeemSuccess(true);
        // Brief pause then reload to re-check auth status
        setTimeout(() => window.location.reload(), 1500);
      } else if ('Err' in result) {
        const err = result.Err;
        if ('InvalidInput' in err) setRedeemError(err.InvalidInput);
        else if ('Conflict' in err) setRedeemError(err.Conflict);
        else if ('InternalError' in err) setRedeemError(err.InternalError);
        else if ('NotFound' in err) setRedeemError('Invite code not found.');
        else if ('Unauthorized' in err) setRedeemError('Authentication required. Try signing out and back in.');
        else setRedeemError('Failed to redeem invite code. Error: ' + JSON.stringify(err));
      }
    } catch (err: any) {
      console.error('Redeem error:', err);
      setRedeemError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setRedeemLoading(false);
    }
  };

  // Show session expired message if that's the issue
  if (isSessionExpired) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.title}>Session Expired</h1>
          <p style={styles.description}>
            Your session has expired. This happens after a period of inactivity.
            Please sign in again to continue.
          </p>
          <div style={styles.actions}>
            <button onClick={login} style={styles.primaryBtn}>
              Sign In Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (redeemSuccess) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.successIcon}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={theme.success} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h1 style={{ ...styles.title, textAlign: 'center' }}>You're in!</h1>
          <p style={{ ...styles.description, textAlign: 'center' }}>
            Your account has been activated. Redirecting to your dashboard...
          </p>
          <div style={styles.progressBar}>
            <div style={styles.progressFill} />
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Invite code section — the hero */}
        <div style={styles.inviteSection}>
          <div style={styles.inviteIcon}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={theme.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 style={styles.inviteTitle}>Enter your invite code</h1>
          <p style={styles.inviteDesc}>
            Paste or type the code your admin shared with you.
          </p>
          
          <div style={styles.codeInputGroup} onPaste={handlePaste}>
            <span style={styles.codePrefix}>YS</span>
            <span style={styles.codeDash}>–</span>
            <input
              ref={el => inputRefs.current[0] = el}
              type="text"
              value={seg1}
              onChange={e => handleSeg1Change(e.target.value)}
              placeholder="····"
              style={styles.codeInput}
              maxLength={4}
              autoFocus
              spellCheck={false}
              autoComplete="off"
            />
            <span style={styles.codeDash}>–</span>
            <input
              ref={el => inputRefs.current[1] = el}
              type="text"
              value={seg2}
              onChange={e => handleSeg2Change(e.target.value)}
              onKeyDown={handleSeg2Backspace}
              placeholder="····"
              style={styles.codeInput}
              maxLength={4}
              spellCheck={false}
              autoComplete="off"
            />
          </div>
          
          {redeemError && (
            <div style={styles.errorMsg}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              {redeemError}
            </div>
          )}

          {fullCode && (
            <div style={styles.nameEmailGroup}>
              <input
                type="text"
                value={userName}
                onChange={e => { setUserName(e.target.value); setRedeemError(null); }}
                placeholder="Your name"
                style={styles.textInput}
                spellCheck={false}
                autoComplete="name"
              />
              <input
                type="email"
                value={userEmail}
                onChange={e => { setUserEmail(e.target.value); setRedeemError(null); }}
                placeholder="Your email"
                style={styles.textInput}
                spellCheck={false}
                autoComplete="email"
              />
            </div>
          )}
          
          <Button
            variant="primary"
            onClick={handleRedeem}
            loading={redeemLoading}
            disabled={!canRedeem}
            style={{ width: '100%', padding: '14px', fontSize: '15px', marginTop: '8px' }}
          >
            Activate Account
          </Button>
        </div>

        {/* Divider */}
        <div className="invite-divider">
          <span style={styles.dividerText}>or</span>
        </div>

        {/* Fallback: manual principal sharing */}
        <div style={styles.fallbackSection}>
          <p style={styles.fallbackDesc}>
            Don't have a code? Share your principal ID with an admin:
          </p>
          <div style={styles.principalBox}>
            <code style={styles.principalText}>{principalText}</code>
            <button onClick={copyToClipboard} style={styles.copyBtn}>
              {copied ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={theme.success} strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              )}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        <div style={styles.footerActions}>
          <button onClick={() => window.location.reload()} style={styles.ghostBtn}>
            Check again
          </button>
          <button onClick={logout} style={styles.ghostBtn}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}


const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    background: theme.bg,
  },
  card: {
    background: theme.surface,
    borderRadius: '20px',
    padding: '40px',
    maxWidth: '460px',
    width: '100%',
    border: `1px solid ${theme.border}`,
  },

  // Invite section
  inviteSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  inviteIcon: {
    width: '56px',
    height: '56px',
    borderRadius: '14px',
    background: theme.accentMuted,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '20px',
  },
  inviteTitle: {
    fontSize: '22px',
    fontWeight: 600,
    color: theme.textPrimary,
    margin: '0 0 8px 0',
    textAlign: 'center' as const,
  },
  inviteDesc: {
    fontSize: '14px',
    color: theme.textMuted,
    margin: '0 0 24px 0',
    textAlign: 'center' as const,
    lineHeight: 1.5,
  },

  // Code input group
  codeInputGroup: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    marginBottom: '16px',
    width: '100%',
  },
  codePrefix: {
    fontSize: '18px',
    fontWeight: 700,
    fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
    color: theme.textMuted,
    letterSpacing: '0.05em',
    userSelect: 'none' as const,
  },
  codeDash: {
    fontSize: '18px',
    color: theme.textMuted,
    userSelect: 'none' as const,
  },
  codeInput: {
    width: '96px',
    padding: '14px 8px',
    fontSize: '20px',
    fontWeight: 600,
    fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
    letterSpacing: '0.15em',
    textAlign: 'center' as const,
    background: theme.inputSurface,
    border: `1.5px solid ${theme.borderInput}`,
    borderRadius: '10px',
    color: theme.textPrimary,
    outline: 'none',
    transition: 'border-color 200ms ease, box-shadow 200ms ease',
    textTransform: 'uppercase' as const,
  },
  errorMsg: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: theme.danger,
    fontSize: '13px',
    marginBottom: '8px',
    padding: '8px 12px',
    background: theme.dangerMuted,
    borderRadius: '8px',
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  nameEmailGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
    width: '100%',
    marginBottom: '8px',
  },
  textInput: {
    width: '100%',
    padding: '12px 14px',
    fontSize: '14px',
    background: theme.inputSurface,
    border: `1.5px solid ${theme.borderInput}`,
    borderRadius: '10px',
    color: theme.textPrimary,
    outline: 'none',
    transition: 'border-color 200ms ease, box-shadow 200ms ease',
    boxSizing: 'border-box' as const,
  },

  // Divider
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    margin: '28px 0',
  },
  dividerText: {
    fontSize: '12px',
    color: theme.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    fontWeight: 500,
    whiteSpace: 'nowrap' as const,
    flex: 'none',
    padding: '0 8px',
    position: 'relative' as const,
    background: theme.surface,
    // We'll do the line via a pseudo-element workaround with border
  },

  // Fallback section
  fallbackSection: {
    padding: '0 4px',
  },
  fallbackDesc: {
    fontSize: '13px',
    color: theme.textMuted,
    margin: '0 0 12px 0',
    lineHeight: 1.5,
  },
  principalBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: theme.inputSurface,
    padding: '10px 12px',
    borderRadius: '8px',
    border: `1px solid ${theme.border}`,
  },
  principalText: {
    flex: 1,
    fontSize: '11px',
    wordBreak: 'break-all' as const,
    color: theme.textSecondary,
    fontFamily: 'monospace',
    lineHeight: 1.4,
  },
  copyBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 10px',
    fontSize: '12px',
    fontWeight: 500,
    background: 'transparent',
    color: theme.textSecondary,
    border: `1px solid ${theme.border}`,
    borderRadius: '6px',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    transition: 'all 150ms ease-out',
    flexShrink: 0,
  },

  // Footer
  footerActions: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'center',
    marginTop: '24px',
  },
  ghostBtn: {
    padding: '8px 16px',
    fontSize: '13px',
    background: 'transparent',
    color: theme.textMuted,
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'color 150ms ease-out',
  },
  primaryBtn: {
    flex: 1,
    padding: '12px 20px',
    fontSize: '14px',
    background: theme.accent,
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: 500,
    transition: 'background 150ms ease-out',
  },
  actions: {
    display: 'flex',
    gap: '12px',
  },

  // Success state
  successIcon: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '16px',
  },
  progressBar: {
    width: '100%',
    height: '3px',
    background: theme.inputSurface,
    borderRadius: '2px',
    overflow: 'hidden',
    marginTop: '20px',
  },
  progressFill: {
    height: '100%',
    background: theme.success,
    borderRadius: '2px',
    animation: 'progressSlide 1.5s ease-out forwards',
    width: '0%',
  },

  title: {
    fontSize: '24px',
    marginBottom: '16px',
    color: theme.textPrimary,
    fontWeight: 600,
  },
  description: {
    fontSize: '15px',
    color: theme.textSecondary,
    lineHeight: 1.6,
    marginBottom: '24px',
  },
};