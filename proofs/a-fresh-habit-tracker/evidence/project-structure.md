# Project Structure

## Overview

Habit Tracker is a single-user, local-first app for building and keeping daily habits. It serves one
person tracking their own habits on their own machine — no accounts, auth, sync, or cloud. The primary
constraints: JSON-only config (no `.env`), a local SQLite database confined to `data/` at the project
root, and the Spernakit v3 stack/conventions documented in `AGENTS.md`.

## Repository Layout

### Root Level

```
habit-tracker/
├── backend/       # Elysia + Drizzle API (built by feature sessions)
├── frontend/      # React 19 + Vite SPA (built by feature sessions)
├── config/        # JSON-only config (example.json committed; local *.json gitignored)
├── data/          # Local SQLite database (gitignored)
├── scripts/       # setup / start / stop tooling
└── .aidd/         # Spec, feature backlog, and project tracking
```

### Backend Layout (backend/)

```
backend/
└── src/
    ├── db/schema/   # Drizzle table definitions (habits, checkins)
    ├── routes/      # Route groups (one file per domain), registered in create-api-app.ts
    ├── services/    # Domain services (e.g. streak computation)
    └── lib/         # Shared backend utilities (config loader, etc.)
```

### Frontend Layout (frontend/)

```
frontend/
└── src/
    ├── pages/       # Route pages (dashboard, habit list)
    ├── components/  # UI + shared components (shadcn/ui)
    ├── api/         # API modules + independently-defined types (native fetch)
    ├── stores/      # Zustand client state
    └── lib/         # Shared frontend utilities
```

## Key Concepts / Modules

### Habit

- **Responsibility**: A tracked daily habit — name, cadence, optional target/notes, archived flag.
- **Key files**: `backend/src/db/schema/habits.ts`, `backend/src/routes/habits.ts`.

### Check-in

- **Responsibility**: One record per (habit, date) marking that day done; unique per habit per day.
- **Key files**: `backend/src/db/schema/checkins.ts`, `backend/src/routes/checkins.ts`.

### Streak

- **Responsibility**: Derived stats — current run of consecutive done days, longest run, completion rate.
- **Key files**: `backend/src/services/streaks.ts`.

## Technology Stack

### Backend

- **Runtime**: Bun
- **Framework**: Elysia
- **Database**: SQLite via `bun:sqlite`, Drizzle ORM
- **Validation**: TypeBox (via Elysia)
- **Auth**: None (single-user, local-first)

### Frontend

- **Framework**: React 19 + Vite
- **Routing**: React Router
- **State/Data**: TanStack Query (server state) + Zustand (client state)
- **Styling**: Tailwind CSS + shadcn/ui

## Data Model Overview

- **habits**: id, name, cadence, notes, target, archivedAt, createdAt, updatedAt.
- **checkins**: id, habitId, date (YYYY-MM-DD), createdAt; unique on (habitId, date).
- Snake_case DB columns, camelCase TS fields; timestamps on both tables.

## API Overview

- **Base path**: `/api/v1`
- **Auth model**: None.

## Development Workflow

- **Install**: `bun run setup`
- **Dev**: `bun run start` (detached) / `bun run dev` (foreground)
- **Tests**: `bun run smoke:qc` + crawltest scenarios
- **Build**: per-workspace Vite/Bun build (added by feature sessions)

## Notes / Gotchas

- Database files live ONLY in `data/` at the project root — never `backend/data/`.
- No `.env` files anywhere; `bunfig.toml` sets `env = false`. Config is `config/*.json`.
- `config/*.json` is gitignored except `example.json`; setup derives the local config from it.
- Named exports only — no default exports (enforced by ESLint).
