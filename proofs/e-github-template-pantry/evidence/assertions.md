# Assertions — Pantry

_Generated: 2026-07-10_
_Purpose: A consolidated, deduplicated checklist of the claims, assumptions, and conclusions
established across the project's review artifacts. These are the load-bearing invariants an
implementer should treat as the current shared understanding until an interview response or a code
change overturns one._
_Basis: `.aidd/questions.md` (onboarding interview, 46 questions), `.aidd/response-review.md`,
`.aidd/remediation-review.md`, and the `.aidd/audit-reports/CODEBASE_ANALYSIS-2026-07-10.md` findings
those documents re-verify against live source (`podex.ps1`, `api/crud/get.ps1`, `server.psd1`)._

## Legend

- `[FACT]` — re-verified against live source; treat as true today.
- `[STATUS]` — a fact about project/process state (artifacts, git, coverage).
- `[CONCLUSION]` — a judgement the review artifacts assert from the facts.
- `[OPEN]` — an unresolved decision; **no defensible default** — must be answered, not guessed.

---

## 1. Product identity & spec drift

- [ ] `[FACT]` The repository ships the stock **"Podex" framework demo**, not the pantry tracker
      `.aidd/spec.md` describes. Product implementation is at **~0%** of spec.
- [ ] `[CONCLUSION]` The spec (pantry) and the code (generic Podex feature/CRUD demo) **diverge
      completely**; where they disagree, which document wins is itself unresolved.
- [ ] `[OPEN]` Is v1 the **pantry product built on Podex**, or is **Podex-the-framework** the
      deliverable with "pantry" a placeholder brief? Nothing downstream can be planned until settled.
- [ ] `[OPEN]` What is the concrete **v1 definition of done** — all 9 spec features shipped+tested,
      or a thinner MVP (CRUD + list + search, deferring low-stock/expiring/CSV)? Which features are
      cuttable if v1 slips?
- [ ] `[OPEN]` Agreement on the proposed **build order** (unify data model + storage/DAL → item CRUD
    - list → filter/search → low-stock → expiring-soon → quick-adjust → CSV → seed, with tests
      alongside each), and whether anything is mis-ordered or out of scope.

## 2. Data model

- [ ] `[FACT]` A **three-layer data-model mismatch** exists: an `items(item, description)` schema, a
      `feature`/`tag` API, and an `item`/`description` view that all disagree — the CRUD demo is
      non-functional as a result.
- [ ] `[CONCLUSION]` There is **no single source of truth** for the entity shape; three incompatible
      shapes coexist.
- [ ] `[FACT]` There is **no migration story** — `api/debug/init.sql` `DROP`s and recreates the
      schema (wipe-and-reseed).
- [ ] `[OPEN]` **Salvage vs. rewrite** — keep any existing `items`/`feature`/`tag` CRUD code, or
      model the pantry `item` entity fresh? Determines whether this is a repair or a rewrite. No
      defensible default.
- [ ] `[OPEN]` Confirm the **canonical pantry item shape**: `name, category, quantity, unit, expiry
(optional), notes (optional), threshold (default 1), createdAt, updatedAt` — any fields to add
      (location, barcode, brand, purchase date) or drop?
- [ ] `[OPEN]` Are the **`tag`/`feature` concepts out of scope** (deletable rather than patchable)?
      This decision also disposes of the SQL-injection hole and the unsafe-char sanitizer below.

## 3. Architecture, storage & framework idioms

- [ ] `[FACT]` Storage is **SQLite via PSSQLite**, with SQL inlined into every route handler — there
      is **no data-access layer**, despite the spec asking for storage "behind a small DAL."
- [ ] `[FACT]` API routes are **auto-registered by filename → HTTP method/path** in `podex.ps1` (the
      framework's core convention).
- [ ] `[FACT]` The "add item" flow has **three inconsistent names** — route `/htmx/item-new`, route
      `/htmx/crudmgr-new` + component `crud-new`, and file `crudmgr-new.pode` — none wired consistently
      ("broken Add-Item wiring").
- [ ] `[FACT]` The list is rendered **client-side via Mustache** (`client-side-templates` htmx
      extension) from JSON, whereas the spec frames the interaction as server-rendered fragments.
- [ ] `[FACT]` `.build.ps1` **mixes install with build/verify** (`Install-Module`, `npm install`,
      interactive DB-reinit `Read-Host`), so it cannot run non-interactively in CI as-is.
- [ ] `[OPEN]` **SQLite + a real DAL, or JSON file** — and is the swappable-storage abstraction
      required now? The spec defers this; the code chose SQLite with no abstraction.
- [ ] `[OPEN]` Is the filename→route auto-registration convention **load-bearing/sacred** or open to
      change? What is the intended **canonical naming** for routes vs. components vs. `.pode` files?

## 4. Security findings

- [x] `[FACT]` **SQL injection** at `api/crud/get.ps1:50` — raw `tagFilter` was interpolated into the
      `[tag]`-table query while every other query is parameterized. **Resolved 2026-07-10** by
      deleting the interpolated tag-list query and its `tags` response key (per the responses.md
      decision to discard the `feature`/`tag` demo domain rather than patch it). No interpolated SQL
      remains in `get.ps1`; the only live query (the `[feature]` select) uses `-SqlParameters`.
- [ ] `[FACT]` `Remove-UnsafeCharacter` (`podex.ps1:35`) is a **blacklist that mangles legitimate
      data** (`O'Brien` → `O''Brien`, `--` → `\-\-`) even though inserts are already parameterized.
- [ ] `[FACT]` `crudmgr-new.pode:34` invites note input "in markdown or HTML format," which would
      introduce **stored-XSS risk** and require sanitization if rich text is actually rendered.
- [x] `[FACT]` **Logger path traversal (latent) — RESOLVED 2026-07-10** — `Write-FormattedLog`'s
      `-save` branch built an output path from `$WebEvent.Request.Url.AbsolutePath` (a latent
      path-traversal / arbitrary-write primitive). It had **no callers**, so the dead `-save` switch
      and its branch were removed entirely (`remediation-20260710-logger-path-traversal`). The
      primitive no longer exists.
- [ ] `[OPEN]` Confirm **"no authentication" is a permanent v1 decision** (spec) and not deferred —
      no login/session scaffolding to build.
- [ ] `[OPEN]` Is HTML/markdown notes rendering actually wanted, or is **plain text (auto-escaped)**
      fine? (Governs whether XSS sanitization is in scope.)

## 5. Debug routes, config & operational hot-path

- [x] `[RESOLVED 2026-07-10]` `Podex.Debug` now defaults to **`$false`** in `server.psd1`, and the
      file-based route auto-loader gates on it via `Resolve-ApiRouteRegistration`
      (`api/_lib/route-registration.ps1`): the destructive **unauthenticated `/stop`, `/clear`,
      `/init` routes** are **absent under the default config** (not relocated to `/api/debug/*`). Debug
      must be explicitly opted into for local dev. _(`Web.ErrorPages.ShowExceptions` stack-trace leak
      is now **RESOLVED 2026-07-10** by `show-exceptions-disclosure`: defaults to `$false`, so uncaught
      errors render the generic `errors/default.html.pode` page — no exception message/stack trace to
      clients — while full details are still logged server-side via `Enable-PodeErrorLogging`.)_
- [ ] `[FACT]` `get.ps1:79` serializes the **full response to JSON unconditionally** (a hot-path cost
      on every GET) — it is **not** `Podex.Debug`-gated. Only the file write at `get.ps1:80-82` (writing
      `Get.json` into the source tree) is behind the `Podex.Debug` check. _(Corrects the original
      debug-hotpath-writes description.)_
- [ ] `[CONCLUSION]` The three Debug-keyed items (`debug-hotpath-writes`, `unauth-debug-routes`,
      `show-exceptions-disclosure`) share one root cause — the `Podex.Debug = $true` default at
      `server.psd1:39`. If Debug is defaulted to `$false` first, the file-write item's urgency drops.
      They should be **cross-linked**, not treated independently.
- [ ] `[OPEN]` **Where does it run** — localhost / LAN / internet-exposed? This alone decides whether
      the Debug/ShowExceptions findings are non-issues or must-fix-now.
- [x] `[RESOLVED 2026-07-10]` **`Podex.Debug` now defaults to `$false`** with an explicit local-dev
      opt-in (per `.aidd/responses.md`), the intended posture for this localhost/LAN-only app.

## 6. Pagination

- [x] `[FACT]` ~~**Pagination totals are computed from the paginated result set**, so the built
      `$countSqlx` count query at `get.ps1:22,48` is **never executed** — effectively untested/dead
      functionality.~~ **RESOLVED (2026-07-10, `pagination-total-count`) via deletion:** the
      `feature`/`tag` demo domain was discarded (approval on `.aidd/responses.md`) and `api/crud/get.ps1`
      was removed with commit `02323cb`. No `totalItems`/`$countSqlx`/`hasNextPage`/`totalPages` logic
      remains in source. The pantry views (inventory/lowstock/expiring) are grouped/derived projections,
      not paginated, so there is no total-count surface to mis-compute.
- [ ] `[FACT]` **Paging input coercion** at `get.ps1:13-14` uses a hard `[int](...)` cast that throws
      a 500 on bad input instead of returning a 400.
- [ ] `[CONCLUSION]` The two paging remediations (`paging-input-validation` at `get.ps1:13-14` and
      `pagination-total-count` at `get.ps1:48`) touch the **same block** and add tests to the **same
      file**; distinct defects, but they will collide if worked in parallel and must be **sequenced**.

## 7. Testing & quality gates

- [ ] `[STATUS]` **Test coverage is 0%.** Only `tests/tests.ps1.old` exists, and the Pester glob
      (`tests/*.ps1`) excludes it. No Pester tests are discovered.
- [ ] `[FACT]` PSScriptAnalyzer runs clean (2 info, 2 warnings); **ESLint could not run** (JS deps
      not installed).
- [ ] `[FACT]` No `package-lock.json` is committed (git-ignored), so vendored JS (htmx, mustache,
      tailwind) is **version-unpinned**; PowerShell module versions are pinned in `.build.ps1`.
- [ ] `[OPEN]` Is **per-feature Pester coverage a hard "done" gate** for v1, or aspirational? Sets the
      cost of every feature.
- [ ] `[OPEN]` What are the **green-gate commands** (`npm run test` / `analyze` / `lint`) and at what
      severity threshold should each block a commit?

## 8. Interview & response status

- [ ] `[STATUS]` `.aidd/questions.md` (**46 questions**: 14 CRITICAL / 18 HIGH / 14 NICE) was
      generated, framed as a **one-shot final handoff** (outgoing maintainers become unreachable).
- [ ] `[STATUS]` **No interview responses were ever submitted** — there is no `.aidd/responses.md`, no
      `.aidd/responses/`, and no answers in the run ledger or iteration logs. All 46 questions are
      unanswered.
- [ ] `[CONCLUSION]` The 14 CRITICAL decisions currently **default to agent judgment**, which the
      project's hard constraints **prohibit** for fork-in-the-road questions (product identity,
      salvage-vs-rewrite, storage). Proceeding without answers risks building the wrong product.
- [ ] `[CONCLUSION]` No contradictions exist in responses because there are none; the _documents_
      remain in the fully-diverged state the questionnaire was written to resolve.

## 9. Remediation backlog (provenance & quality)

- [ ] `[STATUS]` The three `remediation-20260710-*` features were created by the **`doc2feature`
      triage** of the codebase-analysis report — **not** from interview responses (none exist). _(This
      corrects the "created from interview responses" framing.)_
- [ ] `[CONCLUSION]` All three remediation features **re-verify against current source** (accurate
      line anchors), are **tightly single-defect scoped**, and are **correctly deduplicated** against the
      nine `audit-codebase-analysis-*` entries — **no duplicates**.
- [ ] `[CONCLUSION]` Adjacencies that are **not** duplicates: same-file/different-defect
      (`paging-input-validation` vs `pagination-total-count`) and same-root-cause/thematic
      (`debug-hotpath-writes` vs `unauth-debug-routes`/`show-exceptions-disclosure`).
- [ ] `[CONCLUSION]` Both `get.ps1` paging items **may be superseded by the data-model rewrite**
      (`data-model-mismatch`, `broken-add-and-update-wiring`) and should be gated on the unresolved
      build-order decision — don't polish `get.ps1` if the entity is about to be re-modelled.
- [ ] `[CONCLUSION]` **Two priority vocabularies coexist** — audit features use 1/2/3
      (Critical/High/Medium); remediation features use 3/4 with no audit counterpart for 4. A single
      documented mapping is needed for unambiguous cross-backlog ordering.
- [ ] `[STATUS]` No `roadmap.json` is present, so the three remediation features are **unscheduled**
      (Phase 8b assignment skipped); their ordering relative to the higher-severity audit items is
      implicit only.

## 10. Confirmed non-goals (spec)

- [ ] `[FACT]` Explicitly out of scope for v1: **no authentication, no realtime, no external APIs,
      single household (no multi-tenancy)**.
- [ ] `[FACT]` **No SPA framework, no bundler, no Node server** — htmx partial swaps against
      server-rendered fragments are the mandated interaction model.
- [ ] `[FACT]` Fixed product rules asserted by the spec (pending confirmation as firm vs. negotiable):
      low-stock `threshold` default **= 1**; expiring-soon window **within 7 days or past**; quantity
      **≥ 0**; search matches **name and notes, case-insensitive**.

---

## Overall project status

- [ ] `[STATUS]` The project is **`waiting_approval`** on the interview. Until the Top-5 must-ask
      criticals are answered and captured in `.aidd/responses.md`, no substantive implementation run
      should be scheduled. The single item safe to action now, independent of every open decision, is
      **`remediation-20260710-logger-path-traversal`** (latent, dead code).
