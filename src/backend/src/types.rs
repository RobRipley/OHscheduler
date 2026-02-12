//! Core types for the Office Hours Scheduler
//! All timestamps are stored as nanoseconds (from ic_cdk::api::time())

use candid::{CandidType, Decode, Deserialize, Encode, Principal};
use ic_stable_structures::{storable::Bound, Storable};
use std::borrow::Cow;

// ============================================================================
// Enums
// ============================================================================

#[derive(CandidType, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum Role {
    Admin,
    User,
}

#[derive(CandidType, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum UserStatus {
    Active,
    Disabled,
}

#[derive(CandidType, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum Frequency {
    Weekly,
    Biweekly,
    Monthly,
}

#[derive(CandidType, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum Weekday {
    Mon = 0,
    Tue = 1,
    Wed = 2,
    Thu = 3,
    Fri = 4,
    Sat = 5,
    Sun = 6,
}

#[derive(CandidType, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum WeekdayOrdinal {
    First = 1,
    Second = 2,
    Third = 3,
    Fourth = 4,
    Last = 5,
}

#[derive(CandidType, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum EventStatus {
    Active,
    Cancelled,
}

#[derive(CandidType, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum NotificationType {
    HostAssigned,
    HostRemoved,
    InstanceTimeChanged,
    InstanceCancelled,
    UnclaimedReminder,
    CoverageNeededSoon,
    DailyDigest,
    WeeklyDigest,
}

#[derive(CandidType, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum NotificationStatus {
    Pending,
    Sent,
    Failed,
}

// ============================================================================
// Structs
// ============================================================================

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct OOOBlock {
    pub start_utc: u64,
    pub end_utc: u64,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct NotificationSettings {
    pub email_on_assigned: bool,
    pub email_on_removed: bool,
    pub email_on_cancelled: bool,
    pub email_on_time_changed: bool,
    pub email_unclaimed_reminder: bool,
    pub reminder_hours_before: Option<u32>,
}

impl Default for NotificationSettings {
    fn default() -> Self {
        Self {
            email_on_assigned: true,
            email_on_removed: true,
            email_on_cancelled: true,
            email_on_time_changed: true,
            email_unclaimed_reminder: false,
            reminder_hours_before: Some(24),
        }
    }
}


#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct User {
    pub principal: Principal,
    pub name: String,
    pub email: String,
    pub role: Role,
    pub status: UserStatus,
    pub out_of_office: Vec<OOOBlock>,
    pub notification_settings: NotificationSettings,
    pub last_active: u64,
    pub sessions_hosted_count: u32,
    pub created_at: u64,
    pub updated_at: u64,
}

/// Lightweight user info for directory listing (no sensitive fields)
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct UserDirectoryEntry {
    pub principal: Principal,
    pub name: String,
    pub role: Role,
    pub status: UserStatus,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct EventSeries {
    pub series_id: [u8; 16],
    pub title: String,
    pub notes: String,
    pub link: Option<String>,
    pub frequency: Frequency,
    pub weekday: Weekday,
    pub weekday_ordinal: Option<WeekdayOrdinal>,
    pub start_date: u64,
    pub end_date: Option<u64>,
    pub default_duration_minutes: u32,
    pub color: Option<String>,
    pub paused: bool,
    pub created_at: u64,
    pub created_by: Principal,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct EventInstance {
    pub instance_id: [u8; 16],
    pub series_id: Option<[u8; 16]>,
    pub start_utc: u64,
    pub end_utc: u64,
    pub title: String,
    pub notes: String,
    pub link: Option<String>,
    pub host_principal: Option<Principal>,
    pub status: EventStatus,
    pub color: Option<String>,
    pub created_at: u64,
}


/// Key for instance overrides: (series_id, original_occurrence_start_utc)
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct OverrideKey {
    pub series_id: [u8; 16],
    pub occurrence_start_utc: u64,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct InstanceOverride {
    pub series_id: [u8; 16],
    pub occurrence_start_utc: u64,
    pub start_utc: Option<u64>,
    pub end_utc: Option<u64>,
    pub notes: Option<String>,
    pub host_principal: Option<Principal>,
    pub host_cleared: bool,
    pub cancelled: bool,
    pub updated_at: u64,
    pub updated_by: Principal,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct GlobalSettings {
    pub forward_window_months: u8,
    pub claims_paused: bool,
    pub default_event_duration_minutes: u32,
    pub org_name: Option<String>,
    pub org_tagline: Option<String>,
    pub org_logo_url: Option<String>,
}

impl Default for GlobalSettings {
    fn default() -> Self {
        Self {
            forward_window_months: 2,
            claims_paused: false,
            default_event_duration_minutes: 60,
            org_name: None,
            org_tagline: None,
            org_logo_url: None,
        }
    }
}


#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct NotificationJob {
    pub job_id: [u8; 16],
    pub created_at: u64,
    pub notification_type: NotificationType,
    pub recipient_principal: Principal,
    pub recipient_email: String,
    pub subject: String,
    pub body_text: String,
    pub ics_payload: Option<String>,
    pub status: NotificationStatus,
    pub sent_at: Option<u64>,
    pub error_message: Option<String>,
}

// ============================================================================
// API Input/Output Types
// ============================================================================

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct CreateEventInput {
    pub title: String,
    pub notes: String,
    pub link: Option<String>,
    pub start_utc: u64,
    pub end_utc: u64,
    pub host_principal: Option<Principal>,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct CreateSeriesInput {
    pub title: String,
    pub notes: String,
    pub link: Option<String>,
    pub frequency: Frequency,
    pub weekday: Weekday,
    pub weekday_ordinal: Option<WeekdayOrdinal>,
    pub start_date: u64,
    pub end_date: Option<u64>,
    pub default_duration_minutes: Option<u32>,
    pub color: Option<String>,
}


#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct UpdateSeriesInput {
    pub title: Option<String>,
    pub notes: Option<String>,
    pub end_date: Option<Option<u64>>,
    pub default_duration_minutes: Option<u32>,
    pub color: Option<Option<String>>,  // None = don't change, Some(None) = clear, Some(Some(x)) = set to x
    pub paused: Option<bool>,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct UpdateInstanceInput {
    pub start_utc: Option<u64>,
    pub end_utc: Option<u64>,
    pub notes: Option<String>,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct CoverageStats {
    pub period_label: String,
    pub total_sessions: u32,
    pub assigned: u32,
    pub unassigned: u32,
    pub coverage_pct: f64,
}

/// For API responses, a simplified event view
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct PublicEventView {
    pub instance_id: Vec<u8>,
    pub title: String,
    pub notes: String,
    pub link: Option<String>,
    pub start_utc: u64,
    pub end_utc: u64,
    pub host_name: Option<String>,
    pub status: EventStatus,
    pub color: Option<String>,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum ApiError {
    Unauthorized,
    NotFound,
    InvalidInput(String),
    Conflict(String),
    InternalError(String),
}

pub type ApiResult<T> = Result<T, ApiError>;


// ============================================================================
// Invite Code
// ============================================================================

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct InviteCode {
    pub code: String,
    pub role: Role,
    pub created_at: u64,
    pub created_by: Principal,
    pub expires_at: u64,
    pub redeemed: bool,
    pub redeemed_by: Option<Principal>,
    pub redeemed_at: Option<u64>,
}

const MAX_INVITE_CODE_SIZE: u32 = 512;

impl Storable for InviteCode {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        match Decode!(bytes.as_ref(), Self) {
            Ok(code) => code,
            Err(_) => {
                // Migration: old InviteCode had user_placeholder_principal instead of role
                #[derive(CandidType, Deserialize)]
                struct OldInviteCode {
                    code: String,
                    user_placeholder_principal: Principal,
                    created_at: u64,
                    created_by: Principal,
                    expires_at: u64,
                    redeemed: bool,
                    redeemed_by: Option<Principal>,
                    redeemed_at: Option<u64>,
                }
                let old = Decode!(bytes.as_ref(), OldInviteCode).unwrap();
                InviteCode {
                    code: old.code,
                    role: Role::User, // default old invites to User role
                    created_at: old.created_at,
                    created_by: old.created_by,
                    expires_at: old.expires_at,
                    redeemed: old.redeemed,
                    redeemed_by: old.redeemed_by,
                    redeemed_at: old.redeemed_at,
                }
            }
        }
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: MAX_INVITE_CODE_SIZE,
        is_fixed_size: false,
    };
}

/// Stable-storage key wrapper for invite codes (max 15 chars like "YS-XXXX-XXXX")
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct InviteCodeKey(pub String);

impl Storable for InviteCodeKey {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(self.0.as_bytes().to_vec())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Self(String::from_utf8(bytes.to_vec()).unwrap())
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: 20,
        is_fixed_size: false,
    };
}


// ============================================================================
// Storable Implementations for ic-stable-structures
// ============================================================================

const MAX_USER_SIZE: u32 = 2048;
const MAX_SERIES_SIZE: u32 = 1024;
const MAX_INSTANCE_SIZE: u32 = 1024;
const MAX_OVERRIDE_SIZE: u32 = 512;
const MAX_NOTIFICATION_SIZE: u32 = 4096;
const MAX_SETTINGS_SIZE: u32 = 512;

impl Storable for User {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        match Decode!(bytes.as_ref(), Self) {
            Ok(u) => u,
            Err(_) => {
                // Try decoding as old User format (without last_active, sessions_hosted_count)
                // by decoding into a partial struct and filling defaults
                #[derive(CandidType, Deserialize)]
                struct OldUser {
                    principal: Principal,
                    name: String,
                    email: String,
                    role: Role,
                    status: UserStatus,
                    out_of_office: Vec<OOOBlock>,
                    notification_settings: NotificationSettings,
                    created_at: u64,
                    updated_at: u64,
                }
                let old = Decode!(bytes.as_ref(), OldUser).unwrap();
                User {
                    principal: old.principal,
                    name: old.name,
                    email: old.email,
                    role: old.role,
                    status: old.status,
                    out_of_office: old.out_of_office,
                    notification_settings: old.notification_settings,
                    last_active: 0,
                    sessions_hosted_count: 0,
                    created_at: old.created_at,
                    updated_at: old.updated_at,
                }
            }
        }
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: MAX_USER_SIZE,
        is_fixed_size: false,
    };
}

impl Storable for EventSeries {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        match Decode!(bytes.as_ref(), Self) {
            Ok(s) => s,
            Err(_) => {
                // Try decoding as old EventSeries format (without color, paused)
                #[derive(CandidType, Deserialize)]
                struct OldEventSeries {
                    series_id: [u8; 16],
                    title: String,
                    notes: String,
                    link: Option<String>,
                    frequency: Frequency,
                    weekday: Weekday,
                    weekday_ordinal: Option<WeekdayOrdinal>,
                    start_date: u64,
                    end_date: Option<u64>,
                    default_duration_minutes: u32,
                    created_at: u64,
                    created_by: Principal,
                }
                let old = Decode!(bytes.as_ref(), OldEventSeries).unwrap();
                EventSeries {
                    series_id: old.series_id,
                    title: old.title,
                    notes: old.notes,
                    link: old.link,
                    frequency: old.frequency,
                    weekday: old.weekday,
                    weekday_ordinal: old.weekday_ordinal,
                    start_date: old.start_date,
                    end_date: old.end_date,
                    default_duration_minutes: old.default_duration_minutes,
                    color: None,
                    paused: false,
                    created_at: old.created_at,
                    created_by: old.created_by,
                }
            }
        }
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: MAX_SERIES_SIZE,
        is_fixed_size: false,
    };
}


impl Storable for EventInstance {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        match Decode!(bytes.as_ref(), Self) {
            Ok(i) => i,
            Err(_) => {
                // Try decoding as old EventInstance format (without color)
                #[derive(CandidType, Deserialize)]
                struct OldEventInstance {
                    instance_id: [u8; 16],
                    series_id: Option<[u8; 16]>,
                    start_utc: u64,
                    end_utc: u64,
                    title: String,
                    notes: String,
                    link: Option<String>,
                    host_principal: Option<Principal>,
                    status: EventStatus,
                    created_at: u64,
                }
                let old = Decode!(bytes.as_ref(), OldEventInstance).unwrap();
                EventInstance {
                    instance_id: old.instance_id,
                    series_id: old.series_id,
                    start_utc: old.start_utc,
                    end_utc: old.end_utc,
                    title: old.title,
                    notes: old.notes,
                    link: old.link,
                    host_principal: old.host_principal,
                    status: old.status,
                    color: None,
                    created_at: old.created_at,
                }
            }
        }
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: MAX_INSTANCE_SIZE,
        is_fixed_size: false,
    };
}

impl Storable for InstanceOverride {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).unwrap()
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: MAX_OVERRIDE_SIZE,
        is_fixed_size: false,
    };
}


impl Storable for NotificationJob {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).unwrap()
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: MAX_NOTIFICATION_SIZE,
        is_fixed_size: false,
    };
}

impl Storable for GlobalSettings {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        match Decode!(bytes.as_ref(), Self) {
            Ok(s) => s,
            Err(_) => {
                #[derive(CandidType, Deserialize)]
                struct OldGlobalSettings {
                    forward_window_months: u8,
                    claims_paused: bool,
                    default_event_duration_minutes: u32,
                }
                let old = Decode!(bytes.as_ref(), OldGlobalSettings).unwrap();
                GlobalSettings {
                    forward_window_months: old.forward_window_months,
                    claims_paused: old.claims_paused,
                    default_event_duration_minutes: old.default_event_duration_minutes,
                    org_name: None,
                    org_tagline: None,
                    org_logo_url: None,
                }
            }
        }
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: MAX_SETTINGS_SIZE,
        is_fixed_size: false,
    };
}


// OverrideKey needs special handling for BTreeMap key
impl Storable for OverrideKey {
    fn to_bytes(&self) -> Cow<[u8]> {
        let mut bytes = Vec::with_capacity(24);
        bytes.extend_from_slice(&self.series_id);
        bytes.extend_from_slice(&self.occurrence_start_utc.to_be_bytes());
        Cow::Owned(bytes)
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        let mut series_id = [0u8; 16];
        series_id.copy_from_slice(&bytes[0..16]);
        let occurrence_start_utc = u64::from_be_bytes(bytes[16..24].try_into().unwrap());
        Self {
            series_id,
            occurrence_start_utc,
        }
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: 24,
        is_fixed_size: true,
    };
}

// Fixed-size key wrapper for [u8; 16] (UUIDs)
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct Uuid([u8; 16]);

impl Uuid {
    pub fn new(bytes: [u8; 16]) -> Self {
        Self(bytes)
    }

    pub fn as_bytes(&self) -> &[u8; 16] {
        &self.0
    }
}

impl Storable for Uuid {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Borrowed(&self.0)
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        let mut arr = [0u8; 16];
        arr.copy_from_slice(&bytes);
        Self(arr)
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: 16,
        is_fixed_size: true,
    };
}
