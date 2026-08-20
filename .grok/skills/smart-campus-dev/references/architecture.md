# Smart Campus — Architecture Reference

## Monorepo layout

```text
smart-campus-system/
├── package.json                 # root scripts (frontend:* / backend:*)
├── README.md                    # high-level overview (some planned features listed)
├── docs/superpowers/plans/      # implementation plans
├── .grok/skills/                # project Grok skills (this folder’s parent)
├── frontend/                    # Angular app
└── backend/                     # NestJS API
```

## Frontend feature map

| Feature folder | Page(s) | Route(s) | Service | Mock data |
|----------------|---------|----------|---------|-----------|
| `features/auth` | login | `/auth/login` | `AuthService` | none (live API; no demo chips) |
| `features/dashboard` | dashboard | `/dashboard` | `DashboardService` | `dashboard-attendance.json` |
| `features/students` | students | `/students` | `StudentService` | **live API** (`GET/POST /api/students`, `PATCH /:id/access`) |
| `features/attendance` | admin-records, student-scan | `/attendance`, `/student/scan` | `AttendanceService` (+ auth for scan) | **Live API** (`POST /api/attendance/admin` Present + Absent; student submit / me) |
| `features/locations` | locations | `/locations` | `LocationService` | **Live API** (`POST /api/locations/visits` — visit log with assigned zone + student GPS). Catalog `GET /api/locations` is for Sessions / geofence only. |
| `features/sessions` | sessions (state + flow + UI) | `/sessions` | `SessionService` | **Live API** create / QR / edit / close / delete |
| `features/reports` | empty folder | `/reports` placeholder | — | — |

## Shared components → consumers

| Component | Used by |
|-----------|---------|
| `stat-card` | Dashboard, Students, Attendance, Locations, Sessions |
| `quick-lookup` | Dashboard |
| `attendance-chart` | Dashboard |
| `recent-scan-list` / `recent-scan-item` | Dashboard |
| `student-filter` / `student-table` | Students |
| `student-form-card` | Students (Add student account form — name, ID, email, class, year, password) |
| `attendance-filter` / `attendance-records-table` | Admin attendance |
| `location-filter` | Locations |
| `table` | Sessions log; student My attendance; locations/admin attendance |
| `confirm-dialog` | Sessions delete; student due-time blocked mark/scan |
| `modal-dialog` / `select-dropdown` | Sessions create / edit form; other dialogs |

## Models

| File | Main types |
|------|------------|
| `user.model.ts` | `User`, `UserRole` |
| `auth.model.ts` | `AuthSession`, `LoginRequest` |
| `student.model.ts` | `Student` (+ `hasAccount`), `CreateStudentRequest` |
| `attendance.model.ts` | `AttendanceRecord`, filter state, admin page shape |
| `location.model.ts` | `CampusLocation`, `LocationVisit`, filters |
| `session.model.ts` | `AttendanceSession`, `CreateSessionRequest`, `EditSessionRequest`, QR types |
| `api-response.model.ts` | generic API envelope (for future HTTP) |
| `pagination.model.ts` | pagination shape (for future lists) |

## Environments

- `environments/environment.ts` — production; `apiBaseUrl: '/api'`
- `environments/environment.development.ts` — development API base

## Backend module status

| Module | Status |
|--------|--------|
| `auth` | Live login (`POST /api/auth/login`), HMAC-signed tokens, enforces `students.login_enabled` (403 for disabled) |
| `users` | **Live** account provisioning: `POST /api/users` (admin); links student accounts to profiles |
| `students` | **Live** directory: `GET /api/students`, `POST /api/students` (+ account), `PATCH /:id/access` |
| `dashboard` | Registered module with frontend-aligned dashboard contract |
| `attendance` | **Live** student submit + `GET /me` (existing sessions only; purges orphans; **excludes Absent**); `POST /admin` lists scanners until `dueAt`, then materializes **Absent** for login-account students who never scanned (`absents_finalized`); submit runs the **geofence check** (FR-02, Haversine vs `radiusMeters`) when the client sends GPS coordinates. **Excel:** `POST /admin/excel` (same filter body, ExcelJS `.xlsx`) |
| `locations` | **Live** zone catalog (`GET /api/locations`) for session create + geofence, and student visit log (`POST /api/locations/visits` with search/building/status). **Excel:** `POST /api/locations/visits/excel` (same filter body). Default pin is **KIT Phnom Penh Campus** (`LOC-001`, 11.5479313, 104.9405941, 80 m). Visit rows show the assigned zone plus the student’s scan GPS (`latitude` / `longitude` stored on `attendance_records`); zone `latitude/longitude/radiusMeters` are consumed by the attendance geofence check |
| `sessions` | **Live** create / list / QR / **edit** (`POST /:id/edit`) / close / **delete** (delete cascades attendance by `session_id`) |
| `reports` | Registered boundary; frontend page is still a placeholder |
| TypeORM / migrations | Users/students/sessions/attendance persist via TypeORM (`synchronize: true` in dev) |

All backend routes use the `/api` global prefix. Feature modules contain
`<feature>.controller.ts`, `<feature>.service.ts`, and `<feature>.module.ts`.
`dto/` and `entities/` are added only when the feature owns concrete contracts
or persistence.

## README vs code (known drift)

Root `README.md` lists broader product areas (courses, requests, notifications, roles UI, settings).  
**Current product nav is attendance-first** (`ADMIN_NAVIGATION`): Dashboard, Students, Attendance, Locations, Sessions, Reports. Prefer the nav constants and routes over the older README feature list when deciding scope.

## Data dependency example (Locations visit log)

```text
LocationService.queryVisits(filters)
  POST /api/locations/visits { search?, building?, status? }
LocationService.exportVisitsExcel(filters)
  POST /api/locations/visits/excel { search?, building?, status? }
    → .xlsx (ExcelJS; full scanned-at Unicode text)
    attendance_records
      INNER JOIN sessions (teacher: own sessions only)
      INNER JOIN locations
    → student · session · assigned zone · building · scanned place name + GPS · distance · status · recorded
    metrics from the unfiltered visit set
    buildingOptions from the zone catalog
LocationService.listLocations()
  GET /api/locations  → Sessions create picker + geofence only
```

The Locations **page** is a visit log (empty until a student scans / marks
present). The 8 seeded zones stay in MySQL for session create and geofence;
they are not listed on `/locations` until someone visits them via a scan.

## Sessions page structure (live)

```text
features/sessions/pages/sessions/
  sessions.component.ts|html|scss   # thin UI shell + table column defs
  sessions.state.ts                  # signals, form fields, metrics
  sessions.flow.ts                  # reload / create / edit / showQr / close / delete
services/session.service.ts         # HTTP client (Bearer)
services/scan-origin.service.ts     # GET /api/runtime/scan-origin → https://<lan-ip>:4200
core/utils/date.util.ts             # formatSessionOpened / formatSessionDue / isSessionPastDue
core/utils/format.util.ts           # formatCampusLocationLabel → Building A-Room 201

Student scan history:
  features/attendance/pages/student-scan/  # live cards + due dialog + app-table
  services/student-attendance.service.ts   # open / submit / me
```

## Geofence check (live, FR-02) — hard location gate

```text
frontend/src/app/core/utils/geolocation.util.ts   # getCurrentCoordinates / watchDeviceLocation — short settle, then accept best fix
frontend/src/app/core/utils/geofence.util.ts      # Turf.js preview (inside circle / distance)
frontend/src/app/shared/components/scan-map/      # Leaflet + OSM tiles, student pin, zone circle (original GPS only)
frontend/src/app/features/attendance/pages/student-scan/student-scan.flow.ts
  buildSubmitRequest(payload, sessionTitle, retry)  # uses live GPS immediately; locationBlocked only when GPS is missing
  retryAfterLocationBlocked() / dismissLocationBlocked()
frontend/src/app/features/attendance/pages/student-scan/student-scan.state.ts
  locationBlocked signal + LocationBlockedNotice { sessionTitle, reason, retry }

backend/src/common/utils/geo.util.ts               # haversineDistanceMeters / isWithinRadius (pure, unit-tested)
backend/src/modules/attendance/dto/submit-attendance.dto.ts  # optional-by-decorator latitude/longitude (@IsLatitude/@IsLongitude); presence enforced in the service
backend/src/modules/attendance/attendance.service.ts
  requireCoordinates(dto)                           # throws BadRequestException when lat/lng missing — hard reject, no record created
  evaluateGeofence(dto, location)                   # Haversine(student, session.location) vs radiusMeters — runs only after requireCoordinates passes
```

Rules (**hard gate — no coordinates ⇒ no record at all**, enforced on both sides):

- Frontend never calls `POST /api/attendance/submit` without a GPS fix — if there is no live watch reading and `getCurrentCoordinates()` fails (denied/unsupported/timeout), the flow opens a **"Cannot mark present" / "Try again"** confirm dialog instead and aborts before any network call. A live reading is used immediately (no ±30 m wait).
- Backend re-checks independently (`requireCoordinates`) so a direct API call without coordinates is rejected with **400** and a clear message — never silently recorded.
- Coordinates within `radiusMeters` → **Present**, `distanceMeters` = rounded meters.
- Coordinates outside `radiusMeters` → **Outside Location** (still recorded, not rejected — this is the only "the record exists but flagged" case) — visible on the admin/teacher attendance log and the Locations visit table (**Scanned at** = student GPS).
- Submit **persists** the **original** `latitude` / `longitude` / `accuracyMeters` immediately, then reverse-geocodes with **one** Nominatim call (≤1 s) into `scannedLocation`. The geocoder never moves the pin. A slow/failed geocode still returns the saved scan (name may fill in a moment later). The student scan page does not reload open sessions before submit.
- `GET /api/sessions/open` includes `locationId`, `latitude`, `longitude`, `radiusMeters` so the student map and Turf preview can draw the zone.
- `AttendanceModule` imports `LocationsModule` to read the session's `LocationEntity` (lat/lng/radius) at submit time.
- `SessionScanContext` (from `SessionsService.resolveOpenSessionForScan`) carries `locationId` so `AttendanceService` can look up the right zone.

Session log ⋮ menu:

| Status | Actions |
|--------|---------|
| Open | Show QR · Edit session · Close · Delete |
| Closed | Edit session · Delete |

- **Edit session** → `POST /api/sessions/:id/edit` (title, location, due time; separate from create; does not rotate QR or change status)
- **Close** → `POST /api/sessions/:id/close` (row stays Closed; student open card gone; history kept)  
- **Delete** → `DELETE /api/sessions/:id` (session removed + **cascade** `attendance_records` for that `session_id`; student My attendance drops those rows)
- Student `GET /api/attendance/me` only returns **scan** rows for sessions that still exist and deletes orphan rows (Absent rows are staff-only)
- Admin/teacher `POST /api/attendance/admin` lists **only scanners** until `dueAt`. After due, it writes **Absent** for roster students (`students.user_id` set) who did not scan. Close before due does not write absents. `sessions.absents_finalized` prevents later backfill. `attendanceStatus` is Present (any scan, including Outside Location) or Absent. Changing `dueAt` on edit deletes Absent rows and clears the flag. Locations visits exclude Absent.

## Security notes (demo stage)

- Seeded passwords are for local demos only; every student has a **personal
  account** (no shared demo student logins).
- Frontend session is localStorage JSON, not production JWT validation.
- Role checks are enforced on the API for the live modules (auth, users,
  students, sessions, attendance) via `AuthGuard` + `RolesGuard`.
