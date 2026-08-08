# Smart Campus — Student Account & Login Flow Reference

Last reviewed against the implemented account-provisioning flow (backend + frontend).

## 1. Flow overview

```text
┌─────────────────────────────────────────────────────────────────────┐
│ PROVISION (admin, one-time per student)                             │
│  Admin → /students → “Add student account”                          │
│    POST /api/students  { studentId, name, email, course, year,      │
│                           password }                                │
│    → creates `students` row (login_enabled = true, userId linked)   │
│      + `users` row (role=student, student_id = SC-xxxx)             │
└──────────────────────────────────┬──────────────────────────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ LOGIN (student)                                                     │
│  /auth/student → POST /api/auth/login { email, password }           │
│  → password verify (scrypt)                                         │
│  → if role=student: check students.login_enabled for their          │
│    student_id → false ⇒ 403 “This student account is disabled…”     │
│  → success ⇒ Bearer token (HMAC, no expiry) stored in               │
│    localStorage `smartcampus_auth_session`                          │
│  → redirect /student/scan                                           │
└──────────────────────────────────┬──────────────────────────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ SCAN (student)                                                      │
│  /student/scan → GET /api/sessions/open (same live QR as teacher)   │
│  → tap “Mark me present” or scan teacher QR / Camera deep link      │
│  → POST /api/attendance/submit { payload: SMARTCAMPUS|<sessionId>|<token> }
│  → server identity = users.student_id from Bearer token (NOT QR)    │
│  → Present | Late → history “My scans”                              │
└─────────────────────────────────────────────────────────────────────┘
```

## 2. Account provisioning details

### Where accounts come from (3 paths)

| Path | Endpoint | Notes |
|------|----------|-------|
| Admin Students page | `POST /api/students` (admin) | Body includes optional `password`; when present → profile **and** account created atomically |
| Generic account API | `POST /api/users` (admin) | Any role; for `student` role, `studentId` is required and the student **profile must already exist** (else 400) |
| Seeder | `demo.seeder.ts` | Seeds only admin, teacher, and Chihea (`u-chihea` / `SC-1001`) on boot; idempotent |

### What the admin form does (frontend)

- `student-form-card` → emits `CreateStudentRequest` → `StudentService.createStudent`
- Validation: backend DTO requires `studentId, name, email, course, year` +
  `password` min 6 chars; duplicate `studentId` or duplicate account email → 400/409
- After success the page reloads the directory and shows a success alert.

### Login toggle semantics

- `PATCH /api/students/:studentId/access` `{ loginEnabled: boolean }` (admin)
- Enabling login for a student **without** an account → 400 (UI disables the
  toggle and shows “No account” instead).
- Disabling login: student row stays, account stays — next login attempt gets 403.

## 3. Login enforcement (backend)

`backend/src/modules/auth/auth.service.ts` → `assertStudentLoginEnabled`:

```ts
if (user.role === USER_ROLES.student) {
  await this.assertStudentLoginEnabled(user.studentId);
}
```

- Looks up `students` by `users.student_id`.
- `students.loginEnabled === false` → `ForbiddenException`
  “This student account is disabled. Contact your administrator.”
- No profile row → login allowed (nothing to enforce; account creation always
  creates the profile, so this is an edge case).

`AuthModule` now imports `StudentsModule` for this lookup.

## 4. Directory API response shape

`GET /api/students` → array of:

```json
{
  "studentId": "SC-1001",
  "name": "Chihea",
  "email": "chihea@smartcampus.edu",
  "course": "SE401",
  "year": "Year 1",
  "attendanceRate": 100,
  "status": "Active",
  "loginEnabled": true,
  "hasAccount": true
}
```

`hasAccount` = `students.user_id` is set (frontend uses it to disable the toggle).

## 5. Seeded accounts (after this change)

| id | name | email | password | role | student_id |
|----|------|-------|----------|------|------------|
| `u-admin-1` | System Admin | `admin@smartcampus.edu` | `admin123` | admin | — |
| `u-teacher-1` | Teacher Kim | `teacher@smartcampus.edu` | `teacher123` | teacher | — |
| `u-chihea` | Chihea | `chihea@smartcampus.edu` | `chihea123` | student | `SC-1001` |

Legacy demo rows (`u-student-1..4`, profiles `SC-1024..1201`) are **deleted
automatically on boot** by `removeLegacyDemoStudents()` so existing dev
databases converge to the new state.

## 6. Frontend files index

| File | Role |
|------|------|
| `features/auth/pages/login/*` | No demo chips; plain email+password form |
| `services/auth.service.ts` | Login, session, `homePathForRole` (student → `/student/scan`) |
| `services/student.service.ts` | `listStudents`, `createStudent`, `setLoginEnabled`, `mapError` |
| `core/utils/student-stats.util.ts` | Pure `buildStudentMetrics` / `buildStudentFilters` (unit-tested) |
| `features/students/pages/students/*` | Directory page: metrics, filters, add-account form, toggles, alerts |
| `shared/components/student-form-card/*` | “Add student account” form (name, ID, email, class, year, password) |
| `shared/components/student-table/*` | Toggle disabled + “No account” when `hasAccount=false` |
| `models/student.model.ts` | `Student` (+ `hasAccount`) and `CreateStudentRequest` |
| `core/constants/api-endpoints.ts` | `students`, `studentAccess(studentId)` |

## 7. Backend files index

| File | Role |
|------|------|
| `modules/auth/auth.service.ts` | login + `assertStudentLoginEnabled` |
| `modules/auth/auth.module.ts` | now imports `StudentsModule` |
| `modules/students/students.service.ts` | `findAll`, `create` (profile+account), `setLoginEnabled`, `toResponse` |
| `modules/students/students.controller.ts` | `GET /students`, `POST /students`, `PATCH /students/:id/access` |
| `modules/students/dto/*` | `create-student.dto.ts`, `update-student-access.dto.ts`, `student-response.dto.ts` |
| `modules/users/users.service.ts` | `createUser` (any role; links student profiles, sets `loginEnabled=true`) |
| `modules/users/users.controller.ts` | `POST /users` (admin) |
| `modules/users/dto/create-user.dto.ts` | name, email, password (min 6), role, optional studentId |
| `database/seeders/demo.seeder.ts` | Chihea seed + legacy demo cleanup |

## 8. Manual test script (happy path)

1. Start backend + frontend (repo root): `npm run backend:start` / `npm run frontend:start:local`
2. Login as admin (`admin@smartcampus.edu` / `admin123`) → `/dashboard` → **Students**
3. Click **Add student account** → fill name/ID/email/class/year/password → Create
4. Table shows the new row, toggle **Active**
5. Open `/auth/student` in another browser/incognito → sign in as the new student
6. Redirects to `/student/scan` → open sessions show teacher's live QR → Mark present
7. Back in admin → toggle the student's **Login access off** → student's next login → 403 message
8. Sign out from admin → try old demo students (`student@smartcampus.edu`/`student123`) → 401 (no such account)
