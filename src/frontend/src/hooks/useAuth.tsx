import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { AuthClient } from '@dfinity/auth-client';
import { Actor, HttpAgent, Identity } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';

// Backend canister interface (minimal for auth check)
const idlFactory = ({ IDL }: { IDL: any }) => {
  const Role = IDL.Variant({ 'Admin': IDL.Null, 'User': IDL.Null });
  const UserStatus = IDL.Variant({ 'Active': IDL.Null, 'Disabled': IDL.Null });
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
  const ApiError = IDL.Variant({
    'Unauthorized': IDL.Null,
    'NotFound': IDL.Null,
    'InvalidInput': IDL.Text,
    'Conflict': IDL.Text,
    'InternalError': IDL.Text,
  });
  const Result = IDL.Variant({ 'Ok': User, 'Err': ApiError });
  
  return IDL.Service({
    'get_current_user': IDL.Func([], [Result], ['query']),
    'whoami': IDL.Func([], [IDL.Principal], ['query']),
  });
};

// Types for user data
interface NotificationSettings {
  email_on_assigned: boolean;
  email_on_removed: boolean;
  email_on_cancelled: boolean;
  email_on_time_changed: boolean;
  email_unclaimed_reminder: boolean;
  reminder_hours_before: [number] | [];
}

interface User {
  principal: Principal;
  name: string;
  email: string;
  role: { Admin: null } | { User: null };
  status: { Active: null } | { Disabled: null };
  notification_settings: NotificationSettings;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isAuthorized: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  isSessionExpired: boolean;
  principal: Principal | null;
  user: User | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  clearExpiredSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Get the Internet Identity URL based on network
function getIdentityProviderUrl(): string {
  const network = import.meta.env.VITE_DFX_NETWORK || 'local';
  if (network === 'ic') {
    return 'https://id.ai';
  }
  // Local development - use the local II canister
  return `http://rdmx6-jaaaa-aaaaa-aaadq-cai.localhost:4943`;
}

// Check if an error is a signature/session expiry error
function isSessionExpiredError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
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
async function clearAuthStorage(): Promise<void> {
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
          console.log('Cleared IndexedDB:', db.name);
        }
      }
    } catch (e) {
      console.warn('Could not enumerate IndexedDB databases:', e);
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
      console.log('Cleared localStorage:', key);
    });
  }
}

// Backend canister ID - hardcoded for local, use env for prod
const BACKEND_CANISTER_ID = import.meta.env.VITE_BACKEND_CANISTER_ID || 'uxrrr-q7777-77774-qaaaq-cai';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authClient, setAuthClient] = useState<AuthClient | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const [principal, setPrincipal] = useState<Principal | null>(null);
  const [user, setUser] = useState<User | null>(null);

  // Clear expired session and reset state
  const clearExpiredSession = useCallback(async () => {
    console.log('Clearing expired session...');
    await clearAuthStorage();
    
    // Reset all auth state
    setIsAuthenticated(false);
    setIsAuthorized(false);
    setIsAdmin(false);
    setIsSessionExpired(false);
    setPrincipal(null);
    setUser(null);
    setAuthClient(null);
    
    // Recreate auth client
    const client = await AuthClient.create();
    setAuthClient(client);
    
    console.log('Session cleared. Please sign in again.');
  }, []);

  // Check if user is authorized in backend (standalone function, no deps)
  const checkAuthorizationAndSetState = useCallback(async (identity: Identity, client: AuthClient) => {
    try {
      const network = import.meta.env.VITE_DFX_NETWORK || 'local';
      const host = network === 'ic' ? 'https://icp-api.io' : 'http://localhost:4943';
      
      const agent = new HttpAgent({ identity, host });
      
      if (network !== 'ic') {
        await agent.fetchRootKey();
      }

      const actor = Actor.createActor(idlFactory, {
        agent,
        canisterId: BACKEND_CANISTER_ID,
      });

      const result = await actor.get_current_user() as { Ok?: any; Err?: any };
      
      if (result.Ok) {
        const userData = result.Ok;
        const principalId = identity.getPrincipal();
        setUser(userData);
        setIsAuthenticated(true);
        setPrincipal(principalId);
        setIsAuthorized(true);
        setIsAdmin('Admin' in userData.role);
        setIsSessionExpired(false);
        console.log('User authorized:', userData);
      } else {
        const principalId = identity.getPrincipal();
        console.log('User not authorized:', result.Err);
        setIsAuthenticated(true);
        setPrincipal(principalId);
        setIsAuthorized(false);
        setIsAdmin(false);
        setIsSessionExpired(false);
      }
      
    } catch (error) {
      console.error('Authorization check failed:', error);
      
      if (isSessionExpiredError(error)) {
        console.warn('Session expired - delegation/signature invalid');
        setIsSessionExpired(true);
        setIsAuthenticated(false);
        setIsAuthorized(false);
        setIsAdmin(false);
        
        await clearAuthStorage();
        
        if (client) {
          try { await client.logout(); } catch (e) {
            console.warn('Logout during session clear failed:', e);
          }
        }
        
        const newClient = await AuthClient.create();
        setAuthClient(newClient);
      } else {
        const principalId = identity.getPrincipal();
        setIsAuthenticated(true);
        setPrincipal(principalId);
        setIsAuthorized(false);
        setIsAdmin(false);
      }
    } finally {
      setIsLoading(false);
    }
  }, []); // No dependencies - this function is stable

  // Initialize auth client — runs once on mount
  useEffect(() => {
    let cancelled = false;
    AuthClient.create().then(async (client) => {
      if (cancelled) return;
      setAuthClient(client);
      
      if (await client.isAuthenticated()) {
        const identity = client.getIdentity();
        await checkAuthorizationAndSetState(identity, client);
      } else {
        setIsLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loginInProgressRef = useRef(false);

  const login = useCallback(async () => {
    // Prevent concurrent login attempts (React strict mode + double-render can cause multiple calls)
    if (loginInProgressRef.current) {
      console.log('[Auth] Login already in progress, skipping');
      return;
    }
    
    // If no authClient, try creating one fresh
    let client = authClient;
    if (!client) {
      console.log('[Auth] No authClient available, creating fresh one');
      client = await AuthClient.create();
      setAuthClient(client);
    }
    
    loginInProgressRef.current = true;
    
    // Clear any expired session state before attempting login
    setIsSessionExpired(false);
    setIsLoading(true);
    
    // Max delegation expiry: 30 days (in nanoseconds)
    const thirtyDaysInNanoseconds = BigInt(30 * 24 * 60 * 60 * 1000 * 1000 * 1000);
    
    console.log('[Auth] Calling authClient.login with provider:', getIdentityProviderUrl());
    try {
      await client.login({
        identityProvider: getIdentityProviderUrl(),
        maxTimeToLive: thirtyDaysInNanoseconds,
        onSuccess: async () => {
          console.log('[Auth] Login success callback');
          loginInProgressRef.current = false;
          const identity = client!.getIdentity();
          await checkAuthorizationAndSetState(identity, client!);
        },
        onError: (error) => {
          console.error('[Auth] Login error:', error);
          loginInProgressRef.current = false;
          setIsLoading(false);
        },
      });
    } catch (e) {
      console.error('[Auth] Login exception:', e);
      loginInProgressRef.current = false;
      setIsLoading(false);
    }
    console.log('[Auth] authClient.login returned');
  }, [authClient, checkAuthorizationAndSetState]);

  const logout = useCallback(async () => {
    if (!authClient) return;
    
    await authClient.logout();
    setIsAuthenticated(false);
    setIsAuthorized(false);
    setIsAdmin(false);
    setIsSessionExpired(false);
    setPrincipal(null);
    setUser(null);
  }, [authClient]);

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      isAuthorized,
      isAdmin,
      isLoading,
      isSessionExpired,
      principal,
      user,
      login,
      logout,
      clearExpiredSession,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
