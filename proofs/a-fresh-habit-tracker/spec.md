# Habit Tracker

> **Build-proof (a): aidd `fresh` scaffold.** A small, self-contained bespoke app created via aidd's
> fresh creation lane — aidd picks and stands up the stack from this spec. Kept deliberately small so
> the proof completes quickly while still exercising real domain logic (streaks), not just CRUD.

## Overview

A single-user habit tracker for building and keeping daily habits. You define habits, check them off
each day, and the app shows current and longest streaks plus a simple weekly grid. Local-first, no
accounts, no cloud.

## Intended Users

- One person tracking their own habits on their own machine.

## Primary Goals

1. Define habits with a name, cadence (daily), and optional target/notes.
2. Check a habit done (or undo) for a given day.
3. Compute and show current streak, longest streak, and completion rate per habit.
4. Give an at-a-glance overview: today's habits and a rolling weekly grid.

## Non-Goals

- No multi-user, accounts, auth, or sync.
- No reminders/notifications, no mobile app, no cloud services.
- No arbitrary cadences beyond daily in MVP (weekly/custom is a later idea).

## Technology Baseline

Let aidd's fresh scaffold choose the stack (its default is Bun + TypeScript with a small React
frontend and local SQLite under `data/`). JSON-only config, no `.env`. Validation gate:
`bun run smoke:qc`.

## Core Concepts

- **Habit** — name, cadence, optional target/notes, created/updated timestamps, archived flag.
- **Check-in** — one record per (habit, date) marking that day done; unique per habit per day.
- **Streak** — derived from check-ins: current run of consecutive done days, and the longest ever run.

## Data Model

- `habits` — id, name, cadence, notes, target, archivedAt, createdAt, updatedAt.
- `checkins` — id, habitId, date (YYYY-MM-DD), createdAt; unique on (habitId, date).

Snake_case DB columns, camelCase TS fields; timestamps on both tables.

## Feature Backlog (aidd IDs)

1. `habit-domain-schema` — habits + checkins tables and migrations, with the unique (habit, date)
   constraint.
2. `habit-crud-api` — create/list/update/archive habits; toggle a day's check-in; REST under
   `/api/v1`.
3. `habit-list-page` — list habits with today's done toggle and a compact 7-day grid per habit.
4. `checkin-tracking` — mark/unmark a habit for any day; prevent duplicate same-day check-ins.
5. `streak-computation` — current streak, longest streak, and 30-day completion rate per habit,
   handling gaps correctly (a missed day breaks the current streak).
6. `dashboard-overview` — today's habits with quick-toggle, count done vs. total, and a rolling
   weekly grid across all habits.
7. `habit-detail-history` — per-habit page with a month calendar of check-ins and the streak stats.
8. `testing-scenarios` — crawl scenarios for the list, toggle, and dashboard flows.

## Milestone Plan

- **MVP:** features 1–6 + `testing-scenarios` (schema, API, list page with toggle, check-in tracking,
  streaks, dashboard). This is the proof scope.
- **v1.0:** `habit-detail-history`, weekly/custom cadences, edit-in-place, CSV export.

## Acceptance Criteria

- I can add a habit, check it done for today, and see the current streak increment.
- Missing a day breaks the current streak but preserves the longest streak.
- The dashboard shows today's habits and a weekly grid that reflects real check-ins.
- Duplicate same-day check-ins are impossible (enforced in the schema and API).
- All backend routes are registered, typed, validated, and have frontend callers.
- `bun run smoke:qc` passes before the app is considered working.
