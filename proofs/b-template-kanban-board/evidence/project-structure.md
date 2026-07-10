# Project Structure

## Overview

**kanban-board** is a local, single-user Kanban board built as a client-only SPA. Boards own ordered
columns, columns own ordered cards, and cards are dragged between and within columns to reorder and
change status. All state lives in the browser (`localStorage`) — there is **no backend, no accounts,
no auth, and no cloud sync**. It is a build-proof project scaffolded from the registered `vite-react`
template (Vite + React + TypeScript), chosen so the proof stays small and fits the bare scaffold.

The primary constraint is that everything is client-side and reload-safe: a page refresh must restore
the board, and corrupt/missing `localStorage` must fall back to a clean default board without crashing.

## Current Implementation State (2026-07-02)

**Scaffold stage — 0 of the product features are implemented.** `src/App.tsx` is still the stock Vite
starter (a `useState` counter plus documentation/social links). None of the domain model, store,
persistence, or drag-and-drop exists yet. Build and lint pass; the `bun run smoke:qc` gate exists and
is green. See `.aidd/reports/feature-coverage-audit-2026-07-02.md` and
`.aidd/audit-reports/CODEBASE_ANALYSIS-2026-07-02.md`.

## Repository Layout

```
kanban-board/
├── src/                      # Application source (currently the stock Vite scaffold)
│   ├── main.tsx              # React 19 root mount (StrictMode)
│   ├── App.tsx               # STOCK Vite starter — to be replaced by the kanban shell (app-shell-layout)
│   ├── App.css, index.css    # Scaffold styles
│   └── assets/               # Stock Vite/React logos + hero image
├── public/                   # Static assets served as-is (favicon.svg, icons.svg)
├── index.html                # Vite entry HTML
├── dist/                     # Vite build output (git-ignored)
├── package.json              # Scripts + deps (React 19, Vite 8, oxlint, prettier)
├── tsconfig.json             # Project references -> tsconfig.app.json + tsconfig.node.json
├── tsconfig.app.json         # App TS config (strict: true)
├── tsconfig.node.json        # Node/build TS config (strict: true)
├── vite.config.ts            # Vite + @vitejs/plugin-react
├── .oxlintrc.json            # Lint config (oxlint is the linter, NOT eslint)
├── .prettierrc               # Prettier style: tabs, 100 cols, single quotes, semicolons
├── .prettierignore           # Excludes .aidd/, node_modules/, dist/, etc.
├── AGENTS.md                 # Assistant/contributor rules (spernakit-like conventions)
└── .aidd/                    # aidd tracking artifacts (spec, features, reports — git-tracked, prettier-ignored)
```

There is **no** `backend/`, `frontend/`, `scripts/`, `drizzle/`, or database directory — this is a
bare, client-only Vite SPA. (An untracked, vestigial `frontend/eslint.config.js` and root
`eslint.config.js` may reappear as template drift; see `.aidd/todo.md` — they are dead config, not
part of the real structure.)

## Planned Key Concepts / Modules

These do not exist yet; they are the target structure implied by the spec and the feature backlog.

### Domain Model + Store (`board-domain-model`)

- **Responsibility**: Typed `Board` / `Column` / `Card` entities and a client store with explicit
  ordering arrays (`columnOrder`, `cardOrder`).
- **Likely files**: `src/store/`, `src/types/` (or colocated), a Zustand store or React context.

### Persistence (`local-persistence`)

- **Responsibility**: Hydrate from and persist to `localStorage`; validate shape; fall back to a
  clean default board on corrupt/missing state.

### Board / Column / Card UI

- **Responsibility**: App shell (`app-shell-layout`), board view (`board-view-render`), column headers
  (`column-header-controls`), card items (`card-item-render`), and the card editor (`card-editor-form`).

### Drag-and-Drop (`card-drag-and-drop`)

- **Responsibility**: Reorder cards within a column, move cards across columns, and reorder columns,
  updating the ordering arrays deterministically.

## Data Model Overview

Client state, persisted to `localStorage` (see `spec.md`):

- `Board { id, name, columnOrder: string[] }`
- `Column { id, boardId, name, cardOrder: string[] }`
- `Card { id, columnId, title, description?, labels: string[], createdAt, updatedAt }`

Ordering is explicit (`columnOrder` / `cardOrder`) so drag-and-drop is deterministic.

## Technology Stack

### Frontend (only tier)

- **Runtime**: Browser (client-only SPA)
- **Framework**: React 19
- **Bundler**: Vite 8 (`@vitejs/plugin-react`)
- **Language**: TypeScript ~6 (strict mode enabled in both tsconfigs)
- **Routing**: none (single view)
- **State/Data**: client store (Zustand or React context per spec/`project.md`) persisted to `localStorage`
- **Styling**: plain CSS (no Tailwind)
- **Package manager**: bun

### Backend / Database

- None. No server process, no database, no network I/O by design.

## Development Workflow

- **Install**: `bun install`
- **Dev**: `bun run dev` (Vite dev server — do NOT run inline in unattended sessions)
- **Lint**: `bun run lint` (oxlint)
- **Typecheck**: `bun run typecheck` (`tsc -b --noEmit`)
- **Format**: `bun run format` / `bun run format:check` (prettier)
- **Build**: `bun run build` (`tsc -b && vite build`)
- **Quality gate**: `bun run smoke:qc` (typecheck + lint + build + format:check)

## Notes / Gotchas

- **Linting is oxlint, not eslint.** Any `eslint.config.js` in the tree is vestigial spernakit drift
  and is not executed by `bun run lint`.
- **`.aidd/` is prettier-ignored**, so aidd tracking artifacts are never reformatted by `format`.
- **Reload-safety is a hard acceptance criterion.** Persist on every mutation and guard hydration.
- **Security surface**: card text is rendered via JSX escaping — never introduce
  `dangerouslySetInnerHTML`.
- **Non-empty column delete rule** is a deliberate product decision (`column-delete-nonempty-rule`);
  MVP may block deleting a non-empty column. Do not orphan cards.
