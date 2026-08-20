---
name: smart-campus-dev
description: >
  Coding conventions and architecture for Smart Campus (Angular frontend + NestJS backend).
  Use when adding pages, routes, components, services, mock data, guards, or API modules,
  or when the user asks where to put code, how features are structured, or runs /smart-campus-dev.
---

# Smart Campus — Development Skill

Follow this skill when building or changing features. For user navigation and roles, also load **`smart-campus-workflow`**.

Detailed folder map: `references/architecture.md`.

## Stack

| Layer | Tech | Root folder |
|-------|------|-------------|
| Frontend | Angular (standalone components), SCSS, signals | `frontend/` |
| Backend | NestJS, TypeScript | `backend/` |
| Monorepo scripts | npm workspaces-style prefixes | root `package.json` |

Commands (repo root):

```bash
npm run frontend:start:local   # Angular on 127.0.0.1:4200
npm run frontend:build
npm run frontend:test
npm run backend:start          # Nest start:dev
npm run backend:build
npm run backend:test
```

## Frontend architecture (where things go)

```text
frontend/src/app/
  core/           # routes constants, guards, pure utils (no feature UI)
  layouts/        # shells: admin-layout, auth-layout
  features/       # feature areas → pages only (route targets)
  routes/         # lazy route arrays per feature
  services/       # data access (mock now; HTTP later)
  models/         # TypeScript interfaces/types
  shared/         # reusable UI components used by multiple pages
  assets/mock-data/  # JSON fixtures
```

### Rules of thumb

1. **Pages** live under `features/<area>/pages/<page-name>/` as `*.component.ts|html|scss`.
2. **Reusable widgets** (tables, filters, cards, dialogs) live under `shared/components/`.
3. **Do not** invent a second admin layout; admin pages are **children** of `AdminLayoutComponent`.
4. **Students** have no separate layout folder; student scan is a standalone page under attendance feature.
5. Prefer **standalone** Angular components and lazy `loadChildren` / `loadComponent` like existing routes.
6. Use **signals** for local UI state (filters, dialogs, toggles) matching existing pages.
7. Keep path strings centralized: `APP_ROUTES` + `ADMIN_NAVIGATION` + `API_ENDPOINTS`.

## Adding a new admin page (checklist)

1. Create page under `features/<name>/pages/<name>/`.
2. Add `routes/<name>.routes.ts` exporting a `Routes` array.
3. Register under `AdminLayoutComponent` children in `app.routes.ts` with correct `roleGuard` if needed.
4. Add sidebar item in `admin-navigation.ts` (and filter in layout if admin-only).
5. Add path constant in `app-routes.ts`.
6. Add model types in `models/` if new entities appear.
7. Add service in `services/` + mock JSON under `assets/mock-data/` (until API is live).
8. Compose UI from `shared/components` (stat cards, tables, filters) when possible.
9. Update **smart-campus-workflow** references if navigation or roles change.

## Adding a student page (checklist)

1. Page under the relevant `features/` area (e.g. attendance).
2. Register under `path: 'student'` children in `app.routes.ts` (already has `authGuard` + `roleGuard(['student'])`).
3. Extend `attendance.routes.ts` (or split student routes if it grows).
4. Do **not** put student pages inside `AdminLayoutComponent`.

## Auth patterns

- Session: `AuthService` + `localStorage` key `smartcampus_auth_session`.
- Guards: `authGuard`, `guestGuard`, `roleGuard(roles)` in `core/guards/auth.guard.ts`.
- After login: always `router.navigateByUrl(auth.homePathForRole(role))`.
- Roles type: `'admin' | 'teacher' | 'student'` (`models/user.model.ts`).
- Frontend login calls Nest `POST /api/auth/login` and stores the real access
  token in `localStorage` key `smartcampus_auth_session`.
- **No demo login chips** — students sign in with personal accounts created by
  an admin (`POST /api/students` with password, or generic `POST /api/users`).
  Only admin/teacher/Chihea are seeded. Login access is enforced server-side via
  `students.login_enabled` (403 for disabled accounts).

## UI patterns already in the app

| Pattern | Example |
|---------|---------|
| Page header (title + subtitle) | Students, Attendance, Locations |
| Metric row of `app-stat-card` | Dashboard, Students, … |
| Filter toolbar + table | Students, Attendance, Locations |
| In-page dialog (no route) | Sessions create form |
| Sidebar collapse preference | Admin layout localStorage |

Shared components to reuse first:

- `stat-card`, `student-table`, `student-filter`, `attendance-filter`, `session-picker-dialog` (paginated session modal, limit 10), `table` (shared data table for locations / attendance / sessions), `attendance-chart`, `recent-scan-list`, `location-filter`, `modal-dialog`, `confirm-dialog`, `select-dropdown`, `quick-lookup`

### Generic modal dialog (`app-modal-dialog`)

Reusable shell for create/edit/info dialogs:

- **Shell:** backdrop, panel, eyebrow, title, × close, body projection
- **Module content:** project fields/forms inside the tag (page owns the form)
- **Dismiss lock:** `[lockDismiss]="true"` (default) → outside click / Escape **shake** once via Web Animations API; only × / parent Cancel closes
- **Dismiss open:** `[lockDismiss]="false"` → outside click / Escape emit `(closed)`
- **Sizes:** `size="md" | "lg" | "xl"`
- Example: Sessions create session form

## Backend architecture (current)

```text
backend/src/
  common/constants|types|utils
  config/
  database/          # data-source, migrations, seeders (scaffold)
  modules/
    auth/            # implemented: POST /api/auth/login (+ login_enabled check)
    users/           # implemented: POST /api/users (admin account provisioning)
    students/        # implemented: GET/POST /api/students, PATCH /:id/access
    dashboard/
    attendance/
    locations/
    sessions/
    reports/
```

When implementing API modules:

1. Nest module under `modules/<name>/` with controller and service; add `dto/`
   or `entities/` only when the feature owns real contracts or persistence.
2. Register module in `app.module.ts`.
3. Align DTO fields with frontend `models/`.
4. Document endpoints in `frontend/src/app/core/constants/api-endpoints.ts`.
5. Prefer gradual replacement of mock services with `HttpClient` + `environment.apiBaseUrl`.
6. All HTTP routes are served below the global `/api` prefix.
7. Live teacher flow: `SessionService` + Sessions page use auth Bearer token for
   locations/sessions/QR/delete. Page layout:
   - State → `sessions.state.ts`, flow → `sessions.flow.ts`, shell → component
   - Session log via shared `app-table`; ⋮ actions: **Show QR**, **Edit session**, **Close**, **Delete**
   - Create form: title, location, **due date + time** (any calendar day) → `dueAt` ISO
     (no “must be 1 minute ahead” check; replaces removed **Late after**)
   - Display helpers: `formatSessionOpened` / `formatSessionDue` → `8-16-26-11:04Pm`;
     `isSessionPastDue` for student gate;
     `formatCampusLocationLabel` → `Building A-Room 201` (table + create dialog)
   - QR deep links use `GET /api/runtime/scan-origin` (`https://<lan-ip>:4200`)
     so phones get a secure context for Safari GPS (HTTP LAN cannot prompt)
   - APIs: `POST/GET /api/sessions`, `GET …/:id/qr`, `POST …/:id/edit`,
     `POST …/:id/close`, `DELETE …/:id`
   - After `dueAt`, submit is rejected; session stays Open until teacher Close
     (student UI keeps the card; mark/scan shows `app-confirm-dialog`)
   - **Delete cascade:** `SessionsService.remove` deletes `attendance_records`
     for that `session_id`, then removes the session (student history follows)
8. Live student flow: `StudentAttendanceService` loads `GET /api/sessions/open`
   (all Open sessions + same live QR as teacher — **do not filter out past due**),
   then `POST /api/attendance/submit` (before due only; API 403 after due)
   and `GET /api/attendance/me` (only **scan** rows for sessions that still exist;
   **purges orphan records**; **excludes Absent**). Past-due mark/scan opens shared
   `app-confirm-dialog`. `POST /api/attendance/admin` lists **only scanners** until
   `dueAt`. After due, it materializes **Absent** rows for login-account students
   who did not scan (`absents_finalized` snapshot). Close before due does **not**
   write absents. Edit due time deletes Absent rows. Locations visits also exclude
   Absent. Admin/teacher table column **Attendance status** is Present (scanned
   on time) or Absent.
   My attendance UI: shared `app-table` (Session · Location · Scanned at place name · Recorded · Status);
   location `formatCampusLocationLabel` → `Building B-Room 105`.
   Admin records and Locations pages are live (`AttendanceService`,
   `LocationService`). Locations is a **student visit log**
   (`POST /api/locations/visits`) with assigned zone, student GPS, and a
   reverse-geocoded `scannedLocation` place name persisted at submit;
   the zone catalog stays on `GET /api/locations` for session create.
   **Geofence check (FR-02, live) — hard location gate:** the scan page
   watches device GPS (`getCurrentCoordinates` / `watchDeviceLocation` in
   `core/utils/geolocation.util.ts`) and draws it on **Leaflet + OSM**
   (`app-scan-map`) with a Turf.js circle preview (`core/utils/geofence.util.ts`).
   If GPS is denied/unsupported/timed out, the flow **does not call the API**
   — "Cannot mark present / Try again". A granted fix (including the live
   watch reading) is submitted immediately as
   `{ latitude, longitude, accuracyMeters }`. The backend remains the
   authority: `evaluateGeofence` (Haversine vs `radiusMeters`) → **Present**
   or **Outside Location**. The stored name is one Nominatim reverse of the
   scan GPS (street + sangkat; no Overpass wait on submit).
   A request with no coordinates is rejected (400).
9. Live student accounts: `StudentService` (frontend) ↔ `StudentsModule`/
   `UsersModule` (Nest, TypeORM users + students tables). When adding account
   features, keep the link `users.student_id` ↔ `students.student_id` and
   enforce `students.login_enabled` at login.

## Style / SCSS

- Global styles: `frontend/src/styles/` (`_variables`, `_mixins`, `_reset`, `_global`).
- Component SCSS co-located with the component.
- Keep admin workspace responsive; students table already has mobile stacking patterns.

## Testing

- Frontend unit/template specs next to components where they exist (`*.spec.ts`).
- Backend: Jest e2e under `backend/test/`.
- After route changes, typecheck: `npx tsc --noEmit -p frontend/tsconfig.app.json`.

## Do / don’t

**Do**

- Keep attendance-first scope (sidebar is intentionally not a full CRM).
- Respect role boundaries in both routes and UI.
- Update skills when user-visible flow changes.

**Don’t**

- Nest admin feature pages outside `AdminLayoutComponent`.
- Add teacher access to Students without product decision.
- Hardcode route strings across many files—use constants.
- Commit secrets; demo passwords are intentionally public for FR demos only.
