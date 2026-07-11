# Feature Coverage Audit — Pantry

_Generated: 2026-07-10 (mode: `--apply`)_
_Ingredient: `feature-coverage-audit` — verify every implemented capability has natural
documentation and complete `.aidd/features/*/feature.json` coverage._

## Executive summary

**No safe auto-fixes were applied.** This is the correct, honest outcome for the current repo
state, not a skipped run.

The repository ships the **stock "Podex" framework/CRUD demo**, not the pantry tracker that
`.aidd/spec.md` describes. Per the re-verified invariants in `.aidd/assertions.md`, product
implementation is at **~0% of spec**, the CRUD demo is **non-functional end-to-end** (data-model
mismatch → HTTP 500 against a freshly initialized DB; Add-Item wiring broken; Update always 400s),
and the project sits under two explicit `[OPEN]` fork-in-the-road blockers with **no defensible
default**:

1. Is v1 the **pantry product built on Podex**, or is **Podex-the-framework** the deliverable?
2. **Salvage vs. rewrite** the existing `feature`/`tag` CRUD code?

The Safe Auto-Fix Policy permits creating a feature JSON only when the record can be marked
`status: completed` / `passes: true` **honestly**, the **feature boundary is clear**, and **no
product decision is needed**. Every implemented capability fails at least one of those gates: it is
either (a) demonstrably broken (cannot claim `passes: true`), or (b) under the unresolved
framework-vs-product / salvage-vs-rewrite fork (boundary and product intent unresolved). Backfilling
"completed" records here would be dishonest and would violate the ingredient's own "never auto-fix
ambiguous boundaries / missing product intent / code-vs-doc contradictions" rule.

The existing 12 `feature.json` files are **audit/remediation bug records** (`category: "Audit"` or
`remediation-*`), all `status: "backlog"`, `passes: false`. They are _not_ capability blueprints,
and they already document the defects in the implemented demo. They are left untouched.

## 1. Coverage summary counts by disposition

| Disposition        | Count |
| ------------------ | ----- |
| `covered`          | 0     |
| `doc-gap`          | 0     |
| `feature-json-gap` | 0     |
| `spec-gap`         | 0     |
| `stale-doc`        | 1     |
| `ambiguous`        | 13    |

All 13 implemented capabilities resolve to `ambiguous` because of the unresolved
framework-vs-product / salvage-vs-rewrite fork; the single `stale-doc` overlaps (README describes a
generic framework whose demo does not currently function and whose relationship to the pantry spec
is unresolved).

## 2. Coverage matrix

| #   | Capability                                    | Implementation Evidence                                                  | Natural Docs                         | Feature JSON                                                                                                                                                                | Spec Completeness              | Confidence | Disposition                                                                                                                                                           |
| --- | --------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Pode server bootstrap + config load           | `podex.ps1:47-67`, `server.psd1`                                         | README Technical Stack / Running     | none (blueprint); `show-exceptions-disclosure`, `unauth-debug-routes` flag config defaults                                                                                  | thin                           | high       | ambiguous                                                                                                                                                             |
| 2   | Filename→HTTP-method route auto-registration  | `podex.ps1:81-94`                                                        | `.aidd/assertions.md` §3 (fact) only | none                                                                                                                                                                        | none                           | high       | ambiguous                                                                                                                                                             |
| 3   | Static asset serving (`/public`)              | `podex.ps1:70`, `public/**`                                              | README (implicit)                    | none                                                                                                                                                                        | none                           | high       | ambiguous                                                                                                                                                             |
| 4   | Home / About page                             | `podex.ps1:73`, `views/components/about.pode`, `layouts/main.pode`       | none                                 | none                                                                                                                                                                        | none                           | medium     | ambiguous                                                                                                                                                             |
| 5   | CRUD Manager demo page (client-side Mustache) | `podex.ps1:74`, `views/components/crudmgr.pode`, `public/js/mustache.js` | `assertions.md` §3 (fact)            | `spec-drift-unimplemented`, `data-model-mismatch` (as defects)                                                                                                              | n/a — **broken**               | high       | ambiguous                                                                                                                                                             |
| 6   | CRUD API (get/post/put/delete)                | `api/crud/*.ps1`                                                         | none                                 | `data-model-mismatch`, `broken-add-and-update-wiring`, `pagination-total-count`, `paging-input-validation`, `debug-hotpath-writes`, `sql-injection-tag-query` (all defects) | n/a — **non-functional (500)** | high       | ambiguous                                                                                                                                                             |
| 7   | Add-item modal                                | `podex.ps1:78`, `views/components/crudmgr-new.pode`                      | none                                 | `broken-add-and-update-wiring` (defect)                                                                                                                                     | n/a — **broken wiring**        | high       | ambiguous                                                                                                                                                             |
| 8   | Debug routes (`/stop`, `/clear`, `/init`)     | `podex.ps1:87-93`, `api/debug/*.ps1`                                     | none                                 | `unauth-debug-routes` (defect)                                                                                                                                              | n/a — security defect          | high       | ambiguous                                                                                                                                                             |
| 9   | Pagination + tag filter + search              | `api/crud/get.ps1:13-63`                                                 | none                                 | `pagination-total-count`, `sql-injection-tag-query`, `paging-input-validation` (defects)                                                                                    | n/a — **buggy**                | high       | ambiguous                                                                                                                                                             |
| 10  | Logging helper + request/error logging        | `podex.ps1:4-34,55-60`                                                   | none                                 | `logger-path-traversal`, `debug-hotpath-writes` (defects)                                                                                                                   | n/a                            | high       | ambiguous                                                                                                                                                             |
| 11  | OpenAPI / Swagger docs (`/docs/*`)            | `podex.ps1:104-107`                                                      | none                                 | none                                                                                                                                                                        | none                           | high       | ambiguous                                                                                                                                                             |
| 12  | Error pages (404 / default)                   | `errors/404.html.pode`, `errors/default.html.pode`                       | none                                 | `show-exceptions-disclosure` (config defect)                                                                                                                                | none                           | high       | ambiguous                                                                                                                                                             |
| 13  | `/htmx/hello` demo route                      | `podex.ps1:77`, `htmx/hello.ps1`                                         | none                                 | none                                                                                                                                                                        | none                           | medium     | ambiguous                                                                                                                                                             |
| —   | README describes a generic Podex framework    | `README.md`                                                              | `README.md`                          | —                                                                                                                                                                           | —                              | high       | **stale-doc** (TOC links a missing `#features` section; describes framework whose demo is currently non-functional and whose scope vs. the pantry spec is unresolved) |

## 3. Auto-fixes applied

**None.** No `feature.json` files created or modified; no natural-doc edits. Rationale in the
executive summary. Only reporting artifacts were written (this report + `.aidd/CHANGELOG.md`).

## 4. Remaining gaps requiring approval

These cannot be resolved without a product-owner decision on the two `[OPEN]` forks:

- **Product-intent fork** — framework-as-deliverable vs. pantry-product-on-framework. Until settled,
  none of capabilities 1–13 can be classified as an in-scope, honestly-`completed` feature.
- **Salvage vs. rewrite** — determines whether the `feature`/`tag` CRUD code (capabilities 5–9)
  becomes real feature JSONs or is deleted. Do not backfill blueprints for code slated for removal.
- **Feature-JSON coverage model** — should genuinely-implemented framework primitives (routing
  convention, static serving, OpenAPI docs, error pages, logging) get "completed" feature JSONs at
  all, or are they scaffolding excluded from the pantry backlog? Needs an explicit decision.
- **README** — the `#features` TOC anchor targets a section that does not exist, and the README
  documents upstream Podex rather than this project. Left unchanged: fixing it means either creating
  a new section (disallowed by the safe-doc policy) or rewriting for a product identity that is not
  yet decided.

## 5. Ambiguous feature boundaries

All 13 capabilities (matrix rows 1–13). Root cause is shared: the framework-vs-product and
salvage-vs-rewrite forks flagged `[OPEN]` in `.aidd/assertions.md` §1–3, which the session's
blocking-ambiguity constraint reserves for product-owner approval.

## 6. Validator result

`--check-features` was **not run**: no feature metadata changed, and the ingredient specifies not to
run it in that case unless validation was explicitly requested. `roadmap:apply` was **not run**: no
`.aidd/roadmap.json` exists and no new feature IDs were created.

## 7. Recommended follow-up

1. **Resolve the two `[OPEN]` forks first** (product identity; salvage vs. rewrite) — see
   `.aidd/questions.md` / `.aidd/assertions.md` §1–3. Everything else is blocked on these.
2. After the forks are decided, re-run **`feature-coverage-audit --apply`**; with product intent
   fixed, genuinely-implemented, functional primitives can then be backfilled honestly.
3. Run **`feature-review`** on the existing 12 audit/remediation records for spec quality.
4. Once real pantry capabilities ship and pass, run **`document-changes`** to produce release
   documentation and fill the empty `.aidd/project-structure.md` / `screen-map.md` templates.
