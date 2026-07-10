# Project Structure — flaskr

## Overview

Flaskr is the canonical Pallets Flask tutorial blog — a server-rendered, session-authenticated
SQLite app built with the application-factory + blueprint pattern. It serves as a learning
reference for Flask best practices. The app is intentionally minimal: two database tables
(`user`, `post`), two blueprints (`auth`, `blog`), and server-rendered Jinja2 templates with
static CSS. No JavaScript build tooling, no SPA, no ORM, no migration framework.

## Repository Layout

### Root Level

```
flaskr/
├── flaskr/                    # Application package (Flask app)
├── tests/                     # pytest test suite (24 tests)
├── instance/                  # Flask instance folder (SQLite DB, optional config.py)
├── .venv/                     # Python virtual environment (local dev)
├── .aidd/                     # AIDD tracking artifacts (features, audits, specs)
├── pyproject.toml             # Project metadata, flit build, pytest/ruff/coverage config
├── README.rst                 # Project readme (reStructuredText)
├── LICENSE.txt                # BSD-3-Clause license (Pallets)
└── .gitignore
```

### Application Package (`flaskr/`)

```
flaskr/
├── __init__.py                # Application factory: create_app(test_config)
├── auth.py                    # Auth blueprint: register, login, logout, login_required
├── blog.py                    # Blog blueprint: index, create, update, delete, get_post
├── db.py                      # SQLite layer: get_db, close_db, init_db, init_app, init-db CLI
├── schema.sql                 # DDL: DROP + CREATE for user and post tables
├── static/
│   └── style.css              # Minimal static stylesheet
└── templates/
    ├── base.html              # Base template: nav, flash messages, content block
    ├── auth/
    │   ├── register.html      # Registration form
    │   └── login.html         # Login form
    └── blog/
        ├── index.html         # Post listing (newest first)
        ├── create.html        # New post form
        └── update.html        # Edit post form + delete form
```

### Test Suite (`tests/`)

```
tests/
├── conftest.py                # Fixtures: app (temp SQLite), client, runner, auth helper
├── data.sql                   # Seed data: 2 users, 1 post
├── test_factory.py            # create_app config tests + /hello route test
├── test_db.py                 # get_db reuse, close_db teardown, init-db CLI
├── test_auth.py               # register, login, logout, validation, session
└── test_blog.py               # index, login_required, create, update, delete, 403/404
```

## Key Concepts / Modules

### Application Factory (`flaskr/__init__.py`)

- **Responsibility**: Constructs and configures the Flask app instance
- **Key files**: `flaskr/__init__.py`
- **Primary entry points**: `create_app(test_config=None)` → configured `Flask` app
- **Wiring**: default config (SECRET_KEY, DATABASE) → instance/config.py overlay → DB teardown +
  init-db CLI → auth/blog blueprint registration → `/` endpoint alias

### Auth Blueprint (`flaskr/auth.py`)

- **Responsibility**: User registration, login, logout, session management
- **Key files**: `flaskr/auth.py`, `flaskr/templates/auth/*.html`
- **Primary entry points**: `register()`, `login()`, `logout()`, `load_logged_in_user()`,
  `login_required()`
- **URL prefix**: `/auth`

### Blog Blueprint (`flaskr/blog.py`)

- **Responsibility**: Post listing, CRUD with author-ownership enforcement
- **Key files**: `flaskr/blog.py`, `flaskr/templates/blog/*.html`
- **Primary entry points**: `index()`, `create()`, `update(id)`, `delete(id)`, `get_post(id)`
- **URL prefix**: `/` (mounted as index)

### Data Layer (`flaskr/db.py`)

- **Responsibility**: SQLite connection management and schema initialization
- **Key files**: `flaskr/db.py`, `flaskr/schema.sql`
- **Primary entry points**: `get_db()`, `close_db()`, `init_db()`, `init_app(app)`

## Technology Stack

### Backend

- **Runtime**: CPython (3.8+; 3.14 in local .venv)
- **Framework**: Flask
- **Database**: SQLite (sqlite3 stdlib driver, one connection per request via `flask.g`)
- **ORM**: None (inline parameterized SQL)
- **Auth**: Flask signed session cookie; werkzeug password hashing
- **Packaging**: flit_core (`pyproject.toml`)

### Frontend

- **Framework**: None (server-rendered Jinja2 HTML)
- **Styling**: Static CSS (`flaskr/static/style.css`)
- **JavaScript**: None

## Data Model Overview

- **Entities**:
    - `user`: `id` (PK), `username` (unique), `password` (hashed)
    - `post`: `id` (PK), `author_id` (FK → user.id), `created` (timestamp), `title`, `body`
- **Relationship**: One user → many posts (author ownership enforced in `get_post`)

## API / Route Overview

- **Base path**: `/` (blog), `/auth` (auth)
- **Auth model**: Signed session cookie (`session["user_id"]`)
- **Mutations**: All guarded by `@login_required`; edit/delete additionally enforce author
  ownership (403) and existence (404)

| Method | Path                  | Auth Required | Description               |
|--------|-----------------------|---------------|---------------------------|
| GET    | `/`                   | No            | List all posts            |
| GET    | `/hello`              | No            | Debug route (S6)          |
| GET    | `/auth/register`      | No            | Registration form         |
| POST   | `/auth/register`      | No            | Register new user         |
| GET    | `/auth/login`         | No            | Login form                |
| POST   | `/auth/login`         | No            | Log in                    |
| GET    | `/auth/logout`        | No            | Log out                   |
| GET    | `/create`             | Yes           | New post form             |
| POST   | `/create`             | Yes           | Create post               |
| GET    | `/<id>/update`        | Author        | Edit post form            |
| POST   | `/<id>/update`        | Author        | Update post               |
| POST   | `/<id>/delete`        | Author        | Delete post               |

## Development Workflow

- **Install**: `pip install -e .` (or `pip install -e ".[test]"` for pytest)
- **Dev server**: `flask --app flaskr run`
- **Init DB**: `flask --app flaskr init-db`
- **Tests**: `pytest` (from repo root using `.venv`)
- **Build**: None (no build step for this Flask app)

## Notes / Gotchas

- **CRLF/LF**: The repo stores LF line endings; Windows checkouts may show CRLF diffs due to
  `autocrlf`. These are not real changes.
- **No lockfile**: `pyproject.toml` pins only `flask` (unbounded) → non-reproducible installs.
- **Destructive init-db**: `schema.sql` drops and recreates tables — running it destroys all data.
- **No migration framework**: Schema changes require manual SQL or re-init.
- **SECRET_KEY="dev"**: The hardcoded default makes sessions forgeable — see S1 in assertions.md.
- **Q2 blocker**: `.aidd/project.md` mandates "spernakit-like" TS/Bun stack while the app is
  Python/Flask. This unresolved fork gates all major decisions.
