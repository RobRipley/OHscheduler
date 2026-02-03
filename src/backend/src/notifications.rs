//! Notification outbox and iCalendar generation
//!
//! Strategy:
//! - On relevant actions, create NotificationJob records with status=Pending
//! - Generate and store ICS payload at job creation time
//! - External worker (future) polls pending jobs and sends emails
//! - For MVP, UI can provide "download .ics" from the stored payload

use crate::recurrence;
use crate::storage;
use crate::types::*;
use candid::Principal;

/// Format a timestamp as ICS datetime (YYYYMMDDTHHMMSSZ)
fn format_ics_datetime(nanos: u64) -> String {
    let secs = nanos / 1_000_000_000;
    let days_since_epoch = secs / 86400;
    let time_of_day = secs % 86400;
    
    let hours = time_of_day / 3600;
    let minutes = (time_of_day % 3600) / 60;
    let seconds = time_of_day % 60;
    
    // Simple date calculation
    let mut year = 1970i32;
    let mut remaining_days = days_since_epoch as i32;
    
    loop {
        let days_in_year = if (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0) { 366 } else { 365 };
        if remaining_days < days_in_year {
            break;
        }
        remaining_days -= days_in_year;
        year += 1;
    }
    
    let days_in_months = if (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0) {
        [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    } else {
        [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    };
    
    let mut month = 1u32;
    for dim in days_in_months {
        if remaining_days < dim {
            break;
        }
        remaining_days -= dim;
        month += 1;
    }
    let day = remaining_days + 1;
    
    format!("{:04}{:02}{:02}T{:02}{:02}{:02}Z", year, month, day, hours, minutes, seconds)
}


/// Generate iCalendar content for an event
/// method: "REQUEST" for new/update, "CANCEL" for cancellation
pub fn generate_ics(
    instance_id: &[u8; 16],
    title: &str,
    notes: &str,
    start_utc: u64,
    end_utc: u64,
    method: &str,
    sequence: u32,
    cancelled: bool,
) -> String {
    let uid = format!("{}@ohscheduler.icp", hex::encode(instance_id));
    let now = format_ics_datetime(ic_cdk::api::time());
    let start = format_ics_datetime(start_utc);
    let end = format_ics_datetime(end_utc);
    let status = if cancelled { "CANCELLED" } else { "CONFIRMED" };
    
    // Escape special characters in title and notes
    let title_escaped = title.replace("\\", "\\\\").replace(",", "\\,").replace(";", "\\;");
    let notes_escaped = notes.replace("\\", "\\\\").replace(",", "\\,").replace(";", "\\;").replace("\n", "\\n");
    
    format!(
r#"BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//OHScheduler//ICP//EN
METHOD:{}
BEGIN:VEVENT
UID:{}
SEQUENCE:{}
DTSTAMP:{}
DTSTART:{}
DTEND:{}
SUMMARY:{}
DESCRIPTION:{}
STATUS:{}
END:VEVENT
END:VCALENDAR"#,
        method,
        uid,
        sequence,
        now,
        start,
        end,
        title_escaped,
        notes_escaped,
        status
    )
}


/// Create notification job for host assignment
pub fn create_host_assigned_notification(
    host: &User,
    instance_id: &[u8; 16],
    start_utc: u64,
    end_utc: u64,
) {
    if !host.notification_settings.email_on_assigned {
        return;
    }
    
    let now = ic_cdk::api::time();
    let job_id = recurrence::generate_uuid();
    
    let ics = generate_ics(
        instance_id,
        "Office Hours Session",
        "You have been assigned as host for this session.",
        start_utc,
        end_utc,
        "REQUEST",
        1,
        false,
    );
    
    let job = NotificationJob {
        job_id,
        created_at: now,
        notification_type: NotificationType::HostAssigned,
        recipient_principal: host.principal,
        recipient_email: host.email.clone(),
        subject: "You've been assigned to an Office Hours session".to_string(),
        body_text: format!(
            "You have been assigned as host for an Office Hours session.\n\nPlease add the attached calendar invite to your calendar."
        ),
        ics_payload: Some(ics),
        status: NotificationStatus::Pending,
        sent_at: None,
        error_message: None,
    };
    
    storage::insert_notification(job);
}

/// Create notification job for host removal
pub fn create_host_removed_notification(
    host: &User,
    instance_id: &[u8; 16],
    start_utc: u64,
    end_utc: u64,
) {
    if !host.notification_settings.email_on_removed {
        return;
    }
    
    let now = ic_cdk::api::time();
    let job_id = recurrence::generate_uuid();
    
    let ics = generate_ics(
        instance_id,
        "Office Hours Session - CANCELLED",
        "You have been removed as host for this session.",
        start_utc,
        end_utc,
        "CANCEL",
        2,
        true,
    );
    
    let job = NotificationJob {
        job_id,
        created_at: now,
        notification_type: NotificationType::HostRemoved,
        recipient_principal: host.principal,
        recipient_email: host.email.clone(),
        subject: "You've been removed from an Office Hours session".to_string(),
        body_text: "You have been removed as host for an Office Hours session.".to_string(),
        ics_payload: Some(ics),
        status: NotificationStatus::Pending,
        sent_at: None,
        error_message: None,
    };
    
    storage::insert_notification(job);
}


/// Create notification job for instance cancellation
pub fn create_instance_cancelled_notification(
    host: &User,
    instance_id: &[u8; 16],
    title: &str,
    start_utc: u64,
    end_utc: u64,
) {
    if !host.notification_settings.email_on_cancelled {
        return;
    }
    
    let now = ic_cdk::api::time();
    let job_id = recurrence::generate_uuid();
    
    let ics = generate_ics(
        instance_id,
        title,
        "This session has been cancelled.",
        start_utc,
        end_utc,
        "CANCEL",
        2,
        true,
    );
    
    let job = NotificationJob {
        job_id,
        created_at: now,
        notification_type: NotificationType::InstanceCancelled,
        recipient_principal: host.principal,
        recipient_email: host.email.clone(),
        subject: format!("Office Hours session cancelled: {}", title),
        body_text: format!("The Office Hours session '{}' has been cancelled.", title),
        ics_payload: Some(ics),
        status: NotificationStatus::Pending,
        sent_at: None,
        error_message: None,
    };
    
    storage::insert_notification(job);
}

/// Create notification job for instance time change
pub fn create_instance_time_changed_notification(
    host: &User,
    instance_id: &[u8; 16],
    title: &str,
    start_utc: u64,
    end_utc: u64,
) {
    if !host.notification_settings.email_on_time_changed {
        return;
    }
    
    let now = ic_cdk::api::time();
    let job_id = recurrence::generate_uuid();
    
    let ics = generate_ics(
        instance_id,
        title,
        "The time for this session has been updated.",
        start_utc,
        end_utc,
        "REQUEST",
        2,
        false,
    );
    
    let job = NotificationJob {
        job_id,
        created_at: now,
        notification_type: NotificationType::InstanceTimeChanged,
        recipient_principal: host.principal,
        recipient_email: host.email.clone(),
        subject: format!("Office Hours session time changed: {}", title),
        body_text: format!("The time for Office Hours session '{}' has been updated. Please see the attached calendar invite.", title),
        ics_payload: Some(ics),
        status: NotificationStatus::Pending,
        sent_at: None,
        error_message: None,
    };
    
    storage::insert_notification(job);
}
