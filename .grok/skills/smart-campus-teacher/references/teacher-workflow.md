# Teacher workflow — detailed reference

Last aligned with live Sessions API + Sessions page UI (create / QR / close /
**delete**, **due time**, location + opened display formats).

## 1. Entry

| Step | Detail |
|------|--------|
| URL | `http://localhost:4200/auth/login` |
| Demo | Enter `teacher@smartcampus.edu` / `teacher123` (no demo chips) |
| API | `POST http://localhost:3000/api/auth/login` |
| Redirect | `/dashboard` (`homePathForRole('teacher')`) |
| Shell | `AdminLayoutComponent` + filtered sidebar |

Both **frontend** and **backend** must run for Sessions; other pages work offline with mock data.

## 2. Page-by-page teacher map

```text
/auth/login
    │ success (teacher)
    ▼
/dashboard ────────────────────────────── mock metrics, chart, recent scans
    │ sidebar
    ├─► /attendance ───────────────────── mock attendance records + filters
    ├─► /locations ────────────────────── mock campus zones + detail dialog
    ├─► /sessions  ────────────────────── LIVE create / QR / close / delete  ★ primary
    ├─► /reports   ────────────────────── placeholder title only
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
  - dueTime (any clock time today, including already passed)
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
  - "Show QR"  → load / refresh Live QR panel
  - "Close"    → POST /api/sessions/:id/close
                 → status Closed, QR cleared; row stays in log
                 → students no longer see this session as open
  - "Delete"   → DELETE /api/sessions/:id
                 → cascade-delete attendance_records for session_id
                 → row removed from table + sessions store
                 → Live QR cleared if that session was selected
                 → student My attendance drops those rows (on refresh / poll)
  │
  │  Closed rows only expose "Delete"
  ▼
DELETE permanently removes the session + its attendance history
```

### Due time vs Close vs QR TTL

| Timer / action | Who sets it | Student effect |
|----------------|-------------|----------------|
| **Due time** (`dueAt`) | Teacher at create (any clock time today) | After due: cannot mark/scan (dialog); card **stays** until Close |
| **Close session** | Teacher ⋮ Close | Session leaves `GET /api/sessions/open` → gone from student UI |
| **QR token TTL** (~300s) | System auto-rotate | Old QR payload fails; new live token still works while Open and before due |

There is **no** “Late after (minutes)” field anymore.

### Session log table (UI)

| Column | Display |
|--------|---------|
| Session | Title + session id |
| Location | `Building A-Room 201` (`formatCampusLocationLabel`) |
| Teacher | Teacher name |
| Opened | `8-8-26/6:32Pm` (`formatSessionOpened`) |
| Due | `7:30Pm` (`formatSessionDue`) — student mark-present cutoff |
| Status | Open / Closed badge |
| Actions | ⋮ menu — Show QR / Close / Delete (by status) |

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

### Attendance records (review only today)

```text
/attendance → filter by session/status/date → export button (UI only; mock data)
```

### Locations browse

```text
/locations → filter zones → select row → detail dialog → close
```

Used for **understanding** geofence zones; session create uses **API** Active locations, not this mock list’s edit tools.

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
| Open `/dashboard`, `/attendance`, `/locations`, `/sessions`, `/reports` | Allowed |
| Open `/students` | Redirect to `/dashboard` |
| Open `/student/scan` | Redirect to `/dashboard` (not student) |
| Visit `/auth/login` while logged in | Redirect to `/dashboard` |
| Call sessions APIs without token | 401 |
| Call sessions APIs as student | 403 |

## 6. Data ownership rules (backend)

- Create: `teacherId` = authenticated user id; `teacherName` from user profile.  
- List: teacher sees only sessions where `teacherId === actor.userId`.  
- QR / close / **delete**: only owner or admin.  
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
| Sessions + QR + delete | `modules/sessions/sessions.service.ts` |
| Roles on controller | `modules/sessions/sessions.controller.ts` |
| Locations seed | `modules/locations/data/locations.seed.ts` |
| Guards | `common/guards/auth.guard.ts`, `roles.guard.ts` |

### Sessions API surface (teacher/admin)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/sessions` | Create open session (`title`, `locationId`, `dueAt` ISO) |
| `GET` | `/api/sessions` | List (own for teacher) |
| `GET` | `/api/sessions/:id/qr` | Current short-lived QR |
| `POST` | `/api/sessions/:id/close` | Close (keep row) |
| `DELETE` | `/api/sessions/:id` | Permanently remove session |

## 9. Sequence: teacher blocked from Students

```text
Teacher session
  → sidebar omits Students
  → manual URL /students
  → roleGuard(['admin']) fails
  → homePathForRole('teacher') → /dashboard
```

## 10. Checklist: “Is teacher ready for Review 0 demo?”

- [x] Login as teacher via API  
- [x] Create session with location + **due time** (dropdown `Building A-Room 201`)  
- [x] Display short-lived QR + Due on QR panel / table  
- [x] Close session / stop QR (also drops from student open list; history kept)  
- [x] Delete session (row + cascade attendance records for that sessionId)  
- [x] Opened / Due columns (`M-D-YY/h:mmPm`, `h:mmPm`)  
- [x] Student mark before due → Present; after due → blocked (dialog), card kept  

- [ ] Server-side location validation on submit (next phase)  
- [ ] Live attendance table from real scans (next phase)  
