# Teacher workflow — detailed reference

Last aligned with live Sessions API + Sessions page UI (create / QR / **edit** /
close / **delete**, **due time**, location + opened display formats).

## 1. Entry

| Step | Detail |
|------|--------|
| URL | `http://localhost:4200/auth/login` |
| Demo | Enter `teacher@smartcampus.edu` / `teacher123` (no demo chips) |
| API | `POST http://localhost:3000/api/auth/login` |
| Redirect | `/dashboard` (`homePathForRole('teacher')`) |
| Shell | `AdminLayoutComponent` + filtered sidebar |

Both **frontend** and **backend** must run for Sessions and Locations.

## 2. Page-by-page teacher map

```text
/auth/login
    │ success (teacher)
    ▼
/dashboard ────────────────────────────── mock metrics, chart, recent scans
    │ sidebar
    ├─► /attendance ───────────────────── live Present + Absent (own sessions)
    ├─► /locations ────────────────────── live student visit log (zone + scan GPS)
    ├─► /sessions  ────────────────────── LIVE create / QR / edit / close / delete  ★ primary
    ├─► /reports   ────────────────────── BLOCKED (admin placeholder; use Export)
    └─► /students  ────────────────────── BLOCKED (guard → /dashboard)
```

## 3. Primary happy path: run a class session

```text
Teacher on /sessions
  │
  │  [Right card: Open attendance]
  │  click "Create session"
  ▼
Dialog opens
  - title (e.g. SE401 · Morning Lecture)
  - locationId — dropdown labels use Building A-Room 201 format
    (Active locations from GET /api/locations)
  - dueDate + dueTime (any calendar day and clock time, including already passed
    or tomorrow)
    → frontend builds dueAt ISO. Students can mark present only before dueAt.
  │
  │  submit "Create & show QR"
  ▼
POST /api/sessions { title, locationId, dueAt }
  → session status Open + dueAt stored
  → left panel shows QR image + Due time + Wi‑Fi scan link + payload
     (QR encodes https://<lan-ip>:4200/student/scan?payload=… via GET /api/runtime/scan-origin)
  → row appears in Session log (Opened + Due columns)
  → UI refreshes QR ~every 30s via GET /api/sessions/:id/qr
  │
  │  Students open /student/scan → same live open sessions + QR
  │  → Before due: Mark me present → Present
  │  → After due: card still listed; mark/scan → confirm dialog (blocked)
  │  → Only teacher Close removes session from student open list
  ▼
Table ⋮ Actions on an Open row:
  - "Show QR"       → load / refresh Live QR panel
  - "Edit session"  → POST /api/sessions/:id/edit
                      { title, locationId }
                      → dialog prefilled with title + location; Due is hidden
                      → dueAt stays as created (does not use POST /api/sessions)
                      → QR token and Open/Closed status unchanged
  - "Close"         → POST /api/sessions/:id/close
                      → status Closed, QR cleared; row stays in log
                      → students no longer see this session as open
  - "Delete"        → DELETE /api/sessions/:id
                      → cascade-delete attendance_records for session_id
                      → row removed from table + sessions store
                      → Live QR cleared if that session was selected
                      → student My attendance drops those rows (on refresh / poll)
  │
  │  Closed rows expose "Edit session" and "Delete"
  ▼
DELETE permanently removes the session + its attendance history
```

### Due time vs Close vs QR TTL

| Timer / action | Who sets it | Student effect |
|----------------|-------------|----------------|
| **Due time** (`dueAt`) | Teacher at **create** only (any date + clock time) | After due: cannot mark/scan (dialog); card **stays** until Close. Edit cannot move due. |
| **Close session** | Teacher ⋮ Close | Session leaves `GET /api/sessions/open` → gone from student UI |
| **QR token TTL** (~300s) | System auto-rotate | Old QR payload fails; new live token still works while Open and before due |

There is **no** “Late after (minutes)” field anymore.

### Session log table (UI)

| Column | Display |
|--------|---------|
| Session | Title + session id |
| Location | `Building A-Room 201` (`formatCampusLocationLabel`) |
| Teacher | Teacher name |
| Opened | `8-16-26-11:04Pm` (`formatSessionOpened`) |
| Due | `8-16-26-11:04Pm` (`formatSessionDue`) — student mark-present cutoff |
| Status | Open / Closed badge |
| Actions | ⋮ menu — Show QR / Edit session / Close / Delete (by status) |

### QR payload format

```text
SMARTCAMPUS|<sessionId>|<token>
```

Example: `SMARTCAMPUS|sess-63608b870d1c|3e35183cb7bb6b0cfcc387a0129cda78`

## 4. Secondary paths

### Dashboard review

```text
/dashboard → view Present / Late / Outside summary (mock) → sidebar to Attendance or Sessions
```

### Attendance records (live)

```text
/attendance → POST /api/attendance/admin
     { search?, sessionId?, status?: inside|outside, attendanceStatus?: Present|Absent, date? }
  → dropdowns (Status, Attendance status, Date) and session picker apply immediately — no Apply button
  → before due: only students who scanned (Present / Outside Location)
  → after due: those scanners + Absent for login-account students who never scanned
  → column Attendance status: Present | Absent
  → metrics: Present · Outside Location · Absent
  → teacher sees only own sessions
  → Export → POST /api/attendance/admin/excel (same filters) → .xlsx download
```

### Locations browse (student visit log)

```text
/locations → POST /api/locations/visits {}
  → empty until a student scans QR or marks present
  → Building / Status dropdowns apply immediately — no Apply button
       → POST /api/locations/visits { search?, building?, status? }
  → Export → POST /api/locations/visits/excel (same filters) → .xlsx download
  → table: Student · Session · Location (assigned zone) · Building
       · Scanned at (place name + GPS) · Distance · Status · Recorded
```

The page lists **visits**, not the 8 seeded zones. Session create still uses
`GET /api/locations` (Active catalog). Teachers only see visits from their
own sessions.

### Edit session details

```text
/sessions → ⋮ on a row → Edit session
  → dialog prefilled with title and campus location (Due is hidden)
  → Save changes → POST /api/sessions/:id/edit { title, locationId }
  → dueAt is create-only and stays on the original day
  → does not call POST /api/sessions (create)
  → QR token, openedAt, teacher, and Open/Closed status stay the same
  → Open sessions that change location transfer the location usage counter
```

### Delete a mistaken or finished session

```text
/sessions → ⋮ on any row → Delete (confirm dialog)
  → DELETE /api/sessions/:id
  → attendance_records WHERE session_id = :id deleted first (cascade)
  → session row removed
  → open sessions also release location usage counter
  → student GET /api/attendance/me no longer returns those rows
     (also self-heals any older orphan rows whose session is gone)
```

Close vs Delete:

| Action | API | Session log | Student open cards | Student My attendance |
|--------|-----|-------------|--------------------|------------------------|
| Close | `POST …/close` | Stays (Closed) | Gone | **Kept** |
| Delete | `DELETE …/:id` | **Removed** | Gone | **Removed** (cascade by `sessionId`) |

### Sign out

```text
Sidebar footer "Sign out" → AuthService.logout() → /auth/login
```

## 5. Guard behavior for teachers

| Action | Result |
|--------|--------|
| Open `/dashboard`, `/attendance`, `/locations`, `/sessions` | Allowed |
| Open `/students` or `/reports` | Redirect to `/dashboard` |
| Open `/student/scan` | Redirect to `/dashboard` (not student) |
| Visit `/auth/login` while logged in | Redirect to `/dashboard` |
| Call sessions APIs without token | 401 |
| Call sessions APIs as student | 403 |

## 6. Data ownership rules (backend)

- Create: `teacherId` = authenticated user id; `teacherName` from user profile.  
- List: teacher sees only sessions where `teacherId === actor.userId`.  
- QR / **edit** / close / **delete**: only owner or admin.  
- Locations seed is shared; only **Active** locations host sessions.  
- Delete of an **Open** session decrements that location’s `sessionsUsing` counter (same as close).  
- Sessions persist via TypeORM; do not assume a Nest restart always wipes them.

## 7. Key frontend files (teacher)

| Concern | Path |
|---------|------|
| Login | `features/auth/pages/login/` |
| Auth + token | `services/auth.service.ts` |
| Sessions UI shell | `features/sessions/pages/sessions/sessions.component.*` |
| Sessions state / flow | `sessions.state.ts`, `sessions.flow.ts` |
| Sessions API client | `services/session.service.ts` |
| Session models | `models/session.model.ts` |
| Opened / due formats | `core/utils/date.util.ts` → `formatSessionOpened`, `formatSessionDue` |
| Location label format | `core/utils/format.util.ts` → `formatCampusLocationLabel` |
| Nav filter | `layouts/admin-layout/admin-layout.component.ts` |
| Routes | `app.routes.ts`, `routes/sessions.routes.ts` |

## 8. Key backend files (teacher)

| Concern | Path |
|---------|------|
| Login | `modules/auth/auth.service.ts` |
| Sessions + QR + edit + delete | `modules/sessions/sessions.service.ts` |
| Roles on controller | `modules/sessions/sessions.controller.ts` |
| Locations seed | `modules/locations/data/locations.seed.ts` |
| Guards | `common/guards/auth.guard.ts`, `roles.guard.ts` |

### Sessions API surface (teacher/admin)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/locations` | Campus zone directory (session create) |
| `POST` | `/api/locations/visits` | Student visit log + API filters (own sessions) |
| `POST` | `/api/locations/visits/excel` | Visit log `.xlsx` (same filters, ExcelJS) |
| `POST` | `/api/attendance/admin/excel` | Attendance log `.xlsx` (same filters as `/admin`) |
| `POST` | `/api/sessions` | Create open session (`title`, `locationId`, `dueAt` ISO) |
| `GET` | `/api/sessions` | List (own for teacher) |
| `GET` | `/api/sessions/:id/qr` | Current short-lived QR |
| `POST` | `/api/sessions/:id/edit` | Edit title and location (dueAt frozen; does not rotate QR) |
| `POST` | `/api/sessions/:id/close` | Close (keep row) |
| `DELETE` | `/api/sessions/:id` | Permanently remove session |

## 9. Sequence: teacher blocked from Students and Reports

```text
Teacher session
  → sidebar omits Students and Reports
  → manual URL /students or /reports
  → roleGuard(['admin']) fails
  → homePathForRole('teacher') → /dashboard
  → Excel export stays on /attendance and /locations
```

## 10. Checklist: “Is teacher ready for Review 0 demo?”

- [x] Login as teacher via API  
- [x] Create session with location + **due time** (dropdown `Building A-Room 201`)  
- [x] Edit session via `POST /api/sessions/:id/edit` (title, location; due frozen)  
- [x] Display short-lived QR + Due on QR panel / table  
- [x] Close session / stop QR (also drops from student open list; history kept)  
- [x] Delete session (row + cascade attendance records for that sessionId)  
- [x] Opened / Due columns (`M-D-YY-h:mmPm`)  
- [x] Student mark before due → Present; after due → blocked (dialog), card kept  

- [ ] Server-side location validation on submit (next phase)  
- [ ] Live attendance table from real scans (next phase)  
