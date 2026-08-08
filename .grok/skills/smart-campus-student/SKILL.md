---
name: smart-campus-student
description: >
  Student role: per-student login accounts, admin account provisioning, login access
  control, and the attendance scan flow. Use when the user asks about student login,
  student accounts, how students get credentials, creating student accounts, Chihea,
  login_enabled, disabled student accounts, student scan flow, or runs /smart-campus-student.
---

# Smart Campus — Student Role & Login Accounts

Use this skill when explaining or building **student account + scan** flows.
For all roles and routing, also load **`smart-campus-workflow`**. For code
placement, use **`smart-campus-dev`**.

Detailed steps: `references/student-account-flow.md`.

## Core rule: every student has their own account

There are **no shared demo student accounts** anymore. A student can log in only
when an admin has created a **personal login account** for them:

| Step | Who | What happens |
|------|-----|--------------|
| 1. Provision | Admin (`/students`) | “Add student account” form → creates student profile **and** login account (email + temporary password) |
| 2. Login | Student | `/auth/student` with own email + password |
| 3. Scan | Student | `/student/scan` → tap open session or scan teacher QR → attendance recorded under **their** identity |
| 4. Control | Admin | Toggle **Login access** on/off → disabled students get `403 Forbidden` at login |

Identity at scan time always comes from the **login token** (`users.student_id`),
never from the QR payload — a student can never record attendance as someone else.

## Initial seeded student

Only one student account is seeded (not demo data):

| Field | Value |
|-------|-------|
| Name | `Chihea` |
| Email | `chihea@smartcampus.edu` |
| Password | `chihea123` |
| studentId | `SC-1001` |
| Class / Year | `SE401` / `Year 1` |
| Home after login | `/student/scan` |

Admin / teacher seeded accounts stay unchanged:

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@smartcampus.edu` | `admin123` |
| Teacher | `teacher@smartcampus.edu` | `teacher123` |

## Student happy path (login → scan)

```text
Admin creates account (POST /api/students with password)
  → student signs in at /auth/student (POST /api/auth/login)
  → /student/scan
  → GET /api/sessions/open (same live QR as teacher)
  → tap “Mark me present” or scan QR / Camera deep link
  → POST /api/attendance/submit (identity from Bearer token)
  → Present | Late → history “My scans”
  → Sign out → /auth/student
```

## Login access control (login_enabled)

- Source of truth: `students.login_enabled` column (linked to the account via
  `students.user_id`).
- Enforced in `AuthService.login` (`backend/src/modules/auth/auth.service.ts`):
  student accounts whose profile has `loginEnabled = false` are rejected with
  **403** “This student account is disabled. Contact your administrator.”
- Admin toggles it from the Students page; the toggle is **disabled** in the UI
  for students that have **no account yet** (label “No account”).

## API endpoints

| Method | Path | Roles | Purpose |
|--------|------|-------|---------|
| `POST` | `/api/auth/login` | public | Login (enforces `login_enabled`) |
| `POST` | `/api/users` | admin | Create any account (student role requires an existing profile) |
| `GET` | `/api/students` | admin, teacher | Student directory (incl. `hasAccount`) |
| `POST` | `/api/students` | admin | Create student; `password` in body also creates the login account |
| `PATCH` | `/api/students/:studentId/access` | admin | Toggle `loginEnabled` |
| `GET` | `/api/sessions/open` | student+ | Live open sessions + QR |
| `POST` | `/api/attendance/submit` | student | Mark attendance (identity from token) |
| `GET` | `/api/attendance/me` | student | Own scan history |

## Key files

```text
backend/src/modules/auth/auth.service.ts      # login + assertStudentLoginEnabled
backend/src/modules/students/students.service.ts  # directory + create + access toggle
backend/src/modules/students/students.controller.ts
backend/src/modules/users/users.service.ts    # createUser (account provisioning)
backend/src/modules/users/users.controller.ts
backend/src/database/seeders/demo.seeder.ts   # seeds admin/teacher/Chihea; deletes legacy demo students

frontend/src/app/features/auth/pages/login/          # no demo chips anymore
frontend/src/app/services/auth.service.ts            # login, session, role paths
frontend/src/app/services/student.service.ts         # live /students API + error mapping
frontend/src/app/core/utils/student-stats.util.ts    # pure metrics/filters helpers
frontend/src/app/features/students/pages/students/   # directory + add-account form + toggles
frontend/src/app/shared/components/student-form-card/  # “Add student account” form
frontend/src/app/shared/components/student-table/      # login toggle (disabled when no account)
```

## What changed from the old demo flow

- Removed: 4 seeded student demo accounts (`student@smartcampus.edu` etc.) and
  their profiles — the seeder also **deletes leftover rows** on boot.
- Removed: demo account chips on the login page (`DEMO_ACCOUNTS`).
- Added: real student directory + account creation + login toggle wired to the
  Nest API (admin only). Students page is **live**, not mock JSON.

## Related skills

| Skill | Use for |
|-------|---------|
| `smart-campus-workflow` | All roles page graph |
| `smart-campus-dev` | File placement, Nest/Angular conventions |
| `smart-campus-teacher` | Teacher Sessions/QR loop (the other half of the scan flow) |
