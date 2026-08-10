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

From the repo root (two terminals):

```bash
# Terminal 1 — Nest API on port 3000
npm run backend:start

# Terminal 2 — Angular on 0.0.0.0:4200 with /api proxy → 127.0.0.1:3000
npm run frontend:start
```

Then open **http://localhost:4200** for laptop login. API calls use relative
`/api` and are proxied by the Angular dev server, so they no longer depend on
a fixed Wi‑Fi IP.

### Phone QR / student scan on campus Wi‑Fi

1. Find your Mac LAN IP (System Settings → Network, or `ipconfig getifaddr en0`).
2. Open the **teacher** app as `http://<lan-ip>:4200` (not localhost) when showing
   the QR — the code encodes the current browser origin so phones can open it.
3. Phone and laptop must be on the same Wi‑Fi; Mac firewall must allow ports
   4200 (and 3000 only if you call the API without the proxy).

Optional: set `appBaseUrl` in `frontend/src/environments/environment.development.ts`
to a fixed `http://<lan-ip>:4200` only if you must browse via localhost but still
need phone-reachable QR links.
