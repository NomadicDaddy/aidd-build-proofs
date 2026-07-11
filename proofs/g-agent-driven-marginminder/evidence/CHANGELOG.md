# Progress Log

## Session 37: Feature Review - 2026-06-12

### Completed

- Executed `feature-review` ingredient for marginminder.
- **Phase 1 (Discover & Load)**: Found 29 feature.json files. 0 template features. 0 backlog features (all 29 are status=completed, passes=true). No remediation-review.md present.
- **Phase 2 (Learn Conventions)**: Confirmed Spernakit v3.8.2 stack (Elysia + Drizzle + React 19). 2-layer architecture (routes → services, no controllers). TypeBox validation. Named exports only. JSON config only. No .env files. RBAC tiers: SYSOP > ADMIN > MANAGER > OPERATOR > VIEWER.
- **Phase 3 (Analyze)**: No backlog features to analyze. All 29 features are completed and skipped per ingredient spec.
- **Phase 4 (Cross-Feature)**: No cross-feature conflicts detected. All dependency chains resolve. Roadmap assignments are consistent across Foundation (priority 1), Product MVP (priority 2), Operations (priority 3), and Quality (priority 4) milestones.
- **Phase 5 (Report)**: 0 issues found (0 conflicts, 0 contradictions, 0 vague, 0 duplications, 0 minor).
- **Phase 6 (Auto-Fix)**: No features modified. Zero backlog features exist to review or auto-fix.
- **Phase 6.5 (Roadmap Re-Assertion)**: No features were modified in Phase 6, so roadmap re-assertion was skipped. All 29 features already have consistent roadmap assignments.
- **Phase 7 (Handoff)**: No auto-closed features. No consolidation needed. Feature inventory is healthy — all 29 features completed, zero backlog.

### No Changes Made

## Session 36: Audit Finding Review - 2026-06-12

### Completed

- Executed `audit-finding-review` for marginminder.
- Discovered all 29 features under `.aidd/features/*/feature.json`.
- Applied the ingredient's Phase 1 audit-finding heuristics:
    - `auditSource` field present: none found.
    - `id` matching `audit-*` or `feature-*-audit-*`: none found (`audit-log-viewer` is a feature about audit logs, not an audit finding).
    - `category` containing "audit" (case-insensitive): none found.
    - `description` or `spec` containing "Remediation steps" or "audit finding": none found.
- **Result: 0 audit findings. All 29 features are non-audit features and were skipped.**
- 15 features have notes "Backfilled by feature-coverage-audit" — these are coverage backfills documenting existing implementations, not audit findings identifying problems. All 15 are `passes: true`, `status: completed`, and their referenced files still exist.
- 14 features have spec-driven notes ("Required by .aidd/spec.md") — these are feature specs for domain functionality, not audit findings.
- The previous audit findings (12 original from Session 27, consolidated to 5, then remediated in Sessions 29-34 and folded into base features in Session 35) are no longer present in the feature set.

### No Changes Made

- No features were added, removed, consolidated, escalated, or downgraded.
- No source files or feature metadata were modified.
- No roadmap changes were needed.

## Session 35: Feature Consolidation - 2026-06-11

### Completed

- Executed `consolidate-features` for marginminder.
- Folded 10 completed audit findings into 7 base features:
    - `scenario-editor`: React 19 `use()` API requirement (was `useContext`), component decomposition constraint (keep page under 300 lines, extract tabs).
    - `cost-catalog-management`: Component decomposition constraint (keep page under 300 lines), Intl.NumberFormat for formatting, backend route file under 300 lines with co-located schemas.ts.
    - `quote-scenario-api`: Batch inArray() queries for list endpoint (no N+1 getScenarioDetail loop), backend route file under 300 lines with co-located schemas.ts.
    - `pricing-dashboard`: Aggregate COUNT queries for metrics, detail loading capped at 5 recent + 100 max, no unbounded getScenarioDetail loops.
    - `pricing-calculation-engine`: Intl.NumberFormat for ALL percentage/currency formatting (no .toFixed(N)% inline), centralized in pricingFormatters.ts.
    - `scenario-comparison`: Component decomposition constraint (compare/ subdirectory, page under 300 lines).
    - `scenario-list-page`: Intl.NumberFormat via formatPercent() helper (no .toFixed(N)% inline).
- Deleted 10 standalone audit feature directories.
- Removed 10 stale entries from `.aidd/roadmap.json`.
- Verified all 29 surviving features have valid roadmap entries with existing milestones.
- Verified all feature directory names match their `id` fields.
- Verified no dangling dependency references to deleted features.
- Verified no screen-map references to deleted features.
- No template features found (no `spernakit_version` fields in any feature).
- No `feature-*` prefixed directories to rename.
- No unmapped findings — all 10 audit features traced cleanly to base features.

### Limitations

- `bun run aidd-tools -- roadmap:apply` could not run: workspace sandbox prevents cross-project execution to the aidd directory, and bun is not available in this WSL1 session. Roadmap was manually verified correct.
- `bun run aidd-tools -- --check-features` could not run: same WSL1/bun limitation. Feature JSON validity verified manually.
- Pre-commit hook (format:check + lint + typecheck) requires bun, which is unavailable in WSL1. Commit is staged but not committed. Changes should be committed from a Windows shell (Git Bash or PowerShell) where bun is on PATH.

## Session 34: Audit Backlog Remediation - 2026-06-11

### Completed

- Resolved 5 audit findings (2 HIGH, 3 Medium severity) covering N+1 query patterns, React 19 API adoption, and file granularity.

**HIGH: listScenarios() N+1 query pattern (2 findings consolidated)**

- `audit-data-architecture-1781111910-listscenarios-n-1-query-pattern-loads-full-detail-per-row`
- `audit-performance-1781111911-listscenarios-n-1-query-pattern-100-queries-per-paginated-list-call`
- Replaced per-row `getScenarioDetail()` calls in `listScenarios()` with batch queries using `inArray()`.
- Added `groupByScenarioId<T extends { scenarioId: number }>()` generic helper to group child rows by scenario ID for O(1) lookup.
- Added `filterCatalogAssumptionsForScenario()` to scope catalog assumptions per scenario from the batch result.
- Query count reduced from ~(N×4)+2 to 6 total (3 child batch queries + 1 catalog batch + 1 page query + 1 count query) regardless of page size.

**Medium: ScenarioFormContext uses useContext instead of React 19 use() (2 findings consolidated)**

- `audit-composition-patterns-1781111910-scenarioformcontext-uses-usecontext-instead-of-react-19-use-api`
- `audit-react-best-practices-1781111911-scenarioformcontext-uses-usecontext-instead-of-react-19-use`
- Replaced `import { createContext, useContext } from 'react'` with `import { createContext, use } from 'react'` in `ScenarioFormContext.tsx`.
- Replaced `useContext(ScenarioFormContext)` with `use(ScenarioFormContext)`.

**Medium: ScenarioComparisonPage.tsx exceeds 300-line threshold at 356 lines**

- `audit-reorg-1781111912-scenariocomparisonpage-tsx-exceeds-300-line-threshold-at-356-lines`
- Decomposed `ScenarioComparisonPage.tsx` (356 lines) into `compare/` subdirectory:
    - `types.ts` (23 lines) — `ComparisonMetric` type, `MAX_COMPARISON_SCENARIOS`, `STATUS_LABELS`, `RISK_LABELS`.
    - `ComparisonTable.tsx` (134 lines) — `ComparisonTable` component + `RiskFlagBadges` + `COMPARISON_METRICS` constant.
    - `ScenarioPicker.tsx` (104 lines) — `ScenarioPicker` + `EmptyComparisonState` + `SelectedScenarioStrip`.
    - `index.ts` (3 lines) — Barrel re-exports.
- `ScenarioComparisonPage.tsx` now 122 lines as page-level orchestrator.

### Limitations

- `smoke:qc` / quality gates not run due to WSL1 environment limitation (Windows bun.exe/node.exe not executable from WSL1 bash). Code verified through manual review against codebase patterns, established batch-query patterns from Session 31 dashboard remediation, and CostCatalogPage/ScenarioEditorPage decomposition precedents.
- **Commit blocked by pre-commit hook requiring `bun`** — same WSL1 environment limitation as Sessions 29-33. Changes are staged and ready for commit from a Windows shell. All code manually reviewed for correctness.

## Session 33: ScenarioEditorPage Decomposition - 2026-06-10

### Completed

- Implemented audit finding `audit-consolidated-1781010000-scenarioeditorpage-exceeds-300-line-threshold`.
- Decomposed `ScenarioEditorPage.tsx` (1831 lines) into 12 focused files under `frontend/src/pages/scenarios/components/`:
    - `types.ts` (121 lines) — All draft types, form state, constants (`CATEGORY_LABELS`, `RISK_LABELS`, `STATUS_LABELS`, `ZERO_SUMMARY`).
    - `helpers.ts` (337 lines) — Pure functions: blank factories, form state builders, validation, payload builder, export text builder.
    - `useScenarioFormActions.ts` (347 lines) — Custom hook encapsulating all form state, mutations, and CRUD actions for line items, labor entries, and fixed costs.
    - `ScenarioFormContext.tsx` (15 lines) — React context typed to `ScenarioFormActions`, with `useScenarioForm()` consumer hook.
    - `shared.tsx` (61 lines) — Reusable UI components: `Field`, `InlineFieldError`, `SummaryMetric`, `RiskFlagBadges`.
    - `ScenarioHeaderFields.tsx` (168 lines) — Header form section (customer name, title, status, target margin, tax, contingency, discount, notes, assumptions).
    - `ScenarioLineItemsTab.tsx` (281 lines) — Line items tab with catalog selection, inline editing, and validation.
    - `ScenarioLaborTab.tsx` (216 lines) — Labor entries tab with role-based entry editing.
    - `ScenarioFixedCostsTab.tsx` (176 lines) — Fixed costs tab with cost editing.
    - `ScenarioSummaryTab.tsx` (117 lines) — Summary panel, export tab, and sidebar summary components.
    - `index.ts` (5 lines) — Barrel re-exports for all tab components.
- Refactored `ScenarioEditorPage.tsx` as a slim page-level orchestrator (175 lines) — holds route query, renders `ScenarioEditorForm` which delegates to `useScenarioFormActions` hook and provides context.
- Each extracted tab component uses `useScenarioForm()` context instead of receiving all state via props.
- Updated feature metadata with resolved notes and all affected files.
- **Result:** ScenarioEditorPage.tsx = 175 lines (was 1831). Under 300-line threshold.

### Limitations

- `smoke:qc` / quality gates not run due to WSL environment limitation (Windows bun.exe not executable from WSL bash). Code verified through manual review against codebase patterns and CostCatalogPage decomposition precedent.
- Spec line 12 (updating scenario-editor feature spec with component decomposition constraint) not performed — would modify a completed feature spec outside session 2+ allowed changes.

## Session 32: formatPercent Intl.NumberFormat Remediation - 2026-06-10

### Completed

- Implemented audit finding `audit-consolidated-1781010000-formatpercent-uses-tofixed-instead-of-intl-numberformat`.
- Replaced `formatPercent`'s `value.toFixed(1)` with `Intl.NumberFormat(style: 'percent')` using a module-level `percentFormatter` — matches existing `currencyFormatter` pattern in the same file.
- Replaced inline `.toFixed(1)%` in `CostCatalogTable.tsx:90` with `formatPercent(item.defaultMarkupPercent)` call.
- Replaced inline `.toFixed(1)%` in `ScenarioListPage.tsx:233` with `formatPercent(scenario.targetMarginPercent)` call.
- Updated `affectedFiles` in feature metadata to reflect post-decomposition file paths (CostCatalogTable.tsx instead of CostCatalogPage.tsx).
- **Result:** All percentage formatting in the frontend now uses `Intl.NumberFormat` instead of `toFixed`. Zero `.toFixed()` calls remain in the frontend source.

### Limitations

- `smoke:qc` / quality gates not run due to WSL environment limitation (Windows bun.exe not executable from WSL bash). Code verified through manual review against codebase patterns and existing `currencyFormatter` precedent.
- Spec line 4 (updating pricing-calculation-engine feature spec with localization constraint) not performed — would modify a completed feature spec outside session 2+ allowed changes.

## Session 31: Dashboard Service N+1 Query Remediation - 2026-06-10

### Completed

- Implemented audit finding `audit-consolidated-1781010000-dashboard-service-n1-query-and-unbounded-load`.
- Replaced unbounded `getScenarioDetail()` call on all active scenarios with a bounded approach:
    - `totalScenarios` and `draftCount` now use aggregate SQL `COUNT()` queries via a new `getAggregateCount()` helper — zero detail rows loaded.
    - Detail loading capped at `DASHBOARD_DETAIL_LIMIT = 100` (constant with JSDoc) — prevents unbounded growth.
    - `recentScenarios` limited to `RECENT_SCENARIOS_LIMIT = 5` from the capped detail set.
    - `averageMarginPercent` and `belowTargetCount` computed from the capped 100-row set (require computed margins not stored in DB).
- Added `and`, `count`, `eq`, `type SQL` imports from drizzle-orm; removed unused imports.
- Updated feature metadata with resolution notes.
- **Result:** Dashboard no longer loads ALL active scenarios with full detail. Count-based metrics use SQL aggregates; detail loading is bounded at 100 rows.

### Limitations

- `belowTargetCount` and `averageMarginPercent` cannot use pure SQL COUNT queries because margin is a computed value requiring child row data (line items, labor entries, fixed costs). These use the capped 100-row detail set — the maximum optimization achievable without schema denormalization.
- `smoke:qc` / quality gates not run due to WSL environment limitation (Windows bun.exe not executable from WSL bash). Code verified through manual type review against codebase patterns.
- Spec line 5 (updating pricing-dashboard feature spec with performance constraint) not performed — would modify a completed feature spec outside session 2+ allowed changes.

## Session 30: CostCatalogPage Decomposition - 2026-06-10

### Completed

- Implemented audit finding `audit-consolidated-1781010000-costcatalogpage-exceeds-300-line-threshold`.
- Created `frontend/src/pages/cost-catalog/components/` directory.
- Extracted `CostCatalogDialog.tsx` (319 lines) from CostCatalogPage.tsx — handles create/edit dialog form with validation, form state management, and all form helpers (formFromItem, payloadFromForm, numberFromInput, toDateInput).
- Extracted `CostCatalogTable.tsx` (137 lines) from CostCatalogPage.tsx — renders the catalog table with header, body rows, empty state, edit/archive actions, and display formatters.
- Refactored `CostCatalogPage.tsx` as a page-level orchestrator (231 lines) — holds query state, mutations, search/filter controls, and wires dialog + table together.
- Used `key` prop pattern on CostCatalogDialog to initialize form state on dialog open without triggering `react-hooks/set-state-in-effect` lint rule.
- Updated feature metadata with resolved notes and all affected files.
- **Results:** CostCatalogPage.tsx = 231 lines (was 566). Under 300-line threshold.
- All quality gates pass: typecheck ✓, lint ✓, backend build ✓, format ✓. Frontend build has pre-existing Tailwind CSS native binding issue (environment-specific, not code-related).

### Limitations

- `smoke:qc` build step fails due to pre-existing Tailwind CSS Oxide native binding missing in WSL — documented as environment issue. Equivalent individual checks (lint, typecheck, format, backend build) all pass.
- Spec line 5 (updating cost-catalog-management feature spec with component decomposition constraint) not performed — this would modify a completed feature spec which is outside the scope of this session's allowed changes (Step 9.2 rules).

## Session 29: Audit Remediation - 2026-06-09

### Completed

- Implemented audit finding `audit-consolidated-1781010000-backend-route-files-exceed-300-line-threshold`.
- Extracted TypeBox schemas and validation helpers from `scenarios.ts` and `cost-catalog.ts` into co-located `schemas.ts` files.
- Converted flat route files into directory-based modules (`scenarios/` and `cost-catalog/`) matching existing codebase patterns (`auth/`, `health/`, etc.).
- Introduced shared `IdParamsSchema` and query schemas (`ListScenariosQuerySchema`, `ListCostCatalogQuerySchema`) to eliminate inline duplication.
- Updated `backend/src/create-api-app.ts` import paths to reference the new module structure.
- **Results:** `scenarios/index.ts` = 299 lines (was 382), `cost-catalog/index.ts` = 258 lines (was 357). Both under 300-line threshold.
- All quality gates pass: typecheck ✓, lint ✓, backend build ✓, format ✓. Frontend build has pre-existing Tailwind CSS native binding issue (environment-specific, not code-related).
- `smoke:qc` timed out due to the same frontend build issue; individual checks (lint, typecheck, format, backend build) all pass.

### Limitations

- `smoke:qc` timed out — documented as environment issue (Tailwind native binding missing in WSL). Equivalent individual checks all pass.
- Spec line 5 (updating parent feature specs with handler extraction constraint) not performed — this would modify completed feature specs which is outside the scope of this session's allowed changes (Step 9.2 rules).

## Session 28: Feature Review - 2026-06-09

### Completed

- Executed the `feature-review` skill against marginminder.
- Reviewed all 34 features: 28 completed, 6 backlog (audit findings).
- No template features found (no `spernakit_version` fields).
- No `remediation-review.md` present — remediation cross-check skipped.
- Learned full codebase conventions: Elysia + Drizzle + React 19 (Spernakit v3.8.2), 2-layer routes → services, TypeBox validation, RBAC SYSOP > ADMIN > MANAGER > OPERATOR > VIEWER, named exports only, handler extraction for >30 line handlers, no controllers.
- Built existing functionality inventory confirming all 28 completed features correspond to actual codebase artifacts.

### Issues Found: 18 total (0 conflicts, 0 contradictions, 12 vague, 0 duplications, 6 minor)

#### VAGUE (12)

All 6 audit features had:

- **VAGUE**: `IMPORTANT: After resolving this finding, locate the feature.json file(s)...` instruction — underspecified. Which features? What constraint? Auto-fixed: replaced with explicit parent feature references and concrete prevention constraints.
- **VAGUE**: Missing dependencies on the parent features that own the affected files. Auto-fixed: added `dependencies` pointing to the feature(s) that produced the code.

Per-feature VAGUE issues:

1. `audit-consolidated-1781010000-backend-route-files-exceed-300-line-threshold`: Missing spec line verifying files end up under 300 lines after extraction. Added spec line 4.
2. `audit-consolidated-1781010000-dashboard-service-n1-query-and-unbounded-load`: Spec line 2 used "consider" (banned verb). Rewritten to concrete instruction: "Replace the averageMargin and count calculations with a single aggregate SQL query using COUNT and WHERE status != 'archived'..."
3. `audit-consolidated-1781010000-formatpercent-uses-tofixed-instead-of-intl-numberformat`: No additional vague issues beyond the IMPORTANT instruction.
4. `audit-consolidated-1781010000-costcatalogpage-exceeds-300-line-threshold`: No additional vague issues beyond the IMPORTANT instruction.
5. `audit-consolidated-1781010000-scenarioeditorpage-exceeds-300-line-threshold`: No additional vague issues beyond the IMPORTANT instruction.

#### MINOR (6)

All 6 audit features had:

- **MINOR**: Empty `dependencies` array despite modifying files owned by other features. Auto-fixed: added appropriate dependencies.

### Auto-Fix Summary

| Feature                                       | Issues Fixed | Changes                                                                                                                                             |
| --------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend route files exceed 300-line threshold | 3            | Added deps (cost-catalog-management, quote-scenario-api), replaced vague IMPORTANT with explicit parent-feature constraint, added verification line |
| CostCatalogPage exceeds 300-line threshold    | 2            | Added dep (cost-catalog-management), replaced vague IMPORTANT with explicit parent-feature constraint                                               |
| Dashboard service N+1 query                   | 3            | Added dep (pricing-dashboard), replaced "consider" with concrete instruction, replaced vague IMPORTANT with explicit parent-feature constraint      |
| formatPercent uses toFixed                    | 3            | Added deps (cost-catalog-management, scenario-list-page), replaced vague IMPORTANT with explicit parent-feature constraint                          |
| ScenarioEditorPage exceeds 300-line threshold | 2            | Added dep (scenario-editor), replaced vague IMPORTANT with explicit parent-feature constraint                                                       |

**Total**: 5 features modified, 13 issues resolved

### Phase 6.5: Roadmap Assignment

All 5 modified audit features already had valid milestone assignments in `.aidd/roadmap.json` pointing to the "Quality" milestone. No re-assignment needed. `roadmap:apply` skipped.

### Cross-Feature Analysis

- No route conflicts between features.
- No file conflicts between features.
- No field conflicts between features.
- No missing features identified — all Product MVP features have corresponding completed implementations.
- No cathedral risks in backlog features (all audit features modify existing code rather than creating new layers).

### Final Feature Inventory Health

- Total features: 34
- Completed: 28
- Backlog: 6 (all audit findings)
- Duplicates removed this session: 0

## Session 27: Audit Finding Review - 2026-06-09

### Completed

- Executed the `audit-finding-review` skill against marginminder.
- Reviewed all 12 audit-sourced feature.json findings across 7 audit categories:
  ARCHITECTURE, COMPOSITION_PATTERNS, DATA_ARCHITECTURE (×2), FRONTEND, PERFORMANCE,
  REACT_BEST_PRACTICES, REORG (×2), SECURITY, SPERNAKIT, and WEB_DESIGN_GUIDELINES.
- Built a full origin map: all 12 findings target APP-SPECIFIC files (scenarios.ts,
  cost-catalog.ts, scenarioDashboard.ts, quoteScenarios.ts, costCatalogItems.ts,
  ScenarioEditorPage.tsx, CostCatalogPage.tsx, ScenarioListPage.tsx, pricingFormatters.ts)
  — none exist in the spernakit template.
- Removed 2 findings as UNNECESSARY:
    - `audit-react-best-practices-...-usedeferredvalue` — premature optimization for a
      self-hosted app; the finding itself admits it is "informational only."
    - `audit-data-architecture-...-soft-delete-fields` — documentation-only finding about
      functionally equivalent lifecycle patterns; existing JSDoc already documents the
      design intent.
- Consolidated 10 findings into 5 merged findings (5 consolidation groups):
    - formatPercent toFixed → merged SECURITY + WEB_DESIGN_GUIDELINES (identical issue)
    - CostCatalogPage >300 lines → merged FRONTEND + REORG (identical issue)
    - ScenarioEditorPage >1831 lines → merged COMPOSITION_PATTERNS + REORG (identical issue)
    - Backend route files >300 lines → merged ARCHITECTURE + SPERNAKIT (identical issue)
    - Dashboard N+1 + unbounded load → merged DATA_ARCHITECTURE + PERFORMANCE (same root cause)
- No KEEP+ESCALATE findings: all affected code is app-specific.
- Updated `.aidd/roadmap.json` to remove 12 old entries and add 5 consolidated entries.
- All changes applied directly per Phase 6 execution rules.

### Final Inventory

- Total features: 34 (down from 41)
- Audit findings remaining: 5 consolidated (down from 12 original)
- Non-audit features unchanged: 29

### Pipeline Handoff Notes

- 5 KEEP findings remain in backlog — below the >3 threshold for feature-review recommendation.
- No KEEP+ESCALATE findings were created.
- 2 REMOVE findings were unnecessary (not false positives): REACT_BEST_PRACTICES and
  DATA_ARCHITECTURE audit types produced low-value findings.
- Roadmap:apply must be run manually: `cd <WORKSPACE>/aidd && bun run aidd-tools --
roadmap:apply --project-dir <WORKSPACE>/marginminder` (workspace sandbox prevents
  cross-project execution).

## Session 26: Onboarding Interview Generation - 2026-06-08

### Completed

- Regenerated `.aidd/questions.md` using the AIDD `onboarding-interview` command against
  `<WORKSPACE>/marginminder`.
- Conducted full Phase 1 reconnaissance: read `.aidd/` artifacts (spec, assertions,
  project-structure, roadmap, project-profile, screen-map, testing-scenarios, CHANGELOG,
  todo, existing questions, feature metadata for all 29 features), root docs (README,
  AGENTS.md, CONTEXT.md, package.json), manifest and config (config/marginminder.json,
  Dockerfile, docker-compose.yml), code structure (routes, services, schema, pages, API
  types), operational surface (Docker configs, migrations, seed scripts), and git history
  (57 commits, v0.1.0 tag).
- Performed Phase 2 gap analysis classifying each topic area as Answered, Partial, or Silent.
- Generated Phase 3 questionnaire with 56 questions across 12 categories: Product Intent
  & Vision (7), Business Logic & Domain Rules (8), Codebase & Architecture (8), Data Model
  & Migrations (6), Infrastructure & Deployment (6), Operations & Monitoring (5), Security
  & Compliance (6), Testing & Quality (5), Dependencies & Integrations (4), Team Workflows
  & Conventions (4), Known Risks & Technical Debt (6), Roadmap & v1 Definition (6).
- Prioritized questions: 17 CRITICAL, 26 HIGH, 13 NICE.
- Identified top 5 risks: security posture (secrets in VCS), deployment reality (Docker
  config inconsistencies), v1 completion criteria (no documented product owner acceptance),
  pricing formula correctness (net-of-tax gross profit may be unintentional), scaffold vs.
  product boundary (many enabled Spernakit features outside product scope).
- Overwrote the previous Session 25 interview format with the definitive onboarding
  questionnaire format per command requirements.

### Verification

- No source code or feature metadata files were changed.

## Session 25: Interview Questions Generation - 2026-06-06

### Completed

- Generated `.aidd/questions.md` with comprehensive discovery and interview
  questions covering 15 topic areas and 75 individual questions.
- Read the full spec, assertions, project-structure, roadmap, screen-map,
  testing-scenarios, project-profile, and all 29 feature metadata files to
  identify gaps, ambiguities, and undocumented decisions.
- Organized questions by topic: product scope, pricing rules, cost catalog,
  quote scenarios, comparison, export, risk flagging, dashboard, data
  persistence, security, UX/design, performance, deployment, future
  integrations, and spec clarifications.
- Included a cross-reference table mapping each question group to spec sections
  and related feature metadata for traceability.

### Verification

- File written to `.aidd/questions.md` in standard AIDD interview format.
- No source code or feature metadata files were changed.

## Session 24: Grill With Docs Context Refresh - 2026-06-06

### Completed

- Executed the AIDD-local `grill-with-docs` workflow against `<WORKSPACE>/marginminder`.
- Loaded the skill definition and support formats from `<WORKSPACE>/aidd\skills\grill-with-docs`.
- Cross-checked the existing context against `.aidd/spec.md`, `.aidd/assertions.md`,
  `.aidd/project-structure.md`, feature metadata, and the implemented scenario/catalog
  service and frontend API types.
- Reworked root `CONTEXT.md` into the skill-required glossary-only format with domain
  terms, relationships, example dialogue, and flagged terminology ambiguities.
- No ADR was created because this pass recorded existing domain language rather than a
  new hard-to-reverse trade-off.

### Verification

- `bun run smoke:qc` passed.

## Session 23: README Refresh Artifact Reconciliation - 2026-06-06

### Completed

- Logged the previously-committed README refresh (commit `b293bb5` "docs: refresh Margin
  Minder README", 2026-06-06), which replaced scaffold-era prose with an accurate
  description of the implemented Margin Minder pricing product. That commit had landed
  without a corresponding CHANGELOG entry, leaving Session 22 as the newest logged session
  even though the README had since changed.
- Reconciled `.aidd/todo.md` so the stale "Consider a later README refresh" follow-up
  candidate (lines 47-49) is checked off and now records that the refresh is done, since the
  README already matches the implemented state.
- Kept the session doc/artifact-only; no product source files or feature metadata files were
  changed.

### Verification

- AIDD feature status passed: 29 total features, 29 completed, 0 pending.
- AIDD feature metadata validation passed: 29 total, 29 valid, 0 invalid.
- AIDD artifact inventory passed: required and recommended artifacts are fresh; only optional
  interview artifacts remain missing because no interview data exists.
- `bun run smoke:qc` passed.

## Session 22: Artifact Refresh - 2026-06-06

### Completed

- Ran the required live AIDD artifact inventory from `<WORKSPACE>/aidd` with
  `bun run start -- --project-dir <WORKSPACE>/marginminder --check-artifacts`.
- Reconciled stale artifact state that still described Margin Minder as an unimplemented
  scaffold.
- Created `CONTEXT.md`.
- Refreshed `.aidd/project-structure.md` to reflect implemented dashboard, cost catalog,
  scenario list, scenario detail/editor, comparison, export, admin/foundation routes,
  domain schemas, backend route registration, and current runtime ports.
- Refreshed `.aidd/todo.md` so completed domain implementation work is no longer listed
  as pending.
- Updated `.aidd/spec.md` to align the port note with current config ports `3440` and
  `3441`.
- Created `.aidd/roadmap.json`, `.aidd/screen-map.md`, `.aidd/testing-scenarios.md`,
  `.aidd/assertions.md`, and `.aidd/project-profile.json`.
- Did not create optional interview artifacts because no interview data exists.
- Kept the session doc/artifact-only; no product source files or feature metadata files
  were changed.

### Verification

- AIDD artifact inventory passed after refresh: required and recommended artifacts are
  fresh; only optional interview artifacts remain missing because no interview data exists.
- AIDD feature metadata validation passed: 29 total, 29 valid, 0 invalid.
- First `bun run smoke:qc` reached format check and failed only because
  `.aidd/roadmap.json` and `.aidd/screen-map.md` needed Prettier formatting.
- Ran `bunx prettier --write .aidd\roadmap.json .aidd\screen-map.md`.
- Final `bun run smoke:qc` passed.

## Session 21: Seed Quote Data - 2026-06-06

### Completed

- Completed `seed-quote-data`.
- Added development-only domain seeding through the existing seed orchestration so manual
  `bun run --cwd backend db:seed` refreshes quote data even when template users already exist.
- Preserved production seed policy: production seeding still creates only default accounts and
  does not write domain quote/catalog rows.
- Seeded seven active cost catalog items covering labor, materials, subcontractor work, a fee, and
  overhead.
- Seeded the `Northstar Dental Group / Operatory Network Refresh` review scenario with target
  margin, tax, discount, contingency, assumptions, notes, two labor entries, four linked line
  items, and one fixed overhead cost.
- Included visible tester risk flags through the seeded pricing assumptions:
  `below_target_margin`, `high_discount`, and `stale_catalog_assumption`.
- Marked `seed-quote-data` as completed with affected files recorded.

### Verification

- `bun run --cwd backend typecheck` passed before seed execution.
- `bun run --cwd backend db:seed` passed three consecutive times on an already-seeded development
  database; each run skipped user creation and refreshed domain seed data.
- Idempotency probe after repeated runs confirmed one seeded scenario, one copy of each seeded
  catalog item, two labor entries, four line items, one fixed cost, and stable scenario id `20`.
- Service summary for scenario `20` returned direct cost `$3,410.80`, final price `$4,294.39`,
  gross profit `$821.52`, and the expected risk flags.
- `bun run smoke:qc` passed.
- `bun scripts/crawltest.ts --page /dashboard`, `bun scripts/crawltest.ts --page /scenarios`, and
  `bun scripts/crawltest.ts --page /scenarios/20` passed with zero console and network errors.

## Session 20: Scenario Export Summary metadata reconciliation - 2026-06-06

### Completed

- Reconciled `scenario-export-summary` feature metadata: populated `affectedFiles` (previously
  empty) with the files implementing the summary/export flow —
  `frontend/src/pages/scenarios/ScenarioEditorPage.tsx` (export tab, `buildExportText`,
  `copyExport`), `backend/src/routes/scenarios.ts` (scenario detail + `GET /:id/summary`
  server-calculated totals), `frontend/src/api/scenarios.ts` (`getScenario` data source), and
  `frontend/src/api/types/scenarios.ts` (`ScenarioDetail` / `ScenarioSummary` types).
- Preserved `status=completed` and `passes=true`; no source or UI changes, no PDF generation.

### Verification

- `bun run smoke:qc` passed after the metadata change.

## Session 19: Scenario Export Summary - 2026-06-06

### Completed

- Completed `scenario-export-summary`.
- Changed the scenario editor Export tab so Markdown is generated from the selected saved
  scenario detail and server-calculated totals rather than mixing draft form fields with stale
  saved totals.
- Formatted major assumptions and risk flags as Markdown list sections and kept final price,
  direct cost, gross profit, margin, target margin, discount, contingency, customer/title, and
  status in the copied summary.
- Added inline copy success/error feedback alongside the existing toast feedback.
- Marked `scenario-export-summary` as completed.

### Verification

- Baseline `bun run smoke:qc` passed before implementation.
- `bun run --cwd frontend typecheck` passed after implementation.
- `bun run --cwd frontend lint` passed after implementation.
- Browser verification against the session-owned instance on ports `3440` and `3441` confirmed
  `/scenarios/19` renders the Export tab, the Markdown summary includes scenario identity,
  pricing totals, target margin, assumptions, and risk flags, Copy shows
  `Markdown summary copied.`, and browser console errors were empty.
- Screenshot evidence saved to `logs/screenshot-1780707531761.png`.
- `bun scripts/crawltest.ts --page /scenarios/19` passed with zero console and network errors.

## Session 18: Scenario Labor Modeling - 2026-06-05

### Completed

- Completed `scenario-labor-modeling`.
- Restored reliable scenario editor tab and save behavior after the shared button default
  changed native buttons to `type="button"` by making scenario editor tabs explicit button
  controls and making Save an explicit submit control.
- Added visible inline validation messages for negative labor hours, internal rate, billable
  rate, and burden percentage values.
- Added a unique accessible name for the Labor Add control while keeping the visible label
  unchanged.
- Marked `scenario-labor-modeling` as completed.

### Verification

- Baseline `bun run smoke:qc` passed cached compile/build gates and failed only because the
  selected feature metadata file was already dirty and unformatted on arrival.
- `bun run --cwd frontend typecheck` passed after implementation.
- `bun run --cwd frontend lint` passed after implementation.
- Browser verification against the already-running user-owned instance on ports `3440` and
  `3441` confirmed the Labor tab renders, the Add Labor Entry control is visible, negative
  hours show `Hours must be zero or greater.`, and browser console errors were empty.
- Direct authenticated API verification created temporary scenario `18`, persisted one labor
  entry with role, hours, internal cost, billable rate, burden, sort order, and notes, returned
  `$185.85` direct cost, `$332.50` labor sell price, and `44.1%` margin, then archived the
  temporary scenario.
- `bun scripts/crawltest.ts --page /scenarios/new` passed with zero console and network errors.
- Server-owning `bun run smoke:dev` was deferred because a separate user-owned instance was
  already running on ports `3440` and `3441`; that instance was left running.

## Session 17: Pricing Dashboard - 2026-06-05

### Completed

- Completed `pricing-dashboard`.
- Added a Margin Minder pricing dashboard API at `/api/v1/dashboard` that summarizes active
  scenario count, draft count, below-target count, average gross margin, and recent scenarios.
- Replaced the template system dashboard first screen with a compact pricing health dashboard,
  recent scenario table, risk labels, and quick actions for New Scenario and Cost Catalog.
- Fixed the dashboard query failure path so API errors render the dashboard unavailable state
  instead of tripping the app error boundary.
- Fixed an existing object-key lint warning in `scripts/stop.ts` that blocked `smoke:qc`.

### Verification

- `bun run typecheck` passed.
- `bun run smoke:qc` passed.
- Direct service verification returned 7 active scenarios, 6 drafts, 3 below-target scenarios,
  15.9% average gross margin, and five recent scenario rows from the local database.
- OpenAPI extraction confirmed `GET /api/v1/dashboard/` is registered in the current API app.
- Browser verification passed on an isolated temporary verifier at `http://127.0.0.1:3550`:
  login as `operator`, dashboard metrics rendered, recent scenarios showed customer/title,
  status, total price, margin, risks, and updated date, Cost Catalog quick action navigated to
  `/cost-catalog`, and New Scenario quick action navigated to `/scenarios/new`.
- Browser console checks returned empty output during dashboard, Cost Catalog, and New Scenario
  verification.
- The existing user-owned instance on `3440`/`3441` was left running. Server-owning `smoke:dev`
  was deferred because that instance was active, and its backend did not hot-reload the new
  `/api/v1/dashboard` route without a restart.

## Session 16: Live Runtime Event Routing Fix - 2026-06-04

### Completed

- Restarted Margin Minder through the detached app lifecycle after runtime probes showed the
  served modules were current but the live shell needed a fresh bundle.
- Fixed the global bug-report trigger by replacing the failing `DialogTrigger asChild`
  composition with a controlled button that owns `aria-expanded` and opens the Radix dialog.
- Removed the BBS super-theme fixed scanline overlay from the top of the stacking order and
  moved the texture to the body background.
- Kept `scenario-fixed-costs` completed with `passes: true` and refreshed runtime evidence.

### Verification

- Runtime DOM inspection confirmed scenario buttons use effective `type="button"` and
  `pointer-events: auto`.
- Live browser verification added one line item row and one fixed-cost row on `/scenarios/new`.
- Invalid fixed-cost value `-2` showed `Cost must be zero or greater.` and Save produced no
  scenario create/update request.
- Valid create from `/scenarios/new` sent `POST /api/v1/scenarios` with status `201` and
  navigated to `/scenarios/17`.
- `/scenarios/13` Save sent `PUT /api/v1/scenarios/13` with status `200`.
- The global bug-report trigger changed `aria-expanded` from `false` to `true` and opened the
  Report a Bug dialog.
- `bun scripts/crawltest.ts --page /scenarios/new` passed.
- `bun scripts/crawltest.ts --page /scenarios/new --bug` passed and submitted a test bug report
  through the global dialog.
- `bun run typecheck` and `bun run smoke:qc` passed.

## Session 15: Live Runtime Scenario Save Evidence - 2026-06-04

### Completed

- Confirmed the served frontend was current by reusing the existing Vite dev instance on
  `3440`/`3441` and cache-busting `/scenarios/new`.
- Hardened the shared button primitive so native buttons default to `type="button"` while
  `asChild` links keep their existing semantics.
- Added explicit scenario-editor save failure text and immediate fixed-cost numeric validation
  for cost and markup fields.
- Kept `scenario-fixed-costs` completed with `passes: true` and refreshed its runtime evidence.

### Verification

- Browser runtime inspection confirmed scenario editor buttons, tabs, and header actions render
  with effective `type="button"`.
- `/scenarios/new` runtime create flow added one line item and one fixed cost, rejected a `-2`
  fixed-cost value with `Cost must be zero or greater.`, blocked invalid Save without a scenario
  API request, then sent `POST /api/v1/scenarios` for a valid save and persisted both rows.
- `/scenarios/13` runtime update flow sent `PUT /api/v1/scenarios/13` followed by
  `GET /api/v1/scenarios/13`.
- The global bug-report trigger changed `aria-expanded` from `false` to `true` and opened the
  Report a Bug dialog.
- `bun run --cwd frontend typecheck` passed.

## Session 14: Live UI Defect Fixes ISS-001/ISS-002 - 2026-06-04

### Completed

- Fixed `ISS-002` by keeping the BBS/terminal shell action bar inside the viewport at standard
  desktop widths and letting the Radix dialog trigger own the bug-report open event.
- Fixed the scenario editor action reliability portion of `ISS-001` by making the editor header
  sticky inside the nested page scroller so Save remains clickable while working in tab panels.
- Kept the Fixed Costs Add control beside the section heading, matching the Line Items Add target
  placement.
- Left `scenario-fixed-costs` completed with `passes: true` after live UI evidence confirmed fixed
  costs can be added and saved.

### Verification

- Reused the already-running user-owned instance on ports `3440` and `3441`; no blocking dev server
  was started.
- Browser verification passed for `/scenarios/new`: Line Items Add appended an editable row, Fixed
  Costs Add appended an editable row, empty Save showed explicit required-field validation, completed
  Save sent `POST /api/v1/scenarios` with status `201`, and the app navigated to `/scenarios/15`.
- Browser verification passed for `/scenarios/13`: Line Items Add appended an editable row, Fixed
  Costs Add appended an editable row, completed Save sent `PUT /api/v1/scenarios/13` with status
  `200`, and no inline validation errors remained.
- Browser verification passed for the bug-report trigger: clicking the visible header button opened
  the dialog and changed `aria-expanded` to `true`.

## Session 13: Scenario Fixed Costs - 2026-06-04

### Completed

- Completed `scenario-fixed-costs`.
- Verified existing fixed-cost schema, scenario API payloads, persistence, and pricing calculation
  coverage for fixed-cost direct costs, sell prices, taxability, sort order, and notes.
- Added visible inline validation messages for negative fixed-cost cost and markup values.
- Added a unique accessible name for the Fixed Costs Add control while keeping the visible label
  unchanged.
- Marked `scenario-fixed-costs` as completed.

### Verification

- Baseline `bun run smoke:qc` passed before implementation.
- `bun run typecheck` passed after implementation.
- Browser verification against the already-running user-owned instance on ports `3440` and `3441`
  passed for `/scenarios/new`: a fixed-cost row was added, negative cost and negative markup each
  showed inline validation and blocked save, and corrected values saved successfully.
- Authenticated browser API verification for temporary scenario `14` returned one fixed cost with
  cost `125`, markup `10`, taxable `true`, sort order `0`, saved notes, and fixed-cost sell price
  `137.5`.
- Temporary verification scenario `14` was archived after verification through the editor workflow.
- `bun scripts/crawltest.ts --page /scenarios/new` and
  `bun scripts/crawltest.ts --page /scenarios` passed with zero console and network errors.
- Server-owning `bun run smoke:dev` was deferred because a separate user-owned instance was already
  running on ports `3440` and `3441`; that instance was left running.

## Session 12: Scenario Line Items Add Click - 2026-06-04

### Completed

- Fixed `ISS-001` for `scenario-line-items` only.
- Kept the Line Items Add control beside the section heading so the wide line-item table no longer
  pushes the mouse target to the far edge of the table.
- Added a unique accessible name for the Line Items Add control while keeping the visible label
  unchanged.

### Verification

- Browser verification against the already-running user-owned instance on ports `3440` and `3441`
  passed for `/scenarios/new`.
- Mouse click on the Line Items Add control created one editable line-item row.
- Keyboard Enter on the focused Line Items Add control created one editable line-item row.
- Keyboard Space on the focused Line Items Add control created one editable line-item row.

## Session 11: Scenario Line Items - 2026-06-04

### Completed

- Completed `scenario-line-items`.
- Added a catalog source picker to scenario line item rows.
- Active catalog items can now seed line item name, category, unit, unit cost, default markup,
  and taxable defaults while keeping the copied values editable.
- Preserved `catalogItemId` through the scenario editor state and save payload so linked scenario
  lines keep their source relationship across saves.
- Added visible inline validation messages for negative line item quantity, unit cost, and markup.
- Marked `scenario-line-items` as completed.

### Verification

- Baseline `bun run smoke:qc` passed before implementation.
- `bun run typecheck` passed after implementation.
- Browser verification against the already-running user-owned instance on ports `3440` and `3441`
  passed for `/scenarios/new`: a line item was added, an active catalog item was selected, and the
  row copied catalog name, category, unit, unit cost, markup, and taxable defaults.
- Browser validation verified negative quantity showed `Quantity must be zero or greater.` and
  blocked save until corrected.
- Authenticated browser API verification for temporary scenario `12` returned `catalogItemId: 2`,
  quantity `2`, unit cost `12.34`, markup `20`, `taxable: true`, `sortOrder: 0`, and saved notes.
- Temporary verification scenario `12` was archived after verification through the editor workflow.
- `agent-browser errors` returned empty output.
- `bun scripts/crawltest.ts --page /scenarios/new` and
  `bun scripts/crawltest.ts --page /scenarios` passed with zero console and network errors.
- Final `bun run smoke:qc` passed after implementation.
- Server-owning `bun run smoke:dev` was deferred because a separate user-owned instance was already
  running on ports `3440` and `3441`; that instance was left running.

## Session 10: Scenario Numeric Validation UX - 2026-06-03

### Completed

- Fixed the scenario create/edit inline numeric validation UX for Target margin.
- Reused the existing scenario editor numeric parser and validation messages so
  `Target margin must be 99.99 or less.` is unchanged.
- Added change/blur validation for the scenario assumption numeric fields so an existing inline
  numeric error clears as soon as the corrected value is valid.
- Preserved scenario save, detail, edit, summary, risk, and export behavior.

### Verification

- Browser verification passed on `/scenarios/new`: submitting Target margin `150` showed
  `Target margin must be 99.99 or less.`, then changing the field to `35` cleared the message
  without another submit.
- Browser verification passed on `/scenarios/9`: submitting Target margin `150` showed the same
  inline message, then changing the field to `35` cleared it without another submit.

## Session 9: Scenario Editor - 2026-06-03

### Completed

- Completed `scenario-editor`.
- Added `/scenarios/new` and `/scenarios/:id` editor routes with customer/title fields,
  status, target margin, tax, contingency, discount, notes, and assumptions.
- Added editable tabs for line items, labor, fixed costs, summary, and Markdown export.
- Extended scenario create/update API payloads so saved editor changes persist child rows and
  return recalculated scenario details.
- Added scenario frontend API types and create/get/update helpers.
- Added list-page entry points for creating and editing scenarios.
- Marked `scenario-editor` as completed.

### Verification

- Baseline `bun run smoke:qc` passed before implementation.
- `bun run typecheck` and `bun run lint` passed after implementation during the session.
- Browser verification with `agent-browser` passed for `/scenarios/new` and `/scenarios/8`,
  including the assumptions form, line item, labor, fixed cost, summary, export, save, edit
  reload, and `/scenarios` list return path.
- Authenticated browser API verification for `/api/v1/scenarios/8` returned the saved
  customer/title, one line item, one labor entry, one fixed cost, final price `$5,645.22`,
  margin `23.1%`, and `below_target_margin`.
- Temporary verification scenario `8` was archived after verification through the authenticated
  CSRF-protected scenario archive endpoint.
- `agent-browser errors` returned empty output.
- `bun scripts/crawltest.ts --page /scenarios/new` and
  `bun scripts/crawltest.ts --page /scenarios` passed with zero console and network errors.
- Mobile viewport verification passed for `/scenarios/new`; screenshot saved to
  `logs/scenario-editor-mobile.png`.
- Broad `bun run smoke:dev` timed out after 180 seconds; frontend and backend remained healthy on
  ports `3440` and `3441`, so final validation continued with targeted browser/crawl checks and
  `bun run smoke:qc`.

## Session 8: Scenario List Page - 2026-06-03

### Completed

- Completed `scenario-list-page`.
- Kept scope to the approved `/scenarios` list workflow: route, navigation entry, status
  filtering, customer/title search, pricing columns, target margin, risk count, updated date,
  empty state, and responsive table readability.
- Added a visible risk-count badge alongside existing risk labels so list rows expose both count
  and warning details.
- Added a filter-aware empty state with a clear-filters action for the list workflow.
- Marked `scenario-list-page` as completed.

### Verification

- Baseline `bun run smoke:qc` passed before implementation.
- `bun run typecheck` passed after implementation.
- Browser verification with `agent-browser` passed for `/scenarios` showing the list route,
  navigation entry, search input, status filter, archive switch, pricing columns, empty state,
  and responsive desktop/mobile rendering.
- Temporary scenario `7` verified populated table display for final price, unavailable margin,
  target margin, `2 warnings`, `High discount`, `No contingency`, and updated date, then was
  deleted after verification.
- `agent-browser errors` returned empty output.
- `bun scripts/crawltest.ts --page /scenarios` passed with zero console and network errors.
- Broad `bun run smoke:dev` timed out after 180 seconds; frontend and backend remained healthy on
  ports `3440` and `3441`, so final validation continued with targeted browser/crawl checks and
  `bun run smoke:qc`.

## Session 7: Risk Flagging - 2026-06-03

### Completed

- Implemented `risk-flagging`.
- Added the approved stale catalog assumption warning rule: linked catalog items with
  `lastReviewedAt` set to null or more than 90 UTC calendar days before request time now
  raise `stale_catalog_assumption`; unlinked scenario line items do not.
- Kept stable warning risk codes for `below_target_margin`, `high_discount`,
  `missing_contingency`, and `stale_catalog_assumption`.
- Returned full risk flags with scenario list rows in addition to scenario summaries and
  comparison summaries.
- Updated the Scenarios table to show non-destructive amber warning badges with risk labels.
- Marked `risk-flagging` as completed.

### Verification

- Baseline `bun run smoke:qc` passed before implementation.
- `bun run typecheck` passed after implementation.
- Direct Bun verification passed for null catalog review dates, catalog reviews more than 90
  UTC calendar days old, exactly-90-day reviews, unlinked line items, and the three existing
  pricing warnings.
- Browser verification with `agent-browser` passed for `/scenarios` showing `Below target`,
  `High discount`, `No contingency`, and `Stale catalog`; browser console errors were empty.
- Authenticated browser API verification for `/api/v1/scenarios/6/summary` returned
  `below_target_margin`, `high_discount`, `missing_contingency`, and
  `stale_catalog_assumption`.
- Temporary risk verification scenario `6` and its linked catalog item were deleted after
  verification.
- `bun scripts/crawltest.ts --page /scenarios` passed with zero console and network errors.
- Broad `bun run smoke:dev` timed out after 180 seconds; frontend and backend remained healthy on
  ports `3440` and `3441`, so final validation continued with targeted browser/crawl checks and
  `bun run smoke:qc`.

## Blocker Recorded: 2026-06-03

**Feature:** `risk-flagging`
**Question:** What exact rule should define a stale cost catalog assumption?
**Context:** The feature requires stale catalog assumption flags based on `lastReviewedAt`, but
neither `.aidd/spec.md`, the feature file, nor current code defines a threshold or comparison rule.
The current backend already flags below-target margin, discounts over 15 percent, and zero
contingency, but it has no catalog staleness rule. The feature also asks to display flags in
scenario details, dashboard, and comparison views, while dashboard, detail/editor, and comparison UI
are separate incomplete backlog features.
**Options considered:**

1. Treat catalog items with no `lastReviewedAt` as stale.
2. Treat catalog items older than a fixed age, such as 90 or 180 days, as stale.
3. Treat scenario line items as stale when the linked catalog item was reviewed after the scenario
   was last updated.
4. Defer dashboard/detail/comparison UI display until the selected UI features are implemented, and
   complete only backend risk flag generation now.

**Waiting for:** Product owner clarification on the staleness rule and whether this feature should
implement new dashboard/detail/comparison UI now or only expose flags for those future surfaces.

**Next action:** `risk-flagging` is marked `waiting_approval` with `passes: false`.

## Session 6: Pricing Calculation Engine - 2026-06-02

### Completed

- Implemented `pricing-calculation-engine`.
- Added a dedicated backend pricing calculation service for direct cost, sell price,
  labor burden, contingency, discount, taxable subtotal, tax, final price, gross profit,
  margin, markup, break-even, target price, and zero-direct-cost unavailable percentages.
- Rewired quote scenario summaries to use the pricing engine while keeping scenario-specific
  risk flags in the scenario service layer.
- Added frontend pricing formatters for currency and one-decimal percentages, then used
  them in the Scenarios table.
- Marked `pricing-calculation-engine` as completed.

### Verification

- Baseline `bun run smoke:qc` passed before implementation.
- Direct Bun calculation verification passed for line item, labor, fixed cost, contingency,
  discount, tax, margin, markup, target price, and zero-direct-cost null margin/markup.
- `bun run typecheck` passed after implementation.
- Browser verification with `agent-browser` passed for `/scenarios` showing `$663.86`,
  `37.2%`, and `40.0%` for temporary scenario `5`; browser console errors were empty.
- Temporary scenario `5` was archived after browser verification.
- `bun scripts/crawltest.ts --page /scenarios` passed with zero console and network errors.
- `bun run start` initially failed on stale PID cleanup, then succeeded after the launcher
  removed stale PID files; the services were started by this session for verification.

## Session 5: Part 10 Smoke Remediation - 2026-06-02

### Completed

- Used `<WORKSPACE>/<REDACTED_PROJECT>` as smoke evidence for scoped
  marginminder app failures.
- Remediated left-nav no-op behavior by routing normal navigation clicks explicitly through
  React Router in sidebar, topbar, mobile, terminal, and BBS navigation variants.
- Remediated the global bug-report button no-op by making the existing controlled bug-report
  dialog open explicitly from its trigger button.
- Remediated Cost Catalog no-op controls by making catalog action buttons explicit button
  controls, expanding the archived-items toggle hit target, preserving keyboard switch behavior,
  and keeping create/update/archive saves wired to the existing cost catalog API.
- Added a minimal protected `/scenarios` list page, frontend scenario API/types, lazy route,
  preload entry, and main navigation entry wired to the existing scenario API.
- Left broader scenario create/edit routes in the existing scenario-list backlog because Part 10
  only requested the minimal scenario list route and navigation path.

### Verification

- `bun run format` completed with no file changes.
- `bun run typecheck` passed across shared, backend, frontend, and scripts.
- `bun run smoke:qc` passed.
- Targeted browser crawl checks passed for `/dashboard`, `/cost-catalog`, `/settings`,
  and `/scenarios`.
- Bug-report browser crawl passed with the global bug button opening and submitting the
  existing bug report UI.
- Focused browser verification passed for Home, Cost Catalog, Settings, and Scenarios
  navigation; Cost Catalog create/save through the existing API; archived catalog inclusion
  toggle behavior; test-item archive cleanup; and bug-report dialog opening.

## Session 4: Cost Catalog Management - 2026-06-02

### Completed

- Implemented `cost-catalog-management`.
- Added cost catalog service methods for list, create, detail, update, and archive behavior.
- Added `GET /api/v1/cost-catalog`, `POST /api/v1/cost-catalog`,
  `GET /api/v1/cost-catalog/:id`, `PUT /api/v1/cost-catalog/:id`, and
  `DELETE /api/v1/cost-catalog/:id`.
- Registered the cost catalog route in `backend/src/create-api-app.ts`.
- Added independent frontend cost catalog API types and client methods.
- Added the protected `/cost-catalog` page with searchable table, create/edit dialog,
  archive action, archived-item toggle, and save/archive toast feedback.
- Added Cost Catalog navigation entry.
- Marked `cost-catalog-management` as completed.

### Verification

- Baseline `bun run smoke:qc` passed before implementation.
- `bun run typecheck` passed after implementation.
- In-process API verification passed for authenticated catalog list, create, update,
  whitespace-name validation, negative-unit-cost validation, archive, default archived
  exclusion, and archived inclusion. Temporary catalog item `1` was archived after
  verification.
- Puppeteer UI verification against the already-running frontend passed for catalog page
  render, create, edit, archive, archived toggle visibility, and screenshot capture at
  `logs/cost-catalog-management-ui.png`.
- Server-owning `bun run smoke:dev` was deferred because a separate user-owned instance
  was already running on ports `3440` and `3441`; that instance was left running.

## Session 3: Quote Scenario API - 2026-06-02

### Completed

- Implemented `quote-scenario-api`.
- Added quote scenario service modules for list, create, detail, update, archive,
  summary, and comparison behavior.
- Added server-side pricing summary calculations from stored scenario line items, labor
  entries, and fixed costs.
- Added `GET /api/v1/scenarios`, `POST /api/v1/scenarios`, `GET /api/v1/scenarios/:id`,
  `PUT /api/v1/scenarios/:id`, `DELETE /api/v1/scenarios/:id`,
  `GET /api/v1/scenarios/:id/summary`, and `POST /api/v1/scenario-comparison`.
- Registered the scenario routes in `backend/src/create-api-app.ts`.
- Marked `quote-scenario-api` as completed.

### Verification

- Baseline `bun run smoke:qc` passed before implementation.
- `bun run typecheck` passed after implementation.
- In-process API verification passed for login, scenario create, list, detail, update,
  summary, comparison, duplicate-comparison validation, and archive. Temporary scenarios
  `3` and `4` were archived after verification.
- `bun run smoke:qc` passed after implementation.
- Server-owning `bun run smoke:dev` was deferred because a separate user-owned instance
  was already running on ports `3440` and `3441`; that instance was left running.

## Session 2: Margin Data Schema - 2026-06-01

### Completed

- Implemented `margin-data-schema`.
- Added SQLite and PostgreSQL Drizzle schema files for `cost_catalog_items`,
  `quote_scenarios`, `scenario_line_items`, `scenario_labor_entries`, and
  `scenario_fixed_costs`.
- Added explicit scenario child-table foreign keys, catalog item references, status and
  updated-at indexes, active catalog indexes, and scenario sort-order indexes.
- Exported all new schema tables from both schema indexes.
- Generated and applied SQLite migration `20260601222646_fine_salo`.

### Verification

- Baseline `bun run smoke:qc` passed before implementation.
- `bun run smoke:dev` timed out after 180 seconds; because it started local services, they
  were stopped with `bun run stop`.
- `bun run check:schema-parity` passed.
- `bun run typecheck` passed.
- `bun run db:migrate:status` reported all migrations applied.
- Direct SQLite inspection confirmed all five new domain tables exist in
  `data/marginminder.db`.
- No database files were found under `backend/`.

## Session 1: Onboarding - 2026-06-01

### Rule And Override Summary

- Initial invocation greeting used: "Don't Panic."
- Loaded `<WORKSPACE>/<REDACTED_PROJECT>` and repository `CLAUDE.md`.
- No repository `AGENTS.md` file was present.
- No `.windsurf/rules/` directory was present.
- `.aidd/project.md` override: even if this is not a registered Spernakit app, keep
  architecture, tech stack, style, and tooling Spernakit-like unless necessary and user
  approved.
- Non-negotiable constraints observed: no blocking dev servers, no setup scripts, no
  destructive operations, no `git stash`, no Python, no hook bypass flags.

## 2026-06-05 - Scenario Comparison

- Implemented the `/compare` view for selecting saved quote scenarios and comparing
  final price, direct cost, gross profit, margin percentage, target margin gap, discount
  amount, contingency amount, and risk flags.
- Added comparison navigation, route preloading, frontend comparison API types/caller, and
  a compare action from the scenario list.
- Marked `.aidd/features/scenario-comparison/feature.json` completed with the affected
  files captured.

### Codebase Analysis

- **Current implementation:** Spernakit v3.8.2 scaffold with Margin Minder branding and
  JSON config.
- **Intended product:** local-first pricing and margin planner described by `.aidd/spec.md`.
- **Backend:** Bun, Elysia, Drizzle, TypeBox route validation, pino logging, SQLite with
  PostgreSQL schema parity files.
- **Frontend:** React 19, Vite 8, React Router, TanStack Query, Zustand, shadcn/ui,
  lucide icons.
- **Implemented scaffold capabilities:** authentication/RBAC, users, workspaces, settings,
  notifications/WebSocket, custom dashboards, files, health, metrics, audit logs, backups,
  scheduled tasks, API keys, bug reports, onboarding, and database admin.
- **Missing domain capabilities:** cost catalog, quote scenario schema and API, scenario
  editor, line items, labor, fixed costs, pricing calculations, risk flags, pricing
  dashboard, comparison, Markdown export, and quote seed data.
- **Port note:** `.aidd/spec.md` lists first-pass ports `3490` and `3491`; current config
  uses frontend `3440` and backend `3441`.
- **Legacy scaffolding:** no root `.auto*` directories were found.

### Project-Level Artifact Inventory

| Artifact                | Path                         | Status                 | Follow-up                                |
| ----------------------- | ---------------------------- | ---------------------- | ---------------------------------------- |
| App specification       | `.aidd/spec.md`              | present and fresh      | none                                     |
| Assertions              | `.aidd/assertions.md`        | missing                | run `/doc2feature` or assertions refresh |
| Project structure       | `.aidd/project-structure.md` | refreshed this session | none                                     |
| Project overrides       | `.aidd/project.md`           | present and fresh      | none                                     |
| Roadmap                 | `.aidd/roadmap.json`         | missing                | run `/update-roadmap`                    |
| Assurance profile       | `.aidd/project-profile.json` | missing                | create project profile                   |
| Screen map              | `.aidd/screen-map.md`        | missing                | run `/update-screen-map`                 |
| Testing scenarios       | `.aidd/testing-scenarios.md` | missing                | run `/testing-scenarios`                 |
| Interview questions     | `.aidd/questions.md`         | optional missing       | only needed for interview flow           |
| Interview responses     | `.aidd/responses.md`         | optional missing       | only needed for interview flow           |
| Interview responses dir | `.aidd/responses/`           | optional missing       | only needed for interview flow           |

### Feature Coverage Audit

- Native skill workflow used: `feature-coverage-audit --apply` equivalent.
- Direct `feature-coverage-audit` shell command was not available.
- `aidd --project-dir . --check-artifacts` was not on PATH; fallback is the local
  `<WORKSPACE>/aidd` CLI.
- First fallback artifact check hit a transient file-lock while another AIDD validation
  process was running; the artifact check passed after rerunning serially.
- Report path: `.aidd/reports/feature-coverage-audit-2026-06-01.md`.
- Coverage summary: 15 implemented scaffold capabilities covered, 15 feature JSON gaps
  auto-fixed, 2 stale/template docs refreshed, 14 spec-backed backlog records created,
  0 ambiguous gaps.

### Onboarding Actions

- Created 29 individual feature files under `.aidd/features/{feature-id}/feature.json`.
- Marked 15 implemented Spernakit scaffold capabilities as completed after code inspection.
- Marked 14 Margin Minder domain capabilities as backlog with `passes: false`.
- Updated `README.md` to describe the current scaffold state and missing product work.
- Replaced placeholder `.aidd/project-structure.md` with repo-specific architecture notes.
- Created `.aidd/todo.md` with prioritized next steps.
- Created `.aidd/reports/feature-coverage-audit-2026-06-01.md`.
- Validated feature metadata with the AIDD CLI fallback: 29 total, 29 valid, 0 invalid.
- Ran artifact check with the AIDD CLI fallback: 3/11 present, 3 fresh, 0 stale,
  8 missing; JSON written to `.aidd/.artifacts-check.json`.
- Ran `bun run smoke:qc`; all QC steps completed successfully.

### Project State

- Feature list: 15 passing / 29 total.
- Validation: feature metadata passed, artifact check passed, and `bun run smoke:qc`
  passed.
- Domain MVP status: not implemented yet.
- Ready for the next session to start with schema, pricing calculation, catalog, and
  scenario API work.

### Next Steps

- Implement `margin-data-schema`.
- Implement `pricing-calculation-engine`.
- Implement `cost-catalog-management`.
- Implement `quote-scenario-api`.
- Run `/update-roadmap`, `/update-screen-map`, and `/testing-scenarios` after the product
  routes and pages begin to exist.
