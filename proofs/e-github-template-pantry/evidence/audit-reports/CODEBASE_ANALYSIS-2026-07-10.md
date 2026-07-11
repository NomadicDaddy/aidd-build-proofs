# Codebase Analysis — pantry

**Date:** 2026-07-10
**Analyst:** AIDD codebase-analysis ingredient (single-agent, claude-opus-4-8)
**Scope:** Full repository at `<WORKSPACE>/pantry`
**Stack (inferred, authoritative):** PowerShell Core + [Pode](https://github.com/Badgerati/Pode) server, [PSSQLite](https://github.com/RamblingCookieMonster/PSSQLite)/SQLite storage, htmx + Mustache (client-side templates) + Tailwind CSS v4 frontend, server-rendered `.pode` views. No Node server, no bundler, no SPA framework — consistent with `.aidd/spec.md`.

---

## Executive Summary

**Overall health score: D**

The repository is the **stock "Podex" framework demo** (a generic feature/CRUD manager), not the pantry tracker described in `.aidd/spec.md`. As a _framework template_ it is coherent; as an _implementation of the specified product_ it is at zero percent. Worse, even the demo it ships is **not internally consistent**: the SQL schema, the API queries, and the view template each describe a **different data model**, so the CRUD demo cannot function end-to-end against a freshly initialized database. Layered on top are a SQL-injection vector, broken pagination, broken routes, unauthenticated destructive debug endpoints (enabled by default), and zero test coverage.

Because git has **no commits yet**, there is no historical evolution to analyze — this is a greenfield scaffold captured mid-transition (the `items` demo is being reworked into a `feature`/`tag` demo, and neither half is complete).

### Top 3 critical issues

1. **Three-layer data-model mismatch — the CRUD demo is non-functional.** `api/debug/init.sql` creates an `items(item, description)` table; the API in `api/crud/*.ps1` queries a `feature(application, featureName, featureText, tag, rank)` table **and** a `tag` table that no SQL file ever creates; the view `views/components/crudmgr.pode` renders `{{item}}`/`{{description}}`. Against an initialized DB, every `/api/crud` request throws → HTTP 500.
2. **SQL injection via string interpolation** in `api/crud/get.ps1:50` — `tagFilter` from the query string is concatenated directly into the `tag` lookup query, bypassing the parameterized path used everywhere else.
3. **Unauthenticated, destructive debug endpoints enabled by default.** With `Podex.Debug = $true` (the shipped default in `server.psd1`), `GET /stop` shuts the server down, and `/clear` / `/init` drop and recreate tables — no auth, reachable by anyone who can reach the port.

### Top 3 optimization / remediation opportunities

1. **Implement the actual pantry spec** (items with category/quantity/unit/expiry/threshold/notes; grouped inventory; category+search filter; low-stock and expiring-soon views; quick-adjust; CSV export; seed script) on top of the existing Pode/htmx idioms — the framework is a fine substrate; the product simply isn't built.
2. **Establish a single source of truth for the data model** — one schema, DAL functions, API, and view that agree — and back it with a Pester test suite (currently there are none).
3. **Separate "install/setup" from "build/verify"** and gate debug routes/exception disclosure behind non-default configuration so the app is CI-friendly and safe by default.

---

## Detailed Findings

### Architecture

- **Routing model (`podex.ps1:69-107`).** Two page routes (`/`, `/crudmgr`) render `layouts/main`; static assets served from `/public`; file-based API auto-registration walks `./api/**/*.ps1` and derives method + path from the filename (`get.ps1`→GET, `post.ps1`→POST, etc.), collapsing `api/crud/{get,post,put,delete}.ps1` onto a single `/api/crud` route with four methods. This convention is clean and is the framework's core idea.
- **Debug-only routes.** The same loop maps `api/debug/*.ps1` to top-level GET routes (`/init`, `/clear`, `/stop`) **only when `Podex.Debug`** — but Debug ships `$true`.
- **Broken view↔route wiring for "Add Item".** `crudmgr.pode:63` triggers `hx-get="/htmx/item-new"`, but no such route is registered. `podex.ps1:78` registers `/htmx/crudmgr-new` and renders component `crud-new`, yet the file on disk is `views/components/crudmgr-new.pode`. So the modal never loads (404 / missing-component), regardless of which name a caller uses. Three names for one thing: `item-new`, `crudmgr-new`, `crud-new`.
- **View engine & layout.** `layouts/main.pode` composes header/footer partials and a components array server-side; `crudmgr.pode` uses htmx + `client-side-templates` + Mustache to render the list from the JSON the API returns. Reasonable hypermedia architecture.
- **Data-access layer is absent.** SQL is inlined into each route handler (`Invoke-SqliteQuery` called directly in `get/post/put/delete.ps1`). The spec explicitly asks for "a small data-access layer" that keeps storage swappable; today the DB filename lookup (`(Get-PodeConfig).Podex.DBFile`) and every query are duplicated per-file.

### Performance

- **Pagination totals are computed from the wrong number (`api/crud/get.ps1:48`).** `$totalItems = $rs.Count`, but `$rs` is the **already-paginated** result set (`LIMIT @pageSize OFFSET @offset`). So `$totalItems` never exceeds `pageSize` (default 10). The correct count query, `$countSqlx`, is **built but never executed** (`get.ps1:22,39`). Consequence: `totalPages`, `endIndex`, `hasNextPage`, and the page-number list are all wrong; pagination beyond page 1 is effectively broken.
- **Debug artifacts written into the source tree on every GET (`get.ps1:80-82`).** When Debug is on, each list request writes `Get.json` to `$PSScriptRoot` and logs the full response JSON (`ConvertTo-Json -Depth 5`) to the terminal. Synchronous disk I/O and large log serialization on the hot path.
- **Verbose logging on hot paths.** Multiple `Write-FormattedLog -tag 'debug'` calls per request serialize query/response objects even when not needed.
- No caching layer; static cache disabled (`server.psd1` `Web.Static.Cache.Enable = $false`) — acceptable for local dev, worth revisiting for production.

### Security

- **[Critical] SQL injection — `get.ps1:50`.** The tag-list query interpolates the raw query-string value: `... case when [tag] = '$($tagFilter)' then 'selected' ...`. A `tagFilter` of `x' OR '1'='1` (or worse) escapes the literal. Every other query in the file correctly uses `-SqlParameters`; this one does not.
- **[Critical] Destructive unauthenticated endpoints by default.** `GET /stop` → `Close-PodeServer` (DoS); `/clear`, `/init` → `DROP TABLE` + recreate. No auth, no CSRF, GET-triggerable. Enabled whenever `Podex.Debug = $true` — the default.
- **[High] `Remove-UnsafeCharacter` is a fragile blacklist that also corrupts data (`podex.ps1:35-45`, used in `post.ps1:43-46`).** It doubles apostrophes, backslash-escapes `"`, `;`, `--`, `/*`, `*/`, and `\`. Because the INSERT is _already parameterized_ (`post.ps1:48-57`), this sanitizer is redundant **and** it mutates legitimate content before storage (a note containing `--` becomes `\-\-`; `O'Brien` becomes `O''Brien`). Blacklist input-mangling is the wrong model; rely on parameterization and store data verbatim.
- **[Medium] Stack-trace disclosure.** `server.psd1` sets `Web.ErrorPages.ShowExceptions = $true`. Combined with default Debug, internal exceptions/paths leak to clients.
- **[Medium] XSS surface.** Mustache `{{ }}` auto-escapes, so the current client-side render is largely safe; however `crudmgr-new.pode:34` invites input "in markdown or HTML format", signaling intent to render unescaped rich text later. Any move to `{{{ }}}`/`Write-PodeHtmlResponse` of user content would introduce stored XSS. Flag before that happens.
- **[Low] Request-derived file path in logger.** `Write-FormattedLog -save` writes to `./$($WebEvent.Request.Url.AbsolutePath)/$($WebEvent.Method).json` (`podex.ps1:31-33`) — path built from the request URL. Not currently invoked with `-save`, but it is a latent path-traversal / arbitrary-write primitive.
- **Dependencies.** Runtime JS deps (htmx, mustache, tailwind) are vendored/copied by `.build.ps1`; no `package-lock.json` is committed (it is git-ignored), so npm dependency provenance is unpinned. PowerShell modules (Pode, PSSQLite, Pester, PSScriptAnalyzer) are version-bounded in `.build.ps1`.

### Quality / Technical Debt

- **[High] No test coverage.** `tests/` contains only `tests.ps1.old`, which does **not** match the Pester glob `tests/*.ps1` (`package.json` `test` script). Effective coverage: 0%. The spec's quality bar requires all features covered by tests.
- **[High] PUT can never succeed from the UI.** `put.ps1:19-35` requires `application`, `featureName`, `tag` and a valid integer `id`; the Update button (`crudmgr.pode:110-117`) posts `closest tr`, whose hidden inputs are `id`, `item`, `description` (`crudmgr.pode:105-107`). None of the required fields are present → always HTTP 400. Same schema split as finding #1.
- **[Medium] Fragile integer coercion.** `get.ps1:13-14` does `[int]($WebEvent.Query['page'] ?? 1)`; a non-numeric `page`/`pageSize` throws during cast → HTTP 500 instead of a validated 400.
- **[Medium] Duplication.** Header/log/DB-lookup/validation boilerplate is copy-pasted across `post.ps1`/`put.ps1`; `clear.ps1` and `init.ps1` are near-identical; the `crud`/`item`/`feature` naming is used interchangeably.
- **[Low] `project-structure.md` is an unfilled template.** `.aidd/project-structure.md` still contains `{placeholder}` scaffolding — no real architecture map exists for the project.
- **Lint/analyzer status (see Quality Validation below).** PSScriptAnalyzer is clean apart from 2 informational + 2 warnings; ESLint could not run (deps not installed).

### Evolution (git history)

- **No commits exist** (`git log` → "does not have any commits yet"). Every file is untracked. There is no baseline commit, no history of architectural decisions, and no way to assess quality trends or bug-fix patterns over time. Establishing an initial commit is itself a prerequisite for any historical analysis and for safe iteration.

---

## Actionable Recommendations

Priority labels follow `aidd/audits/SEVERITY_CLASSIFICATION.md` (Critical=1 / High=2 / Medium=3 / Low=4). Durable backlog entries have been created under `.aidd/features/audit-codebase-analysis-*` for the confirmed, actionable findings.

### High priority (Critical + High severity)

1. **Unify the data model (Critical).** Decide the real entity (per spec: pantry `items`). Write one schema, one set of DAL functions, one API contract, and one view that agree. Remove the orphaned `feature`/`tag` references or the orphaned `items` schema — not both half-present. _Files:_ `api/debug/init.sql`, `api/crud/*.ps1`, `views/components/crudmgr.pode`.
2. **Parameterize the tag query (Critical).** Replace the interpolated `tag` lookup in `get.ps1:50` with `-SqlParameters @{ tagFilter = $tagFilter }`.
3. **Gate debug/destructive routes (Critical).** Require explicit non-default opt-in for `/stop`, `/clear`, `/init`; never register them when serving anything but local dev; consider requiring POST + a shared secret. _Files:_ `podex.ps1:80-94`, `server.psd1`.
4. **Fix pagination counting (High).** Execute `$countSqlx` (with the same WHERE params) and use its scalar for `$totalItems`. _File:_ `get.ps1:38-54`.
5. **Fix Add-Item and Update wiring (High).** Reconcile the route/component names (`/htmx/item-new` vs `/htmx/crudmgr-new` vs component `crud-new` vs file `crudmgr-new.pode`) and align the fields the Update button sends with what `put.ps1` requires. _Files:_ `podex.ps1:78`, `crudmgr.pode:63,110`, `put.ps1`.
6. **Add a Pester test suite (High).** Rename/replace `tests/tests.ps1.old` with `tests/*.ps1` covering each API method and validation branch; keep `package.json` `test` green.
7. **Remove/replace `Remove-UnsafeCharacter` (High).** Rely on parameterized queries; store user text verbatim. _Files:_ `podex.ps1:35`, `post.ps1`.

### Medium priority

8. **Disable `ShowExceptions` by default** and route errors to generic pages outside dev. _File:_ `server.psd1`.
9. **Validate paging inputs** (`TryParse` with 400 on failure) instead of hard casts. _File:_ `get.ps1`.
10. **Introduce a small DAL** (`api/_lib` or similar) to remove per-handler DB/logging/validation duplication, per the spec's "swappable behind a small data-access layer".
11. **Fill in `.aidd/project-structure.md`** with the real layout once the data model is unified.

### Low priority

12. Remove request-hot-path debug file writes (`get.ps1:80-82`) or guard them behind a narrower flag.
13. Harden the `-save` logger path (`podex.ps1:31-33`) against traversal, or remove the unused branch.
14. Address PSScriptAnalyzer notes: BOM/encoding on `podex.ps1`, and either rename `Remove-UnsafeCharacter` (state-changing verb) or have it support `ShouldProcess`.

---

## Implementation Roadmap

**Immediate (1–2 days)**

- Parameterize `get.ps1:50` (Critical SQL injection).
- Gate/disable `/stop`, `/clear`, `/init` and set `Podex.Debug`/`ShowExceptions` safe-by-default (Critical).
- Create the initial git commit to establish a baseline.

**Short-term (1–2 weeks)**

- Unify schema/API/view on the pantry `items` model; fix pagination count; fix Add-Item and Update wiring; remove `Remove-UnsafeCharacter`.
- Stand up a Pester suite covering the CRUD paths; get `npm run test` and `npm run analyze` green in CI.

**Medium-term (1–2 months)**

- Implement the remaining spec features: category+search filter, low-stock view (+ `threshold`), expiring-soon view, quick-adjust, CSV export, seed-data script.
- Extract a small DAL; fill in `project-structure.md`; split `.build.ps1` into `install` vs `verify`.

**Long-term (3–6 months)**

- Accessibility pass (labeled inputs, keyboard flows, button semantics) per the spec's quality bar.
- Optional production hardening: HTTPS endpoint config, structured logging levels, dependency pinning (commit a lockfile or vendor manifest), and OpenAPI docs aligned to the real routes.

---

## Quality Validation

| Gate                         | Command                               | Result                                                                                                                                                                                                                    |
| ---------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build / setup                | `.build.ps1`                          | **Not run.** It is an interactive install+init script (`Install-Module`, `npm install`, `Read-Host` DB reinit prompt), not a pure build; running it is the initializer's responsibility and is out of scope for analysis. |
| Lint (JS)                    | `npm run lint` (eslint)               | **Could not run** — `node_modules` absent (`Cannot find package '@eslint/js'`). Dependencies not installed in this environment.                                                                                           |
| Static analysis (PowerShell) | `Invoke-ScriptAnalyzer -Recurse`      | **Passed** (no errors). 2 Information (`PSAvoidUsingPositionalParameters` on `npm` calls in `.build.ps1`), 2 Warning (`PSUseBOMForUnicodeEncodedFile` and `PSUseShouldProcessForStateChangingFunctions` on `podex.ps1`).  |
| Tests                        | `npm run test` (Pester `tests/*.ps1`) | **No tests discovered** — only `tests/tests.ps1.old` exists, which the glob excludes. Coverage: 0%.                                                                                                                       |

**Coverage gaps:** every route (`/api/crud` GET/POST/PUT/DELETE, `/htmx/*`, debug endpoints) is untested; no validation-branch, pagination, or filter tests exist.

---

## Severity Distribution

| Severity | Count (backlog features) |
| -------- | ------------------------ |
| Critical | 3                        |
| High     | 4                        |
| Medium   | 2                        |

The High/Critical share is well above a "healthy" distribution — expected here, because the repository is a mid-transition demo scaffold rather than a maintained implementation of its own spec. The dominant remediation is not "fix N bugs" but "build the specified product on the (sound) framework substrate, with the data model unified and tests in place."
