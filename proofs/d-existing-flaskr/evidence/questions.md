# Interview Questions — flaskr

_Generated 2026-07-03 from codebase analysis. These questions target intent and
decisions that are **not** derivable from the source. Answers should be captured in
`.aidd/responses.md` / `.aidd/responses/` and used to fill in `.aidd/spec.md`,
`.aidd/project-structure.md`, and the roadmap._

## Context (verified from source)

`flaskr` is the stock Flask tutorial blog, imported verbatim from `pallets/flask`
`examples/tutorial` (commit `1440aa6`). Python + Flask app-factory
(`flaskr/__init__.py` → `create_app`), SQLite via `flaskr/db.py` + `flaskr/schema.sql`,
two blueprints — `auth` (register/login/logout) and `blog` (index/create/update/delete) —
Jinja templates, and pytest tests under `tests/`. `.aidd/project.md` states intent that
"all architecture, tech stack, style, and tooling should be spernakit-like unless
otherwise necessary and user approved," which directly conflicts with the current
Python/Flask implementation. The questions below exist to resolve that and other gaps.

---

## Q1: Project intent — learning artifact or product base?

Is `flaskr` meant to stay a faithful reference implementation of the Flask tutorial, or
is it the seed of a real product you intend to grow? This determines whether we optimize
for fidelity to the tutorial or for extensibility.

## Q2: The "spernakit-like" directive vs. a Python/Flask app

`.aidd/project.md` asks for a spernakit-like (TypeScript/Bun) architecture, tech stack,
style, and tooling, but the app is Python/Flask. Which is authoritative?
- (a) Keep Python/Flask; treat the spernakit note as aspirational only.
- (b) Port/rewrite the app to a spernakit-like TS/Bun stack.
- (c) Wrap/coexist (e.g. TS tooling around a Python core).
This is a fork-in-the-road decision and needs your explicit call before any migration.

## Q3: Target stack and hosting

If we keep Python/Flask: what Python version, WSGI/ASGI server (gunicorn/uvicorn?), and
deployment target (container, PaaS, VM)? If we migrate: confirm Bun + which framework
(the spernakit default) and datastore.

## Q4: Data model roadmap

The schema (`flaskr/schema.sql`) has only `user` and `post`. Which of these, if any, do
you want next: comments, tags/categories, drafts/publish state, post edit history,
soft-delete, user roles/profiles? Anything explicitly out of scope?

## Q5: Persistence — stay on SQLite?

The app uses a single-file SQLite DB in the instance folder with a manual `init-db` CLI
and no migration framework. Should we keep SQLite, or move to Postgres/another DB, and do
you want managed migrations (e.g. Alembic) instead of destructive `schema.sql` re-init?

## Q6: Authentication & security posture

Current auth is session-cookie based with `SECRET_KEY="dev"` hardcoded as the default,
Werkzeug password hashing, and no CSRF protection, rate limiting, email verification, or
password reset. For your intended use, which of these are required, and how should
`SECRET_KEY` / instance config be provisioned in production?

## Q7: Authorization rules

Posts enforce author-only edit/delete via `get_post(check_author=True)`. Do you want any
other authorization model — admins/moderators, per-post visibility, or read
restrictions — or is "any logged-in user can post, only the author can edit/delete" the
final rule?

## Q8: UI / frontend expectations

The UI is server-rendered Jinja templates with minimal static CSS. Is that acceptable
long-term, or do you want a richer frontend (SPA, component framework, design system)?
If spernakit-like UI is expected, that reinforces Q2's migration path.

## Q9: Testing & quality gates

Tests exist under `tests/` (pytest) with branch coverage configured in `pyproject.toml`.
What is the required quality bar — target coverage %, lint (ruff is configured), type
checking, CI — and which gates must pass before a change is considered done?

## Q10: Non-negotiable constraints or deadlines

Are there any hard constraints (compliance, offline operation, specific dependencies to
avoid, performance targets) or deadlines that should shape prioritization and the roadmap?
