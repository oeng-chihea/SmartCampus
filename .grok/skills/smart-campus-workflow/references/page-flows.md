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
| `/students` | AdminLayout | `StudentsComponent` | auth + **admin only** | Active (mock data) |
| `/attendance` | AdminLayout | `AdminRecordsComponent` | auth + admin\|teacher | Active (mock data) |
| `/locations` | AdminLayout | `LocationsComponent` | auth + admin\|teacher | Active (mock data) |
| `/sessions` | AdminLayout | `SessionsComponent` | auth + admin\|teacher | **Live API** create / QR / close |
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
| `/sessions` create + QR + close | ✓ | ✓ (own sessions) | ✗ |
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
  → Create session (dialog) → POST /api/sessions
  → Live QR left panel → GET /api/sessions/:id/qr (refresh ~30s)
  → Close → POST /api/sessions/:id/close
```

### D. Student login → live QR + mark present

```text
Login success (role=student)
  → homePathForRole → /student/scan
  → GET /api/sessions/open (same live QR as teacher)
  → Session card with QR image + details
  → Tap “Mark me present”
  → POST /api/attendance/submit → Present | Late
  → Sign out → /auth/login

Any /dashboard|/students|... request:
  → roleGuard(['admin','teacher']) fails → /student/scan
```

### E. Locations in-page flow (no route change)

```text
/locations
  → LocationFilter apply → filteredLocations (computed)
  → LocationTable select row → LocationService.getLocationDetail
  → LocationDetailDialog open (selectedDetail signal)
  → close → selectedDetail = null
```

### F. Students in-page flow (no route change, admin only)

```text
/students
  → StudentTable shows list
  → login toggle → onLoginToggle(studentId)
  → flips loginEnabled + status Active/Inactive (in-memory only)
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
- Live: payload paste + Present/Late via Nest attendance API.
- Planned later: GPS / Outside Location (FR-02 geofence phase).

## Demo accounts (frontend + backend aligned)

| Email | Password | Role | studentId |
|-------|----------|------|-----------|
| `admin@smartcampus.edu` | `admin123` | admin | — |
| `teacher@smartcampus.edu` | `teacher123` | teacher | — |
| `student@smartcampus.edu` | `student123` | student | `SC-1024` |

Frontend: `frontend/src/app/services/auth.service.ts`  
Backend: `backend/src/modules/auth/auth.service.ts` (`POST /api/auth/login`)

## Feature requirement tags (from code comments)

| FR | Area | Notes in code |
|----|------|----------------|
| FR-01 | Auth | Authenticated session required |
| FR-02 | Student scan | Identity + later GPS |
| FR-07 | Recent scans | Dashboard recent scan list |

## Planned / incomplete flows

| Flow | Current | Intended later |
|------|---------|----------------|
| Student scan GPS | Payload submit live (Present/Late) | Geofence → Outside Location |
| Student history route | In-page “My scans” only | `/student/history` route |
| Reports page | Placeholder | Export / analytics |
| Dashboard / attendance / locations UI | Mock JSON | Optional live API later |
| Teacher live feed of scans | Not built | Session-side attendance list |
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
  services/session.service.ts
  services/student-attendance.service.ts
  models/session.model.ts
  models/attendance.model.ts
  routes/*.routes.ts
  assets/mock-data/*.json
```
