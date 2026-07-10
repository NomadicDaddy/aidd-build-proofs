# Habit Tracker

A single-user, local-first habit tracker for building and keeping daily habits. Define habits, check
them off each day, and see current/longest streaks plus a rolling weekly grid. No accounts, no cloud —
everything lives in a local SQLite database under `data/`.

## Features

- Define habits with a name, daily cadence, and optional target/notes.
- Check a habit done (or undo) for any given day; duplicate same-day check-ins are impossible.
- Current streak, longest streak, and 30-day completion rate per habit.
- Dashboard overview: today's habits with quick-toggle, done-vs-total count, and a weekly grid.

See `.aidd/spec.md` for the full specification and `.aidd/features/` for the tracked feature backlog.

## Prerequisites

- [Bun](https://bun.sh) `>= 1.3.14` (package manager and runtime — npm/npx are not used).
- Node.js `>= 24 < 25` (per `.nvmrc`).
- Git.

## Setup

```bash
# Install dependencies and prepare the local environment
bun run setup
```

`bun run setup` validates the Bun version, installs dependencies, ensures the `data/` and `config/`
directories exist, and creates `config/habit-tracker.json` from `config/example.json` if it is missing.
It does **not** start any server.

## Running the Application

> The backend (Elysia) and frontend (Vite) workspaces are built incrementally by feature sessions.
> Once they expose a `dev` script, use the commands below.

```bash
# Agent-safe: start backend + frontend detached, returns immediately
bun run start

# Stop the servers started by `bun run start`
bun run stop

# Human-interactive (foreground) dev servers
bun run dev            # frontend
bun run dev:backend    # backend
bun run dev:frontend   # frontend
```

Default ports: frontend `http://localhost:3330`, backend `http://localhost:3331` (see
`config/example.json`).

## Quality Gate

```bash
bun run smoke:qc   # prettier --check + eslint (must pass before every commit)
bun run format     # prettier --write (auto-fix formatting)
bun run lint:fix   # eslint --fix
```

## Project Structure

```
habit-tracker/
├── backend/               # Elysia + Drizzle API (built by feature sessions)
│   └── src/
│       ├── db/schema/     # Drizzle table definitions
│       ├── routes/        # Route groups (one file per domain), registered in create-api-app.ts
│       ├── services/      # Domain services (e.g. streak computation)
│       └── lib/           # Shared backend utilities
├── frontend/              # React 19 + Vite SPA (built by feature sessions)
│   └── src/
│       ├── pages/         # Route pages (dashboard, habit list)
│       ├── components/    # UI + shared components (shadcn/ui)
│       ├── api/           # API modules + independently-defined types (native fetch)
│       ├── stores/        # Zustand client state
│       └── lib/           # Shared frontend utilities
├── config/                # JSON-only config (example.json committed; local *.json gitignored)
├── data/                  # Local SQLite database (gitignored)
├── scripts/               # setup / start / stop tooling
└── .aidd/                 # Spec, feature backlog, and project tracking
```

## Technology

- **Runtime / package manager:** Bun.
- **Backend:** Elysia, Drizzle ORM, `bun:sqlite`, TypeBox validation, pino logging.
- **Frontend:** React 19, Vite, TanStack Query, Zustand, React Router, Tailwind CSS, shadcn/ui.
- **Config:** JSON-only (`config/*.json`); no `.env` files (`bunfig.toml` sets `env = false`).
- **Testing:** crawltest + `bun run smoke:qc` (no unit-test frameworks).

Architecture and conventions follow the Spernakit v3 standards documented in `AGENTS.md`.

## License

Private / unpublished.
