# Smart Campus Management System

This workspace contains two application projects:

- `frontend/` - Angular application for teacher (administration) and student user interfaces.
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

Then open **https://localhost:4200** for laptop login (the dev server uses
HTTPS so phones can use GPS). Accept the local certificate warning once.
API calls use relative `/api` and are proxied to Nest.

### Phone QR / student scan on campus Wi‑Fi

Teacher QR images encode **`https://<Mac-Wi-Fi-IP>:4200`** automatically
(`GET /api/runtime/scan-origin`). iPhone Safari will not give GPS on plain
`http://` LAN URLs — HTTPS is required even if Location is set to Always.

1. From the **repo root** run `npm run frontend:start` (HTTPS, `0.0.0.0:4200`).
2. Mac and phone on the **same Wi‑Fi**. Allow port **4200** in the Mac firewall.
3. Open Sessions, create/show QR — the scan link should look like
   `https://192.168.x.x:4200/student/scan?payload=...`
4. Phone Camera opens that link. First time: Safari “Not Private” →
   **Advanced → visit this website**. If Safari still does not ask for
   location, install the local cert (Settings → Profile → Install, then
   General → About → Certificate Trust Settings).
5. Tap **Mark me present** → Safari **Allow** location → attendance submits.

Old `http://` QRs stay broken. Refresh / create a new session after the HTTPS
restart. If Wi‑Fi is disconnected the QR falls back to localhost.
