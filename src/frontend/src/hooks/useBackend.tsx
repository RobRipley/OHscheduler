import { useState, useEffect, useCallback } from 'react';
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
    'created_at': IDL.Nat64,
    'updated_at': IDL.Nat64,
  });

  const EventSeries = IDL.Record({
    'series_id': IDL.Vec(IDL.Nat8),
    'title': IDL.Text,
    'notes': IDL.Text,
    'frequency': Frequency,
    'weekday': Weekday,
    'weekday_ordinal': IDL.Opt(WeekdayOrdinal),
    'start_date': IDL.Nat64,
    'end_date': IDL.Opt(IDL.Nat64),
    'default_duration_minutes': IDL.Nat32,
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
    'start_utc': IDL.Nat64,
    'end_utc': IDL.Nat64,
    'host_principal': IDL.Opt(IDL.Principal),
  });

  const CreateSeriesInput = IDL.Record({
    'title': IDL.Text,
    'notes': IDL.Text,
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
  host_principal: [Principal] | [];
  status: { Active: null } | { Cancelled: null };
  created_at: bigint;
}

export interface EventSeries {
  series_id: Uint8Array | number[];
  title: string;
  notes: string;
  frequency: { Weekly: null } | { Biweekly: null } | { Monthly: null };
  weekday: { Mon: null } | { Tue: null } | { Wed: null } | { Thu: null } | { Fri: null } | { Sat: null } | { Sun: null };
  weekday_ordinal: [{ First: null } | { Second: null } | { Third: null } | { Fourth: null } | { Last: null }] | [];
  start_date: bigint;
  end_date: [bigint] | [];
  default_duration_minutes: number;
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
  frequency: { Weekly: null } | { Biweekly: null } | { Monthly: null };
  weekday: { Mon: null } | { Tue: null } | { Wed: null } | { Thu: null } | { Fri: null } | { Sat: null } | { Sun: null };
  weekday_ordinal: [{ First: null } | { Second: null } | { Third: null } | { Fourth: null } | { Last: null }] | [];
  start_date: bigint;
  end_date: [bigint] | [];
  default_duration_minutes: [number] | [];
}

// Backend canister ID
const BACKEND_CANISTER_ID = import.meta.env.VITE_BACKEND_CANISTER_ID || 'uxrrr-q7777-77774-qaaaq-cai';

// Singleton actor with identity
let cachedActor: any = null;
let cachedIdentity: Identity | null = null;

async function getActor(identity?: Identity) {
  // If identity changed, recreate actor
  if (identity && identity !== cachedIdentity) {
    cachedIdentity = identity;
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

// Hook to get backend actor with current identity
export function useBackend() {
  const [actor, setActor] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        const authClient = await AuthClient.create();
        const identity = authClient.getIdentity();
        const backendActor = await getActor(identity);
        setActor(backendActor);
      } catch (err) {
        console.error('Failed to init backend actor:', err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  return { actor, loading };
}

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
