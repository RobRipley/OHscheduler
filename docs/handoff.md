# Office Hours Scheduler – Project Handoff Document

**Last Updated:** 2026-02-11 (Session 8 - UX Phase 1 + Email Integration Spec)
**Status:** Mainnet Deployed / UX Phase 1 Complete / Email Integration Specified

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

### ✅ Calendar & Notifications (Session 6)
- Calendar day cells expanded from 160px to 220px minHeight for better event visibility
- Events now display title, time, AND host clearly
- Public calendar also updated with same height
- Assign Host modal now features user dropdown (select any user, not just self-assign)
- **NotificationBell component** implemented with:
  - Bell icon in header with unread count badge
  - Dropdown showing upcoming sessions (within 24 hours where user is host)
  - Coverage needed alerts for unclaimed events
  - Mark as read / Mark all read functionality
  - Auto-refresh every 5 minutes

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
| 2026-02-04 | 6 | ✅ | Calendar height expanded (160px→220px), NotificationBell component, Assign Host dropdown, TypeScript fixes |
| 2026-02-11 | 7 | ✅ | UX design audit report (docs/ux-audit-report.md) — comprehensive review of all pages, components, patterns |
| 2026-02-11 | 8 | ✅ | UX Phase 1 quick wins: Inter font, dark body bg, global.css (hover/focus/scrollbar/modal animations), theme expansion, nav fix, calendar nav centering, Yieldschool branding on all pages. Deployed to mainnet. |
| 2026-02-11 | 8 | 📋 | Email integration specification written (Section 13 below) |
| 2026-02-11 | 9 | ✅ | UX Phase 2 component library: Modal, ConfirmDialog, Button, Select, Toggle, Skeleton, Avatar. All modals/selects/confirms/toggles/loading states replaced across Calendar, CoverageQueue, AdminPanel. Deployed and tested on mainnet. Merged to main. |
| 2026-02-11 | 10 | ✅ | UX Phase 3 page-level polish (15/15 items): Public calendar event modal + next session banner + month stats; Coverage Queue two-row cards + time grouping + Claim button + covered fade-out; Calendar hover + meeting link icons + taller cells; Login loading state; Admin segmented control; Series card hierarchy refactor. Deployed and tested on mainnet. Merged to main. |
| 2026-02-11 | 11 | ✅ | UX Phase 4 feature enhancements (5/14 frontend items): Per-series color coding (8 hues) across all calendar views; Coverage Queue filter by series + sort toggle; Mobile responsive public calendar with agenda view; Admin System Info panel (canister IDs, network, users, CycleOps link); Series creation instance preview (next 5 occurrences). Deployed and tested on mainnet. Merged to main. |
| 2026-02-11 | 12 | ✅ | Phase 4 backend features: toggle_series_pause endpoint + Pause/Resume UI on series cards; export_events_csv endpoint + Export CSV button in Reports; User activity tracking (last_active, sessions_hosted_count) + Hosted column in admin user table; from_bytes migration fallbacks for backwards-compatible schema upgrades. Backend upgraded (not reinstalled) preserving all data. Deployed and tested on mainnet. Merged to main. |

---

## 10. File Structure

```
OHscheduler/
├── dfx.json
├── Cargo.toml
├── package.json
├── vite.config.ts              # publicDir: 'static' configured
├── tsconfig.json
├── docs/
│   ├── handoff.md
│   └── ux-audit-report.md      # Comprehensive UX audit with 5-phase roadmap
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
│   │       └── notifications.rs # Outbox + ICS generation
│   └── frontend/
│       ├── index.html          # Inter font, color-scheme: dark
│       ├── static/
│       │   └── yieldschool_inc_logo.jpeg
│       └── src/
│           ├── main.tsx
│           ├── global.css       # Hover states, focus rings, scrollbars, modal animations
│           ├── theme.ts         # Expanded: semantic status colors
│           ├── App.tsx
│           ├── hooks/
│           │   ├── useAuth.tsx
│           │   ├── useBackend.tsx
│           │   └── useTimezone.tsx
│           └── components/
│               ├── NotAuthorized.tsx
│               ├── Login.tsx          # Yieldschool branding
│               ├── PublicCalendar.tsx  # Yieldschool branding
│               ├── AuthenticatedLayout.tsx  # Yieldschool logo, fixed nav indicator
│               ├── Calendar.tsx       # Fixed nav centering
│               ├── CoverageQueue.tsx
│               ├── AdminPanel.tsx
│               └── NotificationBell.tsx
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
11. No HTTP outcalls in v1 (notification outbox only — email worker spec in Section 13)

---

## 12. Next Steps

1. **UX Phase 2** — Component refinement: unified Modal, custom Select/Combobox, button system consolidation, skeleton loaders, toggle switch, confirmation dialog (see `docs/ux-audit-report.md`)
2. **Invite Code System** — Replace manual principal-copy onboarding with one-time invite codes (see Section 13A)
3. **Email Integration** — Off-chain worker + SendGrid for notifications (see Section 13B)
4. **UX Phases 3–5** — Page polish, feature enhancements, accessibility (see audit report)
5. Test full claim/unclaim flow end-to-end
6. Add loading states and error boundaries

---

## 13. Email Integration & Invite Code Specification

### 13A. Invite Code System

**Problem:** Current onboarding requires users to (1) sign in with II, (2) copy their principal from the "Not Authorized" page, (3) send it to an admin via side-channel, (4) wait for admin to whitelist, (5) return and refresh. This is high-friction and error-prone.

**Solution:** Admin generates a one-time invite code when creating a user. The user enters the code on the "Not Authorized" page, which links their II principal to the pre-created user record automatically.

#### Flow

```
Admin                                  New User
  │                                       │
  ├── Admin Panel → "Add User"            │
  │   (enters name, email, role)          │
  │                                       │
  ├── Backend generates invite code       │
  │   (e.g., "YS-7K2M-X9P4")            │
  │                                       │
  ├── Admin copies code, sends via        │
  │   Slack/email/text                    │
  │                                ───────┤
  │                                       ├── User opens app URL
  │                                       ├── Signs in with II
  │                                       ├── Sees "Not Authorized" page
  │                                       │   (now with invite code input)
  │                                       ├── Enters code "YS-7K2M-X9P4"
  │                                       ├── Backend validates code,
  │                                       │   links II principal to user
  │                                       ├── Redirect to dashboard ✅
  │                                       │
```

#### Backend Changes

**New type:**
```rust
pub struct InviteCode {
    pub code: String,           // "YS-XXXX-XXXX" (10 chars, alphanumeric)
    pub user_principal_placeholder: Principal, // The placeholder principal from Add User
    pub created_at: u64,
    pub created_by: Principal,
    pub expires_at: u64,        // 7-day TTL
    pub redeemed: bool,
    pub redeemed_by: Option<Principal>,  // The actual II principal
    pub redeemed_at: Option<u64>,
}
```

**New storage:** `StableBTreeMap<String, InviteCode>` keyed by code string.

**New endpoints:**
```
// Admin: generate invite code for an existing user (one with placeholder principal)
generate_invite_code(user_placeholder_principal: Principal) -> Result<String, ApiError>
  - Requires admin
  - Validates user exists and has placeholder principal
  - Generates random code: "YS-" + 4 alphanumeric + "-" + 4 alphanumeric
  - Stores InviteCode record with 7-day expiry
  - Returns the code string

// Public (authenticated via II but not authorized): redeem invite code
redeem_invite_code(code: String) -> Result<User, ApiError>
  - Caller must be authenticated (has II principal) but need NOT be authorized
  - Validates code exists, not expired, not redeemed
  - Replaces the placeholder principal on the User record with caller's principal
  - Marks code as redeemed
  - Returns the updated User (caller is now authorized)
```

**Frontend changes:**
- `NotAuthorized.tsx`: Add invite code input field below the existing principal display
  - Text input + "Redeem" button
  - On success: redirect to dashboard
  - On error: show message ("Invalid code", "Code expired", "Code already used")
- `AdminPanel.tsx` → Users tab:
  - "Add User" flow remains the same (name, email, role)
  - After creating a user with placeholder principal, show a "Generate Invite Code" button next to users with `Pending II link` status
  - Display the generated code with a copy button
  - Show code status: active (with expiry), redeemed, expired

#### Code Generation

Use `ic_cdk::api::time()` + random bytes from `ic_cdk::api::call::raw_rand()` to generate codes. Format: `YS-XXXX-XXXX` where X is from the set `[A-Z0-9]` excluding ambiguous characters (0/O, 1/I/L). This gives ~34^8 = 1.8 trillion possible codes — more than sufficient.

Note: `raw_rand()` is an async inter-canister call to the management canister, so `generate_invite_code` must be an `#[update]` endpoint. This is appropriate since it modifies state anyway.

---

### 13B. Email Integration via Off-Chain Worker

**Architecture:** The backend canister already has a complete notification outbox system. Notification jobs are created with status `Pending` when relevant actions occur (host assignment, removal, cancellation, time change). The missing piece is an off-chain worker that polls this outbox and sends emails via SendGrid.

```
┌─────────────────────┐     poll        ┌──────────────────┐     send      ┌───────────┐
│  Backend Canister    │ ◄───────────── │  Email Worker     │ ────────────► │  SendGrid │
│                      │                │  (Node.js)        │               │  API      │
│  NotificationJob     │ mark_sent      │                   │               │           │
│  outbox (stable mem) │ ──────────────►│  Runs on cron     │               │           │
│                      │                │  (every 2 min)    │               │           │
└─────────────────────┘                 └──────────────────┘               └───────────┘
                                               │
                                               │ authenticate via
                                               │ II or agent identity
                                               ▼
                                        ┌──────────────────┐
                                        │  IC Agent (JS)    │
                                        │  with secp256k1   │
                                        │  key (admin)      │
                                        └──────────────────┘
```

#### Why Off-Chain Worker (Not Direct HTTP Outcall)

ICP HTTP outcalls go through subnet consensus — all 13 replicas make the same POST to SendGrid, resulting in 13 duplicate emails per notification. Workarounds exist (idempotency keys, transform functions) but add complexity and fragility. The off-chain worker pattern is simpler, proven, and already anticipated by the existing outbox architecture.

#### SendGrid Setup

1. **Create SendGrid account** — free tier: 100 emails/day (more than enough)
2. **Verify sender identity** — either Single Sender Verification (quick, uses one email address) or Domain Authentication (proper, requires DNS records for `yieldschool.com`)
   - Recommendation: Domain Authentication. Adds SPF/DKIM records so emails don't land in spam. You'll add 3 CNAME records to your DNS.
3. **Create API key** — Settings → API Keys → Create with "Mail Send" permission only (least privilege)
4. **Store the API key** — in the worker's environment variables (never in the canister or frontend)

#### Worker Implementation

**Runtime:** Node.js script. Can run as:
- **Cloudflare Worker** (free tier, cron trigger every 2 min) — recommended, zero infrastructure
- **Railway / Render** (free tier, background worker)
- **GitHub Actions** (scheduled workflow every 5 min) — simplest but min interval is 5 min
- **Local cron** (good for dev, not for production)

**Dependencies:**
```json
{
  "@dfinity/agent": "latest",
  "@dfinity/principal": "latest",
  "@dfinity/candid": "latest",
  "@sendgrid/mail": "^8.0.0"
}
```

**Core Logic (pseudocode):**
```javascript
import { HttpAgent, Actor } from '@dfinity/agent';
import { Ed25519KeyIdentity } from '@dfinity/identity';
import sgMail from '@sendgrid/mail';

// Configuration (from environment variables)
const BACKEND_CANISTER_ID = '6vnyh-fqaaa-aaaad-aebwa-cai';
const IC_HOST = 'https://icp-api.io';
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const WORKER_IDENTITY_KEY = process.env.WORKER_IDENTITY_KEY; // see auth section
const FROM_EMAIL = 'noreply@yieldschool.com';
const FROM_NAME = 'Yieldschool Office Hours';

sgMail.setApiKey(SENDGRID_API_KEY);

async function pollAndSend() {
  // 1. Create IC agent with worker identity
  const identity = Ed25519KeyIdentity.fromSecretKey(
    Buffer.from(WORKER_IDENTITY_KEY, 'hex')
  );
  const agent = new HttpAgent({ host: IC_HOST, identity });
  const backend = Actor.createActor(idlFactory, {
    agent,
    canisterId: BACKEND_CANISTER_ID,
  });

  // 2. Fetch pending notifications
  const result = await backend.list_pending_notifications();
  if ('Err' in result) {
    console.error('Failed to fetch notifications:', result.Err);
    return;
  }
  const jobs = result.Ok;
  console.log(`Found ${jobs.length} pending notifications`);

  // 3. Send each email
  for (const job of jobs) {
    try {
      const msg = {
        to: job.recipient_email,
        from: { email: FROM_EMAIL, name: FROM_NAME },
        subject: job.subject,
        text: job.body_text,
        html: formatHtmlEmail(job),  // styled HTML version
      };

      // Attach ICS if present
      if (job.ics_payload && job.ics_payload.length > 0) {
        msg.attachments = [{
          content: Buffer.from(job.ics_payload[0]).toString('base64'),
          filename: 'invite.ics',
          type: 'text/calendar; method=REQUEST',
          disposition: 'attachment',
        }];
      }

      await sgMail.send(msg);
      console.log(`Sent: ${job.subject} → ${job.recipient_email}`);

      // 4. Mark as sent in canister
      await backend.mark_notification_sent(Array.from(job.job_id));
      console.log(`Marked sent: ${toHex(job.job_id)}`);

    } catch (err) {
      console.error(`Failed to send ${toHex(job.job_id)}:`, err.message);
      // Don't mark as sent — will retry on next poll
    }
  }
}
```

#### Worker Authentication

The worker needs to call `list_pending_notifications()` and `mark_notification_sent()`, both of which require admin auth. Two approaches:

**Option A: Dedicated worker identity (recommended)**
1. Generate a new Ed25519 keypair for the worker (`dfx identity new email-worker`)
2. Get its principal (`dfx identity get-principal --identity email-worker`)
3. Authorize it as Admin in the backend canister
4. Export the private key and store it as an environment variable in the worker runtime
5. The worker creates an `Ed25519KeyIdentity` from this key to authenticate

**Option B: Use existing admin identity**
Export your `RobRipley_YSL` identity's key and use it in the worker. Simpler but less secure — if the worker is compromised, your admin identity is compromised.

Recommendation: Option A. Create a dedicated `email-worker` identity with admin privileges. If it's ever compromised, you can disable just that identity without affecting your own.

#### Email Templates

The worker should transform the plain `body_text` into styled HTML. A single template works for all notification types:

```html
<!-- Minimal, dark-theme-aware email template -->
<div style="max-width: 560px; margin: 0 auto; font-family: 'Inter', Arial, sans-serif;">
  <div style="padding: 32px 24px; background: #121826; border-radius: 12px; color: #E5E7EB;">
    <img src="https://6sm6t-iiaaa-aaaad-aebwq-cai.icp0.io/yieldschool_inc_logo.jpeg"
         width="40" height="40" style="border-radius: 8px;" />
    <h2 style="color: #F9FAFB; margin: 16px 0 8px;">{{subject}}</h2>
    <p style="color: #D1D5DB; line-height: 1.6;">{{body_text}}</p>
    <hr style="border: 1px solid #1E2433; margin: 24px 0;" />
    <p style="font-size: 12px; color: #6B7280;">
      Yieldschool Office Hours · <a href="https://6sm6t-iiaaa-aaaad-aebwq-cai.icp0.io/"
      style="color: #6366F1;">Open Calendar</a>
    </p>
  </div>
</div>
```

Note: Many email clients ignore dark backgrounds. The template should also work on light backgrounds. Test with both Gmail and Apple Mail.

#### Notification Types Already Supported

The backend already creates `NotificationJob` records for these events:

| Type | Trigger | Subject | ICS Attached |
|------|---------|---------|:---:|
| `HostAssigned` | Admin assigns host to session | "You've been assigned to an Office Hours session" | ✅ REQUEST |
| `HostRemoved` | Admin removes host from session | "You've been removed from an Office Hours session" | ✅ CANCEL |
| `InstanceCancelled` | Admin cancels a session instance | "Office Hours session cancelled: {title}" | ✅ CANCEL |
| `InstanceTimeChanged` | Admin changes session time | "Office Hours session time changed: {title}" | ✅ REQUEST |

**Not yet implemented in backend (future):**

| Type | Trigger | Notes |
|------|---------|-------|
| `UnclaimedReminder` | Cron/timer: session within 48h with no host | Requires canister timer |
| `CoverageNeededSoon` | Cron/timer: session within 24h, still unclaimed | Requires canister timer |
| `DailyDigest` | Cron/timer: daily summary of upcoming sessions | Requires canister timer |
| `WeeklyDigest` | Cron/timer: weekly summary | Requires canister timer |
| `InviteEmail` | Admin generates invite code | New — see Section 13A |

The timer-based notifications would require either ICP canister timers (`ic_cdk_timers`) or the off-chain worker itself checking for upcoming unclaimed sessions. The worker approach is simpler since it already has the polling loop.

#### Deployment Recommendation: Cloudflare Worker

Cloudflare Workers free tier includes cron triggers (scheduled events). This is the lowest-maintenance option:

```
Project structure:
  email-worker/
  ├── package.json
  ├── wrangler.toml          # Cloudflare config + cron schedule
  ├── src/
  │   ├── index.ts           # Main worker logic
  │   ├── sendgrid.ts        # SendGrid email sending
  │   ├── ic-agent.ts        # IC agent setup + canister calls
  │   ├── templates.ts       # HTML email templates
  │   └── backend.did.js     # Generated Candid interface
  └── .dev.vars              # Local env vars (not committed)
```

```toml
# wrangler.toml
name = "yieldschool-email-worker"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[triggers]
crons = ["*/2 * * * *"]  # Every 2 minutes

[vars]
BACKEND_CANISTER_ID = "6vnyh-fqaaa-aaaad-aebwa-cai"
IC_HOST = "https://icp-api.io"
FROM_EMAIL = "noreply@yieldschool.com"

# Secrets (set via `wrangler secret put`):
# SENDGRID_API_KEY
# WORKER_IDENTITY_KEY
```

#### Implementation Sequence

1. **SendGrid setup** (~15 min)
   - Create account, verify domain, generate API key

2. **Worker identity** (~5 min)
   - `dfx identity new email-worker`
   - Authorize as admin in backend canister
   - Export private key

3. **Worker scaffold** (~30 min)
   - Create `email-worker/` directory in project
   - Set up wrangler, install dependencies
   - Implement IC agent connection + canister calls

4. **Email sending logic** (~30 min)
   - SendGrid integration
   - HTML email template
   - ICS attachment handling
   - Error handling + retry logic

5. **Deploy + test** (~20 min)
   - `wrangler deploy`
   - Trigger a test notification (assign host in app)
   - Verify email delivery

6. **Invite code email** (Phase 2, after invite codes are built)
   - Add `InviteEmail` notification type to backend
   - Worker sends invite emails with redemption link

Total estimated implementation time: ~2 hours for the core worker, assuming SendGrid account is set up.

---
