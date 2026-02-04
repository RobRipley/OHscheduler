# Office Hours Scheduler – Project Handoff Document

**Last Updated:** 2026-02-04 (Session 5 - Comprehensive Session Expiry Handling)
**Status:** Mainnet Deployed / Session Expiry Auto-Recovery Implemented / Code Pushed to GitHub

---

## 1. Project Overview

A lightweight office-hours scheduling system built on the **Internet Computer (ICP)** with:
- Public read-only calendar
- Authenticated user experience for claiming/managing sessions
- Admin interface for user management, scheduling, and reporting
- **Notification outbox** (emails deferred to off-chain worker; ICS generated in-canister)

---

## 2. Project Paths

| Item | Path |
|------|------|
| Project Root | `/Users/robertripley/coding/OHscheduler` |
| Product Spec | `/Users/robertripley/coding/OHscheduler/spec.md` |
| Implementation Brief | `/Users/robertripley/coding/OHscheduler/implementation-brief.md` |
| This Handoff | `/Users/robertripley/coding/OHscheduler/docs/handoff.md` |
| GitHub Repo | `https://github.com/RobRipley/OHscheduler` |

**Local DFX Identity:**
- Name: `RobRipley_YSL`
- Principal: `7ma2w-gqief-6zbuk-7hxgr-aehmx-imu3j-bwstx-2fvfw-jazen-6ljbd-hqe`

---

## 3. Current Deployment (Mainnet)

| Canister | ID | URL |
|----------|----|----|
| **Frontend** | `6sm6t-iiaaa-aaaad-aebwq-cai` | https://6sm6t-iiaaa-aaaad-aebwq-cai.icp0.io/ |
| **Backend** | `6vnyh-fqaaa-aaaad-aebwa-cai` | [Candid UI](https://a4gq6-oaaaa-aaaab-qaa4q-cai.raw.icp0.io/?id=6vnyh-fqaaa-aaaad-aebwa-cai) |
| **Internet Identity** | `rdmx6-jaaaa-aaaaa-aaadq-cai` | https://id.ai |

**Authorized Users:**
1. DFX Principal (Initial Admin): `7ma2w-gqief-6zbuk-7hxgr-aehmx-imu3j-bwstx-2fvfw-jazen-6ljbd-hqe`
2. Rob (II Principal, Admin): `ht6va-4ecww-kmn45-rft5c-wt665-3yt27-74oon-ogtfb-yogj6-eiujt-2qe`

---

## 4. Implementation Status

### ✅ Completed
- Project scaffold (dfx.json, Cargo.toml, directory structure)
- **Backend canister (Rust)** - fully implemented:
  - types.rs - All data types with Storable implementations
  - storage.rs - Stable structures for users, series, overrides, instances, notifications
  - auth.rs - Authentication and authorization logic
  - recurrence.rs - Event materialization algorithm
  - coverage.rs - Host assign/unassign logic
  - notifications.rs - Outbox and ICS generation
  - lib.rs - All API endpoints
  - backend.did - Candid interface
- **Frontend scaffold (React + Vite)**:
  - useAuth hook with II integration - **WORKING**
  - NotAuthorized page (displays principal for copy)
  - Login page
  - PublicCalendar page with smart Sign In button
  - AuthenticatedLayout with navigation
  - Placeholder components for Calendar, Queue, AdminPanel
- **Local deployment successful**
- **Admin bootstrap verified** - DFX principal auto-set as admin
- **Event materialization tested** - Weekly series generates correct instances
- **Full auth flow working**:
  - II authentication ✅
  - Backend authorization check ✅
  - "Not Authorized" page for unauthorized users ✅
  - Redirect to dashboard for authorized users ✅
  - Smart "Sign In / Go to Dashboard" button ✅

### ✅ Session Expiry Handling (Session 4 & 5)
- Detects "Invalid signature" / "EcdsaP256 signature could not be verified" errors
- **Comprehensive coverage:** All API call catch blocks now check for session expiry
- Auto-clears stale IndexedDB/localStorage auth data via `clearAuthStorage()`
- Shows session expired banner at top of dashboard with "Sign In" button
- `triggerSessionExpired()` passed to all components making API calls
- Components updated: AdminPanel, Calendar, CoverageQueue (all forms and modals)
- Users no longer need to manually clear browser data when delegation expires overnight

### ✅ UI Improvements (Session 3)
- Calendar month view - proper grid layout with weeks as rows
- Series creation form - time picker added, weekday derived from start date
- Edit button on series list
- Timezone display in headers (both public and dashboard)
- Public calendar now fetches and displays real events

### 📋 TODO
- Test full claim/unclaim flow end-to-end
- Test series edit functionality
- Add loading states and error boundaries
- Style polish

---

## 5. Admin Bootstrap Strategy

### How It Works
1. On `dfx deploy`, the init function automatically sets the deployer principal as admin
2. DFX principal: `7ma2w-gqief-6zbuk-7hxgr-aehmx-imu3j-bwstx-2fvfw-jazen-6ljbd-hqe`
3. Admin can authorize II principals via CLI

### Authorization Command
```bash
cd /Users/robertripley/coding/OHscheduler
dfx canister call backend authorize_user '(
  principal "YOUR_II_PRINCIPAL",
  "User Name",
  "email@example.com",
  variant { Admin }  # or variant { User }
)'
```

---

## 6. Key Architecture Decisions

### Override Key Strategy
Override key = `(series_id: [u8;16], occurrence_start_utc: u64)`

### Instance ID Generation
- Series occurrences: `SHA256(series_id + occurrence_start)[0:16]` (deterministic)
- One-off events: Random UUID at creation time

### Notification Outbox (No Email in v1)
- NotificationJob records created on relevant actions
- ICS payload pre-generated at job creation
- External worker can poll `list_pending_notifications()` to send emails
- MVP: UI provides "Download .ics" button

---

## 7. API Surface (Backend)

### Public (No Auth)
- `list_events_public(window_start, window_end) -> Vec<PublicEventView>`
- `whoami() -> Principal`

### Authenticated
- `get_current_user() -> Result<User, ApiError>`
- `update_notification_settings(NotificationSettings) -> Result<(), ApiError>`
- `set_out_of_office(Vec<OOOBlock>) -> Result<(), ApiError>`
- `list_events(window_start, window_end) -> Result<Vec<EventInstance>, ApiError>`
- `list_unclaimed_events() -> Result<Vec<EventInstance>, ApiError>`
- `create_one_off_event(CreateEventInput) -> Result<EventInstance, ApiError>`
- `assign_host(...) -> Result<EventInstance, ApiError>`
- `unassign_host(...) -> Result<EventInstance, ApiError>`
- `get_event_ics(instance_id) -> Result<String, ApiError>`

### Admin Only
- `list_users() -> Result<Vec<User>, ApiError>`
- `authorize_user(principal, name, email, role) -> Result<User, ApiError>`
- `disable_user(principal) / enable_user(principal)`
- `update_user(principal, name, email, role)`
- `create_event_series(CreateSeriesInput) -> Result<EventSeries, ApiError>`
- `update_event_series(series_id, UpdateSeriesInput)`
- `delete_event_series(series_id)`
- `list_event_series()`
- `update_global_settings(GlobalSettings)`
- `get_global_settings()`
- `list_pending_notifications()`
- `mark_notification_sent(job_id)`

---

## 8. Commands Reference

```bash
# Use correct identity
dfx identity use RobRipley_YSL

# Start local replica
dfx start --clean --background

# Deploy all canisters
dfx deploy

# Pull and deploy II dependency
dfx deps pull && dfx deps init && dfx deps deploy

# Deploy frontend only (with reinstall for code changes)
npm run build && yes | dfx deploy frontend --mode reinstall

# Get backend canister ID
dfx canister id backend

# Test backend
dfx canister call backend whoami
dfx canister call backend get_current_user
dfx canister call backend list_users
dfx canister call backend list_events_public '(1738368000000000000, 1743638400000000000)'

# Authorize a user
dfx canister call backend authorize_user '(
  principal "xxxxx-xxxxx-xxxxx-xxxxx-cai",
  "User Name",
  "email@example.com",
  variant { Admin }
)'

# Create weekly event series
dfx canister call backend create_event_series '(record {
  title = "Weekly Office Hours";
  notes = "Open office hours";
  frequency = variant { Weekly };
  weekday = variant { Wed };
  weekday_ordinal = null;
  start_date = 1704067200000000000;
  end_date = null;
  default_duration_minutes = opt 60;
})'
```

---

## 9. Work Log

| Date | Session | Status | Description |
|------|---------|--------|-------------|
| 2026-02-02 | 1 | ✅ | Initial research, architecture proposal |
| 2026-02-02 | 2 | ✅ | Refined architecture per new requirements |
| 2026-02-02 | 2 | ✅ | Created project scaffold |
| 2026-02-02 | 2 | ✅ | Implemented all backend modules |
| 2026-02-02 | 2 | ✅ | Backend compiles successfully |
| 2026-02-02 | 2 | ✅ | Created frontend scaffold |
| 2026-02-02 | 2 | ✅ | Local deployment successful |
| 2026-02-02 | 2 | ✅ | Fixed Candid interface (principal field naming) |
| 2026-02-02 | 2 | ✅ | Fixed useAuth to actually call backend |
| 2026-02-02 | 2 | ✅ | Authorized Rob's II principal as Admin |
| 2026-02-02 | 2 | ✅ | Fixed Sign In button to detect auth state |
| 2026-02-02 | 2 | 🔄 | Building dashboard features |
| 2026-02-03 | 3 | ✅ | Fixed calendar month view, added time picker to series, added edit button, added timezone display, connected public calendar to backend |
| 2026-02-03 | 4 | ✅ | Fixed session expiry handling, pushed code to GitHub, deployed to mainnet |
| 2026-02-04 | 5 | ✅ | Comprehensive session expiry detection across all components, auto-recovery with banner UI |

---

## 10. File Structure

```
OHscheduler/
├── dfx.json
├── Cargo.toml
├── package.json
├── vite.config.ts
├── tsconfig.json
├── docs/
│   └── handoff.md
├── src/
│   ├── backend/
│   │   ├── Cargo.toml
│   │   ├── backend.did
│   │   └── src/
│   │       ├── lib.rs          # API endpoints
│   │       ├── types.rs        # Data types
│   │       ├── storage.rs      # Stable structures
│   │       ├── auth.rs         # Auth + whitelist
│   │       ├── recurrence.rs   # Event materialization
│   │       ├── coverage.rs     # Host assign/unassign
│   │       └── notifications.rs # Outbox + ICS
│   └── frontend/
│       ├── index.html
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           ├── hooks/
│           │   └── useAuth.tsx  # II auth (working!)
│           └── components/
│               ├── NotAuthorized.tsx
│               ├── Login.tsx
│               ├── PublicCalendar.tsx
│               ├── AuthenticatedLayout.tsx
│               ├── Calendar.tsx      # TODO
│               ├── CoverageQueue.tsx # TODO
│               └── AdminPanel.tsx    # TODO
```

---

## 11. Constraints (DO NOT VIOLATE)

1. Auth via Internet Identity (`https://id.ai/`) only
2. All timestamps in UTC (nanoseconds from `ic_cdk::api::time()`)
3. Recurring events are templates - never mutated by instance actions
4. Claiming affects ONE instance only (creates override)
5. Only admins may create/modify event series
6. Materialization within forward window only (default: 2 months)
7. Monthly recurrence = weekday ordinal, NOT calendar date
8. Users on OOO cannot be assigned (admin override allowed)
9. Public calendar is read-only
10. DFX principal is initial admin (bootstrap before II known)
11. No HTTP outcalls in v1 (notification outbox only)

---

## 12. Next Steps

1. Implement Calendar view with real events from backend
2. Implement Coverage Queue with claim/unclaim
3. Implement Admin Panel (users, series, settings)
4. Add proper error handling and loading states
5. Test full flow end-to-end
6. Deploy to mainnet

---
