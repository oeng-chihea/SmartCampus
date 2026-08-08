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
| `features/attendance` | admin-records, student-scan | `/attendance`, `/student/scan` | `AttendanceService` (+ auth for scan) | `attendance-records.json` |
| `features/locations` | locations | `/locations` | `LocationService` | `locations.json` (+ attendance/students for detail) |
| `features/sessions` | empty folder | `/sessions` placeholder | — | — |
| `features/reports` | empty folder | `/reports` placeholder | — | — |

## Shared components → consumers

| Component | Used by |
|-----------|---------|
| `stat-card` | Dashboard, Students, Attendance, Locations |
| `quick-lookup` | Dashboard |
| `attendance-chart` | Dashboard |
| `recent-scan-list` / `recent-scan-item` | Dashboard |
| `student-filter` / `student-table` | Students |
| `student-form-card` | Students (Add student account form — name, ID, email, class, year, password) |
| `attendance-filter` / `attendance-records-table` | Admin attendance |
| `location-filter` / `location-table` / `location-detail-dialog` | Locations |

## Models

| File | Main types |
|------|------------|
| `user.model.ts` | `User`, `UserRole` |
| `auth.model.ts` | `AuthSession`, `LoginRequest` |
| `student.model.ts` | `Student` (+ `hasAccount`), `CreateStudentRequest` |
| `attendance.model.ts` | `AttendanceRecord`, filter state, admin page shape |
| `location.model.ts` | `CampusLocation`, `LocationDetail`, filters |
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
| `attendance` | Registered module with frontend-aligned attendance contract |
| `locations` | Registered module with frontend-aligned location contracts |
| `sessions` | Registered boundary; frontend page is still a placeholder |
| `reports` | Registered boundary; frontend page is still a placeholder |
| TypeORM / migrations | Users/students rows persist via TypeORM `synchronize: true`; sessions still in-memory |

All backend routes use the `/api` global prefix. Feature modules contain
`<feature>.controller.ts`, `<feature>.service.ts`, and `<feature>.module.ts`.
`dto/` and `entities/` are added only when the feature owns concrete contracts
or persistence.

## README vs code (known drift)

Root `README.md` lists broader product areas (courses, requests, notifications, roles UI, settings).  
**Current product nav is attendance-first** (`ADMIN_NAVIGATION`): Dashboard, Students, Attendance, Locations, Sessions, Reports. Prefer the nav constants and routes over the older README feature list when deciding scope.

## Data dependency example (Locations detail)

```text
LocationService.getLocationDetail(location)
  reads locations.json (zone)
  joins attendance-records.json (people scanned at that location name)
  joins students.json (enrich student profile)
  → LocationDetailDialog
```

This cross-mock join is intentional for the admin “who is in this zone” view.

## Security notes (demo stage)

- Seeded passwords are for local demos only; every student has a **personal
  account** (no shared demo student logins).
- Frontend session is localStorage JSON, not production JWT validation.
- Role checks are enforced on the API for the live modules (auth, users,
  students, sessions, attendance) via `AuthGuard` + `RolesGuard`.
