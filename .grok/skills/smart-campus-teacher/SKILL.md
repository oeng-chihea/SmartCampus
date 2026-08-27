---
name: smart-campus-teacher
description: >
  Teacher role capabilities, page workflow, sessions/QR duties, and what teachers
  cannot do in Smart Campus. Use when the user asks about teacher role, teacher
  workflow, teacher pages, teacher sessions, QR for class, Teacher Kim demo,
  what a teacher can do, or runs /smart-campus-teacher.
---

# Smart Campus — Teacher Role

Use this skill when explaining or building **teacher** flows. For all roles and
routing, also load **`smart-campus-workflow`**. For code placement, use
**`smart-campus-dev`**.

Detailed steps: `references/teacher-workflow.md`.

## Seeded account

| Field | Value |
|-------|--------|
| Email | `teacher@smartcampus.edu` |
| Password | `teacher123` |
| Role | `teacher` |
| Home after login | `/dashboard` |
| Layout | `AdminLayoutComponent` (staff shell; teacher is administration) |

Login uses Nest `POST /api/auth/login` and stores Bearer token in
`localStorage` key `smartcampus_auth_session`.

## What a teacher **can** do (current product)

| Capability | Page / API | Data source |
|------------|------------|-------------|
| Sign in / sign out | `/auth/teacher`, sidebar | Live API login |
| View dashboard summary | `/dashboard` | Live API |
| **Create student email + password** | `/students` | **Live API** `POST /api/students` |
| Toggle student login access | `/students` | **Live API** `PATCH /api/students/:id/access` |
| Review attendance records + filters | `/attendance` | **Live API** (own sessions; Present + Absent) |
| Export attendance Excel | `/attendance` | **Live API** `POST /api/attendance/admin/excel` |
| Review student location visits (assigned zone + scanned-at GPS) | `/locations` | **Live API** |
| Export location visits Excel | `/locations` | **Live API** `POST /api/locations/visits/excel` |
| **Create attendance session** (dialog) | `/sessions` | **Live API** |
| **Show short-lived QR** (auto-refresh ~30s; encodes the public HTTPS site URL) | `/sessions` | **Live API** |
| **Edit session** (title, location) | `/sessions` ⋮ menu | **Live API** |
| **Close session** (invalidates QR) | `/sessions` | **Live API** |
| **Delete session** (row + store + **cascade attendance**) | `/sessions` ⋮ menu | **Live API** |
| List **own** sessions only | `GET /api/sessions` | Live API |
| **Campus Voice** (SVG talking person; mouth follows live English audio; no transcript). Reads Dashboard / Students / Attendance / Locations / Sessions in detail (names, buildings, rooms, distances, dues, login) and knows the session→scan workflow | staff shell widget | Live API `POST /api/ai/live-token` + `POST /api/ai/campus-records` |
| Read active locations for session form | `GET /api/locations` | Live API |

### Teacher-owned secure attendance loop (core)

```text
Login as teacher
  → Dashboard (optional)
  → Sessions
  → Create session (dialog: title, location, due date + time)
  → Live QR on left (payload SMARTCAMPUS|sessionId|token)
  → Students see same live QR on /student/scan → Mark me present
       · Before dueAt → Present (or Outside Location)
       · After dueAt  → card stays visible; mark/scan blocked (confirm dialog)
  → /attendance (staff records)
       · Before dueAt → only students who scanned (Present / Outside Location)
       · After dueAt  → those scanners plus Absent for login-account students who never scanned
       · Attendance status Present = scanned on time; Absent = no scan by due time
  → Edit session (⋮ → Edit session) → POST /api/sessions/:id/edit
       (title and campus location only; dueAt stays as created;
       QR and status unchanged)
  → Close session when class ends → session leaves student open list
       (attendance history kept until Delete; Absents still wait until dueAt)
  → Delete session → removes log row **and** all student attendance for that sessionId
       (student “My attendance” table drops those rows on next load/refresh)
  → Sign out
```

### Session due time (replaces Late after)

| Concept | Meaning |
|---------|---------|
| **Due time** | Date + clock time set at **create** (`dueAt` ISO). Teacher may pick **any** calendar day and time (including already passed, or tomorrow). Students may mark present only **before** this instant. **Edit cannot change due** — that would move already-recorded attendance onto another day. |
| **After due** | Submit rejected (API 403). Session can stay **Open** until teacher **Close**. Students still see the card. |
| **Close session** | Status Closed; QR stops; session **removed** from student open list. |
| **QR TTL (300s)** | Short-lived QR **token** rotation only — not the same as due time. Do not show QR Expires on student UI. |
| **Late after** | **Removed** — no Present/Late split from minutes; accepted marks are always **Present**. |

## What a teacher **cannot** do

| Restricted | How enforced |
|------------|----------------|
| Student scan page | `roleGuard(['teacher'])` on staff shell; student routes require `student` |
| See other teachers’ sessions | Backend filters list by `teacherId` |
| Issue QR for another teacher’s session | Backend `assertCanManage` (owner only) |
| Create session without Active location | Backend rejects Inactive zones |
| Change session due after create | Edit dialog hides Due; `POST /api/sessions/:id/edit` accepts title + location only |
| Open a Reports page | Not in `ADMIN_NAVIGATION`; `/reports` redirects to `/dashboard` |

## Sidebar (teacher)

Full staff nav (teacher is administration):

1. Dashboard  
2. Students ← create email + password, toggle login  
3. Attendance (includes Excel export)  
4. Locations (includes Excel export)  
5. Sessions ← **primary live session workflow**

There is **no Reports** sidebar item or `/reports` page. Excel export is on Attendance and Locations.

Defined in `admin-navigation.ts`; shown in full on `AdminLayoutComponent`.

## Backend permissions (teacher)

| Endpoint | Allowed |
|----------|---------|
| `POST /api/auth/login` | Yes |
| `GET /api/locations` | Yes (session create catalog) |
| `POST /api/locations/visits` | Yes (own sessions' visits only) |
| `POST /api/sessions` | Yes |
| `GET /api/sessions` | Yes (own sessions) |
| `GET /api/students` | Yes (directory) |
| `POST /api/students` | Yes (profile + email/password login) |
| `PATCH /api/students/:id/access` | Yes (toggle login) |
| `POST /api/users` | Yes (teacher or student accounts) |
| `GET /api/sessions/:id` | Yes (own) |
| `GET /api/sessions/:id/qr` | Yes (own) |
| `POST /api/sessions/:id/edit` | Yes (own) — title, location; dueAt frozen |
| `POST /api/sessions/:id/close` | Yes (own) |
| `DELETE /api/sessions/:id` | Yes (own) — removes record |
| Student attendance submit | Yes (`POST /api/attendance/submit`, student role) |
| Admin/teacher attendance log | Yes (`POST /api/attendance/admin`; own sessions; Present + Absent) |
| Campus Voice token | Yes (`POST /api/ai/live-token`) — teacher waits for speech; student auto-greets |
| Campus Voice records | Yes (`GET/POST /api/ai/campus-records`; own sessions; names, buildings, distances, dues, login, dashboard, zone catalog; unfiltered unless asked). Students hitting the same route only receive their own open classes and scans. |

Requires `Authorization: Bearer <accessToken>`.

## UI notes for Sessions (teacher)

- **Left:** Live QR · Short-lived session code · **Scan link** (public site URL, e.g. `https://your-app.onrender.com/student/scan?payload=…`) · **Due** date+time for selected session  
- **Right:** Open attendance → **Create session** button → dialog form  
- Create form fields: **title**, **location**, **due** (`type="date"` + `type="time"`, required, any calendar day — no “must be in the future” check)  
- Edit form fields: **title**, **location** only — Due is hidden (create-only)  
- Not an always-visible create form  
- Session log table (`app-table`) columns: Session · Location · Teacher · Opened · **Due** · Status · Actions  
- **Actions (⋮ menu):**  
  - Open row → **Show QR**, **Edit session**, **Close**, **Delete**  
  - Closed row → **Edit session**, **Delete**  
- **Delete** (`DELETE /api/sessions/:id`):
  1. Deletes all `attendance_records` with that `session_id`
  2. Removes the session row
  3. Decrements location usage if it was Open  
  → Student **My attendance** no longer shows those scans (cascade + `GET /api/attendance/me` also purges orphans)  
  → Clears Live QR if that session was selected  
- **Close** only ends the session (status Closed; QR no longer issued) — row stays in the log until Delete; students stop seeing it on open list; **attendance history kept** until Delete  

| Action | Session log | Student open cards | Student My attendance |
|--------|-------------|--------------------|------------------------|
| Close | Stays (Closed) | Removed | **Kept** |
| Delete | Removed | Removed | **Removed** (cascade by `sessionId`) |

### Display formats (Sessions page)

| Field | Format | Example |
|-------|--------|---------|
| Opened | `M-D-YY-h:mmAm\|Pm` (no leading zeros; hyphen before time; `Pm`/`Am` suffix) | `8-16-26-11:04Pm` |
| Due | Same stamp as Opened (date + time) | `8-16-26-11:04Pm` |
| Location (table + QR panel) | `Building-Room N` | `Building A-Room 201` |
| Campus location (create dialog dropdown) | same | `Building A-Room 201` |

Helpers: `formatSessionOpened`, `formatSessionDue` (`core/utils/date.util.ts`), `formatCampusLocationLabel` (`core/utils/format.util.ts`).

## Planned later (not teacher-capable yet)

- Live attendance feed on Sessions after student scan

GPS / Outside Location on student submit is **live** (FR-02) — see
`smart-campus-student/SKILL.md` and `smart-campus-dev/references/architecture.md`.

## When coding for teachers

1. Keep teacher on **AdminLayout** children; do not invent a separate teacher layout.  
2. Teacher is campus administration — `/students` (email + password) stays on this role. Do not add a Reports sidebar item or `/reports` page.  
3. Session create / QR / **edit** / close / **delete** go through `SessionService` + Bearer token.  
4. Prefer dialogs for create / edit forms (match Sessions).  
5. Keep Sessions display formats via the shared helpers above (do not reintroduce locale `short` dates or `, Room ` labels on this page).  
6. Update this skill + `smart-campus-workflow` when teacher routes or Sessions actions change.  

## Related skills

| Skill | Use for |
|-------|---------|
| `smart-campus-workflow` | All roles page graph |
| `smart-campus-student` | Student login accounts + scan flow (other half of the loop) |
| `smart-campus-dev` | File placement, Nest/Angular conventions |
