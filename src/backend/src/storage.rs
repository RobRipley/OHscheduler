//! Stable storage management using ic-stable-structures
//!
//! Memory Layout:
//! - Memory 0: Users (Principal -> User)
//! - Memory 1: EventSeries (Uuid -> EventSeries)
//! - Memory 2: InstanceOverrides (OverrideKey -> InstanceOverride)
//! - Memory 3: OneOffInstances (Uuid -> EventInstance)
//! - Memory 4: GlobalSettings (StableCell)
//! - Memory 5: NotificationJobs (Uuid -> NotificationJob)

use crate::types::*;
use candid::Principal;
use ic_stable_structures::{
    memory_manager::{MemoryId, MemoryManager, VirtualMemory},
    storable::Blob,
    DefaultMemoryImpl, StableBTreeMap, StableCell,
};
use std::cell::RefCell;

type Memory = VirtualMemory<DefaultMemoryImpl>;

const USERS_MEM_ID: MemoryId = MemoryId::new(0);
const SERIES_MEM_ID: MemoryId = MemoryId::new(1);
const OVERRIDES_MEM_ID: MemoryId = MemoryId::new(2);
const INSTANCES_MEM_ID: MemoryId = MemoryId::new(3);
const SETTINGS_MEM_ID: MemoryId = MemoryId::new(4);
const NOTIFICATIONS_MEM_ID: MemoryId = MemoryId::new(5);


thread_local! {
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> =
        RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));

    static USERS: RefCell<StableBTreeMap<Blob<29>, User, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(USERS_MEM_ID))
        )
    );

    static SERIES: RefCell<StableBTreeMap<Uuid, EventSeries, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(SERIES_MEM_ID))
        )
    );

    static OVERRIDES: RefCell<StableBTreeMap<OverrideKey, InstanceOverride, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(OVERRIDES_MEM_ID))
        )
    );

    static INSTANCES: RefCell<StableBTreeMap<Uuid, EventInstance, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(INSTANCES_MEM_ID))
        )
    );

    static SETTINGS: RefCell<StableCell<GlobalSettings, Memory>> = RefCell::new(
        StableCell::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(SETTINGS_MEM_ID)),
            GlobalSettings::default()
        ).expect("Failed to initialize settings")
    );

    static NOTIFICATIONS: RefCell<StableBTreeMap<Uuid, NotificationJob, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(NOTIFICATIONS_MEM_ID))
        )
    );
}


// ============================================================================
// Helper: Convert Principal to Blob<29> for stable storage
// ============================================================================

fn principal_to_blob(p: &Principal) -> Blob<29> {
    let bytes = p.as_slice();
    Blob::try_from(bytes).expect("Principal too large")
}

// ============================================================================
// User Storage
// ============================================================================

pub fn get_user(principal: &Principal) -> Option<User> {
    USERS.with(|users| users.borrow().get(&principal_to_blob(principal)))
}

pub fn insert_user(user: User) {
    USERS.with(|users| {
        users.borrow_mut().insert(principal_to_blob(&user.principal), user);
    });
}

pub fn update_user(user: User) {
    insert_user(user);
}

pub fn list_all_users() -> Vec<User> {
    USERS.with(|users| {
        users.borrow().iter().map(|(_, u)| u).collect()
    })
}

pub fn user_exists(principal: &Principal) -> bool {
    USERS.with(|users| users.borrow().contains_key(&principal_to_blob(principal)))
}


// ============================================================================
// EventSeries Storage
// ============================================================================

pub fn get_series(series_id: &[u8; 16]) -> Option<EventSeries> {
    SERIES.with(|s| s.borrow().get(&Uuid::new(*series_id)))
}

pub fn insert_series(series: EventSeries) {
    SERIES.with(|s| {
        s.borrow_mut().insert(Uuid::new(series.series_id), series);
    });
}

pub fn delete_series(series_id: &[u8; 16]) -> bool {
    SERIES.with(|s| s.borrow_mut().remove(&Uuid::new(*series_id)).is_some())
}

pub fn list_all_series() -> Vec<EventSeries> {
    SERIES.with(|s| s.borrow().iter().map(|(_, v)| v).collect())
}

// ============================================================================
// InstanceOverride Storage
// ============================================================================

pub fn get_override(key: &OverrideKey) -> Option<InstanceOverride> {
    OVERRIDES.with(|o| o.borrow().get(key))
}

pub fn insert_override(ovr: InstanceOverride) {
    let key = OverrideKey {
        series_id: ovr.series_id,
        occurrence_start_utc: ovr.occurrence_start_utc,
    };
    OVERRIDES.with(|o| {
        o.borrow_mut().insert(key, ovr);
    });
}

pub fn list_overrides_for_series(series_id: &[u8; 16]) -> Vec<InstanceOverride> {
    let start_key = OverrideKey {
        series_id: *series_id,
        occurrence_start_utc: 0,
    };
    let end_key = OverrideKey {
        series_id: *series_id,
        occurrence_start_utc: u64::MAX,
    };
    OVERRIDES.with(|o| {
        o.borrow()
            .range(start_key..=end_key)
            .map(|(_, v)| v)
            .collect()
    })
}


// ============================================================================
// One-Off EventInstance Storage
// ============================================================================

pub fn get_instance(instance_id: &[u8; 16]) -> Option<EventInstance> {
    INSTANCES.with(|i| i.borrow().get(&Uuid::new(*instance_id)))
}

pub fn insert_instance(inst: EventInstance) {
    INSTANCES.with(|i| {
        i.borrow_mut().insert(Uuid::new(inst.instance_id), inst);
    });
}

pub fn delete_instance(instance_id: &[u8; 16]) -> bool {
    INSTANCES.with(|i| i.borrow_mut().remove(&Uuid::new(*instance_id)).is_some())
}

pub fn list_all_instances() -> Vec<EventInstance> {
    INSTANCES.with(|i| i.borrow().iter().map(|(_, v)| v).collect())
}

// ============================================================================
// GlobalSettings Storage
// ============================================================================

pub fn get_settings() -> GlobalSettings {
    SETTINGS.with(|s| s.borrow().get().clone())
}

pub fn update_settings(settings: GlobalSettings) {
    SETTINGS.with(|s| {
        s.borrow_mut().set(settings).expect("Failed to update settings");
    });
}

// ============================================================================
// NotificationJob Storage
// ============================================================================

pub fn get_notification(job_id: &[u8; 16]) -> Option<NotificationJob> {
    NOTIFICATIONS.with(|n| n.borrow().get(&Uuid::new(*job_id)))
}

pub fn insert_notification(job: NotificationJob) {
    NOTIFICATIONS.with(|n| {
        n.borrow_mut().insert(Uuid::new(job.job_id), job);
    });
}

pub fn list_pending_notifications() -> Vec<NotificationJob> {
    NOTIFICATIONS.with(|n| {
        n.borrow()
            .iter()
            .filter(|(_, job)| job.status == NotificationStatus::Pending)
            .map(|(_, job)| job)
            .collect()
    })
}

pub fn update_notification(job: NotificationJob) {
    insert_notification(job);
}
