# Kanban Board

> **Build-proof (b): third-party template init.** Created by scaffolding the registered `vite-react`
> template (create-then-ingest), then having aidd build the app on top of the third-party scaffold.
> A client-only SPA so it fits the bare Vite + React scaffold cleanly and the proof stays small.

## Overview

A local, single-user Kanban board: boards with columns and cards you drag between columns. State
persists in the browser (localStorage) — no backend, no accounts, no cloud.

## Intended Users

- One person organizing personal work on their own machine.

## Primary Goals

1. Create boards, each with ordered columns (e.g. To Do / Doing / Done).
2. Create, edit, and delete cards within columns.
3. Drag cards between and within columns to reorder and change status.
4. Persist everything locally so a reload restores the board.

## Non-Goals

- No backend, database, accounts, auth, real-time collaboration, or cloud sync in MVP.
- No due-date reminders/notifications; no attachments.

## Technology Baseline

Scaffold from the registered **`vite-react`** template (Vite + React + TypeScript). Client-only state
with a small store (Zustand or React context) persisted to `localStorage`. Validation gate:
`bun run smoke:qc` (typecheck + build + the crawl scenarios); no server.

## Core Concepts

- **Board** — a named board owning an ordered list of columns.
- **Column** — a named lane owning an ordered list of cards.
- **Card** — title, optional description, labels, and position within its column.

## Data Model (client state, persisted to localStorage)

- `Board { id, name, columnOrder: string[] }`
- `Column { id, boardId, name, cardOrder: string[] }`
- `Card { id, columnId, title, description?, labels: string[], createdAt, updatedAt }`

Ordering is explicit (`columnOrder` / `cardOrder`) so drag-and-drop is deterministic.

## Feature Backlog (aidd IDs)

1. `board-domain-model` — typed board/column/card model and a persisted store (localStorage) with
   ordering.
2. `board-management` — create/rename/delete boards; switch the active board.
3. `column-management` — add/rename/delete/reorder columns.
4. `card-crud` — add/edit/delete cards; title + description + labels.
5. `card-drag-and-drop` — drag cards within and across columns and reorder columns, updating order
   arrays.
6. `board-filters-search` — filter/search cards by text and label across the active board.
7. `local-persistence` — hydrate from and persist to localStorage; survive reload; guard against
   corrupt state.
8. `testing-scenarios` — crawl scenarios for card CRUD, drag-and-drop, and persistence.

## Milestone Plan

- **MVP:** features 1–5 + `local-persistence` + `testing-scenarios` (boards, columns, cards, DnD,
  reload-safe). This is the proof scope.
- **v1.0:** `board-filters-search`, card due dates, multiple boards UI, import/export JSON.

## Acceptance Criteria

- I can create a board with columns, add cards, and drag a card between columns; the change sticks
  after reload.
- Reordering cards within a column persists.
- Deleting a column moves or removes its cards predictably (define which — MVP may block deleting a
  non-empty column).
- Corrupt or missing localStorage falls back to a clean default board without crashing.
- `bun run smoke:qc` passes (typecheck, build, crawl scenarios).
