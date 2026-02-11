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
    let host_user = storage::get_user(&host_principal)
        .ok_or(ApiError::NotFound)?;
    
    // Get event timing for OOO check
    let (event_start, event_end) = get_event_timing(series_id, occurrence_start, &instance_id)?;
    
    if !admin_override && !auth::can_be_assigned_host(&host_user, event_start, event_end) {
        return Err(ApiError::Conflict(
            "User cannot be assigned (disabled or on out-of-office)".to_string()
        ));
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
    
    // Create notification for removed host
    if let Some(host_principal) = previous_host {
        if let Some(host_user) = storage::get_user(&host_principal) {
            notifications::create_host_removed_notification(&host_user, &instance_id, event_start, event_end);
        }
    }
    
    // Re-materialize to return updated instance
    get_event_instance(series_id, occurrence_start, &instance_id)
}


/// Helper: Get event timing (start, end) for OOO checks
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
        if let Some(ovr) = storage::get_override(&OverrideKey {
            series_id: sid,
            occurrence_start_utc: occ_start,
        }) {
            let start = ovr.start_utc.unwrap_or(occ_start);
            let end = ovr.end_utc.unwrap_or(start + duration_nanos);
            return Ok((start, end));
        }
        
        Ok((occ_start, occ_start + duration_nanos))
    } else {
        let inst = storage::get_instance(instance_id).ok_or(ApiError::NotFound)?;
        Ok((inst.start_utc, inst.end_utc))
    }
}

/// Helper: Get a single event instance (materialized or from storage)
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
        
        let start_utc = ovr.as_ref().and_then(|o| o.start_utc).unwrap_or(occ_start);
        let end_utc = ovr.as_ref().and_then(|o| o.end_utc).unwrap_or(occ_start + duration_nanos);
        let notes = ovr.as_ref().and_then(|o| o.notes.clone()).unwrap_or(series.notes.clone());
        let host_principal = if ovr.as_ref().map(|o| o.host_cleared).unwrap_or(false) {
            None
        } else {
            ovr.as_ref().and_then(|o| o.host_principal)
        };
        
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
            created_at: series.created_at,
        })
    } else {
        storage::get_instance(instance_id).ok_or(ApiError::NotFound)
    }
}
