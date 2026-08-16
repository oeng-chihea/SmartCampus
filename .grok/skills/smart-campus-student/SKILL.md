---
name: smart-campus-student
description: >
  Student role: per-student login accounts, admin account provisioning, login access
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
when an admin has created a **personal login account** for them:

| Step | Who | What happens |
|------|-----|--------------|
| 1. Provision | Admin (`/students`) | “Add student account” form → creates student profile **and** login account (email + temporary password) |
| 2. Login | Student | `/auth/student` with own email + password |
| 3. Scan | Student | `/student/scan` → tap open session or scan teacher QR → attendance recorded under **their** identity |
| 4. Control | Admin | Toggle **Login access** on/off → disabled students get `403 Forbidden` at login |

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

Admin / teacher seeded accounts stay unchanged:

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@smartcampus.edu` | `admin123` |
| Teacher | `teacher@smartcampus.edu` | `teacher123` |

## Student happy path (login → scan)

```text
Admin creates account (POST /api/students with password)
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

**Geofence (FR-02, live) — hard gate:** location permission is **mandatory**.
iPhone Safari only prompts for GPS on **HTTPS** (the teacher QR must be
`https://<lan-ip>:4200`). Location Services / Safari “Always” cannot unlock
GPS on a plain `http://` LAN page.
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
- Admin toggles it from the Students page; the toggle is **disabled** in the UI
  for students that have **no account yet** (label “No account”).

## API endpoints

| Method | Path | Roles | Purpose |
|--------|------|-------|---------|
| `POST` | `/api/auth/login` | public | Login (enforces `login_enabled`) |
| `POST` | `/api/users` | admin | Create any account (student role requires an existing profile) |
| `GET` | `/api/students` | admin, teacher | Student directory (incl. `hasAccount`) |
| `POST` | `/api/students` | admin | Create student; `password` in body also creates the login account |
| `PATCH` | `/api/students/:studentId/access` | admin | Toggle `loginEnabled` |
| `GET` | `/api/sessions/open` | student+ | Live open sessions + QR |
| `POST` | `/api/attendance/submit` | student | Mark attendance (identity from token); `latitude`/`longitude` are **required** — 400 if missing (FR-02 hard gate); drive the geofence check |
| `GET` | `/api/attendance/me` | student | Own scan history (only existing sessions; purges orphans) |

## Key files

```text
backend/src/modules/auth/auth.service.ts      # login + assertStudentLoginEnabled
backend/src/modules/students/students.service.ts  # directory + create + access toggle
backend/src/modules/students/students.controller.ts
backend/src/modules/users/users.service.ts    # createUser (account provisioning)
backend/src/modules/users/users.controller.ts
backend/src/modules/sessions/sessions.service.ts  # dueAt create + scan gate; delete cascades attendance
backend/src/modules/attendance/attendance.service.ts  # submit + geofence (evaluateGeofence); findMine filters + purges orphans
backend/src/common/utils/geo.util.ts          # haversineDistanceMeters / isWithinRadius (unit-tested)
backend/src/database/seeders/demo.seeder.ts   # seeds admin/teacher/Chihea; deletes legacy demo students

frontend/src/app/features/auth/pages/login/          # no demo chips anymore
frontend/src/app/services/auth.service.ts            # login, session, role paths
frontend/src/app/services/student.service.ts         # live /students API + error mapping
frontend/src/app/services/student-attendance.service.ts  # open sessions + submit + me
frontend/src/app/features/attendance/pages/student-scan/  # scan UI + due dialog + history table + geofence submit
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
  Nest API (admin only). Students page is **live**, not mock JSON.

## Related skills

| Skill | Use for |
|-------|---------|
| `smart-campus-workflow` | All roles page graph |
| `smart-campus-dev` | File placement, Nest/Angular conventions |
| `smart-campus-teacher` | Teacher Sessions/QR loop (the other half of the scan flow) |
