# Onboarding Interview — Pantry

_Generated: 2026-07-10_
_Context: Final handoff questionnaire. You have one opportunity to ask these — the outgoing maintainers will be unreachable afterward._

_Basis: `.aidd/spec.md`, `.aidd/project.md`, `.aidd/audit-reports/CODEBASE_ANALYSIS-2026-07-10.md` (overall health **D**), the 9 audit backlog features under `.aidd/features/audit-codebase-analysis-*`, and the source tree (`podex.ps1`, `api/`, `views/`, `server.psd1`, `.build.ps1`). The dominant fact driving these questions: **the repository is the stock "Podex" framework demo, not the pantry tracker the spec describes** — the product is at ~0% implementation, git has no commits, and even the demo is internally inconsistent (three-layer `items` vs `feature`/`tag` vs `item`/`description` data-model split)._

## Legend

- **[CRITICAL]** Must answer before assuming ownership
- **[HIGH]** Significantly de-risks v1 delivery
- **[NICE]** Helpful context

---

## 1. Product Intent & Vision

- **[CRITICAL]** The spec (`.aidd/spec.md`) describes a household pantry tracker, but the code is the generic Podex feature/CRUD demo. **Which is the real target for v1 — build the pantry product on the Podex substrate, or is Podex-the-framework the deliverable and "pantry" just a placeholder brief?** Everything downstream depends on this answer.
- **[CRITICAL]** What is the concrete **v1 definition of done**? Is it "all 9 spec features shipped and tested," or a thinner MVP (e.g. item CRUD + inventory list + search, deferring low-stock/expiring/CSV)? If it must slip, which of the 9 features are cuttable?
- **[HIGH]** Who actually uses this — a single person, one household with a few members sharing a screen, or is "single household, no multi-tenancy" (spec) a v1 simplification you intend to relax later? This affects whether any per-user notion needs to exist in the data model now.
- **[HIGH]** Is there a **deadline or event** driving v1 (personal use, a demo, a portfolio piece, a template others will fork)? What can and cannot slip?
- **[NICE]** What does success look like 6 months out — is Pantry a one-off utility, or the reference app that proves the Podex framework for future projects?

## 2. Business Logic & Domain Rules

- **[CRITICAL]** The spec fixes several magic numbers: **low-stock `threshold` default = 1**, **expiring-soon window = within 7 days or past**. Are these firm product rules, or configurable/negotiable? Should the expiry window be a per-item or a global setting?
- **[HIGH]** Expiry semantics: is an item with **today's** date "expiring" or already "expired"? How should items with **no** expiry date behave in the expiring-soon view and in sorting (excluded entirely, sorted last)?
- **[HIGH]** Quick-adjust (+/−): should quantity be allowed to hit **0** and stay (spec says quantity ≥ 0), and what happens at 0 — does the row remain, auto-flag as low-stock, or offer deletion? Can `−` ever go negative or is it clamped?
- **[HIGH]** `unit` and `category` — are these **free text** or a **controlled vocabulary** (fixed enum / user-managed list)? The grouped inventory view and the category filter both assume categories are stable enough to group by; free text will fragment groups ("Dairy" vs "dairy").
- **[NICE]** Search matches "name and notes, case-insensitive" (spec). Should it also match category/unit? Substring or token match? Any accent/diacritic folding expected?
- **[NICE]** Are duplicate item names allowed (two "Milk" rows), or should name be unique per category?

## 3. Codebase & Architecture

- **[CRITICAL]** The repo is mid-transition: an `items(item, description)` schema, a `feature`/`tag` API, and an `item`/`description` view that all disagree (audit finding #1). **Was the intent to migrate the `items` demo toward a `feature`/`tag` demo, or vice-versa — and should we discard both and model the pantry `items` entity fresh?** Is any of the existing CRUD/tag/pagination code worth keeping, or is it scaffolding to delete?
- **[CRITICAL]** The spec asks for storage "behind a small data-access layer" and says to **pick JSON file or SQLite**. The code uses SQLite via PSSQLite with SQL inlined into every route handler (no DAL). **Is SQLite the committed choice, and do you want the DAL abstraction built now** (so storage stays swappable), or is inlined SQL acceptable for v1?
- **[HIGH]** The file-based API auto-registration in `podex.ps1` (filename → HTTP method/path) is the framework's core idea. Is this convention **load-bearing and sacred**, or open to change (e.g. if it makes the pantry routes awkward)?
- **[HIGH]** There are **three names for the "add item" flow** — route `/htmx/item-new` (in the view), route `/htmx/crudmgr-new` + component `crud-new` (in `podex.ps1`), and file `crudmgr-new.pode` — none wired consistently (audit finding, "Broken Add-Item wiring"). Was there a rename in flight? What's the intended canonical naming so we don't re-break it?
- **[NICE]** Client-side Mustache templating (`client-side-templates` htmx extension) renders the list from JSON. The spec frames the interaction as "server-rendered fragments." **Is client-side Mustache an accepted pattern, or should list rendering move fully server-side** (htmx swapping pre-rendered `.pode` fragments)?
- **[NICE]** `.build.ps1` mixes install (`Install-Module`, `npm install`, DB reinit `Read-Host`) with build/verify. Is splitting `install` from `verify`/`build` (so CI can run non-interactively) in scope for v1?

## 4. Data Model & Migrations

- **[CRITICAL]** Confirm the **canonical pantry item shape** for v1: `name, category, quantity, unit, expiry (optional), notes (optional), threshold (default 1), createdAt, updatedAt`. Any fields missing (e.g. location/shelf, barcode, purchase date, brand)? Any that should be dropped?
- **[HIGH]** There is **no migration story** — `api/debug/init.sql` just `DROP`s and recreates. For a personal app with disposable data that may be fine, but: **is preserving existing data across schema changes ever required, or is "wipe and reseed" acceptable throughout v1?**
- **[HIGH]** The seed script must load "~20 realistic items ... including a few low-stock and expiring rows." Do you have a **preferred sample dataset** (specific items/categories), or is the agent free to invent realistic content? Should seed be **idempotent** (safe to re-run) or destructive?
- **[NICE]** Timestamps — stored as UTC ISO-8601, or local? Any timezone the household should be assumed to be in for "expiring within 7 days" calculations?
- **[NICE]** Where should the SQLite DB file live (`Podex.DBFile`), and should it be **git-ignored** and per-environment, or committed with seed data for demos?

## 5. Infrastructure, Deployment & Environments

- **[CRITICAL]** **Where does this actually run?** Localhost-only on one machine, a home server/Raspberry Pi on the LAN, or something internet-exposed? This changes the entire security posture — the debug-route and exception-disclosure findings are minor on localhost and severe if reachable off-box.
- **[HIGH]** `server.psd1` ships **`Podex.Debug = $true`** and **`Web.ErrorPages.ShowExceptions = $true`** by default, which enables the destructive `/stop`, `/clear`, `/init` routes and leaks stack traces (audit Critical/Medium). What is the intended **production/default config** — should Debug be off by default with an explicit local-dev opt-in?
- **[HIGH]** Is there any **deployment/runtime target** to honor (Windows service, `pwsh` on a schedule, Docker container, always-on process)? The team runs PowerShell 7.5+ via `pwsh` — is that guaranteed on the deploy host?
- **[NICE]** HTTP only today. Is TLS/HTTPS ever required for v1, or is plain HTTP on a trusted LAN acceptable?
- **[NICE]** Any backup expectation for the pantry DB, or is loss-tolerant (reseed) acceptable?

## 6. Operations, Monitoring & Incident History

- **[HIGH]** On every list GET with Debug on, the app **writes `Get.json` into the source tree and logs full response JSON** to the terminal (`get.ps1:80-82`). Was this an intentional debugging aid you want kept behind a flag, or leftover scaffolding to remove?
- **[NICE]** Is there any logging/observability expectation for v1 (structured logs, log levels), or is the current `Write-FormattedLog` terminal output sufficient for a personal app?
- **[NICE]** Since git has **no commits and there's no history**, were there any past dead-ends, abandoned experiments, or "this approach didn't work" moments in building the Podex scaffold that we should know about before extending it?

## 7. Security, Auth & Compliance

- **[CRITICAL]** Confirm **"no authentication" is a deliberate, permanent v1 decision** (spec says so) and not just deferred — i.e. we should not build any login/session scaffolding. If the app is ever LAN- or internet-exposed (see §5), does that change?
- **[HIGH]** `get.ps1:50` has a **SQL-injection hole** (raw `tagFilter` interpolated into the tag query while every other query is parameterized). If we discard the `tag` feature entirely for the pantry model, this vanishes — otherwise it must be parameterized. **Confirm the `tag` concept is out of scope** so we can delete rather than patch it.
- **[HIGH]** `Remove-UnsafeCharacter` (`podex.ps1:35`) is a blacklist that **mangles legitimate data** (`O'Brien` → `O''Brien`, `--` → `\-\-`) despite inserts already being parameterized. Any objection to **removing it and storing user text verbatim**, relying on parameterization?
- **[HIGH]** `crudmgr-new.pode:34` invites input "in markdown or HTML format." **Do you actually want rich-text/HTML notes rendered** (which would introduce stored-XSS risk and require sanitization), or is plain text (auto-escaped) fine for pantry notes?
- **[NICE]** Any compliance/privacy concerns at all (household data only, presumably none), or can we treat all data as non-sensitive?

## 8. Testing & Quality

- **[CRITICAL]** The spec's quality bar is "**all features covered by the repo's test framework in `tests/`**," but current coverage is **0%** — only `tests/tests.ps1.old` exists, which the Pester glob (`tests/*.ps1`) excludes. Is **Pester the mandated test framework**, and is per-feature test coverage a hard gate for v1 "done," or aspirational?
- **[HIGH]** What are the **green-gate commands** the CI/pre-commit expects to pass — `npm run test` (Pester), `npm run analyze` (PSScriptAnalyzer), `npm run lint` (ESLint on the vendored JS)? Should all three block a commit, and to what severity threshold?
- **[HIGH]** What's in `tests/tests.ps1.old`, and **why was it renamed out of the glob** — is it a starting point to revive, or abandoned/misleading and safe to delete?
- **[NICE]** Any manual QA ritual or "smoke" flow you run by hand before considering a change shippable that we should encode as a test?

## 9. Dependencies & Third-Party Integrations

- **[HIGH]** Runtime module versions are pinned in `.build.ps1` (Pode, PSSQLite, Pester, PSScriptAnalyzer) but **no `package-lock.json` is committed** (git-ignored), so the vendored JS (htmx, mustache, tailwind) is version-unpinned. Do you want the **JS deps pinned/lockfile committed** for reproducibility, or is "latest vendored copy" acceptable for a personal app?
- **[NICE]** Are **Pode** and **PSSQLite** firm choices, or would you consider a pure-JSON-file store (spec allows it) to drop the SQLite dependency entirely?
- **[NICE]** Is **Tailwind v4** (currently vendored) a committed styling choice, and is there a target look/design you want matched, or is functional-but-plain acceptable for v1?

## 10. Team Workflows & Conventions

- **[HIGH]** Git has **zero commits** — every file is untracked. Is establishing an **initial baseline commit** something you want done first, and are there commit-message / branching conventions (the environment enforces smoke:qc + lint pre-commit hooks — should those stay)?
- **[NICE]** Any unwritten conventions for the Pode/htmx idiom (naming of routes vs components vs `.pode` files) that aren't obvious from the code and that the three-way "item-new / crudmgr-new / crud-new" naming split suggests were never settled?
- **[NICE]** Are `.aidd/` artifacts (spec, assertions, roadmap) authoritative and maintained, or historical — which document wins when the spec and the code disagree (currently they disagree completely)?

## 11. Known Risks, Failure Points & Technical Debt

- **[CRITICAL]** If you were starting Pantry over today, **would you keep any of the Podex demo code, or scaffold the pantry model clean on Pode/htmx?** Knowing which existing code is trustworthy vs. throwaway is the single biggest de-risking answer for v1.
- **[HIGH]** What are the **top 3–5 things about this codebase that make you nervous** for someone extending it — beyond the audit's findings (data-model split, SQLi, debug routes, broken pagination/wiring, no tests)? Any "here be dragons" area the audit didn't catch?
- **[HIGH]** Pagination totals are computed from the paginated result set, so the built `$countSqlx` count query is **never executed** (`get.ps1:22,48`). Was pagination ever exercised beyond page 1, or is it effectively untested dead functionality we can rebuild rather than trust?
- **[NICE]** What debt did you _want_ to pay down but couldn't, and what decision (if any) do you already regret in the current scaffold?

## 12. Roadmap & v1 Definition of Done

- **[CRITICAL]** Given the app is at ~0% of spec, **what is the intended build order** for the 9 spec features? Suggested by the audit: (1) unify data model + storage/DAL, (2) item CRUD + inventory list, (3) category filter + search, (4) low-stock, (5) expiring-soon, (6) quick-adjust, (7) CSV export, (8) seed script, with tests alongside each. **Do you agree, and is anything mis-ordered or out of scope?**
- **[HIGH]** Are the **9 audit backlog features** (`.aidd/features/audit-codebase-analysis-*`, 3 Critical / 4 High / 2 Medium) meant to be remediated **before** new feature work, folded into it, or dropped where they touch code we're going to replace anyway (e.g. the `tag`/`feature` findings)?
- **[HIGH]** Accessibility is in the spec's quality bar (labeled inputs, keyboard-usable forms, button semantics). Is this a **hard v1 gate** or a post-v1 polish pass?
- **[NICE]** What's explicitly **out of scope forever** (confirmed non-goals): auth, realtime, external APIs, multi-tenancy (spec) — anything else you've already decided against (barcode scanning, notifications, shopping-list generation, mobile app)?

---

## Summary

- **Total questions**: 46 (14 critical / 18 high / 14 nice)
- **Top 5 must-ask** (if you only had 10 minutes with the outgoing team):
    1. **Build the pantry product on Podex, or is Podex-the-framework the deliverable?** (§1) — the spec and the entire codebase disagree; nothing else can be planned until this is settled.
    2. **Discard the `items`/`feature`/`tag` mess and model the pantry `item` fresh, or salvage existing CRUD code?** (§3, §11) — determines whether this is a rewrite or a repair.
    3. **SQLite + a real DAL, or JSON file — and is the swappable-storage abstraction required now?** (§3, §4) — the spec leaves this open and it shapes every route.
    4. **Where does it run, and should Debug/ShowExceptions be off by default?** (§5, §7) — turns three "Critical" security findings into either non-issues (localhost) or must-fix-now.
    5. **Is per-feature Pester coverage a hard gate for v1 "done"?** (§8) — current coverage is 0%; the answer sets the cost of every feature.
- **Biggest unknowns identified during Phase 1** (thinnest docs, highest risk):
    - **Product identity** — spec (pantry) vs. code (Podex demo): total divergence, ~0% implementation.
    - **Canonical data model** — three incompatible shapes coexist; no source of truth.
    - **Deployment surface** — no docs on where/how it runs, which gates the severity of every security finding.
    - **Storage decision** — spec explicitly defers "JSON vs SQLite" and the DAL; code chose SQLite but with no abstraction.
    - **Quality bar reality** — spec demands full test coverage; repo has none, and no history exists (zero git commits) to infer intent from.
