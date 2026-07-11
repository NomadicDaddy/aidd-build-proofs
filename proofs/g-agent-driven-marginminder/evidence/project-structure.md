# Project Structure

## Overview

Margin Minder is a Spernakit v3.8.2 application for local-first pricing and
margin planning. The current implementation has moved beyond the initial
scaffold: the core Margin Minder dashboard, catalog, scenario, comparison,
export, pricing calculation, risk flagging, and seed-data flows are implemented
and tracked by completed feature metadata.

The app keeps the Spernakit administrative foundation for authentication, RBAC,
workspaces, settings, notifications, files, custom dashboards, health, audit,
backup, scheduled tasks, API keys, and bug-report intake.

## Repository Layout

```text
marginminder/
├── backend/                 Elysia API server, Drizzle schemas, plugins, routes, services
├── frontend/                React 19 + Vite app, pages, layout, stores, API modules
├── shared/                  Shared workspace for constants, API types, and pure helpers
├── config/                  JSON configuration and generated config schema
├── data/                    SQLite database location
├── backups/                 Local backup target configured by config/marginminder.json
├── docker/                  Docker/nginx/supervisord deployment assets
├── docs/                    Spernakit template documentation
├── logs/                    Local runtime and verification logs
├── scripts/                 Bun TypeScript scripts for validation, startup, smoke tests
└── .aidd/                   AIDD spec, features, roadmap, assertions, and progress logs
```

## Backend Layout

```text
backend/
├── drizzle/                 SQL migrations and Drizzle metadata
├── src/
│   ├── app.ts               Backend bootstrap and WebSocket mount
│   ├── create-api-app.ts    Elysia app factory, plugin chain, route registration
│   ├── config/              JSON config loader, schemas, validation
│   ├── constants/           Shared constants and response examples
│   ├── db/                  Database init, auto-migrate, seed, schema exports
│   ├── guards/              Role and workspace authorization guards
│   ├── plugins/             Elysia plugins for auth, CORS, CSRF, rate limits, audit
│   ├── routes/              API route modules under /api/v1
│   ├── services/            Domain and infrastructure services
│   ├── storage/             Local and S3 file storage adapters
│   ├── templates/           Email templates
│   ├── types/               Backend type shims
│   └── utils/               Logging, validation, auth, encryption, response helpers
└── package.json             Backend workspace scripts and dependencies
```

Registered backend route domains include auth, users, workspaces, dashboards,
notifications, files, health, system metrics, backups, settings, audit, business
metrics, scheduled tasks, onboarding, bugs, database admin, cost catalog, pricing
dashboard, scenarios, and scenario comparison.

Margin Minder domain routes are registered in `backend/src/create-api-app.ts`:

- `backend/src/routes/dashboard.ts` -> `GET /api/v1/dashboard`
- `backend/src/routes/cost-catalog.ts` -> `GET/POST /api/v1/cost-catalog`,
  `GET/PUT/DELETE /api/v1/cost-catalog/:id`
- `backend/src/routes/scenarios.ts` -> `GET/POST /api/v1/scenarios`,
  `GET/PUT/DELETE /api/v1/scenarios/:id`,
  `GET /api/v1/scenarios/:id/summary`
- `backend/src/routes/scenario-comparison.ts` ->
  `POST /api/v1/scenario-comparison`

## Frontend Layout

```text
frontend/
├── src/
│   ├── api/                 Native fetch API modules and frontend-owned API types
│   ├── components/          Auth, layout, workspace, shared, and shadcn/ui components
│   ├── hooks/               App, auth, layout, dashboard, notification, settings hooks
│   ├── lib/                 Utilities, websocket client, formatting, storage helpers
│   ├── pages/               Routed pages grouped by feature area
│   ├── routes.tsx           React Router route tree
│   ├── routes/              Lazy page imports and preloading helpers
│   ├── stores/              Zustand stores for auth, layout, theme, sidebar, workspace, WS
│   ├── styles/              Super-theme CSS
│   └── tailwind.css         Tailwind entrypoint
└── package.json             Frontend workspace scripts and dependencies
```

Implemented Margin Minder frontend routes:

- `/dashboard` - pricing dashboard with active scenario metrics and recent scenarios
- `/cost-catalog` - searchable catalog table with create, edit, archive, and archived toggle
- `/scenarios` - scenario list with search, status filter, archived toggle, pricing columns,
  risk count, edit links, and compare/new actions
- `/scenarios/new` - scenario creation editor
- `/scenarios/:id` - scenario detail/editor with assumptions, line items, labor, fixed costs,
  summary, risk flags, and Markdown export
- `/compare` - scenario picker and side-by-side comparison table
- `/admin` - redirect to `/settings`

Spernakit admin/foundation routes remain implemented, including custom dashboards,
notifications, onboarding, analytics, files, workspaces, profile tabs, settings tabs,
shared dashboards, auth pages, and the 404 page.

## Data Model

The app uses SQLite by default with PostgreSQL schema parity files. Domain tables are
present in both schema sets and exported through the schema indexes:

- `cost_catalog_items`
- `quote_scenarios`
- `scenario_line_items`
- `scenario_labor_entries`
- `scenario_fixed_costs`

The foundation Spernakit tables also remain in place for users, workspaces, audit logs,
settings, notifications, custom dashboards, files, health checks, metrics, scheduled
tasks, API keys, bug reports, token blacklist, password history, OAuth accounts, and
rate limits.

## Implemented Product Functionality

- Pricing dashboard metrics and recent scenario list
- Cost catalog CRUD/archive workflow
- Quote scenario list, create, detail, update, archive, summary, and comparison APIs
- Scenario editor with line items, labor, fixed costs, assumptions, summary, and export
- Server-side pricing calculation for direct cost, sell price, contingency, discount,
  tax, gross profit, margin, markup, break-even, and target price
- Risk flags for below-target margin, high discount, missing contingency, and stale
  catalog assumptions
- Scenario comparison page for two to ten saved scenarios
- Markdown scenario summary generation and copy feedback
- Development seed data with catalog items and a realistic quote scenario

## Technology Stack

- Runtime and package manager: Bun
- Backend: Elysia, Drizzle ORM, TypeBox route validation, pino logging
- Database: SQLite by default, PostgreSQL schema parity support
- Frontend: React 19, Vite 8, React Router, TanStack Query, Zustand
- UI: Tailwind CSS and shadcn/ui with lucide icons
- Configuration: JSON files under `config/`; no `.env` files
- Testing and validation: `bun run smoke:qc`, crawltest scripts, feature integration checks

## Current Configuration

The current runtime source is `config/marginminder.json`:

- Frontend: `http://localhost:3440`
- Backend: `http://localhost:3441`
- Database: `file:./data/marginminder.db`
- CORS dev origin: `http://localhost:3440`

Older first-pass references to ports `3490` and `3491` are stale.

## Development Workflow

- Install: `bun install`
- Database setup: `bun run db:setup`
- Agent-safe local startup: `bun run start`
- Stop services started by the current agent: `bun run stop`
- Quality gate: `bun run smoke:qc`
- Build only: `bun run build`
- Typecheck only: `bun run typecheck`
