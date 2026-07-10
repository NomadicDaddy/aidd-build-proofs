# Feature Coverage Audit — flaskr

_Date: 2026-07-03 · Mode: `--apply` (safe auto-fix) · Target: `<WORKSPACE>/flaskr`_

The `flaskr` project is the canonical Pallets Flask tutorial blog (Python + Flask + Jinja2 +
SQLite), unchanged since import. Before this audit, the only `.aidd/features/*` records were **two
backlog security remediations**; **none of the actually implemented, shipped, and tested
capabilities had feature-JSON coverage.** This audit backfilled that coverage.

## 1. Coverage summary (by disposition)

| Disposition        | Count | Notes                                                                 |
| ------------------ | ----: | --------------------------------------------------------------------- |
| `covered`          |     4 | After auto-fix — the 4 backfilled implemented capabilities.           |
| `feature-json-gap` |     0 | Was 4 before this run; all resolved by backfill.                      |
| `doc-gap`          |     4 | Natural docs (README) are thin; not auto-fixed (see §3).              |
| `spec-gap`         |     0 |                                                                       |
| `stale-doc`        |     0 |                                                                       |
| `ambiguous`        |     1 | `/hello` debug route — deliberately not promoted to a feature (§4).   |

The 2 pre-existing `backlog` remediation features are **not** implemented capabilities (they track
*future* security fixes), so they are excluded from the implemented-capability matrix below; they
were left untouched and remain correctly at `backlog`.

## 2. Coverage matrix (implemented capabilities)

| Capability | Implementation Evidence | Natural Docs | Feature JSON | Spec Completeness | Confidence | Disposition |
| ---------- | ----------------------- | ------------ | ------------ | ----------------- | ---------- | ----------- |
| App factory, config & blueprint wiring | `flaskr/__init__.py` (`create_app`, instance config, `db.init_app`, blueprint registration, `/` → `index`, `/hello`) | assertions.md §2; README run section | `app-factory-and-configuration` (created) | Complete | high | covered |
| User registration / login / logout / session auth | `flaskr/auth.py` (`register`, `login`, `logout`, `login_required`, `load_logged_in_user`), `templates/auth/*.html` | assertions.md §2–3 | `user-authentication` (created) | Complete | high | covered |
| Blog post listing & author-scoped CRUD | `flaskr/blog.py` (`index`, `create`, `update`, `delete`, `get_post`), `templates/blog/*.html` | assertions.md §2 | `blog-post-management` (created) | Complete | high | covered |
| SQLite data layer & `init-db` CLI | `flaskr/db.py` (`get_db`, `close_db`, `init_db`, `init-db` command), `flaskr/schema.sql` | assertions.md §2 | `database-and-init-db-cli` (created) | Complete | high | covered |

Grouping rationale: capabilities are grouped at blueprint / subsystem granularity (the tutorial's
natural units). Register/login/logout are one end-to-end auth path; index + create/update/delete +
`get_post` authorization are one CRUD path. This matches how each can be independently
reconstructed from its spec.

## 3. Auto-fixes applied

Four backfilled coverage feature JSONs (`status: completed`, `passes: true` — honest: `pytest` =
**24 passed** this session):

- `.aidd/features/app-factory-and-configuration/feature.json`
- `.aidd/features/user-authentication/feature.json`
- `.aidd/features/blog-post-management/feature.json`
- `.aidd/features/database-and-init-db-cli/feature.json`

Each spec is written as concrete `Verify …` statements against existing artifacts, with
`affectedFiles` and cross-feature `dependencies` (auth → db; blog → auth + db). Each carries a
`notes` line recording the backfill provenance and pointing at the relevant known findings
(S1/S2/S6/S7, perf) so the coverage record is not mistaken for a hardened-state spec.

No natural-documentation edits were made. README.rst has no Features/Current-Capabilities section,
so appending a capability bullet would require **creating a new section** — outside the safe
auto-fix policy (no new broad docs, no large rewrites). Left as a reported `doc-gap`.

## 4. Remaining gaps requiring approval

- **doc-gap (all 4 capabilities):** There is no maintained human-facing "Features / Current
  Capabilities" overview. `README.rst` is install/run/test only; `.aidd/assertions.md` §2 describes
  behavior well but is an intake/audit artifact, not product docs. **Recommended:** add a short
  Features section to `README.rst` (or a `docs/` overview) — a product/doc decision, not an
  automatic edit.

## 5. Ambiguous feature boundaries

- **`GET /hello` diagnostic route** (`flaskr/__init__.py:26`): implemented and reachable, but it is
  a debug surface flagged as security finding **S6** (should likely be removed, not documented as a
  feature). Deliberately **not** promoted to its own feature JSON; instead noted within the
  `app-factory-and-configuration` record. Promoting or removing it is a product decision.

## 6. Validator result

- `bun run start -- --project-dir <target> --check-features` → **Total 6, Valid 6, Invalid 0.**
- `roadmap:apply` **not run** — `.aidd/roadmap.json` does not exist (no milestone to assign to).

## 7. Recommended follow-up

- `feature-review` — spec-quality pass over the 4 new backfilled features.
- `document-changes` — if the maintainer wants the README Features section (the remaining doc-gap).
- Product decision on **Q2 stack fork** (`.aidd/assertions.md` §9) still gates whether these Flask
  coverage records should later be re-targeted to a port.

---

### Files changed by this run

- `.aidd/features/app-factory-and-configuration/feature.json` (new)
- `.aidd/features/user-authentication/feature.json` (new)
- `.aidd/features/blog-post-management/feature.json` (new)
- `.aidd/features/database-and-init-db-cli/feature.json` (new)
- `.aidd/reports/feature-coverage-audit-2026-07-03.md` (this report)
- `.aidd/CHANGELOG.md` (entry)

No application source, tests, config, or the two pre-existing remediation features were modified.
