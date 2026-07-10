# Project Structure

## Overview

**SMB Infrastructure Dashboard** is a self-hosted application for small and midsize
businesses to inventory infrastructure assets (servers, VMs, storage, network devices,
services, ports) and visualize how they relate to each other. See `.aidd/spec.md` for the
full product definition.

The application is derived from the **Spernakit v3 template** — a Bun-native, self-hosted,
multi-user admin platform. As of onboarding (Session 1, 2026-07-03) the codebase is the
**stock template**: the auth/RBAC/workspace/notification/dashboard foundation is fully
implemented, but **none of the SMB Infrastructure domain (assets, relationships, services,
ports, imports) has been built yet**. All 25 backlog features are `passes: false`.

Primary constraints: SQLite by default (data under `data/`), JSON-only config (no `.env`),
versioned REST under `/api/v1`, 5-tier RBAC (SYSOP > ADMIN > MANAGER > OPERATOR > VIEWER),
and `bun run smoke:qc` as the mandatory quality gate.

## Repository Layout

```
smb-infrastructure-dashboard/
├── backend/          # Bun + Elysia API, Drizzle ORM, TypeBox validation
├── frontend/         # React 19 + Vite + React Router + TanStack Query + Zustand + shadcn/ui
├── shared/           # spernakit-shared: zero-runtime-dep canonical types & pure functions
├── scripts/          # Build, check, crawltest, smoke, start/stop, dev tooling (bun .ts)
├── config/           # JSON-only config (validated with Zod, merged with defaults.json)
├── data/             # SQLite database files (default persistence)
├── docs/             # Template docs (STACK.md, DEVELOPMENT.md, etc.)
├── docker/ + Dockerfile + docker-compose*.yml   # Container deployment
├── .aidd/            # AIDD SDLC tracking (spec, features, changelog, todo)
└── .githooks/        # Pre-commit hooks (smoke:qc, lint, format)
```

## Backend Layout (backend/src/)

```
backend/src/
├── app.ts                 # App entry
├── create-api-app.ts      # Elysia app assembly
├── config/                # Config loading/validation
├── constants/
├── db/
│   ├── schema/            # Drizzle table definitions (index.ts aggregates)
│   ├── autoMigrate.ts     # Applies pending migrations on startup (SQLite)
│   └── autoSeed.ts        # Seeds default accounts when users table is empty
├── guards/                # Auth, role, workspaceAccess, passwordChange guards
├── plugins/               # Elysia plugins (workspace, etc.)
├── routes/                # Versioned REST route modules under /api/v1
├── schemas/               # TypeBox route validation schemas
├── services/              # Domain services (facade + services/{domain}/ subdirs)
├── storage/               # File storage abstraction (local FS / S3)
└── utils/
```

Existing schema tables (template foundation only): users, workspaces, notifications,
audit_logs, api_keys, file_uploads, health_checks, scheduled_tasks, settings, dashboards,
business_events, bug_reports, mfa_settings, oauth_accounts, and supporting auth tables.
**No `assets*`, `service_catalog`, `asset_ports`, or relationship tables exist yet.**

## Frontend Layout (frontend/src/)

```
frontend/src/
├── App.tsx / main.tsx
├── routes.tsx / routes/     # Route definitions
├── pages/                   # analytics, auth, dashboard, dashboards, errors, files,
│                            #   notifications, onboarding, profile, settings, workspaces
├── components/              # Shared UI incl. layout/AppShell.tsx (super-theme shells)
├── hooks/
├── api/                     # Typed API client
├── stores/                  # Zustand stores
├── lib/ utils/ types/ styles/
```

**No `assets` / `infrastructure` pages exist yet.**

## Technology Stack

### Backend

- **Runtime**: Bun
- **Framework**: Elysia
- **Database**: SQLite (default; PostgreSQL mirror supported via schema-pg/)
- **ORM**: Drizzle (autoMigrate/autoSeed on startup for SQLite)
- **Validation**: TypeBox route schemas
- **Logging**: pino
- **Auth**: JWT with DB-backed token blacklist, MFA (TOTP), OAuth SSO

### Frontend

- **Framework**: React 19 + Vite
- **Routing**: React Router
- **State/Data**: TanStack Query + Zustand
- **Styling**: Tailwind + shadcn/ui + lucide icons

## Data Model Overview

- **Implemented (template):** User, Workspace, WorkspaceMember, Notification, AuditLog,
  ApiKey, FileUpload, ScheduledTask, Setting, Dashboard, HealthCheck, BusinessEvent,
  BugReport, MfaSetting, OAuthAccount. See `CONTEXT.md` for the canonical glossary.
- **To implement (domain, per spec §Data Model):** assets, asset_aliases,
  asset_hardware_profiles, asset_network_interfaces, asset_storage_allocations,
  asset_relationships, asset_services, service_catalog, service_dependencies, asset_ports,
  sites, network_zones, owners, vendors, asset_tags, imports, import_rows,
  asset_change_events.

## API Overview

- **Base path**: `/api/v1`
- **Auth model**: JWT (cookie/bearer); numeric role comparison via `hasMinimumRole`
- **Contract source of truth**: OpenAPI at `/api/v1/docs/json` (dev)
- **Envelopes**: `DataResponse<T>`, `PaginatedResponse<T>`, `SuccessResponse`, `ErrorResponse`

## Development Workflow

- **Install**: `bun install`
- **Dev**: `bun run dev` (non-blocking launcher via `scripts/dev-with-logs.ts`; agents use
  `bun run start` / `bun run stop` — never run blocking dev servers inline)
- **DB**: `bun run db:generate`, `bun run db:migrate`, `bun run db:setup`
- **Quality gate**: `bun run smoke:qc` (drift/config/schema, typecheck, lint, build, API
  type contract, format, dependency versions) — required before any commit
- **Format**: `bun run format`
- **UI crawl tests**: `bun run crawltest`

## Notes / Gotchas

- JSON-only config: no `.env` files (`bunfig.toml` sets `env = false`).
- `shared/` must stay zero-runtime-dependency; frontend never imports from backend.
- Snake_case DB names, camelCase TypeScript fields; soft-delete via
  `is_deleted`/`deleted_at`/`deleted_by` (WorkspaceMember is the deliberate hard-delete
  exception).
- SQLite auto-migrates/seeds on startup; PostgreSQL requires manual migration management.
- This is a derived app — mind template drift (`bun run check:drift`).
