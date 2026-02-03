//! Office Hours Scheduler - Backend Canister
//!
//! A lightweight scheduling system for managing office hours sessions.
//! Built on the Internet Computer with Internet Identity authentication.

mod auth;
mod coverage;
mod notifications;
mod recurrence;
mod storage;
mod types;

use candid::Principal;
use ic_cdk::{init, post_upgrade, query, update};
use ic_cdk::caller;
use types::*;

// ============================================================================
// Canister Lifecycle
// ============================================================================

/// Initialize canister with deployer as first admin
#[init]
fn init() {
    let deployer = caller();
    auth::initialize_admin(
        deployer,
        "Initial Admin".to_string(),
        "admin@ohscheduler.local".to_string(),
    );
}

/// Preserve admin on upgrade
#[post_upgrade]
fn post_upgrade() {
    // Stable structures handle persistence automatically
    // No migration needed for MVP
}


// ============================================================================
// Auth / User Endpoints
// ============================================================================

/// Get the current authenticated user
/// Returns Unauthorized if caller is not in whitelist
#[query]
fn get_current_user() -> ApiResult<User> {
    auth::require_authorized()
}

/// Get caller's principal (useful for "Not Authorized" page)
#[query]
fn whoami() -> Principal {
    caller()
}

/// Update notification settings for the current user
#[update]
fn update_notification_settings(settings: NotificationSettings) -> ApiResult<()> {
    let mut user = auth::require_authorized()?;
    user.notification_settings = settings;
    user.updated_at = ic_cdk::api::time();
    storage::update_user(user);
    Ok(())
}

/// Set out-of-office blocks for the current user
#[update]
fn set_out_of_office(blocks: Vec<OOOBlock>) -> ApiResult<()> {
    let mut user = auth::require_authorized()?;
    user.out_of_office = blocks;
    user.updated_at = ic_cdk::api::time();
    storage::update_user(user);
    Ok(())
}


// ============================================================================
// Admin - User Management
// ============================================================================

/// List all users (admin only)
#[query]
fn list_users() -> ApiResult<Vec<User>> {
    auth::require_admin()?;
    Ok(storage::list_all_users())
}

/// Authorize a new user (admin only)
#[update]
fn authorize_user(principal: Principal, name: String, email: String, role: Role) -> ApiResult<User> {
    auth::require_admin()?;
    
    if storage::user_exists(&principal) {
        return Err(ApiError::Conflict("User already exists".to_string()));
    }
    
    let now = ic_cdk::api::time();
    let user = User {
        principal,
        name,
        email,
        role,
        status: UserStatus::Active,
        out_of_office: vec![],
        notification_settings: NotificationSettings::default(),
        created_at: now,
        updated_at: now,
    };
    
    storage::insert_user(user.clone());
    Ok(user)
}

/// Disable a user (admin only)
#[update]
fn disable_user(principal: Principal) -> ApiResult<()> {
    auth::require_admin()?;
    
    let mut user = storage::get_user(&principal)
        .ok_or(ApiError::NotFound)?;
    
    user.status = UserStatus::Disabled;
    user.updated_at = ic_cdk::api::time();
    storage::update_user(user);
    Ok(())
}

/// Enable a user (admin only)
#[update]
fn enable_user(principal: Principal) -> ApiResult<()> {
    auth::require_admin()?;
    
    let mut user = storage::get_user(&principal)
        .ok_or(ApiError::NotFound)?;
    
    user.status = UserStatus::Active;
    user.updated_at = ic_cdk::api::time();
    storage::update_user(user);
    Ok(())
}

/// Update user info (admin only)
#[update]
fn update_user(principal: Principal, name: String, email: String, role: Role) -> ApiResult<User> {
    auth::require_admin()?;
    
    let mut user = storage::get_user(&principal)
        .ok_or(ApiError::NotFound)?;
    
    user.name = name;
    user.email = email;
    user.role = role;
    user.updated_at = ic_cdk::api::time();
    storage::update_user(user.clone());
    Ok(user)
}


// ============================================================================
// Events - Public
// ============================================================================

/// List events for public calendar (no auth required)
#[query]
fn list_events_public(window_start: u64, window_end: u64) -> Vec<PublicEventView> {
    let events = recurrence::materialize_events(window_start, window_end);
    events.into_iter().map(|e| {
        let host_name = e.host_principal
            .and_then(|p| storage::get_user(&p))
            .map(|u| u.name);
        
        PublicEventView {
            instance_id: e.instance_id.to_vec(),
            title: e.title,
            notes: e.notes,
            start_utc: e.start_utc,
            end_utc: e.end_utc,
            host_name,
            status: e.status,
        }
    }).collect()
}

// ============================================================================
// Events - Authenticated
// ============================================================================

/// List events for authenticated users
#[query]
fn list_events(window_start: u64, window_end: u64) -> ApiResult<Vec<EventInstance>> {
    auth::require_authorized()?;
    Ok(recurrence::materialize_events(window_start, window_end))
}

/// List unclaimed events within forward window
#[query]
fn list_unclaimed_events() -> ApiResult<Vec<EventInstance>> {
    auth::require_authorized()?;
    Ok(recurrence::list_unclaimed_events())
}

/// Create a one-off event
#[update]
fn create_one_off_event(input: CreateEventInput) -> ApiResult<EventInstance> {
    let user = auth::require_authorized()?;
    let now = ic_cdk::api::time();
    
    if input.start_utc >= input.end_utc {
        return Err(ApiError::InvalidInput("End time must be after start time".to_string()));
    }
    
    let instance = EventInstance {
        instance_id: recurrence::generate_uuid(),
        series_id: None,
        start_utc: input.start_utc,
        end_utc: input.end_utc,
        title: input.title,
        notes: input.notes,
        host_principal: input.host_principal,
        status: EventStatus::Active,
        created_at: now,
    };
    
    storage::insert_instance(instance.clone());
    Ok(instance)
}


// ============================================================================
// Event Series (Admin only)
// ============================================================================

/// Create a recurring event series (admin only)
#[update]
fn create_event_series(input: CreateSeriesInput) -> ApiResult<EventSeries> {
    let admin = auth::require_admin()?;
    let now = ic_cdk::api::time();
    let settings = storage::get_settings();
    
    // Validate monthly requires ordinal
    if input.frequency == Frequency::Monthly && input.weekday_ordinal.is_none() {
        return Err(ApiError::InvalidInput(
            "Monthly frequency requires weekday_ordinal".to_string()
        ));
    }
    
    let series = EventSeries {
        series_id: recurrence::generate_uuid(),
        title: input.title,
        notes: input.notes,
        frequency: input.frequency,
        weekday: input.weekday,
        weekday_ordinal: input.weekday_ordinal,
        start_date: input.start_date,
        end_date: input.end_date,
        default_duration_minutes: input.default_duration_minutes
            .unwrap_or(settings.default_event_duration_minutes),
        created_at: now,
        created_by: admin.principal,
    };
    
    storage::insert_series(series.clone());
    Ok(series)
}

/// Update a recurring event series (admin only)
#[update]
fn update_event_series(series_id: Vec<u8>, input: UpdateSeriesInput) -> ApiResult<EventSeries> {
    auth::require_admin()?;
    
    let sid: [u8; 16] = series_id.try_into()
        .map_err(|_| ApiError::InvalidInput("Invalid series_id".to_string()))?;
    
    let mut series = storage::get_series(&sid)
        .ok_or(ApiError::NotFound)?;
    
    if let Some(title) = input.title {
        series.title = title;
    }
    if let Some(notes) = input.notes {
        series.notes = notes;
    }
    if let Some(end_date) = input.end_date {
        series.end_date = end_date;
    }
    if let Some(duration) = input.default_duration_minutes {
        series.default_duration_minutes = duration;
    }
    
    storage::insert_series(series.clone());
    Ok(series)
}

/// Delete a recurring event series (admin only)
#[update]
fn delete_event_series(series_id: Vec<u8>) -> ApiResult<()> {
    auth::require_admin()?;
    
    let sid: [u8; 16] = series_id.try_into()
        .map_err(|_| ApiError::InvalidInput("Invalid series_id".to_string()))?;
    
    if !storage::delete_series(&sid) {
        return Err(ApiError::NotFound);
    }
    
    // Note: Overrides for this series remain orphaned but harmless
    Ok(())
}

/// List all event series (admin only)
#[query]
fn list_event_series() -> ApiResult<Vec<EventSeries>> {
    auth::require_admin()?;
    Ok(storage::list_all_series())
}


// ============================================================================
// Coverage Queue
// ============================================================================

/// Assign a host to an event instance
/// series_id and occurrence_start are needed for series instances
/// instance_id is used for one-off events
#[update]
fn assign_host(
    series_id: Option<Vec<u8>>,
    occurrence_start: Option<u64>,
    instance_id: Vec<u8>,
    host_principal: Principal,
) -> ApiResult<EventInstance> {
    let user = auth::require_authorized()?;
    
    let sid = series_id
        .map(|v| v.try_into().map_err(|_| ApiError::InvalidInput("Invalid series_id".to_string())))
        .transpose()?;
    
    let iid: [u8; 16] = instance_id.try_into()
        .map_err(|_| ApiError::InvalidInput("Invalid instance_id".to_string()))?;
    
    let is_admin = user.role == Role::Admin;
    
    coverage::assign_host(
        sid,
        occurrence_start,
        iid,
        host_principal,
        user.principal,
        is_admin,
    )
}

/// Unassign host from an event instance
#[update]
fn unassign_host(
    series_id: Option<Vec<u8>>,
    occurrence_start: Option<u64>,
    instance_id: Vec<u8>,
) -> ApiResult<EventInstance> {
    let user = auth::require_authorized()?;
    
    let sid = series_id
        .map(|v| v.try_into().map_err(|_| ApiError::InvalidInput("Invalid series_id".to_string())))
        .transpose()?;
    
    let iid: [u8; 16] = instance_id.try_into()
        .map_err(|_| ApiError::InvalidInput("Invalid instance_id".to_string()))?;
    
    coverage::unassign_host(
        sid,
        occurrence_start,
        iid,
        user.principal,
    )
}


// ============================================================================
// Admin - System Settings
// ============================================================================

/// Update global settings (admin only)
#[update]
fn update_global_settings(settings: GlobalSettings) -> ApiResult<()> {
    auth::require_admin()?;
    storage::update_settings(settings);
    Ok(())
}

/// Get global settings
#[query]
fn get_global_settings() -> ApiResult<GlobalSettings> {
    auth::require_authorized()?;
    Ok(storage::get_settings())
}

// ============================================================================
// Notifications
// ============================================================================

/// List pending notifications (for external worker)
#[query]
fn list_pending_notifications() -> ApiResult<Vec<NotificationJob>> {
    auth::require_admin()?;
    Ok(storage::list_pending_notifications())
}

/// Mark a notification as sent (for external worker)
#[update]
fn mark_notification_sent(job_id: Vec<u8>) -> ApiResult<()> {
    auth::require_admin()?;
    
    let jid: [u8; 16] = job_id.try_into()
        .map_err(|_| ApiError::InvalidInput("Invalid job_id".to_string()))?;
    
    let mut job = storage::get_notification(&jid)
        .ok_or(ApiError::NotFound)?;
    
    job.status = NotificationStatus::Sent;
    job.sent_at = Some(ic_cdk::api::time());
    storage::update_notification(job);
    Ok(())
}

/// Get ICS content for an event (for UI download)
#[query]
fn get_event_ics(instance_id: Vec<u8>) -> ApiResult<String> {
    auth::require_authorized()?;
    
    let iid: [u8; 16] = instance_id.try_into()
        .map_err(|_| ApiError::InvalidInput("Invalid instance_id".to_string()))?;
    
    // Try to find the event in materialized events
    let settings = storage::get_settings();
    let now = ic_cdk::api::time();
    let window_end = recurrence::calculate_window_end(now, settings.forward_window_months);
    
    let events = recurrence::materialize_events(0, window_end);
    let event = events.into_iter()
        .find(|e| e.instance_id == iid)
        .ok_or(ApiError::NotFound)?;
    
    Ok(notifications::generate_ics(
        &event.instance_id,
        &event.title,
        &event.notes,
        event.start_utc,
        event.end_utc,
        "REQUEST",
        1,
        event.status == EventStatus::Cancelled,
    ))
}

// ============================================================================
// Candid export
// ============================================================================

ic_cdk::export_candid!();
