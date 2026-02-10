import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

// ==================== STORAGE ====================

function getStoredTimezone(): string {
  return localStorage.getItem('ohscheduler_timezone') || Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function setStoredTimezone(tz: string): void {
  localStorage.setItem('ohscheduler_timezone', tz);
}

// ==================== TIMEZONE LIST ====================
// Curated list covering all UTC offsets with recognizable city names

export const TIMEZONE_LIST: { tz: string; label: string; aliases: string[] }[] = [
  { tz: 'Pacific/Midway', label: 'GMT-11 · Midway', aliases: ['sst'] },
  { tz: 'Pacific/Honolulu', label: 'GMT-10 · Honolulu', aliases: ['hst', 'hawaii'] },
  { tz: 'Pacific/Marquesas', label: 'GMT-9:30 · Marquesas', aliases: [] },
  { tz: 'America/Anchorage', label: 'GMT-9 · Anchorage', aliases: ['akst', 'akdt', 'alaska'] },
  { tz: 'America/Los_Angeles', label: 'GMT-8 · Los Angeles', aliases: ['pst', 'pdt', 'pacific'] },
  { tz: 'America/Denver', label: 'GMT-7 · Denver', aliases: ['mst', 'mdt', 'mountain'] },
  { tz: 'America/Phoenix', label: 'GMT-7 · Phoenix (no DST)', aliases: ['arizona'] },
  { tz: 'America/Chicago', label: 'GMT-6 · Chicago', aliases: ['cst', 'cdt', 'central'] },
  { tz: 'America/Mexico_City', label: 'GMT-6 · Mexico City', aliases: [] },
  { tz: 'America/New_York', label: 'GMT-5 · New York', aliases: ['est', 'edt', 'eastern'] },
  { tz: 'America/Bogota', label: 'GMT-5 · Bogotá', aliases: ['cot', 'colombia'] },
  { tz: 'America/Caracas', label: 'GMT-4:30 · Caracas', aliases: ['venezuela'] },
  { tz: 'America/Halifax', label: 'GMT-4 · Halifax', aliases: ['ast', 'adt', 'atlantic'] },
  { tz: 'America/Santiago', label: 'GMT-4 · Santiago', aliases: ['chile'] },
  { tz: 'America/St_Johns', label: 'GMT-3:30 · St. John\'s', aliases: ['nst', 'ndt', 'newfoundland'] },
  { tz: 'America/Sao_Paulo', label: 'GMT-3 · São Paulo', aliases: ['brt', 'brazil'] },
  { tz: 'America/Argentina/Buenos_Aires', label: 'GMT-3 · Buenos Aires', aliases: ['art', 'argentina'] },
  { tz: 'Atlantic/South_Georgia', label: 'GMT-2 · South Georgia', aliases: [] },
  { tz: 'Atlantic/Azores', label: 'GMT-1 · Azores', aliases: [] },
  { tz: 'UTC', label: 'GMT+0 · UTC', aliases: ['utc', 'gmt', 'zulu'] },
  { tz: 'Europe/London', label: 'GMT+0 · London', aliases: ['gmt', 'bst', 'uk', 'britain'] },
  { tz: 'Europe/Paris', label: 'GMT+1 · Paris', aliases: ['cet', 'cest', 'france'] },
  { tz: 'Europe/Berlin', label: 'GMT+1 · Berlin', aliases: ['cet', 'cest', 'germany'] },
  { tz: 'Africa/Lagos', label: 'GMT+1 · Lagos', aliases: ['wat', 'nigeria'] },
  { tz: 'Europe/Athens', label: 'GMT+2 · Athens', aliases: ['eet', 'eest', 'greece'] },
  { tz: 'Africa/Cairo', label: 'GMT+2 · Cairo', aliases: ['egypt'] },
  { tz: 'Africa/Johannesburg', label: 'GMT+2 · Johannesburg', aliases: ['sast', 'south africa'] },
  { tz: 'Europe/Istanbul', label: 'GMT+3 · Istanbul', aliases: ['trt', 'turkey'] },
  { tz: 'Europe/Moscow', label: 'GMT+3 · Moscow', aliases: ['msk', 'russia'] },
  { tz: 'Asia/Riyadh', label: 'GMT+3 · Riyadh', aliases: ['saudi', 'arabia'] },
  { tz: 'Africa/Nairobi', label: 'GMT+3 · Nairobi', aliases: ['eat', 'kenya'] },
  { tz: 'Asia/Tehran', label: 'GMT+3:30 · Tehran', aliases: ['irst', 'iran'] },
  { tz: 'Asia/Dubai', label: 'GMT+4 · Dubai', aliases: ['gst', 'uae', 'gulf'] },
  { tz: 'Asia/Kabul', label: 'GMT+4:30 · Kabul', aliases: ['afghanistan'] },
  { tz: 'Asia/Karachi', label: 'GMT+5 · Karachi', aliases: ['pkt', 'pakistan'] },
  { tz: 'Asia/Kolkata', label: 'GMT+5:30 · Kolkata', aliases: ['ist', 'india', 'mumbai', 'delhi'] },
  { tz: 'Asia/Kathmandu', label: 'GMT+5:45 · Kathmandu', aliases: ['nepal'] },
  { tz: 'Asia/Dhaka', label: 'GMT+6 · Dhaka', aliases: ['bst', 'bangladesh'] },
  { tz: 'Asia/Yangon', label: 'GMT+6:30 · Yangon', aliases: ['myanmar'] },
  { tz: 'Asia/Bangkok', label: 'GMT+7 · Bangkok', aliases: ['ict', 'thailand', 'vietnam'] },
  { tz: 'Asia/Jakarta', label: 'GMT+7 · Jakarta', aliases: ['wib', 'indonesia'] },
  { tz: 'Asia/Shanghai', label: 'GMT+8 · Shanghai', aliases: ['cst', 'china', 'beijing'] },
  { tz: 'Asia/Singapore', label: 'GMT+8 · Singapore', aliases: ['sgt'] },
  { tz: 'Asia/Hong_Kong', label: 'GMT+8 · Hong Kong', aliases: ['hkt'] },
  { tz: 'Asia/Taipei', label: 'GMT+8 · Taipei', aliases: ['taiwan'] },
  { tz: 'Australia/Perth', label: 'GMT+8 · Perth', aliases: ['awst', 'western australia'] },
  { tz: 'Asia/Tokyo', label: 'GMT+9 · Tokyo', aliases: ['jst', 'japan'] },
  { tz: 'Asia/Seoul', label: 'GMT+9 · Seoul', aliases: ['kst', 'korea'] },
  { tz: 'Australia/Adelaide', label: 'GMT+9:30 · Adelaide', aliases: ['acst', 'acdt'] },
  { tz: 'Australia/Sydney', label: 'GMT+10 · Sydney', aliases: ['aest', 'aedt', 'eastern australia'] },
  { tz: 'Pacific/Guam', label: 'GMT+10 · Guam', aliases: ['chst'] },
  { tz: 'Pacific/Noumea', label: 'GMT+11 · Nouméa', aliases: [] },
  { tz: 'Pacific/Auckland', label: 'GMT+12 · Auckland', aliases: ['nzst', 'nzdt', 'new zealand'] },
  { tz: 'Pacific/Fiji', label: 'GMT+12 · Fiji', aliases: [] },
  { tz: 'Pacific/Tongatapu', label: 'GMT+13 · Tongatapu', aliases: ['tonga'] },
];

// Keep for backward compat
export const COMMON_TIMEZONES = TIMEZONE_LIST.map(t => t.tz);

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
