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

## Demo account

| Field | Value |
|-------|--------|
| Email | `teacher@smartcampus.edu` |
| Password | `teacher123` |
| Role | `teacher` |
| Home after login | `/dashboard` |
| Layout | `AdminLayoutComponent` (same shell as admin) |

Login uses Nest `POST /api/auth/login` and stores Bearer token in
`localStorage` key `smartcampus_auth_session`.

## What a teacher **can** do (current product)

| Capability | Page / API | Data source |
|------------|------------|-------------|
| Sign in / sign out | `/auth/login`, sidebar | Live API login |
| View dashboard summary | `/dashboard` | Mock JSON |
| Review attendance records + filters | `/attendance` | Mock JSON |
| Browse campus locations + detail dialog | `/locations` | Mock JSON |
| **Create attendance session** (dialog) | `/sessions` | **Live API** |
| **Show short-lived QR** (auto-refresh ~30s) | `/sessions` | **Live API** |
| **Close session** (invalidates QR) | `/sessions` | **Live API** |
| List **own** sessions only | `GET /api/sessions` | Live API |
| Read active locations for session form | `GET /api/locations` | Live API |
| Open Reports placeholder | `/reports` | Placeholder UI |

### Teacher-owned secure attendance loop (core)

```text
Login as teacher
  → Dashboard (optional)
  → Sessions
  → Create session (dialog: title, location, late minutes)
  → Live QR on left (payload SMARTCAMPUS|sessionId|token)
  → Students see same live QR on /student/scan → Mark me present
  → Close session when class ends
  → Sign out
```

## What a teacher **cannot** do

| Restricted | How enforced |
|------------|----------------|
| Students management (`/students`) | Sidebar hidden + `roleGuard(['admin'])` |
| Admin-only user admin | No UI |
| Student scan page | `roleGuard(['admin','teacher'])` on admin shell; student routes require `student` |
| See other teachers’ sessions | Backend filters list by `teacherId` (admin sees all) |
| Issue QR for another teacher’s session | Backend `assertCanManage` |
| Create session without Active location | Backend rejects Inactive zones |

## Sidebar (teacher)

Same admin nav as admin, **except Students is hidden**:

1. Dashboard  
2. ~~Students~~ (hidden)  
3. Attendance  
4. Locations  
5. Sessions ← **primary live workflow**  
6. Reports (placeholder)

Defined in `admin-navigation.ts`; filtered in `AdminLayoutComponent` via
`adminOnlyPaths = ['/students']`.

## Backend permissions (teacher)

| Endpoint | Allowed |
|----------|---------|
| `POST /api/auth/login` | Yes |
| `GET /api/locations` | Yes |
| `POST /api/sessions` | Yes |
| `GET /api/sessions` | Yes (own sessions) |
| `GET /api/sessions/:id` | Yes (own / admin) |
| `GET /api/sessions/:id/qr` | Yes (own / admin) |
| `POST /api/sessions/:id/close` | Yes (own / admin) |
| Student attendance submit | Yes (`POST /api/attendance/submit`, student role) |

Requires `Authorization: Bearer <accessToken>`.

## UI notes for Sessions (teacher)

- **Left:** Live QR · Short-lived session code  
- **Right:** Open attendance → **Create session** button → dialog form  
- Not an always-visible create form  
- After create: QR shown, session row in table, **Show QR** / **Close** actions  

## Planned later (not teacher-capable yet)

- Live attendance feed on Sessions after student scan  
- GPS / Outside Location on student submit  
- Reports export  
- Editing/deleting closed sessions history in DB (sessions + scans are in-memory today)  

## When coding for teachers

1. Keep teacher on **AdminLayout** children; do not invent a separate teacher layout.  
2. Never grant `/students` without product decision.  
3. Session create / QR / close go through `SessionService` + Bearer token.  
4. Prefer dialogs for create forms (match Sessions + Locations detail).  
5. Update this skill + `smart-campus-workflow` when teacher routes change.  

## Related skills

| Skill | Use for |
|-------|---------|
| `smart-campus-workflow` | All roles page graph |
| `smart-campus-dev` | File placement, Nest/Angular conventions |
