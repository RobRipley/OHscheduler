
# Office Hours Scheduler – Claude-Optimized Implementation Brief

## 1. Purpose of This Document

This document is an **implementation brief**, derived from the product specification, intended to guide an LLM (e.g. Claude) to generate a clean, correct backend and frontend architecture with minimal ambiguity.

This brief prioritizes:
- Explicit data models
- Hard constraints and invariants
- Clear API boundaries
- Predictable recurrence and override behavior
- A disciplined workflow with a persistent project handoff log

It intentionally avoids language-specific details unless explicitly stated.

---

## 2. Project Context & Paths (Local)

**Project root (codebase):**
- `/Users/robertripley/coding/OHscheduler`

**Primary documents:**
- Spec: `/Users/robertripley/coding/OHscheduler/spec.md`
- Implementation brief: `/Users/robertripley/coding/OHscheduler/implementation-brief.md`

**Handoff / project journal (must be created/maintained by Claude):**
- Path: `/Users/robertripley/coding/OHscheduler/docs/handoff.md`

**GitHub repo:**
- `https://github.com/RobRipley/OHscheduler`

**Local DFX identity (for local dev/testing):**
- Identity name: `RobRipley_YSL`
- Principal: `7ma2w-gqief-6zbuk-7hxgr-aehmx-imu3j-bwstx-2fvfw-jazen-6ljbd-hqe`

**Tooling available in Claude environment:**
- Chrome support for testing
- MCP / Desktop Commander enabled to read/write files and navigate locally

---

## 3. Required Workflow & Handoff Discipline (Do Not Skip)

Claude must maintain a persistent, continuously updated project journal in:

- `/Users/robertripley/coding/OHscheduler/docs/handoff.md`

### 3.1 What `handoff.md` Must Contain
At minimum:
- Directory structure & key file paths
- Architectural overview (frontend + backend + deployment)
- Data model summary and key invariants
- API inventory (methods, inputs/outputs, auth)
- Recurrence + override logic notes (including edge cases)
- Notification + iCalendar (.ics) design notes
- Testing notes and how to run tests locally
- Deployment steps (local + mainnet)
- Research performed (links, findings, conclusions)
- Trials/errors and what didn’t work (and why)
- Work completed, work in progress, and pending tasks
- Known issues / future improvements

### 3.2 When Claude Must Update `handoff.md`
Claude must update `handoff.md` at these times:

1. **Before starting any work**, after any research/reading/cross-checking:
   - If Claude spends time researching or exploring the repo, it must log findings *before* editing/creating code.

2. **After completing a meaningful unit of work**, such as:
   - Implementing a feature
   - Refactoring a module
   - Fixing a bug
   - Changing architecture decisions
   - Completing a test/deployment cycle

3. **After successful deployment and testing** (local and/or mainnet):
   - Document the exact commands run and outcomes.

The goal: a new Claude chat can begin with “read `handoff.md`” and immediately understand the project state.

---

## 4. Deployment & Git Discipline

### 4.1 Deployment Order
1. **Deploy locally first**, verify functionality.
2. Only then deploy to **ICP mainnet**.

### 4.2 Git Workflow
Upon successful local deployment/testing (and after any subsequent mainnet deploy, if performed):
- Update `docs/handoff.md`
- Commit changes to the GitHub repo with a descriptive message
- Ensure the handoff includes:
  - What changed
  - Why
  - How it was tested
  - What remains

---

## 5. Core Constraints (Do Not Violate)

1. Authentication is via **Internet Identity (`https://id.ai/`)** only.
2. All timestamps are stored in **UTC**.
3. Recurring events are **templates**, never mutated by instance actions.
4. Claiming coverage affects **one event instance only**.
5. Only admins may create or modify recurring events.
6. Event instances are materialized only within a **rolling forward window** (default: 2 calendar months).
7. Monthly recurrence is defined by **weekday ordinal**, not calendar date.
8. Users on out-of-office blocks cannot be assigned as host (unless admin override).
9. Public calendar is strictly read-only.

---

## 6. Data Model (Conceptual, Concrete)

### User
```
User {
  principal: Principal (unique)
  name: String
  email: String
  role: Admin | User
  status: Active | Disabled
  out_of_office: [OOOBlock]
  notification_settings: NotificationSettings
}
```

### OOOBlock
```
OOOBlock {
  start_utc: DateTime
  end_utc: DateTime
}
```

### EventSeries (Recurring Template)
```
EventSeries {
  series_id: UUID
  title: String
  notes: String
  frequency: Weekly | Biweekly | Monthly
  weekday: Mon..Sun
  weekday_ordinal?: First | Second | Third | Fourth | Last   // required for Monthly
  start_date: Date
  end_date?: Date
  default_duration_minutes: Int
}
```

### EventInstance
```
EventInstance {
  instance_id: UUID
  series_id?: UUID
  start_utc: DateTime
  end_utc: DateTime
  title: String
  notes: String
  host_principal?: Principal
  status: Active | Cancelled
}
```

### InstanceOverride (Logical; may be merged into EventInstance storage)
Recommended key: `(series_id, occurrence_start_utc)` where `occurrence_start_utc` is the *unmodified* generated start time for that occurrence.
```
InstanceOverride {
  series_id: UUID
  occurrence_start_utc: DateTime
  override_fields: {
    start_utc?
    end_utc?
    notes?
    host_principal?
    cancelled?
  }
}
```

### GlobalSettings
```
GlobalSettings {
  forward_window_months: Int (default 2)
  claims_paused: Bool
  default_event_duration_minutes: Int (default 60)
}
```

---

## 7. Event Materialization Algorithm

1. Determine window: `now` → end of `now + forward_window_months` (calendar months, not weeks).
2. For each EventSeries:
   - Generate occurrences matching recurrence rule
   - Generate start/end times using default duration
3. Apply overrides keyed by `(series_id, occurrence_start_utc)`
4. Exclude cancelled instances
5. Return normalized EventInstances sorted by `start_utc`

Materialization must be **deterministic** given the same underlying stored data.

---

## 8. API Surface (Logical)

### Auth / User
- `get_current_user`
- `request_access`
- `update_notification_settings`
- `set_out_of_office`

### Admin – Users
- `list_users`
- `authorize_user(principal, name, email, role)`
- `disable_user(principal)`
- `enable_user(principal)`

### Events
- `list_events(window_start, window_end, include_unclaimed)`
- `create_one_off_event`
- `update_event_instance`
- `cancel_event_instance`

### Recurring Events (Admin only)
- `create_event_series`
- `update_event_series`
- `delete_event_series`

### Coverage
- `list_unclaimed_events`
- `assign_host(instance_id, host_principal)`
- `unassign_host(instance_id)`

### Admin – System
- `update_global_settings`
- `export_events(format)`

Each API method must:
- Validate role
- Validate time bounds
- Enforce invariants
- Return clear errors (unauthorized, invalid input, conflict, not found)

---

## 9. Notification Matrix

| Action | Notify Host | Notify Admin | Send ICS |
|------|------------|--------------|----------|
| Host assigned | Yes | Optional | Yes |
| Host removed | Yes | Optional | Yes (CANCEL) |
| Event cancelled | Yes | Yes | Yes (CANCEL) |
| Event time changed | Yes | Optional | Yes (UPDATE) |
| Unclaimed sessions upcoming | Optional | Optional | No |
| Coverage needed soon (N days) | Optional | Optional | No |
| Digest (daily/weekly) | Optional | Optional | No |

Reminder emails:
- 24h / 1h / custom offset
- Disabled by default

---

## 10. iCalendar (.ics) Rules

- Each EventInstance has a stable `UID`
- Updates reuse UID with `SEQUENCE` increment
- Cancellations use `METHOD:CANCEL`
- Times encoded in UTC with timezone metadata
- Subject/body should be readable even if the recipient ignores the attachment

---

## 11. Edge Case Rules

- Disabled users remain visible in reports but cannot be assigned (unless admin override).
- OOO blocks prevent new assignments only; they do not automatically unassign existing sessions.
- Admin override bypasses OOO and disabled status.
- Series edits do not retroactively alter overridden instances.
- Assigning host outside forward window is rejected.
- If an event instance is canceled, it should never appear in queue; it may appear in admin audit/history if implemented.

---

## 12. Acceptance Scenarios

1. User claims a single instance of a weekly series → only that instance gains host.
2. Monthly series on second Tuesday generates correct future dates.
3. Host removed triggers cancellation email with ICS.
4. User on vacation does not appear in host selector; assignment is rejected unless admin override.
5. Public calendar displays unclaimed sessions as “TBD” and shows title/time/notes.
6. Claims paused blocks assigning/unassigning hosts for non-admins.

---

## 13. Non-Goals

- OAuth calendar sync
- Infinite recurrence expansion
- Per-event ACLs beyond role-based rules described here
- Real-time collaborative editing

---

End of implementation brief.
