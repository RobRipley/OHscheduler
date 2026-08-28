//! Recurrence logic for materializing event instances from series
//!
//! Key algorithm:
//! 1. For each series, generate occurrence dates within the window
//! 2. Apply any overrides (time changes, host assignments, cancellations)
//! 3. Generate deterministic instance IDs based on (series_id, occurrence_start)
//! 4. Combine with one-off events and sort by start time

use crate::storage;
use crate::types::*;
use candid::Principal;
use sha2::{Digest, Sha256};

/// Generate a deterministic instance ID from series_id and occurrence start time
pub fn generate_instance_id(series_id: &[u8; 16], occurrence_start: u64) -> [u8; 16] {
    let mut hasher = Sha256::new();
    hasher.update(series_id);
    hasher.update(&occurrence_start.to_be_bytes());
    let result = hasher.finalize();
    let mut id = [0u8; 16];
    id.copy_from_slice(&result[..16]);
    id
}

/// Generate a random-ish UUID using time + counter
/// Note: Not cryptographically secure, but sufficient for IDs
static mut UUID_COUNTER: u64 = 0;

pub fn generate_uuid() -> [u8; 16] {
    let time = ic_cdk::api::time();
    let counter = unsafe {
        UUID_COUNTER += 1;
        UUID_COUNTER
    };
    let mut hasher = Sha256::new();
    hasher.update(&time.to_be_bytes());
    hasher.update(&counter.to_be_bytes());
    let result = hasher.finalize();
    let mut id = [0u8; 16];
    id.copy_from_slice(&result[..16]);
    id
}


/// Convert nanoseconds to days since epoch (for date calculations)
fn nanos_to_days(nanos: u64) -> i64 {
    (nanos / 1_000_000_000 / 86400) as i64
}

/// Convert days since epoch to nanoseconds (start of day UTC)
fn days_to_nanos(days: i64) -> u64 {
    (days as u64) * 86400 * 1_000_000_000
}

/// Get year, month, day from nanoseconds timestamp
pub fn nanos_to_ymd(nanos: u64) -> (i32, u32, u32) {
    // Simple algorithm: days since epoch -> date
    let days = nanos_to_days(nanos) as i32;
    
    // Days since 1970-01-01
    let mut y = 1970;
    let mut remaining = days;
    
    loop {
        let days_in_year = if is_leap_year(y) { 366 } else { 365 };
        if remaining < days_in_year {
            break;
        }
        remaining -= days_in_year;
        y += 1;
    }
    
    let mut m = 1u32;
    loop {
        let days_in_month = days_in_month(y, m);
        if remaining < days_in_month as i32 {
            break;
        }
        remaining -= days_in_month as i32;
        m += 1;
    }
    
    (y, m, (remaining + 1) as u32)
}


fn is_leap_year(year: i32) -> bool {
    (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0)
}

fn days_in_month(year: i32, month: u32) -> u32 {
    match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => if is_leap_year(year) { 29 } else { 28 },
        _ => 0,
    }
}

/// Convert year/month/day to nanoseconds (start of day UTC)
fn ymd_to_nanos(year: i32, month: u32, day: u32) -> u64 {
    let mut days: i64 = 0;
    
    // Years from 1970
    for y in 1970..year {
        days += if is_leap_year(y) { 366 } else { 365 };
    }
    
    // Months in current year
    for m in 1..month {
        days += days_in_month(year, m) as i64;
    }
    
    // Days in current month
    days += (day - 1) as i64;
    
    days_to_nanos(days)
}

/// Get day of week (0=Mon, 6=Sun) from nanoseconds timestamp
fn weekday_from_nanos(nanos: u64) -> u32 {
    let days = nanos_to_days(nanos);
    // 1970-01-01 was Thursday (3)
    ((days + 3) % 7 + 7) as u32 % 7
}


/// Find the nth occurrence of a weekday in a month
/// Returns nanoseconds timestamp or None if doesn't exist
fn nth_weekday_of_month(year: i32, month: u32, weekday: Weekday, ordinal: WeekdayOrdinal) -> Option<u64> {
    let target_wd = weekday as u32;
    
    match ordinal {
        WeekdayOrdinal::First | WeekdayOrdinal::Second | WeekdayOrdinal::Third | WeekdayOrdinal::Fourth => {
            let n = ordinal as u32; // 1, 2, 3, or 4
            let first_of_month = ymd_to_nanos(year, month, 1);
            let first_wd = weekday_from_nanos(first_of_month);
            
            let days_until = (target_wd + 7 - first_wd) % 7;
            let target_day = 1 + days_until + (n - 1) * 7;
            
            if target_day <= days_in_month(year, month) {
                Some(ymd_to_nanos(year, month, target_day))
            } else {
                None // e.g., 5th Monday doesn't exist
            }
        }
        WeekdayOrdinal::Last => {
            let last_day = days_in_month(year, month);
            let last_of_month = ymd_to_nanos(year, month, last_day);
            let last_wd = weekday_from_nanos(last_of_month);
            
            let days_back = (last_wd + 7 - target_wd) % 7;
            let target_day = last_day - days_back;
            
            Some(ymd_to_nanos(year, month, target_day))
        }
    }
}


/// Check if a UTC timestamp falls within US Daylight Saving Time.
///
/// US DST: 2nd Sunday of March at 2:00 AM local → 1st Sunday of November at 2:00 AM local.
/// `std_offset_minutes` is the standard (non-DST) UTC offset, e.g. -300 for Eastern.
pub fn is_us_dst(utc_nanos: u64, std_offset_minutes: i16) -> bool {
    // Convert UTC to approximate local time using the standard offset
    let offset_nanos = (std_offset_minutes as i64).abs() * 60 * 1_000_000_000;
    let local_nanos = if std_offset_minutes < 0 {
        utc_nanos.saturating_sub(offset_nanos as u64)
    } else {
        utc_nanos + offset_nanos as u64
    };

    let (year, month, _) = nanos_to_ymd(local_nanos);

    match month {
        // Definitely not DST
        1 | 2 | 12 => false,
        // Definitely DST
        4..=10 => true,
        // March: DST starts on 2nd Sunday at 2 AM local
        3 => {
            let second_sunday = nth_weekday_of_month(year, 3, Weekday::Sun, WeekdayOrdinal::Second).unwrap();
            let dst_start_local = second_sunday + 2 * 3600 * 1_000_000_000;
            local_nanos >= dst_start_local
        }
        // November: DST ends on 1st Sunday at 2 AM local
        11 => {
            let first_sunday = nth_weekday_of_month(year, 11, Weekday::Sun, WeekdayOrdinal::First).unwrap();
            let dst_end_local = first_sunday + 2 * 3600 * 1_000_000_000;
            local_nanos < dst_end_local
        }
        _ => false,
    }
}

/// Adjust an occurrence's UTC time so it stays at the same local clock time
/// as the series start_date, compensating for DST transitions.
///
/// Returns the adjusted UTC nanoseconds.
pub fn adjust_for_dst(occ_utc: u64, series_start_utc: u64, std_offset_minutes: i16) -> u64 {
    let series_in_dst = is_us_dst(series_start_utc, std_offset_minutes);
    let occ_in_dst = is_us_dst(occ_utc, std_offset_minutes);

    if series_in_dst == occ_in_dst {
        // Same DST status — no adjustment
        occ_utc
    } else if !series_in_dst && occ_in_dst {
        // Series created in standard time, occurrence in DST (spring forward).
        // Local clocks moved ahead, so subtract 1hr from UTC to keep same wall-clock time.
        occ_utc.saturating_sub(3600 * 1_000_000_000)
    } else {
        // Series created in DST, occurrence in standard time (fall back).
        // Local clocks moved back, so add 1hr to UTC to keep same wall-clock time.
        occ_utc.saturating_add(3600 * 1_000_000_000)
    }
}


/// Generate all occurrence timestamps for a series within a window
fn generate_occurrences(
    series: &EventSeries,
    window_start: u64,
    window_end: u64,
) -> Vec<u64> {
    let mut occurrences = Vec::new();
    
    // Don't generate before series start
    let effective_start = window_start.max(series.start_date);
    
    // Don't generate after series end (if set)
    let effective_end = match series.end_date {
        Some(end) => window_end.min(end),
        None => window_end,
    };
    
    if effective_start >= effective_end {
        return occurrences;
    }
    
    // Extract time-of-day from series start_date (nanos since midnight UTC)
    // so that generated occurrences preserve the original event time
    let day_nanos: u64 = 86400 * 1_000_000_000;
    let time_of_day = series.start_date % day_nanos;

    let (start_year, start_month, _) = nanos_to_ymd(effective_start);
    let (end_year, end_month, _) = nanos_to_ymd(effective_end);

    match series.frequency {
        Frequency::Monthly => {
            let ordinal = series.weekday_ordinal.unwrap_or(WeekdayOrdinal::First);
            let mut year = start_year;
            let mut month = start_month;

            while year < end_year || (year == end_year && month <= end_month) {
                if let Some(occ_date) = nth_weekday_of_month(year, month, series.weekday, ordinal) {
                    let occ = occ_date + time_of_day;
                    if occ >= effective_start && occ < effective_end {
                        occurrences.push(occ);
                    }
                }

                month += 1;
                if month > 12 {
                    month = 1;
                    year += 1;
                }
            }
        }
        Frequency::Weekly | Frequency::Biweekly => {
            let target_wd = series.weekday as u32;
            let interval_days: u64 = if series.frequency == Frequency::Biweekly { 14 } else { 7 };
            let interval_nanos = interval_days * day_nanos;

            // Anchor from the series start date to preserve biweekly cadence.
            // For weekly, any matching weekday works; for biweekly, the alternating
            // week pattern must align with the original series start.
            let series_start_day = series.start_date - (series.start_date % day_nanos);
            let series_wd = weekday_from_nanos(series_start_day);
            let days_until_first = (target_wd + 7 - series_wd) % 7;
            let anchor = series_start_day + days_until_first as u64 * day_nanos + time_of_day;

            // Fast-forward from anchor to the first occurrence on or after effective_start
            let mut occ = anchor;
            if occ < effective_start {
                let gap = effective_start - occ;
                let intervals = gap / interval_nanos;
                occ += intervals * interval_nanos;
                // occ might still be just before effective_start due to integer division
                if occ < effective_start {
                    occ += interval_nanos;
                }
            }

            while occ < effective_end {
                if occ >= series.start_date {
                    occurrences.push(occ);
                }
                occ += interval_nanos;
            }
        }
    }
    
    occurrences
}


/// Calculate window end based on forward_window_months setting
pub fn calculate_window_end(from: u64, months: u8) -> u64 {
    let (mut year, mut month, _) = nanos_to_ymd(from);
    
    for _ in 0..months {
        month += 1;
        if month > 12 {
            month = 1;
            year += 1;
        }
    }
    
    // Return end of the month
    let last_day = days_in_month(year, month);
    ymd_to_nanos(year, month, last_day) + 86400 * 1_000_000_000 - 1
}

/// Resolve the effective host for a given slot: explicit override wins, then
/// the series default, unless the override explicitly cleared that slot.
pub fn effective_host(ovr: Option<&InstanceOverride>, series_default: Option<Principal>, slot: HostSlot) -> Option<Principal> {
    match slot {
        HostSlot::Primary => {
            if ovr.map(|o| o.host_cleared).unwrap_or(false) {
                None
            } else {
                ovr.and_then(|o| o.host_principal).or(series_default)
            }
        }
        HostSlot::Secondary => {
            if ovr.and_then(|o| o.host_2_cleared).unwrap_or(false) {
                None
            } else {
                ovr.and_then(|o| o.host_principal_2).or(series_default)
            }
        }
        HostSlot::Tertiary => {
            if ovr.and_then(|o| o.host_3_cleared).unwrap_or(false) {
                None
            } else {
                ovr.and_then(|o| o.host_principal_3).or(series_default)
            }
        }
    }
}

/// Materialize all events within a time window
/// Combines generated series occurrences with overrides and one-off events
pub fn materialize_events(window_start: u64, window_end: u64) -> Vec<EventInstance> {
    let mut results = Vec::new();
    let settings = storage::get_settings();
    let now = ic_cdk::api::time();
    
    // Generate instances from all series
    for series in storage::list_all_series() {
        // Skip paused series
        if series.paused {
            continue;
        }
        let occurrences = generate_occurrences(&series, window_start, window_end);
        let duration_nanos = (series.default_duration_minutes as u64) * 60 * 1_000_000_000;
        
        for occ_start in occurrences {
            let override_key = OverrideKey {
                series_id: series.series_id,
                occurrence_start_utc: occ_start,
            };
            
            let ovr = storage::get_override(&override_key);
            
            // Skip if cancelled
            if let Some(ref o) = ovr {
                if o.cancelled {
                    continue;
                }
            }
            
            // Build instance
            let instance_id = generate_instance_id(&series.series_id, occ_start);
            let has_custom_start = ovr.as_ref().and_then(|o| o.start_utc).is_some();
            let has_custom_end = ovr.as_ref().and_then(|o| o.end_utc).is_some();
            let mut start_utc = ovr.as_ref().and_then(|o| o.start_utc).unwrap_or(occ_start);
            let mut end_utc = ovr.as_ref().and_then(|o| o.end_utc).unwrap_or(occ_start + duration_nanos);
            let notes = ovr.as_ref().and_then(|o| o.notes.clone()).unwrap_or(series.notes.clone());

            // Apply DST adjustment if ignore_dst is enabled.
            // Skip adjustment for explicitly-set custom override times (they're already correct).
            if settings.ignore_dst {
                if let Some(offset) = settings.dst_utc_offset_minutes {
                    if !has_custom_start {
                        start_utc = adjust_for_dst(start_utc, series.start_date, offset);
                    }
                    if !has_custom_end {
                        end_utc = adjust_for_dst(end_utc, series.start_date, offset);
                    }
                }
            }

            // Host: check if explicitly cleared, otherwise use override value, then fall back to series default
            let host_principal = effective_host(ovr.as_ref(), series.default_host, HostSlot::Primary);
            let host_principal_2 = effective_host(ovr.as_ref(), series.default_host_2, HostSlot::Secondary);
            let host_principal_3 = effective_host(ovr.as_ref(), series.default_host_3, HostSlot::Tertiary);

            results.push(EventInstance {
                instance_id,
                series_id: Some(series.series_id),
                start_utc,
                end_utc,
                title: series.title.clone(),
                notes,
                link: series.link.clone(),
                host_principal,
                status: EventStatus::Active,
                color: series.color.clone(),
                exclude_from_coverage: series.exclude_from_coverage,
                created_at: series.created_at,
                occurrence_start_utc: Some(occ_start),
                host_principal_2,
                allow_second_host: Some(series.allow_second_host.unwrap_or(false)),
                host_principal_3,
                allow_third_host: Some(series.allow_third_host.unwrap_or(false)),
            });
        }
    }
    
    // Add one-off events within window
    for inst in storage::list_all_instances() {
        if inst.start_utc >= window_start && inst.start_utc < window_end && inst.status == EventStatus::Active {
            results.push(inst);
        }
    }
    
    // Sort by start time
    results.sort_by_key(|e| e.start_utc);
    results
}

/// Get unclaimed events within the forward window
pub fn list_unclaimed_events() -> Vec<EventInstance> {
    let now = ic_cdk::api::time();
    let settings = storage::get_settings();
    let window_end = calculate_window_end(now, settings.forward_window_months);
    
    materialize_events(now, window_end)
        .into_iter()
        .filter(|e| e.host_principal.is_none())
        .collect()
}


/// Get the start/end nanos and label for `months_back` months ago.
/// months_back=0 means current month.
pub fn month_window(now: u64, months_back: u8) -> (u64, u64, String) {
    let (mut y, mut m, _) = nanos_to_ymd(now);
    
    for _ in 0..months_back {
        if m == 1 {
            m = 12;
            y -= 1;
        } else {
            m -= 1;
        }
    }
    
    let start = ymd_to_nanos(y, m, 1);
    
    let (ny, nm) = if m == 12 { (y + 1, 1) } else { (y, m + 1) };
    let end = ymd_to_nanos(ny, nm, 1);
    
    let month_names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    let label = format!("{} {}", month_names[(m - 1) as usize], y);
    
    (start, end, label)
}
