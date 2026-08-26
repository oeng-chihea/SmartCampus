---
name: smart-campus-student
description: >
  Student role: per-student login accounts, teacher account provisioning, login access
  control, and the attendance scan flow. Use when the user asks about student login,
  student accounts, how students get credentials, creating student accounts, Chihea,
  login_enabled, disabled student accounts, student scan flow, or runs /smart-campus-student.
---

# Smart Campus — Student Role & Login Accounts

Use this skill when explaining or building **student account + scan** flows.
For all roles and routing, also load **`smart-campus-workflow`**. For code
placement, use **`smart-campus-dev`**.

Detailed steps: `references/student-account-flow.md`.

## Core rule: every student has their own account

There are **no shared demo student accounts** anymore. A student can log in only
when a teacher has created a **personal login account** for them:

| Step | Who | What happens |
|------|-----|--------------|
| 1. Provision | Teacher (`/students`) | “Add student account” form → creates student profile **and** login account (email + temporary password) |
| 2. Login | Student | `/auth/student` with own email + password |
| 3. Scan | Student | `/student/scan` → tap open session or scan teacher QR → attendance recorded under **their** identity |
| 4. Control | Teacher | Toggle **Login access** on/off → disabled students get `403 Forbidden` at login |

Identity at scan time always comes from the **login token** (`users.student_id`),
never from the QR payload — a student can never record attendance as someone else.

## Initial seeded student

Only one student account is seeded (not demo data):

| Field | Value |
|-------|-------|
| Name | `Chihea` |
| Email | `chihea@smartcampus.edu` |
| Password | `chihea123` |
| studentId | `SC-1001` |
| Class / Year | `SE401` / `Year 1` |
| Home after login | `/student/scan` |

Teacher seeded account (campus administration):

| Role | Email | Password |
|------|-------|----------|
| Teacher | `teacher@smartcampus.edu` | `teacher123` |

## Student happy path (login → scan)

```text
Teacher creates account (POST /api/students with password)
  → student signs in at /auth/student (POST /api/auth/login)
  → /student/scan
  → GET /api/sessions/open (all open sessions + same live QR as teacher)
  → tap “Mark me present” or scan QR / Camera deep link
  → browser watches device GPS (watchDeviceLocation + getCurrentCoordinates)
  → Leaflet + OSM map shows student pin vs session geofence circle
    (pin stays on original GPS)
  → GPS denied / unsupported / timed out:
      NO request sent — "Cannot mark present / Try again" dialog opens
      Try again → re-prompts permission and retries the same submit
  → GPS fix obtained (live reading used immediately — no accuracy wait):
      POST /api/attendance/submit { payload, latitude, longitude, accuracyMeters }
      → if before session dueAt:
          inside location radius → Present
          outside location radius → Outside Location (still recorded)
  → history in shared **app-table** (“My attendance” / Your recorded scans)
  → Sign out → /auth/student
```

**Campus Voice (student):** on `/student/scan` the talking-person widget lives in the same page workspace as the live cards (staff-style floating person, extra bottom padding so cards stay clear). It auto-starts Gemini Live and greets with one short Good morning / afternoon / evening line (Phnom Penh time). It does **not** tutorial the buttons on that first turn. It knows the full campus loop and **which live classes this student already recorded vs has not recorded yet**. Say **mark all** / **mark them all** / **every class** to check in for every live class that is still open and not yet recorded (one tool call, including 10 sessions). GPS is still required. Stop with stop / end / close / exit, or tap X.

**Geofence (FR-02, live) — hard gate:** location permission is **mandatory**.
iPhone Safari only prompts for GPS on **HTTPS** (the teacher QR must open the
public site URL, e.g. `https://your-app.onrender.com`). Phones do not need the
same Wi‑Fi as the teacher laptop. A plain `http://` page cannot prompt for GPS.
The scan flow (`buildSubmitRequest` in `student-scan.flow.ts`) never calls the
submit API without a GPS fix — denied/unsupported/timeout opens a
`locationBlocked` confirm dialog (`StudentScanPageState`) with a "Try again"
retry instead of submitting. A live watch reading is submitted immediately
(no ±30 m wait). The backend independently rejects (400, via
`AttendanceService.requireCoordinates`) any submit with no coordinates, so a
direct API call can't bypass the rule either. Once coordinates ARE present,
`evaluateGeofence` (Haversine distance vs the location's `radiusMeters`)
decides `Present` vs `Outside Location`. The stored **Scanned at** name is a single Nominatim reverse of the scan
GPS (street + sangkat; building name only when OSM has one at that pin).
Submit does **not** reload sessions or wait on Overpass. See
`smart-campus-dev/references/architecture.md` for the file map.

## Session due time on `/student/scan`

Teacher sets **due time** at create (any clock time today; not “Late after”). Rules:

| State | Student UI | Mark present / QR scan |
|-------|------------|-------------------------|
| Open, **before** due | Card listed (QR · Location · Due) | Works → status **Present** |
| Open, **after** due | Card **stays listed** (“Due passed” pill) | Blocked → shared **`app-confirm-dialog`**: “Cannot mark present… due time has passed” |
| Teacher **Closed** | Leaves open API list → **removed** from live cards | History **kept** in My attendance table |
| Teacher **Deleted** session | Live card gone | Rows for that `sessionId` **removed** from My attendance |

- Do **not** auto-hide past-due cards; only teacher **Close** / **Delete** removes them from the open list.  
- Deep-link Camera scan after due also opens the same confirm dialog (`fromScan` message).  
- QR 300s token rotation is separate; student UI does not show “Expires (300s)”.  
- Helpers: `isSessionPastDue`, `formatSessionDue` in `core/utils/date.util.ts`.

## My attendance table (`app-table`)

History is **not** a custom list or last-result hero card. Use shared `app-table`:

| Column | Source / format |
|--------|-----------------|
| Session | Title + attendance record id (primary cell) |
| Location | `formatCampusLocationLabel` → `Building B-Room 105` |
| Recorded | `formatSessionOpened` → `8-9-26/8:00Pm` |
| Status | Badge (`present` / `late` / …) |

Data: `GET /api/attendance/me` via `StudentAttendanceService.listMine()`.
Absent rows written for staff `/attendance` after due/close are **not** listed here.

### Delete cascade + orphan cleanup (backend)

1. **On teacher delete session:** `SessionsService.remove` deletes `attendance_records` where `session_id = :id`, then removes the session.  
2. **On student history load:** `AttendanceService.findMine` keeps only rows whose session still exists and **deletes orphan rows** (sessions deleted before cascade existed, or any leftover).  
3. Student UI updates on reload / ~12s poll — no special student-side delete API.

| Teacher action | Live session cards | My attendance rows for that session |
|----------------|--------------------|-------------------------------------|
| Close | Removed | **Still shown** |
| Delete | Removed | **Gone** (cascade + me-list purge) |

## Login access control (login_enabled)

- Source of truth: `students.login_enabled` column (linked to the account via
  `students.user_id`).
- Enforced in `AuthService.login` (`backend/src/modules/auth/auth.service.ts`):
  student accounts whose profile has `loginEnabled = false` are rejected with
  **403** “This student account is disabled. Contact your administrator.”
- Teacher toggles it from the Students page; the toggle is **disabled** in the UI
  for students that have **no account yet** (label “No account”).

## API endpoints

| Method | Path | Roles | Purpose |
|--------|------|-------|---------|
| `POST` | `/api/auth/login` | public | Login (enforces `login_enabled`) |
| `POST` | `/api/users` | teacher | Create teacher or student account (student role requires an existing profile) |
| `GET` | `/api/students` | teacher | Student directory (incl. `hasAccount`) |
| `POST` | `/api/students` | teacher | Create student; `password` in body also creates the login account |
| `PATCH` | `/api/students/:studentId/access` | teacher | Toggle `loginEnabled` |
| `GET` | `/api/sessions/open` | student+ | Live open sessions + QR |
| `POST` | `/api/attendance/submit` | student | Mark attendance (identity from token); `latitude`/`longitude` are **required** — 400 if missing (FR-02 hard gate); drive the geofence check |
| `GET` | `/api/attendance/me` | student | Own scan history (only existing sessions; purges orphans; excludes Absent) |
| `POST` | `/api/ai/live-token` | student+teacher | Mint Gemini Live English voice token. Student instruction greets immediately with time of day and knows the scan/GPS flow. |
| `GET` / `POST` | `/api/ai/campus-records` | student+teacher | Teacher: campus-wide records. Student: **own** open classes + My attendance only. |

## Key files

```text
backend/src/modules/auth/auth.service.ts      # login + assertStudentLoginEnabled
backend/src/modules/students/students.service.ts  # directory + create + access toggle
backend/src/modules/students/students.controller.ts
backend/src/modules/users/users.service.ts    # createUser (account provisioning)
backend/src/modules/users/users.controller.ts
backend/src/modules/sessions/sessions.service.ts  # dueAt create + scan gate; delete cascades attendance
backend/src/modules/attendance/attendance.service.ts  # submit + geofence (evaluateGeofence); findMine filters + purges orphans
backend/src/modules/ai/campus-voice.instruction.ts  # student greeting + scan/GPS/stop flow
backend/src/modules/ai/campus-voice.snapshot.service.ts  # student-only open classes + my scans
backend/src/common/utils/date.util.ts          # campusGreetingPeriod (morning/afternoon/evening)

frontend/src/app/features/auth/pages/login/          # no demo chips anymore
frontend/src/app/services/auth.service.ts            # login, session, role paths
frontend/src/app/services/student.service.ts         # live /students API + error mapping
frontend/src/app/services/student-attendance.service.ts  # open sessions + submit + me
frontend/src/app/features/attendance/pages/student-scan/  # scan UI + workspace Campus Voice + recorded vs to-mark live cards
frontend/src/app/shared/components/voice-assistant/  # talking-person widget (student autoStart)
frontend/src/app/core/utils/geolocation.util.ts       # getCurrentCoordinates / watchDeviceLocation
frontend/src/app/core/utils/geofence.util.ts          # Turf.js inside-zone preview
frontend/src/app/shared/components/scan-map/          # Leaflet + OSM student pin + zone circle
frontend/src/app/shared/components/table/            # My attendance app-table
frontend/src/app/shared/components/confirm-dialog/   # due blocked confirm shell
frontend/src/app/core/utils/date.util.ts             # formatSessionDue, isSessionPastDue, formatSessionOpened
frontend/src/app/core/utils/format.util.ts           # formatCampusLocationLabel (Building B-Room 105)
frontend/src/app/core/utils/student-stats.util.ts    # pure metrics/filters helpers
frontend/src/app/features/students/pages/students/   # directory + add-account form + toggles
frontend/src/app/shared/components/student-form-card/  # “Add student account” form
frontend/src/app/shared/components/student-table/      # login toggle (disabled when no account)
```

## What changed from the old demo flow

- Removed: 4 seeded student demo accounts (`student@smartcampus.edu` etc.) and
  their profiles — the seeder also **deletes leftover rows** on boot.
- Removed: demo account chips on the login page (`DEMO_ACCOUNTS`).
- Added: real student directory + account creation + login toggle wired to the
  Nest API (teacher). Students page is **live**, not mock JSON.

## Related skills

| Skill | Use for |
|-------|---------|
| `smart-campus-workflow` | All roles page graph |
| `smart-campus-dev` | File placement, Nest/Angular conventions |
| `smart-campus-teacher` | Teacher Sessions/QR loop (the other half of the scan flow) |
