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

/// Which host slot an assign/unassign action targets.
#[derive(CandidType, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum HostSlot {
    Primary,
    Secondary,
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
    pub exclude_from_coverage: bool,
    pub default_host: Option<Principal>,
    pub created_at: u64,
    pub created_by: Principal,
    /// Whether this series can have a second host assigned alongside the primary.
    /// `None` is treated as `false` (older stored series predate this field).
    pub allow_second_host: Option<bool>,
    pub default_host_2: Option<Principal>,
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
    pub exclude_from_coverage: bool,
    pub created_at: u64,
    /// Original (unadjusted) occurrence start time for series instances.
    /// Used as the override key when assigning/unassigning hosts.
    /// None for one-off events.
    pub occurrence_start_utc: Option<u64>,
    pub host_principal_2: Option<Principal>,
    /// Denormalized from the series so the frontend can show the co-host
    /// control without a separate (admin-only) series fetch. Always `Some(false)`
    /// (rendered as false) for one-off events.
    pub allow_second_host: Option<bool>,
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
    pub host_principal_2: Option<Principal>,
    /// `None` is treated as `false` (older stored overrides predate this field).
    pub host_2_cleared: Option<bool>,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct GlobalSettings {
    pub forward_window_months: u8,
    pub claims_paused: bool,
    pub default_event_duration_minutes: u32,
    pub org_name: Option<String>,
    pub org_tagline: Option<String>,
    pub org_logo_url: Option<String>,
    pub ignore_dst: bool,
    pub dst_utc_offset_minutes: Option<i16>,
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
            ignore_dst: false,
            dst_utc_offset_minutes: None,
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
    pub default_host: Option<Principal>,
    pub exclude_from_coverage: Option<bool>,
    pub allow_second_host: Option<bool>,
    pub default_host_2: Option<Principal>,
}


#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct UpdateSeriesInput {
    pub title: Option<String>,
    pub notes: Option<String>,
    pub end_date: Option<Option<u64>>,
    pub default_duration_minutes: Option<u32>,
    pub color: Option<Option<String>>,  // None = don't change, Some(None) = clear, Some(Some(x)) = set to x
    pub paused: Option<bool>,
    pub default_host: Option<Option<Principal>>,  // None = don't change, Some(None) = clear, Some(Some(p)) = set
    pub exclude_from_coverage: Option<bool>,
    pub allow_second_host: Option<bool>,
    pub default_host_2: Option<Option<Principal>>,  // None = don't change, Some(None) = clear, Some(Some(p)) = set
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
    pub host_name_2: Option<String>,
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
    pub user_placeholder_principal: Option<Principal>,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct InviteCodeInfo {
    pub is_personal: bool,
    pub prefilled_name: Option<String>,
    pub prefilled_email: Option<String>,
}

const MAX_INVITE_CODE_SIZE: u32 = 512;

impl Storable for InviteCode {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        // Try current format first (has role + user_placeholder_principal)
        if let Ok(code) = Decode!(bytes.as_ref(), Self) {
            return code;
        }
        
        // Migration: mid-version had role but no user_placeholder_principal
        #[derive(CandidType, Deserialize)]
        struct MidInviteCode {
            code: String,
            role: Role,
            created_at: u64,
            created_by: Principal,
            expires_at: u64,
            redeemed: bool,
            redeemed_by: Option<Principal>,
            redeemed_at: Option<u64>,
        }
        if let Ok(mid) = Decode!(bytes.as_ref(), MidInviteCode) {
            return InviteCode {
                code: mid.code,
                role: mid.role,
                created_at: mid.created_at,
                created_by: mid.created_by,
                expires_at: mid.expires_at,
                redeemed: mid.redeemed,
                redeemed_by: mid.redeemed_by,
                redeemed_at: mid.redeemed_at,
                user_placeholder_principal: None,
            };
        }

        // Migration: old format had user_placeholder_principal instead of role
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
            role: Role::User,
            created_at: old.created_at,
            created_by: old.created_by,
            expires_at: old.expires_at,
            redeemed: old.redeemed,
            redeemed_by: old.redeemed_by,
            redeemed_at: old.redeemed_at,
            user_placeholder_principal: Some(old.user_placeholder_principal),
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
                // V4: has color+paused+default_host but no exclude_from_coverage
                #[derive(CandidType, Deserialize)]
                struct V4EventSeries {
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
                    color: Option<String>,
                    paused: bool,
                    default_host: Option<Principal>,
                    created_at: u64,
                    created_by: Principal,
                }
                if let Ok(v4) = Decode!(bytes.as_ref(), V4EventSeries) {
                    return EventSeries {
                        series_id: v4.series_id,
                        title: v4.title,
                        notes: v4.notes,
                        link: v4.link,
                        frequency: v4.frequency,
                        weekday: v4.weekday,
                        weekday_ordinal: v4.weekday_ordinal,
                        start_date: v4.start_date,
                        end_date: v4.end_date,
                        default_duration_minutes: v4.default_duration_minutes,
                        color: v4.color,
                        paused: v4.paused,
                        exclude_from_coverage: false,
                        default_host: v4.default_host,
                        created_at: v4.created_at,
                        created_by: v4.created_by,
                        allow_second_host: None,
                        default_host_2: None,
                    };
                }
                // V3: has color+paused but no default_host
                #[derive(CandidType, Deserialize)]
                struct V3EventSeries {
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
                    color: Option<String>,
                    paused: bool,
                    created_at: u64,
                    created_by: Principal,
                }
                if let Ok(v3) = Decode!(bytes.as_ref(), V3EventSeries) {
                    return EventSeries {
                        series_id: v3.series_id,
                        title: v3.title,
                        notes: v3.notes,
                        link: v3.link,
                        frequency: v3.frequency,
                        weekday: v3.weekday,
                        weekday_ordinal: v3.weekday_ordinal,
                        start_date: v3.start_date,
                        end_date: v3.end_date,
                        default_duration_minutes: v3.default_duration_minutes,
                        color: v3.color,
                        paused: v3.paused,
                        exclude_from_coverage: false,
                        default_host: None,
                        created_at: v3.created_at,
                        created_by: v3.created_by,
                        allow_second_host: None,
                        default_host_2: None,
                    };
                }
                // V2: has color but no paused, no default_host
                #[derive(CandidType, Deserialize)]
                struct MidEventSeries {
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
                    color: Option<String>,
                    created_at: u64,
                    created_by: Principal,
                }
                if let Ok(mid) = Decode!(bytes.as_ref(), MidEventSeries) {
                    return EventSeries {
                        series_id: mid.series_id,
                        title: mid.title,
                        notes: mid.notes,
                        link: mid.link,
                        frequency: mid.frequency,
                        weekday: mid.weekday,
                        weekday_ordinal: mid.weekday_ordinal,
                        start_date: mid.start_date,
                        end_date: mid.end_date,
                        default_duration_minutes: mid.default_duration_minutes,
                        color: mid.color,
                        paused: false,
                        exclude_from_coverage: false,
                        default_host: None,
                        created_at: mid.created_at,
                        created_by: mid.created_by,
                        allow_second_host: None,
                        default_host_2: None,
                    };
                }
                // V1: no color, no paused, no default_host
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
                    exclude_from_coverage: false,
                    default_host: None,
                    created_at: old.created_at,
                    created_by: old.created_by,
                    allow_second_host: None,
                    default_host_2: None,
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
                // V3: has exclude_from_coverage but no occurrence_start_utc
                #[derive(CandidType, Deserialize)]
                struct V3EventInstance {
                    instance_id: [u8; 16],
                    series_id: Option<[u8; 16]>,
                    start_utc: u64,
                    end_utc: u64,
                    title: String,
                    notes: String,
                    link: Option<String>,
                    host_principal: Option<Principal>,
                    status: EventStatus,
                    color: Option<String>,
                    exclude_from_coverage: bool,
                    created_at: u64,
                }
                if let Ok(v3) = Decode!(bytes.as_ref(), V3EventInstance) {
                    return EventInstance {
                        instance_id: v3.instance_id,
                        series_id: v3.series_id,
                        start_utc: v3.start_utc,
                        end_utc: v3.end_utc,
                        title: v3.title,
                        notes: v3.notes,
                        link: v3.link,
                        host_principal: v3.host_principal,
                        status: v3.status,
                        color: v3.color,
                        exclude_from_coverage: v3.exclude_from_coverage,
                        created_at: v3.created_at,
                        occurrence_start_utc: None,
                        host_principal_2: None,
                        allow_second_host: None,
                    };
                }
                // V2: has color but no exclude_from_coverage
                #[derive(CandidType, Deserialize)]
                struct PrevEventInstance {
                    instance_id: [u8; 16],
                    series_id: Option<[u8; 16]>,
                    start_utc: u64,
                    end_utc: u64,
                    title: String,
                    notes: String,
                    link: Option<String>,
                    host_principal: Option<Principal>,
                    status: EventStatus,
                    color: Option<String>,
                    created_at: u64,
                }
                if let Ok(prev) = Decode!(bytes.as_ref(), PrevEventInstance) {
                    return EventInstance {
                        instance_id: prev.instance_id,
                        series_id: prev.series_id,
                        start_utc: prev.start_utc,
                        end_utc: prev.end_utc,
                        title: prev.title,
                        notes: prev.notes,
                        link: prev.link,
                        host_principal: prev.host_principal,
                        status: prev.status,
                        color: prev.color,
                        exclude_from_coverage: false,
                        created_at: prev.created_at,
                        occurrence_start_utc: None,
                        host_principal_2: None,
                        allow_second_host: None,
                    };
                }
                // V1: no color, no exclude_from_coverage
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
                    exclude_from_coverage: false,
                    created_at: old.created_at,
                    occurrence_start_utc: None,
                    host_principal_2: None,
                    allow_second_host: None,
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
                // V2: has org fields but no DST fields
                #[derive(CandidType, Deserialize)]
                struct V2GlobalSettings {
                    forward_window_months: u8,
                    claims_paused: bool,
                    default_event_duration_minutes: u32,
                    org_name: Option<String>,
                    org_tagline: Option<String>,
                    org_logo_url: Option<String>,
                }
                if let Ok(v2) = Decode!(bytes.as_ref(), V2GlobalSettings) {
                    return GlobalSettings {
                        forward_window_months: v2.forward_window_months,
                        claims_paused: v2.claims_paused,
                        default_event_duration_minutes: v2.default_event_duration_minutes,
                        org_name: v2.org_name,
                        org_tagline: v2.org_tagline,
                        org_logo_url: v2.org_logo_url,
                        ignore_dst: false,
                        dst_utc_offset_minutes: None,
                    };
                }
                // V1: no org fields, no DST fields
                #[derive(CandidType, Deserialize)]
                struct V1GlobalSettings {
                    forward_window_months: u8,
                    claims_paused: bool,
                    default_event_duration_minutes: u32,
                }
                let v1 = Decode!(bytes.as_ref(), V1GlobalSettings).unwrap();
                GlobalSettings {
                    forward_window_months: v1.forward_window_months,
                    claims_paused: v1.claims_paused,
                    default_event_duration_minutes: v1.default_event_duration_minutes,
                    org_name: None,
                    org_tagline: None,
                    org_logo_url: None,
                    ignore_dst: false,
                    dst_utc_offset_minutes: None,
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

#[cfg(test)]
mod multi_host_migration_tests {
    //! Proves that records stored on mainnet *before* the multi-host fields
    //! existed still decode correctly afterward. `allow_second_host`,
    //! `default_host_2`, `host_principal_2`, and `host_2_cleared` were all
    //! added as trailing `Option<T>` fields, which Candid's record subtyping
    //! fills with `None` when decoding bytes that predate them — this test
    //! encodes the pre-migration shape directly (bypassing the new fields
    //! entirely) and decodes it through the current `Storable` impl.
    use super::*;

    #[test]
    fn old_event_series_bytes_decode_with_new_fields_none() {
        #[derive(CandidType, Deserialize)]
        struct PreMultiHostEventSeries {
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
            color: Option<String>,
            paused: bool,
            exclude_from_coverage: bool,
            default_host: Option<Principal>,
            created_at: u64,
            created_by: Principal,
        }

        let old = PreMultiHostEventSeries {
            series_id: [1u8; 16],
            title: "Weekly Office Hours".to_string(),
            notes: "notes".to_string(),
            link: None,
            frequency: Frequency::Weekly,
            weekday: Weekday::Mon,
            weekday_ordinal: None,
            start_date: 1000,
            end_date: None,
            default_duration_minutes: 60,
            color: None,
            paused: false,
            exclude_from_coverage: false,
            default_host: Some(Principal::anonymous()),
            created_at: 1000,
            created_by: Principal::anonymous(),
        };
        let bytes = Encode!(&old).unwrap();

        let decoded = EventSeries::from_bytes(std::borrow::Cow::Owned(bytes));
        assert_eq!(decoded.series_id, old.series_id);
        assert_eq!(decoded.title, old.title);
        assert_eq!(decoded.default_host, old.default_host);
        assert_eq!(decoded.allow_second_host, None);
        assert_eq!(decoded.default_host_2, None);
    }

    #[test]
    fn old_event_instance_bytes_decode_with_new_fields_none() {
        #[derive(CandidType, Deserialize)]
        struct PreMultiHostEventInstance {
            instance_id: [u8; 16],
            series_id: Option<[u8; 16]>,
            start_utc: u64,
            end_utc: u64,
            title: String,
            notes: String,
            link: Option<String>,
            host_principal: Option<Principal>,
            status: EventStatus,
            color: Option<String>,
            exclude_from_coverage: bool,
            created_at: u64,
            occurrence_start_utc: Option<u64>,
        }

        let old = PreMultiHostEventInstance {
            instance_id: [2u8; 16],
            series_id: Some([1u8; 16]),
            start_utc: 1000,
            end_utc: 2000,
            title: "Office Hours".to_string(),
            notes: String::new(),
            link: None,
            host_principal: Some(Principal::anonymous()),
            status: EventStatus::Active,
            color: None,
            exclude_from_coverage: false,
            created_at: 1000,
            occurrence_start_utc: Some(1000),
        };
        let bytes = Encode!(&old).unwrap();

        let decoded = EventInstance::from_bytes(std::borrow::Cow::Owned(bytes));
        assert_eq!(decoded.instance_id, old.instance_id);
        assert_eq!(decoded.host_principal, old.host_principal);
        assert_eq!(decoded.host_principal_2, None);
        assert_eq!(decoded.allow_second_host, None);
    }

    #[test]
    fn old_instance_override_bytes_decode_with_new_fields_none() {
        #[derive(CandidType, Deserialize)]
        struct PreMultiHostInstanceOverride {
            series_id: [u8; 16],
            occurrence_start_utc: u64,
            start_utc: Option<u64>,
            end_utc: Option<u64>,
            notes: Option<String>,
            host_principal: Option<Principal>,
            host_cleared: bool,
            cancelled: bool,
            updated_at: u64,
            updated_by: Principal,
        }

        let old = PreMultiHostInstanceOverride {
            series_id: [3u8; 16],
            occurrence_start_utc: 1000,
            start_utc: None,
            end_utc: None,
            notes: None,
            host_principal: Some(Principal::anonymous()),
            host_cleared: false,
            cancelled: false,
            updated_at: 1000,
            updated_by: Principal::anonymous(),
        };
        let bytes = Encode!(&old).unwrap();

        let decoded = InstanceOverride::from_bytes(std::borrow::Cow::Owned(bytes));
        assert_eq!(decoded.series_id, old.series_id);
        assert_eq!(decoded.host_principal, old.host_principal);
        assert_eq!(decoded.host_principal_2, None);
        assert_eq!(decoded.host_2_cleared, None);
    }
}
