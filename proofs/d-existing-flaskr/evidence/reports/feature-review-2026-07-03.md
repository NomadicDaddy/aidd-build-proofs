# Feature Review Report

**Project**: flaskr (canonical Pallets/Flask tutorial blog)
**Stack**: Python 3 + Flask (application factory + blueprints) + Jinja2 + SQLite (`sqlite3`); pytest for tests. Packaged with flit (`pyproject.toml`). **Not** a TS/Bun/spernakit stack despite `.aidd/project.md`'s "spernakit-like" preference — the Flask-vs-port fork (interview **Q2**) is unresolved and gates any re-targeting.
**Features reviewed**: 2 backlog / 6 total (4 completed coverage records, 0 template features)
**Issues found**: 0 new (0 conflicts, 0 contradictions, 0 vague, 0 duplications, 0 minor requiring auto-fix)

## Phase 1 — Inventory

| ID | Status | passes | Priority | Reviewed |
|----|--------|--------|----------|----------|
| `remediation-20260703-secret-key-hardcoded` | backlog | false | 1 | ✅ analyzed |
| `remediation-20260703-missing-csrf-protection` | backlog | false | 2 | ✅ analyzed |
| `app-factory-and-configuration` | completed | true | 3 | dependency graph only |
| `user-authentication` | completed | true | 3 | dependency graph only |
| `blog-post-management` | completed | true | 3 | dependency graph only |
| `database-and-init-db-cli` | completed | true | 3 | dependency graph only |

- Template features (`spernakit_version` present): **0** — none skipped on that basis.
- Invalid JSON: **0**.
- All 6 feature IDs resolve in the dependency graph; declared dependencies (`user-authentication`, `database-and-init-db-cli`) exist. No cycles.

## Phase 2 — Conventions learned

- **Architecture**: application factory `create_app(test_config=None)` in `flaskr/__init__.py`; two blueprints (`auth` at `/auth`, `blog` at `/`); data layer `flaskr/db.py` (request-scoped `sqlite3` connection on `flask.g`, `init-db` Click command). No controller layer — routes call the DB directly (view-function pattern, not the TS routes→services split).
- **Templates**: Jinja2 under `flaskr/templates/{auth,blog}/`. Five state-changing POST forms: `auth/register.html`, `auth/login.html`, `blog/create.html`, `blog/update.html` (edit form **and** a second delete form).
- **Tests**: pytest (`tests/`), `conftest.py` builds the app via `create_app({"TESTING": True, "DATABASE": db_path})` — **supplies no `SECRET_KEY`**. `tests/test_factory.py::test_config` calls bare `create_app()` in non-test mode. Suite = 24 passed (per prior session).
- **Dependencies**: `pyproject.toml` declares only `flask` (test extra: `pytest`). No CSRF library installed yet — the CSRF remediation implies adding one (e.g. Flask-WTF).
- **Prior remediation review**: `.aidd/remediation-review.md` loaded in full. Its one blocking item and its two alignment recommendations were checked against current state (see Phase 3g).

### Firsthand verification of the two specs' claims

| Claim | Result |
|-------|--------|
| `SECRET_KEY="dev"` hardcoded at `flaskr/__init__.py:11` | **Confirmed** (in the `from_mapping` default) |
| No `instance/config.py` (silent+absent override) | **Confirmed** — file absent; `from_pyfile("config.py", silent=True)` |
| Zero CSRF anywhere | **Confirmed** — `grep -riE 'csrf|CSRFProtect|flask_wtf'` over `flaskr/` + `tests/` returns nothing |
| All 5 POST forms unprotected | **Confirmed** — every `<form method="post">` renders no token |
| `conftest.py` passes no `SECRET_KEY` | **Confirmed** (`tests/conftest.py:21`) |
| `test_factory.py` calls bare `create_app()` in non-test mode | **Confirmed** |

## Phase 3 / 4 — Per-feature & cross-feature analysis

Both backlog features passed every check (3a structural validity, 3b spec quality, 3c codebase alignment, 3d dependency integrity, 3e duplication, 3f cathedral/integration, 3g remediation-review cross-check):

### `remediation-20260703-secret-key-hardcoded` (P1)
- Structure valid; ID matches `remediation-{YYYYMMDD}-{slug}`; ISO-8601 timestamps; `dependencies: []` correct (independent of CSRF).
- Spec is a numbered, artifact-grounded `Verify …` checklist. **Spec points 4 & 5 already encode the remediation-review's one blocking fix** — the fail-fast guard keys on **test mode** (`test_config is not None` / `TESTING`), not on `SECRET_KEY != "dev"`, and point 5 flags that `test_factory.py::test_config`'s bare `create_app()` must be updated alongside the guard. This was applied by the prior feature-review run (commit `2a5f920`); re-verified accurate today. No further fix required.
- Not a duplicate; not a cathedral (factory hardening, no user-facing surface).

### `remediation-20260703-missing-csrf-protection` (P2)
- Structure valid; ID format correct; `dependencies: []` correct.
- Spec names all five mutating routes and every template (including the delete form in `update.html`), requires server-side token validation and a rejected-without-token test. All referenced paths exist. `affectedFiles` already lists **both** `tests/test_auth.py` and `tests/test_blog.py`, matching the spec's "and/or" (remediation-review recommendation 2 already satisfied).
- Not a duplicate; not a cathedral.

### Cross-feature
- **No** route/file/field/schema conflicts. Both features edit `flaskr/__init__.py` (one adds the `SECRET_KEY` fail-fast, the other registers CSRF) — a **shared edit point, not a conflict**; land them together to avoid a self-inflicted merge collision. `dependencies: []` on both is correct — neither blocks the other.

## Remediation-review findings (status)

- **Blocking — secret-key spec point 4 wrong about tests**: **RESOLVED** (spec points 4 & 5 now key on test mode; verified against `conftest.py`).
- **Minor — `instance/config.py` in `affectedFiles` may be untouched** if the env-var path is chosen: report-only. Spec point 2 explicitly allows "instance config **or** an environment variable," so listing the file as a possible touch-point is acceptable; left as-is to avoid churn.
- **Minor — CSRF `affectedFiles` vs spec**: **RESOLVED** (both test files listed).
- **Cosmetic — S1 severity drift (Critical vs High) across docs**: not a feature.json defect; out of scope for this ingredient (feature notes correctly say Critical).
- **Product gate — hold both at `backlog` pending Q2**: honored. Neither promoted.

## Cathedral risks

None. Both features are security hardening of existing endpoints/factory, not new backend surfaces needing a UI path.

## Codebase duplication

None. Both controls are net-new; neither `CSRFProtect` nor a non-default-secret guard exists in the code.

---

## Re-verification (2026-07-03, re-run)

Re-executed as a fresh `feature-review` invocation. Both backlog feature.json files are
byte-for-byte unchanged since the prior run and were re-checked firsthand against live code:

- `flaskr/__init__.py:11` still hardcodes `SECRET_KEY="dev"`; `instance/config.py` still absent;
  `from_pyfile(..., silent=True)` at line 18 confirmed.
- Repo-wide `csrf` / `csrf_token` / `CSRFProtect` search: still **zero** hits in `flaskr/` and
  `tests/`; all five POST forms (register, login, create, update, delete) remain unprotected.
- `tests/conftest.py:21` still supplies no `SECRET_KEY`; `tests/test_factory.py::test_config`
  still calls bare `create_app()` — so secret-key spec points 4/5 (guard keyed on test mode)
  remain correct, and the CSRF `affectedFiles` still lists both `test_auth.py` and `test_blog.py`.

**Outcome: 0 new issues, 0 auto-fixes, no feature.json modified.** Prior conclusions stand.
