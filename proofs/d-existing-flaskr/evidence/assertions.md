# Assertions — flaskr

_Consolidated 2026-07-03. A deduplicated checklist of the claims, assumptions, and
conclusions established across the intake artifacts: `.aidd/questions.md`,
`.aidd/responses/response1.md`, `.aidd/response-review.md`,
`.aidd/audit-reports/CODEBASE_ANALYSIS-2026-07-03.md`, `.aidd/remediation-review.md`, and the
two `.aidd/features/remediation-*` specs._

Each item is a standalone invariant or finding. Legend:

- **[verified]** — confirmed firsthand against live source in at least one artifact.
- **[open]** — an unanswered question or undecided fork; needs product-owner input.
- **[drift]** — a known inconsistency between artifacts, noted so it is not mistaken for a
  new claim.

---

## 1. Identity & provenance (verified)

- [x] **[verified]** `flaskr` is the canonical Pallets Flask tutorial blog, imported verbatim
  from `pallets/flask` `examples/tutorial` (import commit `1440aa6`).
- [x] **[verified]** Application and test source are **unchanged since the import**; the only
  post-import commits are AIDD docs/metadata (`docs(aidd)` commits).
- [x] **[verified]** The stack is **Python + Flask**, SQLite persistence, server-rendered
  Jinja2 templates — not a TypeScript/Bun ("spernakit") app.
- [x] **[verified]** A prior analysis's failing JS/spernakit quality gate (`package.json`,
  `bun run smoke:qc`, ESLint, Prettier, empty `frontend/`) was **untracked scaffolding and has
  been removed** from the working tree. There is now no red JS gate — and no green one.

## 2. Architecture (verified)

- [x] **[verified]** Uses the Flask **application-factory** pattern: `create_app` in
  `flaskr/__init__.py`, with deferred imports inside the factory (no circular imports).
- [x] **[verified]** Two blueprints: `auth` (`flaskr/auth.py` — register/login/logout,
  `login_required`, `load_logged_in_user`) and `blog` (`flaskr/blog.py` — index + post CRUD,
  mounted at `/`).
- [x] **[verified]** Persistence is a single-file **SQLite** DB in the instance folder via
  `flaskr/db.py`: one `sqlite3.Connection` per request cached on `flask.g`, torn down via
  `teardown_appcontext`. Schema (`flaskr/schema.sql`) has exactly two tables: `user` and `post`.
- [x] **[verified]** DB lifecycle is a manual `init-db` CLI over a destructive `schema.sql`
  re-init; **no migration framework** (e.g. Alembic) is present.
- [x] **[verified]** Authorization model: `login_required` guards all mutations;
  `get_post(check_author=True)` (`blog.py:28`) enforces author-ownership (`abort(403)`) and
  existence (`abort(404)`). Effective rule today: **any logged-in user can post; only the
  author can edit/delete.**
- [x] **[verified]** No Python type hints anywhere; no `mypy`/typed checking. No service/query
  layer — SQL is inline in views.
- [x] **[verified]** A `/hello` diagnostic route (`flaskr/__init__.py:26`) ships in the factory
  (debug surface).

## 3. Security (verified findings)

- [x] **[verified]** **S1 — Hardcoded `SECRET_KEY="dev"`** at `flaskr/__init__.py:11` is the
  session-cookie signing key. The instance override (`from_pyfile(..., silent=True)`, line 18)
  is **silent and absent** — no `instance/config.py` exists — so sessions are forgeable and auth
  can be bypassed by cookie tampering. Rated **Critical** in the codebase analysis and the
  feature. **[drift]** `.aidd/CHANGELOG.md` and `.aidd/response-review.md` describe S1 as
  **High**; the report/feature (Critical) is authoritative.
- [x] **[verified]** **S2 — No CSRF protection** on any state-changing form. A repo-wide search
  for `csrf` / `csrf_token` / `CSRFProtect` returns **zero** hits in any `.py` or `.html`. All
  **five** mutating POST endpoints are unprotected: register, login, create, update, delete.
  Rated **High**.
- [x] **[verified]** **S3 — Session cookie not hardened**: no `SESSION_COOKIE_SECURE`, no
  `SESSION_COOKIE_SAMESITE`. Medium.
- [x] **[verified]** **S4 — No rate limiting / lockout** on `login` or `register` →
  credential brute-force exposure. Medium.
- [x] **[verified]** **S5 — No security headers** (CSP, X-Frame-Options,
  X-Content-Type-Options, HSTS). Low.
- [x] **[verified]** **S6 — `/hello` debug endpoint** exposed in the production factory. Low.
- [x] **[verified]** **S7 — Verbose 404 body** leaks the post id (`f"Post id {id} doesn't
  exist."`, `blog.py:52`). Info.

### Security controls done right (do not regress) — verified

- [x] **[verified]** **No SQL injection:** all queries use `?` placeholders with parameter
  tuples; no string interpolation into SQL.
- [x] **[verified]** **No XSS:** Jinja2 autoescaping is on for `.html`; all user data is
  rendered through it.
- [x] **[verified]** **Password storage** uses werkzeug `generate_password_hash` /
  `check_password_hash` (salted, modern KDF); plaintext is never stored.
- [x] **[verified]** **Session fixation** mitigated: `session.clear()` before setting
  `user_id` on login (`auth.py:103`).
- [x] **[verified]** **Broken-access-control coverage:** ownership + existence checks have
  dedicated tests (`test_author_required`, `test_exists_required`).

## 4. Performance (verified)

- [x] **[verified]** Queries are single-statement, parameterized, and use a `post ⋈ user`
  join — **no N+1**.
- [x] **[verified]** **No pagination** on the index (`blog.py:16`): `SELECT ... ORDER BY
  created DESC` returns all posts (unbounded).
- [x] **[verified]** **Missing indexes:** `post.author_id` (FK) and `post.created` (the
  `ORDER BY` key) are unindexed → SQLite table-scan + filesort. Candidates: `idx_post_created`,
  `idx_post_author_id`.
- [x] **[verified]** The one-connection-per-request strategy is correct and cheap for SQLite;
  no pooling needed.

## 5. Testing & quality gates (verified)

- [x] **[verified]** The Python test suite is the canonical tutorial suite and is thorough for
  scope (`test_factory`, `test_db`, `test_auth`, `test_blog`), with per-test temp-SQLite
  isolation seeded from `data.sql`.
- [x] **[verified]** The suite **runs green: `24 passed`** (executed this session via `.venv`).
- [x] **[verified]** `tests/conftest.py` constructs the app via
  `create_app({"TESTING": True, "DATABASE": db_path})` and supplies **no `SECRET_KEY`** — so
  the suite currently runs on the default `"dev"` key. (Corrects the earlier assumption that a
  `test_config` branch supplies its own key.)
- [x] **[verified]** `tests/test_factory.py::test_config()` calls **bare `create_app()`** with
  no config — a fail-fast secret-key guard must exempt/handle this or it will start raising.
- [x] **[verified]** **No enforced Python gate:** `pyproject.toml` declares `[tool.ruff]` and
  `[tool.coverage.run] branch = true`, but `ruff` and `coverage`/`pytest-cov` are **not
  installed** and never invoked; there is no CI workflow, no `mypy`, no lockfile. Branch
  coverage is configured but not measured.
- [x] **[verified]** `pyproject.toml` pins only `flask` (unbounded) and has **no lockfile** →
  non-reproducible installs and no vuln-scan surface.
- [x] **[verified]** No JS tests exist and none should be added (no JS app).

## 6. AIDD metadata health (verified)

- [x] **[verified]** `.aidd/project-structure.md` is still the raw `{placeholder}` template.
- [x] **[verified]** As of the intake, `.aidd/spec.md`, `.aidd/responses.md`,
  `.aidd/roadmap.json`, and `.aidd/project-profile.json` **do not exist**. _(This file,
  `.aidd/assertions.md`, is created by the present directive.)_
- [x] **[verified]** `.aidd/project.md` directs that "all architecture, tech stack, style, and
  tooling should be spernakit-like unless otherwise necessary and user approved."

## 7. Interview status (verified conclusions)

- [x] **[verified]** `.aidd/questions.md` holds **10 well-formed interview questions** grounded
  in verified source, each targeting intent not derivable from code.
- [x] **[verified]** The interview is **effectively unanswered**: the only artifact in
  `.aidd/responses/` (`response1.md`) is a **process diagnostic**, not an answer to any of
  Q1–Q10. It records that an iteration was handed the answer template before `questions.md`
  existed, and correctly recovered by generating `questions.md`.
- [x] **[verified]** No answer should be fabricated to unblock the loop; downstream artifacts
  (spec/roadmap/structure) should not be populated until at least the blocker questions are
  answered by the product owner.

## 8. Remediation features (verified conclusions)

- [x] **[verified]** Two `backlog` security remediation features exist and are **well-grounded,
  correctly scoped, non-duplicate, and safe to keep**:
  - `remediation-20260703-secret-key-hardcoded` — Priority 1, enforce a non-default
    `SECRET_KEY` (maps to S1).
  - `remediation-20260703-missing-csrf-protection` — Priority 2, add CSRF protection to all
    state-changing forms (maps to S2).
- [x] **[verified]** Priority ordering matches severity (P1 secret-key = S1; P2 CSRF = S2).
- [x] **[verified]** Both features modify `flaskr/__init__.py` (one adds the `SECRET_KEY`
  fail-fast, the other registers `CSRFProtect(app)`). `dependencies: []` on both is correct
  (neither blocks the other), but if implemented together they should land as **one coherent
  edit to `create_app`** to avoid a self-inflicted merge collision.
- [x] **[verified]** The secret-key fail-fast guard must key on **test mode**
  (`test_config is not None` / `TESTING`), **not** on `SECRET_KEY != "dev"`, or the existing
  suite breaks (see §5). Spec point 4 was corrected to reflect this; spec point 5 requires
  updating `test_factory.py`'s bare `create_app()` call.
- [x] **[verified]** Correct **exclusions** from the remediation backlog: rate-limiting (a Q6
  posture topic, not a claim) and password reset (a missing feature, not a defect).
- [x] **[verified]** The features' evidentiary weight rests on the **codebase analysis +
  firsthand verification**, not on any answered interview question (their nominal source,
  `response1.md`, is a diagnostic).

## 9. Open decisions & assumptions (not settled)

- [ ] **[open] Q2 — stack fork (load-bearing blocker).** `.aidd/project.md` mandates a
  "spernakit-like" TS/Bun stack while the app is Python/Flask. This is a **fork-in-the-road**
  requiring product-owner approval, not agent judgment. It gates Q3 (hosting) and Q8 (UI).
  **Both remediation specs are written against current Flask paths and must be rewritten — not
  just re-pathed — if Q2 resolves to "port."** Hold both features at `backlog` until answered.
- [ ] **[open] Q1 — learning artifact vs. product base** (tutorial fidelity vs. extensibility).
- [ ] **[open] Q3 — target stack & hosting** (Python version, WSGI/ASGI server, deployment
  target; or Bun framework + datastore if migrating).
- [ ] **[open] Q4 — data-model roadmap** (comments, tags/categories, drafts/publish state,
  edit history, soft-delete, roles/profiles; and what is out of scope).
- [ ] **[open] Q5 — persistence** (stay on SQLite vs. Postgres; adopt managed migrations vs.
  destructive `schema.sql` re-init).
- [ ] **[open] Q6 — security posture** (which of CSRF, rate-limiting, email verification,
  password reset are required; how `SECRET_KEY`/instance config is provisioned in production).
- [ ] **[open] Q7 — authorization rules** (whether admins/moderators, per-post visibility, or
  read restrictions are wanted beyond the current author-only model).
- [ ] **[open] Q8 — UI/frontend expectations** (keep server-rendered Jinja vs. richer
  SPA/design system; reinforces Q2 if spernakit-like UI is expected).
- [ ] **[open] Q9 — quality gates** (target coverage %, lint/type/CI bar, definition of done).
- [ ] **[open] Q10 — non-negotiable constraints / deadlines** (compliance, offline operation,
  dependencies to avoid, performance targets).
- [ ] **[open/assumption]** The "pure Flask, not spernakit" reading is a *reasonable
  otherwise-necessary case* per `project.md`, but it is **not yet user-approved** — it should be
  recorded explicitly once decided so future ingredients don't re-scaffold JS tooling.

---

_Note on drift:_ the only known inter-artifact inconsistency is the **S1 severity label**
(§3) — **Critical** in `CODEBASE_ANALYSIS-2026-07-03.md` and the feature note, vs. **High** in
`.aidd/CHANGELOG.md` and `.aidd/response-review.md`. Treat **Critical** as authoritative and
reconcile the prose docs.
