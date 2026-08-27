---
name: smart-campus-workflow
description: >
  Explains Smart Campus page-to-page user workflow by role (teacher, student),
  route guards, layouts, and navigation. Use when the user asks how the app works,
  page flow, navigation, login redirect, roles, routes map, "from one page to another",
  or runs /smart-campus-workflow.
---

# Smart Campus — Page-to-Page Workflow

Use this skill whenever explaining or changing how users move through the app.
Read `references/page-flows.md` for the full route table and file map.

## Product intent

**Smart Campus Management System** is an **attendance-first** app:

- Staff (teachers) administer students, attendance, and campus locations.
- Students submit attendance via a scan/session-code flow **plus a live GPS
  geofence check** (FR-02) that is a **hard gate**: location permission is
  mandatory — deny/unsupported/timeout blocks the submit entirely (no record
  created; "Try again" dialog), while a granted fix outside the session's
  radius still records but as **Outside Location** instead of Present.
- Frontend is Angular; backend NestJS is live for login, dashboard, attendance,
  locations, sessions, and student scan. There is no Reports page; Excel export is on Attendance and Locations.

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
- `teacher` → `/dashboard`

## Page graph (how one page leads to the next)

### 1) Authentication shell

```text
/auth  (AuthLayoutComponent + guestGuard)
  └── /auth/login  → LoginComponent
        ├── success (teacher)       → /dashboard  (AdminLayout)
        ├── success (student)       → /student/scan
        └── failure                 → stay on login (error message)
```

- No demo chips on the login form — every student signs in with their **own
  account** (created by a teacher; only Chihea is pre-seeded). See
  `smart-campus-student/SKILL.md`.
- Session stored in `localStorage` key `smartcampus_auth_session`.

### 2) Admin / teacher shell (shared layout)

```text
'' path with AdminLayoutComponent
  canActivate: authGuard + roleGuard(['teacher'])
  children:
    /dashboard   → DashboardComponent      (summary, chart, recent scans)
    /students    → StudentsComponent       (create email + password accounts)
    /attendance  → AdminRecordsComponent   (records + filters)
    /locations   → LocationsComponent      (student visit log table)
    /sessions    → SessionsComponent       (create session, live QR, edit, close, delete)
    **           → redirect to dashboard
```

**Navigation between admin pages** is **sidebar links only** (no deep page-to-page wizards yet):

1. User is inside `AdminLayoutComponent` (sidebar + `router-outlet`).
2. Sidebar reads `ADMIN_NAVIGATION` (full staff nav, including Students; no Reports item).
3. Clicking a nav item `routerLink`s to that path; active state via `routerLinkActive`.
4. Content page loads inside the workspace; layout and session stay the same.
5. **Sign out** in sidebar footer → logout → `/auth/login`.
6. **Campus Voice** (teacher): SVG talking-person widget in the staff shell starts Gemini Live. Mouth and listen motion follow the live audio (no photo, video, or transcript bubble). It knows the teacher workflow (Dashboard → Students → Sessions QR → Attendance / Locations) and reads **every live field** on Dashboard, Students, Attendance, Locations, and Sessions: names, student IDs, buildings, rooms, distances, scanned-at places, due times, login access, dashboard cards, and the campus zone catalog. Speak English to ask who/where/how far, navigate, search, **filter the table only when asked**, show QR, export, or add a student account. Close session, delete session, and disable login still need confirmation. Wait until the teacher talks — no auto greeting.

| From | User action | To |
|------|-------------|-----|
| Any admin page | Sidebar → Dashboard | `/dashboard` |
| Dashboard | Review all | `/attendance` |
| Any teacher page | Sidebar → Students | `/students` (create email + password, toggle login) |
| Any admin page | Sidebar → Attendance | `/attendance` |
| Any admin page | Sidebar → Locations | `/locations` |
| Any admin page | Sidebar → Sessions | `/sessions` (live: create + due time / QR / edit / close / delete) |
| Sessions | Create session (title, location, due date + time) | Same page; dueAt ISO; QR auto-refreshes ~30s |
| Sessions | ⋮ → Edit session | Same page; `POST /api/sessions/:id/edit`; title / location only (due frozen) |
| Sessions | ⋮ → Close | Same page; Closed; students lose open card; history kept |
| Sessions | ⋮ → Delete | Same page; session removed; **attendance for that sessionId cascaded** |
| Locations | Change filters | Same page; `POST /api/locations/visits` (search, building, status). Building and status dropdowns apply immediately (no Apply button). |
| Locations | Export | Same page; `POST /api/locations/visits/excel` (same filters) → `.xlsx` download |
| Attendance | Export | Same page; `POST /api/attendance/admin/excel` (same filters) → `.xlsx` download |
| Students table | Toggle login / Add student account | Same page; toggles persist via `PATCH /api/students/:id/access`, creation via `POST /api/students` |
| Attendance | Change filters | Same page; `POST /api/attendance/admin` (search, session, **status** inside/outside, **attendanceStatus** Present/Absent, date). Dropdowns apply immediately (no Apply button). Before due: scanners only. After due: plus **Absent** for login-account students who never scanned. Export uses `POST /api/attendance/admin/excel` with the same body. |
| Any admin page | Sign out | `/auth/login` |

### 3) Student shell

```text
/student  (authGuard + roleGuard(['student']))
  └── /student/scan → StudentScanComponent
```

- No admin sidebar. Header shows student name / studentId + **Sign out**.
- Scan page is **live**: open sessions load the **same live QR** as the teacher
  (`GET /api/sessions/open`) → student taps **Mark me present**.
- **Due time:** after `dueAt`, card stays; mark/QR opens **`app-confirm-dialog`**
  (cannot mark present). Only teacher **Close** / **Delete** removes open cards.
- Successful mark before due → **Present** only (no Late-after minutes).
- **My attendance:** shared `app-table` (not a hero card); location `Building X-Room N`.
- **Delete cascade:** teacher Delete removes student history for that session; `GET /api/attendance/me` also drops orphans.
- **GPS / Outside Location validation is live** (FR-02) **and is a hard gate**:
  browser Geolocation API reads device coordinates before submit; if
  denied/unsupported/timed out, **no request is sent at all** — a "Cannot mark
  present / Try again" confirm dialog opens instead. When a fix is obtained,
  the server compares it to the session's location radius (Haversine) and
  records **Present** (inside) or **Outside Location** (outside, still
  recorded — not rejected). The backend independently rejects (400) any
  submit with no coordinates, so the rule holds even for direct API calls.
- No other student routes are registered yet (`student/history` constant exists but is unused).
- **Campus Voice** (student): the same SVG talking-person widget sits in the `/student/scan` workspace (like the staff shell) and auto-starts. It greets with one short Good morning / Good afternoon / Good evening line (Asia/Phnom_Penh) and does not tutorial the scan steps on that first turn. It knows the full campus loop and which live classes this student has **already recorded** vs **not yet recorded**. The student can say stop (or tap X / Stop voice) to end it.

| From | User action | To |
|------|-------------|-----|
| Login as student | Auto redirect | `/student/scan` |
| Student scan | Mark present **before** due | `POST …/submit` → Present; row in My attendance `app-table` |
| Student scan | Mark present / QR **after** due | Confirm dialog (blocked); card kept |
| Student scan | Teacher closed session | Open card gone; **history kept** |
| Student scan | Teacher deleted session | Open card gone; **history row removed** (cascade / me purge) |
| Student scan | Sign out | `/auth/login` |
| Student tries `/dashboard` etc. | `roleGuard` fails | Redirect to `/student/scan` |

## Guards (who can open which page)

| Guard | Rule | On fail |
|-------|------|---------|
| `authGuard` | Must have session | `/auth/login` |
| `guestGuard` | Must **not** have session | Role home |
| `roleGuard(roles)` | Role must be in list | Role home or login |

Special cases:

- **Students** cannot use teacher routes → sent to `/student/scan`.
- **Teachers** see the full staff sidebar including Students, and can create student email + password accounts. Reports is not a teacher page.

## Data flow on each page (current)

Live pages: **state** (signals) + **flow** (API) + thin component.

| Page | Service | Mock / storage |
|------|---------|----------------|
| Login | `AuthService` | Nest `POST /api/auth/login` + `localStorage` token |
| Dashboard | `DashboardService` | **Nest live** `GET /api/dashboard` (cards + 12-month check-in rate + recent 10 scans) |
| Students | `StudentService` | **Nest live** `GET/POST /api/students`, `PATCH /api/students/:id/access` (teacher) |
| Attendance | `AttendanceService` | **Nest live** `POST /api/attendance/admin` (Present + Absent; teachers: own sessions). Export: `POST /api/attendance/admin/excel` |
| Locations | `LocationService` | **Nest live** `POST /api/locations/visits` (visit log + API filters; includes student GPS). Export: `POST /api/locations/visits/excel`. Zone catalog `GET /api/locations` is for Sessions only. |
| Sessions | `SessionService` | Nest `/api/sessions` + `/api/locations` (Bearer token) |
| Campus Voice (teacher) | `VoiceLiveService` | Nest `POST /api/ai/live-token` → Gemini Live WebSocket. `POST /api/ai/campus-records` reads Dashboard, Students, Attendance, Locations (visits + zones), and Sessions in detail (names, buildings, distances, dues, login). Filter the table only when asked. SVG talking person in the staff shell; mouth follows live audio; no transcript bubble. Waits for the teacher to speak. |
| Campus Voice (student) | `VoiceLiveService` | Same live-token API (student role allowed). Auto-starts in the `/student/scan` workspace with one short time-of-day greeting (no button tutorial). Snapshot is **this student only** and labels each live class **already recorded** vs **not yet recorded**. Say **mark all** to mark every eligible live class in one call. Knows the full campus loop; stop/terminate on request. |
| Student scan | `StudentAttendanceService` | Nest open sessions + submit + me |

Backend today: auth login, dashboard, locations, sessions/QR, student attendance
submit, admin attendance, and the student directory/accounts API are live.
There is no Reports page; Excel export is on Attendance and Locations.

## How to explain the product to someone new

1. Start at **login** — teachers use the seeded Teacher Kim account; students use the
   personal account their teacher created (only Chihea is pre-seeded).
2. **Teacher** lands on **Dashboard** → sidebar includes Students, Attendance, Locations, Sessions. Primary live work is **Sessions** (QR); **Students** is where they create email + password accounts. Export lives on Attendance and Locations. There is no Reports page.
3. **Student** lands on **Scan** → sees same live QR as teacher → **Mark me present**
   (before due); after due, dialog blocks mark/scan until teacher closes the session.
4. Everything protected by **auth + role**; wrong role never stays on the wrong shell.

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

Teachers use the staff shell and **can** open `/students` (create email + password). Their primary
live workflow is **`/sessions`**: create session dialog (**title, location, due date + time**)
→ short-lived QR → **Edit session** (`POST /api/sessions/:id/edit`, title + location; due stays as created) → **Close**
(end class; drops student open list; history kept) and/or
**Delete** (remove log row + cascade attendance by `sessionId`).

Sessions table display: location `Building A-Room 201`, opened and due
`8-16-26-11:04Pm`.

Full teacher map: **`smart-campus-teacher`** + `references/teacher-workflow.md`.
