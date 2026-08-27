# Smart Campus Management System

This workspace contains two application projects:

- `frontend/` - Angular application for teacher (administration) and student user interfaces.
- `backend/` - NestJS API application for authentication and management modules.

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
- User identities and roles: `backend/src/modules/users`

The Nest API uses the `/api` prefix. The only implemented feature endpoint in
the current integration-ready scaffold is `POST /api/auth/login`; other
registered modules establish ownership boundaries for later API work.

## Development

From the repo root (two terminals):

```bash
# Terminal 1 — Nest API on port 3000
npm run backend:start

# Terminal 2 — Angular on 0.0.0.0:4200 with /api proxy → 127.0.0.1:3000
npm run frontend:start
```

Then open **https://localhost:4200** for laptop login (the dev server uses
HTTPS so phones can use GPS). Accept the local certificate warning once.
API calls use relative `/api` and are proxied to Nest.

### Phone QR / student scan (public URL)

Teacher QR images encode the **current site URL**:
`https://<your-app>/student/scan?payload=…` (or `environment.appBaseUrl` /
`PUBLIC_APP_URL` when set). Phones do **not** need the same Wi‑Fi as the
teacher laptop. They need internet (campus Wi‑Fi or mobile data) and **HTTPS**
so Safari can prompt for GPS.

1. Deploy (or open) the app on HTTPS. Create a session and show QR.
2. Phone Camera opens that HTTPS scan link.
3. Student signs in if needed → **Mark me present** → **Allow** location.

Local `https://localhost:4200` QR only works on that computer, not on a phone.
