# Intake Report — Pantry

_Generated: 2026-07-10_
_Scope: onboarding/intake summary for `<WORKSPACE>/pantry`. Sources: `.aidd/project-profile.json`,
`.aidd/spec.md`, `.aidd/.artifacts-check.json`, `.aidd/features/*/feature.json`,
`.aidd/audit-reports/*`, `.aidd/questions.md`, `.aidd/CHANGELOG.md`, git history._

---

## 1. Detected stack & inferred project profile

- **Product intent (spec):** a small household **pantry / stock tracker** — item CRUD, grouped
  inventory list, category + text filter, low-stock and expiring-soon views, quick +/− adjust,
  CSV export, and a seed script. Single household, **no auth, no realtime, no external APIs**.
- **Detected stack (inferred, `high` confidence, authoritative profile):**
    - **Language / runtime:** PowerShell Core (`pwsh`, PowerShell 7+).
    - **Server:** [Pode](https://github.com/Badgerati/Pode), entrypoint `podex.ps1`, with
      file-based route auto-registration (`api/**/*.ps1` filename → HTTP method + path).
    - **Frontend:** server-rendered hypermedia — **htmx** partial swaps, **Mustache**
      (client-side-templates), **Tailwind CSS v4**, `.pode` views (layouts/components/partials).
      No SPA, no bundler, no Node server.
    - **Storage:** **SQLite** via PSSQLite (`Invoke-SqliteQuery`), `./podex.db`. **No data-access
      layer** — SQL is currently inlined per route handler (the spec asks for a small swappable DAL).
    - **Build/QA tooling:** npm + prettier + eslint + `@tailwindcss/cli` (JS side); Pester +
      PSScriptAnalyzer (PowerShell side). Recommended gate: `npm run analyze && npm run test`.
- **Profile classification:** low data-sensitivity (no PII/regulated data), low criticality,
  best-effort availability, local/self-hosted single-instance (HTTP `localhost:8433`, no TLS,
  not containerized), no external integrations.
- **Dominant intake finding:** the repository currently ships the **stock "Podex" framework/CRUD
  demo, not the pantry product**. Product implementation is **~0% of spec**, and even the demo is
  internally inconsistent (a three-layer `items` vs `feature`/`tag` vs `item`/`description`
  data-model split). This divergence gates most downstream planning.

## 2. `.aidd` artifacts created or refreshed during intake

Present and fresh (created/refreshed this intake, per `.artifacts-check.json` + git history):

| Artifact                                       | State     | Notes                                                                         |
| ---------------------------------------------- | --------- | ----------------------------------------------------------------------------- |
| `spec.md`                                      | fresh     | pantry product spec (source of truth)                                         |
| `assertions.md`                                | fresh     | invariants checklist consolidated from review artifacts                       |
| `project-profile.json`                         | fresh     | inferred assurance profile (stack/deploy/auth/criticality)                    |
| `project.md`                                   | fresh     | project overrides (defer to profile + code)                                   |
| `project-structure.md`                         | present   | architecture map (10 days old, within threshold)                              |
| `questions.md`                                 | fresh     | onboarding interview — 46 questions (14 critical / 18 high / 14 nice)         |
| `testing-scenarios.md`                         | fresh     | 14 testing scenarios seeded                                                   |
| `remediation-review.md`, `response-review.md`  | fresh     | triage/review artifacts                                                       |
| `audit-reports/*`                              | fresh     | **31 audit reports** generated 2026-07-10 (incl. CODEBASE_ANALYSIS, SECURITY) |
| `audits/*`                                     | fresh     | ~40 audit methodology/ingredient definitions                                  |
| `features/*`                                   | fresh     | **14 feature.json** records (audit + remediation backlog)                     |
| `reports/feature-coverage-audit-2026-07-10.md` | fresh     | coverage audit (report-only, no auto-fixes)                                   |
| `reports/intake.md`                            | this file | intake summary                                                                |

**Still missing (not created during intake):**

- `CONTEXT.md` — **required, missing.**
- `roadmap.json` — recommended, missing (no scope gate / phase assignment).
- `screen-map.md` — recommended, missing.
- `responses.md` / `responses/` — optional, missing (interview answered by no one; the outgoing
  maintainers' answers to `questions.md` were never captured).

## 3. Feature inventory

**Total feature records: 14.** All are audit-/remediation-sourced bug records — there are **no
capability blueprints** and **no completed product features**.

| Category                                                   | Count  | Status                                                                                        |
| ---------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------- |
| **Implemented** (`completed`, `passes: true`)              | **0**  | none — product is ~0% of spec                                                                 |
| **Waiting approval** (open work parked for human sign-off) | **14** | all `waiting_approval`, `passes: false`                                                       |
| — of which audit findings                                  | 11     | 9 `audit-codebase-analysis-*` + 2 `audit-security-*`                                          |
| — of which **remediation**                                 | 3      | `remediation-20260710-{debug-hotpath-writes, logger-path-traversal, paging-input-validation}` |

**Parked to `waiting_approval` during intake: 14.** Every feature carried `status: "backlog"`;
intake walked all 14 and set each to `"waiting_approval"` (leaving `passes: false` and all other
fields untouched), enforcing the invariant that generated features require explicit human approval
before any agent picks them up. The aidd feature check reports **14 files, all valid, 0 invalid**.

The 9 codebase-analysis findings: SQL-injection tag query, data-model mismatch, unauth debug routes,
pagination total-count, broken add/update wiring, no test coverage, spec-drift (unimplemented),
unsafe-char sanitizer, show-exceptions disclosure. The 2 security findings: missing HTTP security
headers, unconditionally-mounted OpenAPI/Swagger. The 3 remediation: debug hot-path writes, logger
path-traversal, paging input validation.

## 4. Audit findings summary

- **Codebase analysis — overall health `D`.** The repo is the stock Podex demo, not the pantry
  product. **Top-3 critical:** (1) three-layer data-model mismatch → every `/api/crud` request
  500s against a fresh DB (demo non-functional end-to-end); (2) SQL injection via interpolated
  `tagFilter` (`get.ps1:50`); (3) unauthenticated destructive debug endpoints (`/stop`, `/clear`,
  `/init`) enabled by default (`Podex.Debug = $true`). Also: broken pagination totals, broken
  add/update wiring, redundant `Remove-UnsafeCharacter` sanitizer that mangles data,
  `ShowExceptions` stack-trace disclosure, `-save` logger path-traversal, and **0% test coverage**.
- **Security audit — score 72/100.** 0 Critical, 0 High, 1 Medium, 1 Low (most injection/disclosure/
  debug issues already tracked in the backlog, not re-filed). Medium: **no HTTP security headers**
  (no `Set-PodeSecurity` anywhere — no CSP/X-Frame-Options/X-Content-Type-Options/Referrer-Policy).
  Low: **OpenAPI/Swagger mounted unconditionally** (`podex.ps1:105/107` outside the `Podex.Debug`
  gate). Severity is **conditional on deployment surface**: minor on localhost, severe if off-box.
- **Feature-coverage audit — report-only, no safe auto-fixes applied** (the honest outcome).
  All 13 implemented capabilities resolve to **`ambiguous`** (1 additionally `stale-doc`: the README
  documents upstream Podex and links a missing `#features` anchor). No capability can be backfilled
  as an honestly-`completed` feature while the product-intent and salvage-vs-rewrite forks are open.
- **Verification status:** `audit-finding-review` re-verified all 14 findings against live source —
  **all KEEP** (none stale, false-positive, over-engineered, or framework-handled); `feature-review`
  re-verified all 14 specs — no changes.

## 5. Open questions (`.aidd/questions.md`)

An onboarding interview of **46 questions** exists (14 critical / 18 high / 14 nice) and remains
**unanswered** (no `responses.md`). The blocking product-owner decisions:

1. **Framework vs. product:** is v1 the **pantry product built on Podex**, or is **Podex-the-
   framework** the deliverable? Everything downstream depends on this.
2. **Salvage vs. rewrite:** discard the `items`/`feature`/`tag` mess and model the pantry `item`
   fresh, or salvage existing CRUD code? (rewrite vs. repair)
3. **Storage + DAL:** commit to SQLite (vs. JSON file) and build the swappable DAL now?
4. **Deployment surface + safe defaults:** where does it run, and should `Podex.Debug` /
   `ShowExceptions` be **off by default**? (This gates the severity of three security findings.)
5. **Test coverage as a hard gate:** is per-feature Pester coverage a hard v1 "done" gate, given
   current coverage is 0%?

Additional open decisions: canonical item shape (fields), low-stock/expiring magic numbers,
free-text vs. controlled `unit`/`category`, quick-adjust-to-zero behavior, migration story
(wipe-and-reseed vs. preserve), and whether the audit backlog is remediated before, during, or
dropped alongside new feature work.

## 6. Recommended next actions

1. **Resolve the two `[OPEN]` forks first** — product identity (framework vs. pantry) and salvage
   vs. rewrite. These are product-owner decisions; capture answers in `.aidd/responses.md`. Nothing
   else can be safely planned until they are settled.
2. **Answer the 5 top-priority interview questions** (§5) and record deployment surface + intended
   `Podex.Debug`/`ShowExceptions` defaults, since those reclassify three security findings.
3. **Create the missing required/recommended artifacts** once identity is fixed: `CONTEXT.md`
   (required), `roadmap.json` (scope gate + build order), and `screen-map.md`.
4. **Approve or reject the 14 parked features.** They are all `waiting_approval`; no agent will act
   on them until a human signs off. Decide which audit/remediation findings survive the
   salvage-vs-rewrite decision (e.g. the `tag`/SQL-injection finding vanishes if the tag feature is
   dropped).
5. **Establish a git baseline and non-interactive verify path** — split install/setup from
   build/verify in `.build.ps1` so `npm run analyze && npm run test` can gate CI, and revive real
   Pester coverage (currently only `tests/tests.ps1.old`, excluded by the glob → 0%).
6. **After forks are decided:** re-run `feature-coverage-audit --apply` to backfill honestly-
   completed primitives, then implement the pantry spec in the suggested order (data model + DAL →
   item CRUD + inventory list → filter/search → low-stock → expiring-soon → quick-adjust → CSV
   export → seed script), with tests alongside each.
