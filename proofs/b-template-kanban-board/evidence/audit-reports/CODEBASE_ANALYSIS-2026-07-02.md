# Codebase Analysis — kanban-board

**Date:** 2026-07-02
**Analyst:** aidd `codebase-analysis` ingredient (directive mode)
**Scope:** Full repository at `d:/applications/kanban-board`
**Baseline stack:** Vite 8 + React 19 + TypeScript 6 (client-only SPA; no backend)

---

## Executive Summary

**Overall health score (vs. spec): F — the application does not exist yet.**

This repository is a **pristine `vite-react` third-party scaffold** (the build-proof (b) starting
point described in `spec.md`). The scaffold itself is clean and builds, but **none of the 8 backlog
features** defined in `spec.md` have been implemented. `src/App.tsx` is still the stock Vite starter
(a counter button, hero image, and docs/social links). There is no board, column, or card model, no
store, no drag-and-drop, and no localStorage persistence.

The grade reflects the project measured against its own specification, not the quality of the
starter template. As a *scaffold*, the code is healthy: `bun run build` and `bun run lint` both pass
with zero errors or warnings.

### Top 3 critical issues

1. **Zero feature implementation.** All 8 spec features (`board-domain-model` through
   `testing-scenarios`) are unbuilt. `src/` contains only the untouched starter (`App.tsx`,
   `main.tsx`, CSS, assets). `.aidd/features/` is empty — no feature blueprints exist.
2. **The spec's stated validation gate does not exist.** `spec.md` and `AGENTS.md` require
   `bun run smoke:qc` to pass, but `package.json` defines only `dev`, `build`, `lint`, `preview`.
   There is no `smoke:qc`, `typecheck`, `format`, or test/crawl script. The declared quality gate
   is unrunnable.
3. **Vestigial spernakit config drift.** Two orphaned `eslint.config.js` files (root +
   `frontend/`), a `.prettierrc`, and an otherwise-empty `frontend/` directory carry over
   spernakit-app assumptions (backend/, scripts/, drizzle, tailwind, `components/ui/`) that do not
   exist here. Their required plugins are not installed and nothing invokes them (lint uses
   `oxlint`). They are dead configuration that will mislead contributors.

### Top 3 optimization opportunities

1. **Enable TypeScript `strict` mode.** No tsconfig sets `strict: true`, contradicting AGENTS.md's
   "zero tolerance for `any`". Turn it on before any feature code is written so type safety is
   enforced from the first line.
2. **Establish the real quality gate now.** Add `typecheck` (`tsc -b --noEmit`), wire prettier or
   drop it, and define `smoke:qc` so the spec's acceptance criteria (`bun run smoke:qc passes`)
   become achievable and CI-verifiable.
3. **Remove config drift before building.** Delete or replace the orphaned eslint/prettier configs
   and the empty `frontend/` dir so the repo layout matches its actual (bare-Vite) shape.

---

## Detailed Findings

### 1. Architecture

- **Actual layout:** single-package Vite SPA. Entry `src/main.tsx` → `src/App.tsx`. No routing, no
  state library, no data layer, no component tree beyond `App`.
- **Spec's intended architecture** (`spec.md`): typed `Board`/`Column`/`Card` model, a small store
  (Zustand or context) persisted to `localStorage`, explicit `columnOrder`/`cardOrder` arrays for
  deterministic drag-and-drop. **None of this is present.**
- **`project-structure.md` is an unfilled template** — every field is a `{placeholder}`. It provides
  no architectural guidance and should be authored as part of the first build iteration.
- **Layout confusion:** a `frontend/` directory exists but contains only an orphaned
  `eslint.config.js`; the real app lives in `src/`. This mixed signal (spernakit puts the app in
  `frontend/`; this scaffold puts it in `src/`) should be resolved to one convention.

### 2. Performance

- **Bundle:** production build is 193.35 kB JS (60.67 kB gzip) — entirely React runtime, since no
  app code exists. This is the floor, not a concern.
- **No bottlenecks to analyze** (no queries, no data flow, no caching, no lazy loading). Re-assess
  after features land. When the board grows, the drag-and-drop reorder and localStorage write paths
  will be the first places to watch (debounce persistence; avoid re-rendering the whole board on a
  single card move).

### 3. Security

- **Attack surface is minimal by design:** client-only, no backend, no accounts, no network I/O, no
  secrets. No `.env` files present (consistent with the no-env rule).
- **Forward-looking risk (not yet present):** the spec's `Card.description` and `labels` are
  free text rendered into the DOM. When card rendering is implemented, ensure React's default JSX
  escaping is preserved and **no `dangerouslySetInnerHTML`** is introduced — that is the only
  realistic XSS vector for a client-only Kanban board.
- **Persistence hardening (spec-required, unbuilt):** the spec calls for guarding against corrupt
  `localStorage`. Implement schema-validated hydration (try/catch + shape check → fall back to a
  clean default board) so a malformed/poisoned storage entry cannot crash the app.
- **Dependencies:** only `react` / `react-dom` at runtime; dev deps are Vite/TS/oxlint. Small,
  current, low-risk surface.

### 4. Quality / Technical Debt

- **Type safety:** `tsconfig.app.json` and `tsconfig.node.json` set `noUnusedLocals`,
  `noUnusedParameters`, `noFallthroughCasesInSwitch`, and `erasableSyntaxOnly`, **but never
  `strict: true`**. This is the single most important quality gap to close before writing code.
- **Missing scripts:** no `typecheck`, `format`, `test`/crawl, or `smoke:qc`. `.prettierrc` exists
  (tabs, 100-col, single quotes, tailwind plugin) but **prettier is not installed** and no `format`
  script runs it — orphaned config referencing an uninstalled `prettier-plugin-tailwindcss`.
- **Lint tooling split:** `package.json` lints with `oxlint` (`.oxlintrc.json`), yet two full
  ESLint flat configs ship in the repo with plugins (`eslint-plugin-perfectionist`,
  `typescript-eslint`, `eslint-plugin-react-hooks`, …) that are **not in `package.json`**. These
  configs cannot run and duplicate/contradict the oxlint setup.
- **Starter cruft:** `src/App.tsx`, `src/App.css`, `src/index.css`, and `src/assets/*` (react.svg,
  vite.svg, hero.png) are all stock template content to be replaced.
- **Empty AIDD metadata:** `.aidd/features/` empty, `CHANGELOG.md` is an empty skeleton,
  `project-structure.md` is an unfilled template. Metadata health is poor for a project about to be
  built.

### 5. Evolution (git history)

- **The kanban-board directory is entirely untracked** in the `d:/applications` git repo
  (`git ls-files -- .` returns 0). There is **no per-app commit history** to analyze — no
  architectural decisions, bug patterns, or debt trends recorded. This is expected for a freshly
  scaffolded, not-yet-committed proof, but means step 2 (historical evolution) yields nothing.

---

## Cross-cutting Consistency

- **Naming/style:** the scaffold uses 2-space indent + no semicolons (Vite default via its own
  formatting), while `.prettierrc` and AGENTS.md mandate **tabs + semicolons + single quotes**. The
  existing `src/*` files do **not** conform to the project's stated style. Whatever formatter is
  adopted should reformat `src/` on first touch.
- **Module exports:** AGENTS.md mandates named exports; `src/App.tsx` and `src/main.tsx` use
  `export default` (the ESLint configs even ship a custom `no-default-export` rule). New code should
  follow named-export convention; the two starter files will be replaced anyway.

---

## Quality Validation Results

| Gate | Command | Result |
| --- | --- | --- |
| Build | `bun run build` (`tsc -b && vite build`) | ✅ Pass — 20 modules, built in ~93ms, no TS errors |
| Lint | `bun run lint` (`oxlint`) | ✅ Pass — no warnings or errors |
| Typecheck | — | ⚠️ No dedicated script (covered transitively by `tsc -b` in build) |
| Format | — | ❌ No `format` script; prettier not installed |
| Tests | — | ❌ No test/crawl script; `smoke:qc` (spec-required) absent |

Dependencies installed cleanly via `bun install` (27 packages).

---

## Actionable Recommendations

### High priority

1. **Enable `strict: true`** in `tsconfig.app.json` (and `tsconfig.node.json`). Do this before
   feature work so no non-strict code accrues. → backlog: `remediation-tsconfig-strict`.
2. **Define the real quality gate.** Add `typecheck` and a `smoke:qc` composite (`typecheck` +
   `build` + crawl scenarios), and either install prettier + add `format` or remove `.prettierrc`.
   The spec's acceptance criterion "`bun run smoke:qc` passes" is currently impossible to satisfy. →
   backlog: `remediation-quality-gate-scripts`.
3. **Remove vestigial spernakit config drift** (orphaned root & `frontend/` eslint configs,
   `.prettierrc` if prettier stays uninstalled, empty `frontend/` dir). → backlog:
   `remediation-remove-config-drift`.

### Medium priority

4. **Author `project-structure.md`** with the real Vite/React/store/persistence layout (replace the
   template placeholders) as the first build iteration lands.
5. **Begin feature implementation** per spec order: `board-domain-model` → `local-persistence` →
   `board-management` → `column-management` → `card-crud` → `card-drag-and-drop`, then
   `testing-scenarios`. Create `.aidd/features/*/feature.json` blueprints as each is built.

### Low priority

6. **Replace starter assets/CSS** and remove the counter demo once real UI exists.
7. **Decide the drag-and-drop library** (or hand-rolled pointer events) early, since it shapes the
   card/column component contracts.

---

## Implementation Roadmap

- **Immediate (1–2 days):** Enable strict TS. Add `typecheck` + `smoke:qc` scripts. Remove config
  drift (orphaned eslint/prettier configs + empty `frontend/`). Author `project-structure.md`.
- **Short-term (1–2 weeks):** Build MVP features 1–5 + `local-persistence` + `testing-scenarios`
  (the proof scope): typed store, board/column/card CRUD, drag-and-drop with order arrays,
  reload-safe persistence with corrupt-state fallback, and crawl scenarios. Get `bun run smoke:qc`
  green.
- **Medium-term (1–2 months):** v1.0 features — `board-filters-search`, card due dates,
  multiple-boards UI, import/export JSON. Add persistence debounce and per-card render isolation as
  the board scales.
- **Long-term (3–6 months):** Optional — export/backup formats, keyboard-driven card movement and
  accessibility pass, and (only if the product direction changes) a sync backend, which would
  reopen the full auth/input-validation/API-security surface currently out of scope.

---

## Remediation Backlog Created

The three confirmed, actionable config/tooling issues (independent of the primary feature build)
have durable backlog entries under `.aidd/features/`:

- `remediation-tsconfig-strict` — enable TypeScript strict mode.
- `remediation-quality-gate-scripts` — add `typecheck` + `smoke:qc` (+ resolve prettier).
- `remediation-remove-config-drift` — delete orphaned spernakit-era eslint/prettier config and the
  empty `frontend/` directory.

The 8 primary product features remain tracked in `spec.md` (§ Feature Backlog) and are not
duplicated here.
