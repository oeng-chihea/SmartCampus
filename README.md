# Smart Campus Management System

This workspace contains two application projects:

- `frontend/` - Angular application for admin and student user interfaces.
- `backend/` - NestJS API application for authentication, management modules, and reporting.

## Project Structure

```text
smart-campus-system/
├── frontend/
│   └── src/app/
│       ├── core/
│       ├── shared/
│       ├── layouts/
│       ├── features/
│       └── models/
├── backend/
│   └── src/
│       ├── common/
│       ├── config/
│       ├── database/
│       └── modules/
└── docs/
```

## Feature Mapping

- Authentication: `frontend/src/app/features/auth`, `backend/src/modules/auth`
- Dashboard: `frontend/src/app/features/dashboard`, `backend/src/modules/dashboard`
- Student Management: `frontend/src/app/features/students`, `backend/src/modules/students`
- Attendance Management: `frontend/src/app/features/attendance`, `backend/src/modules/attendance`
- Campus Locations: `frontend/src/app/features/locations`, `backend/src/modules/locations`
- Attendance Sessions: `frontend/src/app/features/sessions`, `backend/src/modules/sessions`
- Report System: `frontend/src/app/features/reports`, `backend/src/modules/reports`
- User identities and roles: `backend/src/modules/users`

The Nest API uses the `/api` prefix. The only implemented feature endpoint in
the current integration-ready scaffold is `POST /api/auth/login`; other
registered modules establish ownership boundaries for later API work.

## Development

Run commands from each application folder:

```bash
cd frontend
npm start
```

```bash
cd backend
npm run start:dev
```
