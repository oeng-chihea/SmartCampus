# Smart Campus — Project Skills & Instructions

This folder holds **Grok skills** for the Smart Campus Attendance System. Skills teach the AI (and you) how the app is structured and how users move **from page to page**.

## What is in here

| Skill | Path | Purpose |
|-------|------|---------|
| **smart-campus-workflow** | `smart-campus-workflow/SKILL.md` | Page-to-page user flows by role (admin, teacher, student) |
| **smart-campus-teacher** | `smart-campus-teacher/SKILL.md` | Teacher role: Sessions create + **due time** / QR / close / delete |
| **smart-campus-student** | `smart-campus-student/SKILL.md` | Student accounts, scan flow, due-time dialog (keep past-due cards) |
| **smart-campus-dev** | `smart-campus-dev/SKILL.md` | Where to put code, routes, services, and mock data when building features |

### Reference docs (detailed maps)

| File | Contents |
|------|----------|
| `smart-campus-workflow/references/page-flows.md` | Full route map, guards, layouts, seeded accounts |
| `smart-campus-teacher/references/teacher-workflow.md` | Teacher happy path, session/QR/close/delete sequence, display formats, file index |
| `smart-campus-student/references/student-account-flow.md` | Student account provisioning, login control, scan sequence, test script |
| `smart-campus-dev/references/architecture.md` | Folder layout, feature modules, backend status |

---

## How you use these skills

### As a human (you)

1. **Learn the app flow** — open:
   - `.grok/skills/smart-campus-workflow/SKILL.md`
   - `.grok/skills/smart-campus-workflow/references/page-flows.md`
2. **Teacher-only duties** — open:
   - `.grok/skills/smart-campus-teacher/SKILL.md`
3. **Student accounts & scan flow** — open:
   - `.grok/skills/smart-campus-student/SKILL.md`
4. **Know where code lives** — open:
   - `.grok/skills/smart-campus-dev/SKILL.md`
5. **Run the app** (from repo root):

```bash
# Frontend (Angular) — http://127.0.0.1:4200
npm run frontend:start:local

# Backend (NestJS) — required for login + Sessions/QR
npm run backend:start
```

### With Grok (AI assistant)

- **Slash:** `/smart-campus-workflow`, `/smart-campus-teacher`, `/smart-campus-student`, or `/smart-campus-dev`
- **Ask in chat:** e.g. “What can a teacher do?” or “Teacher session QR flow”
- Grok auto-loads skills when your request matches the skill `description`.

---

## App at a glance

**Smart Campus** is an **attendance-first** campus system:

- **Frontend:** Angular (`frontend/`) — admin/teacher shell + student scan UI  
- **Backend:** NestJS (`backend/`) — live auth, students, sessions/QR/close/delete, attendance submit  
- **Data today:** login + sessions (+ delete) live; dashboard/attendance/locations pages still mostly **mock JSON**  
- **Auth today:** Nest login + Bearer token in `localStorage`

### Roles and home pages

| Role | After login | Main UI |
|------|-------------|---------|
| `admin` | `/dashboard` | Admin layout + full sidebar (includes Students) |
| `teacher` | `/dashboard` | Admin layout; **no** Students; **Sessions** is primary live work |
| `student` | `/student/scan` | Student scan page only |

### Seeded login accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@smartcampus.edu` | `admin123` |
| Teacher | `teacher@smartcampus.edu` | `teacher123` |
| Student (initial) | `chihea@smartcampus.edu` | `chihea123` |

Every other student account is created by an admin from **Students → Add student account**
(no shared demo student accounts). See `smart-campus-student/SKILL.md`.

---

## Page-to-page map (summary)

```text
                    ┌─────────────────┐
     not logged in  │  /auth/login    │
   ────────────────►│  (guest only)   │
                    └────────┬────────┘
                             │ login success (API)
              ┌──────────────┼──────────────────┐
              │              │                  │
         admin/teacher    student          invalid → stay on login
              │              │
              ▼              ▼
     ┌────────────────┐  ┌─────────────────┐
     │ AdminLayout    │  │ /student/scan   │
     │  /dashboard    │  │ (scan shell)    │
     │  /students *   │  │ Sign out → login│
     │  /attendance   │  └─────────────────┘
     │  /locations    │
     │  /sessions ★   │  ★ live create + due time + QR + close + delete
     │  /reports †    │
     │ Sign out → login
     └────────────────┘
     * admin only
     † placeholder

Student scan due rules:
  before due → Mark present → Present (+ My attendance app-table row)
  after due  → card stays; mark/QR → confirm dialog (blocked)
  teacher Close → open card gone; history KEPT
  teacher Delete → open card gone; history for that session REMOVED (cascade)
```

**Sidebar navigation (admin/teacher)** is defined in  
`frontend/src/app/core/constants/admin-navigation.ts` and wired in  
`AdminLayoutComponent` → `AdminSidebarComponent`.

---

## When to update these skills

Update the workflow skill when you:

- Add or rename a **route**
- Change **role guards** or home paths
- Ship a real page that was a **placeholder**
- Wire more frontend services to the **live API**

Update **smart-campus-teacher** when teacher permissions, Sessions UI (actions menu,
due time, display formats), QR/close/delete rules, or attendance cascade change.

Update **smart-campus-student** when account provisioning, login access control,
scan flow, due-time dialog, My attendance table, or delete-cascade history change.

Update the dev skill when folder conventions or feature structure change.

---

## Related project docs

- Root overview: `README.md`
- Implementation plans: `docs/superpowers/plans/`
