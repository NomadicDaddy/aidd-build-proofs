# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **Feature `audit-security-1783694727-openapi-spec-and-swagger-ui-mounted-unconditionally-in-all-environments`
  completed (2026-07-10):** Closed the Low finding that the OpenAPI document and Swagger UI were mounted
  on **every** deployment regardless of the `Podex.Debug` flag, exposing the full API surface
  (`/docs/openapi`, `/docs/swagger`) in production.
    - **Debug gate (podex.ps1).** The `Enable-PodeOpenApi -RouteFilter '/api/*' -Path '/docs/openapi'`,
      `Add-PodeOAInfo`, and `Enable-PodeOAViewer -Type Swagger -Path '/docs/swagger'` calls previously sat
      **after** the Debug-gated route-dump block, so they always ran. They are now wrapped in an
      `if ($cfg.Podex.Debug) { ... }` block — the same Debug-gating pattern already used for the route dump
      and the destructive `/stop` `/clear` `/init` routes (via the route-registration gate). Under the
      default configuration (`server.psd1` ships `Podex.Debug = $false`, already verified by the coupled
      show-exceptions / unauth-debug-routes fixes) Pode never registers `/docs/openapi` or `/docs/swagger`,
      so both return **404**. The endpoints remain available as a deliberate local-dev opt-in when Debug is
      flipped on.
    - **Regression guard.** Added a Pester Describe `OpenAPI/Swagger docs are Debug-gated (podex.ps1)` to
      `tests/pantry.Tests.ps1` asserting the `Enable-Pode*` docs calls are still present _and_ that they sit
      inside an `if ($cfg.Podex.Debug)` block (source-level regex disallowing an intervening closing brace).
      `npm test` → **78 passed / 0 failed** (was 76; +2). `npm run format` clean; `npm run lint` errors
      remain confined to the pre-existing vendored `public/js/mustache.js`.
    - **Verification (headless).** This is a server-bootstrap/route-registration default; the invariant is a
      404 that follows deterministically from Pode not registering the routes when Debug is off. Live
      browser re-verification was not applicable — the app port (8433) is held by a pre-existing user-owned
      Pode instance that must not be torn down, and standing up a competing server is prohibited by session
      constraints — so the invariant is pinned by the config-load + source-gate Pester assertions.
      Originating-spec hardening: the docs bootstrap is stock Podex substrate not owned by a single pantry
      `feature.json`, so per the session's "only modify the selected feature" rule, reintroduction is pinned
      by the new Pester guard rather than an edit to another feature spec.

- **Feature `audit-security-1783694727-no-http-security-response-headers-configured-csp-x-frame-options-x-content-type-`
  completed (2026-07-10):** Closed the Medium finding that Pode emitted **no** HTTP security response
  headers by default — every response (HTML views, htmx fragments, JSON API, CSV) shipped with no CSP,
  no X-Frame-Options, no X-Content-Type-Options, and no Referrer-Policy.
    - **Headers (podex.ps1).** Inside the `Start-PodeServer` scriptblock, before the static route, added the
      Pode security cmdlets so the built-in security middleware attaches them to **every** response:
      `Set-PodeSecurityContentTypeOptions` (`X-Content-Type-Options: nosniff`),
      `Set-PodeSecurityFrameOptions -Type Deny` (`X-Frame-Options: DENY`),
      `Set-PodeSecurityReferrerPolicy -Type No-Referrer`, and `Set-PodeSecurityContentSecurityPolicy` with a
      first-party policy: `default-src/script-src/img-src/connect-src 'self'`, `object-src 'none'`,
      `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, and `style-src 'self' 'unsafe-inline'`.
      `style-src` is the only relaxation — htmx injects a small inline `<style>` for its request indicators at
      load (`public/js/htmx.js` `insertIndicatorStyles`); inline styles cannot execute code, so scripts stay
      strictly first-party while indicators still work. HSTS
      (`Set-PodeSecurityStrictTransportSecurity -Duration 31536000 -IncludeSubDomains`) is emitted **only** when
      the HTTPS endpoint is active, so it is never sent over plain HTTP.
    - **Strict `script-src 'self'` (no `'unsafe-inline'`).** The one inline `<script>` in
      `views/layouts/main.pode` (the htmx 422-swap handler + focus management) was moved verbatim into a new
      external file **`public/app/pantry.js`**, referenced via `<script src="/public/app/pantry.js">`. It lives
      under the version-controlled `public/app/` rather than `public/js/`, because `public/js/` is a gitignored
      build-output directory that `.build.ps1` populates by copying vendored libs (htmx, mustache) from
      `node_modules` — a source file there would not survive a fresh checkout/build.
    - **Live verification.** The real app port (8433) was held by a pre-existing, user-owned Pode instance
      running pre-change code (and not responding to curl), and the port cannot be re-bound, so the integrated
      server could not be exercised without tearing down the user's process (prohibited). Instead the **exact**
      security-header block was run against live Pode 2.13.4 on an isolated free port and curl'd: it emits
      `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `X-XSS-Protection: 0`,
      and `Content-Security-Policy: default-src 'self'; connect-src 'self'; img-src 'self'; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`.
      Every asset the layout loads (htmx + the other vendor scripts + `pantry.js` under `/public`, `output.css`,
      `favicon.svg`, all same-origin htmx XHRs) is permitted by this policy; no first-party resource is blocked.
    - **Regression guard.** Added a Pester Describe `HTTP security response headers are configured
(podex.ps1 + layout)` to `tests/pantry.Tests.ps1` asserting the four cmdlet calls, the CSP directives
      (`default`/`script` `'self'`, `frame-ancestors 'none'`), HSTS gating, that `public/app/pantry.js` exists,
      that the layout references it, and that the layout carries **no** inline `addEventListener` handler (which
      would force `script-src 'unsafe-inline'`). `npm test` → **76 passed / 0 failed** (was 70; +6).
      `eslint`/`prettier` clean on all changed files (the 162 lint errors remain confined to the pre-existing
      vendored `public/js/*` libs). Originating-spec hardening: the layout/server bootstrap is stock Podex
      substrate not owned by a single pantry `feature.json`; per the session's "only modify passes/status on the
      selected feature" rule, other feature specs were not edited — reintroduction is instead pinned by the new
      Pester guard above.

- **Feature `audit-codebase-analysis-1783691802-show-exceptions-disclosure` completed (2026-07-10):**
  Closed the Medium finding that `Web.ErrorPages.ShowExceptions = $true` (server.psd1) returned internal
  exception messages and stack traces — file paths, implementation details — to clients on any uncaught
  error.
    - **Step 1 — safe default.** Set `Web.ErrorPages.ShowExceptions = $false` in `server.psd1`. Per Pode
      2.13.4 (`Private/Responses.ps1:63`), the exception block in the error response is only populated when
      that flag is on; with it off, `$data.exception` is empty, so `errors/default.html.pode` (which renders
      the exception `<pre>` only `if ($data.exception)`) serves a **generic** page — status code +
      description only, no message/stack trace. **Step 2** (generic error pages) is thus satisfied by the
      existing template with no template change.
    - **Step 3 — explicit local-dev opt-in.** Documented `ShowExceptions` as OFF-by-default with an inline
      comment: flip to `$true` only as a deliberate local-dev override on a trusted machine, mirroring the
      already-`$false` `Podex.Debug` posture (set by the coupled `unauth-debug-routes` fix). This matches
      `responses.md`: "`Podex.Debug` and `Web.ErrorPages.ShowExceptions` must default OFF, with an explicit
      local-dev opt-in." Full error detail remains available server-side regardless, via the file-based
      `Enable-PodeErrorLogging` (`podex.ps1:59`).
    - **Step 4 — regression guard.** Added a `Security-posture config defaults (server.psd1)` Describe to
      `tests/pantry.Tests.ps1` that `Import-PowerShellDataFile`-loads `server.psd1` and asserts
      `ShowExceptions=$false`, `Podex.Debug=$false`, and that `errors/default.html.pode` exists.
    - **Verification (headless).** `npm test` → **70 passed / 0 failed** (was 67; +3). `npm run format`
      clean. `npm run lint` errors remain confined to the vendored `public/js/mustache.js` (pre-existing,
      unrelated to this PowerShell/config change). `PSScriptAnalyzer` on the test file adds no new findings
      (only the pre-existing `New-TestDb`/`New-ItemObject` ShouldProcess warnings on unchanged helpers).
      Live browser re-verification was not applicable: this is a server-config/error-handling default with
      no UI surface, and standing up a competing server is prohibited by session constraints; the invariant
      is covered by the config-load Pester assertions.

- **Feature `audit-codebase-analysis-1783691801-unsafe-char-sanitizer` completed (2026-07-10):**
  Closed the Medium finding that `Remove-UnsafeCharacter` (podex.ps1) was a redundant blacklist that
  corrupted legitimate stored text (doubling apostrophes — `O'Brien` → `O''Brien` — and
  backslash-escaping `-- " ; /* */ \`) even though every INSERT is already parameterized.
    - **Reality at remediation time.** The function's only caller — the demo `api/crud/post.ps1` —
      was already deleted with the stock `feature`/`tag` domain, so `Remove-UnsafeCharacter` was dead
      code with no writers invoking it. All pantry persistence now flows through the parameterized DAL
      (`api/_lib/pantry-store.ps1`): `New-PantryItem`/`Update-PantryItem`/`Remove-PantryItem` bind every
      value as an `@`-parameter via `Invoke-SqliteQuery -SqlParameters`, so injection-shaped input is
      stored as data and legitimate text is stored verbatim.
    - **Steps 1–3.** Deleted the `Remove-UnsafeCharacter` function from `podex.ps1`, replacing it with
      a comment documenting why no pre-storage sanitizer exists (parameterization is the injection
      defense; escaping here both duplicated it and mangled data). A repo-wide grep confirms no
      surviving callers — the only remaining mentions are explanatory comments.
    - **Step 4 — round-trip guards.** Added two tests to `tests/pantry.Tests.ps1`'s SQL-injection
      Describe: `O'Brien` + a note `batch -- "special"; C:\pantry\aisle 3\` round-trips byte-for-byte
      through create + read (asserting no doubled apostrophes, no backslash-escaping via
      `Should -BeExactly`), and a second asserting the same through update + read.
    - **Verification (headless).** `npm test` → **67 passed / 0 failed** (was 65; +2 new).
      `npm run format` clean. `Invoke-ScriptAnalyzer` on `podex.ps1` and `tests/pantry.Tests.ps1` adds
      no new findings (only the pre-existing `PSUseBOMForUnicodeEncodedFile` on `podex.ps1`'s emoji log
      icons and the two `New-TestDb`/`New-ItemObject` ShouldProcess warnings on unchanged test helpers).
      `npm run lint` errors remain confined to the vendored `public/js/mustache.js` and other pre-existing
      JS, unrelated to these PowerShell-only changes. Live browser re-verification was not applicable:
      this is a storage-layer/dead-code change with no UI surface, fully covered by the Pester round-trip
      suite (each UI surface was browser-verified at its own implementation commit).

- **Feature `audit-codebase-analysis-1783691800-spec-drift-unimplemented` completed (2026-07-10):**
  Closed the High finding that the repo shipped the stock Podex `feature`/`tag` CRUD demo instead of
  the pantry tracker in `.aidd/spec.md`, with `project-structure.md` still an unfilled template.
    - **Reality at remediation time.** The finding predates the pantry build-out. Its blocking
      dependency `data-model-mismatch` is complete, and every spec capability was subsequently
      implemented across the product-feature commits (`b40ea2d`…`1f1df35`): item model + CRUD with
      inline htmx forms and 422 server-side validation, inventory grouped by category, category +
      case-insensitive name/notes search, low-stock view (threshold default 1, nav count),
      expiring-soon view (≤7 days, expired-vs-expiring styling, nav count), quick-adjust +/− single-row
      swap, CSV export, and the ~20-item seed script. The stock demo (`api/crud/*`, `crudmgr*` views,
      `feature`/`tag` domain) was removed.
    - **Step 3 done this iteration.** Rewrote `.aidd/project-structure.md` from the stale
      "~0% of spec / stock Podex demo" template into the real implemented pantry layout: the `api/_lib`
      DAL/render/paging/route-registration helpers, the explicit pantry route table in `podex.ps1`,
      the `inventory`/`lowstock`/`expiring`/`about` components, `scripts/seed.ps1`, and the
      canonical `items` schema — plus corrected dev-workflow (`npm test`, `npm run seed`) and the
      `Podex.Debug` default-off note.
    - **Verification (headless).** `npm test` → **65 passed / 0 failed** (step 4: `tests/pantry.Tests.ps1`
      covers the DAL, filters, validation, low-stock/expiring selection, CSV, quick-adjust, and
      form/route contracts). `npm run format` clean. `npm run lint` errors are confined to the vendored
      `public/js/mustache.js` (pre-existing, unrelated to this markdown-only change). Live browser
      re-verification was deferred because no dev server was running on `:8433` and, per session
      constraints, a competing server was not bootstrapped; each UI surface was browser-verified at its
      own implementation commit and all logic is green under the Pester suite.
- **Feature `audit-codebase-analysis-1783691799-no-test-coverage` completed (2026-07-10):**
  Closed the High finding that automated coverage was effectively 0% because `tests/` held only
  `tests.ps1.old`, which does not match the Pester glob `tests/*.ps1` used by `npm test`.
    - **Reality at remediation time.** The finding predates the current suite: a real Pester v5 suite,
      `tests/pantry.Tests.ps1`, already existed (60 passing tests) covering the canonical pantry data
      model that replaced the deleted `/api/crud` demo domain (removed in `02323cb`). The finding's
      remediation steps reference `/api/crud` methods; because that demo domain was discarded and
      Pantry modeled fresh (per `.aidd/responses.md`), coverage maps onto the pantry DAL equivalents:
      GET list/filter/pagination → `Get-PantryItems`/`Select-PantryItems`/`Resolve-CrudPaging`;
      POST create + missing-field validation → `New-PantryItem`/`Test-PantryItemInput`; PUT update +
      validation → `Update-PantryItem`; DELETE valid → `Remove-PantryItem`.
    - **Gaps closed this iteration (steps 2 & 3).** Added the two coverage points the finding named
      that were not yet present: (a) DELETE with an unknown id — a harmless no-op that leaves other
      rows untouched, plus an unknown-id read returning `$null`; and (b) a dedicated
      `Describe 'SQL-injection safety'` proving the DAL's `@`-parameter binding stores
      `'); DROP TABLE [items]; --`, `x'; DELETE FROM [items]; --`, and `1' OR '1'='1` payloads
      **literally** (table and rows survive; injection-shaped search matches as a literal substring).
    - **Step 1 — removed the stale demo test.** Deleted `tests/tests.ps1.old`, the pre-Pantry demo
      test referencing the removed `application/featureName/tag` domain; the glob-discovered
      `pantry.Tests.ps1` supersedes it.
    - **Verification (headless, step 4).** `npm test` → **65 passed / 0 failed** (was 60; +5 new).
      PSScriptAnalyzer on `tests/pantry.Tests.ps1` adds no new findings (only the two pre-existing
      `New-TestDb`/`New-ItemObject` `ShouldProcess` warnings on the unchanged `BeforeAll` helpers).
      `npm run format` clean. `npm run lint` errors are confined to the vendored `public/js/mustache.js`
      and are pre-existing/unrelated to these PowerShell-only changes.
- **Feature `audit-codebase-analysis-1783691798-broken-add-and-update-wiring` completed (2026-07-10):**
  Closed the High finding where (a) Add Item was broken — three inconsistent names for one modal:
  `crudmgr.pode:63` did `hx-get="/htmx/item-new"`, `podex.ps1:78` registered `/htmx/crudmgr-new`
  rendering component `crud-new`, and the on-disk view was `views/components/crudmgr-new.pode` — and
  (b) Update always 400'd because `put.ps1:19-35` required `application/featureName/tag` while the
  Update button's `closest tr` hidden inputs were only `id/item/description`.
    - **Resolved by deletion, not patching (per approval + `.aidd/responses.md`).** The `feature`/`tag`
      demo domain is discarded and Pantry is modeled fresh, so this finding resolves by removing the
      demo code path. `views/components/crudmgr.pode`, `crudmgr-new.pode`, and `api/crud/put.ps1` were
      already deleted in the data-model-mismatch remediation (`02323cb`) and replaced by a single
      coherent pantry CRUD.
    - **Verified the mismatch is gone end-to-end.** Add uses one name throughout: `/htmx/item-new` is
      registered in `podex.ps1:160` and referenced identically in `views/components/inventory.pode`
      and the empty-state button (`pantry-render.ps1:249`). Update PUTs to `/htmx/item-update` with the
      edit-row form emitting `name=` attributes (`id` + `name/category/quantity/unit/expiry/threshold/notes`)
      that exactly match the fields the route reads from `$WebEvent.Data`. A repo-wide grep for
      `crudmgr`/`crud-new`/`featureName`/`tag` inputs returns no surviving source references.
    - **Added a regression guard (spec step 4).** New `Describe` in `tests/pantry.Tests.ps1` pins the
      add form to `/htmx/item-create`, the empty-state button + edit row to `/htmx/item-new` and
      `/htmx/item-update`, asserts each form submits exactly the field names its route consumes, and
      asserts the old demo field names (`item`/`description`/`featureName`/`tag`) cannot resurface.
    - **Verification (headless).** `npm test` → **60 passed / 0 failed** (was 56; +4 new). PSScriptAnalyzer
      on the changed test file → no new findings (only the two pre-existing `New-TestDb`/`New-ItemObject`
      `ShouldProcess` warnings on unchanged BeforeAll helpers). No server stand-up needed: the finding
      resolves to a deletion plus a pure form/route-contract regression test.
- **Feature `audit-codebase-analysis-1783691797-pagination-total-count` completed (2026-07-10):**
  Closed the High finding where `GET /api/crud` computed pagination totals from the already-paginated
  result set — `api/crud/get.ps1:48` set `$totalItems = $rs.Count` where `$rs` was the `LIMIT/OFFSET`
  page, so `$totalItems` never exceeded `pageSize` and the built `$countSqlx` count query was never
  executed, breaking `totalPages`/`endIndex`/`hasNextPage`/the page-number list past page 1.
    - **Resolved by deletion, not patching (per approval + `.aidd/responses.md`).** The approved
      decision is that the `feature`/`tag` demo domain is discarded and Pantry is modeled fresh, so
      this finding resolves by removing the demo code path rather than executing the count query. The
      buggy `api/crud/get.ps1` was already deleted with the demo CRUD routes in commit `02323cb`
      (data-model-mismatch remediation).
    - **Verified no residue.** A repo-wide grep for `totalItems`/`$countSqlx`/`hasNextPage`/`totalPages`
      returns **no source hits** — the only surviving paging code is `api/_lib/crud-paging.ps1`, a pure
      input-parser (`Resolve-CrudPaging`) that parses/clamps `page`/`pageSize` and contains **no**
      total-count computation. The pantry views (inventory/lowstock/expiring) are grouped/derived
      projections, not paginated, so there is no total-count surface to mis-compute. Spec step 4's
      "seed > pageSize rows and assert totalItems/hasNextPage" test is moot under deletion.
    - **Verification (headless).** `npm test` → **56 passed / 0 failed** (unchanged; the suite covers
      the surviving `Resolve-CrudPaging` input helper). No server stand-up needed for a
      deletion-verification change. Refreshed the stale §6 pagination FACT in `.aidd/assertions.md` to
      RESOLVED.
- **Feature `audit-codebase-analysis-1783691796-unauth-debug-routes` completed (2026-07-10):**
  Closed the Critical unauthenticated destructive-debug-route exposure. `server.psd1:39` shipped
  `Podex.Debug = $true` by default, and the file-based route auto-loader in `podex.ps1` registered
  `api/debug/*.ps1` as top-level unauthenticated GET routes whenever Debug was on — `GET /api/stop`
  calls `Close-PodeServer` (DoS) and `/clear`/`/init` `DROP`/recreate the live DB. No auth, no CSRF,
  GET-triggerable by anyone who can reach the port.
    - **Root cause was two-fold, and flipping the flag alone was not enough.** Merely setting
      `Podex.Debug = $false` did **not** remove the routes: the loop's non-verb branch fell through to
      an `else { $method = 'Get' }` that still called `Add-PodeRoute -Path '/api/debug/stop' -Method
Get`, i.e. the destructive routes were only **relocated** to `/api/debug/*`, not gated. The gate
      had to actually skip registration.
    - **Change 1 — default Debug OFF (`server.psd1`).** Set `Podex.Debug = $false` per
      `.aidd/responses.md` ("`Podex.Debug` … must default OFF, with an explicit local-dev opt-in;
      destructive debug routes must be gated behind Debug"). Added a comment documenting the local-dev
      opt-in. Left `Web.ErrorPages.ShowExceptions` untouched — that is the coupled
      `show-exceptions-disclosure` feature's scope.
    - **Change 2 — real gate, extracted for testability (`api/_lib/route-registration.ps1`,
      `podex.ps1`).** Added a pure, storage-free helper `Resolve-ApiRouteRegistration` that decides
      whether each `api/*.ps1` becomes a route and how. It returns `$null` (⇒ caller skips
      `Add-PodeRoute`) for the `_lib` DAL and for any `/debug/*` file whenever Debug is off — so
      `/stop`, `/clear`, `/init` are **absent under the default configuration**, not relocated. When
      Debug is on it reproduces the prior behavior exactly (GET at `/api/stop` etc.). `podex.ps1`'s
      auto-loader now delegates to it, replacing the inline branch. (The parameter is named
      `DebugEnabled`, not `Debug`, to avoid the `-Debug` common-parameter collision under
      `[CmdletBinding()]`.)
    - **Change 3 — tests (`tests/pantry.Tests.ps1`).** Added a `Describe` with 6 assertions: all three
      debug routes are absent by default (Debug off), the specific regression that `/stop` is not
      relocated to `/api/debug/*`, that they appear only as GET `/api/stop` when Debug is on, that
      `_lib` is always skipped, that a verb-named file still maps correctly, and that backslash paths
      are accepted. This satisfies spec step 4 ("assert these routes are absent under default config").
    - **Verification (headless).** `npm test` → **56 passed / 0 failed** (was 50; +6 new).
      `npm run analyze` (PSScriptAnalyzer) → **0 Error-severity** findings on the changed files (only
      pre-existing non-blocking BOM/OutputType warnings). No server stand-up needed: the security
      invariant is now a pure, unit-tested decision (`Resolve-ApiRouteRegistration`). Also refreshed
      the two stale references in `.aidd/assertions.md` (§5 debug-routes FACT + the "should Debug
      default to \$false" OPEN, both marked RESOLVED). The commit also carries the already-in-tree
      removal of the two dead `crudmgr` routes in `podex.ps1` (their views were deleted with the demo
      domain in commit `02323cb`).
- **Feature `audit-codebase-analysis-1783691795-data-model-mismatch` completed (2026-07-10):**
  Closed the Critical three-layer data-model mismatch that broke `/api/crud` end-to-end. HEAD had
  three disagreeing models: `api/debug/init.sql` created `items(item, description, ...)`, the demo
  CRUD routes queried a `feature` table (and a non-existent `tag` table), and `crudmgr.pode`
  rendered `{{item}}/{{description}}`. Against a fresh DB every `/api/crud` request threw HTTP 500.
    - **Chose deletion, not patching (per approval + `.aidd/responses.md`).** The `feature`/`tag`
      demo domain is discarded and Pantry is modeled fresh, so this finding resolves by deleting the
      demo code path. Removed `api/crud/{get,post,put,delete}.ps1` and
      `views/components/crudmgr.pode` + `crudmgr-new.pode`.
    - **Unified the schema on the single canonical pantry `items` model.** Rewrote
      `api/debug/init.sql` and `api/debug/clear.sql` to `items(name, category, quantity, unit,
expiry, threshold, notes, created_at, updated_at)` — byte-for-byte matching
      `Initialize-PantryStore` in `api/_lib/pantry-store.ps1` (the DAL, single source of truth) and
      the pantry views (`inventory`/`lowstock`/`expiring`). A repo-wide grep confirms **no** orphaned
      `feature`/`tag` table references remain (the only `tag` hits are the logger's `-tag`
      parameter).
    - **Verification (headless).** `npm test` → **50 passed / 0 failed** (the Pester suite
      initializes the store and asserts `Get-PantryItems` returns rows in name order — the
      deleted-demo equivalent of spec step 6's "init DB, GET, assert 200 with rows"). `npm run
analyze` (PSScriptAnalyzer) → **0 Error-severity** findings. `item-crud` is already
      `completed`/`passes:true`, so the app serves the pantry model end-to-end via the DAL + render
      helpers; no server stand-up was needed for this pure schema-unification + demo-deletion change.
- **Feature `audit-codebase-analysis-1783691794-sql-injection-tag-query` completed (2026-07-10):**
  Closed the Critical SQL-injection vector in `GET /api/crud` (`api/crud/get.ps1`). The tag-list
  query interpolated the raw query-string value directly into SQL —
  `"select [tag], case when [tag] = '$($tagFilter)' then 'selected' else '' end ... from [tag] ..."` —
  where `$tagFilter` comes from `$WebEvent.Query['tagFilter']` with no parameterization, so a value
  like `x' OR '1'='1` broke out of the literal. Every other query in the file already used
  `-SqlParameters`; this one was the lone live injection primitive.
    - **Chose deletion, not patching (per approval + `.aidd/responses.md`).** The approved decision
      is that the `feature`/`tag` demo domain is discarded — Pantry is modeled fresh — and the
      SQL-injection finding "resolves by **deleting** the tag path, not patching it." So rather than
      binding `@tagFilter`, the fix removes the interpolated `[tag]`-table query outright and drops
      the `tags` key from the `$response` hashtable. No parameterized replacement was added because
      the demo tag path itself is being removed.
    - **Change (`api/crud/get.ps1`).** Deleted the `$tags = (Invoke-SqliteQuery ... from [tag] ...)`
      statement (was `get.ps1:59`) and the `tags = $tags` response line. The `{{#tags}}` section in
      `views/components/crudmgr.pode` renders empty when the key is absent (mustache no-op), so the
      "All Tags" filter dropdown still renders without error — no render break. The live `[feature]`
      select and every response branch (200 HTML/JSON, 204, 400 paging, 500 catch) are unchanged. A
      repo-wide grep confirms **no interpolated SQL remains** in `get.ps1`.
    - **No new Pester test (spec step 4 moot under deletion).** With the injectable query removed
      there is no query left to exercise with a single-quote `tagFilter`; the route scriptblock is
      not directly HTTP-unit-tested. Refreshed the two stale references to the finding:
      `.aidd/assertions.md` (marked the SQL-injection FACT resolved) and
      `.aidd/project-structure.md` (struck the defect from the known-defects list).
    - **Verification (headless).** AST parse of `get.ps1` → OK. `npm test` → **50 passed / 0 failed**.
      `npm run analyze` (PSScriptAnalyzer) → **0 Error-severity** findings repo-wide and none on
      `get.ps1`. No server stand-up needed: the change is a pure deletion of the file's only
      interpolated-SQL statement and touches no other response-producing code.
- **Feature `remediation-20260710-logger-path-traversal` completed (2026-07-10):** Removed the
  latent path-traversal / arbitrary-write primitive in `Write-FormattedLog` (`podex.ps1`). The
  helper's `-save` branch wrote to `./$($WebEvent.Request.Url.AbsolutePath)/$($WebEvent.Method).json`,
  building the output path directly from the request URL — a request-controlled path that could
  escape any intended directory.
    - **Chose spec option 3 (remove, not harden).** A codebase-wide grep for `-save` confirmed **no
      caller ever passes it** (every `Write-FormattedLog` call site uses only `-tag`/`-log`), so the
      branch was pure dead code. Deleting it — rather than hardening the path — eliminates the
      primitive outright with zero behavioral change to any live path (spec criteria 1, 3, 4).
    - **Change (`podex.ps1`).** Dropped the `[switch]$save` parameter from the `param(...)` line and
      deleted the trailing `if ($save) { $log | Out-File -FilePath "./$($WebEvent.Request.Url.AbsolutePath)/$($WebEvent.Method).json" -Force }`
      block. The line-wrapping terminal-output loop above it is untouched, so every existing caller
      logs identically. Also refreshed the two stale references to the removed primitive:
      `.aidd/assertions.md` (marked the latent-path-traversal FACT resolved) and
      `.aidd/project-structure.md` (dropped "optional `-save` to disk" from the helper description).
    - **Verification (headless).** Parse-checked `podex.ps1` (AST parse, no errors). `npm test` →
      **50 passed / 0 failed**. `npm run lint` reports only the pre-existing vendored-JS errors in
      `public/js/mustache.js` + `htmx.js` (ESLint does not lint `.ps1`; prettier has no PowerShell
      parser). No server stand-up was needed: the change is a pure deletion of a never-invoked branch
      and touches no route or response-producing code.
- **Feature `remediation-20260710-debug-hotpath-writes` completed (2026-07-10):** Removed the
  hot-path debug work from `GET /api/crud` (`api/crud/get.ps1`). Two statements were deleted:
    1. The **unconditional** `Write-FormattedLog -tag 'debug' -log ($response | ConvertTo-Json -Depth 5 -Compress)`
       — this serialized the entire response object (rows + tags + paging) on **every** request
       regardless of `Podex.Debug`, putting large-object serialization on the normal request path
       (spec criterion 2).
    2. The `Podex.Debug`-gated `New-Item -Name "$($WebEvent.Method).json" -Path $PSScriptRoot ... -Force`
       block — with `Podex.Debug` on (the shipped default) this wrote a `Get.json` artifact into the
       source tree on every request, adding synchronous disk I/O to the hot path and littering the
       repo (spec criterion 1).
    - **No behavioral change (criteria 3, 4).** Only the debug log/file-write statements were
      removed; the `$response` hashtable and every response-writing branch (200 HTML/JSON, 204,
      the 400 paging-validation path, and the 500 catch) are byte-for-byte unchanged. The route now
      writes **no** file under `api/crud/` under any config, so a `Podex.Debug`-enabled request
      produces no `Get.json`. The small per-branch string logs (`"Items found: N"`, `"No items
found"`) were left in place — they are cheap scalar strings, not the flagged large-object
      serialization.
    - **Verification (headless).** Parse-checked the edited `get.ps1` (AST parse, no errors).
      `npm test` → **50 passed / 0 failed** (the Pester suite exercises the DAL + render helpers the
      route composes). `npm run lint` reports only the pre-existing vendored-JS errors in
      `public/js/mustache.js` + `htmx.js` (ESLint does not lint `.ps1`); prettier has no PowerShell
      parser so `.ps1` is untouched by `npm run format`. A full route-level HTTP check was not run:
      standing up a server was unnecessary here because the change is a pure deletion of the route's
      only file-writing statement and touches no response-producing code.
- **Feature `remediation-20260710-paging-input-validation` completed (2026-07-10):** Hardened the
  paging inputs on `GET /api/crud` so a non-numeric `page`/`pageSize` returns a validated **HTTP 400**
  instead of an unhandled **HTTP 500**. Previously `api/crud/get.ps1` hard-cast the query values with
  `[int](...)` inside the `try` block; a value like `page=abc` threw and fell through to the generic
  `catch` → 500 "Internal server error".
    - **New pure helper `Resolve-CrudPaging` (`api/_lib/crud-paging.ps1`).** Storage-free and
      `$WebEvent`-free so it stays directly unit-testable and the route stays thin. It parses each
      value with `[int]::TryParse`: blank/omitted falls back to defaults (page 1, pageSize 10), a
      non-numeric value yields `IsValid = $false` with a per-field message (`"page must be a whole
number"`), and valid values are clamped to sane bounds — `page >= 1`, `pageSize` in `[1, 100]` —
      before `Offset = (page - 1) * pageSize` is computed (criteria 1, 3).
    - **Route change (`api/crud/get.ps1`).** Dot-sources the helper and, on `IsValid = $false`,
      responds `Write-PodeJsonResponse -StatusCode 400` with the validation message and `return`s
      **before any DB access** (criterion 2). The happy path continues to 200 with correct paging
      (criterion 4).
    - **Tests (criterion 5).** Added 6 Pester cases in `tests/pantry.Tests.ps1` covering the
      invalid→400 decision (non-numeric page and pageSize), the valid/omitted→200 decision with
      defaults and offset math, and the page/pageSize clamping. `npm test` → **50 passed / 0 failed**
      (was 44).
    - **Verification (headless).** The user's server on 8433 is the pre-existing wedged instance and
      was left untouched. Parse-checked the three edited files (OK). Stood up a **self-owned**,
      short-lived Pode server on an alternate port (**8434**, never touching 8433) inside a throwaway
      root dir whose `server.psd1` pointed `DBFile` at a seeded temp `feature`/`tag` SQLite DB, then
      hit the real route: `page=abc` → **400** `{"message":"page must be a whole number"}`,
      `pageSize=xyz` → **400**, omitted → **200**, `page=1&pageSize=2` → **200**. The owned server, job,
      and temp dir were removed afterward; port 8434 shows only `TIME_WAIT` (no listener). `npm run
format` clean on `.ps1` (prettier does not touch PowerShell); `npm run lint` reports only the
      pre-existing vendored-JS errors in `public/js/mustache.js` + `htmx.js` (ESLint does not lint
      `.ps1`).
    - **Note:** `api/crud/get.ps1`'s happy-path query targets a `[feature]` table that the shipped
      schema (`api/debug/init.sql` → `items`) does not define — the separate, still-open
      `audit-codebase-analysis-1783691795-data-model-mismatch` defect. This remediation deliberately
      touches only the paging-parse block; the 400 path is independent of that table, and the 200 path
      was validated against a purpose-seeded `feature` table.

### Added

- **Feature `pantry-test-coverage` completed (2026-07-10):** Added a Pester suite,
  `tests/pantry.Tests.ps1`, covering every pantry feature and keeping `npm test` green (44 tests,
  all passing). It supersedes the disabled `tests/tests.ps1.old` (the old CRUD-demo HTTP suite),
  which stays excluded by its `.old` extension.
    - **How it tests.** The suite dot-sources the two shared libraries (`api/_lib/pantry-store.ps1`
      the DAL + pure helpers, and `api/_lib/pantry-render.ps1` the fragment builders) and exercises
      them directly, so it runs fast and deterministically with no HTTP server to stand up. DAL tests
      use a throwaway SQLite file per test (`New-TestDb` → a temp path + `Initialize-PantryStore`,
      removed in `AfterEach`); the pure helpers run against in-memory item objects. The htmx routes in
      `podex.ps1` are thin glue — each one validates with `Test-PantryItemInput`, mutates through the
      DAL, and renders with a `pantry-render` helper — so the route behaviour (spec criteria 3, 4) is
      covered by asserting on that same validation → store → render composition, including the
      "persist nothing on a validation error / 422 path" rule.
    - **Coverage.** DAL create/read/update/delete/list round-trips + persistence and NULL-ing of blank
      optional fields (criterion 2); CRUD add/edit/delete producing the expected row/dialog fragments,
      and an invalid add rendering the error form while persisting nothing (criteria 3, 4);
      `Test-PantryItemInput` for missing name, missing/negative/non-numeric quantity, invalid date and
      non-integer threshold (criterion 4); inventory grouping-by-category + name sort +
      empty/no-results states + blank→"Uncategorized" (criterion 5); category filter +
      case-insensitive name/notes search, combined filters, no-match, and literal wildcard matching
      (criterion 6); low-stock `quantity == threshold` boundary, blank-threshold-defaults-to-1, and
      the nav count (criterion 7); expiring-soon 7-day inclusive boundary, expired-before-expiring
      ordering, exclusion of no-date/far-future, and the nav count (criterion 8); quick-adjust
      increment/decrement, the 0 floor, unknown-id → `$null`, and single-row persistence (criterion 9);
      CSV header-first, one-row-per-item ordering, RFC 4180 quoting/escaping of commas + quotes (with a
      `ConvertFrom-Csv` round-trip), and header-only output for an empty inventory (criterion 10).
    - **Verification (headless).** `npm test` → 44 passed / 0 failed (Pester picks the highest
      installed version, 6.0.0; the suite uses v5+-compatible `Describe`/`It`/`Should`). `npm run
format` clean; `npm run lint` reports only the pre-existing vendored-JS errors in
      `public/js/mustache.js` + `htmx.js` (ESLint does not lint `.ps1`); `Invoke-ScriptAnalyzer` on the
      test file emits only two `PSUseShouldProcessForStateChangingFunctions` warnings on the `New-`
      verb test helpers — the same advisory category the shipped `pantry-store.ps1` already carries, so
      it is consistent with the codebase, not a regression. `npm run build` (`.build.ps1`) was **not**
      run: it is an interactive installer (`Read-Host`, `Install-Module`, `npm update`), not a CI
      build; the test entry point it invokes is `npm test`, which is green.

- **Feature `csv-export` completed (2026-07-10):** Added a CSV export endpoint that downloads the full
  pantry inventory as a properly-quoted CSV file, reading through the data-access layer.
    - **New pure serializer `ConvertTo-PantryCsv` in `api/_lib/pantry-store.ps1`.** Takes a set of
      items and emits RFC 4180 CSV: a header row (`name,category,quantity,unit,expiry,threshold,notes`)
      followed by one row per item in the order given (criteria 3, 4). Any field containing a comma,
      double quote, CR or LF is wrapped in double quotes with embedded quotes doubled; other fields are
      emitted verbatim (criterion 5). Rows are joined with CRLF. An empty item set yields a header-only
      document with no crash (criterion 6). Kept as a pure, storage-free function alongside the other
      shared `Select-*`/`Test-*` helpers so it is directly testable and the route stays thin.
    - **New route `GET /inventory.csv` in `podex.ps1`.** Dot-sources the store, reads the current rows
      through the DAL (`Get-PantryItems`, criterion 7), serializes them, and responds with
      `Write-PodeTextResponse -ContentType 'text/csv'` plus a `Content-Disposition: attachment;
filename="pantry-inventory.csv"` header so the browser downloads a file (criteria 1, 2).
    - **Discoverability:** added an "Export CSV" link (`#export-csv-link`, a real `<a href>` download,
      not htmx) beside the "Add item" button in `views/components/inventory.pode`.
    - **Verification (headless — the user's server on 8433 is the pre-existing wedged instance).** Port
      8433 still accepts TCP but never responds (curl `http_code=000`, timeout) — the leftover Pode
      process documented in prior entries — so it was left untouched and not used as the verification
      target. Instead: (a) exercised `ConvertTo-PantryCsv` directly against constructed items and
      confirmed the output round-trips through `ConvertFrom-Csv` — comma-, quote- and newline-bearing
      fields survive, empty store gives exactly the header line, single non-array input works (all
      PASS); (b) parse-checked `podex.ps1` and `pantry-store.ps1` with `Parser::ParseFile` (OK);
      (c) confirmed `Write-PodeTextResponse -ContentType` and `Add-PodeHeader` exist in the installed
      Pode 2.13.4; (d) stood up a **self-owned** short-lived Pode server on an alternate port (8434,
      never touching 8433), seeded two items including `Beans, black` / `Say "yum"`, and hit the real
      route: `HTTP/1.1 200`, `Content-Type: text/csv; charset=utf-8`,
      `Content-Disposition: attachment; filename="pantry-inventory.csv"`, header row + both item rows,
      the comma/quote fields correctly quoted and round-tripping back through `ConvertFrom-Csv`. The
      owned server and all temp files were removed afterward.

- **Feature `accessibility-forms-and-views` completed (2026-07-10):** Brought the pantry views up to
  the accessibility bar in the spec (labeled inputs, button semantics, keyboard-usable forms, sensible
  focus management, non-color-only status, heading structure + landmarks). Criteria 1, 2, 3 and 5 were
  already satisfied by the existing render layer (every input in `Get-PantryItemFieldsHtml` has a
  `<label for>`; all controls are real `<button>`/`<input>`/`<select>` elements — no click-only divs;
  the +/- quick-adjust controls carry `aria-label`s; the expiry badges are text + colour and the nav
  count pills carry `title`/`aria-label`). This iteration closed the two genuine gaps — focus
  management (criterion 4) and heading structure/landmarks (criterion 6) — plus a couple of adjacent
  hardening touches, all in the pantry views and the shared render layer.
    - **Heading structure now starts at `<h1>` and nests without skips (criterion 6).** Each pantry
      page's visible title was an `<h2>` with no `<h1>` above it (a heading-order violation). Promoted
      the page titles to `<h1>` in `views/components/inventory.pode`, `lowstock.pode` and
      `expiring.pode`, and demoted the level below them to `<h2>` in `api/_lib/pantry-render.ps1`: the
      per-category section headings (`<h2 id='cat-N'>`, still referenced by each section's
      `aria-labelledby`), the empty-state headings ("Your pantry is empty", "No matching items",
      "Nothing running low", "Nothing expiring soon") and the add-item modal title. The list fragment
      now contains no `<h3>` at all — the hierarchy is h1 → h2 with no gaps.
    - **Landmark regions labelled.** The existing `<header>` / `<main>` / `<footer>` landmarks stay;
      the primary `<nav>` now carries `aria-label="Primary"` so the navigation landmark is named.
    - **Focus is managed across htmx swaps (criterion 4).** Previously focus was dropped to the top of
      the document on several swaps. Fixes: (a) the +/- quick-adjust buttons now have stable ids
      (`item-dec-{id}` / `item-inc-{id}`) so htmx restores focus to the same control after a single-row
      swap — repeated clicking stays put; (b) a body-level `htmx:afterSettle` handler in
      `views/layouts/main.pode` covers the cases htmx cannot: when an edit form swaps into a row it
      focuses the first field, and when a read-only row swap leaves focus on `document.body` (e.g. the
      "-" button disabling itself at quantity 0, or Save/Cancel returning the row) it moves focus to a
      still-usable control in that row; (c) the add-item modal (`inventory.pode`) now moves focus to
      the first field when it opens and returns focus to the "Add item" trigger (`#add-item-btn`) when
      it closes, instead of leaving focus behind the overlay or at the top.
    - **Add-item modal exposes dialog semantics.** The modal card now carries
      `role='dialog' aria-modal='true' aria-labelledby='addItemTitle'` (the title `<h2>` gained
      `id='addItemTitle'`), so assistive tech announces it as a modal dialog with its name.
    - **Verification (headless — live browser blocked by a pre-existing wedged server).** `bun`/`npm`
      isn't wired for `smoke:qc`; ran the project equivalents: `npm run format` (clean), `npm run lint`
      (only pre-existing errors in vendored `public/js/htmx.js` + `mustache.js`; no `.pode`/`.ps1`
      linting), a `Parser::ParseFile` parse-check of `pantry-render.ps1` (OK) and `Invoke-ScriptAnalyzer`
      on it (no findings). Dot-sourced the render layer and asserted on the actual emitted fragments
      (13/13 PASS): +/- buttons carry `item-dec-7`/`item-inc-7` ids and the "-" is `disabled` at qty 0;
      the add form is a `role='dialog'` with `aria-modal`/`aria-labelledby`, an `<h2 id='addItemTitle'>`
      title, ≥6 `<label for='add-…'>` inputs and a `required` name; category headings render as
      `<h2 id='cat-1'>` and the list contains **no `<h3>`**. Live browser driving of the focus JS could
      **not** be completed: port 8433 is held by a wedged leftover Pode server from a prior session
      (the `logs/requests_*.log` shows the previously-flagged nav-count infinite loop hammering
      `/htmx/lowstock-count`+`/htmx/expiring-count`, and the process now accepts TCP but never responds
      — every `curl`/`agent-browser` request returns nothing), so a freshly-started server cannot bind
      the port. This is an environment fault (documented below, out of scope for this feature), not a
      defect in these changes; the added focus JS is additive and null-guarded (it can only call
      `.focus()` on elements it finds), so it cannot regress existing behaviour. **A human should
      confirm in a working browser:** tabbing reaches the filter, +/- , Edit/Delete and form controls;
      opening "Add item" moves focus into the dialog and closing returns it to the trigger; decrementing
      an item to 0 keeps focus in the row rather than jumping to the top.

- **Feature `server-side-validation` completed (2026-07-10):** Hardened server-side validation for
  the item add/edit forms so invalid input is rejected with field errors rendered in the htmx
  fragment, an appropriate HTTP status, and no partial write. Most of the rule set already existed
  (`Test-PantryItemInput` in `api/_lib/pantry-store.ps1`, shared by the create/update routes, with
  value preservation and an error summary in the re-rendered fragment); this iteration closed the two
  remaining gaps in the acceptance criteria.
    - **422 on validation failure (was 200).** `/htmx/item-create` and `/htmx/item-update` now return
      **HTTP 422** with the re-rendered form/row fragment on any validation failure, instead of a 200
      (criterion #10: an appropriate 4xx status, never a generic 500; the existing `id` guard already
      returns **400** on a malformed id). Because htmx 2 does not swap non-2xx responses by default, a
      small body-level `htmx:beforeSwap` handler in `views/layouts/main.pode` treats a 422 as a
      swappable, non-error response (`shouldSwap = true; isError = false`) so the error fragment still
      renders in place (into the modal via the existing `HX-Retarget`/`HX-Reswap` headers for add, and
      into the edit row for update).
    - **Threshold constrained to a non-negative integer.** `Test-PantryItemInput` now parses the
      optional threshold with `[int]::TryParse` (was `[double]`), rejecting decimals with
      "Threshold must be a whole number." (criterion #8: accepts only a non-negative integer; the
      routes still default it to **1** when omitted). The threshold input's `step` was changed from
      `any` to `1` so the client control matches the server rule; quantity stays `step='any'` (decimals
      like 1.5 kg remain valid).
    - **Verification (pwsh + Pode + PSSQLite + agent-browser):** parse-checked the three edited `.ps1`
      files; ran **10 unit assertions** on `Test-PantryItemInput` (empty/negative/non-numeric/valid
      quantity, empty-required, bad/good expiry, decimal/negative/valid threshold) — all PASS. Against a
      live server on :8433, curl confirmed every error path returns **422** with the exact message
      (name required, quantity "zero or greater", "must be a number", expiry "valid date", threshold
      "whole number") plus the `HX-Retarget`/`HX-Reswap` headers on create; that submitted values are
      echoed back into the re-rendered fragment; that **no invalid item is persisted** (0 rows before a
      valid create; a failed edit leaves the stored name unchanged); that a **valid** create and edit
      both return **200** and persist; and that a malformed edit id returns **400**. Through a real
      browser, a 422 response was confirmed to swap (`shouldSwap=true, isError=false`) with all four
      validation messages rendered in the modal, the previously entered values preserved, and **zero
      console errors**. Stopped the server I started (`/api/stop`) and removed my verification artifacts
      afterward. Marked `server-side-validation` `passes: true` / `status: "completed"`.

### Discovered (out of scope — not fixed this iteration)

- **Nav count badges self-refetch in an infinite loop.** While browser-verifying the validation
  feature, the request log showed `/htmx/lowstock-count` and `/htmx/expiring-count` each being fetched
  ~20×/second continuously. Root cause: `Format-PantryLowStockCountHtml` /
  `Format-PantryExpiringCountHtml` (in `api/_lib/pantry-render.ps1`) return a `<span>` whose
  `hx-trigger` includes `load` **and** whose `hx-swap='outerHTML'` replaces itself with markup that
  again carries `hx-trigger='load'`, so htmx re-fires `load` on every self-swap forever. This hammers
  the server and starves browser automation. It belongs to the low-stock / expiring-soon count
  features, not to `server-side-validation`, so per the single-feature scope guard it was **not**
  changed here — flagged for a dedicated fix (e.g. drop `load` from the re-rendered badge, or split
  the polling shell from its rendered content).

- **Feature `seed-data-script` implemented (2026-07-10):** Added `scripts/seed.ps1` — a dev seed
  script that loads **21 realistic sample items** across **8 categories** (Oils, Grains, Canned,
  Baking, Spices, Dairy, Condiments, Snacks) so every view has content, plus a `bun`/`npm run seed`
  entry in `package.json`.
    - **Writes through the DAL only.** Every row is inserted via `New-PantryItem`
      (`api/_lib/pantry-store.ps1`) — the same path a form submission takes — so validation, optional-
      field NULL-normalization, and `created_at`/`updated_at` behave identically. No raw `INSERT`. The
      script imports `PSSQLite`, dot-sources the store, and calls `Initialize-PantryStore` to ensure the
      schema exists before seeding.
    - **Populates every derived view.** The curated set deliberately includes **9 low-stock** rows
      (`quantity <= threshold`, e.g. Vegetable oil, Rolled oats, Black beans, Coconut milk at 0, Caster
      sugar, Butter, Sea salt, Ketchup, Baking powder) and **6 expiring rows within 7 days, of which 2
      are already expired** (Plain flour −3d and Water crackers −1d). Expiry dates are computed at run
      time as offsets from _today_ (`Get-Date`), so the low-stock / expiring buckets stay correct on any
      run date rather than baking in fixed dates that would drift.
    - **Idempotent by default, documented.** Default mode **RESETS** the items table (a plain
      `DELETE FROM [items]`, preserving schema) before inserting, so re-running always yields the same
      21 items and never accumulates duplicates. A `-Append` switch keeps existing rows and adds the set
      on top instead. Both behaviors are documented in the script's comment-based help and a one-line
      summary is printed after each run (total items, category count, low-stock count, expiring/expired
      counts).
    - **Verification (pwsh + PSSQLite, headless + live server + browser):** parse-checked the script.
      Ran it against a **temp DB**: first run → 21 items / 8 categories / 9 low-stock / 6 expiring (2
      expired); a **second run stayed at 21** (idempotent reset, no duplicates); a `-Append` run
      **doubled to 42** as documented. Seeded the real `./podex.db`, started the Pode server on :8433,
      and confirmed via curl that **every view shows data**: `/inventory` → 21 rows (Olive oil,
      Spaghetti, Water crackers present), `/lowstock` → 9 rows with the nav badge reading **9**,
      `/expiring` → 6 rows with an **expired** badge and the nav badge reading **6**,
      `/htmx/inventory-filter?category=Dairy` → 3 rows, and `/htmx/inventory-filter?q=oil` → Olive oil +
      Vegetable oil. Through `agent-browser` the Low stock page rendered all 9 items with quick-adjust
      controls and **zero console errors** on both `/inventory` and `/lowstock`. Stopped the server I
      started (via `/api/stop`) and removed my temp verification artifacts afterward; `podex.db`/`logs/`
      are gitignored. Marked `seed-data-script` `passes: true` / `status: "completed"`.
- **Feature `quick-adjust-quantity` implemented (2026-07-10):** Added per-row **+ / −** quantity
  buttons to every inventory item row — the "used one / bought more" flow — that change only
  `quantity` and swap **just that row** via htmx, without opening the edit form or reloading the page.
    - **New DAL helper** `Update-PantryItemQuantity` (in `api/_lib/pantry-store.ps1`) reads the item,
      applies a signed delta, and **clamps the result at 0** (a quantity can never go negative). Only the
      `quantity` + `updated_at` columns are written; every other field is preserved. Returns `$null` for a
      missing id. The clamp-at-zero rule lives with storage rather than the route.
    - **Row render** (`Format-PantryItemRowHtml` in `api/_lib/pantry-render.ps1`) now renders the Quantity
      cell as a `−  <qty>  +` control group. Each button is a native `<button type='button'>` (keyboard-
      operable: Tab to focus, Enter/Space to activate) with a descriptive `aria-label` ("Increase/Decrease
      quantity of {name}", name HTML-encoded). Each posts `/htmx/item-adjust?id={id}&delta=±1`, targeting
      `#item-row-{id}` with an `outerHTML` swap. The **−** button is `disabled` when quantity ≤ 0 so it
      reads as unavailable in addition to the server clamp. Because the row markup is shared, quick-adjust
      also works on the Low-stock and Expiring-soon views.
    - **New route** `POST /htmx/item-adjust` (in `podex.ps1`): validates the id (400 on missing/non-numeric),
      parses `delta`, calls `Update-PantryItemQuantity` (404 when the id does not exist), and returns the
      freshly-rendered single row with `HX-Trigger: itemChanged`. That reuses the existing body-level
      `itemChanged` event so the **low-stock / expiring lists and both nav count badges self-refresh** — an
      adjust that crosses the low-stock threshold updates the nav count with no full reload.
    - **Verification (pwsh + Pode + PSSQLite, headless + browser):** parse-checked all three edited `.ps1`
      files. Ran **9 render assertions** (both aria-labels present, `delta=1` / `delta=-1` post URLs,
      row-targeted swap, ≥2 keyboard `type='button'` controls, − enabled at qty>0, − disabled at qty 0,
      name HTML-encoded in the label — XSS-safe) and **10 store assertions** against a temp SQLite DB
      (increment 3→4, decrement 4→3, 1→0, clamp stays 0 on further decrement, persisted re-read, name +
      threshold preserved, missing id → `$null`, and a cross-threshold check where dropping qty 3→2 moves
      the item into the low-stock selection) — all PASS. Ran the live Pode server on :8433, seeded an item
      (qty 3, threshold 2), and drove `POST /htmx/item-adjust` with curl: increment returned qty 4 +
      `HX-Trigger: itemChanged`; five decrements clamped at **0** with the − button rendered `disabled`;
      re-reading the row confirmed persistence; `/htmx/lowstock-count` reflected the item; bad requests
      returned **400** (missing/non-numeric id) and **404** (non-existent id). Then through a real browser
      (`agent-browser`): the inventory rows exposed the accessible +/− buttons (the qty-0 item's − button
      reported `[disabled]`); clicking **Increase** swapped just that row (0→1 cans) and re-enabled its −
      button; clicking Increase twice more crossed the threshold (qty 3 > threshold 2) and the **nav
      low-stock badge self-updated 4 → 3 live** with no navigation and **zero console errors** throughout.
      PSScriptAnalyzer on the changed files adds **no new** rule categories beyond the repo's pre-existing
      advisories (the whole DAL already trips `PSUseShouldProcessForStateChangingFunctions` /
      `PSUseSingularNouns`). Node-based `eslint`/`prettier` could not run (no `node_modules` — known
      environment limitation; the changed files are `.ps1`). The verification server I started was stopped
      afterward and my seeded test item was deleted; `podex.db`/`logs/` are gitignored. Marked
      `quick-adjust-quantity` `passes: true` / `status: "completed"`.
- **Feature `low-stock-view` implemented (2026-07-10):** Added a server-rendered **Low stock** view — a
  flat, name-sorted list of items whose `quantity` is **at or below their per-item reorder threshold**
  (`quantity <= threshold`) — plus a **self-updating nav count badge** on every page. Mirrors the
  expiring-soon idioms: no SPA, no full-page reloads; the view and count refresh via htmx fragment
  swaps on the existing body-level `itemChanged` event.
    - **New pure DAL helper** `Select-PantryLowStockItems` (in `api/_lib/pantry-store.ps1`) filters items to
      those at or below threshold and orders them by name (case-insensitive). Threshold **defaults to 1**
      when missing, blank, or unparseable (matching the item model default), so items with no explicit
      threshold are low at `quantity <= 1`. Pure function shared by the page, its htmx list fragment, and
      the nav count.
    - **New render helpers** (in `api/_lib/pantry-render.ps1`): `Format-PantryLowStockListHtml` emits the
      `#lowstock-list` fragment — a single name-sorted table whose rows **reuse `Format-PantryItemRowHtml`**
      (so inline edit/delete behave exactly as on the inventory view and the Quantity column makes the
      at/below-threshold state visible) with a friendly "Nothing running low" empty state.
      `Format-PantryLowStockCountHtml` emits the `#nav-lowstock-count` badge: an **amber** pill with the
      count when > 0 (distinct from the red expiring badge), an empty (still-listening) span at 0.
    - **New routes** (in `podex.ps1`): `GET /lowstock` (full server-rendered page, new `Low stock` nav entry
        - `views/components/lowstock.pode`), `GET /htmx/lowstock-list` (list fragment), and
          `GET /htmx/lowstock-count` (nav badge fragment). Each dot-sources the DAL + render libs into its own
          request scope (same Pode-route-runspace pattern as the existing CRUD/filter/expiring routes).
    - **Reactivity via the existing `itemChanged` event.** The `#lowstock-list` wrapper
      (`hx-trigger='itemChanged from:body'`) and the `#nav-lowstock-count` span
      (`hx-trigger='load, itemChanged from:body'`) each self-fetch on that event, so any create/edit/delete
      anywhere re-derives the low-stock list and nav count with no full reload — e.g. raising an item's
      quantity above its threshold drops it off the view and decrements the count live. No mutation route
      changed: create/update/delete already dispatch `itemChanged`.
    - **Nav refactor:** `views/partials/header.pode` now iterates page objects (`Name`/`Label`/`Href`/`Badge`)
      instead of bare strings, so the new **Low stock** link renders a two-word label with a `/lowstock`
      href and its own count badge alongside the existing Expiring badge — cleanly, without special-casing
      `.ToLower()`/`.Substring()` display munging.
    - **Accessibility:** the count badge carries a descriptive `aria-label`/`title` ("N item(s) at or below
      the low-stock threshold", correctly singular/plural); the view reuses the existing labeled/keyboard-
      usable row controls.
    - **Verification (pwsh + Pode + PSSQLite, headless + browser):** parse-checked all three edited `.ps1`
      files; ran **21 unit assertions** covering `Select-PantryLowStockItems` (qty 0 / at-threshold /
      default-threshold-1 included; qty>threshold and default-threshold-high excluded; name-sorted; empty +
      no-qualifying → 0) and every render helper (list wrapper id + `itemChanged` listener + self-fetch url,
      row reuse, empty state, count amber pill vs empty span, singular/plural aria label) — all PASS. Ran the
      live Pode server on :8433, seeded items, and drove the routes with curl: `/htmx/lowstock-count` → amber
      pill; `/htmx/lowstock-list` → the low items name-sorted (qty-9 item excluded, at-threshold item
      included); `/lowstock` → full page with nav badge + heading. Confirmed `PUT /htmx/item-update`
      (quantity → 5, above threshold) returns `HX-Trigger: itemChanged`, the item left the list, and the
      count decremented 5→4. Then through a real browser (`agent-browser`): opened `/lowstock` — nav badge
      self-loaded, rows name-sorted, **zero console errors**; clicked **Edit** on a row, raised its quantity
      to 10, saved — the row **dropped out** and the nav count decremented **live** (no navigation); confirmed
      the badge also self-loads on the Inventory page, zero console errors throughout. PSScriptAnalyzer on the
      changed files adds **no new** warnings beyond the repo's pre-existing advisories. Node-based
      `eslint`/`prettier` could not run (no `node_modules` — known environment limitation; the changed files
      are `.ps1`/`.pode`, not JS). The verification server I started was stopped afterward and my seeded test
      items were deleted; `podex.db`/`logs/` are gitignored. Marked `low-stock-view` `passes: true` /
      `status: "completed"`.
- **Feature `expiring-soon-view` implemented (2026-07-10):** Added a server-rendered **Expiring soon**
  view — a flat, soonest-first list of items that are already **expired** or **expiring within 7
  days** (inclusive of today) — plus a **self-updating nav count badge** surfaced on every page. No
  SPA, no full-page reloads: the view and the count refresh via htmx fragment swaps.
    - **New pure DAL helper** `Select-PantryExpiringItems` (in `api/_lib/pantry-store.ps1`) filters items
      to those whose `expiry` is past or within 7 days (reusing `Get-PantryExpiryState` for the in/out
      decision) and orders them **soonest-expiry first**, so already-expired items (earliest dates) sort
      ahead of items merely expiring soon. Items with no expiry, an unparseable expiry, or an expiry >7
      days out are excluded. Takes an `-AsOf` override so the rule is deterministically testable.
    - **New render helpers** (in `api/_lib/pantry-render.ps1`): `Format-PantryExpiringListHtml` emits the
      `#expiring-list` fragment — a single soonest-first table whose rows **reuse `Format-PantryItemRowHtml`**
      (so inline edit/delete behave exactly as on the inventory view) with a friendly "Nothing expiring
      soon" empty state; the red **"Expired"** vs amber **"Expiring soon"** badge (text + colour, never
      colour-only) keeps expired items visually distinct. `Format-PantryExpiringCountHtml` emits the
      `#nav-expiring-count` badge: a red pill with the count when > 0, an empty (still-listening) span at 0.
    - **New routes** (in `podex.ps1`): `GET /expiring` (full server-rendered page, new `Expiring` nav
      entry + `views/components/expiring.pode`), `GET /htmx/expiring-list` (list fragment), and
      `GET /htmx/expiring-count` (nav badge fragment). Each dot-sources the DAL + render libs into its own
      request scope (same Pode-route-runspace pattern as the existing CRUD/filter routes).
    - **Reactivity via a single `itemChanged` event.** Every mutation now dispatches a body-level
      `itemChanged` htmx event: `item-create` sends `HX-Trigger: {"closeModal":true,"itemChanged":true}`,
      `item-update` and `item-delete` send `HX-Trigger: itemChanged`. The `#expiring-list` wrapper
      (`hx-trigger='itemChanged from:body'`) and the `#nav-expiring-count` span
      (`hx-trigger='load, itemChanged from:body'`) each self-fetch on that event, so any create/edit/delete
      **anywhere** re-derives the expiring list and the nav count with no full reload — e.g. editing an
      item's expiry to >7 days out drops it off the view and decrements the count live. The count span also
      fetches on `load`, so it populates on every page (Home/Inventory/Expiring/CRUDMgr) without each route
      computing it.
    - **Accessibility:** the count badge carries a descriptive `aria-label`/`title` ("N item(s) expired or
      expiring soon", correctly singular/plural); expired-vs-expiring is conveyed by badge **text**, not
      colour alone; the view reuses the existing labeled/keyboard-usable row controls.
    - **Verification (pwsh 7.6 + Pode 2.13 + PSSQLite, headless + browser):** parse-checked all three
      edited `.ps1` files; ran **25 unit assertions** (with a fixed `-AsOf` of 2026-07-10) covering
      `Select-PantryExpiringItems` (expired/today/5-day/7-day-edge included, 8-day/no-expiry/unparseable
      excluded, soonest-first order with expired leading, empty + no-qualifying → 0) and every render helper
      (list wrapper id + `itemChanged` listener + self-fetch url, Expired/Expiring badges, row reuse,
      empty-state, count pill vs empty span, singular/plural aria label) — all PASS. Ran the live Pode
      server on :8433, seeded 6 items (4 qualifying), and drove the routes with curl: `/htmx/expiring-count`
      → `4` red pill; `/htmx/expiring-list` → the 4 items in soonest-first order (Expired Yogurt flagged
      Expired) excluding the >7-day and no-expiry items; `/expiring` → full page with nav badge + heading.
      Confirmed `PUT /htmx/item-update` (expiry → 2026-12-31) returns `HX-Trigger: itemChanged` and the count
      dropped 4→3 with the item gone from the list; `POST /htmx/item-create` returns the combined
      closeModal+itemChanged trigger (count 3→4); `DELETE /htmx/item-delete` returns itemChanged (count 4→3).
      Then through a real browser (`agent-browser`): opened `/expiring` — nav badge self-loaded to **4**,
      rows rendered soonest-first with correct Expired/Expiring badges, Far Rice and No Date Salt excluded,
      **zero console errors**; clicked **Edit** on "Soon Bread", set expiry to 2026-12-31, saved — the row
      **dropped out** and the nav count decremented to **3 live** (no navigation); confirmed the badge also
      self-loads on the Inventory and Home pages (shows 3), zero console errors throughout. PSScriptAnalyzer
      on the changed files shows only the repo's pre-existing advisory warnings (BOM, `PSUseShouldProcess*`,
      `PSUseSingularNouns`); `pantry-render.ps1` adds none and `Select-PantryExpiringItems` follows the
      existing `Get-PantryItems`/`Select-PantryItems` plural-collection convention. Node-based
      `eslint`/`prettier` could not run (no `node_modules` — known environment limitation; the changed files
      are `.ps1`/`.pode`, not JS). The verification server I started was stopped afterward; `podex.db`/`logs/`
      are gitignored. Marked `expiring-soon-view` `passes: true` / `status: "completed"`.
- **Feature `category-filter-and-search` implemented (2026-07-10):** Added a **filter bar** (category
  `<select>` + text search input) above the inventory list that swaps **only** the list fragment via
  `hx-get` — no full page reload. New render helper `Format-PantryFilterBarHtml` (in
  `api/_lib/pantry-render.ps1`) emits a labeled `role="search"` `<form>` whose category options are
  the distinct item categories (blank → `Uncategorized`), sorted, plus an "All categories" default; a
  labeled `type="search"` input; and a Search submit button (keyboard/no-JS fallback). The form
  triggers on `change, search, keyup changed delay:300ms, submit`, targeting `#inventory-list` with an
  `outerHTML` swap. New pure DAL helper `Select-PantryItems` (in `api/_lib/pantry-store.ps1`) applies
  the filters: category is matched against each item's **display** category (blank → `Uncategorized`,
  `''`/`all` = no filter), and the search term is a **case-insensitive substring** over `name` OR
  `notes` with wildcard metacharacters escaped (matched literally). Both filters apply together (AND).
    - **New route** `GET /htmx/inventory-filter` reads `category`/`q`, filters via `Select-PantryItems`,
      and returns the `#inventory-list` fragment. The `/inventory` route now also renders the filter bar
      (`$data.FilterHtml`) above the list; `views/components/inventory.pode` emits it above
      `$data.ListHtml`.
    - **No-results state:** `Format-PantryInventoryListHtml` gained an `-IsFiltered` switch. When a
      filter is active and nothing matches, it renders a clear "No matching items" fragment (no add CTA,
      no error) instead of the "Your pantry is empty" onboarding state, which stays reserved for a
      genuinely empty pantry. Same `id="inventory-list"` wrapper either way so the swap is stable.
    - **Accessibility:** the category select and search input each have an associated `<label for>`,
      native form-control semantics, and a real submit button — keyboard-usable and tab-ordered; the
      form carries `role="search"`.
    - **Infra note:** the new htmx route dot-sources the DAL + render libs into its own request scope
      (Pode route runspaces only see functions discovered by scanning callstack scriptblock ASTs), same
      pattern as the existing CRUD routes.
    - **Verification (pwsh 7.x + Pode + PSSQLite, headless + browser):** parse-checked all three edited
      `.ps1` files; ran 25 unit assertions covering `Select-PantryItems` (category incl. `Uncategorized`,
      `all`/empty passthrough, name + notes case-insensitive search, AND combination, no-match, literal
      `*`) and every render helper (filter-bar form/labels/options/selection/prefill, filtered vs.
      unfiltered empty states, stable list id) — all PASS. Ran the live Pode server on :8433, seeded 4
      items across Grains/Oils/Uncategorized, and drove `GET /htmx/inventory-filter` with curl across all
      8 spec scenarios (category filter, `all` reset, name search, case-insensitive, notes match, AND,
      no-results fragment, Uncategorized) — all correct, no errors. Then through a real browser
      (`agent-browser`): confirmed the labeled combobox + searchbox + Search button render above the list
      (accessibility tree); selecting a category swapped the list to that category only via `hx-get` (no
      reload); a `keyup` on the search input live-filtered to the matching rows; the Search submit button
      rendered the "No matching items" fragment for a non-matching term; clearing the search restored all
      groups — **zero console errors** throughout. (Note: `agent-browser`'s synthetic `keyboard type` did
      not always dispatch `keyup` events htmx binds to; a real dispatched `keyup` and the submit path both
      confirmed the app behaves correctly — a harness quirk, not an app bug.) PSScriptAnalyzer on the
      changed files shows only the repo's pre-existing advisory warnings (BOM, `PSUseShouldProcess*`,
      `PSUseSingularNouns`); `pantry-render.ps1` adds none and `Select-PantryItems` follows the existing
      `Get-PantryItems` plural-collection convention. Node-based `eslint`/`prettier` could not run (no
      `node_modules` — known environment limitation; the changed files are `.ps1`/`.pode`, not JS). The
      verification server I started was stopped afterward; `podex.db`/`logs/` are gitignored. Marked
      `category-filter-and-search` `passes: true` / `status: "completed"`.
- **Feature `item-crud` implemented (2026-07-10):** Added full server-rendered item CRUD to the
  inventory page with **inline htmx forms** and a **confirm-delete** step — no SPA, no full-page
  reloads; every mutation is an htmx fragment swap. New render layer
  `api/_lib/pantry-render.ps1` builds all fragments so the full-page `GET /inventory` render and the
  htmx partial swaps share one source of truth (a row rendered by add/edit is byte-identical to the
  page-load row). New htmx routes in `podex.ps1`: `GET /htmx/item-new` (add form),
  `POST /htmx/item-create` (create), `GET /htmx/item-edit` (inline edit row), `GET /htmx/item-row`
  (cancel → read-only row), `PUT /htmx/item-update` (save), `DELETE /htmx/item-delete` (remove).
  The `/inventory` route now delegates list rendering to `Format-PantryInventoryListHtml`, and
  `views/components/inventory.pode` emits `$data.ListHtml` plus an "Add item" button and the modal
  shell/show-hide script (same pattern as the existing `crudmgr` modal).
    - **Add:** the "Add item" button (and the empty-state CTA) load the add form into a modal via
      `hx-get`. Submit `hx-post`s to `/htmx/item-create` targeting `#inventory-list`; on success the
      server re-renders the whole list (so a brand-new category is grouped correctly) and sends
      `HX-Trigger: closeModal` to dismiss the modal. On a validation error the server responds with the
      form (values + error summary) and `HX-Retarget: #inventoryModalContent` / `HX-Reswap: innerHTML`
      so errors land back in the modal instead of the list.
    - **Edit / Cancel:** Edit swaps just the row (`#item-row-{id}`, `outerHTML`) for an inline form
      pre-filled from the item; Save `hx-put`s and swaps the row back to its updated read-only form
      (the DAL bumps `updated_at`); Cancel `hx-get`s the unchanged read-only row — no data change.
    - **Delete:** the Delete button uses `hx-confirm` ("Delete this item? This cannot be undone.")
      so deletion always requires a confirmation step (no accidental one-click delete); confirming
      removes the row via an empty `outerHTML` swap and the item no longer persists.
    - **Validation:** new pure helper `Test-PantryItemInput` in `api/_lib/pantry-store.ps1` (shared by
      add + edit) enforces name required, quantity required and ≥ 0 (numeric), optional threshold ≥ 0,
      and optional expiry a parseable date; errors render inside the fragment.
    - **Accessibility:** add and edit use real `<form>`s with `<label for>`-associated inputs
      (unique ids per row), native `type="number"`/`type="date"` controls, and button semantics —
      keyboard-usable and tab-ordered.
    - **Infra note (Pode AST function scope):** each htmx route dot-sources the DAL and render libs
      into its own request scope (route runspaces only see functions Pode discovers by scanning
      scriptblock ASTs on the callstack — top-level dot-sourced libs are invisible inside handlers).
    - **Verification (pwsh 7.6.3 + Pode 2.13.4 + PSSQLite 1.1.0, headless + browser):** parse-checked
      all three edited `.ps1` files; unit-tested `Test-PantryItemInput` (8 cases) and every render
      helper (row id/encoding/quantity, edit form, add form + error re-render, empty state, grouping
      order, badges) — all PASS. Ran the live Pode server on :8433 and drove the whole flow with curl
      (create → `HX-Trigger: closeModal` + list contains the new row; invalid input → `HX-Retarget`
      header + rendered errors; edit → prefilled form; update → single-row swap with new qty; cancel →
      read-only row; delete → empty body, row absent from a fresh `/inventory`). Then verified through
      a real browser (`agent-browser`): clicked Add, filled the labeled modal form, submitted → the
      "Basmati Rice / 5 kg" row appeared under a "Grains" group; reloaded → row persisted; clicked Edit
      → inline form prefilled; changed qty to 12 and Saved → row swapped to "12 kg"; clicked Delete →
      the native confirm dialog fired with the expected message; accepted → row removed via swap;
      reloaded → empty state (not persisted); **zero console errors** throughout. Note: Tailwind
      `output.css` is not compiled in this environment (no `node_modules`), so the modal's visual
      hide/show relies on the built stylesheet (identical to the existing `crudmgr` modal) — the
      `closeModal` wiring was confirmed functionally (post-submit `className` becomes `…hidden` with
      `flex` removed). PSScriptAnalyzer on the changed files shows only the repo's pre-existing advisory
      warnings (BOM, `PSUseShouldProcess*`, `PSUseSingularNouns`); the new `pantry-render.ps1` adds
      none. Node-based `eslint`/`prettier` could not run (no `node_modules` — known environment
      limitation). The verification server I started was stopped afterward; `podex.db`/`logs/` are
      gitignored. Marked `item-crud` `passes: true` / `status: "completed"`.
- **Feature `inventory-list-view` implemented (2026-07-10):** Built the pantry's main inventory page
  — a fully **server-rendered** list (no client-side JS builds it) at `GET /inventory`, grouped by
  category, sorted by name, with expiry badges and an empty state. New view
  `views/components/inventory.pode` renders the page from server data; new route in `podex.ps1`
  fetches items via the DAL, classifies each item's expiry, and groups them. New pure helper
  `Get-PantryExpiryState` added to `api/_lib/pantry-store.ps1` (returns `none`/`expired`/`expiring`/`ok`
  relative to a reference date; `expiring` = today..+7 days inclusive). The `Inventory` nav link was
  added to `views/partials/header.pode`.
    - **Grouping/sorting:** items are grouped by `category` (blank → `Uncategorized`); category
      headings render as semantic `<h3>` elements (each `<section>` `aria-labelledby` its heading),
      categories sorted alphabetically, and items within a group sorted by name case-insensitively
      (via the DAL's `ORDER BY [name] COLLATE NOCASE`). Each row shows name, quantity (whole numbers
      render without a trailing `.0`), and unit.
    - **Expiry badges:** an amber "Expiring soon" badge (`bg-amber-400 text-amber-950`) for items due
      within 7 days, a red "Expired" badge (`bg-red-600 text-white`) for past-due items — text plus
      color so meaning is not color-only, and the two are visually distinct. Items with no expiry (or
      an expiry far out) show no badge and render cleanly.
    - **Empty state:** when no items exist, a dashed-border card renders with a clear "Add your first
      item" call-to-action button (wired to the future `/htmx/item-new` add flow that `item-crud`
      will provide; a modal shell is included so the CTA is forward-compatible).
    - **Infra fix (Pode function scope):** discovered that Pode makes functions available to route
      runspaces by scanning scriptblock **ASTs** on the callstack (`Get-PodeFunctionsFromAst`), so the
      top-level _dot-sourced_ DAL from `podex.ps1` is invisible inside route handlers (boot-time
      `Initialize-PantryStore` still works because the server scriptblock shares the caller's session
      state). The `/inventory` route therefore dot-sources `./api/_lib/pantry-store.ps1` into the
      request scope. Also updated `views/layouts/main.pode` to forward `-Data $data` to component
      partials (previously only layout/header received data), enabling server-rendered components;
      the existing `about`/`crudmgr` components don't read `$data`, so this is backward-compatible.
    - **Verification (pwsh 7.6.3 + Pode 2.13.4 + PSSQLite 1.1.0, headless):** parse-checked both edited
      `.ps1` files; unit-tested `Get-PantryExpiryState` (9 cases incl. today, +7-day boundary,
      unparseable, empty → all PASS). Ran the live Pode server on :8433 and curled `GET /inventory`:
      (1) empty DB → empty-state card with the CTA renders (HTTP 200); (2) after seeding 7 items across
      Dairy/Grains/blank categories → headings render in order `Dairy, Grains, Uncategorized`; rows
      within groups sorted case-insensitively (`Butter, Milk`; `Barley, Bread, oats, rice`); quantity+
      unit shown ("2 cartons"); exactly one amber "Expiring soon" (Milk, exp +2d) and one red "Expired"
      (Bread, past) badge; far-future and no-expiry items show no badge; no server errors. Browser
      (`agent-browser`) verification was attempted but its daemon was unresponsive after two honest
      tries; since the inventory list is entirely in the initial server-rendered HTML, the curl checks
      fully exercise the render path. PSScriptAnalyzer on the changed files shows only the repo's
      pre-existing advisory warnings (BOM, `PSUseShouldProcess*`, prior `Get-PantryItems` plural noun);
      the new code adds none. Repo-wide `prettier`/`eslint` could not run (no `node_modules` installed —
      known environment limitation); the new `.pode` file follows the repo's tab convention. Marked
      `inventory-list-view` `passes: true` / `status: "completed"`. No dev server left running (the
      verification server I started was stopped); `podex.db` and `logs/` are gitignored.
- **Feature `item-model-and-storage` implemented (2026-07-10):** Built the pantry Item model and a
  swappable data-access layer (DAL) — the first product code on top of the Podex demo. New file
  `api/_lib/pantry-store.ps1` defines the storage functions only (no routes): `Initialize-PantryStore`
  (idempotent `CREATE TABLE IF NOT EXISTS [items]` with fields `id` (INTEGER PK AUTOINCREMENT),
  `name` (NOT NULL), `category`, `quantity` (REAL, `CHECK >= 0`), `unit`, `expiry`, `threshold`
  (default 1), `notes`, `created_at`/`updated_at` timestamps), plus `New-PantryItem` (create),
  `Get-PantryItem` (read by id), `Get-PantryItems` (list, name-sorted), `Update-PantryItem` (update,
  bumps `updated_at`), and `Remove-PantryItem` (delete). All SQL is parameterized; optional text
  fields are normalized to NULL. `Get-PantryDbFile` resolves the datasource once (explicit arg →
  Pode config → `./podex.db`) so storage location is configured in one place, not scattered through
  callers. `New-PantryItem` reads `last_insert_rowid()` on the same connection so returned ids are
  reliable and stable. Wired into `podex.ps1`: the DAL is dot-sourced at top level (same pattern as
  the existing helper functions, so routes can call it), route auto-discovery now skips `api/_lib/`
  (library files are not routes), and `Initialize-PantryStore` runs at server boot. Stack idioms
  preserved — SQLite via `PSSQLite`, no Node/ORM/SPA introduced.
  **Verification (pwsh 7.6.3 + PSSQLite 1.1.0, headless):** a 23-assertion script against a temp DB
  confirmed create/read/update/delete/list, positive unique stable ids, full field round-trip with
  populated timestamps, omitted optionals stored as NULL, `threshold` default 1, name-sorted listing,
  and update/delete targeting the right row — all PASS. A separate two-process test (write in one
  `pwsh` process, read in a fresh one) confirmed **durability across a server restart**. Both edited
  PS files parse cleanly; PSScriptAnalyzer on the DAL shows only advisory `PSUseShouldProcess*` /
  `PSUseSingularNouns` warnings that the existing `podex.ps1` already trips, so the new code matches
  the repo's analyzer profile. No dev server started. Marked `item-model-and-storage`
  `passes: true` / `status: "completed"`.
- **Product-feature coverage completed for the pantry spec (2026-07-10):** The feature inventory
  had 14 tracked features, but all 14 were about the _existing Podex demo's defects_
  (`audit-codebase-analysis-*`, `audit-security-*`, `remediation-*`) — none tracked the actual
  pantry capabilities in `.aidd/spec.md`. Onboarding was stuck re-running (phase never advanced)
  because the feature list did not cover the spec and fell short of the ≥20-feature minimum. Created
  **12 new product-feature tracking files** (scaffolding only; all `passes: false`,
  `status: "waiting_approval"`, no application code touched) mapped 1:1 to the spec's core features
  and quality bar: `item-model-and-storage`, `item-crud`, `server-side-validation`,
  `inventory-list-view`, `category-filter-and-search`, `low-stock-view`, `expiring-soon-view`,
  `quick-adjust-quantity`, `csv-export`, `seed-data-script`, `accessibility-forms-and-views`,
  `pantry-test-coverage`. Dependencies are wired to the build graph (model → CRUD/list → views/
  filters → tests). Four carry comprehensive 10+ step specs (`item-crud`, `server-side-validation`,
  `inventory-list-view`, `pantry-test-coverage`). **Feature inventory is now 26 total, 0 implemented,
  26 open** (14 audit/remediation + 12 product); **JSON validation: 26 files parsed, 0 invalid**
  (`aidd` binary not on PATH, so validated via `JSON.parse` per file). New files normalized with a
  temporary plugin-free prettier config carrying the project's tab settings (the project's
  `prettier-plugin-sql`/`prettier-plugin-tailwindcss` are not installed, so `bun run format` cannot
  run repo-wide); all 12 reported `unchanged`, and the temp config was removed. Updated
  `.aidd/todo.md` with a "Pantry product build" section listing the 12 features in dependency order,
  plus a sequencing note that the data-model / add-update-wiring audit findings overlap the CRUD/model
  build and the salvage-vs-rewrite product decision should be resolved first. Scaffolding-only
  change; no product code written, no dev server started.

### Documentation

- **Onboarding scaffolding completed (2026-07-10):** Closed the remaining onboarding-doc gaps for
  pantry. (1) Rewrote `.aidd/project-structure.md` — it had been left as the unfilled Podex template
  (placeholders only); it now documents the real repo layout (`podex.ps1`, `server.psd1`, `api/crud`
    - `api/debug`, `views/{layouts,components,partials}`, `public/`, `tests/`), the file-based routing
      model (HTTP method inferred from filename), the PowerShell/Pode/htmx/Mustache/Tailwind/SQLite
      stack, the current-vs-planned data model, dev workflow, and gotchas (broad `Podex.Debug` switch,
      no security headers, shipped code is the demo not pantry, `pwsh` not `powershell.exe`).
      (2) Created `CONTEXT.md` (root, required domain-context artifact that was missing) — pantry
      vocabulary, the single `Item` entity + fields (incl. `threshold`), the derived views (inventory /
      low-stock / expiring-soon / filter-search), core interactions (CRUD, quick-adjust, CSV export,
      seed), and out-of-scope boundaries; explicitly notes product is not yet implemented.
      (3) Created `.aidd/todo.md` capturing the 14 discovered issues (grouped High/Medium/Tech-debt),
      each cross-referenced to its `feature.json` id, plus the artifact gaps and the blocking
      product-owner decisions. **Artifact inventory** (post-`.artifacts-check.json`, which was captured
      pre-onboarding): present & fresh — `spec.md` (required), `assertions.md`, `project-profile.json`,
      `project.md`, `questions.md`, `responses.md`, `testing-scenarios.md`, `project-structure.md`
      (now rewritten), `CONTEXT.md` (now created); **tracked gaps** — `roadmap.json` missing → follow-up
      `/update-roadmap`; `screen-map.md` missing → follow-up `/update-screen-map`. No `.auto*` legacy
      scaffolding present. Feature inventory unchanged: **14 features, all `waiting_approval`,
      0 implemented** (repo ships the stock Podex demo; pantry spec ~0% built) — feature metadata was
      not modified this session, so no re-validation was required. Scaffolding-only change; no
      application code touched, no dev server started.
- **Intake report written (2026-07-10):** Wrote `.aidd/reports/intake.md` (new) summarizing the
  onboarding/intake state for pantry. Captures: detected stack + inferred project profile
  (PowerShell/Pode/htmx/Mustache/Tailwind/SQLite, low-sensitivity local single-instance,
  product ~0% of spec — repo ships the stock Podex demo); `.aidd` artifacts created/refreshed during
  intake (spec, assertions, project-profile, questions, testing-scenarios, 31 audit-reports,
  14 feature.json, coverage-audit report) and still-missing ones (`CONTEXT.md` required,
  `roadmap.json`, `screen-map.md`, `responses.md`); feature inventory — **14 total, 0 implemented,
  14 waiting_approval, 3 remediation, 14 parked to waiting_approval during intake**; audit findings
  summary (codebase health `D` / 3 critical; SECURITY 72/100, 1 Med + 1 Low; coverage-audit all
  `ambiguous`, no auto-fixes); the 46 open interview questions and 5 blocking product-owner decisions;
  and recommended next actions. Report-only change; nothing written outside `.aidd/`.

### Changed

- **Parked all open generated features for approval (2026-07-10):** Walked every
  `.aidd/features/*/feature.json` (14 total). All 14 carried `status: "backlog"`; set each to
  `"waiting_approval"` and left every other field (including `passes: false`) untouched. No features
  were already `waiting_approval` or `completed`, and none were `in_progress`. This enforces the
  intake invariant that generated features require explicit human approval before any agent may pick
  them up — no actionable open work is left behind. Re-normalized all touched files with prettier
  (JSON output identical to the project config; the project's SQL/tailwind prettier plugins are not
  installed in `node_modules`, so a temporary plugin-free config carrying the project's tab/width
  settings was used, then removed — this also converted the two `audit-security-1783694727-*` files
  from 2-space to the project-standard tab indentation). Ran the aidd feature check
  (`bun run start -- --project-dir . --check-features`): **14 files, all valid, 0 invalid.**
  Features parked: **14.**

### Documentation

- **Audit-finding-review re-run — 14 findings re-verified, all KEEP, no changes (2026-07-10):**
  Ran the AIDD `audit-finding-review` ingredient over `pantry`. Discovered 14 audit-sourced
  `feature.json` findings (9 `audit-codebase-analysis-*`, 2 `audit-security-1783694727-*`,
  3 `remediation-20260710-*`); 0 non-audit features skipped. This app is **not** Spernakit-derived
  (package.json `name: "podex"`, no `spernakit_version`), so template-applicability/ESCALATE is N/A
  — every finding is APP-ONLY by definition. Re-verified all 14 against the live codebase:
  SQL injection via interpolated `tagFilter` (`get.ps1:50`), three-layer data-model mismatch
  (`feature`/`tag` API vs `items` schema vs view), pagination total from paginated `$rs.Count`
  (`get.ps1:48`, count query at `:21,:39` never run), unauth destructive debug routes (`podex.ps1:87-93`,
  `server.psd1:39` `Debug=$true`), broken add/update wiring, zero test coverage, pantry spec
  unimplemented (stock Podex demo), redundant `Remove-UnsafeCharacter`, `ShowExceptions=$true`
  (`server.psd1:24`), no HTTP security headers (no `Set-PodeSecurity` anywhere), ungated
  OpenAPI/Swagger (`podex.ps1:105-107` outside the `if ($cfg.Podex.Debug)` block closing at `:102`),
  debug hot-path writes (`get.ps1:79-82`), `-save` logger path-traversal (`podex.ps1:31-33`),
  fragile int cast (`get.ps1:13-14`). **All findings ACCURATE and NECESSARY** — none stale, false
  positive, over-engineered, or framework-handled (Pode emits no security headers by default;
  fixes are one-liners, not enterprise scaffolding). No consolidation applied: the `Podex.Debug`
  cluster and paging cluster are distinct defects on shared files (already carrying coordination
  notes from prior feature-review runs). Disposition: **14 KEEP, 0 REMOVE/CONSOLIDATE/ESCALATE/DOWNGRADE.**
  No `roadmap.json` present → Phase 6.6 reconciliation skipped. Phase 7: all 14 `feature.json`
  valid JSON, no orphaned directories, all dependency refs (`…-1795-data-model-mismatch`) resolve.
  Handoff: >3 KEEP remain → run `feature-review` for pantry to re-validate specs.
- **Feature-review re-run — all 14 specs re-verified, no changes (2026-07-10):** Ran the AIDD
  `feature-review` ingredient over `pantry`. Learned conventions from the actual stack
  (PowerShell Core / Pode / htmx / SQLite per `.aidd/project-profile.json` and `spec.md`) rather
  than the ingredient's default Elysia/Drizzle/React assumptions. Discovered 14 backlog
  `feature.json` files (9 `audit-codebase-analysis-*`, 3 `remediation-20260710-*`,
  2 `audit-security-1783694727-*`); 0 template features (no `spernakit_version`), 0 completed,
  no `roadmap.json` (Phase 6.5 assignment skipped). Re-verified every spec anchor against live
  source: `get.ps1:13-14` int cast, `:20-21` `feature`/`tag` queries, `:48` paginated total,
  `:50` interpolated `tagFilter` injection, `:79` unconditional serialize + `:80-82` Debug-gated
  file write, `:100-102` catch→500; `podex.ps1:31-33` `-save` path-traversal, `:35-45`
  `Remove-UnsafeCharacter`, `:85-93` debug-route registration, `:105-107` unconditional
  OpenAPI/Swagger; `server.psd1:24` `ShowExceptions=$true`, `:39` `Podex.Debug=$true`;
  `post.ps1:43-46/48-57`, `put.ps1:19-35`, `init.sql` `items` table, `crudmgr.pode:63/105-107/110-117`.
  All anchors accurate, all specs concrete with real artifacts, dependencies valid, no duplication
  or cathedral gaps beyond those already flagged, no template features. Coupling notes
  (Podex.Debug cluster, paging cluster), the debug-hotpath description correction, and
  data-model-rewrite supersession caveats from prior runs remain correct and were preserved.
  **No auto-fixes applied** — the backlog is clean. Minor (report-only, not fixed to avoid churn):
  the two `audit-security-*` files use 2-space indentation + `id`-first key order vs the tab
  indentation used elsewhere; the OpenAPI/Swagger finding shares the `Podex.Debug` default with the
  debug cluster but already documents that coordination in its own spec step 2.
- **Audit-finding review — all findings retained, no changes (2026-07-10):** Ran the AIDD
  `audit-finding-review` ingredient over `pantry`. Discovered 14 audit-sourced `feature.json`
  findings (9 `audit-codebase-analysis-*`, 3 `remediation-20260710-*`, 2 `audit-security-1783694727-*`);
  0 non-audit features. Independently re-verified every finding against live source: `get.ps1:50`
  interpolated `tagFilter` SQL injection; `init.sql` `items` table vs `get.ps1` `feature`/`tag`
  queries vs `crudmgr.pode` `{{item}}`/`{{description}}` data-model mismatch; `podex.ps1:87-93` +
  `server.psd1:39` unauthenticated destructive debug routes (`stop.ps1`→`Close-PodeServer`,
  `init.ps1`→DROP/recreate); `get.ps1:48` pagination total from paginated `$rs` with `$countSqlx`
  never executed; `/htmx/item-new` vs registered `/htmx/crudmgr-new` (component `crud-new`,
  file `crudmgr-new.pode`) add-item name mismatch and Update field mismatch; `tests/` holds only
  `tests.ps1.old`; whole app is the stock Podex demo vs the pantry spec (`project-structure.md`
  still a `{placeholder}`); `Remove-UnsafeCharacter` redundant with parameterization and
  data-corrupting; `server.psd1:24` `ShowExceptions=$true`; `podex.ps1:31-33` `-save`
  path-traversal primitive (latent, no callers); `get.ps1:79-82` hot-path serialization + source-tree
  file writes; `get.ps1:13-14` hard `[int]` paging cast → 500; missing HTTP security headers; and
  `podex.ps1:105-107` OpenAPI/Swagger mounted ungated. **Disposition: all 14 KEEP** — every finding
  is ACCURATE and NECESSARY, none false-positive/stale/over-engineered. No ESCALATE (pantry is a
  Pode/PowerShell app, not a Spernakit-derived app, so there is no base template to escalate to). No
  CONSOLIDATE — the Debug-default cluster (`unauth-debug-routes`, `show-exceptions-disclosure`,
  `openapi-swagger`, `debug-hotpath-writes`) spans Critical→Low with distinct remediations and is
  already coordinated via existing coupling notes + dependencies; merging would erase provenance and
  granularity. No roadmap reconciliation (no `.aidd/roadmap.json` present — assignment skipped). No
  `feature.json` files were created, deleted, or modified. Verification: all 14 dirs contain valid
  JSON, zero orphaned dirs, all dependency refs (`...1798`→`...1795`, `...1800`→`...1795`) resolve.

- **Testing scenarios seeded (2026-07-10):** Ran the AIDD `testing-scenarios` ingredient for
  `pantry` in seed mode (no prior `.aidd/testing-scenarios.md` existed). Surveyed the blueprint
  (`spec.md`, `project.md`) and the live frontend/routes (`api/crud/*.ps1`, `views/components/crudmgr.pode`,
  `views/partials/header.pode`, `htmx/`). Confirmed the current build is a generic Pode/htmx
  feature-CRUD scaffold ("Podex") with significant spec-drift vs the pantry domain. Authored
  `.aidd/testing-scenarios.md` with 14 `spernakit-tester pantry:` scenarios covering all nine
  spec'd core features — item add/edit/delete, empty state, category-grouped list, category filter +
  case-insensitive search, low-stock view + nav count, expiring-soon view (expired vs expiring),
  quick +/- adjust, inline server-side validation, CSV export, seed-data script — plus two
  cross-cutting flows (adjust-below-threshold → low-stock; add-3-day-expiry → expiring-soon). No
  RBAC scenarios (spec mandates no auth, single household). Scenarios are grounded in `spec.md` as
  the source of truth; several are expected to surface the known drift, feeding the Post-Test
  Procedure (`bug2feature` → `feature-review`). Only `.aidd/testing-scenarios.md` was created.

- **Feature review — idempotent re-run, no changes (2026-07-10):** Re-ran the AIDD `feature-review`
  ingredient over `pantry`. Independently re-verified every anchor in all 12 backlog `feature.json`
  files (9 `audit-codebase-analysis-*`, 3 `remediation-20260710-*`; 0 template features) against
  live source — all still accurate (`get.ps1:50` SQL injection; `init.sql`/`feature`/`tag` vs
  `crudmgr.pode` data-model mismatch; `podex.ps1:87-93` + `server.psd1:39` debug routes;
  `get.ps1:48` pagination count; `crudmgr.pode:63` add-modal name mismatch + PUT field mismatch;
  `post.ps1:43-46` redundant sanitizer; `server.psd1:24` ShowExceptions; `get.ps1:13-14` int cast;
  `get.ps1:79-82` debug writes; `podex.ps1:31-33` `-save` path traversal). Structural validity,
  spec specificity, codebase alignment, dependency integrity, and cross-feature checks all PASS.
  Coordination notes for the `Podex.Debug` and `get.ps1` paging clusters are present and
  bidirectional; the debug-hotpath-writes description correction is in place. **No auto-fixes
  applied** — the prior run (commit 57106e2) already resolved all safe metadata issues; remaining
  gaps (salvage-vs-rewrite build order, priority-scale reconciliation, the soft "Consider defaulting
  Podex.Debug" step) are product decisions the ingredient must not auto-resolve. No `roadmap.json`,
  so Phase 6.5 was skipped. 0 features modified, 0 auto-closed.
- **Feature review — specs verified against source, coordination notes added (2026-07-10):** Ran the
  AIDD `feature-review` ingredient over `pantry`. Reviewed all 12 backlog `feature.json` files (9
  `audit-codebase-analysis-*`, 3 `remediation-20260710-*`); no template (`spernakit_version`)
  features present. **Re-verified every audit/remediation claim against live source** — all anchors
  are accurate today: SQL injection at `api/crud/get.ps1:50`; three-layer data-model mismatch
  (`items` schema vs `feature`/`tag` API vs `item`/`description` view); unauth debug routes
  (`podex.ps1:87-93`, `server.psd1:39` `Podex.Debug=$true`); pagination total from paginated result
  (`get.ps1:48`, count query `get.ps1:21/39` never run); broken Add/Update wiring
  (`crudmgr.pode:63` `/htmx/item-new` vs registered `/htmx/crudmgr-new`; PUT field mismatch);
  redundant `Remove-UnsafeCharacter` sanitizer; `ShowExceptions=$true` disclosure; and the three
  remediation get.ps1/podex.ps1 items. Structural validity, spec specificity, and codebase
  alignment all pass; specs use the accepted audit "Detailed remediation steps:" action-verb format;
  Pester is the project's real test framework so "Add a Pester test" steps are appropriate.
  **Auto-fix (metadata only):** added coordination `notes` to 4 features to surface edit-surface
  coupling the prior `.aidd/remediation-review.md` recommended making visible —
  `sql-injection-tag-query` and `pagination-total-count` (both edit `api/crud/get.ps1`, may be
  superseded by the data-model rewrite; pagination shares the paging block/test file with
  `remediation-...-paging-input-validation`), and `unauth-debug-routes` + `show-exceptions-disclosure`
  (both pivot on the shared `server.psd1` `Podex.Debug=$true` default alongside
  `remediation-...-debug-hotpath-writes`). No `id`/`status`/`passes`/`priority`/`dependencies`/`spec`
  changed; `updatedAt` bumped on the 4 modified files; all 12 revalidated as JSON. No features were
  auto-closed as duplicates. No `roadmap.json` exists, so Phase 6.5 roadmap re-assertion was skipped.
  Report-only observations (require the unresolved framework-vs-pantry / salvage-vs-rewrite product
  decision, not agent judgment): `data-model-mismatch` and `spec-drift-unimplemented` carry the
  large data-model/whole-app rewrite that may moot the four `get.ps1` fixes; `unauth-debug-routes`
  step 3 ("Consider defaulting Podex.Debug…") is intentionally soft and left as-is.
- **Feature coverage audit — report only, no auto-fixes (2026-07-10):** Ran the AIDD
  `feature-coverage-audit` ingredient (`--apply`) over `pantry`. Report at
  `.aidd/reports/feature-coverage-audit-2026-07-10.md`. Inventoried 13 implemented capabilities
  (all part of the stock Podex framework/CRUD demo) against natural docs and `feature.json`
  coverage. **No safe auto-fixes were applied** — the honest, correct outcome: every implemented
  capability is either demonstrably broken (data-model mismatch → 500s; broken Add/Update wiring)
  and so cannot be marked `passes: true`, or sits under the unresolved `[OPEN]`
  framework-vs-pantry-product / salvage-vs-rewrite forks (`.aidd/assertions.md` §1–3), which makes
  its feature boundary and product intent ambiguous. The Safe Auto-Fix Policy forbids backfilling
  `completed` records under those conditions. Dispositions: 13 `ambiguous`, 1 `stale-doc` (README
  documents upstream Podex and links a missing `#features` section). The existing 12
  `feature.json` files are audit/remediation bug records, not capability blueprints, and were left
  untouched. No feature metadata changed, so `--check-features` was not run; no `roadmap.json`
  exists, so `roadmap:apply` was not run. Follow-up: resolve the two product forks, then re-run the
  audit so genuinely-functional primitives can be backfilled honestly.
- **Wrote `.aidd/project-profile.json` — assurance profile (2026-07-10):** Inferred the project's
  assurance profile from the source tree and the `CODEBASE_ANALYSIS-2026-07-10.md` report. No prior
  profile existed. Captured: **stack** (PowerShell Core + Pode server, htmx/Mustache/Tailwind v4
  server-rendered frontend, SQLite via PSSQLite, file-based route auto-registration); **deployment**
  (local single-instance dev server, HTTP `localhost:8433`, HTTPS disabled per `server.psd1`);
  **auth mode** (`none` — spec mandates no auth/single household; noted the unauthenticated debug
  routes concern); **data sensitivity** (`low` — household pantry inventory, no PII/regulated data);
  **criticality** (`low` — local utility app); **external integrations** (`none` — spec forbids
  external APIs); and the project's own **validation commands** (`package.json` scripts: `test` =
  Pester, `analyze` = PSScriptAnalyzer, `lint`, `format`, `build`, `start`), with `npm run test` as
  the primary gate and `npm run analyze && npm run test` recommended. Only `.aidd/` was modified.

### Maintenance

- **Feature consolidation run — no-op (2026-07-10):** Ran the AIDD `consolidate-features` ingredient
  against `pantry`. Discovery found 12 features (9 `audit-codebase-analysis-*` findings + 3
  `remediation-20260710-*` features), **all in `status: "backlog"`**, plus 0 base features, 0
  template features (`spernakit_version` absent), and 0 `feature-*`-prefixed directories. The
  ingredient only folds/deletes remediation & audit features whose status is `completed` or
  `verified`; backlog items are unfinished work and are left untouched. With no completed findings
  and no base features to fold into, nothing was folded, deleted, renamed, or committed. No
  `roadmap.json`/`screen-map.md` present, so Phase 5b assignment was skipped. Re-run this ingredient
  after the audit/remediation features are executed and marked complete.

### Added

- **Consolidated assertions (2026-07-10):** Created `.aidd/assertions.md` — a deduplicated checklist
  of the claims, assumptions, and conclusions established across the review artifacts
  (`.aidd/questions.md`, `.aidd/response-review.md`, `.aidd/remediation-review.md`, grounded in the
  codebase-analysis findings they re-verify). Entries are tagged `[FACT]` (re-verified against live
  source), `[STATUS]` (project/process state), `[CONCLUSION]` (review judgement), and `[OPEN]`
  (unresolved decision with no defensible default). Grouped into 10 themes plus overall status:
  product identity/spec drift, data model, architecture/storage, security, debug/config hot-path,
  pagination, testing, interview status, remediation backlog provenance, and confirmed non-goals.
  Deduplicated the overlaps across the three source docs (e.g. the `Podex.Debug` root-cause cluster,
  the two `get.ps1` paging items, the "no interview responses submitted" headline, and the
  data-model-rewrite supersession caveat) into single checklist items.

- **Feature review (2026-07-10):** Ran the AIDD `feature-review` ingredient over the 12 backlog
  features (9 `audit-codebase-analysis-*` + 3 `remediation-20260710-*`; 0 template features, 0
  completed). Learned conventions from the live PowerShell/Pode + htmx + PSSQLite stack (file-based
  routes under `api/`, Pode views under `views/`, Pester tests under `tests/*.ps1`, `server.psd1`
  config). All 12 specs re-verified as structurally valid, accurately anchored, and free of banned
  vague verbs; no codebase-duplication auto-closes and no cathedral risks (all entries are
  remediations of existing files, not net-new backend-only work). No `roadmap.json` present, so
  Phase 6.5 assignment was skipped. Applied 3 auto-fixes: (1) corrected the
  `remediation-20260710-debug-hotpath-writes` description — the `get.ps1:79` full-response
  serialization is unconditional, not `Podex.Debug`-gated (only the `get.ps1:80-82` file write is);
  (2) added the undeclared `data-model-mismatch` dependency to
  `audit-codebase-analysis-1783691798-broken-add-and-update-wiring`, whose spec already requires "the
  unified data model"; (3) added coordination/caveat notes to both get.ps1 remediation features
  (Podex.Debug cluster coupling, paging-block collision with `pagination-total-count`, and the
  pending data-model-rewrite supersession). Product-decision items (fork-in-the-road debug-route
  retention, the priority-scale reconciliation) were left as report-only per the ingredient's
  no-invent constraint.

- **Remediation feature review (2026-07-10):** Assessed the three `remediation-20260710-*` features
  per directive; wrote `.aidd/remediation-review.md`. Re-verified all three claims against live
  source (line anchors accurate) and cross-checked dedup against the 9 `audit-codebase-analysis-*`
  entries (no duplicates — confirmed correct). Corrected the directive's provenance framing: these
  came from the `doc2feature` triage of the codebase-analysis report, **not** from interview
  responses (none were submitted). Strengths: accurate anchors, tight single-defect scoping, correct
  dedup, testable specs, honest latent-labelling. Weak spots: debug-hotpath-writes description
  conflates the unconditional `get.ps1:79` serialization with the Debug-gated `get.ps1:80-82` file
  write; the `Podex.Debug` cluster and the two get.ps1 paging items are uncoordinated (no
  cross-links); two priority vocabularies coexist; no caveat that both get.ps1 items may be
  superseded by the pending data-model rewrite. Recommended 6 metadata-only follow-ups; flagged
  logger-path-traversal as the only item safe to action independent of the outstanding
  interview/rewrite decisions.
- **Document-to-feature triage (2026-07-10):** Ran the AIDD `doc2feature` ingredient over
  `.aidd/audit-reports/CODEBASE_ANALYSIS-2026-07-10.md` (target app: pantry). Extracted 14 claims,
  verified each against the live PowerShell/Pode code, and cross-checked `.aidd/response-review.md`
  (no responses submitted; no code claim contradicted). 9 findings deduped against the existing
  `audit-codebase-analysis-*` backlog; 5 were not actionable (DAL enhancement folded into the
  data-model rewrite, pre-emptive XSS flag [by-design today], a negligible BOM lint nit, speculative
  caching, and the "no git commits" process step). Created **3 net-new remediation features** for
  confirmed findings the codebase-analysis pass never captured:
  `remediation-20260710-paging-input-validation` (P3, Backend — `get.ps1:13-14` hard int cast throws
  500 instead of 400), `remediation-20260710-debug-hotpath-writes` (P4, Backend — `get.ps1:79-82`
  serializes the full response and writes `Get.json` into the source tree on every GET when Debug is
  on), and `remediation-20260710-logger-path-traversal` (P4, Security — `podex.ps1:31-33` `-save`
  branch builds an output path from the request URL; latent, no callers today). No `roadmap.json`
  present, so Phase 8b assignment was skipped.
- **Interview response review (2026-07-10):** Assessed the onboarding interview responses per
  directive; wrote `.aidd/response-review.md`. Headline finding: **no responses were ever
  submitted** — `.aidd/questions.md` (46 questions) exists but there is no `responses.md`,
  `.aidd/responses/`, or any recorded answers. Review documents the total gap, the 7 critical
  unanswered decisions that block v1 planning (product identity, salvage-vs-rewrite, storage/DAL,
  deployment surface + Debug default, test-coverage gate, data-model confirmation, build order),
  and flags that the "final handoff" window may be closing. Status: `waiting_approval` — responses
  required before a substantive assessment is possible.
- **Codebase analysis report (2026-07-10):** Ran the AIDD `codebase-analysis` ingredient
  over the whole repository. Report at `.aidd/audit-reports/CODEBASE_ANALYSIS-2026-07-10.md`
  (overall health **D**). Created 9 durable backlog entries under
  `.aidd/features/audit-codebase-analysis-*` (3 Critical, 4 High, 2 Medium).
  Headline findings: three-layer data-model mismatch (`items` schema vs `feature`/`tag` API
  vs `item`/`description` view) makes the CRUD demo non-functional; SQL injection via
  interpolated `tagFilter` (`api/crud/get.ps1:50`); unauthenticated destructive debug routes
  (`/stop`, `/clear`, `/init`) enabled by default; pagination totals computed from the
  paginated result (count query never executed); Add-Item/Update wiring broken; zero test
  coverage; and the pantry spec is entirely unimplemented (repo ships the stock Podex demo).
  Quality gates: PSScriptAnalyzer clean (2 info, 2 warnings); ESLint could not run
  (deps not installed); no Pester tests discovered.

### Changed

### Deprecated

### Removed

### Fixed

### Security
