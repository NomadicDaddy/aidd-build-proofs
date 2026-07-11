# Project Assertions / Invariants

Formally stated invariants for Margin Minder. IDs are stable and should not be reused
for different meanings.

## Product Invariants

- **MM-ASSERT-001** - Margin Minder MUST remain a local-first pricing and margin planner.
  It MUST NOT add payment processing, invoicing, accounting sync, public quote sharing, or
  third-party integrations without explicit product approval. (enforcement: policy-only)
- **MM-ASSERT-002** - Every pricing total shown in the UI MUST be derived from persisted
  scenario inputs and server-side calculation, not trusted frontend-only totals.
  (enforcement: backend-service, UI data flow)
- **MM-ASSERT-003** - Scenario summaries MUST expose direct cost, final price, gross
  profit, margin, markup, break-even, target price, contingency, discount, tax, and risk
  flags using consistent currency and one-decimal percentage formatting.
  (enforcement: backend-service, UI display)
- **MM-ASSERT-004** - Risk flags MUST include below-target margin, high discount, missing
  contingency, and stale catalog assumptions when their conditions are present.
  (enforcement: backend-service)
- **MM-ASSERT-005** - Scenario Markdown export MUST include scenario identity, status,
  final price, direct cost, gross profit, margin, target margin, assumptions, and risk
  flags. (enforcement: UI workflow)

## Data Invariants

- **MM-ASSERT-010** - Database files MUST reside only under root `data/`; no database file
  may be created under `backend/data/` or another application directory.
  (enforcement: policy-only, smoke:qc checks)
- **MM-ASSERT-011** - The domain data model MUST include `cost_catalog_items`,
  `quote_scenarios`, `scenario_line_items`, `scenario_labor_entries`, and
  `scenario_fixed_costs` in both SQLite and PostgreSQL Drizzle schema sets.
  (enforcement: check:schema-parity)
- **MM-ASSERT-012** - Catalog archive MUST preserve existing scenario references.
  Archiving a catalog item sets it inactive and excludes it from default suggestions, but
  existing scenario lines remain valid. (enforcement: backend-service)
- **MM-ASSERT-013** - Scenario archive MUST retain line items, labor entries, and fixed
  costs for historical review. (enforcement: backend-service)
- **MM-ASSERT-014** - Quantity, cost, hours, rates, tax, discount, contingency, markup,
  burden, and target margin inputs MUST reject negative values. Target margin MUST remain
  below 100 percent. (enforcement: TypeBox route validation, UI validation)

## Route And Integration Invariants

- **MM-ASSERT-020** - Every backend route file under `backend/src/routes/` MUST be
  registered in `backend/src/create-api-app.ts`, except WebSocket routes mounted by the
  backend root app. (enforcement: check:feature-integration)
- **MM-ASSERT-021** - Every page component under `frontend/src/pages/` ending in
  `Page.tsx` MUST be lazy-imported and routed through `frontend/src/routes.tsx`.
  (enforcement: check:feature-integration)
- **MM-ASSERT-022** - The primary product navigation MUST include Dashboard, Cost Catalog,
  Scenarios, and Compare while retaining role-gated Spernakit admin surfaces.
  (enforcement: UI navigation config)
- **MM-ASSERT-023** - `/admin` MUST remain a redirect to `/settings` rather than a
  separate unowned admin surface. (enforcement: frontend route tree)

## Security And Operations Invariants

- **MM-ASSERT-030** - Authentication MUST use HTTP-only JWT cookies and five-tier
  Spernakit RBAC: SYSOP, ADMIN, MANAGER, OPERATOR, VIEWER. (enforcement: auth plugin,
  route guards)
- **MM-ASSERT-031** - Privileged backend routes MUST use `requireRoleFresh` or an
  equivalent guard so stale token role claims are not trusted. (enforcement: route guards)
- **MM-ASSERT-032** - Configuration MUST remain JSON-only under `config/`; `.env` files
  MUST NOT be introduced. (enforcement: policy-only, config checks)
- **MM-ASSERT-033** - Current local runtime ports are frontend `3440` and backend `3441`
  as declared in `config/marginminder.json`. Documentation MUST NOT reintroduce stale
  first-pass ports `3490` or `3491`. (enforcement: artifact review)
- **MM-ASSERT-034** - `bun run smoke:qc` MUST pass before committing changes.
  (enforcement: quality gate)
