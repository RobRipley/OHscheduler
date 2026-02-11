import { useState, useEffect, useCallback, useContext, createContext, ReactNode } from 'react';
import { Actor, HttpAgent, Identity } from '@dfinity/agent';
import { AuthClient } from '@dfinity/auth-client';
import { Principal } from '@dfinity/principal';

// Full backend canister IDL
const idlFactory = ({ IDL }: { IDL: any }) => {
  const Role = IDL.Variant({ 'Admin': IDL.Null, 'User': IDL.Null });
  const UserStatus = IDL.Variant({ 'Active': IDL.Null, 'Disabled': IDL.Null });
  const Frequency = IDL.Variant({ 'Weekly': IDL.Null, 'Biweekly': IDL.Null, 'Monthly': IDL.Null });
  const Weekday = IDL.Variant({ 
    'Mon': IDL.Null, 'Tue': IDL.Null, 'Wed': IDL.Null, 
    'Thu': IDL.Null, 'Fri': IDL.Null, 'Sat': IDL.Null, 'Sun': IDL.Null 
  });
  const WeekdayOrdinal = IDL.Variant({ 
    'First': IDL.Null, 'Second': IDL.Null, 'Third': IDL.Null, 
    'Fourth': IDL.Null, 'Last': IDL.Null 
  });
  const EventStatus = IDL.Variant({ 'Active': IDL.Null, 'Cancelled': IDL.Null });
  
  const OOOBlock = IDL.Record({
    'start_utc': IDL.Nat64,
    'end_utc': IDL.Nat64,
  });

  const NotificationSettings = IDL.Record({
    'email_on_assigned': IDL.Bool,
    'email_on_removed': IDL.Bool,
    'email_on_cancelled': IDL.Bool,
    'email_on_time_changed': IDL.Bool,
    'email_unclaimed_reminder': IDL.Bool,
    'reminder_hours_before': IDL.Opt(IDL.Nat32),
  });

  const User = IDL.Record({
    'principal': IDL.Principal,
    'name': IDL.Text,
    'email': IDL.Text,
    'role': Role,
    'status': UserStatus,
    'out_of_office': IDL.Vec(OOOBlock),
    'notification_settings': NotificationSettings,
    'last_active': IDL.Nat64,
    'sessions_hosted_count': IDL.Nat32,
    'created_at': IDL.Nat64,
    'updated_at': IDL.Nat64,
  });

  const EventSeries = IDL.Record({
    'series_id': IDL.Vec(IDL.Nat8),
    'title': IDL.Text,
    'notes': IDL.Text,
    'link': IDL.Opt(IDL.Text),
    'frequency': Frequency,
    'weekday': Weekday,
    'weekday_ordinal': IDL.Opt(WeekdayOrdinal),
    'start_date': IDL.Nat64,
    'end_date': IDL.Opt(IDL.Nat64),
    'default_duration_minutes': IDL.Nat32,
    'color': IDL.Opt(IDL.Text),
    'paused': IDL.Bool,
    'created_at': IDL.Nat64,
    'created_by': IDL.Principal,
  });


  const EventInstance = IDL.Record({
    'instance_id': IDL.Vec(IDL.Nat8),
    'series_id': IDL.Opt(IDL.Vec(IDL.Nat8)),
    'start_utc': IDL.Nat64,
    'end_utc': IDL.Nat64,
    'title': IDL.Text,
    'notes': IDL.Text,
    'link': IDL.Opt(IDL.Text),
    'host_principal': IDL.Opt(IDL.Principal),
    'status': EventStatus,
    'created_at': IDL.Nat64,
  });

  const GlobalSettings = IDL.Record({
    'forward_window_months': IDL.Nat8,
    'claims_paused': IDL.Bool,
    'default_event_duration_minutes': IDL.Nat32,
  });

  const CreateEventInput = IDL.Record({
    'title': IDL.Text,
    'notes': IDL.Text,
    'link': IDL.Opt(IDL.Text),
    'start_utc': IDL.Nat64,
    'end_utc': IDL.Nat64,
    'host_principal': IDL.Opt(IDL.Principal),
  });

  const CreateSeriesInput = IDL.Record({
    'title': IDL.Text,
    'notes': IDL.Text,
    'link': IDL.Opt(IDL.Text),
    'frequency': Frequency,
    'weekday': Weekday,
    'weekday_ordinal': IDL.Opt(WeekdayOrdinal),
    'start_date': IDL.Nat64,
    'end_date': IDL.Opt(IDL.Nat64),
    'default_duration_minutes': IDL.Opt(IDL.Nat32),
  });


  const UpdateSeriesInput = IDL.Record({
    'title': IDL.Opt(IDL.Text),
    'notes': IDL.Opt(IDL.Text),
    'end_date': IDL.Opt(IDL.Opt(IDL.Nat64)),
    'default_duration_minutes': IDL.Opt(IDL.Nat32),
    'color': IDL.Opt(IDL.Opt(IDL.Text)),
    'paused': IDL.Opt(IDL.Bool),
  });

  const ApiError = IDL.Variant({
    'Unauthorized': IDL.Null,
    'NotFound': IDL.Null,
    'InvalidInput': IDL.Text,
    'Conflict': IDL.Text,
    'InternalError': IDL.Text,
  });

  const Result_User = IDL.Variant({ 'Ok': User, 'Err': ApiError });
  const Result_Vec_User = IDL.Variant({ 'Ok': IDL.Vec(User), 'Err': ApiError });
  const Result_Unit = IDL.Variant({ 'Ok': IDL.Null, 'Err': ApiError });
  const Result_Vec_EventInstance = IDL.Variant({ 'Ok': IDL.Vec(EventInstance), 'Err': ApiError });
  const Result_EventInstance = IDL.Variant({ 'Ok': EventInstance, 'Err': ApiError });
  const Result_EventSeries = IDL.Variant({ 'Ok': EventSeries, 'Err': ApiError });
  const Result_Vec_EventSeries = IDL.Variant({ 'Ok': IDL.Vec(EventSeries), 'Err': ApiError });
  const Result_GlobalSettings = IDL.Variant({ 'Ok': GlobalSettings, 'Err': ApiError });
  const Result_String = IDL.Variant({ 'Ok': IDL.Text, 'Err': ApiError });

  return IDL.Service({
    // Auth / User
    'get_current_user': IDL.Func([], [Result_User], ['query']),
    'whoami': IDL.Func([], [IDL.Principal], ['query']),
    'update_notification_settings': IDL.Func([NotificationSettings], [Result_Unit], []),
    'set_out_of_office': IDL.Func([IDL.Vec(OOOBlock)], [Result_Unit], []),

    // Admin - Users  
    'list_users': IDL.Func([], [Result_Vec_User], ['query']),
    'authorize_user': IDL.Func([IDL.Principal, IDL.Text, IDL.Text, Role], [Result_User], []),
    'disable_user': IDL.Func([IDL.Principal], [Result_Unit], []),
    'enable_user': IDL.Func([IDL.Principal], [Result_Unit], []),
    'update_user': IDL.Func([IDL.Principal, IDL.Text, IDL.Text, Role], [Result_User], []),


    // Events - Authenticated
    'list_events': IDL.Func([IDL.Nat64, IDL.Nat64], [Result_Vec_EventInstance], ['query']),
    'list_unclaimed_events': IDL.Func([], [Result_Vec_EventInstance], ['query']),
    'create_one_off_event': IDL.Func([CreateEventInput], [Result_EventInstance], []),

    // Event Series (Admin)
    'create_event_series': IDL.Func([CreateSeriesInput], [Result_EventSeries], []),
    'update_event_series': IDL.Func([IDL.Vec(IDL.Nat8), UpdateSeriesInput], [Result_EventSeries], []),
    'delete_event_series': IDL.Func([IDL.Vec(IDL.Nat8)], [Result_Unit], []),
    'list_event_series': IDL.Func([], [Result_Vec_EventSeries], ['query']),

    // Series Pause/Resume
    'toggle_series_pause': IDL.Func([IDL.Vec(IDL.Nat8)], [Result_EventSeries], []),

    // CSV Export
    'export_events_csv': IDL.Func([IDL.Nat64, IDL.Nat64], [Result_String], ['query']),

    // Coverage Queue
    'assign_host': IDL.Func(
      [IDL.Opt(IDL.Vec(IDL.Nat8)), IDL.Opt(IDL.Nat64), IDL.Vec(IDL.Nat8), IDL.Principal], 
      [Result_EventInstance], 
      []
    ),
    'unassign_host': IDL.Func(
      [IDL.Opt(IDL.Vec(IDL.Nat8)), IDL.Opt(IDL.Nat64), IDL.Vec(IDL.Nat8)], 
      [Result_EventInstance], 
      []
    ),

    // Admin - System
    'update_global_settings': IDL.Func([GlobalSettings], [Result_Unit], []),
    'get_global_settings': IDL.Func([], [Result_GlobalSettings], ['query']),

    // ICS
    'get_event_ics': IDL.Func([IDL.Vec(IDL.Nat8)], [Result_String], ['query']),
  });
};


// TypeScript types
export interface User {
  principal: Principal;
  name: string;
  email: string;
  role: { Admin: null } | { User: null };
  status: { Active: null } | { Disabled: null };
  out_of_office: OOOBlock[];
  notification_settings: NotificationSettings;
  last_active: bigint;
  sessions_hosted_count: number;
  created_at: bigint;
  updated_at: bigint;
}

export interface OOOBlock {
  start_utc: bigint;
  end_utc: bigint;
}

export interface NotificationSettings {
  email_on_assigned: boolean;
  email_on_removed: boolean;
  email_on_cancelled: boolean;
  email_on_time_changed: boolean;
  email_unclaimed_reminder: boolean;
  reminder_hours_before: [number] | [];
}

export interface EventInstance {
  instance_id: Uint8Array | number[];
  series_id: [Uint8Array | number[]] | [];
  start_utc: bigint;
  end_utc: bigint;
  title: string;
  notes: string;
  link: [string] | [];
  host_principal: [Principal] | [];
  status: { Active: null } | { Cancelled: null };
  created_at: bigint;
}


export interface EventSeries {
  series_id: Uint8Array | number[];
  title: string;
  notes: string;
  link: [string] | [];
  frequency: { Weekly: null } | { Biweekly: null } | { Monthly: null };
  weekday: { Mon: null } | { Tue: null } | { Wed: null } | { Thu: null } | { Fri: null } | { Sat: null } | { Sun: null };
  weekday_ordinal: [{ First: null } | { Second: null } | { Third: null } | { Fourth: null } | { Last: null }] | [];
  start_date: bigint;
  end_date: [bigint] | [];
  default_duration_minutes: number;
  color: [string] | [];
  paused: boolean;
  created_at: bigint;
  created_by: Principal;
}

export interface GlobalSettings {
  forward_window_months: number;
  claims_paused: boolean;
  default_event_duration_minutes: number;
}

export interface CreateSeriesInput {
  title: string;
  notes: string;
  link: [string] | [];
  frequency: { Weekly: null } | { Biweekly: null } | { Monthly: null };
  weekday: { Mon: null } | { Tue: null } | { Wed: null } | { Thu: null } | { Fri: null } | { Sat: null } | { Sun: null };
  weekday_ordinal: [{ First: null } | { Second: null } | { Third: null } | { Fourth: null } | { Last: null }] | [];
  start_date: bigint;
  end_date: [bigint] | [];
  default_duration_minutes: [number] | [];
}


// Backend canister ID
const BACKEND_CANISTER_ID = import.meta.env.VITE_BACKEND_CANISTER_ID || 'uxrrr-q7777-77774-qaaaq-cai';

// ==================== SESSION EXPIRY DETECTION ====================

// Check if an error is a signature/session expiry error
export function isSessionExpiredError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('invalid signature') ||
      message.includes('signature could not be verified') ||
      message.includes('certificate is not valid') ||
      message.includes('delegation has expired') ||
      message.includes('certificate verification failed')
    );
  }
  // Also check for string-based error messages (e.g., from server responses)
  if (typeof error === 'string') {
    const message = error.toLowerCase();
    return (
      message.includes('invalid signature') ||
      message.includes('signature could not be verified') ||
      message.includes('certificate is not valid') ||
      message.includes('delegation has expired')
    );
  }
  return false;
}

// Clear all auth-related storage
export async function clearAuthStorage(): Promise<void> {
  // Clear IndexedDB databases
  if (typeof indexedDB !== 'undefined' && indexedDB.databases) {
    try {
      const databases = await indexedDB.databases();
      for (const db of databases) {
        if (db.name && (
          db.name.includes('auth') || 
          db.name.includes('identity') || 
          db.name.includes('delegation')
        )) {
          indexedDB.deleteDatabase(db.name);
          console.log('[useBackend] Cleared IndexedDB:', db.name);
        }
      }
    } catch (e) {
      console.warn('[useBackend] Could not enumerate IndexedDB databases:', e);
    }
  }
  
  // Clear localStorage items
  if (typeof localStorage !== 'undefined') {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.includes('auth') || 
        key.includes('identity') || 
        key.includes('delegation') || 
        key.includes('ic-')
      )) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      console.log('[useBackend] Cleared localStorage:', key);
    });
  }
}


// ==================== BACKEND CONTEXT ====================

interface BackendContextType {
  actor: any;
  loading: boolean;
  sessionExpired: boolean;
  triggerSessionExpired: () => void;
  refreshActor: () => Promise<void>;
  safeCall: <T>(fn: () => Promise<T>) => Promise<T>;
}

const BackendContext = createContext<BackendContextType | null>(null);

// Singleton actor management
let cachedActor: any = null;
let cachedIdentityPrincipal: string | null = null;

async function createActor(identity?: Identity) {
  // Get the principal string for comparison
  const currentPrincipal = identity ? identity.getPrincipal().toText() : 'anonymous';
  
  // If identity changed (different principal), recreate actor
  if (currentPrincipal !== cachedIdentityPrincipal) {
    console.log('[createActor] Identity changed, recreating actor. Old:', cachedIdentityPrincipal, 'New:', currentPrincipal);
    cachedIdentityPrincipal = currentPrincipal;
    cachedActor = null;
  }
  
  if (cachedActor) return cachedActor;
  
  const network = import.meta.env.VITE_DFX_NETWORK || 'local';
  const host = network === 'ic' ? 'https://icp-api.io' : 'http://localhost:4943';
  
  let agent: HttpAgent;
  
  if (identity) {
    agent = new HttpAgent({ identity, host });
  } else {
    agent = new HttpAgent({ host });
  }
  
  if (network !== 'ic') {
    await agent.fetchRootKey();
  }
  
  cachedActor = Actor.createActor(idlFactory, {
    agent,
    canisterId: BACKEND_CANISTER_ID,
  });
  
  return cachedActor;
}


// ==================== BACKEND PROVIDER ====================

export function BackendProvider({ children }: { children: ReactNode }) {
  const [actor, setActor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  const initActor = useCallback(async () => {
    try {
      const authClient = await AuthClient.create();
      const identity = authClient.getIdentity();
      const backendActor = await createActor(identity);
      setActor(backendActor);
      setSessionExpired(false);
    } catch (err) {
      console.error('[BackendProvider] Failed to init actor:', err);
      if (isSessionExpiredError(err)) {
        setSessionExpired(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    initActor();
  }, [initActor]);

  // Trigger session expired state (called when API calls fail with signature errors)
  const triggerSessionExpired = useCallback(() => {
    console.warn('[BackendProvider] Session expired detected, clearing cached actor...');
    setSessionExpired(true);
    // Clear cached actor so it gets recreated with fresh identity
    cachedActor = null;
    cachedIdentityPrincipal = null;
    // NOTE: Don't clear auth storage here - let useAuth handle that during re-login
    // Clearing here was causing a loop where fresh logins would have their storage cleared
  }, []);


  // Refresh actor (after re-authentication)
  const refreshActor = useCallback(async () => {
    setLoading(true);
    cachedActor = null;
    cachedIdentityPrincipal = null;
    await initActor();
  }, [initActor]);

  // Safe API call wrapper that detects session expiry
  const safeCall = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch (error) {
      if (isSessionExpiredError(error)) {
        triggerSessionExpired();
        throw new Error('Your session has expired. Please sign in again.');
      }
      throw error;
    }
  }, [triggerSessionExpired]);

  return (
    <BackendContext.Provider value={{
      actor,
      loading,
      sessionExpired,
      triggerSessionExpired,
      refreshActor,
      safeCall,
    }}>
      {children}
    </BackendContext.Provider>
  );
}


// ==================== HOOKS ====================

// Main hook - use BackendProvider context if available, fallback to direct actor creation
export function useBackend() {
  const context = useContext(BackendContext);
  
  // If context is available (BackendProvider is used), return it
  if (context) {
    return context;
  }
  
  // Fallback for backward compatibility (if BackendProvider is not used)
  const [actor, setActor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        const authClient = await AuthClient.create();
        const identity = authClient.getIdentity();
        const backendActor = await createActor(identity);
        setActor(backendActor);
      } catch (err) {
        console.error('[useBackend] Failed to init backend actor:', err);
        if (isSessionExpiredError(err)) {
          setSessionExpired(true);
        }
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const triggerSessionExpired = useCallback(() => {
    setSessionExpired(true);
    // Clear cached actor so it gets recreated with fresh identity
    cachedActor = null;
    cachedIdentityPrincipal = null;
    // NOTE: Don't clear auth storage here - let useAuth handle it
  }, []);


  const safeCall = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch (error) {
      if (isSessionExpiredError(error)) {
        triggerSessionExpired();
        throw new Error('Your session has expired. Please sign in again.');
      }
      throw error;
    }
  }, [triggerSessionExpired]);

  return { 
    actor, 
    loading, 
    sessionExpired, 
    triggerSessionExpired,
    refreshActor: async () => {}, // No-op in fallback mode
    safeCall,
  };
}

// ==================== UTILITIES ====================

// Utility to convert bytes to hex string for display
export function bytesToHex(bytes: Uint8Array | number[]): string {
  const arr = Array.from(bytes);
  return arr.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Utility to convert nanoseconds to Date
export function nanosToDate(nanos: bigint): Date {
  return new Date(Number(nanos / BigInt(1_000_000)));
}

// Utility to convert Date to nanoseconds
export function dateToNanos(date: Date): bigint {
  return BigInt(date.getTime()) * BigInt(1_000_000);
}
