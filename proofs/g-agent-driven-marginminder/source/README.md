# Margin Minder

Margin Minder is a local-first pricing and margin planner for small service businesses.
It helps an owner, operator, or office manager maintain reusable cost assumptions, build
quote scenarios, calculate pricing outcomes, spot margin risk, compare saved scenarios,
and copy a Markdown summary for reuse in proposals or email.

The current MVP is implemented on the Spernakit v3.8.2 application foundation. The app
keeps the standard Spernakit administrative surfaces for authentication, RBAC,
workspaces, settings, notifications, files, health monitoring, audit logs, backups,
scheduled tasks, and bug report intake.

## Implemented Product Workflows

- **Pricing dashboard:** `/dashboard` shows saved scenario count, draft count,
  below-target count, average gross margin, recent scenarios, and quick actions.
- **Cost catalog:** `/cost-catalog` supports searchable reusable labor, material,
  subcontractor, overhead, fee, and other cost assumptions with create, edit, archive,
  and archived-item review flows.
- **Scenario list:** `/scenarios` supports customer/title search, status filters,
  archived scenario visibility, pricing columns, risk counts, and navigation to create,
  edit, and compare workflows.
- **Scenario editor:** `/scenarios/new` and `/scenarios/:id` let operators create and edit
  customer/title, status, target margin, tax, contingency, discount, notes,
  assumptions, line items, labor entries, fixed costs, summary, and export content.
- **Pricing calculations:** Server-side calculations cover direct cost, sell price,
  contingency, discount, tax, gross profit, margin, markup, break-even, and target price.
- **Risk flags:** Scenario summaries flag below-target margin, high discount, missing
  contingency, and stale catalog assumptions.
- **Scenario comparison:** `/compare` lets users select two to ten saved scenarios and
  compare final price, direct cost, gross profit, margin, target gap, discounts,
  contingency, and risk flags.
- **Markdown export:** Saved scenario detail pages include an export tab with a copyable
  Markdown summary.
- **Seeded quote data:** Development seeding includes realistic cost catalog entries and
  a quote scenario with visible pricing totals and risk flags.

For deeper traceability, see `.aidd/spec.md`, `.aidd/screen-map.md`,
`.aidd/testing-scenarios.md`, and `.aidd/features/`.

## How To Use The App Locally

1. Start the app with `bun run start` and open `http://localhost:3440`.
2. Log in with a seeded account. Use `operator` / `operator123` for day-to-day pricing
   work, or `viewer` / `viewer123` for read-only review.
3. Open **Dashboard** to review current pricing health from seeded and saved scenarios.
4. Open **Cost Catalog** to browse reusable cost assumptions. Operators can create, edit,
   or archive catalog items; archived items remain available for historical scenarios.
5. Open **Scenarios** to search, filter, and inspect saved quote scenarios.
6. Create a scenario from **New Scenario**, or edit an existing scenario. Add assumptions,
   catalog-backed line items, labor entries, fixed costs, tax, contingency, discount, and
   target margin.
7. Save the scenario and review the calculated summary. Pricing totals and risk flags are
   recalculated by the backend from stored scenario inputs.
8. Open **Compare** to select saved scenarios and review pricing outcomes side by side.
9. Open a saved scenario's **Export** tab to copy the Markdown summary.

Realistic quote data is seeded for development, so a fresh local database has catalog
items and at least one scenario ready for dashboard, comparison, risk, and export review.

## Prerequisites

- Bun 1.3.14 or newer
- Node.js 24.x when Node compatibility tooling is needed

## Setup

```bash
bun install
bun run db:setup
```

Do not run setup scripts from unattended agent sessions unless the session is explicitly
the initializer. The existing project assumes initialization has already happened.

## Running Locally

For agent-safe local startup, use the detached Spernakit launcher:

```bash
bun run start
```

This starts services in the background and returns to the shell. Stop only services you
started yourself:

```bash
bun run stop
```

For an interactive human terminal, `bun run dev` is available, but it is a blocking watch
command and should not be used by unattended agents.

Configured local ports are:

- Frontend: `http://localhost:3440`
- Backend: `http://localhost:3441`
- Health: `http://localhost:3441/api/v1/health`

Runtime configuration lives in `config/marginminder.json`. Configuration is JSON-only;
do not introduce `.env` files.

## Default Accounts

Seeded development accounts are available after database setup:

| Username | Password    | Role     |
| -------- | ----------- | -------- |
| sysop    | sysop123    | SYSOP    |
| admin    | admin123    | ADMIN    |
| manager  | manager123  | MANAGER  |
| operator | operator123 | OPERATOR |
| viewer   | viewer123   | VIEWER   |

## Project Structure

```text
marginminder/
├── backend/          Elysia API, Drizzle schemas, services, route plugins
├── frontend/         React 19, Vite, shadcn/ui, pages, stores, API modules
├── shared/           Workspace package for shared constants and pure types
├── config/           JSON configuration; no .env files
├── data/             SQLite database location
├── backups/          Local backup target
├── scripts/          Bun/TypeScript maintenance and verification scripts
├── docs/             Spernakit template documentation
└── .aidd/            Spec, feature metadata, progress logs, and audit material
```

Margin Minder domain backend routes are registered under `/api/v1` for dashboard, cost
catalog, scenarios, scenario summaries, and scenario comparison. Frontend product routes
are wired through React Router and the primary navigation:

- `/dashboard`
- `/cost-catalog`
- `/scenarios`
- `/scenarios/new`
- `/scenarios/:id`
- `/compare`

Implementation details are mapped in `.aidd/project-structure.md` and
`.aidd/screen-map.md`. Completed feature records live under `.aidd/features/`.

## Quality Checks

```bash
bun run smoke:qc
```

`smoke:qc` is the commit gate. It runs drift, config, schema, typecheck, lint, build, API
type, feature integration, schema parity, format, dependency, lockfile, and LTS surface
checks through `scripts/smoke.ts`.

Useful targeted checks:

```bash
bun run check-application
bun run typecheck
bun run lint
bun run build
bun run format:check
```

After UI changes, run the relevant crawltest route check, for example:

```bash
bun scripts/crawltest.ts --page /dashboard
bun scripts/crawltest.ts --start-from /scenarios
```
