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
        last_active: now,
        sessions_hosted_count: 0,
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

/// Delete a user (admin only)
#[update]
fn delete_user(principal: Principal) -> ApiResult<()> {
    auth::require_admin()?;
    
    // Prevent deleting yourself
    if ic_cdk::caller() == principal {
        return Err(ApiError::InvalidInput("Cannot delete yourself".to_string()));
    }
    
    if !storage::delete_user(&principal) {
        return Err(ApiError::NotFound);
    }
    
    Ok(())
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
            link: e.link,
            start_utc: e.start_utc,
            end_utc: e.end_utc,
            host_name,
            status: e.status,
            color: e.color,
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
        link: input.link,
        host_principal: input.host_principal,
        status: EventStatus::Active,
        color: None,
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
        link: input.link,
        frequency: input.frequency,
        weekday: input.weekday,
        weekday_ordinal: input.weekday_ordinal,
        start_date: input.start_date,
        end_date: input.end_date,
        default_duration_minutes: input.default_duration_minutes
            .unwrap_or(settings.default_event_duration_minutes),
        color: input.color,
        paused: false,
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
    if let Some(color) = input.color {
        series.color = color;
    }
    if let Some(paused) = input.paused {
        series.paused = paused;
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
    auth::touch_last_active(&user.principal);
    
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

/// Get org settings for public calendar (no auth required)
#[query]
fn get_org_settings() -> GlobalSettings {
    storage::get_settings()
}

/// Get coverage history for past N months (admin only)
#[query]
fn get_coverage_history(months_back: u8) -> ApiResult<Vec<CoverageStats>> {
    auth::require_admin()?;
    
    let now = ic_cdk::api::time();
    let mut stats = Vec::new();
    
    for i in 0..months_back {
        let (window_start, window_end, label) = recurrence::month_window(now, i);
        let events = recurrence::materialize_events(window_start, window_end);
        let total = events.len() as u32;
        let assigned = events.iter().filter(|e| e.host_principal.is_some()).count() as u32;
        let unassigned = total - assigned;
        let coverage_pct = if total > 0 { (assigned as f64 / total as f64) * 100.0 } else { 0.0 };
        
        stats.push(CoverageStats {
            period_label: label,
            total_sessions: total,
            assigned,
            unassigned,
            coverage_pct,
        });
    }
    
    stats.reverse(); // oldest first
    Ok(stats)
}

/// Toggle pause/resume on a series (admin only)
#[update]
fn toggle_series_pause(series_id: Vec<u8>) -> ApiResult<EventSeries> {
    auth::require_admin()?;
    
    let sid: [u8; 16] = series_id.try_into()
        .map_err(|_| ApiError::InvalidInput("Invalid series_id".to_string()))?;
    
    let mut series = storage::get_series(&sid)
        .ok_or(ApiError::NotFound)?;
    
    series.paused = !series.paused;
    storage::insert_series(series.clone());
    Ok(series)
}

/// Export events as CSV (admin only)
#[query]
fn export_events_csv(window_start: u64, window_end: u64) -> ApiResult<String> {
    auth::require_admin()?;
    
    let events = recurrence::materialize_events(window_start, window_end);
    let users = storage::list_all_users();
    
    let mut csv = String::from("Date,Time (UTC),Title,Host,Status,Series,Duration (min)\n");
    
    for e in &events {
        let host_name = e.host_principal
            .and_then(|p| users.iter().find(|u| u.principal == p))
            .map(|u| u.name.clone())
            .unwrap_or_else(|| "Unassigned".to_string());
        
        let status = if e.status == EventStatus::Active { "Active" } else { "Cancelled" };
        let is_series = if e.series_id.is_some() { "Yes" } else { "No" };
        let duration_min = (e.end_utc.saturating_sub(e.start_utc)) / 1_000_000_000 / 60;
        
        // Format timestamp as ISO-ish date/time
        let (y, m, d) = recurrence::nanos_to_ymd(e.start_utc);
        let secs_in_day = (e.start_utc / 1_000_000_000) % 86400;
        let hour = secs_in_day / 3600;
        let min = (secs_in_day % 3600) / 60;
        
        // Escape title for CSV
        let title_escaped = if e.title.contains(',') || e.title.contains('"') {
            format!("\"{}\"", e.title.replace('"', "\"\""))
        } else {
            e.title.clone()
        };
        
        csv.push_str(&format!(
            "{:04}-{:02}-{:02},{:02}:{:02},{},{},{},{},{}\n",
            y, m, d, hour, min, title_escaped, host_name, status, is_series, duration_min
        ));
    }
    
    Ok(csv)
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
        event.link.as_deref(),
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

// ============================================================================
// Invite Code System
// ============================================================================

/// Generate a standalone invite code (admin only).
/// The code encodes a role. When redeemed, the user provides their own name/email.
/// Uses raw_rand() for cryptographic randomness — must be an update call.
#[update]
async fn generate_invite_code(role: Role) -> ApiResult<InviteCode> {
    let admin = auth::require_admin()?;
    let now = ic_cdk::api::time();
    
    // Generate random bytes via management canister
    let (random_bytes,): (Vec<u8>,) = ic_cdk::api::management_canister::main::raw_rand()
        .await
        .map_err(|e| ApiError::InternalError(format!("Failed to generate random bytes: {:?}", e)))?;
    
    // Characters excluding ambiguous ones (0/O, 1/I/L)
    let charset: &[u8] = b"ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    
    // Generate "YS-XXXX-XXXX"
    let mut code_chars = String::from("YS-");
    for i in 0..4 {
        let idx = (random_bytes[i] as usize) % charset.len();
        code_chars.push(charset[idx] as char);
    }
    code_chars.push('-');
    for i in 4..8 {
        let idx = (random_bytes[i] as usize) % charset.len();
        code_chars.push(charset[idx] as char);
    }
    
    let invite = InviteCode {
        code: code_chars,
        role,
        created_at: now,
        created_by: admin.principal,
        expires_at: now + 7 * 24 * 60 * 60 * 1_000_000_000, // 7 days in nanoseconds
        redeemed: false,
        redeemed_by: None,
        redeemed_at: None,
    };
    
    storage::insert_invite_code(invite.clone());
    Ok(invite)
}

/// Redeem an invite code — creates a new user with the caller's II principal.
/// Caller must be authenticated via II but does NOT need to be authorized.
#[update]
fn redeem_invite_code(code: String, name: String, email: String) -> ApiResult<User> {
    let caller_principal = auth::require_authenticated()?;
    
    // Check caller isn't already an authorized user
    if storage::user_exists(&caller_principal) {
        return Err(ApiError::Conflict("You are already an authorized user.".to_string()));
    }
    
    // Validate inputs
    let name = name.trim().to_string();
    let email = email.trim().to_string();
    if name.is_empty() {
        return Err(ApiError::InvalidInput("Name is required.".to_string()));
    }
    if email.is_empty() || !email.contains('@') {
        return Err(ApiError::InvalidInput("A valid email is required.".to_string()));
    }
    
    let code_upper = code.trim().to_uppercase();
    
    let mut invite = storage::get_invite_code(&code_upper)
        .ok_or(ApiError::InvalidInput("Invalid invite code.".to_string()))?;
    
    let now = ic_cdk::api::time();
    
    if invite.redeemed {
        return Err(ApiError::InvalidInput("This invite code has already been used.".to_string()));
    }
    
    if invite.expires_at < now {
        return Err(ApiError::InvalidInput("This invite code has expired.".to_string()));
    }
    
    // Create the user with the role from the invite code
    let new_user = User {
        principal: caller_principal,
        name,
        email,
        role: invite.role.clone(),
        status: UserStatus::Active,
        out_of_office: vec![],
        notification_settings: NotificationSettings::default(),
        last_active: now,
        sessions_hosted_count: 0,
        created_at: now,
        updated_at: now,
    };
    
    storage::insert_user(new_user.clone());
    
    // Mark invite as redeemed
    invite.redeemed = true;
    invite.redeemed_by = Some(caller_principal);
    invite.redeemed_at = Some(now);
    storage::insert_invite_code(invite);
    
    Ok(new_user)
}

/// List all invite codes (admin only)
#[query]
fn list_invite_codes() -> ApiResult<Vec<InviteCode>> {
    auth::require_admin()?;
    Ok(storage::list_all_invite_codes())
}

ic_cdk::export_candid!();
