# Smart Campus API

NestJS backend for the attendance-first Smart Campus application.

## Structure

```text
src/
├── common/       # Cross-module constants, types, and pure utilities
├── config/       # Namespaced application, database, and token configuration
├── database/     # Future TypeORM data source, migrations, and seeders
├── modules/      # Feature-owned Nest modules
├── app.module.ts
├── app.setup.ts  # Shared HTTP prefix, CORS, and validation setup
└── main.ts
```

Feature modules use this convention:

```text
modules/<feature>/
├── dto/                         # Only when the feature owns request/response contracts
├── <feature>.controller.ts      # HTTP boundary
├── <feature>.service.ts         # Feature/application logic
└── <feature>.module.ts          # Nest dependency boundary
```

The registered modules are `auth`, `users`, `students`, `dashboard`,
`attendance`, `locations`, `sessions`, and `reports`. Only demo authentication
has runtime feature behavior in this phase. Empty controllers intentionally do
not expose placeholder endpoints.

## API

- Base path: `/api`
- Working endpoint: `POST /api/auth/login`
- Angular dev uses relative `/api` via `frontend/proxy.conf.json` → `http://127.0.0.1:3000`
- Dev CORS also allows private LAN origins so phone/LAN testing survives Wi‑Fi IP changes

## Commands

Run from the repository root:

```bash
npm run backend:start
npm run backend:build
npm run backend:test
npm --prefix backend run test:e2e
```

TypeORM entities and migrations should be added with the feature that first
uses them; do not create empty `entities/` directories.
