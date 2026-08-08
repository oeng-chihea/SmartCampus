---
name: smart-campus-workflow
description: >
  Explains Smart Campus page-to-page user workflow by role (admin, teacher, student),
  route guards, layouts, and navigation. Use when the user asks how the app works,
  page flow, navigation, login redirect, roles, routes map, "from one page to another",
  or runs /smart-campus-workflow.
---

# Smart Campus — Page-to-Page Workflow

Use this skill whenever explaining or changing how users move through the app.
Read `references/page-flows.md` for the full route table and file map.

## Product intent

**Smart Campus Management System** is an **attendance-first** app:

- Staff (admin / teacher) monitor attendance, students, and campus locations.
- Students submit attendance via a scan/session-code flow (GPS phase planned later).
- Frontend is Angular; backend NestJS is partially live. **Login**, **Sessions + QR**,
  and **Student scan submit** call the API; other admin pages still use **mock JSON**.

## Entry and exit

| Step | What happens | Key files |
|------|----------------|-----------|
| Open `/` | Redirect → `/dashboard` | `app.routes.ts` |
| Not authenticated on protected route | → `/auth/login` | `auth.guard.ts` |
| Already logged in visits `/auth/*` | → role home path | `guestGuard` |
| Login success | → `homePathForRole(role)` | `auth.service.ts`, `login.component.ts` |
| Logout | Clear session → `/auth/login` | Admin layout / student scan |

**Role home paths** (`AuthService.homePathForRole`):

- `student` → `/student/scan`
- `admin` | `teacher` → `/dashboard`

## Page graph (how one page leads to the next)

### 1) Authentication shell

```text
/auth  (AuthLayoutComponent + guestGuard)
  └── /auth/login  → LoginComponent
        ├── success (admin/teacher) → /dashboard  (AdminLayout)
        ├── success (student)       → /student/scan
        └── failure                 → stay on login (error message)
```

- No demo chips on the login form — every student signs in with their **own
  account** (created by an admin; only Chihea is pre-seeded). See
  `smart-campus-student/SKILL.md`.
- Session stored in `localStorage` key `smartcampus_auth_session`.

### 2) Admin / teacher shell (shared layout)

```text
'' path with AdminLayoutComponent
  canActivate: authGuard + roleGuard(['admin', 'teacher'])
  children:
    /dashboard   → DashboardComponent      (summary, chart, recent scans)
    /students    → StudentsComponent       (admin only — extra roleGuard)
    /attendance  → AdminRecordsComponent   (records + filters)
    /locations   → LocationsComponent      (zones + detail dialog)
    /sessions    → SessionsComponent       (create session, live short-lived QR, close)
    /reports     → AdminPlaceholderPage    ("Attendance reports")
    **           → redirect to dashboard
```

**Navigation between admin pages** is **sidebar links only** (no deep page-to-page wizards yet):

1. User is inside `AdminLayoutComponent` (sidebar + `router-outlet`).
2. Sidebar reads `ADMIN_NAVIGATION` (filtered for teachers: hide `/students`).
3. Clicking a nav item `routerLink`s to that path; active state via `routerLinkActive`.
4. Content page loads inside the workspace; layout and session stay the same.
5. **Sign out** in sidebar footer → logout → `/auth/login`.

| From | User action | To |
|------|-------------|-----|
| Any admin page | Sidebar → Dashboard | `/dashboard` |
| Any admin page | Sidebar → Students | `/students` (admin only; teacher blocked by guard → home) |
| Any admin page | Sidebar → Attendance | `/attendance` |
| Any admin page | Sidebar → Locations | `/locations` |
| Any admin page | Sidebar → Sessions | `/sessions` (live API: create / QR / close) |
| Sessions | Create session / Show QR | Same page; QR auto-refreshes ~30s |
| Any admin page | Sidebar → Reports | `/reports` (placeholder) |
| Locations table | Select a row | Opens **location detail dialog** (same page, modal) |
| Locations dialog | Close | Stay on `/locations` |
| Students table | Toggle login / Add student account | Same page; toggles persist via `PATCH /api/students/:id/access`, creation via `POST /api/students` |
| Attendance | Apply filters | Same page; filters records client-side |
| Any admin page | Sign out | `/auth/login` |

### 3) Student shell

```text
/student  (authGuard + roleGuard(['student']))
  └── /student/scan → StudentScanComponent
```

- No admin sidebar. Header shows student name / studentId + **Sign out**.
- Scan page is **live**: open sessions load the **same live QR** as the teacher
  (`GET /api/sessions/open`) → student taps **Mark me present**.
- GPS / Outside Location validation is planned later; Present/Late only for now.
- No other student routes are registered yet (`student/history` constant exists but is unused).

| From | User action | To |
|------|-------------|-----|
| Login as student | Auto redirect | `/student/scan` |
| Student scan | Live open session QR + Mark present | Same QR as teacher; Present/Late |
| Student scan | Sign out | `/auth/login` |
| Student tries `/dashboard` etc. | `roleGuard` fails | Redirect to `/student/scan` |

## Guards (who can open which page)

| Guard | Rule | On fail |
|-------|------|---------|
| `authGuard` | Must have session | `/auth/login` |
| `guestGuard` | Must **not** have session | Role home |
| `roleGuard(roles)` | Role must be in list | Role home or login |

Special cases:

- **Students** cannot use admin routes → sent to `/student/scan`.
- **Teachers** cannot open `/students` (route + nav filter).
- **Admins** see full sidebar including Students.

## Data flow on each page (current)

Pages do **not** yet call the Nest API for dashboard/students/attendance/locations. Pattern:

1. Page component constructs or injects a **service**.
2. Service reads **mock JSON** from `frontend/src/assets/mock-data/`.
3. Filters/toggles run **in the browser** (signals / computed).

| Page | Service | Mock / storage |
|------|---------|----------------|
| Login | `AuthService` | Nest `POST /api/auth/login` + `localStorage` token |
| Dashboard | `DashboardService` | `dashboard-attendance.json` |
| Students | `StudentService` | **Nest live** `GET/POST /api/students`, `PATCH /api/students/:id/access` (admin) |
| Attendance | `AttendanceService` | `attendance-records.json` |
| Locations | `LocationService` | `locations.json` + attendance/students for detail people |
| Sessions | `SessionService` | Nest `/api/sessions` + `/api/locations` (Bearer token) |
| Student scan | `StudentAttendanceService` | Nest open sessions + submit + me |

Backend today: auth login, locations list, sessions/QR, student attendance submit,
and the student directory/accounts API are live. Dashboard/attendance/locations
admin pages still use mock JSON.

## How to explain the product to someone new

1. Start at **login** — admin/teacher use the seeded accounts; students use the
   personal account their admin created (only Chihea is pre-seeded).
2. **Admin** lands on **Dashboard** → sidebar includes Students, Attendance, Locations, Sessions, Reports.
3. **Teacher** lands on **Dashboard** → same shell **without Students**; primary live work is **Sessions** (QR).
4. **Student** lands on **Scan** → sees same live QR as teacher → **Mark me present**.
5. Everything protected by **auth + role**; wrong role never stays on the wrong shell.

## When implementing new navigation

1. Add path constants in `core/constants/app-routes.ts` (and nav item in `admin-navigation.ts` if admin).
2. Register route under the correct shell in `app.routes.ts` (admin children vs `student` / `auth`).
3. Apply `roleGuard` if the page is role-restricted.
4. Prefer **sidebar or explicit router links** over hidden redirects unless fixing auth.
5. Update `references/page-flows.md` and this skill’s page graph.

## Related skills

| Skill | Use for |
|-------|---------|
| **`smart-campus-dev`** | File placement and coding conventions |
| **`smart-campus-teacher`** | Teacher-only capabilities, Sessions/QR loop, restrictions |
| **`smart-campus-student`** | Student accounts, provisioning, login control, scan flow |

## Teacher role (short)

Teachers share the admin shell but **cannot** open `/students`. Their primary
live workflow is **`/sessions`** (create session dialog → short-lived QR → close).

Full teacher map: **`smart-campus-teacher`** + `references/teacher-workflow.md`.
