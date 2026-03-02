//! Coverage queue logic: assign/unassign hosts to event instances
//!
//! Key behavior:
//! - Assigning host to a series instance creates/updates an override
//! - Assigning host to a one-off instance updates the instance directly
//! - OOO and disabled users cannot be assigned (except admin override)

use crate::auth;
use crate::notifications;
use crate::recurrence;
use crate::storage;
use crate::types::*;
use candid::Principal;

/// Apply DST adjustment to a (start, end) pair if ignore_dst is enabled.
/// `series_start_utc` is the series' original start_date (for DST comparison).
fn maybe_adjust_dst(start: u64, end: u64, series_start_utc: u64) -> (u64, u64) {
    let settings = storage::get_settings();
    if settings.ignore_dst {
        if let Some(offset) = settings.dst_utc_offset_minutes {
            return (
                recurrence::adjust_for_dst(start, series_start_utc, offset),
                recurrence::adjust_for_dst(end, series_start_utc, offset),
            );
        }
    }
    (start, end)
}

/// Assign a host to an event instance
/// 
/// For series instances: Creates or updates an InstanceOverride
/// For one-off instances: Updates the EventInstance directly
pub fn assign_host(
    series_id: Option<[u8; 16]>,
    occurrence_start: Option<u64>,
    instance_id: [u8; 16],
    host_principal: Principal,
    caller: Principal,
    admin_override: bool,
) -> ApiResult<EventInstance> {
    let now = ic_cdk::api::time();
    let settings = storage::get_settings();
    
    // Check if claims are paused (admins can still assign)
    if settings.claims_paused && !auth::is_admin(&caller) {
        return Err(ApiError::Conflict("Claims are currently paused".to_string()));
    }
    
    // Validate host exists and can be assigned
    let mut host_user = storage::get_user(&host_principal)
        .ok_or(ApiError::NotFound)?;
    
    // Get event timing for OOO check
    let (event_start, event_end) = get_event_timing(series_id, occurrence_start, &instance_id)?;
    
    if !admin_override && !auth::can_be_assigned_host(&host_user, event_start, event_end) {
        return Err(ApiError::Conflict(
            "User cannot be assigned (disabled or on out-of-office)".to_string()
        ));
    }
    
    // Handle shift swap: notify and decrement previous host if being replaced
    let previous_instance = get_event_instance(series_id, occurrence_start, &instance_id)?;
    if let Some(prev_host_principal) = previous_instance.host_principal {
        if prev_host_principal != host_principal {
            if let Some(mut prev_host_user) = storage::get_user(&prev_host_principal) {
                notifications::create_host_removed_notification(
                    &prev_host_user, &instance_id, event_start, event_end,
                );
                prev_host_user.sessions_hosted_count = prev_host_user.sessions_hosted_count.saturating_sub(1);
                prev_host_user.updated_at = now;
                storage::update_user(prev_host_user);
            }
        }
    }

    // Perform assignment
    if let Some(sid) = series_id {
        // Series instance: create/update override
        let occ_start = occurrence_start.ok_or(ApiError::InvalidInput(
            "occurrence_start required for series instance".to_string()
        ))?;
        
        let mut ovr = storage::get_override(&OverrideKey {
            series_id: sid,
            occurrence_start_utc: occ_start,
        }).unwrap_or(InstanceOverride {
            series_id: sid,
            occurrence_start_utc: occ_start,
            start_utc: None,
            end_utc: None,
            notes: None,
            host_principal: None,
            host_cleared: false,
            cancelled: false,
            updated_at: now,
            updated_by: caller,
        });
        
        ovr.host_principal = Some(host_principal);
        ovr.host_cleared = false;
        ovr.updated_at = now;
        ovr.updated_by = caller;
        
        storage::insert_override(ovr);
        
        // Create notification job
        notifications::create_host_assigned_notification(&host_user, &instance_id, event_start, event_end);
        
    } else {
        // One-off instance: update directly
        let mut inst = storage::get_instance(&instance_id)
            .ok_or(ApiError::NotFound)?;
        
        inst.host_principal = Some(host_principal);
        storage::insert_instance(inst);
        
        // Create notification job
        notifications::create_host_assigned_notification(&host_user, &instance_id, event_start, event_end);
    }
    
    // Increment sessions_hosted_count for the assigned host
    host_user.sessions_hosted_count = host_user.sessions_hosted_count.saturating_add(1);
    host_user.updated_at = now;
    storage::update_user(host_user);
    
    // Re-materialize to return updated instance
    get_event_instance(series_id, occurrence_start, &instance_id)
}


/// Unassign host from an event instance
pub fn unassign_host(
    series_id: Option<[u8; 16]>,
    occurrence_start: Option<u64>,
    instance_id: [u8; 16],
    caller: Principal,
) -> ApiResult<EventInstance> {
    let now = ic_cdk::api::time();
    let settings = storage::get_settings();
    
    // Check if claims are paused (admins can still unassign)
    if settings.claims_paused && !auth::is_admin(&caller) {
        return Err(ApiError::Conflict("Claims are currently paused".to_string()));
    }
    
    // Get previous host for notification
    let (event_start, event_end) = get_event_timing(series_id, occurrence_start, &instance_id)?;
    let previous_instance = get_event_instance(series_id, occurrence_start, &instance_id)?;
    let previous_host = previous_instance.host_principal;
    
    if let Some(sid) = series_id {
        // Series instance: update override
        let occ_start = occurrence_start.ok_or(ApiError::InvalidInput(
            "occurrence_start required for series instance".to_string()
        ))?;
        
        let mut ovr = storage::get_override(&OverrideKey {
            series_id: sid,
            occurrence_start_utc: occ_start,
        }).unwrap_or(InstanceOverride {
            series_id: sid,
            occurrence_start_utc: occ_start,
            start_utc: None,
            end_utc: None,
            notes: None,
            host_principal: None,
            host_cleared: false,
            cancelled: false,
            updated_at: now,
            updated_by: caller,
        });
        
        ovr.host_principal = None;
        ovr.host_cleared = true;
        ovr.updated_at = now;
        ovr.updated_by = caller;
        
        storage::insert_override(ovr);
        
    } else {
        // One-off instance: update directly
        let mut inst = storage::get_instance(&instance_id)
            .ok_or(ApiError::NotFound)?;
        
        inst.host_principal = None;
        storage::insert_instance(inst);
    }
    
    // Notify removed host and decrement their session count
    if let Some(host_principal) = previous_host {
        if let Some(mut host_user) = storage::get_user(&host_principal) {
            notifications::create_host_removed_notification(&host_user, &instance_id, event_start, event_end);
            host_user.sessions_hosted_count = host_user.sessions_hosted_count.saturating_sub(1);
            host_user.updated_at = now;
            storage::update_user(host_user);
        }
    }
    
    // Re-materialize to return updated instance
    get_event_instance(series_id, occurrence_start, &instance_id)
}


/// Cancel a single instance of a recurring series
///
/// Creates or updates an InstanceOverride with cancelled=true.
/// Notifies the assigned host if there is one.
pub fn cancel_instance(
    series_id: [u8; 16],
    occurrence_start: u64,
    instance_id: [u8; 16],
    caller: Principal,
) -> ApiResult<EventInstance> {
    let now = ic_cdk::api::time();

    let series = storage::get_series(&series_id).ok_or(ApiError::NotFound)?;
    let duration_nanos = (series.default_duration_minutes as u64) * 60 * 1_000_000_000;

    let mut ovr = storage::get_override(&OverrideKey {
        series_id,
        occurrence_start_utc: occurrence_start,
    }).unwrap_or(InstanceOverride {
        series_id,
        occurrence_start_utc: occurrence_start,
        start_utc: None,
        end_utc: None,
        notes: None,
        host_principal: None,
        host_cleared: false,
        cancelled: false,
        updated_at: now,
        updated_by: caller,
    });

    if ovr.cancelled {
        return Err(ApiError::Conflict("Instance is already cancelled".to_string()));
    }

    // Notify the assigned host before cancelling (use DST-adjusted times)
    let raw_start = ovr.start_utc.unwrap_or(occurrence_start);
    let raw_end = ovr.end_utc.unwrap_or(occurrence_start + duration_nanos);
    let (event_start, event_end) = maybe_adjust_dst(raw_start, raw_end, series.start_date);
    if let Some(host_principal) = ovr.host_principal {
        if let Some(host_user) = storage::get_user(&host_principal) {
            notifications::create_instance_cancelled_notification(
                &host_user, &instance_id, &series.title, event_start, event_end,
            );
        }
    }

    ovr.cancelled = true;
    ovr.updated_at = now;
    ovr.updated_by = caller;
    storage::insert_override(ovr.clone());

    // Return the cancelled instance with DST-adjusted times
    let notes = ovr.notes.unwrap_or(series.notes.clone());
    let host_principal = if ovr.host_cleared { None } else { ovr.host_principal };

    Ok(EventInstance {
        instance_id: recurrence::generate_instance_id(&series_id, occurrence_start),
        series_id: Some(series_id),
        start_utc: event_start,
        end_utc: event_end,
        title: series.title,
        notes,
        link: series.link,
        host_principal,
        status: EventStatus::Cancelled,
        color: series.color,
        exclude_from_coverage: series.exclude_from_coverage,
        created_at: series.created_at,
        occurrence_start_utc: Some(occurrence_start),
    })
}


/// Helper: Get event timing (start, end) for OOO checks and notifications.
/// Applies DST adjustment when ignore_dst is enabled, so the returned times
/// reflect the actual wall-clock time the event will occur at.
fn get_event_timing(
    series_id: Option<[u8; 16]>,
    occurrence_start: Option<u64>,
    instance_id: &[u8; 16],
) -> ApiResult<(u64, u64)> {
    if let Some(sid) = series_id {
        let occ_start = occurrence_start.ok_or(ApiError::InvalidInput(
            "occurrence_start required for series instance".to_string()
        ))?;

        let series = storage::get_series(&sid).ok_or(ApiError::NotFound)?;
        let duration_nanos = (series.default_duration_minutes as u64) * 60 * 1_000_000_000;

        // Check for override with custom timing
        let (start, end) = if let Some(ovr) = storage::get_override(&OverrideKey {
            series_id: sid,
            occurrence_start_utc: occ_start,
        }) {
            let s = ovr.start_utc.unwrap_or(occ_start);
            let e = ovr.end_utc.unwrap_or(s + duration_nanos);
            (s, e)
        } else {
            (occ_start, occ_start + duration_nanos)
        };

        // Apply DST adjustment so OOO checks and notifications use actual event time
        Ok(maybe_adjust_dst(start, end, series.start_date))
    } else {
        let inst = storage::get_instance(instance_id).ok_or(ApiError::NotFound)?;
        Ok((inst.start_utc, inst.end_utc))
    }
}

/// Helper: Get a single event instance (materialized or from storage)
/// Applies DST adjustment to match what materialize_events() produces.
fn get_event_instance(
    series_id: Option<[u8; 16]>,
    occurrence_start: Option<u64>,
    instance_id: &[u8; 16],
) -> ApiResult<EventInstance> {
    if let Some(sid) = series_id {
        let occ_start = occurrence_start.ok_or(ApiError::InvalidInput(
            "occurrence_start required".to_string()
        ))?;

        let series = storage::get_series(&sid).ok_or(ApiError::NotFound)?;
        let duration_nanos = (series.default_duration_minutes as u64) * 60 * 1_000_000_000;

        let ovr = storage::get_override(&OverrideKey {
            series_id: sid,
            occurrence_start_utc: occ_start,
        });

        if ovr.as_ref().map(|o| o.cancelled).unwrap_or(false) {
            return Err(ApiError::NotFound);
        }

        let mut start_utc = ovr.as_ref().and_then(|o| o.start_utc).unwrap_or(occ_start);
        let mut end_utc = ovr.as_ref().and_then(|o| o.end_utc).unwrap_or(occ_start + duration_nanos);
        let notes = ovr.as_ref().and_then(|o| o.notes.clone()).unwrap_or(series.notes.clone());
        let host_principal = if ovr.as_ref().map(|o| o.host_cleared).unwrap_or(false) {
            None
        } else {
            ovr.as_ref().and_then(|o| o.host_principal).or(series.default_host)
        };

        // Apply DST adjustment to match materialize_events() behavior
        let (adj_start, adj_end) = maybe_adjust_dst(start_utc, end_utc, series.start_date);
        start_utc = adj_start;
        end_utc = adj_end;

        Ok(EventInstance {
            instance_id: recurrence::generate_instance_id(&sid, occ_start),
            series_id: Some(sid),
            start_utc,
            end_utc,
            title: series.title,
            notes,
            link: series.link,
            host_principal,
            status: EventStatus::Active,
            color: series.color,
            exclude_from_coverage: series.exclude_from_coverage,
            created_at: series.created_at,
            occurrence_start_utc: Some(occ_start),
        })
    } else {
        storage::get_instance(instance_id).ok_or(ApiError::NotFound)
    }
}
