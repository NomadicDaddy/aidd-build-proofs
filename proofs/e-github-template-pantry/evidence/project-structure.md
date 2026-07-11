# Project Structure

## Overview

**Pantry** is a small, single-household pantry/stock tracker built on the **Podex** framework that
this repo ships. Podex is a full-stack hypermedia web framework using **PowerShell Core + Pode** for
the server and **htmx + Mustache + Tailwind CSS** for the frontend, with **SQLite** (via `PSSQLite`)
for storage. Server-rendered `.pode` views and HTML fragments are swapped in place by htmx partial
requests — there is no SPA, bundler, or Node server.

As of this writing the pantry product described in `.aidd/spec.md` is **implemented**: item model +
CRUD, the inventory list grouped by category, category + text-search filtering, the low-stock and
expiring-soon views (with self-updating nav counts), quick-adjust +/− per row, CSV export, and a
seed-data script. The original stock Podex demo CRUD (`feature`/`tag` domain, `api/crud/*`,
`crudmgr*` views) has been removed and replaced by the canonical pantry item surface. The remaining
`.aidd/features/*` inventory is a mix of completed pantry features and audit-remediation items.

Primary constraints: local single-instance, no authentication, no multi-tenancy, no realtime, no
external APIs. Match and extend the existing Podex idioms rather than introducing a new stack
(see `.aidd/project.md`).

## Repository Layout

```
pantry/
├── podex.ps1              # Server bootstrap: Start-PodeServer, endpoints, pantry route registration
├── server.psd1            # Pode config (ports, HTTPS, ShowExceptions, Podex.Debug flag — default off)
├── .build.ps1             # PowerShell module install / build entry point
├── package.json           # npm scripts (start, format, lint, test, seed, build) + JS tooling
├── api/                   # File-based API routes + shared libraries
│   ├── _lib/              # Dot-sourced helpers (NOT routes; skipped by route discovery)
│   │   ├── pantry-store.ps1       # Data-access layer: item CRUD, filters, validation, CSV, expiry
│   │   ├── pantry-render.ps1      # Server-side HTML fragment renderers for the pantry views
│   │   ├── crud-paging.ps1        # Resolve-CrudPaging input parser (page/pageSize clamp)
│   │   └── route-registration.ps1 # Maps api/**/*.ps1 file paths → { Path, Method }
│   └── debug/             # init/clear/stop + *.sql — debug-only DB routes (gated by Podex.Debug)
├── htmx/                  # Standalone htmx fragment endpoints (e.g. hello.ps1)
├── scripts/
│   └── seed.ps1           # Seeds ~20 sample items (incl. low-stock + expiring) via the DAL
├── views/                 # Server-rendered .pode templates
│   ├── layouts/           # main.pode, bare.pode — page shells
│   ├── components/        # about.pode, inventory.pode, lowstock.pode, expiring.pode — page bodies
│   └── partials/          # header.pode (nav + counts), footer.pode
├── errors/                # 404.html.pode, default.html.pode — error pages
├── public/                # Static assets served at /public
│   ├── css/tailwind.css
│   ├── js/                # htmx.js, mustache.js, debug.js
│   └── images/, robots.txt
└── tests/                 # pantry.Tests.ps1 — Pester v5 suite covering every pantry feature
```

## Key Concepts / Modules

### Server bootstrap (`podex.ps1`)

- **Responsibility**: Imports `PSSQLite` + `Pode`, dot-sources the `api/_lib` helpers, starts the
  Pode server, configures logging/endpoints/static routes, registers the pantry routes explicitly,
  auto-discovers remaining `api/**/*.ps1` routes, and mounts OpenAPI/Swagger.
- **Pantry routes** (registered in `podex.ps1`):
    - `GET /inventory` — inventory list grouped by category, sorted by name, with expiry badges.
    - `GET /htmx/inventory-filter` — category + search filter; returns the `#inventory-list` fragment.
    - `GET /expiring`, `GET /htmx/expiring-list`, `GET /htmx/expiring-count` — expiring-soon page,
      list fragment, and self-updating nav count.
    - `GET /lowstock`, `GET /htmx/lowstock-list`, `GET /htmx/lowstock-count` — low-stock page, list
      fragment, and self-updating nav count.
    - `GET /htmx/item-new` / `POST /htmx/item-create` — add form + create (server-side validation,
      422 + error fragment on failure).
    - `GET /htmx/item-edit` / `GET /htmx/item-row` / `PUT /htmx/item-update` — inline edit form, read
      row, and update.
    - `POST /htmx/item-adjust` — quick-adjust +/− quantity with a single-row swap.
    - `DELETE /htmx/item-delete` — delete with a confirm step.
    - `GET /inventory.csv` — RFC 4180 CSV export (`Content-Disposition: attachment`).
- **Route discovery**: iterates `./api/**/*.ps1` via `Get-RouteRegistration`; HTTP method is inferred
  from the filename (`get.ps1` → GET, etc.). The `api/_lib` directory is skipped. `debug/` routes are
  only mounted when `Podex.Debug` is true.
- **Cross-view coordination**: mutating routes emit an `itemChanged` htmx trigger; the low-stock /
  expiring lists and nav counts listen for it and refetch, so counts stay correct after any change.

### Data-access layer (`api/_lib/pantry-store.ps1`)

- **Responsibility**: All persistence and business rules for pantry Items. Routes and views never
  touch SQLite directly — swapping the backend means changing only these bodies.
- **Storage**: a single `items` table (`id, name, category, quantity, unit, expiry, threshold,
notes, created_at, updated_at`) with a `CHECK (quantity >= 0)` constraint. `Initialize-PantryStore`
  is idempotent. All queries use `@`-parameter binding (no string interpolation).
- **Functions**: `New/Get/Update/Remove-PantryItem`, `Get-PantryItems`, `Update-PantryItemQuantity`
  (clamps at 0), and the pure helpers `Select-PantryItems` (category + search), `Select-PantryLowStockItems`,
  `Select-PantryExpiringItems`, `Get-PantryExpiryState`, `Test-PantryItemInput` (validation), and
  `ConvertTo-PantryCsv`.

### Views (`views/**`)

- **Responsibility**: Pode view-engine templates rendered server-side and swapped by htmx.
  `layouts/main` wraps a page with header/footer and injects `Components` + pre-rendered fragment
  HTML; `layouts/bare` renders a bare fragment for htmx swaps. Component bodies are `inventory`,
  `lowstock`, `expiring`, and `about`. Views are accessible: labeled inputs, button semantics,
  landmarks/heading structure, and htmx focus management.

### Config (`server.psd1`)

- **Responsibility**: Pode endpoint (host/port/HTTPS/cert), `ShowExceptions`, and the `Podex.Debug`
  flag that gates the destructive debug DB routes, terminal error logging, and route dumping. Debug
  now defaults to `$false`.

## Technology Stack

### Backend

- **Runtime**: PowerShell Core (`pwsh`, 7+)
- **Framework**: Pode (`<= 2.99.99`)
- **Database**: SQLite via `PSSQLite` (`<= 1.99.99`)
- **Auth**: none (by design)

### Frontend

- **Framework**: htmx (hypermedia; server-rendered fragments)
- **Templating**: Pode view engine (`.pode`) + Mustache (client-side, `public/js/mustache.js`)
- **Styling**: Tailwind CSS (`public/css/tailwind.css`)
- **State/Data**: none client-side; state lives on the server / in SQLite

## Data Model Overview

- **`items` table** (created by `Initialize-PantryStore`): the canonical pantry item — `name`
  (required), `category`, `quantity` (REAL, `>= 0`), `unit`, `expiry` (optional ISO date),
  `threshold` (reorder point, default 1), `notes`, plus `created_at` / `updated_at` timestamps.
- The former `feature`/`tag` demo schema and the three-layer API/schema/view mismatch are gone; the
  API surface, schema, and views now all speak the same pantry item model.

## API Overview

- **Base path**: pantry routes are mounted at top-level paths (`/inventory`, `/expiring`,
  `/lowstock`, `/htmx/*`, `/inventory.csv`); any remaining file-based routes live under `/api/...`.
- **Auth model**: none
- **Docs**: OpenAPI at `/docs/openapi`, Swagger UI at `/docs/swagger`.

## Development Workflow

- **Install (JS tooling)**: `npm install`
- **Install (PowerShell modules)**: `pwsh -c ". ./.build.ps1"`
- **Dev / Run**: `npm start` → server on the port from `server.psd1`
- **Seed sample data**: `npm run seed` (loads ~20 items across categories)
- **Format**: `npm run format` (prettier)
- **Lint**: `npm run lint` (eslint, JS/config only)
- **Tests**: `npm test` → Pester v5 runs `tests/pantry.Tests.ps1` (65 tests covering the DAL,
  filters, validation, low-stock/expiring selection, CSV, quick-adjust, and form/route contracts)

## Notes / Gotchas

- **File-based routing is filename-driven.** For auto-discovered `api/` routes a file's name
  determines its HTTP method; the pantry routes themselves are registered explicitly in `podex.ps1`.
- **`api/_lib` is not a route directory.** Files there are dot-sourced helpers and are deliberately
  skipped by route discovery.
- **`Podex.Debug` is a broad switch** gating the destructive debug DB routes, terminal error logging,
  and route dumping. It now defaults to `$false` in the committed `server.psd1`.
- **PowerShell is `pwsh` (7+).** Do not invoke `powershell.exe` (Windows PowerShell 5.x).
- **All storage goes through the DAL.** Routes, views, and the seed script call `pantry-store.ps1`
  functions rather than issuing SQLite directly, so validation and NULL-normalization stay uniform.
  </content>

</invoke>
