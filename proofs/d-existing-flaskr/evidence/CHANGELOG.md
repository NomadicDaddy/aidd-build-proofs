# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security

- **Add HTTP security response headers (2026-07-03):** Completed audit feature
  `audit-security-1783061475-add-http-security-response-headers-csp-x-frame-options-x-content-type-options-re`
  (assertions.md §3 S5, Low). Every response — the rendered blog and auth pages included — previously
  shipped with no security headers, leaving clickjacking, MIME sniffing, and referrer leakage
  unmitigated.
  - `flaskr/__init__.py`: registered an `@app.after_request(add_security_headers)` handler that sets
    `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, and
    `Content-Security-Policy: default-src 'self'` on every response (via `setdefault`, so a view can
    still override). `Strict-Transport-Security: max-age=31536000; includeSubDomains` is gated to
    `request.is_secure` so it is not emitted over the plaintext dev server or test client.
  - `tests/test_factory.py`: added `test_security_headers_present`, asserting the four baseline
    headers on `GET '/'` and that HSTS is absent on the non-secure test request.
  - `.aidd/features/app-factory-and-configuration/feature.json`: added spec point 6 requiring the
    after_request security-header handler (with HSTS gated to secure requests), so a feature-based
    rebuild won't reintroduce the finding.
  - Verified: `ruff check flaskr tests` clean; full `pytest` suite green (36 passed).

- **Harden the Flask session cookie (2026-07-03):** Completed audit feature
  `audit-security-1783061475-harden-the-flask-session-cookie-session-cookie-secure-samesite-httponly`
  (assertions.md §3 S3, Medium). `create_app` previously set only `SECRET_KEY` and `DATABASE`, so
  the signed session cookie shipped with `SECURE` unset (sent over plaintext HTTP) and `SAMESITE`
  unset (default None), widening exposure to session interception and cross-site cookie replay.
  - `flaskr/__init__.py`: extended `app.config.from_mapping(...)` to set
    `SESSION_COOKIE_HTTPONLY=True`, `SESSION_COOKIE_SAMESITE="Lax"`, and `SESSION_COOKIE_SECURE=False`.
    SECURE defaults False so the dev server and the pytest suite keep working over plaintext HTTP; it
    is overridable to `True` via `instance/config.py` for production HTTPS deployments.
  - `tests/test_factory.py`: added `test_session_cookie_hardening`, asserting the three flag values
    after `create_app()` and that `SESSION_COOKIE_SECURE` is overridable to True via config.
  - `.aidd/features/app-factory-and-configuration/feature.json`: hardened spec point 1 to require the
    cookie-hardening flags, so a feature-based rebuild won't reintroduce the finding.
  - Verified: `ruff check flaskr tests` clean; full `pytest` suite green (35 passed).

- **Remove the post id from the 404 error body in `get_post` (2026-07-03):** Completed audit
  feature `audit-security-1783061475-remove-post-id-from-the-404-error-body-in-get-post`
  (assertions.md §3 S7, Info/Low). `flaskr/blog.py` previously called
  `abort(404, f"Post id {id} doesn't exist.")`, reflecting the user-controlled id back into the
  error response body.
  - `flaskr/blog.py`: replaced the interpolated abort with a generic `abort(404)`.
  - `tests/test_blog.py::test_exists_required` asserts only `status_code == 404` (no body/id
    assertion), so it continues to pass unchanged.
  - `.aidd/features/blog-post-management/feature.json`: hardened spec point 6 to require a generic
    404 abort and forbid interpolating the id, so a feature-based rebuild won't reintroduce the leak.
  - Verified: `ruff check flaskr tests` clean; full `pytest` suite green (34 passed).

- **Remove the `/hello` debug route from the application factory (2026-07-03):** Completed audit
  feature `audit-security-1783061475-remove-the-hello-debug-route-from-the-application-factory`
  (assertions.md §3 S6, Low). `create_app` previously registered `@app.route("/hello")` returning
  `"Hello, World!"` unconditionally — a diagnostic endpoint shipped into production.
  - `flaskr/__init__.py`: deleted the `@app.route("/hello")` handler and its `hello()` function.
  - `tests/test_factory.py`: removed `test_hello`, which exercised the deleted route.
  - `.aidd/features/app-factory-and-configuration/feature.json`: updated the coverage spec
    (description + spec point 6) to drop the `/hello` route and explicitly forbid wiring any
    unconditional diagnostic/demo route into `create_app`, so a feature-based rebuild won't
    reintroduce the finding.
  - Verified: `ruff check flaskr tests` clean; full `pytest` suite green (34 passed).

### promote-remediation — no-op (2026-07-03)

- **Ingredient `promote-remediation` invoked with no arguments; no promotion performed.**
  The ingredient requires a `{app}/{remediation-slug}` target or `--all-blocked`; none was supplied.
- **Inventory:** two remediation directories exist —
  `remediation-20260703-secret-key-hardcoded` and `remediation-20260703-missing-csrf-protection`.
- **Phase 0 git/state sanity check — both are already shipped, not pending work:**
  - `remediation-20260703-secret-key-hardcoded` → implemented in commit `8976ca0`
    (`flaskr/__init__.py` now fails fast on unset/`"dev"` `SECRET_KEY`); `feature.json` is
    `status: completed`, `passes: true`.
  - `remediation-20260703-missing-csrf-protection` → implemented in commit `532989e`
    (`flaskr/csrf.py` present and wired via `csrf.init_app(app)`); `feature.json` is
    `status: completed`, `passes: true`.
  - Working tree spot-check confirmed both artifacts are live; no overlapping in-flight code changes
    (only `.aidd/` iteration/metadata files are dirty).
- **Decision:** STOP per the ingredient's Phase 0 rule — a remediation that no longer describes
  pending work cannot be promoted. Both were also correctly classified: they are genuine security
  defects (forgeable session key; missing CSRF), not net-new feature work. No files renamed, no
  `feature.json`/`roadmap.json` edits made.

### Blocked — Waiting Approval

- **Password reset / forgot-password flow — blocked on Q6 (2026-07-03):** Feature
  `password-reset-flow` (Priority 5) was selected but **cannot be implemented without a product
  decision** and has been set to `"status": "waiting_approval"`, `"passes": false`.
  - **Question:** How should the single-use, time-limited reset token be **delivered** to the user?
    Spec point 3 states the mechanism is *"TBD per Q6 — email, out-of-band, etc."*, and the feature
    description explicitly notes implementation "depends on Q6 security posture decisions (email
    verification, token strategy)." Q6 is listed as **[open]** in `assertions.md §9` — it has **not**
    been answered by the product owner (only Q2, the stack fork, has been answered, in
    `.aidd/responses/response2.md`).
  - **Why this is a fork-in-the-road, not agent judgment:** the delivery mechanism has large
    architectural consequences that differ per path, and this is a tutorial Flask app with **no mail
    infrastructure** of any kind.
  - **Options considered:**
    1. **Email delivery (SMTP/transactional mail).** Most realistic for production, but requires
       choosing and provisioning a mail service, adding config (SMTP host/creds or an API key), a new
       dependency, and secret management — none of which exist today and all of which are themselves
       Q6/Q3 (hosting) topics.
    2. **Out-of-band / console-or-flash token (dev-only).** No new infrastructure, but delivers the
       token insecurely (rendered on-screen or logged) and would not be a real recovery path — a
       tutorial-fidelity choice, not a product one.
    3. **Token table + Werkzeug-signed token, delivery abstracted behind a pluggable sender.** Splits
       the difference but still forces a default delivery path and a schema change (`schema.sql` /
       migrations = Q5, also open).
  - Each path also touches other **open** decisions: Q3 (hosting/secret provisioning), Q4/Q5 (schema
    change for a reset-token store, migration strategy). Guessing any of these would risk building the
    wrong thing.
  - **Waiting for:** product-owner answer to Q6 (required security controls + token delivery
    mechanism), and by extension the token-store persistence approach (Q5).
  - **Next action:** parked; no application source changed. No other in-scope, unblocked feature was
    picked up in this iteration (scope guard: one selected feature per run).

### Performance

- **Add pagination to the blog post index (2026-07-03):** Completed feature
  `post-index-pagination` (Priority 4, Performance finding from assertions.md §4). `GET /` previously
  ran `SELECT ... ORDER BY created DESC` with no bound, returning **all** posts on one page — an
  unbounded query and unbounded page size as the post count grows.
  - `flaskr/blog.py`: added `POSTS_PER_PAGE = 10`. `index()` now reads an optional 1-based `page`
    query parameter (non-numeric or `< 1` falls back to page 1), counts the total posts, and queries
    with `LIMIT ? OFFSET ?` so each page returns at most `POSTS_PER_PAGE` rows. It passes `page`,
    `has_prev`, and `has_next` to the template (`has_next` is computed from `offset + len(posts) <
    total`, so it never links past the last page).
  - `flaskr/templates/blog/index.html`: added a `<nav class="pagination">` block rendering
    **← Newer** / **Older →** links (via `url_for('blog.index', page=…)`), shown only when the
    respective neighbour page exists.
  - `tests/test_blog.py`: added `test_index_pagination` (seeds two pages of posts, asserts page 1
    returns exactly `POSTS_PER_PAGE` articles with a `?page=2` link and page 2 returns the remainder
    with a `?page=1` link) and `test_index_ignores_invalid_page` (non-numeric / `0` / missing `page`
    all return 200, defaulting to page 1).
  - Verification: full suite **35 passed** (was 33); `flaskr/blog.py` at 100% branch coverage, total
    99.48% (above the 90% floor); `ruff check flaskr tests` clean.

### Testing

- **Wire ruff lint and coverage gates into the workflow (2026-07-03):** Completed feature
  `lint-and-coverage-gates` (Priority 4, Testing finding from assertions.md §5). `pyproject.toml`
  declared `[tool.ruff]` and `[tool.coverage.run] branch = true`, but `ruff` and
  `coverage`/`pytest-cov` were **not installed** and never invoked — branch coverage was configured
  but not measured and there was no lint or CI gate.
  - **Installed and pinned the dev tooling:** `ruff==0.15.20`, `pytest-cov==7.1.0`, and its
    transitive `coverage==7.15.0` added to `requirements-dev.txt`, and a new
    `[project.optional-dependencies] dev = ["pytest", "pytest-cov", "ruff"]` extra in
    `pyproject.toml`.
  - **Fixed the ruff config:** `[tool.ruff] src = ["src"]` (which never matched the `flaskr/`
    layout) → `src = ["flaskr", "tests"]`, added `line-length = 88` and
    `[tool.ruff.lint] select = ["E", "F", "W", "I"]`.
  - **Fixed the violations:** `ruff check --fix` applied 11 import-ordering (I001) fixes across the
    app and tests; one over-length docstring in `tests/test_factory.py` was reworded.
    `ruff check flaskr tests` is now clean.
  - **Made coverage an enforced gate:** added `[tool.coverage.report] show_missing = true` and
    `fail_under = 90`. `pytest --cov` measures branch coverage (from the existing
    `[tool.coverage.run] branch = true`) with no extra flags — **33 passed, 99.44% total**, gate
    green.
  - **Documentation & CI:** `README.rst` gained a **Lint and coverage gates** section; a new
    `.github/workflows/ci.yml` runs `ruff check flaskr tests` + `pytest --cov` against the pinned
    lockfile on every push and pull request.
  - Verification: `ruff check` clean; `pytest --cov` 33 passed at 99.44% (above the 90% floor);
    `pip install --dry-run -r requirements-dev.txt -e .` resolves to the exact installed set.

### DevEx

- **Add dependency lockfile for reproducible installs (2026-07-03):** Completed feature
  `dependency-lockfile` (Priority 4, DevEx finding from assertions.md §5). `pyproject.toml` pinned
  only `flask` (unbounded) with no lockfile, so installs were non-reproducible and offered no
  vulnerability-scan surface.
  - `requirements.txt` (**new**): the fully pinned runtime transitive closure of `flask` —
    `blinker==1.9.0`, `click==8.4.2`, `colorama==0.4.6` (behind a `; sys_platform == "win32"`
    marker), `Flask==3.1.3`, `itsdangerous==2.2.0`, `Jinja2==3.1.6`, `MarkupSafe==3.0.3`,
    `Werkzeug==3.1.8`.
  - `requirements-dev.txt` (**new**): `-r requirements.txt` plus the pinned `test` extra —
    `pytest==9.1.1` and its transitive deps `iniconfig==2.3.0`, `packaging==26.2`, `pluggy==1.6.0`,
    `Pygments==2.20.0`.
  - Versions were captured from the working `.venv` (`pip freeze`). `pyproject.toml` stays the
    source of truth for the declared top-level dependency; the lockfiles pin the resolved versions.
  - `README.rst`: added reproducible-install commands to the Install and Test sections, plus a new
    **Dependency lockfile** section documenting the regeneration procedure.
  - Verification: `pip install --dry-run -r requirements-dev.txt` resolves to the exact installed
    set (all "already satisfied"); full pytest suite green on the locked versions — **33 passed**.
    No hashed lockfile (pip-tools/pip-compile not in the toolchain); exact `==` pins provide the
    reproducibility and scan surface the finding called for.

### Performance

- **Add database indexes on post.author_id and post.created (2026-07-03):** Completed feature
  `database-indexes` (Priority 4, Performance finding from assertions.md §4). The `post` table
  previously had no indexes, so the `index.html` listing (`ORDER BY created DESC`) required a full
  table scan plus filesort, and `author_id` ownership lookups scanned every row.
  - `flaskr/schema.sql`: added `CREATE INDEX idx_post_created ON post (created DESC)` and
    `CREATE INDEX idx_post_author_id ON post (author_id)` after the `post` table definition.
  - `tests/test_db.py`: added `test_post_indexes_created`, which asserts both indexes appear in
    `PRAGMA index_list('post')` after `init-db`.
  - No migration was added: there is no migration framework and `init-db` is a destructive re-init,
    so existing databases acquire the indexes on the next `init-db` (consistent with current design).
  - Verification: full pytest suite green — **33 passed** (was 32).

### Security

- **S4 remediation — rate limiting / brute-force protection on auth endpoints (2026-07-03):**
  Completed feature `rate-limiting-auth` (Priority 3, maps to S4/Medium, assertions.md §3). Q2 is
  resolved to "keep Flask" (product owner approval via web UI; sibling S1/S2 remediations landed on
  the Flask stack in commits 8976ca0 and 532989e), so the feature was moved `in_progress` and
  implemented on the current stack.
  - **Dependency-free approach:** Flask-Limiter is not installed and cannot be added under this
    session's toolchain constraints, so rate limiting was implemented with the Python standard
    library only (`threading`, `time`, `collections`) — a small dependency-free equivalent of
    Flask-Limiter scoped to the two auth endpoints, following the same conventions as
    `flaskr/csrf.py`.
  - `flaskr/ratelimit.py` (**new**): a `before_request` hook caps POST attempts per client IP
    (`request.remote_addr`) within a sliding window on the `auth.login` and `auth.register`
    endpoints and `abort(429)`s once the cap is exceeded. Counters live in process memory keyed
    per app instance. Config keys (with defaults): `RATELIMIT_MAX_ATTEMPTS` (5),
    `RATELIMIT_WINDOW_SECONDS` (60), `RATELIMIT_ENABLED`. Protection is on by default and
    auto-disabled under `TESTING`, mirroring the CSRF module, so the pre-existing 28 tests pass
    unchanged and legitimate single-attempt usage is never throttled.
  - `flaskr/__init__.py`: `create_app` now calls `ratelimit.init_app(app)`.
  - Tests: `tests/conftest.py` adds a `ratelimit_app`/`ratelimit_client` fixture (rate limiting
    explicitly enabled with a threshold of 3). `tests/test_auth.py` adds four tests —
    `test_rate_limit_blocks_login_brute_force` (4th wrong-password POST → 429),
    `test_rate_limit_blocks_register_flood` (4th registration → 429),
    `test_rate_limit_disabled_by_default_in_tests` (10 ordinary POSTs never throttled), and
    `test_rate_limit_leaves_get_requests_unaffected` (repeated GETs never counted).
  - Verification: full pytest suite green — **32 passed** (was 28). 429 returned before the view
    runs; GET requests and default test behavior unaffected. ruff is not installed (no enforced
    Python lint gate per assertions §5); pytest is the gate.

- **S2 remediation — CSRF protection on all state-changing forms (2026-07-03):** Completed feature
  `remediation-20260703-missing-csrf-protection` (Priority 2, maps to S2/High). Q2 resolved to
  "keep Flask" (product owner approval via web UI; sibling S1 remediation landed on the Flask stack
  in commit 8976ca0), so the feature was moved `in_progress` and implemented on the current stack.
  - **Dependency-free approach:** `flask-wtf`/`wtforms` are not installed and cannot be added under
    this session's toolchain constraints, so CSRF was implemented with the Flask standard library
    only (`secrets` + `hmac`) using the synchronizer-token pattern — a dependency-free equivalent of
    Flask-WTF's `CSRFProtect` following the same conventions.
  - `flaskr/csrf.py` (**new**): `generate_csrf()` stores a per-session random token
    (`secrets.token_urlsafe`) in the signed session cookie; `validate_csrf()` compares the submitted
    token (form field `csrf_token` or `X-CSRFToken` header) against it with `hmac.compare_digest`
    (constant-time) and `abort(400)` on mismatch. `init_app(app)` registers the token as the
    `{{ csrf_token() }}` Jinja global and enforces it in a `before_request` hook for
    POST/PUT/PATCH/DELETE. Protection is on by default and auto-disabled under `TESTING`
    (`CSRF_ENABLED` config key), mirroring Flask-WTF, so the pre-existing 25 tests pass unchanged.
  - `flaskr/__init__.py`: `create_app` now calls `csrf.init_app(app)`.
  - Templates: hidden `csrf_token` field added to all five mutating forms — `auth/register.html`,
    `auth/login.html`, `blog/create.html`, and both the edit and delete forms in `blog/update.html`.
  - Tests: `tests/conftest.py` adds a `csrf_app`/`csrf_client` fixture (CSRF explicitly enabled).
    `tests/test_auth.py` adds `test_csrf_protects_auth_forms` (register + login rejected without a
    token, accepted with) and `test_csrf_leaves_get_requests_unaffected`. `tests/test_blog.py` adds
    `test_csrf_protects_blog_mutations` (create/update/delete all `400` without a token; update
    succeeds with a valid token; seeded post untouched by rejected requests).
  - Verification: full pytest suite green — **28 passed** (was 25). GET requests unaffected; tokens
    validated server-side, not merely rendered. ruff is not installed (no enforced Python lint gate
    per assertions §5); pytest is the gate.

- **S1 remediation — enforce a non-default SECRET_KEY (2026-07-03):** Completed feature
  `remediation-20260703-secret-key-hardcoded` (Priority 1, maps to S1/Critical). The product
  owner approved proceeding on the current Flask stack — the feature was moved from
  `waiting_approval` to `in_progress` with `approval.approvedAt` set and `decisionRequired:false`
  via the web UI, resolving the Q2 gate for this remediation. Changes:
  - `flaskr/__init__.py`: removed the hardcoded `SECRET_KEY="dev"` deployable default. The key is
    now sourced from the `SECRET_KEY` environment variable (or `instance/config.py`, which is
    gitignored so no secret ships in source). `create_app` now **fails fast** with a `RuntimeError`
    in non-test mode when `SECRET_KEY` is unset or still equals `"dev"`, so a forgeable-session
    deployment cannot start. The guard keys on the `TESTING` flag (not on `SECRET_KEY != "dev"`),
    and supplies a throwaway `"test"` key when a test app provides none, so session signing still
    works under pytest.
  - `tests/test_factory.py`: `test_config` now passes a real `SECRET_KEY` (bare `create_app()`
    would now correctly trip the guard); added `test_secret_key_required` asserting `create_app`
    raises for both `"dev"` and an unset key outside test mode.
  - Verification: full pytest suite green — **25 passed** (was 24). Backend/CLI feature, no UI.
    ruff is not installed in this project (no enforced Python gate per assertions §5); pytest is
    the gate. `instance/config.py` is intentionally **not** committed (gitignored) — committing a
    secret there would recreate the vulnerability; production provisions `SECRET_KEY` via env/instance.

### Added

- **AIDD onboarding — session 1 (2026-07-04):** Complete onboarding pass over the `flaskr`
  project. Ingested assistant rules (none found — no CLAUDE.md, AGENTS.md, or .windsurf/rules/).
  Applied project.md override (spernakit-like preference, gated on unresolved Q2). Created
  missing required artifact `.aidd/spec.md` from codebase analysis. Rewrote
  `.aidd/project-structure.md` (was template placeholder) with full architecture documentation:
  repository layout, module descriptions, technology stack, data model, complete route table, and
  development workflow. Created `.aidd/todo.md` with 20 prioritized action items across high/
  medium/low/technical-debt categories. Updated `README.rst` with a Features section (closing the
  doc-gap from the prior feature-coverage-audit).

  **Feature list expansion (10 → 23 features):** The prior feature-coverage-audit had backfilled
  4 `completed`/`passes:true` coverage records (app-factory-and-configuration,
  user-authentication, blog-post-management, database-and-init-db-cli) and 6 backlog security
  features existed (2 remediation + 4 audit findings). This onboarding session added 13 new
  feature JSONs to reach the 20+ minimum: 7 `completed`/`passes:true` coverage records for
  shipped security/UX capabilities (base-template-and-navigation, flash-message-system,
  password-hash-storage, sql-injection-prevention, session-fixation-mitigation,
  xss-prevention-via-autoescaping, timestamp-type-converter) and 6 `backlog`/`passes:false`
  items for known gaps (post-index-pagination, database-indexes, rate-limiting-auth,
  password-reset-flow, dependency-lockfile, lint-and-coverage-gates). Total: 23 features
  (11 completed, 12 backlog).

  **Artifact inventory:**
  - ✓ `.aidd/spec.md` — **created** (was missing, required)
  - ✓ `.aidd/project-structure.md` — **rewritten** (was template placeholder)
  - ✓ `.aidd/project-profile.json` — present and fresh
  - ✓ `.aidd/assertions.md` — present and fresh
  - ✓ `.aidd/testing-scenarios.md` — present and fresh
  - ✓ `.aidd/questions.md` — present and fresh
  - ✓ `.aidd/project.md` — present and fresh
  - ✓ `.aidd/todo.md` — **created**
  - ✗ `.aidd/roadmap.json` — **missing** (recommended). Follow-up: `/update-roadmap` once Q2
    is resolved.
  - ✗ `.aidd/screen-map.md` — **missing** (recommended). Follow-up: `/update-screen-map`.
  - ✗ `.aidd/responses.md` — **missing** (optional). Interview is effectively unanswered.
  - ✗ `CONTEXT.md` — **missing** (recommended at project root).

  **Key findings:** The project is the unchanged Pallets Flask tutorial blog (Python/Flask/
  SQLite, 24 tests passing). The load-bearing blocker remains the unresolved Q2 stack fork
  (spernakit-like TS/Bun vs. Python/Flask) — it gates both security remediation features and
  all roadmap decisions. All shipped security controls (SQL injection prevention, XSS
  prevention, password hashing, session-fixation mitigation) are verified and must not regress.
  The CRLF/LF diffs in the working tree are autocrlf artifacts, not real changes.

- **AIDD security audit review — S2 CSRF remediation (2026-07-03):** Executed the SECURITY
  audit-review directive over the audit definitions (`.aidd/audits/SECURITY.md`) and the
  audit-backed findings for the P2 feature `remediation-20260703-missing-csrf-protection`.
  Re-verified S2 firsthand against live source: a repo-wide search for `csrf` / `csrf_token` /
  `CSRFProtect` returns **zero** hits across every `.py` and `.html` file, and all **five** mutating
  POST forms render no token — `templates/auth/register.html:8`, `templates/auth/login.html:8`,
  `templates/blog/create.html:8`, and both the update form (`templates/blog/update.html:8`) and the
  delete form (`templates/blog/update.html:16`). The finding is real, accurately catalogued in
  `assertions.md §3` (S2, High), and the spec is correctly scoped (register `CSRFProtect` in
  `create_app`, add `csrf_token` to all five forms, assert a rejected-without-token POST).

    **Blocker recorded — feature set to `waiting_approval` (not completed).** Like the sibling S1
    secret-key remediation (held at `waiting_approval` in commit `5ae8d2e`), this is a
    fork-in-the-road gated on the unresolved interview **Q2** (`.aidd/project.md` mandates a
    "spernakit-like" TS/Bun stack while the app is Python/Flask). `assertions.md §9` is authoritative:
    the two remediation specs "must be rewritten — not just re-pathed — if Q2 resolves to port. Hold
    both features at backlog until answered." Per the Blocking-Ambiguity constraint, the keep-vs-port
    call — and the Q6 question of which security controls are required for the target deployment — is
    product-owner judgment, not agent judgment. Implementing the Flask-WTF `CSRFProtect` fix now would
    either be discarded under a port or silently commit the project to "keep Flask" without approval.
    - **Question for product owner:** (1) Q2 — keep Python/Flask or port to TS/Bun? This decides
      whether this spec is valid as written. (2) Q6 — is CSRF protection required for the intended
      deployment, and via which mechanism (Flask-WTF `CSRFProtect` for the current Jinja forms, or a
      token strategy under a ported stack)?
    - **Options considered:** (a) implement the Flask `CSRFProtect` fix now — rejected: pre-empts Q2
      and may be thrown away; (b) port-aware abstraction — rejected: speculative, no target stack;
      (c) hold at `waiting_approval` with the blocker documented — chosen, matches the S1 conclusion
      and every prior intake run.
    - **Next action:** await Q2/Q6 answers; on "keep Flask" this becomes immediately implementable and,
      per `assertions.md §6`, should land as **one coherent `create_app` edit** together with the S1
      secret-key fix to avoid a self-inflicted merge collision. No application source, tests, or config
      changed in this run.

- **AIDD security audit review — S1 secret-key remediation (2026-07-03):** Executed the SECURITY
  audit-review directive over the audit definitions and audit-backed findings. Re-verified the
  security findings against live source: S1 (`SECRET_KEY="dev"` at `flaskr/__init__.py:11` with a
  silent, absent `instance/config.py` override → forgeable sessions) is real and Critical; S2–S7
  (CSRF, cookie hardening, brute-force, headers, `/hello`, verbose 404) remain accurately catalogued
  in `assertions.md §3`. Confirmed the P1 feature
  `remediation-20260703-secret-key-hardcoded` is correctly scoped: the fail-fast guard is already
  keyed on test mode (spec points 4/5) so `tests/conftest.py` (no `SECRET_KEY`) and
  `tests/test_factory.py::test_config()` (bare `create_app()`) stay green.

    **Blocker recorded — feature set to `waiting_approval` (not completed).** The remediation is a
    fork-in-the-road gated on the unresolved interview **Q2** (`.aidd/project.md` mandates a
    "spernakit-like" TS/Bun stack while the app is Python/Flask). `assertions.md §9` is authoritative:
    the specs "must be rewritten — not just re-pathed — if Q2 resolves to port. Hold both features at
    backlog until answered." Per the Blocking-Ambiguity constraint, a keep-vs-port decision — and the
    Q6 question of how `SECRET_KEY`/instance config is provisioned in production — is product-owner
    judgment, not agent judgment. Implementing the Flask guard now would either be discarded under a
    port or silently commit the project to "keep Flask" without approval.
    - **Question for product owner:** (1) Q2 — keep Python/Flask or port to TS/Bun? This decides
      whether this spec is valid as written. (2) Q6 — how is `SECRET_KEY` provisioned in the target
      deployment (env var vs. `instance/config.py` vs. secrets manager)? The fail-fast guard's source
      must match.
    - **Options considered:** (a) implement the Flask fail-fast guard now — rejected: pre-empts Q2 and
      may be thrown away; (b) port-aware abstraction — rejected: speculative, no target stack; (c) hold
      at `waiting_approval` with the blocker documented — chosen, matches every prior intake run's
      conclusion.
    - **Next action:** await Q2/Q6 answers; on "keep Flask" this becomes immediately implementable
      (drop the `SECRET_KEY="dev"` default, source from env/instance config, raise at startup when
      unset/"dev" outside `TESTING`, update `test_factory.py`). No application source, tests, or config
      changed in this run.

- **AIDD testing-scenarios seed (2026-07-03):** Ran the `testing-scenarios` ingredient for `flaskr`
  in seed mode (no prior `.aidd/testing-scenarios.md`). Reviewed the blueprint (project-profile.json,
  the four backfilled feature records, and the two backlog security remediations) and surveyed the
  server-rendered templates/routes (base nav, blog index, auth register/login, blog create/update
  with the delete form). Authored 10 curated scenarios covering the register → login → post → edit →
  delete lifecycle plus the app's actual privilege boundaries (`login_required` anonymous redirect,
  author-ownership 403/hidden-Edit isolation, newest-first ordering, flash-message validation). No
  RBAC-tier scenarios were generated because flaskr has no role hierarchy. Only
  `.aidd/testing-scenarios.md` was created; no other files touched.

- **AIDD feature-review re-run (2026-07-03):** Re-executed the `feature-review` ingredient over
  `flaskr` as a fresh invocation. Re-verified all spec claims firsthand against unchanged live
  code and confirmed the two backlog remediation features remain accurate, conflict-free, and
  fully specified: `SECRET_KEY="dev"` at `flaskr/__init__.py:11`, no `instance/config.py`, zero
  CSRF hits across `flaskr/`+`tests/`, all five POST forms unprotected, and the secret-key spec's
  fail-fast guard already keyed on test mode (points 4/5) with the CSRF `affectedFiles` already
  listing both test files. **Result: 0 new issues, 0 auto-fixes, 0 feature.json modified** — the
  prior run's fixes hold, so no `updatedAt` churn. 0 template features; no `roadmap.json` →
  Phase 6.5 assignment skipped. Both features correctly stay `backlog` pending the Q2
  Flask-vs-port product decision. Appended a re-verification note to
  `.aidd/reports/feature-review-2026-07-03.md`. No application source, tests, or config changed.

- **AIDD feature-review (2026-07-03):** Ran the `feature-review` ingredient over `flaskr`.
  Adapted the checks to the actual stack (Python/Flask, not TS/Bun) since `.aidd/project.md`'s
  "spernakit-like" preference is gated on the unresolved Q2 fork. Scope: the **2 backlog /
  `passes:false` remediation features** (`remediation-20260703-secret-key-hardcoded` P1,
  `remediation-20260703-missing-csrf-protection` P2); the 4 `completed` coverage records and 0
  template features were used for the dependency graph only. Loaded `.aidd/remediation-review.md`
  in full and verified every spec claim firsthand against live code: `SECRET_KEY="dev"` at
  `flaskr/__init__.py:11`, no `instance/config.py`, **zero** CSRF hits across `flaskr/`+`tests/`,
  all five POST forms unprotected, and `conftest.py`/`test_factory.py` supplying no `SECRET_KEY`.
  **Result: 0 new issues, 0 auto-fixes.** The remediation-review's one blocking item (secret-key
  spec points 4/5 keying the fail-fast guard on test mode rather than `SECRET_KEY != "dev"`) and
  its CSRF `affectedFiles` alignment were already applied by the prior run (commit `2a5f920`) and
  re-confirmed accurate; no feature.json was modified, so no `updatedAt` churn. Both features are
  correctly held at `backlog` pending Q2 (do not promote to active work until the Flask-vs-port
  decision is made by the product owner). No `roadmap.json` exists → Phase 6.5 roadmap assignment
  skipped. Report: `.aidd/reports/feature-review-2026-07-03.md`. No application source, tests, or
  config changed.

- **AIDD feature-coverage-audit (2026-07-03):** Ran the `feature-coverage-audit` ingredient
  (`--apply`) over `flaskr`. Inventoried the implemented Python/Flask capabilities against natural
  docs and `.aidd/features/*`. Finding: the only two existing feature JSONs are _backlog security
  remediations_ — **none of the actually shipped, test-passing capabilities had coverage**
  (feature-json-gap ×4). Backfilled 4 `completed`/`passes:true` coverage feature JSONs (honest —
  `pytest` = 24 passed this session), each with concrete `Verify …` specs, `affectedFiles`, and
  cross-feature `dependencies`: `app-factory-and-configuration`, `user-authentication`,
  `blog-post-management`, `database-and-init-db-cli`. Left the 2 remediation features untouched
  (still correctly `backlog`; CSRF still absent, `SECRET_KEY="dev"` unchanged). Did **not** edit
  `README.rst` (no Features section exists → adding one is outside safe auto-fix) — reported as a
  remaining `doc-gap`. Did not promote the `/hello` debug route (S6) to a feature (reported
  ambiguous). No `roadmap.json` exists, so `roadmap:apply` was skipped. Validated with
  `--check-features`: **6 files, 6 valid, 0 invalid**. Report:
  `.aidd/reports/feature-coverage-audit-2026-07-03.md`. No application source, tests, or config
  changed.

- **AIDD project-profile (2026-07-03):** Created `.aidd/project-profile.json` (previously missing).
  Inferred the project's assurance profile from the source tree and
  `.aidd/audit-reports/CODEBASE_ANALYSIS-2026-07-03.md`: stack (Python/Flask/Jinja2/SQLite,
  application-factory + blueprints, no frontend build tooling), deployment mode
  (development/tutorial only — no CI, Dockerfile, or production server config), auth mode (signed
  session cookie, werkzeug password hashing, with documented CSRF/cookie/rate-limit gaps), data
  sensitivity (low — username + hashed password + post content only), criticality (low —
  educational reference app), external integrations (none), and the project's own validation
  command (`pytest`, last known 24 passed). Recorded the `project.md` "spernakit-like unless
  otherwise necessary" note so downstream ingredients do not re-scaffold JS tooling onto a pure
  Flask tutorial. No files outside `.aidd/` were modified.

### Changed

- **AIDD consolidate-features (2026-07-03):** Ran the `consolidate-features` ingredient over
  `flaskr`. Discovery found 2 total features, both standalone security remediations
  (`remediation-20260703-secret-key-hardcoded`, `remediation-20260703-missing-csrf-protection`),
  0 template features (no `spernakit_version`), and **0 base features**. Per the Phase 1
  actionability gate, only `completed`/`verified` findings are foldable — both remediations are
  `backlog` (unfinished work, additionally gated by the unresolved Q2 stack fork), so neither was
  eligible. With no base features to fold _into_, no `feature-*`-named dirs to rename, no
  `roadmap.json` (Phase 5b assignment skipped), and no `screen-map.md`, this was a **no-op**: no
  specs folded, no directories removed or renamed, no dependency/artifact references to scrub.
  Both remediation features left untouched pending completion and the Q2 product decision.

- **AIDD feature-review (2026-07-03):** Ran the `feature-review` ingredient over the 2 backlog
  security remediation features. Verified all spec claims firsthand against the live Flask code
  (`flaskr/__init__.py:11` hardcoded `SECRET_KEY="dev"`; zero CSRF hits repo-wide; all 5 mutating
  routes/forms as specified). Auto-fixed 2 features (2 issues):
    - `remediation-20260703-secret-key-hardcoded`: rewrote spec point 4 (CONTRADICTION — it claimed
      `test_config` supplies its own `SECRET_KEY`, but `tests/conftest.py:21` passes none, so the
      suite runs on the default `"dev"` key). New wording requires the fail-fast guard to key on test
      mode, not on `SECRET_KEY != "dev"`. Expanded spec point 5 to require updating
      `test_factory.py`'s bare `create_app()` call (which would otherwise trip the new guard).
    - `remediation-20260703-missing-csrf-protection`: added `tests/test_auth.py` to `affectedFiles`
      to align with spec point 5 (which accepts a test in `test_auth.py` and/or `test_blog.py`).
    - No duplication, no cathedral risk, no dependency issues. Phase 6.5 skipped (no `roadmap.json`).
    - Report-only: unresolved Q2 stack fork (Flask vs spernakit-like TS/Bun) still gates both from
      promotion; both remain `backlog` pending product-owner decision. See report in commit body.

### Added

- **AIDD assertions consolidation (2026-07-03):** Created `.aidd/assertions.md` — a
  deduplicated checklist of every claim, assumption, and conclusion established across the
  intake artifacts (`questions.md`, `responses/response1.md`, `response-review.md`,
  `CODEBASE_ANALYSIS-2026-07-03.md`, `remediation-review.md`, and the two `remediation-*`
  feature specs). Organized into identity/provenance, architecture, security (S1–S7 + the
  five verified controls not to regress), performance, testing/quality gates, AIDD metadata
  health, interview status, remediation features, and open decisions (the 10 unanswered
  interview questions, Q2 stack fork flagged as the load-bearing blocker). Each item tagged
  `[verified]`, `[open]`, or `[drift]`; recorded the one known inter-artifact inconsistency
  (S1 severity: Critical in report/feature vs. High in CHANGELOG/response-review, with
  Critical authoritative). Consolidation only — no source, config, or feature changes.

- **AIDD remediation-feature review (2026-07-03):** Created `.aidd/remediation-review.md`
  assessing the two `backlog` security remediation features
  (`remediation-20260703-secret-key-hardcoded`, `remediation-20260703-missing-csrf-protection`)
  triaged from `response1.md`. Verified every checkable claim firsthand against the live code:
  `SECRET_KEY="dev"` at `flaskr/__init__.py:11` with no `instance/config.py` override, and zero
  `csrf`/`CSRFProtect`/`csrf_token` hits anywhere in `.py`/`.html`. Verdict: both features are
  well-grounded, non-duplicate, correctly prioritized, and the rate-limit/password-reset
  exclusions were correct. Found **one spec defect** — secret-key spec point 4 wrongly assumes
  `tests/conftest.py` supplies its own `SECRET_KEY` (it passes only `TESTING`+`DATABASE`, so the
  suite runs on the `"dev"` default and `test_factory.py`'s bare `create_app()` would break a
  fail-fast guard). Also flagged affectedFiles/spec mismatches, an S1 severity label drift
  (Critical in the report/feature vs. High in CHANGELOG/response-review), the shared
  `flaskr/__init__.py` edit point to coordinate, and reaffirmed the unresolved Q2 stack fork as a
  hold condition. No source or feature changes.

- **AIDD doc2feature triage (2026-07-03):** Ran the `doc2feature` ingredient against
  `.aidd/responses/response1.md` (the only interview response on disk), cross-referencing
  `.aidd/response-review.md` and `CODEBASE_ANALYSIS-2026-07-03.md`. The response is a process
  diagnostic, so the bulk of its content (loop-stuck narrative, 10 intent-question topics
  including the unresolved Q2 stack fork, and the "what works" codebase snapshot) was excluded
  as non-claims. Two embedded, specific security assertions were verified firsthand against the
  live code and became `backlog` remediation features:
  `remediation-20260703-secret-key-hardcoded` (Priority 1 — `SECRET_KEY="dev"` at
  `flaskr/__init__.py:11` with a silent, absent instance override → forgeable sessions) and
  `remediation-20260703-missing-csrf-protection` (Priority 2 — no CSRF on any of the five
  mutating POST forms). Skipped: rate-limiting (surfaced only as a Q6 posture topic) and
  password reset (a missing feature, not a defect). No `roadmap.json` exists, so Phase 8b
  roadmap assignment was skipped. Both feature specs reference current Flask paths and should be
  re-targeted if the unresolved Q2 (Flask vs. TS/Bun) is decided in favor of a port. No source
  or config changes.

- **AIDD interview response review (2026-07-03):** Created `.aidd/response-review.md`
  assessing the interview responses against `.aidd/questions.md`. Finding: the interview is
  effectively unanswered — all 10 questions are open, and the only artifact in
  `.aidd/responses/` (`response1.md`) is a process diagnostic, not an answer. Flagged the
  unresolved Q2 fork (spernakit/TS-Bun vs. Python/Flask) as the load-bearing blocker, noted
  that `spec.md`, `responses.md`, `roadmap.json`, and `assertions.md` do not yet exist and
  `project-structure.md` is still a template, and recommended routing Q1/Q2/Q6 to the
  product owner before the intake loop advances. No source or config changes.

- **AIDD codebase-analysis (2026-07-03):** Generated
  `.aidd/audit-reports/CODEBASE_ANALYSIS-2026-07-03.md` covering architecture, performance,
  security, quality, evolution, and standards consistency for the `flaskr` Python/Flask package.
  Verified the app is the canonical pallets/flask tutorial: clean application-factory + blueprint
  architecture, parameterized SQL (no injection), Jinja2 autoescaping (XSS mitigated), and
  author-scoped authorization. Ran the test suite via the vendored `.venv/Scripts/pytest.exe`
  (Python interpreter not invoked directly per session constraints) → **24 passed** in 0.69s.
  Overall health: **B+ (tutorial) / C (production baseline)**. Top findings: `SECRET_KEY="dev"`
  with no enforced prod override (S1, High), no CSRF on POST forms (S2, High), and `ruff`/`coverage`
  configured in `pyproject.toml` but absent from `.venv` (lint/coverage gates unrunnable). Recorded
  a **blocker**: `.aidd/project.md` asks for a "spernakit-like" TS/Bun stack while the code is
  Python/Flask — keep-vs-port is a product decision, not made by this analysis. No source changes.

### Changed

### Deprecated

### Removed

### Fixed

### Security
