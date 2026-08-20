# Smart Campus — Full Page Flow Reference

Last reviewed against the Angular routes, Sessions live API, and role skills.

## Route table

| URL | Layout | Component | Guards | Status |
|-----|--------|-----------|--------|--------|
| `/` | — | redirect → `dashboard` | — | Active |
| `/auth` | AuthLayout | children | `guestGuard` | Active |
| `/auth/login` | AuthLayout | `LoginComponent` | (via parent) | Active — **live API login** |
| `/auth` (empty) | — | redirect → `login` | — | Active |
| `/dashboard` | AdminLayout | `DashboardComponent` | auth + admin\|teacher | Active (mock data) |
| `/students` | AdminLayout | `StudentsComponent` | auth + **admin only** | **Live API** directory + create account + login toggle |
| `/attendance` | AdminLayout | `AdminRecordsComponent` | auth + admin\|teacher | **Live API** Present + Absent (teachers: own sessions) |
| `/locations` | AdminLayout | `LocationsComponent` | auth + admin\|teacher | **Live API** student visit log + API filters (assigned zone + scan GPS) |
| `/sessions` | AdminLayout | `SessionsComponent` | auth + admin\|teacher | **Live API** create / QR / **edit** / close / **delete** |
| `/reports` | AdminLayout | `AdminPlaceholderPageComponent` | auth + admin\|teacher | Placeholder |
| `/student/scan` | none (standalone page) | `StudentScanComponent` | auth + **student** | **Live** open session QR + Mark present |
| Unknown under admin | AdminLayout | redirect → dashboard | — | Active |

Defined primarily in:

- `frontend/src/app/app.routes.ts`
- `frontend/src/app/routes/*.routes.ts`
- `frontend/src/app/core/constants/app-routes.ts`
- `frontend/src/app/core/constants/admin-navigation.ts`

## Role matrix

| Capability | Admin | Teacher | Student |
|------------|:-----:|:-------:|:-------:|
| Login (API) | ✓ | ✓ | ✓ |
| `/dashboard` | ✓ | ✓ | ✗ → scan |
| `/students` | ✓ | ✗ → home | ✗ → scan |
| `/attendance` | ✓ | ✓ | ✗ → scan |
| `/locations` | ✓ | ✓ | ✗ → scan |
| `/sessions` create + QR + edit + close + delete | ✓ | ✓ (own sessions) | ✗ |
| `/reports` placeholder | ✓ | ✓ | ✗ |
| `/student/scan` | ✗ → dashboard | ✗ → dashboard | ✓ |
| See Students in sidebar | ✓ | ✗ (filtered) | n/a |
| See all teachers’ sessions | ✓ | ✗ own only | n/a |

Teacher-focused detail: `.grok/skills/smart-campus-teacher/`.

## Sequence diagrams (text)

### A. Admin login → dashboard → attendance → logout

```text
Browser                Guards              AuthService           Pages
   |                     |                      |                   |
   | GET /dashboard      |                      |                   |
   |-------------------->| authGuard fail       |                   |
   | createUrlTree /auth/login                  |                   |
   |-------------------->| guestGuard ok        |                   |
   |                     |                      |  LoginComponent   |
   | submit admin creds  |                      |                   |
   |------------------------------------------->| login() → API     |
   |                     |                      | persist session   |
   | navigate /dashboard |                      |                   |
   |-------------------->| auth + role ok       |                   |
   |                     |                      |  AdminLayout +    |
   |                     |                      |  Dashboard        |
   | click Attendance    |                      |                   |
   | routerLink /attendance                     |                   |
   |-------------------->| ok                   |  AdminRecords     |
   | POST /api/attendance/admin                 |  Present + Absent |
   | Sign out            |                      | logout()          |
   | navigate /auth/login                       | clear storage     |
```

### B. Teacher tries Students

```text
Teacher session → sidebar does NOT show Students
If teacher navigates to /students manually:
  roleGuard(['admin']) fails → homePathForRole('teacher') → /dashboard
```

### C. Teacher sessions + QR (live)

```text
Login teacher → /dashboard → sidebar Sessions → /sessions
  → Create session (dialog: title, location, any due time today)
       → POST /api/sessions { title, locationId, dueAt }
  → Session log: Location · Opened · Due · Status
  → Live QR left panel → GET /api/sessions/:id/qr (refresh ~30s) + Due time
       QR image encodes https://<lan-ip>:4200/student/scan?payload=…
       (GET /api/runtime/scan-origin; phones need HTTPS for GPS)
  → ⋮ Actions on Open row:
       Show QR       → load QR panel
       Edit session  → POST /api/sessions/:id/edit
                       { title, locationId, dueAt } (not POST /api/sessions)
       Close         → POST /api/sessions/:id/close
                       (row stays Closed; student open card gone; history kept)
       Delete        → DELETE /api/sessions/:id
                       (session removed + attendance_records for session_id cascaded)
  → Closed rows: Edit session + Delete
  → After dueAt: students cannot mark present (session may stay Open until Close)
```

### D. Student login → live QR + mark present

```text
Login success (role=student)
  → homePathForRole → /student/scan
  → GET /api/sessions/open (all Open sessions + same live QR as teacher)
  → Session card: QR · Location · Due  (past-due cards STAY listed)
  → Before dueAt:
       Tap “Mark me present” / Camera QR deep link
       → POST /api/attendance/submit → Present
       → row appears in My attendance app-table
  → Before submit: browser reads GPS (getCurrentCoordinates())
       → GPS denied / unsupported / timed out (returns null):
            NO request sent — "Cannot mark present" / "Try again" dialog opens
            Try again → re-prompts permission, retries the same submit
            Cancel    → dialog closes, nothing submitted, card stays as-is
       → GPS fix obtained:
            POST /api/attendance/submit { payload, latitude, longitude }
            → server re-checks coordinates are present (400 if somehow missing —
              defense in depth for direct API callers) then compares the fix to
              the session's location radius (Haversine):
                 inside radiusMeters  → Present
                 outside radiusMeters → Outside Location (still recorded, not blocked)
  → After dueAt (session still Open):
       “Due passed” on card
       Mark present or QR scan → app-confirm-dialog
         “Cannot mark present… due time has passed”
       API also rejects submit (403) if forced
  → Teacher Close → open card gone; My attendance row KEPT
  → Teacher Delete → open card gone; My attendance row REMOVED
       (cascade on delete + GET /api/attendance/me purges orphans)
  → My attendance table columns:
       Session · Location (Building X-Room N) · Scanned at (GPS) · Recorded · Status
  → Sign out → /auth/login

Any /dashboard|/students|... request:
  → roleGuard(['admin','teacher']) fails → /student/scan
```

### E. Locations in-page flow (no route change)

```text
/locations (loads)
  → POST /api/locations/visits {} → student visit rows + unfiltered metrics
       (empty until a student scans QR or marks present)
  → Building / Status dropdowns (and search) apply immediately — no Apply button
       → POST /api/locations/visits { search?, building?, status? }
       (server-side; body visible in Network)
  → Export → POST /api/locations/visits/excel (same body) → location-visits-YYYY-MM-DD.xlsx
       (ExcelJS; full scanned-at text; teacher sees own sessions only)
  → Table columns: Student · Session · Location (assigned zone) · Building
       · Scanned at (place name + GPS) · Distance · Status · Recorded
  → No row dialog — every visit fact is a column
  → Sessions create still uses GET /api/locations (full Active zone catalog)
```

### F. Students in-page flow (no route change, admin only, live API)

```text
/students (loads)
  → GET /api/students → directory + metrics + filters (hasAccount flag)
  → “Add student account” → form card
      → POST /api/students { studentId, name, email, course, year, password }
      → profile + login account created → table refresh
  → login toggle → onLoginToggle(studentId)
      → disabled when hasAccount=false (label “No account”)
      → PATCH /api/students/:id/access { loginEnabled }
      → status Active/Inactive follows the toggle
```

## Layouts

### AuthLayout (`layouts/auth-layout/`)

- Wraps login only.
- No sidebar.
- `guestGuard` prevents authenticated users from staying here.

### AdminLayout (`layouts/admin-layout/`)

- Left: `AdminSidebarComponent` (brand, nav, user label, collapse, logout).
- Right: `<router-outlet>` for feature pages.
- Sidebar collapse preference: `localStorage` key `smartcampus.admin.sidebarCollapsed`.
- Teacher nav filter: hides paths in `adminOnlyPaths` (`/students`).

### Student scan (no shared layout folder)

- Page is self-contained under `features/attendance/pages/student-scan/`.
- Live: open sessions + Mark present.
- **Due time:** keep past-due cards; block mark/scan with `app-confirm-dialog`.
- Open cards removed only when teacher **Close**/Delete (not on due alone).
- Accepted mark before due → **Present** only.
- **My attendance:** shared `app-table` (no last-result hero); location via `formatCampusLocationLabel`.
- **Delete cascade:** teacher Delete removes attendance by `sessionId`; `GET /api/attendance/me` filters to existing sessions and purges orphans.
- **Live, hard gate:** GPS / Outside Location geofence check (FR-02) — location
  permission is mandatory to submit; deny/unsupported/timeout blocks the
  submit with a "Try again" dialog instead of recording anything. See
  sequence D above and `.grok/skills/smart-campus-dev/references/architecture.md`.

## Seeded accounts

| Email | Password | Role | studentId |
|-------|----------|------|-----------|
| `admin@smartcampus.edu` | `admin123` | admin | — |
| `teacher@smartcampus.edu` | `teacher123` | teacher | — |
| `chihea@smartcampus.edu` | `chihea123` | student | `SC-1001` |

All other student accounts are **created by an admin** (Students → Add student
account → `POST /api/students`). Login access is enforced via
`students.login_enabled` — disabled students get 403 at login.

Frontend: `frontend/src/app/services/auth.service.ts`, `services/student.service.ts`  
Backend: `backend/src/modules/auth/auth.service.ts`, `modules/students/`  
Detailed flow: `.grok/skills/smart-campus-student/references/student-account-flow.md`

## Feature requirement tags (from code comments)

| FR | Area | Notes in code |
|----|------|----------------|
| FR-01 | Auth | Authenticated session required |
| FR-02 | Student scan | Identity + **live, hard-gated** GPS geofence check (mandatory permission; Haversine vs `radiusMeters`) |
| FR-07 | Recent scans | Dashboard recent scan list |

## Planned / incomplete flows

| Flow | Current | Intended later |
|------|---------|----------------|
| Student scan GPS / geofence | **Live, hard gate** — location permission is mandatory; deny/unsupported/timeout blocks the submit entirely (no record, "Try again" dialog); granted fix outside `radiusMeters` (Haversine) → Outside Location (still recorded) | Consider soft-fail / grace mode if GPS reliability becomes an issue |
| Student history route | In-page “My scans” only | `/student/history` route |
| Reports page | Placeholder | Export / analytics |
| Dashboard UI | Mock JSON | Optional live API later |
| Teacher live feed of scans | **Live on `/attendance`** — Present + Absent for the teacher's sessions after due/close | Optional live list on Sessions |
| Student account bulk import | Admin creates one-by-one | CSV/SIS import + first-login password reset |
| Persistence | In-memory sessions/locations/scans | TypeORM / MySQL later |
| Courses / requests / notifications | Mentioned in older plans | Not in attendance-first nav |

## Key source files (quick index)

```text
frontend/src/app/
  app.routes.ts                          # Top-level route tree
  core/guards/auth.guard.ts              # auth / guest / role
  core/constants/app-routes.ts           # path constants
  core/constants/admin-navigation.ts     # sidebar items
  layouts/admin-layout/                  # admin/teacher shell
  layouts/auth-layout/                   # login shell
  features/auth/pages/login/
  features/dashboard/pages/dashboard/
  features/students/pages/students/
  features/attendance/pages/admin-records/
  features/attendance/pages/student-scan/
  features/locations/pages/locations/
  features/sessions/pages/sessions/      # live teacher QR flow
  features/attendance/pages/student-scan/ # live student submit
  services/auth.service.ts
  services/student.service.ts      # live /students directory + accounts
  services/session.service.ts
  services/student-attendance.service.ts
  models/session.model.ts
  models/attendance.model.ts
  routes/*.routes.ts
  assets/mock-data/*.json
```
