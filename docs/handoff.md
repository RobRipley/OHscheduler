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
| 2026-02-11 | 13 | ✅ | Phase 4b completion (13/14 items done): Agenda view for authenticated calendar; Bulk assignment in Coverage Queue (checkboxes + select all + action bar); Quick host assign ("+ Assign host" CTA on no-host events); Org settings in Admin (name, tagline, logo URL → dynamic public calendar branding); Historical Coverage bar chart in Reports (6-month history via get_coverage_history endpoint); get_org_settings public query endpoint. Deployed and tested on mainnet. Merged to main. |

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


## 14. Critical Bug Report: React useCallback/useEffect Infinite Render Loop in useAuth

**Date discovered:** 2026-02-12
**Severity:** High — caused complete auth failure (sign-in button non-functional, /login stuck on "Loading...")
**Affected file:** `src/frontend/src/hooks/useAuth.tsx`
**Likely affects:** Any ICP frontend using a similar `AuthProvider` pattern with Internet Identity

---

### Symptoms

1. Sign-in button appeared to do nothing (no II popup, no navigation)
2. Navigating directly to `/login` showed infinite "Loading..." spinner
3. Browser console flooded with hundreds of repeated `User authorized: Object` messages
4. After signing out, the app appeared stuck — couldn't sign back in without manually clearing site data

### Root Cause: useCallback Dependency Chain Creating Infinite Re-render Loop

The `AuthProvider` component had three interconnected functions:

```tsx
// Function A: checks backend authorization, sets state
const checkAuthorization = useCallback(async (identity, client) => {
  // ... calls setUser(), setIsAuthorized(), setIsAdmin()
}, []);  // Empty deps — looks safe, but isn't the real problem

// Function B: wraps A, also sets state
const handleAuthenticated = useCallback(async (client) => {
  setIsAuthenticated(true);
  setPrincipal(principalId);
  await checkAuthorization(identity, client);  // calls A
}, [checkAuthorization]);  // ← depends on A

// Effect C: runs on mount and whenever B changes
useEffect(() => {
  AuthClient.create().then(async (client) => {
    if (await client.isAuthenticated()) {
      await handleAuthenticated(client);  // calls B
    }
    setIsLoading(false);
  });
}, [handleAuthenticated]);  // ← depends on B
```

**The loop:**

```
useEffect runs (because handleAuthenticated is in deps)
  → handleAuthenticated() called
    → checkAuthorization() called
      → setUser(), setIsAuthorized(), setIsAdmin() — STATE CHANGES
        → Component re-renders
          → checkAuthorization reference may change (closure over new state)
            → handleAuthenticated reference changes (depends on checkAuthorization)
              → useEffect sees changed dependency
                → useEffect runs again
                  → INFINITE LOOP
```

Even though `checkAuthorization` had `[]` deps, the combination of:
- Multiple state setters being called across the chain
- React batching behavior in async contexts (pre-React 18 batching doesn't apply inside async/await)
- `handleAuthenticated` depending on `checkAuthorization`
- `useEffect` depending on `handleAuthenticated`

...created a cascade where each render cycle produced a new function reference somewhere in the chain, re-triggering the effect.

### Why It Wasn't Obvious

- The app appeared to "work" in many cases because the public calendar route (`/`) doesn't require auth
- The loop was burning CPU and network calls but the calendar still rendered from the public endpoint
- The sign-in button navigated to `/login`, which showed "Loading..." because `isLoading` was being set to `false` and then the effect re-fired and the auth check ran again, creating a race condition
- The `logout()` function cleared React state but the II delegation persisted in IndexedDB, so on next page load the `isAuthenticated()` check returned true and the loop resumed

### The Fix

Collapsed the three-function chain into a single stable function + a one-shot effect:

```tsx
// Single function that does everything — no dependency chain
const checkAuthorizationAndSetState = useCallback(async (identity, client) => {
  try {
    const agent = new HttpAgent({ identity, host });
    const actor = Actor.createActor(idlFactory, { agent, canisterId });
    const result = await actor.get_current_user();

    if (result.Ok) {
      setUser(result.Ok);
      setIsAuthenticated(true);
      setPrincipal(identity.getPrincipal());
      setIsAuthorized(true);
      setIsAdmin('Admin' in result.Ok.role);
    } else {
      setIsAuthenticated(true);
      setPrincipal(identity.getPrincipal());
      setIsAuthorized(false);
    }
  } catch (error) {
    // handle session expiry, etc.
  } finally {
    setIsLoading(false);
  }
}, []);  // Truly empty deps — this function never changes

// Runs exactly once on mount
useEffect(() => {
  let cancelled = false;
  AuthClient.create().then(async (client) => {
    if (cancelled) return;
    setAuthClient(client);
    if (await client.isAuthenticated()) {
      await checkAuthorizationAndSetState(identity, client);
    } else {
      setIsLoading(false);
    }
  });
  return () => { cancelled = true; };
}, []);  // Empty deps — runs once

// Login uses the same stable function
const login = useCallback(async () => {
  await authClient.login({
    onSuccess: async () => {
      await checkAuthorizationAndSetState(authClient.getIdentity(), authClient);
    },
  });
}, [authClient, checkAuthorizationAndSetState]);
```

Key principles applied:
1. **One function, not a chain** — `checkAuthorizationAndSetState` does everything: creates agent, checks backend, sets all state, handles errors
2. **Empty dependency arrays** — The function closes over only `setState` functions (which are stable by React guarantee) and module-level constants
3. **One-shot useEffect** — The init effect has `[]` deps and runs exactly once
4. **Cleanup flag** — The `cancelled` flag prevents state updates if the component unmounts during the async init

### How to Check Other Projects for This Bug

**Pattern to look for:**

```
useEffect depends on functionA
  functionA = useCallback(..., [functionB])
    functionB = useCallback(..., []) but calls setState
```

If you have a chain where:
- A `useEffect` lists a `useCallback` in its dependency array
- That `useCallback` depends on another `useCallback`
- Any function in the chain calls `setState`

...you likely have this bug, or will trigger it under certain conditions.

**Safe pattern (what to refactor to):**

```
useEffect with [] deps — runs once
  calls a single useCallback with [] deps
    that useCallback does all state setting in one place
```

**Specific files to audit in other projects:**
- Any `useAuth` / `AuthProvider` hook
- Any hook that initializes a connection and then checks auth status
- Any hook with multiple `useCallback` functions that depend on each other

### Additional Bug Fixed in Same Session

The `useAuth` IDL definition for `get_current_user` was missing two fields from the `User` type:
- `last_active: IDL.Nat64`
- `sessions_hosted_count: IDL.Nat32`

The backend returned these fields but the frontend IDL didn't declare them. Candid can sometimes tolerate extra fields, but mismatches between the IDL and the actual response can cause silent deserialization failures depending on field ordering and types. Always ensure frontend IDL definitions exactly match the backend Candid interface.

---


## Section 15: OPEN BUG — "Record is missing key 'paused'" on Series Edit

**Status:** UNRESOLVED  
**Date:** 2026-02-12  
**Severity:** Blocks editing of event series in Admin Panel  
**Affects:** Admin Panel → Event Series → Edit (pencil icon) on any series

### Symptom

When clicking the edit icon on any event series in the Admin Panel, the Edit Series form renders but immediately displays the error: `Record is missing key "paused".` The Save Changes button submits but the response decode fails with the same error.

### What Works vs. What Doesn't

| Feature | Status | Notes |
|---------|--------|-------|
| `list_event_series` (series list) | ✅ Works | All series render with correct paused state, colors, titles |
| `toggle_series_pause` | ✅ Works | Pause/resume successfully toggles and re-renders |
| `create_event_series` | ✅ Works | New series created with paused=false |
| `update_event_series` (edit save) | ❌ Fails | Response decode: "Record is missing key 'paused'" |
| Backend via dfx CLI | ✅ Works | `dfx canister call backend update_event_series` returns paused field correctly |

### Evidence Gathered

**1. Backend returns paused correctly**
```
dfx canister call backend update_event_series '(...)' --network ic
→ Ok = record { ...; paused = true; ...; }
```
All 8 series have `paused` and `link` fields in dfx query output.

**2. Frontend IDL is correct**
The built JS bundle (`index-BY4W5O_5.js`) contains the EventSeries IDL with `paused: e.Bool`. Verified by:
- `grep -c "paused" dist/assets/index-BY4W5O_5.js` → 1 (present in IDL)
- In-browser `fetch('/assets/index-BY4W5O_5.js')` confirmed 2 matches for `default_duration_minutes...paused` pattern
- The browser is serving the correct bundle (same hash as built file)

**3. Same IDL type used for all endpoints**
```typescript
const Result_EventSeries = IDL.Variant({ 'Ok': EventSeries, 'Err': ApiError });
// Used by: create_event_series, update_event_series, toggle_series_pause
const Result_Vec_EventSeries = IDL.Variant({ 'Ok': IDL.Vec(EventSeries), 'Err': ApiError });
// Used by: list_event_series
```
Both reference the same `EventSeries` IDL.Record which includes `'paused': IDL.Bool`.

**4. toggle_series_pause returns Result_EventSeries and works**
This is the most confusing evidence. `toggle_series_pause` and `update_event_series` both return `Result_EventSeries`, yet toggle works and update doesn't. The only difference is the input type.

**5. No console errors logged**
The error is caught by the `catch` block in the edit form and displayed via `setError(err.message)`. No stack trace in console because it's caught and displayed as UI text.

**6. .did file was out of sync (partially fixed)**
The `.did` file was missing `paused` in `EventSeries` and `UpdateSeriesInput`. Both were added. However, the `.did` file is used by the dfx CLI for decoding, not directly by the frontend agent-js. The frontend uses its own IDL factory.

### Hypotheses Explored

**Hypothesis 1: Browser caching old JS bundle**
- Evidence for: Error persists across refreshes
- Evidence against: Incognito window shows same error. `fetch()` of JS bundle confirms correct IDL with paused field. Bundle hash matches local build.
- Verdict: **Eliminated** — browser is serving correct code

**Hypothesis 2: .did file mismatch**
- Evidence for: .did was missing `paused` in EventSeries and UpdateSeriesInput
- Evidence against: The .did file is used by dfx CLI, not by agent-js in the browser. The frontend IDL factory is embedded in the JS bundle. After fixing .did AND verifying frontend IDL, error persists.
- Verdict: **Partially relevant** — dfx CLI needed it, but not the root cause for frontend

**Hypothesis 3: Candid wire format field ordering**
- Evidence for: Candid records are encoded by field hash, not by declaration order. If there's a mismatch in how the Rust encoder and JS decoder hash field names, a field could be "missing"
- Evidence against: `list_event_series` decodes the same struct fine. `toggle_series_pause` returns the same type and works.
- Verdict: **Unlikely** — same type works for other endpoints

**Hypothesis 4: `from_bytes` migration fallback issue**
- Evidence for: Old series stored without `paused` needed migration in `from_bytes`
- Evidence against: The migration runs on `list_event_series` queries too, and those work. Also, `toggle_series_pause` writes the series back with `paused` set, and reading it back works.
- Verdict: **Eliminated** — migration works for reads

**Hypothesis 5: Update call response is handled differently by agent-js**
- This is the most promising unexplored hypothesis
- Update calls go through consensus and the response is wrapped in a certificate
- Query calls return raw Candid bytes
- The agent-js library may decode update call responses differently
- But `toggle_series_pause` is also an update call and works...
- The only remaining difference: `update_event_series` takes `UpdateSeriesInput` as a parameter, while `toggle_series_pause` takes just `Vec<u8>`

### What To Try Next

1. **Capture the full error stack trace**: Add `console.error(err)` before `setError(err.message)` in the EditSeriesForm's catch block. The stack trace will show exactly which Candid field is being decoded when it fails, and whether it's the request encoding or response decoding.

2. **Check if the error is in REQUEST encoding, not response decoding**: The error "Record is missing key 'paused'" might be thrown during *encoding* of the `UpdateSeriesInput`, not during decoding of the response. The frontend's `updateInput` object does NOT include `paused`:
   ```typescript
   const updateInput = {
     title: [title.trim()],
     notes: [notes.trim()],
     end_date: ...,
     default_duration_minutes: [...],
     color: ...,
     // ← NO paused field!
   };
   ```
   While the IDL defines `UpdateSeriesInput` as having `'paused': IDL.Opt(IDL.Bool)`, the actual JS object doesn't include `paused` at all. Agent-js may be strict about this and require all fields to be present (even optional ones must be sent as `[]`).

   **This is the most likely root cause.** The fix would be to add `paused: []` to the updateInput object (empty array = Candid `None` for optional fields).

3. **Test hypothesis #2 quickly**: In browser console, manually call `actor.update_event_series(seriesId, { title: ["test"], notes: [""], end_date: [[]], default_duration_minutes: [60], color: [[]], paused: [] })` and see if it succeeds.

4. **Check if list_event_series also has an encoding issue**: `list_event_series` takes no arguments, so there's no input to encode. This aligns with why it works — the error is in input encoding, not output decoding.

5. **Verify toggle_series_pause**: This endpoint only takes `Vec<u8>` (series_id), which is simple to encode. No record with optional fields to mess up.

### Key Insight

The error message "Record is missing key 'paused'" is ambiguous — it could mean:
- The **response** record is missing the key (Candid decode failure)
- The **request** record is missing the key (Candid encode failure)

Given that:
- The backend returns `paused` correctly (verified via dfx)
- The `UpdateSeriesInput` IDL has `paused: IDL.Opt(IDL.Bool)` but the JS object omits it
- Agent-js may require all Record fields to be present, even optional ones (as `[]` for None)

**The fix is almost certainly: add `paused: []` to the updateInput object in EditSeriesForm.**

### Additional Note: Identity Polling Loop

The console logs also reveal the 1-second identity polling in `useBackend` is creating actors in a tight loop (15+ actor recreations at the same timestamp). The `currentPrincipal` state comparison against `cachedIdentityPrincipal` has a race condition where the state update hasn't propagated before the next interval fires. This is a separate issue but should be addressed — either debounce the polling or use a ref instead of state for the comparison.

---
