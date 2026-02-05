import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

// ==================== STORAGE ====================

function getStoredTimezone(): string {
  return localStorage.getItem('ohscheduler_timezone') || Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function setStoredTimezone(tz: string): void {
  localStorage.setItem('ohscheduler_timezone', tz);
}

// ==================== COMMON TIMEZONES ====================

export const COMMON_TIMEZONES = [
  'America/New_York',
  'America/Chicago', 
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Australia/Sydney',
  'UTC',
];

// ==================== HELPERS ====================

export function getTimezoneAbbrev(tz: string, date: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'short',
    }).formatToParts(date);
    const tzPart = parts.find(p => p.type === 'timeZoneName');
    return tzPart?.value || tz.split('/').pop() || tz;
  } catch {
    return tz.split('/').pop() || tz;
  }
}

export function getTimezoneCityName(tz: string): string {
  return tz.replace('_', ' ').split('/').pop() || tz;
}

// ==================== CONTEXT ====================

interface TimezoneContextType {
  timezone: string;
  setTimezone: (tz: string) => void;
  formatTimeInZone: (date: Date) => string;
  formatDateInZone: (date: Date) => string;
  abbrev: string;
}

const TimezoneContext = createContext<TimezoneContextType | null>(null);

// ==================== PROVIDER ====================

export function TimezoneProvider({ children }: { children: ReactNode }) {
  const [timezone, setTimezoneState] = useState(getStoredTimezone);
  
  const setTimezone = useCallback((tz: string) => {
    setTimezoneState(tz);
    setStoredTimezone(tz);
  }, []);
  
  const formatTimeInZone = useCallback((date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone,
    });
  }, [timezone]);
  
  const formatDateInZone = useCallback((date: Date): string => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      timeZone: timezone,
    });
  }, [timezone]);
  
  const abbrev = getTimezoneAbbrev(timezone);
  
  return (
    <TimezoneContext.Provider value={{
      timezone,
      setTimezone,
      formatTimeInZone,
      formatDateInZone,
      abbrev,
    }}>
      {children}
    </TimezoneContext.Provider>
  );
}

// ==================== HOOK ====================

export function useTimezone() {
  const context = useContext(TimezoneContext);
  if (!context) {
    throw new Error('useTimezone must be used within a TimezoneProvider');
  }
  return context;
}
