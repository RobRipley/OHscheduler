
# Office Hours Scheduler – Product & Technical Specification

## 1. Overview

This application is a lightweight office-hours scheduling system built on the **Internet Computer (ICP)** with authentication via **Internet Identity** using `https://id.ai/`.

It provides:
- A **public, read-only monthly calendar** showing all upcoming office hours
- An **authenticated experience** for managing and covering sessions
- An **admin interface** for user management, scheduling, and reporting
- Email notifications with **iCalendar (.ics)** event invites for calendar integration

The system is designed to be simple, predictable, and maintainable, while behaving like a “normal calendar” users already understand.

---

## 2. Roles & Access Control

### Roles
- **Public (unauthenticated)**
- **Authorized User**
- **Admin**

### Authentication
- All authenticated users log in via **Internet Identity (`https://id.ai/`)**
- On first login, users are blocked at an **Authorization Required** screen that:
  - Displays their **principal**
  - Instructs them to copy and send it to an admin
- Access is granted only after an admin whitelists the principal

### Authorization Rules
- **Admins**
  - Whitelist / disable users
  - Add, edit, delete all events (including recurring)
  - Reassign hosts
  - Cancel sessions
  - Pause or resume session claiming
  - Configure system settings
- **Authorized Users**
  - Claim or unclaim sessions
  - Assign any whitelisted user as host
  - Add non-recurring events
  - Manage their own out-of-office settings
- **Public**
  - View calendar only (no edits)

---

## 3. Core Concepts & Data Model (Conceptual)

### Users
- Principal
- Display name
- Email address
- Role (admin / user)
- Status (active / disabled)
- Out-of-office blocks
- Notification preferences

### Events
Events represent **individual calendar sessions**.

Each event has:
- Title
- Start datetime (stored in UTC)
- End datetime (stored in UTC)
- Notes
- Host (optional)
- Origin (one-off or generated from a recurring rule)
- Status (active / canceled)

Default duration is **1 hour**, configurable per event.

### Recurring Event Rules
Recurring events are defined as **templates**, not as mutable instances.

A recurring rule includes:
- Frequency: weekly, biweekly, monthly
- Day of week
- For monthly: weekday ordinal (e.g. “second Tuesday”)
- Start date
- Optional end date

Instances are **materialized only within a forward-looking window** (default: next 2 calendar months).

### Instance Overrides
Individual instances may override the template:
- Host assignment
- Date/time changes
- Notes
- Cancellation (tombstone)

**Claiming coverage or editing an instance never mutates the recurring rule itself.**

---

## 4. Public Splash Page

### Calendar View
- Monthly calendar
- Read-only
- Shows:
  - Title
  - Date & time (in viewer’s local timezone)
  - Host name (or “TBD”)
  - Notes
- Includes both claimed and unclaimed sessions

No authentication required.

---

## 5. Authenticated User Experience

### Navigation
Authenticated users see tabs:
- **Calendar**
- **Coverage Queue**
- **Admin** (admins only)

### Calendar (Authenticated)
- Month view
- Shows all sessions (claimed + unclaimed)
- Unclaimed sessions are clearly marked
- Clicking a session opens a details panel:
  - Assign or change host
  - View notes
  - Admins can edit or cancel

### Coverage Queue
The queue lists **unclaimed sessions only**, within the forward-looking window.

#### Queue Window
- Default: **next 2 calendar months**
- Configurable by admin

#### Queue Table Columns
- Date & time
- Title
- Notes
- Host selector
- “Add” / “Claim” button

#### Host Selector
- Limited to whitelisted users
- Supports:
  - Typing to filter (prefix match)
  - Mouse selection
  - Keyboard navigation (arrow keys + enter)
- Users with active out-of-office blocks are excluded

Claiming a session:
- Assigns host **only to that instance**
- Does not affect other instances of the recurring event

---

## 6. Out-of-Office (OOO)

Each user can define OOO blocks:
- Date/time ranges where they are unavailable

Rules:
- Users cannot be assigned as host during OOO
- OOO does **not** retroactively unassign existing sessions
- Admins may override if necessary

---

## 7. Notifications & Email

### Email Delivery
- Emails are sent for relevant actions
- Calendar invites are sent as **iCalendar (.ics) attachments**
- Compatible with Google Calendar, Apple Calendar, Outlook, etc.

### Notification Preferences
All notifications are configurable via a **Settings** menu.

Includes:
- Session added / removed
- Reassigned
- Unclaimed sessions upcoming
- Optional reminders (24h, 1h, custom)
- Digest mode (daily / weekly)

---

## 8. Admin Panel

### User Management
- View all users:
  - Principal
  - Name
  - Email
  - Role
  - Status
- Actions:
  - Whitelist new principal
  - Disable / re-enable user
  - Promote / demote admin
  - Edit user info

### Reporting & Summary
- Forward-looking summary window (default: 2 months)
- Displays:
  - Total sessions
  - Claimed vs unclaimed
  - Hosting distribution (including zero counts)

---

## 9. Time & Timezones
- All times stored in **UTC**
- Displayed in the viewer’s local timezone

---

## 10. Non-Goals
- Google Calendar OAuth sync
- Real-time bidirectional sync
- Complex per-event permission hierarchies
