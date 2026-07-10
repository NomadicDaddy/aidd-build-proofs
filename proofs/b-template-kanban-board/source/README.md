# Kanban Board

A local, single-user Kanban board: boards with columns and cards you drag between columns. All state
persists in the browser via `localStorage` — **no backend, no accounts, no cloud sync**. Built as a
client-only SPA with Vite + React + TypeScript.

On first run the app seeds a starter board named **My Board** with three columns (To Do / Doing /
Done) and a welcome card, so there is always something on screen to work with.

## Prerequisites

- [Bun](https://bun.sh) (package manager + task runner)
- Node version per `.nvmrc`

## Setup

```bash
bun install
```

## Running

```bash
bun run dev       # start the Vite dev server (http://localhost:5173 by default)
bun run build     # type-check + production build to dist/
bun run preview   # preview the production build
```

Open the printed URL and you can use everything below immediately — no sign-in, no configuration.

## Using the board

### Boards

Board controls live in the header (the **BoardBar**):

- **Switch boards** — pick a board from the dropdown to make it active.
- **New board** — click **New board**, type a name, and press Enter (or click **Create**). The new
  board becomes active. Escape cancels.
- **Rename** — click **Rename**, edit the name, press Enter or click **Save**.
- **Delete** — click **Delete** to remove the active board; the app switches to the first remaining
  board. The **only** board can't be deleted, so you always have a board to work in.

### Columns

Each board holds an ordered list of columns (lanes). Use the trailing **+ Add column** affordance
and the controls in each column header:

- **Add a column** — click **+ Add column** at the end of the strip, type a name, press Enter. The
  form stays open so you can add several in a row; click **Done** or press Escape to close it.
- **Rename** — click **Rename** in the column header, edit, and commit with Enter/**Save**.
- **Reorder** — use the **◀ / ▶** buttons in the header to move a column left or right (disabled at
  the ends), or **drag the column header** and drop it onto another column to place it there.
- **Delete** — click **Delete** in the header. This is **blocked while the column still holds cards**
  (the button is disabled with a tooltip explaining why) so no card is ever orphaned. Empty the
  column first — move or delete its cards — then delete it.

### Cards

Each column header shows a count badge of its cards. Card controls:

- **Add a card** — click **+ Add card** at the bottom of a column. A modal editor opens where you
  set a **title** (required), an optional **description**, and any number of **labels** (type a label
  and press Enter or click **Add label**; click a label's **×** to remove it). Click **Add card** to
  commit; Cancel, Escape, or a backdrop click discards it.
- **Edit** — click **Edit** on a card to reopen the same editor pre-filled with its values. The
  card's creation time is preserved and its "updated" time advances on save.
- **Delete** — click **Delete** on a card to remove it from its column.

### Moving cards (drag-and-drop + keyboard)

- **Drag-and-drop** — drag a card and drop it **onto another card** to insert it directly before that
  card, or drop it **into empty column space** to append it to the end of that column. This works
  both **within a column** (reordering) and **across columns** (changing status). Column order and
  card order are stored explicitly, so the result is deterministic and survives a reload.
- **Keyboard / accessible move** — drag-and-drop can't be operated by keyboard alone, so every card
  also has **◀ / ▶** buttons that move it to the previous / next column. They are disabled at the
  board's ends. A keyboard-visible focus ring highlights the focused control as you Tab through the
  UI.

### Filtering and search

A toolbar under the header filters the visible cards on the active board:

- **Search** — type in the search box to match cards whose **title or description** contains the text
  (case-insensitive).
- **Filter by label** — pick a label from the menu to show only cards carrying it (or **All labels**
  for none).
- **Clear** — resets both criteria.

Filtering only hides cards from view; it never deletes them or changes a column's real card count, so
you can't delete a column just because a filter emptied it on screen. Filter state is **per session
and never persisted** — a reload always starts unfiltered, and switching boards clears it.

## Persistence and data storage

- All data lives in your browser's **`localStorage`** under a single versioned key
  (`kanban-board:v1`). It is **single-user and local-only** — nothing is sent to a server, and the
  board does not sync across browsers or devices.
- Every edit is saved automatically, so a reload restores the board exactly as you left it.
- **Corrupt / missing / version-mismatched state falls back to a clean default board** rather than
  crashing: if the stored data is unparseable, the wrong shape, or written by a newer/unknown schema
  version, the app discards it and reseeds the starter board. To wipe everything and start fresh,
  clear this site's `localStorage` (e.g. via your browser's dev tools).

## Quality gate

```bash
bun run smoke:qc  # typecheck + lint + build + format:check (the spec's acceptance gate)
```

Individual scripts:

- `bun run typecheck` — `tsc -b --noEmit`
- `bun run lint` — oxlint (`.oxlintrc.json`)
- `bun run format` / `bun run format:check` — prettier (tabs, 100 cols, single quotes, semicolons)

## Data model

Client state, persisted to `localStorage` (see `.aidd/spec.md`):

- `Board { id, name, columnOrder: string[] }`
- `Column { id, boardId, name, cardOrder: string[] }`
- `Card { id, columnId, title, description?, labels: string[], createdAt, updatedAt }`

Ordering is explicit (`columnOrder` / `cardOrder`) so drag-and-drop is deterministic.

## Project structure

See `.aidd/project-structure.md` for the full layout and technology stack. In short: a bare Vite SPA
with all source under `src/` (`components/`, `store/`, `types/`), static assets under `public/`, and
aidd tracking artifacts under `.aidd/`. There is no backend, database, or server.

## Tech stack

- React 19, Vite 8, TypeScript ~6 (strict mode)
- oxlint for linting, prettier for formatting
- Plain CSS (no Tailwind); client-side state (Zustand store) persisted to `localStorage`
