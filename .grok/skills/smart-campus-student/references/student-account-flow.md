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
│  /student/scan → GET /api/sessions/open (all Open sessions + QR)    │
│  → card shows QR · Location · Due                                   │
│  → Before dueAt:                                                    │
│      tap “Mark me present” or Camera deep link                      │
│      → browser reads GPS (getCurrentCoordinates())                  │
│      → denied/unsupported/timeout: NO request sent — "Try again"    │
│        dialog opens instead (nothing recorded)                      │
│      → GPS fix obtained:                                            │
│         POST /api/attendance/submit { payload: SMARTCAMPUS|…,       │
│             latitude, longitude }                                   │
│         → identity = users.student_id from Bearer (NOT QR)          │
│         → backend also rejects (400) if coordinates are missing     │
│         → inside location radius → Present                          │
│         → outside location radius → Outside Location (recorded)     │
│      → history “My attendance”                                      │
│  → After dueAt (session still Open):                                │
│      card STAYS listed (“Due passed”)                               │
│      mark / QR scan → app-confirm-dialog (cannot mark present)      │
│      API also 403 if submit is forced                               │
│  → Teacher Close → open card gone; My attendance row KEPT           │
│  → Teacher Delete → open card gone; attendance rows CASCADE deleted │
│      GET /api/attendance/me also purges orphan rows                 │
│  → My attendance = shared app-table (Session · Location · Scanned   │
│      at · Recorded · Status); location label Building X-Room N      │
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
| `services/student-attendance.service.ts` | Open sessions, submit, my records |
| `features/attendance/pages/student-scan/*` | Scan UI; due dialog; **location-blocked dialog** (`state.locationBlocked` + "Try again"); history `app-table`; geofence submit (`buildSubmitRequest`) |
| `core/utils/geolocation.util.ts` | `getCurrentCoordinates()` — browser GPS, resolves `null` on deny/unsupported/timeout (flow treats `null` as a hard block, not a fallback) |
| `shared/components/table/*` | My attendance columns (Session · Location · Scanned at · Recorded · Status) |
| `shared/components/confirm-dialog/*` | Due blocked / delete confirm shell |
| `core/utils/date.util.ts` | `formatSessionDue`, `isSessionPastDue`, `formatSessionOpened` |
| `core/utils/format.util.ts` | `formatCampusLocationLabel` → `Building B-Room 105`; `formatScanCoordinates` |
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
| `modules/attendance/attendance.service.ts` | `requireCoordinates` (400 if lat/lng missing — hard gate) + `evaluateGeofence` — Haversine distance vs the session's location `radiusMeters` |
| `modules/attendance/dto/submit-attendance.dto.ts` | `latitude`/`longitude` (`@IsLatitude`/`@IsLongitude`); optional at DTO/format level, **required** by the service's business rule |
| `common/utils/geo.util.ts` | `haversineDistanceMeters` / `isWithinRadius` (pure, unit-tested) |

## 8. Manual test script (happy path)

1. Start backend + frontend (repo root): `npm run backend:start` / `npm run frontend:start:local`
2. Login as admin (`admin@smartcampus.edu` / `admin123`) → `/dashboard` → **Students**
3. Click **Add student account** → fill name/ID/email/class/year/password → Create
4. Table shows the new row, toggle **Active**
5. Open `/auth/student` in another browser/incognito → sign in as the new student
6. Redirects to `/student/scan` → open sessions show teacher's live QR → Mark present (before due)
   - Browser will prompt for location permission on first tap; **Allow** → within campus test
     coordinates records **Present** with a `distanceMeters` value
   - **Block/deny** (or if the browser has no geolocation support) → **no record is created** —
     a "Cannot mark present" dialog opens with **Try again** (re-prompts permission) / **Cancel**
     (closes, card stays untouched, nothing submitted)
7. After due time: session card remains; Mark present / QR opens due confirm dialog
8. Teacher closes session → card disappears; My attendance table still shows that scan
9. Teacher deletes session → that scan disappears from My attendance (cascade + me purge)
10. Back in admin → toggle the student's **Login access off** → student's next login → 403 message
11. Sign out from admin → try old demo students (`student@smartcampus.edu`/`student123`) → 401 (no such account)
