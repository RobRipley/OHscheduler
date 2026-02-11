# Office Hours Scheduler — UX Design Audit Report

**Prepared by:** Senior UX Design Contractor
**Date:** 2026-02-11
**Scope:** Full visual and interaction audit of all pages, components, and patterns
**Goal:** Identify every opportunity to transform this internal tool into something that looks and feels like it was built by a well-funded design team — deliberate, elegant, and quietly premium.
**Organization:** Yieldschool
**Logo:** `/src/frontend/static/yieldschool_inc_logo.jpeg` (dark navy background, blue book/chart icon with "YIELD SCHOOL" wordmark — complements the existing dark theme and indigo accent)

---

## Executive Summary

The application has solid bones. The dark theme palette is well-chosen, the 3-layer surface hierarchy is a smart architectural decision, and the overall layout structure is sound. But right now it reads as "competent engineer built this" rather than "a designer obsessed over every pixel." The gap isn't enormous — it's death by a thousand paper cuts: inconsistent spacing, missing micro-interactions, typography that doesn't breathe, components that feel functional but not *crafted*.

This report catalogs every issue I found, organized by severity and page, with specific recommendations. Nothing here requires a rewrite — it's refinement work that will compound into a dramatically different feel.

---

## 1. Global Issues (Affects Every Page)

### 1.1 Typography — The Single Biggest Lever

**Current state:** System font stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI'...`) set in `index.html`. No font-weight variation beyond what's inline. No tracking (letter-spacing) adjustments. No line-height system.

**Problem:** System fonts are fine for body text but they don't signal *intent*. Every premium internal tool I've shipped uses a deliberate font choice — it's the single fastest way to communicate "someone designed this."

**Recommendations:**
- **Add Inter** (or Geist, the Vercel font) as the primary typeface. It's the gold standard for tool UIs — clean, excellent at small sizes, has proper optical sizing. Load via Google Fonts or self-host.
- Establish a **type scale** — right now sizes are ad-hoc (11px, 12px, 13px, 14px, 15px, 18px, 20px, 24px, 32px all appear). Consolidate to: `11px / 13px / 15px / 18px / 24px / 32px` with defined roles.
- Add `letter-spacing: -0.01em` on headings (18px+) for tighter, more professional feel.
- Add `letter-spacing: 0.02em` on uppercase labels (already partially done — good instinct, just inconsistent).
- Define a `line-height` system: `1.1` for large headings, `1.4` for body, `1.6` for long-form text.

### 1.2 The Body Background Color Conflict

**Current state:** `index.html` sets `body { background: #f5f5f5; color: #333; }` — a light theme. Then every component overrides to dark backgrounds via inline styles.

**Problem:** On page load or during route transitions, users may flash light before dark components mount. This is a jarring flicker. It also means if any element doesn't explicitly set its background, it'll punch through as light gray.

**Fix:** Change `index.html` body styles to match the dark theme: `background: #0B0F14; color: #E5E7EB;`. This is a one-line fix with outsized impact.

### 1.3 No CSS Reset / Normalization Beyond Box-Sizing

**Current state:** Only `* { margin: 0; padding: 0; box-sizing: border-box; }`.

**Missing:**
- Form element resets (selects, inputs inherit wrong fonts/colors in some browsers)
- Button reset (some browsers add default outlines, padding)
- Scrollbar styling (the default bright scrollbar in tz dropdown and notification list screams "unfinished")
- Focus ring management (no visible focus indicators for keyboard navigation — accessibility gap)
- `color-scheme: dark` on `<html>` element (tells the browser to render native controls in dark mode — date pickers, select dropdowns, scrollbars)

### 1.4 Inline Styles — The Elephant in the Room

**Current state:** Every component uses `const styles: { [key: string]: React.CSSProperties }` objects for all styling.

**Impact on UX quality:**
- No hover states (CSSProperties can't express `:hover`)
- No focus states (can't express `:focus-visible`)
- No transitions on pseudo-states
- No `::placeholder` styling (date/time inputs look odd in dark theme)
- No `::selection` styling
- No scrollbar customization
- No media queries (zero responsive design)

This is the architectural constraint holding the design back. Every "feels cheap" moment traces back to the inability to express interactive states. The fix doesn't require abandoning the current approach entirely — adding a small global stylesheet for interactive states and using CSS custom properties from the theme would unlock 80% of what's needed.

### 1.5 No Loading States / Skeleton Screens

**Current state:** Loading is a centered text string ("Loading events...", "Loading users...") on a blank background.

**Recommendation:** Replace with skeleton loaders that mirror the shape of the content being loaded. For the calendar, show ghost day cells. For the queue, show ghost cards. This makes the app feel faster and more polished. Even simple pulsing rectangles in `theme.surfaceElevated` would be a major upgrade.

### 1.6 No Transition/Animation System

**Current state:** Two CSS keyframe animations defined in `index.html` (`slideIn`, `fadeSlideOut`) but they're not referenced anywhere in the React components. Inline `transition` properties are scattered inconsistently — some buttons have `transition: 'all 150ms ease-out'`, others have `transition: 'background 150ms ease-out'`, others have none.

**Recommendation:**
- Standardize on `150ms ease-out` for micro-interactions (buttons, hovers)
- Use `250ms ease-out` for layout changes (modals appearing, panels expanding)
- Use `300ms cubic-bezier(0.4, 0, 0.2, 1)` for modal overlays (material-style deceleration)
- Add entrance animations to modals (currently they just appear — a subtle scale+fade from 0.97/0 to 1.0/1.0 makes them feel intentional)

### 1.7 No Responsive Design

**Current state:** `maxWidth: 1200px` on the main container but zero breakpoints. On mobile or tablets, tables overflow, calendar cells crush, and the header stacks awkwardly.

**Priority:** Medium. If this is truly internal-only and desktop-first, this can wait. But the public calendar should at least be readable on mobile since external stakeholders might check it on their phones.

---

## 2. Page-by-Page Audit

### 2.1 Login Page (`Login.tsx`)

**What works:** Clean, centered card layout. Clear hierarchy. Good use of the accent color on the primary CTA.

**Issues:**

| Issue | Severity | Detail |
|-------|----------|--------|
| No brand presence | Medium | The page is just text and a button. There's no logo, icon, or visual element that says "you've arrived at something specific." Even a simple SVG calendar icon or the app name in a distinctive weight would help. |
| "Uses passkey authentication via Internet Identity" | Low | This hint text is technical jargon to non-crypto users. Consider: "Secure, passwordless sign-in" |
| No loading state on button click | Medium | After clicking "Sign in with Internet Identity," the button should show a spinner or "Connecting..." state. The II popup takes a moment to appear and the user has no feedback. |
| Card feels floaty | Low | No shadow or visual grounding. Adding `box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2)` would give it presence. |
| "View public calendar" link | Low | It's orphaned at the bottom with no visual separation from the hint text. Add some breathing room or a subtle divider. |

### 2.2 Public Calendar / Splash Page (`PublicCalendar.tsx`)

This is the front door of the entire application — the only page unauthenticated visitors see. Right now it feels like a dashboard page that lost its sidebar. There's no sense of arrival.

**What works:** The calendar grid itself is well-structured. The event cards with left-border color coding (indigo for assigned, red for needs-host) is a good, scannable pattern. Timezone selector is a nice touch.

**Issues:**

| Issue | Severity | Detail |
|-------|----------|--------|
| No brand presence whatsoever | **Critical** | "Office Hours" in 20px semibold with an italic "Public Calendar" subtitle reads like a debug label. There's no Yieldschool logo, no organization name, no visual mark. A first-time visitor has zero idea whose office hours these are or what they're for. The Yieldschool logo (`yieldschool_inc_logo.jpeg`) exists in the codebase and should be displayed prominently in the header. Its dark navy background and blue tones complement the existing dark theme perfectly. |
| No organization context | **High** | Visitors don't know what these office hours are *about*. There should be a configurable tagline/description (e.g., "Weekly community office hours for Yieldschool") driven by a new field in GlobalSettings that admins configure via the Admin Settings tab. |
| Events are completely inert | **High** | Public calendar events cannot be clicked. If a community member is trying to find out when the next DeFi discussion is, who's hosting, or how to join, they have to squint at 11px text inside a tiny cell. Clicking an event should open a read-only detail card showing full title, time, host, notes, and — critically — the meeting link. The meeting link is the primary reason a public visitor comes to this page. |
| No "next upcoming" highlight | **High** | The most common question is "when's the next one?" A banner or card above the calendar grid showing the next upcoming event ("Next session: Wednesday, Feb 12 at 2:00 PM EST — in 2 days") would answer the #1 question instantly without scanning the grid. |
| No "Add to Calendar" from public view | **Medium** | The ICS download exists in the authenticated modal but not on the public side. A public visitor who finds an event they want to attend should be able to export it to their calendar without signing in. |
| No "Today" button | **Medium** | The dashboard calendar has one, the public calendar doesn't. If someone navigates to March and wants to come back, they have to click "Previous" repeatedly. |
| No event count / summary | **Medium** | Something like "8 sessions this month · 3 need hosts" above the calendar gives immediate context and signals this is an active, living schedule. |
| Calendar cells at 140px min-height | **Medium** | The dashboard was bumped to 220px (per handoff notes) but the public calendar is still at 140px. Inconsistent and means events clip here but show there. Should match. |
| Header feels flat | **Medium** | This is the first thing external viewers see. It needs gravitas — the Yieldschool logo at left, a larger title (28-32px), or at minimum a clear visual hierarchy that says "this is an official tool." |
| Previous/Next buttons are plain | Low | Consider adding subtle chevron icons (← →) alongside the text. |
| Empty state is bland | Low | "No office hours scheduled for this month." should say something like "No sessions scheduled yet for [Month]. Check back soon!" — warmer, not a dead end. Even a simple icon would help. |
| No mobile responsiveness | **High** | This is the one page that *must* work on phones. A community member gets a link in a Telegram group, taps it on their phone, and the 7-column calendar grid crushes into illegibility. The public calendar should collapse to a list/agenda view on narrow screens. |
| No visual distinction between header and calendar | Low | They blend against the same dark background. A subtle card elevation or top-border accent on the calendar container would create visual grouping. |

### 2.3 Not Authorized Page (`NotAuthorized.tsx`)

**What works:** Clear step-by-step instructions. Principal copy button is well-designed. Good use of the surfaceElevated card for the instructions section.

**Issues:**

| Issue | Severity | Detail |
|-------|----------|--------|
| No icon/illustration | Low | This is an error state. A shield icon or lock icon would immediately communicate "access control" before the user reads a word. |
| Ordered list doesn't need to be a list | Low | The 4-step instructions read more naturally as a brief paragraph. The numbered list makes it feel like a bureaucratic form. |
| "Check Again" button label | Low | "Check Again" is vague. "Check My Access" or "Retry" is clearer. |
| Principal ID display | Medium | The monospace text in the principal box has no visual indicator that it's a copyable value. Adding a subtle copy icon (📋) inside the box, rather than a separate button, would be more intuitive. |

### 2.4 Dashboard Header & Navigation (`AuthenticatedLayout.tsx`)

**What works:** Sticky header is correct. Nav link pattern with bottom-border active state is a proven pattern. Timezone selector is well-built with search.

**Issues:**

| Issue | Severity | Detail |
|-------|----------|--------|
| Header height (60px) feels cramped | Medium | With the logo, nav links, notification bell, tz selector, username, and sign-out button all packed into 60px, nothing breathes. Bumping to 64-72px would help. |
| "Office Hours" logo is just text | Medium | There's no visual mark. Even adding a small dot, circle, or calendar glyph before the text would distinguish it from being just another heading. Something that could become a favicon. |
| Nav links use `borderBottom` on the link itself | High | The active indicator is a `border-bottom` on the NavLink element, but the header also has `borderBottom: 1px solid ${theme.border}`. This creates two competing bottom lines. The active indicator should be positioned to sit *on* the header's bottom border (using negative margin or absolute positioning) so it looks like a tab indicator integrated with the header, not a second border floating above it. |
| Username display | Low | Showing only the name (or truncated principal) without a user avatar or initials circle feels incomplete. A colored circle with the first letter of the user's name (like Gmail) would add personality and help the user confirm they're logged in as the right person. |
| Sign out button | Low | "Sign out" as a bordered button in the header takes too much visual weight. In premium tools this is typically tucked into a user menu dropdown (click on name/avatar → dropdown with "Settings", "Sign out"). |
| Notification bell + timezone + username + signout = too many items | Medium | The right side of the header is cluttered. Consider grouping: bell stays solo, then a user menu that contains tz selector + sign out. |
| Session expired banner | Low | The orange warning banner is functional but feels like a system error. Using a more refined "toast-bar" pattern with a dismiss option, or sliding it down with animation, would feel less alarming. |

### 2.5 Calendar View (`Calendar.tsx`)

**What works:** Month/week toggle is well-placed. Today button exists. The event card color-coding carries through from public calendar (good consistency). The event detail modal is well-structured.

**Issues:**

| Issue | Severity | Detail |
|-------|----------|--------|
| Navigation bar layout is messy | High | "Previous", "Today", the month/year text, and "Next" are all flex items with `gap: 12px` and `flexWrap: wrap`. The month/year is `flex: 1, textAlign: center` which means it's not actually centered — it's left-biased because "Previous" and "Today" are on the left. Classic flex centering issue. The date should be absolutely centered with prev/next as bookends. |
| "Previous" and "Next" as text buttons | Medium | These should use chevron icons (‹ ›) or arrow icons. Full words take too much space and feel old-fashioned. |
| "+ New Event" button placement | Medium | It's in the header row next to the view toggle, which creates a visually noisy cluster. Consider: move it to the right side of the navigation row, or make it a floating action button, or give it its own visual weight with a different style (filled + icon). |
| Week view: day columns are too narrow | Medium | At `minWidth: 140px` inside a 1200px container split 7 ways, each column is ~157px. This is tight for event cards that need to show time, title, and host. Consider making the week view full-width (breaking out of the 1200px container) or reducing to 5-day workweek view. |
| Week view: "—" for empty days | Low | The em dash as "no events" placeholder is cryptic. Either leave empty or use a subtle "No events" text in muted color. |
| Month view: dayCell min-height inconsistency | Low | Handoff says it was bumped from 160→220px but the code shows 140px. Either the handoff is describing a different deployment or the code was reverted. Should be at least 160px for month view. |
| Event detail modal: host assignment UX | High | When no host is assigned, the modal shows a `<select>` dropdown and an "Assign host" button. This is functional but crude. The `<select>` is a native browser element that looks terrible in dark mode (even with dark styling, the dropdown options render with OS-default light styling in many browsers). Replace with a custom dropdown/combobox component. |
| Event detail modal: "Remove myself" | Medium | This button only appears if *you* are the host. But there's no way for a non-host authorized user to remove/change the current host. Per the spec, authorized users should be able to "Assign any whitelisted user as host" — which implies reassignment. The modal should show "Change host" when someone is assigned, not just "Remove myself." |
| Create Event modal: date/time inputs | Medium | Native `<input type="date">` and `<input type="time">` render differently across browsers and look particularly bad in dark themes. The dark theme `color-scheme: dark` fix in the global CSS will help, but custom styled inputs would be the premium path. |
| No visual feedback on event click | Low | Events in the calendar grid have `cursor: pointer` but no hover state. A subtle background shift on hover would confirm interactivity. |

### 2.6 Coverage Queue (`CoverageQueue.tsx`)

**What works:** Card-based layout is appropriate. The "Covered" badge transition after assignment is a nice touch. Toast notifications are present.

**Issues:**

| Issue | Severity | Detail |
|-------|----------|--------|
| Card layout doesn't scale | High | The card is a horizontal flexbox with left info, middle notes, and right controls. On narrower screens (or with long notes), this breaks. The `whiteSpace: 'nowrap'` on notes with `textOverflow: 'ellipsis'` means users can't read full notes. Consider: move notes below the title/time row, or make the card taller with a clearer two-row layout. |
| "Needs Host" badge + select + assign button = visual mess | High | Three distinct UI elements packed into `cardRight` with `gap: 10px`. The badge is a colored pill, the select is a form element, and the button is a filled rectangle. They don't relate to each other visually. Consider: wrap the badge above the controls, or use the badge as a status indicator in the left column and keep controls on the right. |
| Native `<select>` for host picker | High | Same issue as in Calendar — native selects look bad in dark mode. Plus the select here is only 160px wide, which truncates longer names. The spec calls for a host selector with "typing to filter (prefix match), mouse selection, keyboard navigation (arrow keys + enter)" — the current `<select>` doesn't support type-to-filter. This is a spec gap. |
| No urgency signaling | Medium | All unclaimed events are treated the same visually. Events happening *tomorrow* should feel more urgent than events 6 weeks out. Consider: a time-based accent (red for <48h, orange for <1 week, default for later), or sort grouping by urgency. |
| "Refresh" button is too subtle | Low | Plain text button in the header could be missed. An icon (↻) would be more recognizable. Also consider auto-refresh on a 60-second interval so the queue stays current. |
| Toast notification position | Low | Fixed to `top: 20px, right: 20px` — this overlaps with the header in some viewport sizes. Should be positioned below the sticky header. |
| Empty state feels like an afterthought | Low | "All Covered" with "No sessions need hosts right now" is functional but not celebratory. This is a *good* state — the whole point of the queue is to get to zero. Consider: a checkmark icon, a subtle confetti-like graphic, or a warmer message like "You're all set — every session has a host." |

### 2.7 Admin Panel (`AdminPanel.tsx`)

The admin panel is the most feature-complete section of the app, but it has the *least* design attention. It feels like it was built to work, verified that it works, and then moved on. For an MVP that's fine — admin panels are always last. But it needs a pass.

**What works:** Tab-based sub-navigation is the right pattern. The users table, series cards, settings panel, and reports page all have distinct and appropriate layouts. The report stats grid and host distribution bar chart are solid starting points.

**Structural Issues:**

| Issue | Severity | Detail |
|-------|----------|--------|
| Double navigation confusion | **High** | The main header has "Calendar / Coverage Queue / Admin" tabs, then the admin page has *its own* tab row: "Users / Event Series / Settings / Reports." Two levels of horizontal tabs with subtly different styling is confusing — users lose track of where they are. The admin sub-tabs should be visually distinct: a segmented control, a sidebar, or vertical pills would all create clearer hierarchy. |
| Admin sub-tabs styling drift | Medium | Admin tabs use the same `NavLink` approach as the header nav but with different padding and a different active state. This creates visual confusion about navigation levels. |

**Users Tab Issues:**

| Issue | Severity | Detail |
|-------|----------|--------|
| Table won't scale | **Medium** | Works fine at 5-10 users but no pagination, no search, no sorting. At 30+ users the table becomes unwieldy. |
| "Add User" form is inline, other forms are modals | **Medium** | Add User appears above the table, pushing it down. Edit User and Link Principal use modals. This inconsistency is noticeable — Add should be a modal too. |
| Action buttons are text-only | Medium | "Edit", "Disable", "×" as text with borders. In a dense table, small icon buttons (pencil, toggle, trash) scan faster and take less horizontal space. |
| No alternating row colors | Medium | Every `<td>` has `background: theme.inputSurface`. Zebra striping (alternating `surface` / `inputSurface`) would improve scannability. |
| No bulk role management | Low | Promoting 5 users to admin is one at a time. |
| **Missing: Activity log per user** | Medium | Admins can't see which users are actively claiming sessions vs dormant. Reports tab has host distribution, but you can't see it from User Management where you'd actually act on that information. A "last active" timestamp or "sessions hosted: N" column would bridge this gap. |

**Event Series Tab Issues:**

| Issue | Severity | Detail |
|-------|----------|--------|
| Flat information hierarchy on cards | Medium | Title, frequency, day, time, start date, end date, notes are all the same visual weight. Title should be prominent, schedule details secondary on one line, notes tertiary. |
| **Missing: Instance preview** | **High** | When creating or editing a series, admins have no idea what instances it will produce. A "Preview next 5 occurrences" section below the form would give confidence the schedule is correct before saving. Currently admins have to create the series, navigate to Calendar, and scroll through to verify. |
| **Missing: Per-series pause/resume** | **Medium** | The global "Pause Assignments" toggle is all-or-nothing. But an admin might want to pause a specific series (holiday break for one recurring meeting, not others) without a full system freeze. Per-series active/paused status would be useful. |
| Edit form dead end for schedule changes | Medium | "Schedule cannot be changed. Delete and recreate if needed" is honest, but if a meeting moves from Wednesday to Thursday, the admin loses all instance overrides and host assignments. At minimum, warn about what will be lost. Ideally, support schedule changes that preserve future overrides. |

**Settings Tab Issues:**

| Issue | Severity | Detail |
|-------|----------|--------|
| Native checkbox for Pause Assignments | **High** | Looks terrible in dark mode. Replace with a toggle switch — the standard pattern for boolean settings and the most prominent interactive element on this page. |
| **Missing: Notification preferences** | **High** | The spec calls for configurable notifications: reminder timing (24h, 1h, custom), digest mode (daily/weekly), and per-event-type toggles. None of these are configurable anywhere in the UI. This is a spec gap, not just a design gap. |
| **Missing: Organization settings** | **Medium** | With the addition of Yieldschool branding to the public calendar, admins need to configure: org name, logo upload, tagline/description, and possibly a primary color override. This is the natural home for those settings. |
| **Missing: Danger zone / system info** | **Medium** | No way to reset data, export data, or see system health. For an ICP app, knowing canister cycle balance and storage usage is operational knowledge that admins need. A "System" section showing canister IDs, cycle balance, storage used, and last upgrade time would be valuable. |

**Reports Tab Issues:**

| Issue | Severity | Detail |
|-------|----------|--------|
| Stats are static snapshots | Medium | No trend lines, no comparison to previous periods, no sense of "are we getting better or worse?" Even a simple "↑12% vs last month" annotation would add context. |
| Host distribution bars are non-interactive | Low | No hover state, no tooltip, no click interaction. Clicking a host's bar could filter to show which specific events they're covering. |
| "Next 60 days" is hardcoded | Medium | If an admin changes forward_window_months to 3 in Settings, this subtitle is wrong. Should dynamically reflect the actual window. |
| **Missing: Historical view** | **High** | Reports only look forward. No way to see "how did we do last month?" or "what was our coverage rate in January?" Past performance data is the most useful thing for an admin trying to improve coverage. |
| **Missing: Export** | **Medium** | The spec explicitly mentions `export_events(format)` in the API surface, but there's no UI for it. Admins should be able to download a CSV of events for a given period — for stakeholder reports, for invoicing hosts, for auditing. |
| Reports grid not responsive | Low | The 4-column grid (`repeat(4, 1fr)`) crushes on smaller screens. Should collapse to 2x2. |
| All forms: no field validation feedback | Medium | Forms don't show validation states. Required fields have `required` but no visual indicator. Errors appear as a block above the form, not inline next to the problematic field. |

---

## 3. Component-Level Patterns

### 3.1 Modals

**Current state:** Three different modal implementations (EventDetailModal, CreateEventModal in Calendar.tsx, and LinkPrincipalModal/EditUserModal in AdminPanel.tsx). They share a similar overlay+card structure but with slightly different styling:
- Calendar modals: `background: rgba(18, 24, 38, 0.95)`, `borderRadius: '16px'`, `padding: '24px'`, `maxWidth: '420px'`, has backdrop blur
- Admin modals: `background: theme.surface`, `borderRadius: '16px'`, `padding: '28px'`, `maxWidth: '480px'`, no backdrop blur

**Recommendation:** Extract a single `<Modal>` component with consistent styling. All modals should have:
- Same overlay color and blur
- Same animation (scale+fade entrance)
- Same close button position
- Same padding and max-width
- Same border radius
- Trap focus for accessibility
- Close on Escape key

### 3.2 Buttons

**Current state:** At least 8 distinct button styles across the app — `createBtn`, `addBtn`, `submitBtn`, `primaryBtn`, `secondaryBtn`, `cancelBtn`, `actionBtn`, `navBtn`, `logoutButton`, `refreshBtn`, `assignBtn`, `linkBtn`, `iconBtn`, `iconBtnDanger`, `deleteBtn`, `todayBtn`, `reAuthButton`...

**Recommendation:** Consolidate to 4 button variants:
1. **Primary** (filled accent, white text) — main actions
2. **Secondary** (transparent, border, muted text) — alternative actions
3. **Ghost** (transparent, no border, muted text) — tertiary actions
4. **Danger** (transparent, red border/text) — destructive actions

Each variant should have `:hover`, `:active`, `:disabled`, and `:focus-visible` states.

### 3.3 Form Inputs

**Current state:** Input styling is relatively consistent (dark background, subtle border, 14px text). But native `<select>`, `<input type="date">`, and `<input type="time">` break the dark theme in many browsers.

**Recommendation:**
- Add `color-scheme: dark` to `<html>` to fix native control rendering
- Style `::placeholder` in the global stylesheet
- Add `:focus` ring (2px accent color glow or border highlight)
- Consider a custom select/combobox component for the host picker (most impactful upgrade)

### 3.4 Badges/Pills

**Current state:** Multiple badge styles — admin/user role badges, active/disabled status, pending, needs-host, covered. All use the same pattern: colored background (15% opacity) + colored text + 4px border-radius.

**This is well done.** The only note: the border-radius varies between `4px` (admin badge) and `6px` (needs-host badge). Pick one and standardize.

### 3.5 Cards/Surfaces

**Current state:** The 3-layer hierarchy (bg → surface → surfaceElevated/inputSurface) is sound. Border radius varies between `6px`, `8px`, `10px`, `12px`, and `16px` across different card types.

**Recommendation:** Standardize to two card radii: `12px` for major cards/panels and `8px` for inner elements (event cards, badges, inputs). The theme already defines `radiusSm: 8px`, `radiusMd: 12px`, `radiusLg: 16px` but they're not consistently used.

---

## 4. Color Audit

### 4.1 What's Working

The core palette is strong:
- `#0B0F14` (bg) → `#121826` (surface) → `#161F2E` (elevated) → `#1E2433` (input) creates genuine depth
- `#6366F1` (indigo accent) is distinctive without being garish — good choice over the typical blue
- The red/green/yellow status colors are used at appropriate opacity levels (15%) to avoid neon-sign syndrome

### 4.2 Issues

| Issue | Detail |
|-------|--------|
| Red overload | `#F87171` is used for: needs-host badge, error messages, cancelled events, delete buttons, disabled users, and the notification badge. That's a lot of red. Consider: use `#F87171` only for actionable states (needs-host, errors). Use `theme.textMuted` for cancelled events (they're resolved, not urgent). Use a distinct "danger" color for destructive actions. |
| No success green in the theme | `#34D399` (emerald) appears in CoverageQueue for the "Covered" badge and "Assigned to" text but isn't defined in `theme.ts`. It should be a named token. |
| No warning/amber in the theme | `#FB923C` (orange) appears in the session-expired banner and `#FBBF24` (amber) appears in admin badges but neither is in the theme file. All colors should flow from the theme. |
| White text on accent | `#fff` on `#6366F1` passes WCAG AA for large text but is borderline for small text (4.4:1 ratio). Not a critical issue but worth noting. |

---

## 5. Interaction Design Gaps

### 5.1 No Hover States Anywhere

Because all styling is inline React CSSProperties, there are literally zero hover states in the entire application. Buttons don't darken. Cards don't lift. Links don't change color. This is the single biggest contributor to the app feeling static and lifeless.

**Fix priority: Critical.** Add a small global CSS file that targets common interactive elements, or migrate to a CSS-in-JS solution that supports pseudo-selectors (styled-components, emotion, or even CSS modules).

### 5.2 No Keyboard Navigation

- Tab order is default (follows DOM order — mostly fine)
- No visible focus indicators (keyboard users can't see where they are)
- Modals don't trap focus (tab can escape the modal and interact with background)
- Dropdowns (timezone, notifications) don't support arrow key navigation
- No keyboard shortcut to close modals (Escape key)

### 5.3 No Empty State Design System

Empty states appear in: Calendar (no events), Coverage Queue (all covered), Event Series (no series), Reports (no data). Each is slightly different. They should share a pattern: icon + heading + description + optional CTA.

### 5.4 No Confirmation Pattern for Destructive Actions

User deletion and series deletion use `window.confirm()` — the native browser dialog that breaks the dark theme and feels jarring. Replace with an in-app confirmation modal.

---

## 6. Priority Recommendations (Implementation Order)

### Phase 1: Quick Wins (High Impact, Low Effort)
1. ☐ Fix `index.html` body background to `#0B0F14` / text to `#E5E7EB`
2. ☐ Add `color-scheme: dark` to `<html>` element
3. ☐ Add Inter font (Google Fonts link in `index.html`)
4. ☐ Create a small global CSS file for hover states, focus rings, scrollbar styling, placeholder colors, and selection colors
5. ☐ Standardize border-radius usage (12px cards, 8px inner elements)
6. ☐ Add all status colors to `theme.ts` (success, warning, danger)
7. ☐ Fix nav link active indicator to integrate with header border
8. ☐ Fix calendar navigation centering
9. ☐ Add Yieldschool logo to public calendar header and login page

### Phase 2: Component Refinement (High Impact, Medium Effort)
1. ☐ Extract and unify `<Modal>` component with animation
2. ☐ Build a custom `<Select>` / `<Combobox>` component for host picker
3. ☐ Consolidate button system to 4 variants with proper states
4. ☐ Add skeleton loading states for Calendar, Queue, and Admin sections
5. ☐ Replace `window.confirm()` with in-app confirmation dialog
6. ☐ Build a custom toggle switch for Settings
7. ☐ Add entrance animations to modals
8. ☐ Add user initials avatar to header
9. ☐ Make "Add User" form a modal (consistent with Edit/Link modals)

### Phase 3: Page-Level Polish (Medium Impact, Medium Effort)
1. ☐ Redesign public calendar header with Yieldschool logo, org name, and tagline
2. ☐ Add clickable event details on public calendar (read-only modal with meeting link + ICS download)
3. ☐ Add "Next upcoming session" banner above public calendar grid
4. ☐ Redesign Coverage Queue cards as two-row layout (info row + action row)
5. ☐ Add urgency/time grouping to queue ("This week" / "Next week" / "Later")
6. ☐ Add one-click "Claim" (self-assign) button to queue cards
7. ☐ Add "Covered" card auto-dismiss with fade-out animation
8. ☐ Improve empty states with icons/illustrations
9. ☐ Make admin sub-navigation visually distinct (segmented control)
10. ☐ Add hover states to all calendar event cards
11. ☐ Improve Login page with Yieldschool logo and loading state on button click
12. ☐ Surface meeting links on calendar event cards (icon link)
13. ☐ Fix calendar day cell min-height (140px → 220px as intended)
14. ☐ Add event count summary above public calendar ("8 sessions this month · 3 need hosts")
15. ☐ Refactor series cards with proper information hierarchy (title prominent, schedule secondary, notes tertiary)

### Phase 4: Feature Enhancements (High Impact, Higher Effort)
1. ☐ Add agenda/day view to calendar
2. ☐ Quick host assignment from calendar cards (hover reveal or inline)
3. ☐ Bulk assignment in Coverage Queue (checkboxes + "Assign selected to...")
4. ☐ Filtering/sorting in Coverage Queue (by series, day of week, time of day)
5. ☐ Per-series color coding on calendar event cards
6. ☐ Instance preview on series creation/edit ("Preview next 5 occurrences")
7. ☐ Per-series pause/resume toggle
8. ☐ Organization settings in Admin (org name, logo, tagline for public calendar)
9. ☐ Notification preference settings UI (reminders, digest mode — per spec)
10. ☐ Historical reports view (past months, trend comparison)
11. ☐ CSV export for events (spec mentions `export_events(format)` — needs UI)
12. ☐ System info in Admin (canister IDs, cycle balance, storage usage)
13. ☐ User activity indicators in Admin user table (last active, sessions hosted count)
14. ☐ Mobile responsive layout for public calendar (collapse to agenda view on narrow screens)

### Phase 5: Accessibility & Resilience (Important, Can Parallel)
1. ☐ Add visible focus indicators
2. ☐ Add focus trapping to modals
3. ☐ Add Escape key to close modals/dropdowns
4. ☐ Add `aria-label` attributes to icon-only buttons
5. ☐ Test and fix tab order
6. ☐ Add mobile breakpoints for all authenticated views

---

## 7. Design Vision Statement

The goal isn't to make this look like a consumer product. It's to make it feel *inevitable* — like every spacing decision, every color choice, and every interaction was the obvious right answer. The kind of tool where you open it and think "this just works" without being able to point to any single flashy thing.

The dark theme foundation is the right call. The indigo accent is distinctive. The surface hierarchy creates depth. What's missing is the *connective tissue*: the hover states that confirm interactivity, the animations that smooth transitions, the typography that creates rhythm, and the consistent component library that makes everything feel like it was designed together rather than assembled from parts.

None of this requires new libraries or a rewrite. It requires patience and attention — going through each component and asking "does this feel deliberate or default?"

---

## 8. Calendar — Deep Dive: Visual & Feature Gaps

### 8.1 Visual Problems

**Day cell height inconsistency:** The handoff document says cells were bumped from 160px to 220px, but the code still shows `minHeight: '140px'`. Something got lost between sessions. At 140px, any day with more than 2 events hits the "+N more" overflow, hiding information the user came to see.

**Event cards are too small to be useful:** Cards inside day cells use 11-12px text, which is *scannable* (you can see "something's there") but not *readable* (you can't learn what it is without clicking). Title, time, and host are crammed into a tiny rectangle. Users have to click every card to get basic information.

**Week view columns are too narrow:** 7 columns inside a 1200px container gives each column ~157px. Event cards that need to show time, title, and host get squeezed into newspaper-column widths.

**Navigation bar isn't centered:** "Previous", "Today", the month title, and "Next" are flex items, but because Previous + Today take more width than Next alone, the month title isn't actually visually centered. It drifts left. This is the kind of subtle asymmetry that makes people feel something is "off" without knowing why.

### 8.2 Missing Features

**Day view / Agenda view:** Month and week views exist, but when a day has 4+ events, users need a way to drill in. An agenda/list view (chronological list of upcoming events) would also serve users who think in timelines rather than grids. This is the third standard view in every calendar application for a reason.

**Quick host assignment from the calendar grid:** The current flow is: click event → modal opens → pick from dropdown → click "Assign". That's 3-4 interactions for the most common action. A "Claim" button or host-assign control directly on the event card (or revealed on hover) would dramatically speed up the core workflow.

**Meeting link surfacing:** The data model supports meeting links, but they're buried inside the event detail modal. If someone scans the calendar thinking "where do I join at 2pm?", they have to click through to find the URL. A small link icon on the card that opens the meeting URL directly would be a major quality-of-life win.

**Color-coding by event series:** Currently every assigned event is indigo and every unhosted event is red. If someone runs multiple recurring series ("DeFi Office Hours" Wednesdays, "General Q&A" Fridays), there's no way to distinguish them visually on the calendar. A per-series color or tag would help at scale.

**Drag-and-drop host assignment (aspirational):** In a tool where the core workflow is "match people to timeslots," dragging a user's name onto an unhosted event would be the kind of interaction that makes people say "how did they build this?" This is a stretch goal, but it's the kind of feature that separates "works fine" from "this is incredible."

---

## 9. Coverage Queue — Deep Dive: Layout & Feature Gaps

### 9.1 Layout Problems

**The horizontal card layout fights itself.** Each card crams event info (left), notes (middle), and controls (right) into a single row. The controls side stacks a status badge + select dropdown + assign button, while notes get squeezed into a single truncated line via `text-overflow: ellipsis`. Users can't read notes that might contain critical context like "this is the CEO's session."

**Recommended redesign — two-row card layout:**
- **Row 1:** Event identity (date, title, time) with status badge aligned right
- **Row 2:** Action zone (host picker + assign button)
- **Notes:** Expand below the title, given enough room to be readable

This gives everything room to breathe and creates clear visual hierarchy instead of a cramped single row.

### 9.2 Missing Features

**One-click self-assign ("I'll take it"):** The most common queue action is "I'll cover that one myself." Currently this requires: pick yourself from dropdown → click Assign. A dedicated "Claim" button that auto-assigns to the current user would cut the interaction in half. Keep the full dropdown for assigning *others*, but self-assignment should be instant — one click, done.

**Bulk assignment:** If there are 12 unclaimed events and an admin wants to assign 8 to the same person, they must select from a dropdown and click "Assign" twelve separate times. Checkboxes + "Assign selected to..." would make queue triage dramatically faster.

**Urgency / time-based grouping:** All unclaimed events are sorted chronologically but treated identically. An event happening *tomorrow* has the same visual weight as one 7 weeks away. Options:
- Group by "This week" / "Next week" / "Later" with section headers
- Add a color-coded left border based on proximity (red < 48h, orange < 1 week, default for later)
- Both

The session happening in 36 hours should *feel* urgent.

**Filtering and sorting:** By series title, by day of week, by time of day. If someone can only host morning sessions, they shouldn't have to scan past every afternoon slot.

**"Covered" card auto-dismiss:** After assigning someone, the card shows a "Covered" badge and stays in the list until manual refresh. This means the queue fills with resolved items. Covered cards should either:
- Auto-fade out after 2-3 seconds with an animation
- Collapse into a "Recently covered" section at the bottom
- Both (fade after delay, with an "undo" grace period)

### 9.3 The Core UX Question

What's the user's job when they open the queue? **Get events covered as fast as possible.** Every interaction pattern should be measured against that goal. The current design makes users do more work than necessary — the data is all there, but the interface doesn't optimize for speed.

---

## 10. Design Vision Statement

The goal isn't to make this look like a consumer product. It's to make it feel *inevitable* — like every spacing decision, every color choice, and every interaction was the obvious right answer. The kind of tool where you open it and think "this just works" without being able to point to any single flashy thing.

The dark theme foundation is the right call. The indigo accent is distinctive. The surface hierarchy creates depth. What's missing is the *connective tissue*: the hover states that confirm interactivity, the animations that smooth transitions, the typography that creates rhythm, and the consistent component library that makes everything feel like it was designed together rather than assembled from parts.

None of this requires new libraries or a rewrite. It requires patience and attention — going through each component and asking "does this feel deliberate or default?"

---

*End of audit. Ready to discuss priorities and begin implementation.*
