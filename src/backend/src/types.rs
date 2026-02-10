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
    pub created_at: u64,
    pub updated_at: u64,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct EventSeries {
    pub series_id: [u8; 16],
    pub title: String,
    pub notes: String,
    pub frequency: Frequency,
    pub weekday: Weekday,
    pub weekday_ordinal: Option<WeekdayOrdinal>,
    pub start_date: u64,
    pub end_date: Option<u64>,
    pub default_duration_minutes: u32,
    pub color: Option<String>,  // Optional color code (e.g., "blue", "orange", "#FF5733")
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
    pub host_principal: Option<Principal>,
    pub status: EventStatus,
    pub color: Option<String>,  // Inherited from series
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
}

impl Default for GlobalSettings {
    fn default() -> Self {
        Self {
            forward_window_months: 2,
            claims_paused: false,
            default_event_duration_minutes: 60,
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
    pub start_utc: u64,
    pub end_utc: u64,
    pub host_principal: Option<Principal>,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct CreateSeriesInput {
    pub title: String,
    pub notes: String,
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
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct UpdateInstanceInput {
    pub start_utc: Option<u64>,
    pub end_utc: Option<u64>,
    pub notes: Option<String>,
}

/// For API responses, a simplified event view
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct PublicEventView {
    pub instance_id: Vec<u8>,
    pub title: String,
    pub notes: String,
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
// Storable Implementations for ic-stable-structures
// ============================================================================

const MAX_USER_SIZE: u32 = 2048;
const MAX_SERIES_SIZE: u32 = 1024;
const MAX_INSTANCE_SIZE: u32 = 1024;
const MAX_OVERRIDE_SIZE: u32 = 512;
const MAX_NOTIFICATION_SIZE: u32 = 4096;
const MAX_SETTINGS_SIZE: u32 = 64;

impl Storable for User {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).unwrap()
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
        Decode!(bytes.as_ref(), Self).unwrap()
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
        Decode!(bytes.as_ref(), Self).unwrap()
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
        Decode!(bytes.as_ref(), Self).unwrap()
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
