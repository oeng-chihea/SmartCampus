# Teacher workflow — detailed reference

Last aligned with live Sessions API + Sessions page dialog UI.

## 1. Entry

| Step | Detail |
|------|--------|
| URL | `http://localhost:4200/auth/login` |
| Demo | Click **Teacher** chip or enter `teacher@smartcampus.edu` / `teacher123` |
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
    ├─► /sessions  ────────────────────── LIVE create / QR / close  ★ primary
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
  - locationId (Active locations from GET /api/locations)
  - lateAfterMinutes (default 15)
  │
  │  submit "Create & show QR"
  ▼
POST /api/sessions
  → session status Open
  → left panel shows QR image + payload
  → TTL 45s; UI refreshes QR ~every 30s via GET /api/sessions/:id/qr
  │
  │  Students open /student/scan → same live QR appears
  │  → Mark me present → POST /api/attendance/submit
  ▼
Optional: "Show QR" on table row for another open session
  │
  │  "Close" on open session
  ▼
POST /api/sessions/:id/close
  → status Closed, QR cleared
```

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

- Create: `teacherId` = authenticated user id; `teacherName` from demo user profile.  
- List: teacher sees only sessions where `teacherId === actor.userId`.  
- QR / close: only owner or admin.  
- Locations seed is shared; only **Active** locations host sessions.  
- In-memory store: **restarting Nest clears all sessions**.

## 7. Key frontend files (teacher)

| Concern | Path |
|---------|------|
| Login | `features/auth/pages/login/` |
| Auth + token | `services/auth.service.ts` |
| Sessions UI | `features/sessions/pages/sessions/` |
| Sessions API client | `services/session.service.ts` |
| Session models | `models/session.model.ts` |
| Nav filter | `layouts/admin-layout/admin-layout.component.ts` |
| Routes | `app.routes.ts`, `routes/sessions.routes.ts` |

## 8. Key backend files (teacher)

| Concern | Path |
|---------|------|
| Login | `modules/auth/auth.service.ts` |
| Sessions + QR | `modules/sessions/sessions.service.ts` |
| Roles on controller | `modules/sessions/sessions.controller.ts` |
| Locations seed | `modules/locations/data/locations.seed.ts` |
| Guards | `common/guards/auth.guard.ts`, `roles.guard.ts` |

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
- [x] Create session with location  
- [x] Display short-lived QR  
- [x] Close session / stop QR  
- [x] Student authenticated scan (payload submit → Present/Late)  
- [ ] Server-side location validation on submit (next phase)  
- [ ] Live attendance table from real scans (next phase)  
