//! Authentication and authorization logic
//!
//! Bootstrap strategy:
//! - On init, the DFX deployer principal is set as the initial admin
//! - This allows CLI-based administration before any II principals are known
//! - Admin can then authorize II principals via dfx calls

use crate::storage;
use crate::types::*;
use candid::Principal;
use ic_cdk::caller;

/// Check if caller is authenticated (not anonymous)
pub fn require_authenticated() -> ApiResult<Principal> {
    let principal = caller();
    if principal == Principal::anonymous() {
        return Err(ApiError::Unauthorized);
    }
    Ok(principal)
}

/// Check if caller is a whitelisted user (active status)
pub fn require_authorized() -> ApiResult<User> {
    let principal = require_authenticated()?;
    match storage::get_user(&principal) {
        Some(user) if user.status == UserStatus::Active => Ok(user),
        Some(_) => Err(ApiError::Unauthorized), // User exists but disabled
        None => Err(ApiError::Unauthorized),    // Not whitelisted
    }
}

/// Update last_active for the caller (call on update endpoints)
pub fn touch_last_active(principal: &Principal) {
    if let Some(mut user) = storage::get_user(principal) {
        user.last_active = ic_cdk::api::time();
        storage::update_user(user);
    }
}

/// Check if caller is an admin
pub fn require_admin() -> ApiResult<User> {
    let user = require_authorized()?;
    if user.role != Role::Admin {
        return Err(ApiError::Unauthorized);
    }
    Ok(user)
}


/// Check if a user is available for assignment (not disabled, not on OOO)
pub fn can_be_assigned_host(user: &User, event_start: u64, event_end: u64) -> bool {
    if user.status == UserStatus::Disabled {
        return false;
    }
    
    // Check OOO blocks
    for ooo in &user.out_of_office {
        // If event overlaps with OOO block, user is unavailable
        if event_start < ooo.end_utc && event_end > ooo.start_utc {
            return false;
        }
    }
    
    true
}

/// Check if a principal is an admin (for admin override checks)
pub fn is_admin(principal: &Principal) -> bool {
    match storage::get_user(principal) {
        Some(user) => user.role == Role::Admin && user.status == UserStatus::Active,
        None => false,
    }
}

/// Initialize the first admin (called during canister init)
pub fn initialize_admin(principal: Principal, name: String, email: String) {
    let now = ic_cdk::api::time();
    let user = User {
        principal,
        name,
        email,
        role: Role::Admin,
        status: UserStatus::Active,
        out_of_office: vec![],
        notification_settings: NotificationSettings::default(),
        last_active: now,
        sessions_hosted_count: 0,
        created_at: now,
        updated_at: now,
    };
    storage::insert_user(user);
}
