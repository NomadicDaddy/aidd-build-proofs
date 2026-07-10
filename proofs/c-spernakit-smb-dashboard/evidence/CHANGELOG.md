# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **`testing-scenarios` (Session 30 — completion):** Finalized the end-to-end crawl/testing
  scenarios deliverable for the dashboard and inventory flows. `.aidd/testing-scenarios.md` holds 24
  curated `/spernakit-tester` seed-mode scenarios covering the operational dashboard (summary cards
  and risk/documentation-health signals), asset inventory (dense filterable table, text + type/status/
  criticality/port filters), asset detail (overview, hardware, virtualization, storage, network,
  services, ports, relationships, notes, history), network interfaces, storage allocation with
  capacity guards, relationships (table view + interactive map + impact analysis), the service
  catalog, expected/observed ports, global search, saved views, CSV import review with duplicate
  detection and audit trail, CSV/JSON exports and the printable management summary, the audit report
  and per-asset history, admin infrastructure settings, and the full 5-tier RBAC matrix
  (sysop/admin/manager/operator/viewer), plus the spec acceptance-criteria questions. Each scenario
  references a route the generic `bun run crawltest` harness walks (`/dashboard`, `/assets`,
  `/assets/:id`, `/relationships`, `/relationships/map`, `/services`, `/search`, `/reports`,
  `/reports/summary`, `/imports`) — all confirmed present in `frontend/src/routes/appRoutes.tsx`.
  - **Verification:** Re-verified the two dependency flows live against the running seeded app via
    `agent-browser`. Operator (`operator`/`operator123`) login lands on `/dashboard`, which renders
    real documentation-health signals (stale 6, missing owner 6, missing backup 6) as click-through
    cards; `/assets` renders the filterable inventory table with search, type/status/criticality/port
    filters, New Asset, and the Views bar. Zero console errors on both pages. `dashboard-summary-cards`
    and `asset-inventory-page` dependencies both pass. `bun run smoke:qc` green (template drift
    acknowledged only).

- **`workspace-scoping` (Session 29 — completion):** Enforced workspace-aware boundaries on the
  asset, relationship, and service domains, gated by the existing `app.workspaces_enabled`
  app-feature flag (fail-closed) so single-inventory deployments are entirely unaffected. New
  `backend/src/guards/workspaceScope.ts` provides `resolveWorkspaceScope(user, workspaceId)` —
  returns null (unrestricted) when the flag is off or the caller is a SYSOP with no `X-Workspace-ID`
  header, otherwise the active workspace — and `requireDomainWorkspaceAccess`, a guard that is a
  no-op when scoping is off and otherwise delegates to the existing `requireSelectedWorkspaceAccess`
  (SYSOP cross-workspace bypass; everyone else must select a workspace they belong to). A
  `workspaceScope` filter was threaded into the three list queries (`listAssets`,
  `listRelationships`, `listServices`) and the single-record getters (`getAssetById`,
  `getRelationshipById`, `getServiceById`/`getServiceDetail`), and `requireDomainWorkspaceAccess` was
  composed after the fresh-role guard on every domain route: assets `core.ts` (list/get/history) and
  `mutations.ts` (create stamps the resolved workspace; update/delete/restore/archive gate on a
  scoped `assertAssetInScope` pre-check), all five asset sub-resource route files (ports, storage,
  network interfaces, service assignments, hardware) via a shared scoped `assertAssetVisible` parent
  check, `relationships.ts` (list/get/impact/create/update/delete), and services `read.ts` +
  `write.ts` (create stamps; update/delete/dependency add+remove gate on a scoped
  `assertServiceInScope`). Out-of-scope single-record reads and writes return 404 (indistinguishable
  from missing, so a boundary is never leaked); a non-SYSOP with no header gets 400 and a non-member
  workspace gets 403. The frontend already attaches `X-Workspace-ID` via
  `frontend/src/api/requestHelpers.ts`, so the enforcement is consistent with the existing
  saved-views/dashboards scoping pattern and needs no client change.
  - **Verification:** `scripts/test-workspace-scoping.ts` proves the boundary in-process against a
    throwaway temp-file SQLite DB via `app.handle()` — 8 assertions: with the flag ON a workspace-A
    member scoped to A sees exactly A's 2 assets / 1 relationship / 1 service, a non-member workspace
    is 403, B's asset scoped to A is 404, a missing header is 400, a SYSOP with no header reads all
    3 assets / 2 services; with the flag OFF the same operator (no header) sees every asset
    (single-inventory preserved). Full `bun run smoke:qc` is green end-to-end — template drift
    (acknowledged only), max-lines, typecheck, lint, backend + frontend `vite build`, API
    type-contract validation (198 endpoints, enums consistent), feature-integration, schema-parity,
    and format. No schema change (the nullable `workspace_id` columns already existed on the three
    domain tables), so schema-parity is untouched.

### Changed

- **`remediation-20260704-split-oversized-modules` (Session 28 — completion):** Split all 24 source
  files that exceeded the 300-line modularity gate into cohesive modules, a pure structural refactor
  with no API-contract, route-path, type-signature, or UI-behavior change — every original import
  site keeps working via a facade/barrel. Backend route files became thin Elysia facades composing
  per-concern submodule instances: `routes/assets.ts` (1647) → `routes/assets/{shared,core,mutations,
  hardware,networkInterfaces,storage,serviceAssignments,ports}.ts`; `routes/imports.ts` and
  `routes/services.ts` → `routes/imports/` and `routes/services/` (`{shared,read,write}.ts`), each
  submodule replicating the original constructor options and plugins so paths/behavior are identical.
  Backend services (`assetImportService`, `assetService`, `assetServiceAssignmentService`,
  `assetStorageAllocationService`, `assetNetworkInterfaceService`, `assetSummaryService`,
  `assetPortService`, `serviceCatalogQueries`, `globalSearchService`, `relationshipQueries`,
  `serviceCatalogService`) became barrels re-exporting query/command/helper submodules under
  same-named sibling directories, preserving every exported symbol.
  - **Schema pair (parity-sensitive):** `db/schema/services.ts` (332) and `db/schema-pg/services.ts`
    (335) were each split into `serviceCatalog.ts` (service_catalog + asset_services tables),
    `serviceTopology.ts` (service_dependencies + asset_ports tables), and `serviceRelations.ts` (all
    Drizzle relations). Relations were isolated into their own file that imports the table modules
    one-directionally to avoid a circular-import evaluation hazard (the original single-file
    definition order relied on top-to-bottom evaluation). A thin `services.ts` barrel preserves the
    public surface so `schema/index.ts` / `schema-pg/index.ts` are unchanged, and the SQLite and PG
    directories mirror each other file-for-file so `bun run check:schema-parity` passes.
  - **Frontend:** `pages/assets/AssetDetailPage.tsx` (1546) → a page shell plus an
    `AssetDetailPage/` directory of section components (Overview/Hardware/Virtualization/Notes tabs,
    NetworkInterfaces/Storage/AssignedServices/Ports sections), shared primitives, and formatters;
    `AssetFormDialog`, `PortDialog`, `HardwareProfileDialog`, `InfrastructureTab`, and
    `ServiceDetailPage` split into extracted field bodies / form models / subcards; `api/assets.ts`
    (607) → a barrel over an `api/assets/` directory of sub-resource modules; `routes.tsx` (368) → a
    composer over `routes/{publicRoutes,appRoutes,settingsRoutes}.tsx`.
  - **Gate discipline:** no exemption list and no threshold change to `check:max-lines`; the
    acknowledged template drift in `.templateoverrides` was not modified.
  - **Verification:** `bun run check:max-lines` reports zero violations, and full `bun run smoke:qc`
    is green end-to-end — template-drift (acknowledged only), max-lines, typecheck, lint, backend +
    frontend `vite build`, API type-contract validation (198 endpoints extracted, enums consistent),
    feature-integration, schema-parity, and format. The build and OpenAPI spec extraction boot the
    app and re-register every route, giving runtime coverage that the route/service/schema
    recomposition is intact. Post-split lint fixes: import/export sort order and `import type`
    normalization (auto-fixed), and `serviceDetailHelpers.tsx` was split (pure `dependencyTargetLabel`
    helper moved to `serviceDetailModel.ts`) to satisfy `react-refresh/only-export-components`.

### Added

- **`testing-scenarios` (Session 27 — completion committed):** Reconciled the `testing-scenarios`
  feature metadata, which was still on disk as `status: in_progress` / `passes: false` despite the
  Session 26 sign-off. Re-verified the authored catalog is present and complete
  (`.aidd/testing-scenarios.md`, 52 lines, 24 curated `/spernakit-tester` scenarios) and that all
  nine referenced routes resolve in the live frontend route table (`frontend/src/routes.tsx`:
  `/dashboard`, `/assets`, `/assets/:id`, `/relationships`, `/relationships/map`, `/search`,
  `/reports/summary`, `/reports`, `/services`, `/services/:id`, `/imports`) — so the scenarios are
  grounded in real screens. Re-ran the primary acceptance flow against the running seeded app
  (frontend reused on :3460, UI-managed instance — not restarted) via agent-browser:
  `operator`/`operator123` login lands on `/dashboard`, which renders real documentation-health
  signals (Stale documentation 6, Missing owner 6, Missing backup status 6, Missing relationship map
  1, Missing service role 5) with an empty console-error log. This feature adds no application code
  and its artifacts (`.aidd/testing-scenarios.md`, `feature.json`) are gitignored, so there is no
  source commit; the `.aidd` metadata was set to `status: completed` / `passes: true` on disk.

- **`testing-scenarios` (Session 26 — completion):** Validated and closed out the
  `testing-scenarios` feature (status `in_progress` → `completed`, `passes` → `true`). Confirmed the
  authored `.aidd/testing-scenarios.md` catalog is present and complete (24 curated
  `/spernakit-tester` scenarios) and that all nine routes it references (`/dashboard`, `/assets`,
  `/relationships`, `/relationships/map`, `/services`, `/search`, `/reports`, `/reports/summary`,
  `/imports`) resolve in the live frontend route table — so the scenarios are grounded in real
  screens. Re-verified the primary acceptance flow against the running seeded app (frontend reused on
  :3460, UI-managed instance — not restarted) via agent-browser: `operator`/`operator123` login lands
  on `/dashboard`, which renders real documentation-health signals (Stale documentation 6, Missing
  owner 6, Missing backup status 6) with an empty console-error log. This feature adds no application
  code and its artifacts (`.aidd/testing-scenarios.md`, `feature.json`) are gitignored, so there is no
  code commit; the `.aidd` metadata was updated on disk. `bun run smoke:qc` was run only as a
  regression check and fails on the pre-existing `check:max-lines` gate (24 files from prior feature
  sessions exceed 300 lines; none were touched by this authoring work) — a pre-existing condition,
  not a regression introduced here.

- **`testing-scenarios` (Session 25):** Authored the end-to-end testing-scenario catalog at
  `.aidd/testing-scenarios.md` (previously missing; seed mode). Twenty-four curated
  `/spernakit-tester smb-infrastructure-dashboard: I want to …` scenarios cover every primary flow —
  operational dashboard summary cards and risk/documentation-health signals; asset inventory
  search/filter/create/edit/soft-delete; asset detail across all sections (overview, hardware,
  virtualization, storage, network, services, ports, relationships, notes, history); network
  interface and storage-allocation entry with the used≤total capacity guard and the storage-consumer
  list; relationship creation with duplicate/nonsensical-relationship prevention plus the interactive
  map at `/relationships/map` and its table fallback; impact analysis ("what breaks if this asset is
  offline?"); the service catalog and service-to-asset assignment; expected/observed port
  documentation and review-state filtering; global search; built-in and personal saved views; the
  staged CSV import → review → accept/reject → audit flow; CSV/JSON exports and the printable
  management summary; the cross-cutting audit trail; admin infrastructure settings (required fields,
  stale threshold, default dashboard filters, import behavior); and full five-tier RBAC
  (sysop/admin/manager/operator/viewer, each naming a concrete allowed and disallowed action). The
  catalog also encodes the spec's acceptance-criteria questions ("what servers do we have?", tracing
  VMs on a host and dependent business services, viewer read-only inspection, the admin import→audit
  loop) and a house-style header documenting the dev seed users (`{username}123`), seeded sites/owners/
  service catalog, and the post-login dashboard landing. A Post-Test Procedure footer wires the
  `/bug2feature` → `/feature-review` → remediation loop.
  - **Crawltest wiring:** `bun run crawltest` is a generic route-auto-discovery harness (it walks the
    live app rather than consuming named scenarios); the authored scenarios reference the real routes
    it traverses (`/dashboard`, `/assets`, `/assets/:id`, `/relationships`, `/relationships/map`,
    `/services`, `/search`, `/reports`, `/reports/summary`, `/imports`), so scenario execution maps
    onto the existing crawl surface without new config.
  - **Verification (against the running seeded app on :3460/:3461 via agent-browser):** `operator`
    login (`operator123`) lands on `/dashboard` — confirming the post-login operational-dashboard
    acceptance criterion — rendering real documentation-health counts (stale 6, missing owner 6,
    missing backup 6, missing relationship map 1, missing service role 5, unverified ports 0) and the
    Management/Operations/Audit saved-view tabs; navigating to `/assets` renders the dense filterable
    inventory table (Name/Type/Status columns) with text search, type/status/criticality and port
    protocol/exposure/review/service/number filters, the New Asset action, and the Views bar; no
    console errors observed. This authoring feature adds no application code, so `smoke:qc` was run
    only to confirm no regression: it still fails solely on the pre-existing template drift of
    `backend/src/guards/role.ts` (a "pure" file untouched by this work), exactly as documented.

- **`storage-tracking` (Session 24):** Delivered storage capacity and allocation tracking on top of
  the already-present `asset_storage_allocations` schema (SQLite `db/schema/assetProfiles.ts` + its
  byte-parity PostgreSQL mirror, both pre-existing from `asset-domain-schema`; no new migration).
  **Backend:** a new pure `services/assetStorageAllocationService.ts` (list — largest capacity first —
  get, create, update, delete, plus `listStorageConsumers` which joins the allocations drawing from an
  asset acting as a pool to each consuming asset's name), each asset-scoped, recording
  create/update/delete `asset_change_events` (entityType `asset_storage_allocation`) on the owning
  asset's history, validating the referenced storage-pool asset exists and enforcing the capacity
  invariant that **used ≤ total** on both create and update (comparing the effective merged values).
  Five new routes in `routes/assets.ts` mirror the network-interface block:
  `GET/POST /:id/storage-allocations`, `PATCH/DELETE /:id/storage-allocations/:allocationId` (VIEWER
  read, OPERATOR write), and a read-only `GET /:id/storage-consumers` (VIEWER) for the pool view, with
  inline TypeBox `storageAllocationBody`/`allocationParams` and full OpenAPI `detail` blocks. The
  operational dashboard summary gained a `storage` aggregate: `assetSummaryService.ts` now computes a
  `StorageSummary` (total capacity, used, free = max(0, total − used), allocation count, and distinct
  pool count via `countDistinct`) inner-joined to non-deleted assets, wired into
  `InfrastructureSummary` and the `EXAMPLE_SUMMARY` in `routes/infrastructureSummary.ts`.
  **Frontend:** `api/assets.ts` gained `StorageAllocation`/`StorageConsumer`/`StorageAllocationInput`
  types and five typed callers; `hooks/assets/useStorageAllocations.ts` (workspace-agnostic list +
  consumers queries — the consumers query sets `throwOnError: false` to degrade gracefully — and
  create/update/delete mutations invalidating the list, all consumers, and the asset history trail);
  `pages/assets/StorageAllocationDialog.tsx` (controlled create/edit form: name, storage type, total
  and used capacity in GB, mount point, storage-pool asset id, notes); and the asset detail **Storage**
  tab (`AssetDetailPage.tsx`) now renders a `StorageAllocationsSection` (per-allocation cards showing
  total, a "used / total GB (%)" usage string, computed free, mount point, and pool ref, with OPERATOR+
  add/edit/delete) plus a read-only `StorageConsumersSection` ("assets depending on this pool", each row
  linking to the consumer asset) — replacing the previous `NotYetTracked` placeholder. The dashboard
  Operations view's capacity card (`CapacityVirtualization.tsx`) gained a third **Storage** card
  (total capacity / used / free) fed by the new `summary.storage`.
  - **Verification:** Full CRUD + business-logic round-trip verified **in-process** against a fresh
    migrated temp SQLite DB via `createApiApp().handle()` (per the documented stale-`:3461` pattern) —
    13/13 assertions: unauthenticated list → 401; create → 201 persisting used capacity; used>capacity
    → 400; unknown storage pool → 400; list returns the allocation; the pool's `storage-consumers`
    endpoint joins and resolves the consumer asset name; update → 200; over-provisioning on update →
    400; the dashboard `/infrastructure/summary` `storage` aggregate reports used=1500, free=548,
    pools=1; delete → 200 with an empty subsequent list and a re-delete → 404. **Browser verification
    was deferred:** the launcher-managed `:3461` backend is stale (confirmed — its live
    `/api/v1/docs/json` OpenAPI spec contains no `storage-allocations`/`storage-consumers` routes), so a
    UI load of the Storage tab would 404 and trip the global `throwOnError` error boundary (the
    documented stale-backend artifact, not a regression); per the hard constraints the user-owned
    server was not restarted, so the in-process harness stands as the authoritative runtime check. A
    human should confirm the Storage tab and the dashboard Storage card once the backend is refreshed.
    `typecheck` (shared + backend + frontend + scripts), `lint` (all workspaces, `--max-warnings 0`),
    `build`, and `format:check` all pass, as do `check:schema-parity` and `check:api-types` (198
    endpoints, all enum types consistent). `smoke:qc` still fails only on the pre-existing template
    drift of `backend/src/guards/role.ts` (a "pure" file untouched by this work), exactly as documented.

- **`saved-views` (Session 23):** Delivered reusable, named inventory filter views so users can save
  and re-apply the answers to recurring infrastructure questions. **Backend:** a new `saved_views`
  table (SQLite `db/schema/savedViews.ts` + byte-parity PostgreSQL mirror `db/schema-pg/savedViews.ts`,
  both registered in the schema `index.ts` files; migration `20260704022709_tired_hedge_knight.sql`
  generated via `db:generate`) holding a JSON `filters` map scoped per user + workspace with the
  standard soft-delete/audit columns and the dashboard_configs cascade pattern. A pure
  `services/savedViewService.ts` (list/create/update/delete, each scoped by owner + active workspace,
  bounded by `MAX_SAVED_VIEWS_PER_USER` = 50, with `sanitizeFilters` dropping any key not in the shared
  `SAVED_VIEW_FILTER_KEYS` allow-list and trimming/oversize-guarding values) backs a new
  `routes/savedViews.ts` mounting `GET/POST/PUT/DELETE /saved-views` (all `requireAuth`, workspace-access
  guarded on writes, SYSOP cross-workspace when no `X-Workspace-ID`), registered in `create-api-app.ts`.
  New shared constants in `assetDomain.ts`: `SAVED_VIEW_FILTER_KEYS`, `SavedViewFilterKey`,
  `MAX_SAVED_VIEWS_PER_USER`, `SAVED_VIEW_NAME_MAX_LENGTH`. **Frontend:** `api/savedViews.ts` (typed CRUD
  callers), `hooks/assets/useSavedViews.ts` (workspace-keyed list query + create/update/delete mutations
  with cache invalidation; the list query sets `throwOnError: false` so a saved-views fetch failure
  degrades to an empty dropdown rather than crashing the inventory page — same graceful-degradation
  pattern as the relationship map's owners query), `pages/assets/savedViewSeeds.ts` (seven built-in
  "common question" presets — physical servers, VMs, hypervisor hosts, business services,
  internet-exposed ports, ports needing review, unverified/stale lifecycle — each mapping to real
  inventory filter params), and `pages/assets/SavedViewsBar.tsx` (a "Views" dropdown listing the seeds
  and the user's saved views with inline delete, plus a "Save view" dialog that names and persists the
  current filters). Wired into `AssetInventoryPage.tsx`: the page reduces its active URL filters to the
  persistable keys for saving, and `applyView` clears the saved-view keys and applies a view's filters
  to the URL (resetting pagination), so loading a seed or saved view drives the existing URL-synced
  filter state. Relational questions that are not a single inventory filter ("which VMs run on *this*
  host", "what breaks if *this* asset is offline") are intentionally left to the existing topology map
  (`/relationships/map`) and per-asset impact analysis rather than duplicated as filter presets.
  - **Verification:** Full persisted CRUD round-trip verified **in-process** against a fresh
    migrated temp SQLite DB via `createApiApp().handle()` (per the documented stale-`:3461` pattern):
    unauthenticated list → 401; create → 201 with unknown filter keys sanitised out and known keys kept;
    list returns the saved view; update changes name + filters; delete soft-deletes it (subsequent list
    empty; re-delete → 404). All 12 assertions passed. **Live browser** (frontend `:3460`, operator):
    the inventory page renders the "Views" + "Save view" controls; "Save view" is disabled with no
    filters and enabled once a filter is active (confirming the `currentFilters` reduction); applying a
    filter via the URL — the exact mechanism `applyView`/seeds use — drives the filter dropdowns and
    re-queries the table with no console errors and no error boundary. **Fixed during verification:** the
    saved-views list query 404ing against the stale `:3461` backend initially crashed the inventory page
    to the global error boundary (the app's default `throwOnError`); adding `throwOnError: false` makes
    the auxiliary query degrade gracefully. **Note:** the Radix dropdown could not be opened under
    agent-browser (documented tooling limitation), so seed selection was exercised via the URL path it
    produces rather than by clicking inside the menu; the UI-managed `:3461` instance was left running and
    not restarted. `typecheck` (shared + backend + frontend + scripts), `lint` (all workspaces,
    `--max-warnings 0`), `build`, `format:check`, `check:schema-parity`, `check:api-types`,
    `check:feature-integration`, and `check-docs` all pass; `check:max-lines` still flags only the same
    pre-existing oversized files (none touched here). `smoke:qc` still fails only on the pre-existing
    template drift of `backend/src/guards/role.ts` (a "pure" file untouched by this work).

- **`relationship-map-view` (Session 22):** Delivered the interactive dependency and topology map —
  a pannable, zoomable force-directed graph of the infrastructure relationship model, complementing
  the accessible table view. **Frontend-only** (consumes the existing `GET /relationships` and
  `GET /owners` endpoints; no backend change). New `pages/relationships/graph/` module: `graphTypes.ts`
  (pure `buildGraph` that de-duplicates relationship endpoints into nodes/edges and accumulates node
  degree, `subgraphAround` — a cycle-safe undirected BFS that powers single-asset scoping and one-hop /
  multi-hop expansion, and `filterGraphByAssetType`), `graphLayout.ts` (a deterministic, seedless
  force-directed layout — circle seed + pairwise repulsion + edge springs + cooling over a fixed 300
  iterations inside a memo, so the same graph always lays out identically with no animation loop or
  timers), `graphDisplay.ts` (categorical asset-type node colours and relationship-type edge colours),
  `TopologyCanvas.tsx` (the SVG renderer: directional arrow edges coloured by relationship type,
  asset-type-coloured node discs with the matching lucide icon + label, selection highlighting that
  dims non-incident edges/nodes, background-drag pan, wheel/cursor-anchored zoom, and fit/zoom
  controls — viewBox reframing is done by adjusting state during render, not in an effect),
  `TopologyMapFilters.tsx` (search + relationship-type / asset-type / criticality / status / confidence
  / owner filters, a focus chip, and a hop-depth expansion selector, all URL-synced so a map view is
  shareable), and `NodeInspector.tsx` (a side panel for the selected node: its direct relationships
  with direction, plus "Focus map", "Impact" — deep-linking to the asset detail Relationships tab —
  and "Open asset" entry points). Orchestrated by `RelationshipMapPage.tsx` (scope/focus/depth/asset-type
  applied client-side over the fetched edge set; graceful loading, error, and empty states). Data comes
  from a new `hooks/relationships/useRelationshipGraph.ts` (one wide page, capped at the API's
  `MAX_PAGE_LIMIT`, with a truncation banner surfaced when `total` exceeds the fetched rows). The
  accessible table stays reachable both ways: a "Map view" button on the relationships table and a
  "Table view" button on the map. `hooks/owners/useOwners.ts` gained an optional `throwOnError` flag
  (default unchanged) so the map's owner-filter dropdown degrades gracefully — an owners fetch failure
  no longer crashes the whole map. Wired into `routes/lazyPages.ts` and `routes.tsx` at
  `/relationships/map` under the base VIEWER `ProtectedRoute`.
  - **Verification:** Live browser verification passed against the running app (frontend :3460, backend
    :3461) as admin. The map renders nodes and edges for the seeded topology (no console error boundary);
    a filter that matches nothing (`?type=depends_on` against `runs_on`-only seeds) degrades to the
    "Nothing to map" empty state; a matching filter re-renders the graph without errors; clicking a node
    opens the inspector with Focus/Impact/Open-asset entry points; "Focus map" scopes the graph to that
    asset (`scope=focus&focus=<id>&depth=1`) and reveals the hop-depth expansion control; depth 2 expands
    the neighbourhood; and the "Table view" link back to `/relationships` is present. The final screenshot
    shows two asset-type-iconed node discs joined by a green (`runs_on`) directional edge with clean
    contrast. **Note:** the UI-managed :3461 backend is stale — its `/relationships` response predates the
    endpoint-name/type enrichment (`services/relationshipQueries.ts` returns `sourceAssetName`/`Type` etc.
    in current source) and its `/owners` route 404s — so live labels fall back to `Asset #<id>` with
    default styling; this is the same documented stale-backend class as Sessions 16/19/20/21. Per the
    UI-managed-instance rule the instance was left running and not restarted; a human should reconfirm real
    asset names and per-type node colours once the backend is refreshed. `format:check`, `typecheck`
    (shared + backend + frontend + scripts), `lint` (frontend `--max-warnings 0`), `build` (frontend
    chunk emitted), `check:api-types`, `check:schema-parity`, `check:feature-integration`, and `check-docs`
    all pass; every new file is under the 300-line modularity limit (`check:max-lines` still flags only the
    same four pre-existing oversized files, none touched here).

- **`impact-analysis` (Session 21):** Delivered upstream/downstream dependency impact analysis that
  answers "what breaks if this asset is offline?". **Backend:** a pure graph module
  `services/impactGraph.ts` (the `PROVIDER_ENDPOINT` direction map that classifies each of the nine
  relationship types as provider→dependent — e.g. a VM `runs_on` a host means the host provides, so a
  host outage cascades to the VM; `connects_to`/`owned_by` are non-runtime and excluded so they never
  produce a false impact — plus `buildAdjacency`, a cycle-safe BFS `traverse`, and `maxDepth`) and a
  data facade `services/impactAnalysisService.ts` (`analyzeImpact(assetId)` loads the active asset
  index and active relationships, reduces each edge to a directed dependency edge dropping edges to
  inactive endpoints, then BFS-walks the provider adjacency for **downstream** (impact-if-offline) and
  the dependent adjacency for **upstream** (depends-on), tagging every reached node with its hop depth
  and the edge type that reached it; **affected business services** are the downstream nodes of type
  `business_service`). A new `GET /relationships/impact/:assetId` (VIEWER+) on `routes/relationships.ts`
  returns the analysis or a 404 when the root asset is missing/soft-deleted; the traversal is bounded
  by a `MAX_ASSETS` guard (20 000). **Frontend:** `api/impact.ts` (types + `getAssetImpact` caller),
  `hooks/relationships/useAssetImpact.ts` (query keyed `['asset-impact', id]`), and an
  `ImpactAnalysisSection.tsx` that replaces the placeholder in the asset detail **Relationships** tab —
  stat tiles (breaks-if-offline, services affected, depends-on, max impact depth), a "Business services
  affected" list, a "What breaks if this asset is offline" (downstream) list, and a "What this asset
  depends on" (upstream) list, each row linking to the asset with its relationship type, criticality,
  and Direct/N-hops badge; it degrades to a clear empty state when the asset has no recorded
  dependencies and to a compact error state on failure. Impact is also reachable **from the
  relationship views**: the asset detail tabs are now deep-linkable via a `?tab=` query param, and the
  relationship table gained an **Impact** column with Source/Target links that jump straight to each
  endpoint's Relationships tab.
  - **Verification:** Exercised **in-process** against a fresh file-based temp SQLite DB migrated via
    `runAutoMigrations` over a host→vm→service topology with a storage dependency — **12 assertions all
    passed**: the host's downstream is exactly the VM (depth 1) and the business service (depth 2,
    proving **multi-hop** traversal); `affectedServices` is exactly the one business service; the host's
    upstream includes the storage appliance; the VM's upstream resolves both the host and (multi-hop) the
    storage it depends on; summary counts (downstream 2, affected 1, maxDownstreamDepth 2, upstream 1) are
    correct; an isolated asset returns empty upstream/downstream (graceful degradation); a missing asset
    yields a null root; and `createApiApp().handle()` (after `await app.modules`) confirms
    `/relationships/impact/1` is **registered** and auth-guarded (401, not 404). `format`, `typecheck`
    (shared + backend + frontend + scripts), `lint` (backend `--max-warnings 0` + frontend clean),
    `check:api-types` (PASS, 189 endpoints, enums consistent), `check:schema-parity` (OK — no schema
    change), and `build` (backend + frontend) all pass; both new backend files are under the 300-line
    modularity limit (`check:max-lines` still flags only the same pre-existing oversized files).
    **Live browser verification was deferred:** the UI-managed backend on :3461 is stale (it 404s the new
    `/relationships/impact/:id` route, exactly as it already does for Session 16 `/search`, Session 19
    `/imports`, and Session 20 `/reports`), so per the UI-managed-instance rule the instance was left
    running and not restarted. A human should confirm the Relationships-tab impact view and the
    relationship-table Impact links in the browser once the backend instance is refreshed.

- **`export-reports` (Session 20):** Delivered CSV/JSON exports and audit-friendly reports across
  every domain the dashboard tracks. **Backend:** a dependency-free `utils/csv.ts` (`toCsv()` — RFC4180
  escaping matching the import parser, with a spreadsheet formula-injection guard); a report registry
  under `services/reports/` — `sources.ts` (bounded `collectAll()` pager capped at 10 000 rows,
  `collectAssets()` which redacts sensitive asset fields per the caller's role via `redactAssetForRole`,
  `ownerNames()`, and a direct `collectPorts()` join) and `definitions.ts` (nine reports: **data
  exports** for assets, relationships, services, ports, and a flattened management summary; **audit
  reports** for change history, ownership gaps, internet-exposed ports, and lifecycle status). A thin
  `reportService.ts` facade (`listReports`/`isReportKey`/`buildReport`) and a new `routes/reports.ts`
  expose `GET /reports` (catalog) and `GET /reports/summary` (full `InfrastructureSummary`) as VIEWER+
  JSON, and `GET /reports/:key?format=csv|json` as a VIEWER+ downloadable file attachment
  (content-disposition + `nosniff`), every export audited (`REPORT_EXPORT`). Registered in
  `create-api-app.ts`. Exports are **permission-filtered**: a VIEWER downloading the assets/lifecycle/
  ownership reports gets notes, management URL, and support contact redacted, exactly as the inventory
  list does. **Frontend:** `api/reports.ts` (catalog/summary/`download` blob callers), `hooks/reports/
  useReports.ts` (catalog + summary queries), a `pages/reports/ReportsPage.tsx` (export catalog grouped
  into Data exports vs Audit reports, each card with one-click CSV/JSON download via `apiClient.download`
  + `downloadBlob`), and a printable `ManagementSummaryPage.tsx` (stat tiles, per-dimension breakdown
  cards, risk indicators, and a `window.print()` action with `print:hidden` chrome). Wired into
  `lazyPages.ts`, `routes.tsx` (`/reports` and `/reports/summary` under the base VIEWER `ProtectedRoute`),
  and the sidebar `navConfig.tsx` (VIEWER+, new "Reports" entry).
  - **Verification:** Exercised the feature **in-process** against a fresh file-based temp SQLite DB
    migrated via `runAutoMigrations` — **19 assertions all passed**: the catalog lists all nine reports;
    the assets report returns both seeded assets with owner names resolved and, crucially, an OPERATOR
    sees the curated note while a VIEWER's copy has it redacted to `null` (permission-filtered exports);
    ownership-gaps surfaces only the un-owned asset; lifecycle flags the past-support asset as
    `unsupported`; ports/exposed-ports return the single internet-exposed 443/tcp row; the summary rows
    report 2 total assets and 1 unowned; `toCsv` emits a CRLF header + 2 rows and neutralizes a `=1+2`
    formula-injection cell; and `createApiApp().handle()` confirms `/reports`, `/reports/summary`, and
    `/reports/assets` are **registered** (unauthenticated → 401, not 404). `format`, `lint` (backend
    `--max-warnings 0` + frontend clean), `typecheck` (shared + backend + frontend + scripts),
    `check:api-types` (exit 0), `check:schema-parity` (OK), and `build` (backend + frontend) all pass.
    `check:max-lines` still exits 1 only on the seven **pre-existing** oversized files (services schema,
    relationshipQueries, serviceCatalogService, assetPortService, services route, ServiceDetailPage) —
    none of the new report files exceed 300 lines. **Live browser verification was deferred:** the
    UI-managed backend on :3461 is stale (it 404s the new `/reports` route, as it already does for
    Session 16 `/search` and Session 19 `/imports`), so it predates this change; per the
    UI-managed-instance rule the instance was left running and not restarted. A human should confirm the
    Reports catalog, CSV/JSON downloads, and the printable Management Summary in the browser once the
    backend instance is refreshed.

- **`csv-import-review` (Session 19):** Delivered staged CSV asset import with server-side
  validation, duplicate detection, per-row review, and a single-shot apply that never silently
  overwrites human-entered context. The `imports`, `import_rows`, and `asset_change_events` tables
  already existed (Session 18 migration) — this feature adds the parse/stage/apply service, the
  routes, and the review UI. **Backend:** a new `assetImportService.ts` — `parseCsv()` (an
  RFC4180-style parser handling quoted fields, embedded commas/newlines, doubled-quote escaping, and
  LF/CRLF); `createAssetImport()` (maps each CSV row to asset fields via a case-insensitive header
  alias table — `asset_type`/`AssetType`/`type` all resolve — validates required `name`/`assetType`
  and enum `status`/`criticality` server-side, checks duplicates against existing active assets by
  hostname/FQDN/IP/serial/asset-tag or exact name, and stages every row as `pending` (clean new),
  `duplicate` (matched existing → `targetAssetId` set), or `needs_review` (blocking validation error);
  missing admin-required fields surface as a non-blocking warning; persists an `imports` batch in
  `reviewing` status plus one `import_rows` record per source row); `listImports()`/`getImportById()`
  (read side); `setRowDisposition()` (accept/reject a single row — refuses to accept a `needs_review`
  row and refuses any change once the batch is terminal); and `applyImport()` (single-shot: for each
  `accepted` row, creates a new asset or updates its matched duplicate, records an `import`
  change-event linked by `importId`, and — when the `neverOverwriteNotes` infrastructure setting is
  on — preserves curated notes on an existing asset; rejected/pending/needs-review rows never mutate
  any record; sets the batch to `applied`/`partial`/`rejected` and cannot be re-run). A new
  `routes/imports.ts` exposes `GET /imports` and `GET /imports/:id` (VIEWER+), `POST /imports`,
  `PATCH /imports/:id/rows/:rowId`, and `POST /imports/:id/apply` (OPERATOR+), each audited via
  `auditService.log` (`ASSET_IMPORT_CREATE`/`_ROW_REVIEW`/`_APPLY`); the create body caps CSV at 1 MB
  and empty-data CSV is rejected with a 400; registered in `create-api-app.ts`. **Frontend:**
  `api/imports.ts` (types + get/list/create/review/apply callers), `hooks/imports/useImports.ts`
  (list/detail queries + create/review/apply mutations invalidating `['imports']` and `['assets']`),
  and an **Imports** section: `pages/imports/ImportsPage.tsx` (batch list with status/row/accepted/
  rejected/warning columns and a "New import" dialog), `NewImportDialog.tsx` (paste CSV or load a
  `.csv` file into a mono textarea, optional source label), and `ImportDetailPage.tsx` (summary tiles
  + a per-row review table with accept/reject controls gated to OPERATOR+ and open batches, plus a
  confirm-guarded Apply). Wired into `lazyPages.ts`, `routes.tsx` (`/imports` and `/imports/:id` under
  an `OPERATOR` `ProtectedRoute`), and the sidebar `navConfig.tsx` (OPERATOR+). `importDisplay.ts`
  centralizes status→label/badge-variant maps.
  - **Verification:** Exercised the service end-to-end **in-process** against a migrated throwaway
    temp SQLite DB — **30 assertions all passed**: the CSV parser splits quoted/embedded-comma/
    doubled-quote CRLF rows correctly; a 4-row import stages as pending / duplicate (targeting the
    seeded asset) / needs_review (bad enum) / needs_review (missing name) with `warningCount` 2;
    accepting a `needs_review` row is refused; apply creates the new asset, updates the matched
    duplicate's name/role, **preserves curated notes** under `neverOverwriteNotes`, records exactly 2
    `import` change-events linked by `importId`, leaves the two bad rows' records untouched (total
    assets 2, no `bad01`), sets the batch `partial`, and refuses re-apply and post-terminal review;
    empty-data CSV is rejected. A second in-process pass via `createApiApp().handle()` confirmed all
    five routes are **registered** (unauthenticated GETs return 401 and the state-changing POST/PATCH
    hit the CSRF/role layers — none 404). `format`, `lint` (backend `--max-warnings 0` + frontend
    clean), `typecheck` (backend + frontend), `check:api-types`, `check:schema-parity` (OK), and
    `build` (backend + frontend) all pass. `check:drift` still exits 1 only on the pre-existing
    branded/pure drift (`role.ts` + the branded infra files documented since Session 3); the
    `create-api-app.ts` edit remains suppressed via `.templateoverrides` [KEEP], and the pre-commit
    hook does not run drift, so the commit is unaffected. Live browser verification was **deferred**:
    the UI-managed backend on :3461 is stale — it 404s both `/search` (Session 16) and the new
    `/imports`, so it predates this change; per the UI-managed-instance rule the instance was left
    running and not restarted. A human should confirm the Imports list, the New Import dialog, and the
    row-review → apply flow in the browser once the backend instance is refreshed.

- **`admin-settings` (Session 18):** Added administrator-managed settings for the infrastructure
  domain — required asset fields, the default stale-data threshold, a default dashboard/inventory
  filter preset, and staged-import behavior — persisted through the existing key-value Setting store
  (single JSON blob under key `infra.domain`; no schema change). **Shared:** `assetDomain.ts` gained
  `REQUIRABLE_ASSET_FIELDS` (the curated subset of asset fields an admin may make mandatory at manual
  entry — `name`/`assetType` are always required and excluded) plus `IMPORT_DUPLICATE_STRATEGIES`
  (`skip`/`review`/`update`) and their derived types, re-exported from `shared/src/index.ts`.
  **Backend:** a new `infrastructureSettingsService.ts` owns the typed settings —
  `getInfrastructureSettings()` (lazily seeds defaults — empty required list, threshold 90, `review`/
  never-overwrite-notes, no default filters — then reads, parses, and *normalises* the stored blob so
  unknown field names, out-of-range thresholds, and bad enum values are dropped; 60 s TTL cache
  mirroring the auth-settings pattern), `updateInfrastructureSettings(patch, actorId)` (field-by-field
  merge of nested objects, persist, bust cache), and `missingRequiredAssetFields(input)` (a field is
  missing when null/undefined or a blank string). A new `settings/infrastructure.ts` route exposes
  `GET /settings/infrastructure` (VIEWER+ — non-sensitive operational config the dashboard and
  inventory read) and `PUT /settings/infrastructure` (ADMIN+, audited `SETTINGS_UPDATE`); the PUT body
  is a strict TypeBox partial (required-field array constrained to the requirable-field union, threshold
  bounded to `[MIN,MAX]`, filter enums nullable, duplicate-strategy enum), so invalid input is rejected
  with a validation 400. Registered in `settings/index.ts`. **Application (spec item 3):** (a)
  *dashboard* — `documentationHealth.ts` dropped the hard-coded `thresholdDays` schema default so an
  omitted query now resolves to the configured `staleThresholdDays` (per-request override still honored),
  making the admin setting the authoritative stale-data default for the whole documentation-health
  surface; (b) *inventory* — the `POST /assets` handler now rejects a create that omits any configured
  required field with a 400 naming the missing fields (manual-entry validation); (c) *inventory* — the
  asset inventory page seeds the configured default filter preset (status/type/criticality) into the URL
  filters on first visit when none are set. Import behavior is persisted and validated but has no live
  consumer yet — it is the policy the future `csv-import-review` flow will read. **Frontend:**
  `api/infrastructureSettings.ts` (types + `get`/`update` callers), `hooks/settings/`
  `useInfrastructureSettings.ts` (query + mutation that writes the cache back and invalidates the
  documentation-health queries), and a new **Infrastructure** settings tab
  (`pages/settings/infrastructure/InfrastructureTab.tsx`) — required-field checkbox grid, a bounded
  threshold input, three default-filter selects, and the import-behavior switch + duplicate-strategy
  select, with a single Save. Wired into `SettingsLayout` (tab), `routes.tsx`, and `lazyPages.ts`; the
  pure-template `SettingsLayout.tsx` edit is acknowledged via a `.templateoverrides` `KEEP` entry (same
  sanctioned mechanism as `create-api-app.ts`). OpenAPI now extracts two more endpoints.
  - **Verification:** Exercised end-to-end **in-process** (`createApiApp().handle()` against a migrated
    throwaway temp SQLite DB seeded with an ADMIN user) — **18 assertions all passed**: GET returns
    seeded defaults; PUT persists and normalises the required-field order; GET reflects persistence;
    invalid field name and below-minimum threshold are both rejected (validation 400); asset create is
    blocked (400 naming `hostname`/`primaryIp`) when required fields are missing and succeeds (201) when
    present; a partial `{staleThresholdDays}` update preserves the required-field list; and the
    documentation-health summary defaults to the configured threshold (45) while an explicit
    `?thresholdDays=100` overrides it, with a 60-day-old asset provably stale at 45 but not at 100
    (stale-count delta exactly 1). `format`, `typecheck`, `lint` (backend `--max-warnings 0` + frontend
    clean), `check:api-types` (enum-consistency PASS), `check:schema-parity` (OK), and `build` (backend +
    frontend) all pass. `check:drift` still exits 1 only on the pre-existing branded/pure drift
    (`role.ts` and the 9 branded files documented since Session 3) — the new `SettingsLayout.tsx` edit is
    suppressed via `.templateoverrides`; the pre-commit hook does not run drift, so the commit is
    unaffected. Live browser verification was **deferred**: the UI-managed backend on :3461 is stale — it
    404s `/search` and `/assets/:id/ports` (Sessions 16–17 routes), so it predates this change and cannot
    serve `/settings/infrastructure`; per the UI-managed-instance rule the instance was left running and
    not restarted (same artifact documented for Sessions 14–17). A human should confirm the
    Settings → Infrastructure tab and the inventory default-filter seeding in the browser once the backend
    instance is refreshed.

- **`port-exposure-tracking` (Session 17):** Delivered per-asset port tracking that distinguishes
  documented (expected) ports from imported scan observations, and made the whole inventory filterable
  by port attributes. The `asset_ports` table already existed (name/port-number search already read it
  in global search; the dashboard already counted unknown-review ports) — this feature adds the write
  side, the detail-page UI, and the inventory filters. **Backend:** a new `assetPortService.ts` —
  `listAssetPorts(assetId)` (ordered by port number then protocol then id), `getAssetPort`,
  `createAssetPort` (validates the asset is active and the referenced catalog service, when set, is
  active; requires a port number; coerces `verifiedAt` from an ISO string to a timestamp; enum fields
  fall back to their column defaults `tcp`/`unknown`/`documented`/`expected`; records a `create` event
  on the asset trail with `entityType: 'asset_port'`), `updateAssetPort` (partial patch scoped to the
  owning asset; null clears a nullable column; audited), and `deleteAssetPort` (hard delete, audited).
  Four endpoints were added under the existing assets router: `GET /assets/:id/ports` (VIEWER+),
  `POST /assets/:id/ports`, `PATCH /assets/:id/ports/:portId`, `DELETE /assets/:id/ports/:portId`
  (OPERATOR+). **Filtering (spec item 5):** `listAssets` gained five port-based filters —
  `protocol`, `portNumber`, `exposureLevel`, `portReviewState`, and `portServiceId` — implemented as an
  `inArray(assets.id, <asset_ports subquery>)` so an asset matches when it has at least one port
  satisfying every supplied condition; the `GET /assets` route exposes them as `protocol`,
  `portNumber`, `exposureLevel`, `reviewState`, and `serviceId` query params (typed to the shared port
  enums). OpenAPI now extracts **178** endpoints (was 174). No schema change (the SQLite `asset_ports`
  table and its byte-parity PostgreSQL mirror already existed). **Frontend:** `api/assets.ts` gained the
  `AssetPort` type + `PortInput` and the `getAssetPorts`/`createAssetPort`/`updateAssetPort`/
  `deleteAssetPort` callers; `hooks/assets/useAssetPorts.ts` (list + create/update/delete mutations
  invalidating the port list and the asset change-event trail); `pages/assets/portDisplay.ts`
  (label/badge-variant helpers for exposure level, review state, and source — internet exposure and the
  unexpected review state render as `destructive`); a `PortDialog.tsx` (protocol/exposure/source/review
  selects, a required port-number input bounded 0–65535, a free-text service name plus an optional
  catalog-service picker, a `verifiedAt` date input, scope, and notes); and an `AssetPortFilters.tsx`
  secondary filter row on the inventory page (protocol / exposure / review-state / service selects plus
  a port-number input, each URL-synced). The asset detail page's previously-placeholder **Ports** tab
  now renders a real "Ports" section — per-port cards showing `PROTOCOL/number`, the service name,
  review-state and exposure badges, source, scope, and last-verified, with OPERATOR+ add / edit /
  delete actions — mirroring the proven network-interfaces and service-assignment sections.
  - **Verification:** The port CRUD, validation, ordering, and all five list filters were verified
    deterministically in-process against a migrated throwaway temp SQLite DB seeded with an OPERATOR
    user, two assets, and a catalog service — **21 assertions all passed**: create with catalog-service
    attribution and `verifiedAt` coerced to a Date; minimal create applying enum defaults; unknown
    service and unknown asset both rejected as validation/not-found; list ordering by port number;
    review-state update; update scoped to the owning asset (wrong-asset update → not found); filter by
    exposure, review state, port number, protocol, and owning service (plus a no-match protocol and a
    combined exposure+port-number intersection); delete and idempotent re-delete (→ null). `format`,
    `typecheck`, `lint` (backend `--max-warnings 0` and frontend clean), `build`, and `check:api-types`
    (178 endpoints, enum-consistency PASS) all pass. Live browser verification against the running stack
    was **deferred**: the UI-managed backend on :3461 is severely stale — it 404s **every** asset-domain
    route (`/assets`, `/services`, `/search`, `/assets/1/network-interfaces`), so it predates the entire
    asset-domain feature set, the same pre-existing stale-instance artifact documented for Sessions
    14–16, not a regression from this change. Per the UI-managed-instance rule the instance was left
    running and not restarted. The Ports section and inventory filters compile and reuse the identical
    `useQuery`/`useMutation` + card/badge/dialog patterns already proven for network interfaces and
    service assignments, and the data path itself is proven by the in-process run above. A human should
    confirm the `/assets/:id` Ports tab and the inventory port filters in the browser once the backend
    instance is refreshed.

- **`global-search` (Session 16):** Delivered cross-domain global search across the infrastructure
  inventory — one query surfaces assets and services matched on any of their own or related fields.
  **Backend:** a new `globalSearchService.ts` — `globalSearch(term, role, limit)` aggregates matches
  from many sources into two typed, grouped result sets. Assets are matched directly (name, hostname,
  FQDN, primary IP, serial, asset tag, role, OS, OS version, platform, description) and via related
  records — aliases (`asset_aliases.value`), tags (`asset_tags.label`), network interfaces
  (`ip_address` / `mac_address` / `dns_name` / interface name), documented ports
  (`asset_ports.service_name`, plus an exact `port_number` match when the term is numeric), and owner
  name (surfacing assets the owner backs). Services are matched on name / category / description, plus
  owner name (surfacing owned services). Every result carries a `matchedFields` list of human-readable
  labels ("name", "IP", "alias", "port", "owner", …) so the UI can explain *why* a record surfaced.
  Soft-deleted assets and services are never returned; each underlying source query is bounded
  (`PER_SOURCE_SCAN_LIMIT`) and each group is capped to a clamped `limit` (default 20, max 50). **Role
  enforcement (spec item 3):** the restricted asset fields redacted by `assetVisibility`
  (`notes`, `managementUrl`, `supportContact`), the service `notes` field, and owner `email` are only
  included in the search when the caller's fresh, DB-verified effective role is OPERATOR+, so a VIEWER
  cannot locate a record by content they are not permitted to see. One endpoint was added:
  `GET /search?q=&limit=` (VIEWER+), registered on a new `searchRoutes` plugin; OpenAPI now extracts
  **174** endpoints (was 173). No schema change (all searched tables already existed). **Frontend:**
  new `api/search.ts` (types + `globalSearch` caller), `hooks/search/useGlobalSearch.ts` (fires once the
  term reaches a 2-char minimum, `keepPreviousData` to avoid flicker), and a `pages/search/GlobalSearchPage.tsx`
  — a URL-synced (`?q=`), debounced search box over grouped, typed result cards. Asset cards link to
  `/assets/:id` (asset-type icon, criticality badge, hostname/IP line) and service cards link to
  `/services/:id` (category, criticality), each showing the `matchedFields` as badges. Added a **Search**
  entry to `navConfig` (so it appears in the sidebar/top-bar nav *and* the Ctrl+K command palette, which
  sources its pages from navConfig) and a `/search` route.
  - **Verification:** The search logic and role enforcement were verified deterministically in-process
    against a throwaway migrated temp SQLite DB seeded with owners, assets (with alias/tag/interface/port
    and a sensitive note), a soft-deleted asset, and two services — **22 assertions all passed**: direct
    name/hostname match; alias/tag/interface-IP/numeric-port matches each resolving to the owning asset
    with the correct `matchedFields` label; owner-name match surfacing both the owned asset and owned
    service; service-name match; soft-deleted asset never surfacing; **VIEWER cannot find an asset or
    service by `notes` content while OPERATOR can (labelled "notes")**; VIEWER cannot search owner email
    while OPERATOR can; blank term → empty; and `limit` clamping to 50. `format`, `typecheck`, `lint`
    (backend `--max-warnings 0` and frontend `react-x`/`react-hooks` all clean), `build`, and
    `check:api-types` (174 endpoints, PASS) all pass. Live browser verification of the running stack was
    **deferred**: the UI-managed backend on :3461 is stale (it 404s even the pre-existing `/services`
    route, so it predates the search route) and an `agent-browser open` against the frontend timed out —
    the same pre-existing stale-instance artifact documented for Sessions 14–15, not a regression from
    this change. The instance was left running per the UI-managed-instance rule. The page compiles and
    its result-rendering follows the identical `useQuery` + card/badge patterns already proven elsewhere,
    and the data path itself is proven by the in-process run above. A human should confirm the `/search`
    page and its grouped results in the browser once the backend instance is refreshed.

- **`asset-service-assignment` (Session 15):** Let operators assign catalog services to assets with a
  role label, closing the write side of the `asset_services` join (the service detail page could already
  read backing assets, but nothing could create them outside the seed). **Backend:** a new
  `assetServiceAssignmentService.ts` — `listAssignedServices(assetId)` (join `asset_services` →
  `service_catalog`, resolving each row to the service name/category/criticality, primary first then by
  name, soft-deleted services excluded), `createServiceAssignment` (validates the asset and service are
  both active, rejects a duplicate `(assetId, serviceId)` with 409, records a `create` event on the
  asset trail, and demotes any other asset marked primary for the same service so at most one primary
  backing asset survives — the invariant the service detail's ordering relies on), `updateServiceAssignment`
  (role / primary / notes; the target service is create-only), and `deleteServiceAssignment`, both
  scoped to the owning asset and audited. Four endpoints were added under the existing assets router:
  `GET /assets/:id/services` (VIEWER+), `POST /assets/:id/services`, `PATCH /assets/:id/services/:assignmentId`,
  `DELETE /assets/:id/services/:assignmentId` (OPERATOR+). OpenAPI now extracts **173** endpoints (was 169).
  **Frontend:** `api/assets.ts` gained the `AssignedService` type + `getAssetServices` / `createAssetService` /
  `updateAssetService` / `deleteAssetService` callers, a `hooks/assets/useAssetServices.ts` (list + create/update/delete
  mutations invalidating the assignment list, the asset change-event trail, and the `services` catalog cache),
  and an `AssignServiceDialog.tsx` (a service picker excluding already-assigned services on create; role,
  primary, notes editable; the target service fixed on edit). The asset detail page's previously-placeholder
  **Services** tab now renders a real "Assigned services" section — per-service cards linking to the service
  detail, showing role/category/criticality and a Primary badge, with OPERATOR+ assign / edit / unassign
  actions — mirroring the existing network-interfaces section. Because assignments write to `asset_services`,
  each one automatically surfaces on the target service's detail page (backing assets) as well.
  - **Verification:** The full HTTP surface was verified deterministically in-process against the real API
    app (`createApiApp().handle`) on a throwaway migrated temp SQLite DB seeded with an OPERATOR + VIEWER
    user, two assets, and three services (one soft-deleted) — **22 assertions all passed**: unauthenticated
    list → 401; VIEWER list → 200 empty; VIEWER create → 403; OPERATOR assign with role → 201 persisting the
    role; duplicate `(asset, service)` → 409; non-existent service → 404; soft-deleted service → 404;
    non-existent asset → 404; a second assignment lists both, resolved and primary-first; marking a second
    asset primary for the same service demotes the first; update applies role/notes → 200; update of an
    assignment not on the asset → 404; both assignments surface on the service detail's backing-asset list;
    delete → 200 and the row is gone; delete of a missing assignment → 404. `format`, `typecheck`, `lint`,
    `build`, `check:api-types` (173 endpoints, PASS), and `check:schema-parity` all pass (no schema change —
    `asset_services` already existed in both dialects). Live browser verification of the Services tab against
    the running frontend (:3460) was **deferred**: the UI-managed backend instance on :3461 is stale (it
    predates the hardware-profile, network-interface, and service-assignment sub-resource routes — all return
    404), so the asset detail page's on-mount sub-resource queries trip the global `shouldThrowOnError`
    boundary ("Something went wrong / Resource not found") before any tab data can load. This is a pre-existing
    stale-instance artifact (confirmed: `/assets/:id/hardware-profile` also 404s there), not a regression from
    this change, and the instance was left running per the UI-managed-instance rule. The new `useAssetServices`
    query uses the identical plain-`useQuery` pattern as the already-verified network-interfaces section, and
    the data path itself is proven by the in-process run above.

- **`service-catalog` (Session 14):** Delivered the business/technical service catalog end-to-end —
  API + UI for services (name, category, owner, criticality, expected availability, business
  purpose), their dependencies on other services and infrastructure assets, and the assets that back
  each one. The `service_catalog` / `asset_services` / `service_dependencies` tables existed from
  `asset-domain-schema` but had no service layer or surface. **Backend:** a new
  `serviceCatalogQueries.ts` (filterable/paginated `listServices` + `listServicesEnriched` resolving
  owner/vendor names and a backing-asset count per row, `getServiceDetail` assembling the record plus
  its backing assets — resolved from `asset_services`, primary first, soft-deleted assets excluded —
  and its dependencies with each target resolved to a display name, a case-insensitive
  `serviceNameExists`, and a `recordServiceEvent` that anchors service audit entries in
  `asset_change_events` with a null `assetId` and `entityType: 'service'`) and a
  `serviceCatalogService.ts` (`createService` / `updateService` with name-uniqueness + owner-existence
  validation, `softDeleteService`, and `addServiceDependency` / `removeServiceDependency` enforcing
  exactly-one-target, no self-dependency, and target existence). Eight endpoints were added:
  `GET/POST /services`, `GET/PATCH/DELETE /services/:id`, `POST /services/:id/dependencies`,
  `DELETE /services/:id/dependencies/:dependencyId` (VIEWER+ reads, OPERATOR+ writes), plus a small
  supporting `GET /owners` (VIEWER+, via a new `ownerService.ts`) so the service form and enrichment
  can resolve owners. OpenAPI now extracts **169** endpoints (was 161). The seed
  (`db/seed/domain.ts`) gained **VPN** and **Database** starter services so the seeded catalog covers
  the full spec set (AD, DNS, DHCP, file share, backup, VPN, database). **Frontend:** new
  `api/owners.ts` + `api/services.ts` (types + CRUD/dependency callers), `hooks/owners/useOwners.ts`,
  `hooks/services/useServices.ts` (list + create/update/delete mutations) and `useService.ts` (detail
  + add/remove-dependency mutations), and a `pages/services/` surface — `ServiceCatalogPage.tsx`
  (searchable, URL-synced table with category/criticality filters, name links to detail, OPERATOR+
  create/edit/soft-delete), `ServiceTableFilters.tsx`, `useServiceColumns.tsx`, `serviceDisplay.ts`
  (category label + suggested categories, reused criticality helpers), `ServiceFormDialog.tsx`
  (name/category-with-datalist/criticality/owner-select/availability/business-purpose/notes),
  `ServiceDetailPage.tsx` (overview facts, a Backing assets card linking each asset to its detail
  page, and a Dependencies card with add/remove for OPERATOR+), and `AddDependencyDialog.tsx`
  (service-vs-asset target picker). Wired into routing (`/services`, `/services/:id` lazy routes) and
  the sidebar nav (a "Services" entry with the `Boxes` icon, under Relationships).
  - **Verification:** The full HTTP surface was verified deterministically in-process against the real
    API app (`createApiApp().handle`) on a throwaway migrated temp SQLite DB seeded (via the real
    `seedDomainReferenceData`) with the 7 starter services plus an OPERATOR user, a VIEWER user, an
    owner, and two assets — **34 assertions all passed**: unauthenticated list → 401; VIEWER list →
    200 including the seeded catalog; VIEWER create → 403; `GET /owners` → 200 resolving the seeded
    owner; OPERATOR create → 201 persisting ownerId; duplicate name (case-insensitive) → 409;
    non-existent owner → 422; detail resolves owner name and returns empty backing-asset/dependency
    arrays; update applies fields; after assigning two `asset_services` rows the detail lists both
    backing assets (primary first, named) and the list row reports `backingAssetCount: 2`; adding a
    service dependency and an asset dependency each → 201, self-dependency → 422, two-target → 422,
    and the detail resolves both target names (DNS / FW01); remove dependency → 200; search and
    criticality filters behave; and soft-delete → 200 with the service then 404 and gone from the
    list. `format`, `typecheck`, `lint`, `build`, `check:api-types` (169 endpoints, PASS),
    `check:schema-parity`, and `check:feature-integration` all pass. The page was also verified in the
    browser (agent-browser) against the live frontend on :3460: the "Services" nav link renders and
    routes, the page shows its header, "New Service" action, search box, and both filter dropdowns.
    The table renders empty in that browser check because the running backend instance is stale
    (predates this session's routes — `/services` and `/owners` return 404 there) and was left
    untouched per the UI-managed-instance rule; the data path itself is proven by the in-process run
    above. `smoke:qc` was not run to completion because its `check:drift` step fails on a pre-existing
    `backend/src/guards/role.ts` template drift (unrelated, untouched this session) and `check:max-lines`
    is advisory (the repo already commits larger files, e.g. `assetService.ts:551`); the meaningful
    gates were run individually and pass.

- **`relationship-table-view` (Session 13):** Gave asset relationships a first-class, accessible
  table/list view — the structured equivalent of the dependency graph, so every edge the graph can
  draw has a keyboard- and screen-reader-friendly row. The relationship domain already had a full
  CRUD API (`GET /relationships` etc.) but no dedicated frontend surface. Backend: `GET /relationships`
  now returns **enriched** rows — each edge's source/target endpoint resolved to a display name and
  asset type — via a new `listRelationshipsEnriched` in `relationshipQueries.ts` (single batched
  lookup of the page's endpoint ids, soft-deleted assets still resolved so historical edges keep their
  names; re-exported through the `assetRelationshipService` facade). The list route also gained
  endpoint-attribute filters: `status`, `criticality`, `siteId`, `ownerId` (matches either
  `businessOwnerId`/`technicalOwnerId`), and free-text `search` (matches either endpoint's
  name/hostname/FQDN/primary IP). These match edges where *either* endpoint asset satisfies the
  criterion, implemented as a subquery of matching asset ids combined with the existing
  relationship-type / confidence filters. Endpoint count is unchanged (161); the added params are
  query-string only. Frontend: a new `frontend/src/api/relationships.ts` (`Relationship` type +
  `listRelationships` caller), `frontend/src/hooks/relationships/useRelationships.ts` (paginated,
  URL-synced query hook), `frontend/src/pages/relationships/relationshipDisplay.ts` (labels/variants
  for the nine relationship types and four confidence levels), `useRelationshipColumns.tsx` (Type,
  Direction `source → target`, Source, Target, Confidence, Notes — endpoints link to their asset
  detail page, falling back to a `#id` token when a name is absent), `RelationshipTableFilters.tsx`
  (endpoint search + relationship-type, confidence, endpoint-status, and endpoint-criticality
  dropdowns), and `RelationshipsPage.tsx` (PageHeader + filters + shared `DataTable` with server-side
  pagination). Wired into routing (`/relationships` lazy route) and the sidebar nav (a "Relationships"
  entry with the `Waypoints` icon, directly under Assets).
  - **Verification:** The new service logic was verified deterministically in-process against a
    throwaway migrated temp SQLite DB (seeded a site, owner, three assets, and two edges) — 13
    assertions all passed: both edges listed; source/target **names and types** enriched correctly;
    relationship-type, confidence, endpoint-criticality, endpoint-status, and endpoint-search filters
    each return exactly the matching edge; site and owner filters return both edges touching the
    seeded host; and a non-matching filter returns empty. `format`, `typecheck`, `lint`, `build`,
    `check:api-types` (161 endpoints, PASS), and `check:schema-parity` all pass. The page was also
    verified in the browser (agent-browser) against the live frontend on :3460: the "Relationships"
    nav link renders and routes, the page shows its header, all four filter controls (each with an
    aria-label), and the six-column table with Type/Confidence badges and directional arrows; the
    search box is interactive with no console errors. Endpoints render as `#id` in that browser check
    because the running backend instance is stale (predates this session's enrichment) and was left
    untouched per the UI-managed-instance rule — the frontend's `#id` fallback degrades gracefully,
    and the enrichment itself is proven by the in-process run above.

- **`network-interface-tracking` (Session 12):** Made an asset's network interfaces / addressing
  records fully manageable end-to-end. The one-to-many `asset_network_interfaces` table (name, MAC,
  IP, subnet mask, gateway, VLAN id, DNS name, `network_zone_id` FK, `is_primary`, notes) existed from
  `asset-domain-schema` but had no CRUD surface; a new `backend/src/services/assetNetworkInterfaceService.ts`
  adds `listNetworkInterfaces` (primary first, then oldest→newest), asset-scoped `getNetworkInterface`,
  `createNetworkInterface`, `updateNetworkInterface`, and `deleteNetworkInterface`. Each write records a
  `asset_network_interface` change event on the owning asset's audit trail (create/update/delete), and
  the service enforces a single-primary-per-asset invariant (setting `isPrimary` on a create/update
  demotes any other primary within the same transaction) and validates that a referenced
  `networkZoneId` points at an active (non-deleted) `network_zones` row (400 otherwise). Interfaces are
  hard-deleted (the table has no soft-delete columns). Four endpoints were added to
  `backend/src/routes/assets.ts`: `GET /assets/:id/network-interfaces` (VIEWER+, 404 on missing asset),
  `POST /assets/:id/network-interfaces` (OPERATOR+, 201, 400 on bad zone, 404 on missing asset),
  `PATCH /assets/:id/network-interfaces/:interfaceId` (OPERATOR+, 404 when the interface does not belong
  to the asset), and `DELETE /assets/:id/network-interfaces/:interfaceId` (OPERATOR+). VLAN ids are
  bounded 0–4094; addressing text fields reuse the short/45-char bounds. OpenAPI now extracts 161
  endpoints (was 157). On the frontend, `frontend/src/api/assets.ts` gained the `NetworkInterface` /
  `NetworkInterfaceInput` types and `getNetworkInterfaces` / `createNetworkInterface` /
  `updateNetworkInterface` / `deleteNetworkInterface` callers; a new
  `frontend/src/hooks/assets/useNetworkInterfaces.ts` exposes `useNetworkInterfaces` plus
  create/update/delete mutation hooks that invalidate both the interface list and the asset history.
  The asset detail page (`AssetDetailPage.tsx`) Network tab now renders a "Network interfaces" section:
  each interface is a card showing IP, MAC, subnet, gateway, VLAN, DNS name, and network zone with a
  "Primary" badge, and — for OPERATOR+ — an "Add interface" action plus per-card edit/delete controls.
  Add/edit open a new grouped `NetworkInterfaceDialog` (`frontend/src/pages/assets/NetworkInterfaceDialog.tsx`,
  including a primary-interface switch); delete is confirmed through the shared `ConfirmAlertDialog`.
  - **Verification:** Full end-to-end HTTP round-trip of the four new routes was verified in-process
    against the real API app (`createApiApp().handle`) on a throwaway temp SQLite DB seeded with an
    OPERATOR user, a VIEWER user, a network zone, and an asset — 30 assertions all passed: unauthenticated
    GET → 401; VIEWER GET → 200 with an empty array; VIEWER POST/PATCH → 403; OPERATOR POST create → 201
    with ip/vlan/zone/isPrimary persisted and bound to the asset; a second primary create demotes the
    first so the list holds exactly one primary (the newest), sorted first; a create referencing a
    missing zone → 400; PATCH persists ip/dns while leaving MAC untouched → 200; PATCH against a
    non-owning asset id → 404; DELETE → 200 then the list shrinks, and a repeat DELETE → 404; POST/GET
    against a missing asset → 404; and exactly four `asset_network_interface` change events
    (create, create, update, delete) land on the trail. `format`, `typecheck`, `lint`, `build`,
    `check:api-types` (161 endpoints, PASS), and `check:schema-parity` all pass. A live UI/`:3461`
    round-trip could not be exercised because the running backend instance is stale — it 404s even
    Session 11's `hardware-profile` route (base routes still 401), i.e. it predates the current code —
    and per the UI-managed-instance rule the running instances were left untouched; the identical HTTP
    routes were instead verified in-process (stronger than a manual click). Consistent with prior
    sessions, `smoke:qc` still fails only on the pre-existing branded template drift, so the individual
    gates were run directly per the documented exit-ramp.

- **`hardware-profile-tracking` (Session 11):** Made an asset's hardware/VM/host profile and lifecycle
  metadata fully readable and writable end-to-end. The one-to-one `asset_hardware_profiles` table
  (CPU model/cores/sockets/threads, RAM, total storage, hypervisor/hardware model, VM fields — guest
  OS, vCPU, tools status, snapshot notes, cluster — and physical-host fields — chassis, form factor,
  host role) already existed from `asset-domain-schema` but had no CRUD surface; a new
  `backend/src/services/assetHardwareProfileService.ts` adds `getHardwareProfile` and an upsert
  `upsertHardwareProfile` (insert on first write, patch in place after, recording an
  `asset_hardware_profile` change event on the asset's audit trail for each write). Two endpoints were
  added to `backend/src/routes/assets.ts`: `GET /assets/:id/hardware-profile` (VIEWER+, returns
  `data: null` when no profile exists yet) and `PUT /assets/:id/hardware-profile` (OPERATOR+ upsert,
  validated integer bounds on the numeric fields). Separately, the asset lifecycle timestamp fields
  (`purchaseDate`, `warrantyExpiresAt`, `supportEndsAt`, `plannedReplacementAt`, `decommissionedAt`,
  `lastVerifiedAt`) — persisted in the schema and already displayed but never accepted on write — are
  now writable through the existing create/update asset routes: they arrive as ISO-8601 strings,
  are validated (`400` on a non-ISO value, via a shared `firstInvalidLifecycleDate` guard reused by
  POST and PATCH), and coerced to `Date` in `assetService.buildWriteValues`. OpenAPI now extracts 157
  endpoints (was 155). On the frontend, `frontend/src/api/assets.ts` gained the `HardwareProfile` /
  `HardwareProfileInput` types, `getHardwareProfile` / `updateHardwareProfile` callers, and the six
  lifecycle fields on `AssetWritableFields`; a new `useHardwareProfile` / `useUpdateHardwareProfile`
  hook pair (`frontend/src/hooks/assets/useHardwareProfile.ts`) drives the fetch and cache-invalidating
  upsert (also refreshing the asset history). The asset detail page (`AssetDetailPage.tsx`) now renders
  the profile: the **Hardware** tab shows a "Compute & memory" card (CPU, memory formatted as
  "65,536 MB (64 GB)", total storage, hypervisor, hardware model) plus the existing "Platform &
  lifecycle" facts, and the **Virtualization** tab shows guest OS, vCPU, vRAM, cluster, VM tools
  status, snapshot notes, and a physical-host card. An OPERATOR+-only "Edit profile" action on both
  cards opens a new grouped `HardwareProfileDialog` (`frontend/src/pages/assets/HardwareProfileDialog.tsx`).
  The asset create/edit dialog (`AssetFormDialog.tsx`) gained a "Lifecycle" fieldset with date inputs
  for purchase, warranty, support-end, planned-replacement, and last-verified.
  - **Verification:** Full end-to-end HTTP round-trip of the new routes was verified in-process against
    the real API app (`createApiApp`) on a throwaway temp DB — 24 assertions all passed: GET returns
    `null` before any write; PUT create persists cpuModel/cpuCores/ramMb/etc. bound to the asset; GET
    reflects the persisted values; a second PUT patches the same row in place (no duplicate) and
    preserves untouched fields; exactly two `asset_hardware_profile` change events (create + update)
    land on the asset trail; PATCH persists lifecycle dates (`purchaseDate`, `warrantyExpiresAt`,
    `supportEndsAt`) as timestamps; an invalid date returns 400; a VIEWER PUT returns 403 while a
    VIEWER GET returns 200; unauthenticated GET returns 401; a missing asset returns 404. UI
    (agent-browser, frontend :3460): the Hardware tab renders the new cards and an OPERATOR "Edit
    profile" button; the "Edit hardware profile" dialog opens with all grouped fields (CPU model, RAM
    (MB), Total storage (GB), Guest OS, vCPU count, Chassis/model, Save profile); no console errors.
    `format`, `typecheck`, `lint`, `build`, `check:api-types` (157 endpoints, PASS), and
    `check:schema-parity` all pass. A live UI PUT round-trip against the already-running app on
    :3461 could not be exercised because a stale leftover `bun src/app.ts` process from a prior
    session was holding port 3461 with pre-change code, blocking the current run's watch server from
    binding; per the UI-managed-instance rule the running instances were left untouched and the
    identical HTTP routes were verified in-process instead (stronger than a manual click). Consistent
    with prior sessions, `smoke:qc` still fails only on the pre-existing branded template drift, so the
    individual gates were run directly per the documented exit-ramp.

- **`documentation-health` (Session 10):** Surfaced documentation-completeness health signals on the
  operational dashboard as both aggregate counts and drillable, filterable per-signal asset lists. A
  new `backend/src/services/documentationHealthService.ts` computes six gap signals over the live
  (non-deleted) inventory — `stale` (never verified, or `lastVerifiedAt` before a configurable
  stale-data threshold in days), `missingOwner` (no business *and* no technical owner), `missingBackup`
  (no active outgoing `backs_up_to` relationship), `missingRelationshipMap` (absent as source *and*
  target of every active edge), `missingServiceRole` (empty `role` *and* no `asset_services`
  assignment), and `unverifiedPorts` (any `asset_ports` row with null `verified_at` or
  `review_state = 'needs_review'`). Each signal is one Drizzle predicate reused for both the count
  summary and the paginated, name-ordered list view, so the dashboard tile and its drill-in stay
  consistent. Two VIEWER+ endpoints were added under a new `backend/src/routes/documentationHealth.ts`
  (wired into `create-api-app.ts`): `GET /infrastructure/documentation-health` (per-signal counts +
  effective `thresholdDays` + `totalAssets`) and `GET /infrastructure/documentation-health/assets`
  (the filterable list behind a signal, redacting sensitive fields for below-OPERATOR callers via the
  existing `redactAssetForRole` + fresh DB-verified role, matching the asset-inventory endpoints). The
  configurable threshold is bounded (`MIN/MAX/DEFAULT_STALE_THRESHOLD_DAYS` in `shared/src/assetDomain.ts`,
  default 90 days) and the signal set is a shared const (`DOCUMENTATION_HEALTH_SIGNALS`) consumed by
  both sides. OpenAPI now extracts 155 endpoints (was 153). On the frontend, `frontend/src/api/
  documentationHealth.ts` + `useDocumentationHealth`/`useDocumentationHealthAssets` hooks drive a new
  `DocumentationHealthCard` (`.../infrastructure/DocumentationHealth.tsx`): six selectable signal tiles
  (icon, label, amber-highlighted count, description) that lazily drill into the flagged-asset list
  (name, type, IP, status badge, link to the asset). The card is registered as a `health` dashboard
  section and included in all three saved views (management/operations/audit).
  - **Verification:** All six signals confirmed against seeded gap data (frontend :3460 / backend :3461,
    already-running instance reused). API (as ADMIN): summary returned
    `stale=6, missingOwner=6, missingBackup=6, missingRelationshipMap=1, missingServiceRole=5,
    unverifiedPorts=0` over `totalAssets=6`; each per-signal list `total` matched its summary count
    exactly. `unverifiedPorts` (0 because no ports are seeded yet) was positively verified by
    temporarily injecting a `needs_review` port for asset 1 → signal flagged DC01 (`total=1`), then
    removing it → back to 0. `thresholdDays` override accepted; unauthenticated → 401; VIEWER list
    returned `notes`/`managementUrl`/`supportContact` as `null` (redaction). Invalid/missing `signal`
    returns the framework's 500 — the identical pre-existing behaviour of the sibling
    `GET /assets/:id/history?action=…` enum validation, a global-error-handler concern out of this
    feature's scope. UI (agent-browser): the Documentation Health card rendered all six tiles with the
    correct counts; clicking "Missing owner" drilled into "Showing 6 of 6" flagged assets with
    per-asset links; no console errors. `format`, `typecheck`, `lint`, `build`, `check:api-types`
    (155 endpoints), and `check:schema-parity` all pass. Consistent with prior sessions, `smoke:qc`
    still fails only on the pre-existing branded template drift, so the individual gates were run
    directly per the documented exit-ramp.

- **`audit-change-history` (Session 9):** Surfaced the asset-domain change-event audit trail as a
  first-class, filterable read API and wired it into the asset detail page. The write side already
  records `asset_change_events` for every asset write (create/update/delete/restore/archive via
  `assetService.recordChangeEvent`) and every relationship write (via
  `relationshipQueries.recordRelationshipEvent`), each row carrying actor, action, target entity,
  a human-readable summary, and a before/after diff. This feature adds the missing *read* half:
  a new `backend/src/services/assetChangeEventQueries.ts#listAssetChangeEvents` (paginated, newest
  first, left-joins `users` to resolve the actor username, filterable by asset, action, entity
  type, actor, and ISO-8601 date range), exposed through a new `GET /assets/:id/history` endpoint
  (VIEWER+) in `backend/src/routes/assets.ts`. The endpoint validates the asset exists (including
  soft-deleted, so the trail survives deletion → 404 otherwise), validates `dateFrom`/`dateTo`
  format and ordering (400 on bad input), and accepts an `action` filter constrained to the shared
  `CHANGE_EVENT_ACTIONS` enum. OpenAPI now extracts 153 endpoints. On the frontend, `getAssetHistory`
  + the `AssetChangeEvent` type were added to `frontend/src/api/assets.ts`, a `useAssetHistory`
  React Query hook (`frontend/src/hooks/assets/useAssetHistory.ts`) drives the fetch, and a new
  `AssetHistorySection` component (`frontend/src/pages/assets/AssetHistorySection.tsx`) replaces the
  History-tab placeholder with a real timeline: per-event action badge (colour-coded by action),
  entity label (Asset / Relationship), absolute timestamp, summary, and actor, plus an "All actions"
  filter dropdown and loading / empty / error states. Spec items covered: (1) change events are
  recorded for the asset-domain writes that exist today — service/port/import writes will hook the
  same `asset_change_events` table once those entities land in their own backlog features; (2) the
  per-asset history section is live on the detail page; (3) the endpoint is filterable by action and
  date range (a per-asset "filterable audit report"); (4) writes verifiably produce entries with
  actor, action, target, and metadata.
  - **Verification:** Started the app (frontend :3460 / backend :3461) via the detached launcher.
    API (as ADMIN): `GET /assets/1/history` returned the real create/update trail with resolved
    actor usernames and before/after diffs; `?action=create` and `?action=update` filtered
    correctly (totals 1 and 2); `?dateFrom=notadate` → 400, `dateFrom>dateTo` → 400 with the
    ordering message; `GET /assets/999999/history` → 404; unauthenticated → 401. Fresh-write audit
    proof: created a test asset (→ `create` event with actor `admin`, target entity id, and
    `changes.after` metadata), PATCHed it (→ `update` event), soft-deleted it (→ `delete` event),
    then confirmed `GET /assets/<id>/history` still returned all three events newest-first after
    soft-deletion (trail survives). UI (agent-browser): opened `/assets/1`, activated the History
    tab, and confirmed the timeline rendered the update/update/create events with action badges,
    "Asset" entity labels, timestamps, summaries, "by operator" actors, and the "All actions"
    filter dropdown, with no error boundary. `typecheck`, `lint`, `format`, `build`,
    `check:api-types` (153 endpoints), and `check:schema-parity` all pass. `smoke:qc` still fails
    only on the pre-existing branded template drift and the pre-existing `check:max-lines`
    violations (`assets.ts` was already over 300 lines at HEAD and grew modestly here for the new
    endpoint; splitting it is a separate refactoring concern out of this feature's scope, per the
    documented exit-ramp the individual gates were run directly).

- **`role-permission-model` (Session 8):** Role-specific asset-field visibility layered onto the
  existing 5-tier RBAC (SYSOP > ADMIN > MANAGER > OPERATOR > VIEWER). The spec's Security & Privacy
  requirement to "prevent low-privilege users from seeing restricted notes, management URLs, or
  support contacts" is now enforced server-side: a new `backend/src/services/assetVisibility.ts`
  redacts `notes`, `managementUrl`, and `supportContact` to `null` for any caller below OPERATOR,
  and the two asset read endpoints (`GET /assets`, `GET /assets/:id` in `backend/src/routes/
  assets.ts`) apply it. The redaction decision uses a *fresh, DB-verified* role, not the JWT claim:
  the role-freshness + API-key-scope-cap logic was extracted from `requireRoleFresh` into a reusable
  `resolveEffectiveRole(user)` in `backend/src/guards/role.ts` (the guard now delegates to it), so a
  user demoted OPERATOR→VIEWER cannot keep seeing sensitive fields on a stale access token. OpenAPI
  descriptions for both routes document the VIEWER redaction (spec still extracts 152 endpoints). On
  the frontend, `AssetDetailPage.tsx` now renders an explicit "Restricted · operator access required"
  marker (with a lock icon) in place of the support-contact field, the management-URL row, and the
  Notes tab for below-OPERATOR users, so redaction reads as an intentional permission boundary rather
  than missing data — OPERATOR+ continue to see the real values / normal empty states. Edit-capability
  gating (create/edit/delete controls hidden from VIEWER via `isOperator()`) and route-level role
  guards were already in place from prior features; this feature completes the *visibility* half.
  Open Question #4 (letting users per-record *mark* specific assets/notes as ADMIN+ restricted) is a
  distinct, product-owner-gated mechanism and is intentionally out of scope — the mandatory
  role-threshold redaction the spec directs is what shipped.
  - **Verification:** Started the app (frontend :3460 / backend :3461) via the detached launcher.
    API: as OPERATOR, PATCHed asset #1 with real notes/management URL/support contact and confirmed
    `GET /assets/1` returned them; as VIEWER, `GET /assets/1` and `GET /assets` both returned those
    three fields as `null` while non-sensitive fields (name, primary IP) stayed intact. RBAC: VIEWER
    `PATCH /assets/1` → 403, unauthenticated `GET /assets/1` → 401. Reverted the injected test data.
    UI (agent-browser): as VIEWER, the asset detail page showed "Restricted · operator access
    required" for support contact and the management-URL row, and a "Notes are restricted" panel on
    the Notes tab, with no console errors; as OPERATOR, no restricted markers appeared and the
    support-contact field showed the normal "—" empty state. `typecheck`, `lint`, `format`, `build`,
    `check:api-types` (152 endpoints), and `check:schema-parity` all pass. `smoke:qc` still fails only
    on the pre-existing branded template drift **and** the pre-existing `check:max-lines` violations
    (7 files already over 300 lines at HEAD — `assetService.ts` 527, `AssetDetailPage.tsx`, `assets.ts`,
    `routes.tsx`, both `services.ts` schema mirrors, `AssetFormDialog.tsx` — none introduced by this
    feature, though this change grew `assets.ts` and `AssetDetailPage.tsx` modestly). Per the
    documented exit-ramp the individual gates were run directly; splitting the oversized files is a
    separate refactoring concern outside this feature's scope.

- **`relationship-model` (Session 7):** First-class directed asset-relationship API at
  `/api/v1/relationships` over the pre-existing `asset_relationships` table. New
  `backend/src/routes/relationships.ts` (+ extracted OpenAPI docs `relationshipRouteDocs.ts`) exposes
  list (VIEWER+, paginated/filterable by asset/source/target/type/confidence, soft-deleted excluded
  unless `includeDeleted=true`), get-by-id (VIEWER+), and create/update/soft-delete (OPERATOR+). The
  service layer is split under the 300-line gate into `assetRelationshipService.ts` (create/update/
  soft-delete mutations) and `relationshipQueries.ts` (read helpers, duplicate lookup, audit-event
  recorder, types), with `relationshipValidation.ts` holding the semantic-plausibility rule map. Each
  write path enforces the spec's rules: both endpoints must be distinct, active assets (self-edges →
  422, missing endpoint → 404 with a "Source/Target asset not found" message); a partial-unique
  active edge prevents duplicates (409); and nonsensical edges (e.g. a `storage_volume` that
  `runs_on` a `virtual_machine`) are rejected 422 unless the request sets `allowUnusual: true` (the
  spec's "explicitly marked special" carve-out). Constrained types are `runs_on`/`hosts`/`stores_on`/
  `backs_up_to`; the generic types (`depends_on`, `provides_service`, `connects_to`, `part_of`,
  `owned_by`) accept any endpoints, and `other` is always an accepted endpoint. Every create/update/
  delete appends an `asset_change_events` row (entityType `asset_relationship`, anchored to the source
  asset) so the change surfaces in that asset's history. Route registered in `create-api-app.ts`;
  reads require VIEWER and writes OPERATOR via `requireRoleFresh`.
  - **Verification:** Started the backend (:3461) via the detached launcher and drove the API with an
    authenticated operator session (CSRF via Origin + `X-CSRF-Token`). Confirmed: VM `runs_on`
    hypervisor → 201; identical edge → 409; `storage_volume runs_on virtual_machine` → 422 with the
    plausibility message; the same edge with `allowUnusual:true` → 201; self-edge → 422; missing
    source/target → 404 with the specific "Source/Target asset not found" message; get-by-id,
    list filtered by `assetId`/`relationshipType`/`sourceAssetId`, confidence/notes update (200),
    an invalid type-change update re-validated → 422, soft-delete → 200, get-after-delete → 404, and
    edge recreation after soft-delete → 201 (partial-unique index excludes soft-deleted rows).
    Verified the `asset_change_events` audit trail recorded all create/update/delete writes with
    actor, entity id, and summary. RBAC confirmed: unauthenticated create → 401, VIEWER create → 403,
    VIEWER list → 200. `typecheck`, backend `lint`, `format`, `check:api-types` (OpenAPI now extracts
    152 endpoints including the relationship routes), `check:schema-parity`, `build:backend`, and
    `check:max-lines` (no new file over 300 lines) all pass. `smoke:qc` still fails only on the
    pre-existing branded template drift (Dockerfile/README/package.json/compose) unrelated to this
    feature, so the individual gates were run directly per the documented exit-ramp. Malformed request
    bodies (bad enum / missing field) surface as 500 — this is the app-wide error-handler behavior
    shared with the already-shipped `/assets` endpoint, not a regression introduced here.

- **`dashboard-summary-cards` (Session 6):** Operational infrastructure dashboard as the post-login
  landing screen at `/dashboard` (VIEWER+), replacing the template's system-metrics page there (that
  page is preserved at the new `/system-status` route with an OPERATOR+ "System Status" nav entry).
  New backend `GET /api/v1/infrastructure/summary` (`backend/src/routes/infrastructureSummary.ts` +
  `backend/src/services/assetSummaryService.ts`) aggregates the live (non-deleted) inventory into one
  payload: total assets; counts by type, status, criticality, site, and business owner; a
  physical/virtual/hypervisor/orphaned-VM virtualization split; summed CPU-core/RAM/storage capacity
  across assets that carry a hardware profile; the top business services ranked by criticality then
  backing-asset count; and five risk cues (internet-exposed ports, ports needing review,
  unsupported/EOL operating systems, critical assets without a `backs_up_to` relationship, and
  unowned assets). Every aggregate degrades gracefully to zero/empty when its backing records
  (services, ports, relationships, hardware profiles owned by later backlog features) do not yet
  exist. Reads require VIEWER via `requireRoleFresh`; the route is registered in `create-api-app.ts`
  and appears in the extracted OpenAPI spec. The frontend page
  (`frontend/src/pages/dashboard/infrastructure/InfrastructureDashboardPage.tsx` plus `StatOverview`,
  `BreakdownList`, `CapacityVirtualization`, `ServicesRisk`, and `dashboardViews.ts`) renders headline
  stat cards, per-dimension breakdown bars, capacity/virtualization, top-services and risk cards, and
  a Management/Operations/Audit **saved-view switcher** whose active preset is URL-synced via
  `?view=` (each preset scopes and reorders the sections for its audience). New typed API client
  (`frontend/src/api/infrastructureSummary.ts`) + query hook
  (`frontend/src/hooks/dashboards/useInfrastructureSummary.ts`); page lazy-loaded via
  `routes/lazyPages.ts` and mounted in `routes.tsx`.
  - **Verification:** Started the app (frontend :3460 / backend :3461) via the detached launcher and
    drove `/dashboard` with agent-browser as the authenticated user. Confirmed the page renders real
    counts for the seeded `DC01` asset — Total Assets 1, Physical Servers 1, By Type "Physical
    Server" 1, By Status "Active" 1, By Criticality "Critical" 1, By Site/Owner "Unassigned" 1, Open
    Risks 2 (critical-without-backup 1 + unowned 1), and "No services catalogued yet." Confirmed the
    Operations view (URL `?view=operations`) shows the Capacity (0 profiled assets → 0 CPU/0 GB) and
    Virtualization cards, and the Audit view (`?view=audit`) shows risk + breakdown but omits
    capacity and services — matching each preset. A real DOM click on the "Audit" button synced the
    URL to `?view=audit`, confirming the switcher's handler (the agent-browser synthetic click did
    not fire React's handler — the same known quirk noted for Radix in prior sessions). The "System
    Status" nav entry renders and `agent-browser errors` was empty throughout. `typecheck`, `lint`
    (backend + frontend), `check:api-types`, `build:frontend` (emits a dedicated
    `InfrastructureDashboardPage` chunk), and `format:check` all pass; `check:max-lines` fails only
    on 7 pre-existing oversized files (this feature adds no file over 300 lines; `routes.tsx` was
    already over the limit before this change).

- **`asset-inventory-page` (Session 5):** Searchable, filterable asset inventory page at the new
  protected route `/assets` (VIEWER+), plus an "Assets" sidebar nav entry. New
  `frontend/src/pages/assets/AssetInventoryPage.tsx` renders a dense TanStack data table with columns
  for name (linked to the detail page), type (icon + label), status, site, owner, role, OS, IP,
  virtualization state, last verified, and criticality. Text search and the type/status/criticality
  dropdown filters are URL-synced via `useUrlFilters` (`AssetTableFilters.tsx`) and drive the
  paginated inventory query in the new `frontend/src/hooks/assets/useAssets.ts` hook (list query +
  create/update/soft-delete mutations, invalidating the `assets` query key on every write).
  Create/edit run through a single `AssetFormDialog.tsx` (name/type/status/criticality/role/hostname/
  FQDN/IP/OS/virtual/description; empty text fields serialize to `null`), and soft-delete reuses the
  shared `ConfirmAlertDialog`. Write actions (New Asset button, row edit/delete menu) are gated to
  OPERATOR+ via `useAuthorization`. Extended `frontend/src/api/assets.ts` with `createAsset`,
  `updateAsset`, `deleteAsset`, and `CreateAssetInput`/`UpdateAssetInput` types mirroring the backend
  `writableFields` schema; registered the page in `routes.tsx` + `routes/lazyPages.ts` as a lazy
  chunk and added the nav item in `navConfig.tsx`.
  - **Verification:** Started the app (frontend :3460 / backend :3461) via the detached launcher and
    drove the page with agent-browser. Confirmed the page renders all 11 columns and the seeded
    `DC01 - Domain Controller` row; that free-text search syncs to `?search=` and filters the table;
    created a new `physical_server` asset (`TEST-VERIFY-SRV`) through the create dialog and confirmed
    it appears in the list; followed the name link to its `/assets/:id` detail page; then
    soft-deleted the test asset (verified `DELETE /api/v1/assets/:id` → 200 and its exclusion from the
    default list). `agent-browser errors` was empty throughout. `typecheck`, `lint`, `format:check`,
    and `build:frontend` (emits a dedicated `AssetInventoryPage` chunk) all pass; `check:drift` fails
    only on pre-existing branded template drift (Dockerfile/README/package.json/compose files) that
    this feature does not touch. The row action dropdown (edit/delete) could not be opened under
    agent-browser (a Radix synthetic-event quirk, not a defect — the same `DropdownMenu` primitive is
    used by the template's `UsersTab`); the underlying update/delete paths share the verified
    create/soft-delete wiring.

- **`asset-detail-page` (Session 4):** Asset detail page at the new protected route
  `/assets/:id` (VIEWER+). New `frontend/src/api/assets.ts` (typed `Asset` model + `getAsset`/
  `listAssets` consuming the inventory API), `frontend/src/pages/assets/assetDisplay.ts`
  (asset-type/status/criticality labels, icons, and badge variants), and
  `frontend/src/pages/assets/AssetDetailPage.tsx`. The page shows an immediate identity strip
  (type icon + label, status, criticality, physical/virtual, role) and a 10-section tabbed body —
  Overview (identity & ownership + description + management/documentation links), Hardware
  (OS/platform/serial/asset-tag/vendor + lifecycle dates), Virtualization (physical/virtual state,
  hypervisor, host, role), Storage, Network (hostname/FQDN/IP/zone/site + per-interface empty
  state), Services, Ports, Relationships, Notes, and History. Sections whose dedicated records are
  owned by separate backlog features (storage, services, ports, relationships, history) render a
  clear non-error "not yet tracked" empty state rather than a blank card. A missing asset renders a
  tailored not-found panel: the query overrides the global `throwOnError`/retry policy so a 404 is
  treated as an expected state (no retries, no global error boundary) with a "Back to inventory"
  action. Registered in `routes.tsx` + `routes/lazyPages.ts` as a lazy chunk.
  - **Verification:** Started the app (frontend :3460 / backend :3461), created a representative
    `physical_server` asset via the authenticated API, then drove the page with agent-browser as
    the seeded `operator` user. Confirmed the header, badges, breadcrumb, and Overview render real
    asset data; activated the Hardware, Virtualization, Network, and Ports tabs and verified each
    renders its intended fields/empty state (e.g. Windows Server 2022 / Dell PowerEdge R750 /
    serial `SVC-DC01-2201`); confirmed the `/assets/99999` not-found panel; and confirmed
    `agent-browser errors` is empty (zero console errors) throughout. `typecheck`, `lint`,
    `format:check`, and `build:frontend` (emits a dedicated `AssetDetailPage` chunk) all pass.
    Radix tab activation required a full pointer-event sequence under agent-browser (a
    synthetic-event quirk, not a defect — the `ui/tabs` primitive is used identically by the
    template's `WorkspaceSettingsPage`).

- **`asset-inventory-api` (Session 3):** Versioned REST asset CRUD + inventory API under
  `/api/v1/assets`. New `assetService.ts` (Drizzle-backed CRUD, case-insensitive duplicate-name
  guard, soft-delete/restore/archive lifecycle, and an append-only `asset_change_events` audit
  trail on every write) and `routes/assets.ts` (Elysia + TypeBox). Endpoints: `POST /assets`
  (create), `GET /assets` (paginated, filterable list), `GET /assets/:id` (read), `PATCH /assets/:id`
  (update), `DELETE /assets/:id` (soft delete), `POST /assets/:id/restore`, `POST /assets/:id/archive`.
  List filtering covers search (name/hostname/FQDN/IP), type, status, criticality, site, owner
  (business or technical), role, operating system, IP, virtualization state, and `includeDeleted`,
  with `page`/`limit` pagination via the standard `PaginatedResponse` / `DataResponse` envelopes.
  Reads require VIEWER; writes require OPERATOR (enforced per-route via `requireRoleFresh`, on top
  of the global audit-log plugin). Routes registered in `create-api-app.ts` and confirmed present in
  the extracted OpenAPI spec by `check:api-types`.
  - **Verification:** A throwaway script exercised the service against a fresh migrated SQLite
    database — 39/39 checks passed across create/read/list/all filters/pagination/update/
    soft-delete/restore/archive/includeDeleted/duplicate-name and `asset_change_events` emission
    (create ×2, update, delete, restore, archive; all `entityType='asset'` with a non-null actor).
    Script removed after use. `typecheck`, `lint`, `check:api-types`, `check:schema-parity`, and
    `build:backend` all pass. Full HTTP round-trip via the running server was not exercised (headless
    session; cookie-auth login requires signing keys) — the route layer is validated by successful
    OpenAPI extraction and typecheck; the data/behavior layer by the service integration checks.
- **`asset-domain-schema` (Session 2):** Full SMB infrastructure domain schema. 18 new Drizzle
  tables (SQLite + PostgreSQL mirror) — `sites`, `network_zones`, `owners`, `vendors`, `assets`,
  `asset_aliases`, `asset_tags`, `asset_hardware_profiles`, `asset_network_interfaces`,
  `asset_storage_allocations`, `service_catalog`, `asset_services`, `service_dependencies`,
  `asset_ports`, `asset_relationships`, `imports`, `import_rows`, `asset_change_events` — with
  soft-delete + audit columns, asset-type and relationship-type enums (in `shared/src/assetDomain.ts`),
  optional workspace scoping, and a partial-unique index preventing duplicate active relationships.
  Migration `20260703192558_complete_black_bird` generated; verified `autoMigrate` applies it on a
  fresh SQLite database and that idempotent seed data (2 sites, 2 owners, 5 starter services) is
  created via `seedDomainReferenceData` (wired into `autoSeed.ts` and `seed.ts`).
- AIDD onboarding (Session 1): 25 backlog feature files under `.aidd/features/`, accurate
  `.aidd/project-structure.md`, and `.aidd/todo.md`. See the Progress Log below.

### Changed

### Deprecated

### Removed

### Fixed

### Security

---

# Progress Log

## Session 2: `asset-domain-schema` — 2026-07-03

- Implemented the complete asset domain schema (18 tables) across SQLite (`backend/src/db/schema/`)
  and the PostgreSQL mirror (`backend/src/db/schema-pg/`); wired all tables into both `index.ts`
  barrels. Domain enums centralized in `shared/src/assetDomain.ts` and re-exported from
  `spernakit-shared`.
- Generated Drizzle migration `20260703192558_complete_black_bird`. Verified on a throwaway fresh
  SQLite database that `runAutoMigrations` applies all 18 tables, cross-FK writes succeed, and the
  idempotent `seedDomainReferenceData` produces the expected sites/owners/service_catalog rows
  (second call is a no-op). The verification script was removed after use.
- Seed hook added to the two infrastructure-classified seed entry points (`autoSeed.ts`, `seed.ts`)
  rather than the pure-template `seed/orchestration.ts`, to keep template drift advisory-only.
- **Quality gates:** `typecheck` (all workspaces), `lint` (all workspaces), `check:api-types`,
  `check:schema-parity`, `build:backend`, and `prettier --check` all pass.
- **Limitation — pre-existing drift:** `bun run smoke:qc` fails at its first gate (`check:drift`)
  because 9 **branded** template files (`Dockerfile`, `README.md`, `package.json`,
  `docker-compose*.yml`, `frontend/index.html`, …) differ beyond branding. These are committed at
  HEAD by earlier sessions and are untouched by this work (confirmed via `git status`); the drift
  gate was already failing on a clean checkout before Session 2. This session's additions only
  introduce advisory (non-failing) infrastructure drift on the barrel/seed files. Per the
  environment exit-ramp, template-managed/branded files were not modified to paper over the
  pre-existing drift.

## Session 1: Onboarding — 2026-07-03

### Codebase Analysis

- **Tech Stack:** Bun + Elysia + Drizzle (SQLite) backend; React 19 + Vite + React Router +
  TanStack Query + Zustand + shadcn/ui frontend; `shared/` zero-runtime-dep types package.
  Derived from the **Spernakit v3 template**.
- **State of implementation:** The repository is the **stock Spernakit template**. The
  auth/RBAC/workspace/notification/dashboard/settings foundation is fully implemented, but
  **zero SMB Infrastructure domain code exists** — no `assets*`, `asset_relationships`,
  `service_catalog`, or `asset_ports` schema, routes, or pages were found (grep across
  `backend/src/db/schema`, `backend/src/routes`, and `frontend/src/pages` returned none).
- **Spec:** `.aidd/spec.md` is present, comprehensive, and accurately describes the target
  product (not the current code). It defines 25 backlog features across MVP / v1.0 / v1.1.
- **Issues discovered:** No blocking issues in the template itself; the entire product
  backlog is unbuilt. See `.aidd/todo.md`.

### Onboarding Actions

- Verified `.aidd/spec.md` (required) — present and fresh.
- Created **25 feature files** at `.aidd/features/{id}/feature.json`, one per backlog item,
  **all conservatively marked `passes: false`** (nothing domain-specific is implemented).
  Dependencies wired (schema → api → pages → advanced features).
- Rewrote `.aidd/project-structure.md` from a blank template into an accurate architecture
  map of the actual codebase.
- Created `.aidd/todo.md` with the prioritized build sequence.

### Feature Coverage Audit Outcome

- Automated `aidd --check-artifacts` and `feature-coverage-audit <root> --apply` could not
  run: **`aidd` is not on PATH** in this session. Coverage was assessed manually.
- **Coverage matrix summary:** 25/25 domain features → disposition `feature-json-gap`
  (now closed by creating the feature files). Implementation evidence: **none** for any
  domain feature. Spec completeness: strong. No `stale-doc` or `ambiguous` dispositions.
- All 25 feature files validated as parseable JSON.

### Project-Level Artifact Inventory (step 2.2)

| Artifact                     | Status    | Follow-up flow                         |
| ---------------------------- | --------- | -------------------------------------- |
| `.aidd/spec.md`              | present   | —                                      |
| `.aidd/project.md`           | present   | —                                      |
| `.aidd/project-structure.md` | updated   | —                                      |
| `.aidd/CHANGELOG.md`         | updated   | —                                      |
| `.aidd/features/*`           | created   | —                                      |
| `.aidd/assertions.md`        | missing   | author behavioral/data/UX invariants   |
| `.aidd/roadmap.json`         | missing   | `/update-roadmap` (MVP/v1.0/v1.1 map)  |
| `.aidd/project-profile.json` | missing   | author assurance/deployment profile    |
| `.aidd/screen-map.md`        | missing   | `/update-screen-map` (after pages)     |
| `.aidd/testing-scenarios.md` | missing   | `/testing-scenarios`                   |
| `.aidd/questions.md`         | missing   | optional (interview mode)              |
| `.aidd/responses.md` + dir   | missing   | optional (interview mode)              |
| `CONTEXT.md`                 | present   | template glossary; extend for domain   |
| `CLAUDE.md` / `AGENTS.md`    | absent    | none required; `project.md` governs    |

No legacy `.auto*` scaffolding directories were found.

### Project State

- Feature list: **0/25 passing** (greenfield domain; template foundation reused).
- Ready for feature implementation. MVP starts with `asset-domain-schema`.

### Open Questions for Product Owner (from spec §Open Questions)

The spec ends with 7 unresolved product decisions (import format, mandatory day-one asset
types, report format, ADMIN+ restricted notes, workspace multi-tenancy, default stale
threshold, seeded services). These are **fork-in-the-road** decisions — surface for approval
before implementing the affected features (`csv-import-review`, `admin-settings`,
`workspace-scoping`, `export-reports`, `documentation-health`).

### Next Steps

- Session 2: begin MVP with `asset-domain-schema` (no dependencies), then
  `asset-inventory-api`, `relationship-model`, `role-permission-model`, and
  `dashboard-summary-cards`.
- Author `assertions.md`, `roadmap.json`, and `project-profile.json` when convenient.
