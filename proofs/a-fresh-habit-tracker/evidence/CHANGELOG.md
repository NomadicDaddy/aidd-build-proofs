# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Feature `theme-and-visual-polish` implemented and verified. The shadcn/ui theme, typography scale
  (Inter via `--font-sans`), light/dark token palettes (`:root` / `.dark` in
  `frontend/src/tailwind.css`), and the persisted Zustand theme store
  (`frontend/src/stores/uiStore.ts`, `persist` under key `habit-tracker-ui`) were already in place
  from prior sessions and satisfy spec steps 1–3: check-in cells and toggles use paired theme tokens
  (`bg-primary`/`text-primary-foreground`, `bg-muted`/`text-muted-foreground`, `ring-ring` on the
  today cell) that hold sufficient contrast in both modes. This session closed the remaining gap on
  spec steps 2 & 4 (theme persists across reloads) by eliminating a **flash of the wrong theme on
  reload**: previously the `dark` class was applied only in `RootLayout`'s `useEffect`, which runs
  after React mounts, so a dark-mode user briefly saw the light theme on every reload.
  `frontend/index.html` now runs a tiny blocking script in `<head>` that reads the persisted
  `habit-tracker-ui` store and applies the `dark` class to `document.documentElement` before first
  paint (defaulting to light, wrapped in try/catch for unavailable/malformed `localStorage`); the
  existing `RootLayout` effect keeps it in sync after mount. Browser verification (agent-browser
  against the running UI-managed app on localhost:3330, seed data, today 2026-07-02): cleared storage
  loads in light (default); clicking the header toggle switches to dark, persisting `state.theme:
"dark"` and adding the `dark` class (body background `oklch(0.145 0.015 260)`); after a full reload
  the `dark` class and dark background are present and `state.theme` is still `"dark"`; toggling back
  restores light (`oklch(0.985 0.002 247)`). `agent-browser errors` is empty on both `/` and
  `/habits`. Screenshots confirm high-contrast rendering in both modes — dark dashboard (blue-accent
  weekly cells, ringed today cell, blue "Done" toggle) and light habits page (blue "Done today"
  toggle, legible cells and form). `bun run smoke:qc` (prettier + lint + typecheck) passes clean.
  Marked `passes: true`, status `completed`. (Also formatted the pre-existing
  `theme-and-visual-polish/feature.json`, which was already modified on entry and failed the prettier
  gate.)
- Feature `testing-scenarios` implemented and verified: added a runnable **crawltest** browser smoke
  test that codifies the list/toggle/dashboard/detail route scenarios, plus a `crawltest` npm script.
  `scripts/crawltest.ts` is a dependency-free Bun script (no puppeteer, no unit-test framework — per
  AGENTS.md) that drives the environment's `agent-browser` CLI: it seeds `/` and `/habits`, discovers
  same-origin links transitively (e.g. habit detail routes), and for each route clears the console,
  navigates, asserts the page rendered real content (≥30 chars), collects console/JS errors, and
  writes screenshots for the primary flows to `.aidd/evidence/testing-scenarios/`. It supports
  `--page <route>` (single route) and `--start-from <prefix>` (scoped crawl) to match the workflow
  documented in AGENTS.md, and exits non-zero on any console error or render failure so it can gate
  changes alongside `bun run smoke:qc`. `package.json` gained `"crawltest": "bun scripts/crawltest.ts"`.
  Verification (agent-browser against the running UI-managed app on localhost:3330, seed data, today
  2026-07-02): `bun scripts/crawltest.ts` crawled 2 routes (`/`, `/habits`) with **0 issues** and no
  console errors, capturing `route-home.png` (dashboard done-vs-total "2 of 4 done" + weekly grid,
  spec step 4) and `route-habits.png` (active habit list, spec step 1). The toggle scenario (spec
  steps 3 & 8) was exercised live: marking "Meditate" done today flipped the button to "Mark today
  not done" and raised its current streak 7 → 8 (screenshot `scenario-toggle-meditate-done.png`);
  because the control is a single per-day toggle (done ⇄ not-done), a second same-day check-in cannot
  be produced through the UI — confirmed, then the check-in was toggled back off to restore the clean
  seed (streak back to 7). The empty-state scenario (spec step 9) is served by `HabitsPage`'s
  `habits.length === 0 ? <EmptyState />` branch ("No habits yet" + create CTA), which renders once all
  habits are archived since the list route only returns non-archived habits; verified by code path
  rather than destructively archiving all four seed habits. Create (step 2) and archive (step 5) flows
  were verified in prior sessions and remain covered by the route crawl.
    - _Environmental fix required to satisfy spec step 6 ("no console errors"):_ on entry the running
      dev server emitted a console `TypeError: Cannot read properties of null (reading 'useState')`
      from `sonner`'s `<Toaster>`, caused by Vite optimizing `sonner` in a later pass than `react`
      (mismatched `?v=` dep hashes) — a dev-cache artifact (production `vite build` is clean).
      `frontend/vite.config.ts` now sets `optimizeDeps.include: ['react', 'react-dom', 'sonner']` so
      they are pre-bundled together in one consistent pass. The running Vite server self-restarted on
      the config change (the launcher-owned `bun run dev` process was **not** torn down), re-optimized
      the deps, and after a fresh load `agent-browser errors` returns empty on both routes.
      `bun run smoke:qc` (prettier + lint + typecheck) passes clean. Marked `passes: true`, status
      `completed`.
- Feature `responsive-layout-styling` implemented and verified: tightened the responsive Tailwind
  layout so the app shell, habit list, and dashboard adapt cleanly from mobile to desktop without any
  horizontal overflow. Changes are UI-only and scoped to three files.
  `frontend/src/components/layout/RootLayout.tsx`: the header bar now uses mobile-first padding
  (`px-4 sm:px-6`) and `flex-wrap` with `gap-x-4 gap-y-2` so, on narrow viewports, the primary nav
  stays beside the brand and the theme toggle wraps to a second line instead of forcing overflow
  (spec step 3, nav collapses gracefully); the brand+nav group gap shrinks on mobile
  (`gap-3 sm:gap-6`), and the `<main>` container matches the header's mobile-first padding.
  `frontend/src/pages/habits/HabitRow.tsx`: the per-row action cluster (Mark done / Edit / Archive,
  plus the archive Confirm/Cancel pair) changed from a fixed `flex` to `flex flex-wrap justify-end`
  so the buttons wrap onto multiple lines on small screens rather than pushing the card wider than
  the viewport, while staying right-aligned and inline on desktop (spec steps 1 & 4). Each row's
  7-day grid and streak `dl` already used `flex-wrap`/`truncate`, so they were left unchanged.
  `frontend/src/pages/dashboard/DashboardPage.tsx`: the "Last 7 days" aggregate grid used fixed
  `size-9` (36px) cells with `justify-between`, whose 7 cells + gaps exceeded a 320px content width
  and overflowed; cells are now `size-8 sm:size-9` with `gap-1 sm:gap-1.5` and the card padding is
  `p-3 sm:p-4`, keeping all seven day cells legible and on-screen at the smallest common width
  (spec step 2). Browser verification (agent-browser against the running UI-managed app on
  localhost:3330, seed data, today 2026-07-02): at a 320×720 viewport both `/` and `/habits` report
  `document.documentElement.scrollWidth === clientWidth` (no horizontal overflow) with an empty
  console; screenshots confirm the header nav wrapping gracefully, the dashboard weekly grid showing
  all 7 cells, and each habit row's action buttons wrapping (Mark done + Edit on one line, Archive
  below) — all right-aligned. At 1280×800 there is no overflow and the layout is unchanged from
  before (header inline, action buttons on a single row), confirming no desktop regression.
  `bun run smoke:qc` (prettier + lint + typecheck) passes clean. Marked `passes: true`, status
  `completed`. (Also formatted the pre-existing `responsive-layout-styling/feature.json`, which was
  already modified on entry and failed the prettier gate.)
- Feature `habit-edit` implemented and verified: added an **inline edit affordance** to each habit row
  on the list page. The backend `PATCH /api/v1/habits/:id` route, the `updateHabit` API client, and the
  `useUpdateHabit` mutation (invalidates the `['habits']` prefix and the per-habit query) already
  existed; this feature added the UI. `frontend/src/pages/habits/HabitRow.tsx` now renders an "Edit"
  button (pencil icon) beside the today toggle; clicking it swaps the row's summary for a new
  `frontend/src/pages/habits/HabitEditForm.tsx` prefilled with the habit's current name, notes, and
  target. The form reuses the create form's name-required / positive-target validation, submits a
  partial `UpdateHabitInput` via `useUpdateHabit`, and on success closes back to the summary; the shared
  `MutationCache` reports failures while `useUpdateHabit` now also fires a `Saved changes to “<name>”.`
  success toast. Because the mutation invalidates the list query, the edited values (and the advanced
  `updatedAt`) appear in the row immediately. The Edit button is disabled while the archive confirm step
  is open so the two inline states can't overlap. Browser verification (agent-browser, running app on
  localhost:3330, seed data, today 2026-07-02): every habit row shows an accessible "Edit <name>"
  button; clicking "Edit Read 30 minutes" opened the form prefilled with name "Read 30 minutes",
  target 30, notes "Non-fiction, before bed." (spec step 2). Changing the target to 45 and clicking
  "Save changes" closed the form, raised the success toast, and the row reflected the change; a direct
  API read confirmed `target` moved 30 → 45 and `updatedAt` advanced from `22:42:43` to `22:49:20`
  (spec steps 3–4). The target was then restored to 30 via the API to leave the clean seed state.
  `bun run smoke:qc` (prettier + lint + typecheck) passes clean. Marked `passes: true`, status
  `completed`.
- Feature `habit-archive` implemented and verified: added a per-habit **archive action with a confirm
  step** to the list page. The backend `POST /api/v1/habits/:id/archive` endpoint, the `archiveHabit`
  API client, and the `useArchiveHabit` mutation (invalidates the `['habits']` prefix so the list,
  dashboard, and per-habit queries all refresh) already existed; this feature wired them into the UI.
  `frontend/src/pages/habits/HabitRow.tsx` now renders an "Archive" button next to the today toggle.
  Clicking it swaps into an inline confirm state (a `destructive`-styled "Confirm" + a "Cancel"),
  guarding against accidental archives; "Cancel" reverts to the plain button, "Confirm" fires the
  mutation (buttons disabled while pending, and the confirm state resets on error). Archiving is a
  soft-archive (`archived_at` timestamp) — the list route only returns non-archived habits, so the
  archived habit disappears from both the Habits list and the Dashboard while its check-ins are kept.
  Browser verification (agent-browser, running app on localhost:3330, seed data, today 2026-07-02):
  every habit row shows an accessible "Archive <name>" button; clicking "Archive Drink water" revealed
  the Confirm/Cancel pair and "Cancel" restored the button; archiving "Read 30 minutes" (13 check-ins)
  via Archive → Confirm removed it from the list, and the Dashboard dropped from "2 of 4 done" to
  "1 of 3 done" (Read excluded). A direct DB read (`data/habit-tracker.db`) confirmed
  `habits.archived_at` was set for `seed-habit-read` while all **13** of its rows in `checkins`
  remained intact (spec step 4). The habit was then restored (`archived_at = NULL`) to leave the clean
  4-habit seed state. `bun run smoke:qc` (prettier + lint + typecheck) and a full production build
  (`vite build`, 1856 modules) both pass clean. Marked `passes: true`, status `completed`.
    - _Environmental note (not from this feature):_ the running dev server currently throws a console
      error from `sonner`'s global `<Toaster>` (`App.tsx`) — `TypeError: Cannot read properties of null
(reading 'useState')` — caused by an inconsistent Vite `optimizeDeps` cache (the served
      `react.js`, `sonner.js`, and `react-dom_client.js` carry three different `?v=` hashes, where a
      healthy optimize run shares one). It is not a source defect: the production build compiles `sonner`
      with zero errors, typecheck is clean, and the error lives entirely in a file this feature never
      touched. It clears on a dev-server restart, which was not performed because the instance is
      UI/launcher-managed and must not be torn down mid-run.
- Feature `error-handling-toasts` implemented and verified: added `sonner` (2.0.7) plus a shadcn-style
  `Toaster` at the app root (`frontend/src/components/ui/sonner.tsx`, mounted in `App.tsx`), themed off
  the shared `useUiStore` light/dark state and styled with the project's `--popover`/`--border` tokens
  so toasts match the page. Error feedback is centralized: `frontend/src/lib/queryClient.ts` now
  configures a TanStack Query `MutationCache` whose `onError` fires `toast.error(...)` for **every**
  failed mutation (messages come from `ApiError.message`, falling back to a generic line), so individual
  mutations only own their success feedback and any rollback. Success toasts were added to the
  create-habit (`Added "<name>".`) and archive-habit (`Archived "<name>".`) mutations in
  `frontend/src/hooks/useHabits.ts`. The check-in toggle (`useToggleCheckin` in
  `frontend/src/hooks/useCheckins.ts`) was converted to an optimistic update: `onMutate` snapshots and
  optimistically adds/removes the day's check-in in the `queryKeys.checkins` cache (button + 7-day grid
  flip instantly), `onError` restores the snapshot (surfacing the change as reverted) while the shared
  `MutationCache` toast reports the failure, and `onSettled` invalidates `queryKeys.checkins` +
  `['habits']` so streaks/stats reconcile. Browser verification (agent-browser) against the running app
  (localhost:3330, seed data, today 2026-07-02): the sonner `Notifications` region mounts at root; a
  fetch override forcing `/checkins` POST/DELETE to 500 made "Drink water"'s toggle flip optimistically
  then **revert** to "Mark today done" with a "Simulated server error" toast; after restoring fetch,
  submitting the create form raised an "Added "Toast Test Habit"." success toast and the habit appeared
  in the list. The test habit (and its check-ins) were then removed directly from
  `data/habit-tracker.db`, restoring the original 4 seed habits; snapshot confirmed the clean state and
  no console errors. `bun run smoke:qc` (prettier + lint + typecheck) passes clean. Marked
  `passes: true`, status `completed`. (Also normalized two pre-existing feature.json files —
  `error-handling-toasts` and `empty-and-loading-states` — to the repo's prettier tab/sorted-key
  convention so the formatting gate passes.)
- Feature `empty-and-loading-states` implemented and verified: both primary pages already rendered
  loading skeletons (`HabitsSkeleton`/`DashboardSkeleton`) and "No habits yet" empty states; this
  feature completed the spec by making both empty states **link to the create-habit action**. The
  Habits page empty state (`frontend/src/pages/habits/HabitsPage.tsx`) now shows an "Add your first
  habit" button that scrolls to and focuses the create form's name field (the form in
  `HabitCreateForm.tsx` gained `id="add-habit"`; the button focuses `#habit-name`). The Dashboard
  empty state (`frontend/src/pages/dashboard/DashboardPage.tsx`) — which has no inline create form —
  now renders a react-router `Link` "Add your first habit" that routes to `/habits` where the create
  form lives. Skeletons render inside the same list/section structure as the loaded state (matching
  card heights and the 7-day grid), so there is no layout shift between loading and loaded; per-row
  stats fall back to sensible zeros while `useHabitStats` resolves, then fill in from the shared
  cache without reflowing. Browser verification (agent-browser): with all 4 seed habits temporarily
  archived to force the empty state, the Dashboard showed "No habits yet" + the CTA, clicking it
  navigated to `/habits`, and the Habits empty-state CTA moved focus to the name input
  (`document.activeElement.id === "habit-name"`); console error-free throughout. The seed habits were
  then restored (archived_at reset to NULL) and the loaded Dashboard/Habits states re-verified.
  `bun run smoke:qc` (prettier + lint + typecheck) passes clean. Marked `passes: true`, status
  `completed`.
- Feature `dashboard-overview` implemented and verified: the app landing route (`/`, index route in
  `frontend/src/routes.tsx`) now renders a real dashboard (`frontend/src/pages/dashboard/DashboardPage.tsx`)
  instead of the placeholder shell. It shows a "Today" header with the local date, a done-vs-total
  progress card with an accessible `progressbar`, a rolling 7-day grid **aggregated across all
  habits** (each column shows how many of the N habits were completed that day, today's column ringed),
  and a "Today's habits" list where each habit (`DashboardHabitItem.tsx`) shows its current streak and a
  quick done/undo toggle. Check-ins are fetched via `useQueries` under the **same** `queryKeys.checkins`
  keys the list page uses (and each row re-reads `useCheckins`/`useHabitStats`), so the dashboard and
  list page share one cache and always agree; the toggle mutation invalidates the `['habits']` prefix so
  counts, grid, and streaks refresh live. Archived habits are excluded because the source `useHabits`
  list route only returns non-archived habits. Empty, loading (skeleton), and error states are handled.
  Browser verification (agent-browser) against the seeded data (today 2026-07-02, 4 habits) confirmed:
  header "2 of 4 done"; weekly counts 06-26→07-02 = `2,3,2,2,3,3,2`; per-habit toggles matched done-today
  state (Morning run & Read pressed, Meditate & Drink water not); streaks Morning 6 / Read 3 / Meditate 7
  / Water 0 matched the stats API. Marking Meditate live raised the count 2→3 and today's grid cell 2→3
  and lifted its streak 7→8; unmarking reverted all three and restored the original state. Console
  error-free; `bun run smoke:qc` passes clean. Marked `passes: true`, status `completed`.
- Feature `weekly-grid` verified: each habit row on the list page (`frontend/src/pages/habits/HabitRow.tsx`)
  renders a rolling 7-day check-in grid built from `lastNDays(7)` (`frontend/src/lib/dates.ts`), which
  derives its window from `new Date()` — so the grid ends on today and rolls forward automatically as
  the current day changes (no hardcoded dates). Each column carries a one-letter weekday label and an
  accessible per-day label/`title` of its `YYYY-MM-DD` key (`… completed` when done); cells with a
  check-in are filled (`bg-primary`) and missed days are empty (`bg-muted`), with today's cell ringed.
  Browser verification (agent-browser) against the seeded data confirmed the rendered grid matches the
  check-ins API exactly: Morning run (window 2026-06-26 → 2026-07-02) showed `[empty, ✓,✓,✓,✓,✓,✓]`
  matching its check-ins (06-27…07-02), and Read 30 minutes showed `[✓,✓,empty,empty,✓,✓,✓]` matching
  its check-ins (06-26, 06-27, 06-30, 07-01, 07-02 with 06-28/06-29 gaps). Console error-free;
  `bun run smoke:qc` passes clean. Marked `passes: true`, status `completed`.
- Feature `today-toggle` verified: the "Mark done"/"Done today" button on each habit row
  (`frontend/src/pages/habits/HabitRow.tsx`) is wired to `useToggleCheckin`, which calls
  `markCheckin`/`unmarkCheckin` (`POST`/`DELETE /api/v1/habits/:id/checkins`) based on today's done
  state. The button reflects done state via `aria-pressed` and label, and is disabled while the
  mutation is pending, preventing duplicate same-day marks. On success the mutation invalidates the
  habit's check-in query and the `['habits']` prefix, so the derived streak stats and the 7-day grid
  refresh together. Browser verification (agent-browser) on the seeded data confirmed: marking
  "Meditate" today flipped the button, set today's grid cell to completed, and raised the current
  streak 7 → 8; unmarking reversed all three (8 → 7, cell cleared). Console error-free; `bun run
smoke:qc` passes clean. Marked `passes: true`, status `completed`.
- Feature `streak-display` verified: each habit row on the list page (`frontend/src/pages/habits/HabitRow.tsx`)
  now renders a three-stat summary — current streak (flame), longest streak (trophy), and 30-day
  completion rate (percent) — sourced from the `useHabitStats` hook (`GET /api/v1/habits/:id/stats`).
  The stats are a semantic `<dl>` with `sr-only` terms for accessibility; the completion fraction is
  shown as a rounded percent. Browser verification confirmed the rendered numbers match the stats API
  exactly (Morning run 6/6/20%, Read 30 minutes 3/10/43%), and that unmarking today lowers the current
  streak while the longest streak persists independently (Read 30 minutes shows current 3 vs. longest
  10). Toggling refreshes stats because the stats query key nests under `['habits']`, which the toggle
  mutation invalidates. Console error-free; `bun run smoke:qc` passes clean. Marked `passes: true`.
- Initializer scaffolding: 25 tracked feature files under `.aidd/features/` (all `passes: false`).
- Project directory structure for `backend/`, `frontend/`, `config/`, `data/`, and `scripts/`.
- `scripts/setup.ts` (environment setup — validates Bun, installs deps, prepares config/data).
- `scripts/start.ts` and `scripts/stop.ts` (agent-safe detached dev-server launcher).
- JSON-only config: `config/example.json` template and `bunfig.toml` (`env = false`).
- Root `tsconfig.json` and `@types/node` for script typechecking.
- Launchable root `package.json` scripts: `dev`, `start`, `stop`, `setup`.
- `README.md` and refreshed `.aidd/project-structure.md`.
- Backend workspace (`backend/package.json`, `backend/tsconfig.json`) with Elysia + pino dependencies.
- JSON config loader (`backend/src/lib/config.ts`) — reads `config/{slug}.json`, validates required
  sections, and resolves `database.url` to an absolute path anchored at the project root so the
  SQLite file always lands under `data/`.
- Shared pino logger (`backend/src/lib/logger.ts`).
- Elysia app factory (`backend/src/app.ts`) mounted under `/api/v1` with per-request pino logging and
  an error handler; backend entrypoint (`backend/src/index.ts`) that listens on the configured port.
- Health route `GET /api/v1/health` returning `{ status: "ok", uptime, timestamp }`.
- Feature `config-and-bootstrap` verified: backend boots, health route returns 200, and the database
  path resolves to `data/habit-tracker.db` with no `.db` file created elsewhere. Marked `passes: true`.
- Drizzle domain schema (`backend/src/db/schema/`): `habits` (id, name, cadence, notes, target,
  archivedAt, createdAt, updatedAt) and `checkins` (id, habitId, date `YYYY-MM-DD`, createdAt), with a
  unique constraint on (habitId, date) and a `fk_checkins_habits_habit_id` foreign key
  (`onDelete: cascade`). snake_case columns mapped to camelCase TS fields; inferred row types exported.
- SQLite db client (`backend/src/db/index.ts`) — lazily opens `bun:sqlite` at the config-resolved
  `data/` path with `PRAGMA foreign_keys = ON` and WAL, wrapped by Drizzle bound to the schema.
- Drizzle Kit config (`backend/drizzle.config.ts`) plus `db:push`/`db:generate`/`db:studio` scripts;
  `drizzle-orm` runtime dep and `drizzle-kit` + `better-sqlite3` (push driver) + `@types/bun` dev deps.
- Feature `habit-domain-schema` verified: `bun run --cwd backend db:push` created `habits` and
  `checkins` in `data/habit-tracker.db` (no stray `.db` elsewhere); a runtime probe confirmed the
  unique (habit, date) constraint blocks duplicate check-ins and the FK cascades on habit delete and
  rejects orphan check-ins. Marked `passes: true`.
- Root `typecheck` script (`tsc --noEmit && bun run --cwd backend typecheck`) covering the scripts
  tsconfig and the backend workspace.
- Feature `quality-gate-setup` verified: root `package.json` now exposes `format`, `lint`,
  `typecheck`, and `smoke:qc`; `bunfig.toml` keeps `env = false`; prettier config honors tabs,
  100-col width, and single quotes; ESLint runs with `--max-warnings 0` and reports zero warnings;
  `bun run smoke:qc` (prettier check + lint + typecheck) passes clean on the scaffold. Marked
  `passes: true`.
- Frontend workspace (`frontend/package.json`) with React 19 + Vite 8, React Router 7, TanStack
  Query 5, Zustand 5, Tailwind CSS 4 (`@tailwindcss/vite`), and the React Compiler babel plugin.
- Frontend build config: `vite.config.ts` (React Compiler, Tailwind, `@` → `src` alias, dev proxy
  `/api` → backend `:3331`, dev port `3330`), split `tsconfig.{json,app,node,build}.json`, and
  `index.html`.
- shadcn/ui base configuration: `components.json` (new-york, neutral, lucide) plus `src/tailwind.css`
  with light/dark CSS variable tokens and a `cn()` helper in `src/lib/utils.ts`.
- App shell wired end-to-end: `src/main.tsx` → `App` mounts a shared TanStack Query client
  (`src/lib/queryClient.ts`) around a `RouterProvider`; `src/routes.tsx` defines a root layout
  (`components/layout/RootLayout.tsx`) rendering the placeholder `pages/dashboard/DashboardPage.tsx`
  via `<Outlet />`. A persisted Zustand `useUiStore` drives a light/dark theme toggle in the header
  (immediate consumer). Named exports only.
- Feature `frontend-bootstrap` verified: `bun install` (frontend), `bun run --cwd frontend build`
  (tsc + vite build, 0 errors), and root `bun run smoke:qc` all pass; agent-browser confirmed the
  shell renders ("Habit Tracker" / "Today" placeholder), the theme toggle applies the `dark` class,
  and the browser console is error-free. Marked `passes: true`.
- Habit CRUD REST API (`backend/src/routes/habits.ts`) registered under `/api/v1` in `app.ts`:
  `POST /habits` (201; `name` required, `cadence` defaults to daily), `GET /habits` (lists only
  non-archived habits), `GET /habits/:id` (404 when missing), `PATCH /habits/:id` (updates name,
  notes, target), and `POST /habits/:id/archive` (soft-archives via `archivedAt`). Rows are returned
  as a typed `HabitDto` with ISO-string timestamps; every mutation bumps `updatedAt`, and archived
  habits stay fetchable by id. Handlers over ~30 lines are extracted into named functions
  (`createHabit`, `updateHabit`, `archiveHabit`, `findHabit`, `serializeHabit`).
- Feature `habit-crud-api` verified: with the backend running on `:3331`, curl exercised the full
  lifecycle — create (201, default daily cadence), list excludes archived, get-by-id (200/404),
  patch bumps `updatedAt` (confirmed timestamp change) with 404 on missing, archive sets `archivedAt`
  and removes the habit from the default list while it remains fetchable by id, and a missing `name`
  returns 422. Test rows were cleaned from the dev DB afterward. `bun run smoke:qc` passes clean.
  Marked `passes: true`.
- TypeBox request validation hardened on the habit routes (`backend/src/routes/habits.ts`): added a
  shared `habitIdParams` (`t.Object({ id: t.String({ minLength: 1 }) })`) params schema to every
  `:id` route (`GET`/`PATCH`/`POST .../archive`) and a shared `notFoundSchema` for their 404 bodies,
  complementing the existing `createHabitBody`/`updateHabitBody`/`habitDtoSchema` body/response
  schemas. Cadence stays constrained to the `daily` literal and `name` requires `minLength: 1`.
- Feature `api-validation-typebox` verified: with the backend on `:3331`, curl confirmed valid create
  succeeds (201, default daily cadence) while invalid payloads are rejected with 422 — missing
  `name`, `name` as a number, empty `name`, `cadence: "weekly"`, `target: "five"`, and a `PATCH`
  with `target: "nope"`; get-by-id still returns 200 and a missing id returns 404. The check-in date
  (`YYYY-MM-DD`) param validation from the feature spec applies to the check-in routes, which land
  under the later `checkin-tracking` feature and will inherit this same TypeBox pattern; no check-in
  routes exist yet to validate. Test row cleaned from the dev DB; `bun run smoke:qc` passes clean.
  Marked `passes: true`.
- Check-in tracking routes (`backend/src/routes/checkins.ts`) registered under `/api/v1` in `app.ts`:
  `POST /habits/:id/checkins` marks a day done (201 with the created check-in DTO; 404 for an unknown
  habit; 409 when that day is already marked, so duplicates never create a second row),
  `DELETE /habits/:id/checkins/:date` unmarks a day (204 on success, 404 when nothing is there), and
  `GET /habits/:id/checkins` lists a habit's check-ins (404 for an unknown habit). `date` is validated
  as `YYYY-MM-DD` via a shared TypeBox pattern (invalid formats → 422), and the unique (habitId, date)
  constraint from the schema backs the conflict guarantee. `findHabit` is now exported from
  `habits.ts` and reused for habit-existence checks; rows serialize to a `CheckinDto` with an
  ISO-string `createdAt`.
- Feature `checkin-tracking` verified: an in-process app-factory harness exercised the full lifecycle
  — list-empty (200 `[]`), mark (201), duplicate mark (409, no second row), list (200, one row),
  unmark (204), unmark-missing (404), mark on unknown habit (404), invalid date format (422), and
  list on unknown habit (404). The temporary habit/check-in rows were deleted from the dev DB
  afterward. `bun run smoke:qc` passes clean. Marked `passes: true`.
- Frontend API client layer (`frontend/src/api/`), decoupled from the backend workspace:
    - `types.ts` — independent DTO/input types (`Habit`, `Checkin`, `CreateHabitInput`,
      `UpdateHabitInput`, `HabitStats`, `Cadence`) mirroring the `/api/v1` JSON shapes.
    - `client.ts` — a minimal native-`fetch` JSON wrapper (`apiRequest`) with an `ApiError` class,
      JSON body/`Content-Type` handling, `204 No Content` support, and `{ error }` message parsing;
      no Axios.
    - `habits.ts` / `checkins.ts` — per-domain transport modules over the habit CRUD and check-in
      routes.
    - `stats.ts` — pure client-side `computeHabitStats` deriving current streak, longest streak,
      total completions, and a rolling 30-day completion rate from a habit's check-ins (no backend
      stats endpoint exists yet; a missed day breaks the current streak, today may be incomplete).
    - `queryKeys.ts` — centralized, prefix-nested TanStack Query keys so mutations invalidate the
      right queries.
- TanStack Query hooks (`frontend/src/hooks/`): `useHabits`, `useHabit`, `useCreateHabit`,
  `useUpdateHabit`, `useArchiveHabit` (habit CRUD, invalidating the list/detail on success) and
  `useCheckins`, `useHabitStats`, `useToggleCheckin` (check-in list, derived stats, and a
  mark/unmark toggle that invalidates the habit's check-ins plus the habit list).
- Feature `api-client-layer` verified: `bun run smoke:qc` passes clean (prettier + eslint
  `--max-warnings 0` + typecheck across all workspaces); a repo-wide grep confirms no frontend
  module imports from the backend workspace. Every client path was exercised against the live API —
  habit create/list/get/patch/archive against the running dev server, and the check-in
  mark (201) / duplicate (409) / list / unmark (204) / re-unmark (404) lifecycle against a
  throwaway backend booted on an alternate port (the long-running dev server predates the check-in
  routes). Query invalidation was verified by code review of the mutation `onSuccess` handlers
  against the shared `queryKeys`. All test rows were removed from the dev DB afterward. Marked
  `passes: true`.
- Client-side navigation and routing (`frontend-bootstrap` extended): `routes.tsx` now registers the
  dashboard (index), habit list (`/habits`), habit detail deep link (`/habits/:habitId`), and a
  catch-all `*` route. New placeholder pages `pages/habits/HabitsPage.tsx`,
  `pages/habits/HabitDetailPage.tsx`, and `pages/not-found/NotFoundPage.tsx` give every route a
  reachable page (the list/detail pages are fleshed out by later features). `RootLayout` gained a
  primary `<nav>` with `NavLink`s to Dashboard and Habits, using `end` on the root link so active
  state (`aria-current="page"`) is exact.
- Feature `navigation-and-routing` verified: `bun run smoke:qc` and the frontend build pass; with the
  Vite dev server on `:3330`, agent-browser confirmed the nav renders and links work, `/habits` and
  the deep link `/habits/abc123` resolve to their pages (id echoed), an unknown route
  (`/does/not/exist`) shows the not-found page, `aria-current` marks exactly the active link, and the
  browser console is error-free. Marked `passes: true`.
- Habit list page (`frontend/src/pages/habits/HabitsPage.tsx`) rendering all non-archived habits, each
  as a `HabitRow` (`frontend/src/pages/habits/HabitRow.tsx`) showing the habit name, a target/notes
  subtitle, the current streak, a today done/undo toggle, and a compact rolling 7-day check-in grid.
  Per-habit check-ins are fetched via `useCheckins`/`useHabitStats` (shared query cache) and the
  today toggle uses `useToggleCheckin`, so marking/unmarking today refreshes the grid and streak via
  query invalidation without a full page reload. Added local-calendar date helpers
  (`frontend/src/lib/dates.ts`: `toDayKey`, `todayKey`, `lastNDays`) as the grid's day window. The
  page renders a skeleton loading state while habits fetch, an empty state when there are none, and an
  inline error state on fetch failure.
- Feature `habit-list-page` verified: `bun run smoke:qc` passes (prettier + lint + typecheck). With
  the frontend on `:3330` and backend on `:3331`, agent-browser confirmed the empty state renders
  ("No habits yet"); after seeding a habit with check-ins on 2026-07-02/07-01/06-30 (consecutive) and
  a gapped 06-28, the row showed a "3-day streak" and a 7-day grid with exactly those days filled;
  clicking the today toggle unmarked today (button flipped to "Mark done", the 07-02 cell cleared,
  streak recomputed) and the DELETE reached the backend, then re-marking restored the check-in and the
  "3-day streak" — all without a reload; archived habits stayed out of the list; and the console was
  error-free. A stale pre-`docs`/`checkins` backend process was found serving `NOT_FOUND` for the
  check-in routes and was restarted to load current committed code (an in-process `app.handle()` probe
  confirmed the on-disk routes register correctly). Test rows were removed from the dev DB afterward.
  Marked `passes: true`.
- Create-habit form on the list page (`frontend/src/pages/habits/HabitCreateForm.tsx`), mounted above
  the habit list in `HabitsPage`. Uses token-styled native inputs (matching the existing `HabitRow`
  convention) for a required name, a cadence select (Daily only in the MVP), an optional positive-number
  target, and optional notes. Submits through the existing `useCreateHabit` mutation, which invalidates
  the habit list so the new habit appears without a reload. Client-side validation blocks an empty name
  (and a non-positive target) before submit with inline `aria-invalid` messaging; server errors surface
  in an alert; and all fields reset on a successful create.
- Feature `habit-create-form` verified via agent-browser against the running app: filling name/target/
  notes and submitting added "Morning run" to the list with the fields cleared afterward; submitting an
  empty name set `aria-invalid` and showed "Please enter a habit name." without creating a habit; the
  browser console was error-free. The test habit was removed from the dev DB afterward. `bun run
smoke:qc` passes clean. Marked `passes: true`.
- Streak/completion service (`backend/src/services/stats.ts`): pure `computeHabitStats(dates, today)`
  deriving `currentStreak` (run of consecutive done days ending today, or yesterday when today is
  unmarked), `longestStreak` (longest consecutive run ever, never decreasing when the current streak
  resets), a rolling 30-day `completionRate` (done days / 30), and `totalCheckins`. Days are compared
  as `YYYY-MM-DD` calendar keys, so gaps across month boundaries are handled correctly.
- Stats route (`backend/src/routes/stats.ts`) registered under `/api/v1`: `GET /habits/:id/stats`
  returns the derived stats (404 when the habit is missing); an empty check-in history yields zero
  streaks and zero completion. Selects only the check-in `date` column and delegates to the service.
- Frontend now consumes the backend as the source of truth for streak math: `getHabitStats` caller
  (`frontend/src/api/stats.ts`, replacing the client-side computation), a `stats` query key, and
  `useHabitStats` fetching `/habits/:id/stats`. The check-in toggle invalidates the `['habits']`
  prefix, which also refreshes stats.
- Feature `streak-computation` verified: `GET /habits/:id/stats` returned correct stats for seeded
  habits (Morning run current/longest 6, completion 0.2); a fresh habit with no check-ins returned all
  zeros; marking an old day plus today restarted the current streak at 1 while the completion window
  counted only in-window days; a missing habit returned 404. agent-browser confirmed the habits page
  renders the streaks (6/3/7/0) from the endpoint with an error-free console. Test rows were removed
  from the dev DB. `bun run smoke:qc` passes clean. Marked `passes: true`.

### Changed

- Replaced the placeholder `dev` script in `package.json` with a real launch contract.
- Extended `smoke:qc` to also run `typecheck` after the prettier and lint gates.
- Extended root `typecheck` to also run the frontend workspace typecheck
  (`bun run --cwd frontend typecheck`).
- OpenAPI documentation plugin (`backend/src/routes/docs.ts`) using `@elysiajs/swagger`, mounted
  inside the `/api/v1` prefix so the generated OpenAPI JSON is served at `/api/v1/docs/json` (with the
  interactive UI at `/api/v1/docs`). Info title/description are sourced from the app config, and
  routes are grouped under `Habits`, `Check-ins`, and `Health` tags via per-route `detail.tags`.
- Feature `api-docs-openapi` verified: `GET /api/v1/docs/json` returns 200 with a valid OpenAPI 3.0.3
  document; all habit and check-in routes appear with their request/response schemas; and the spec
  reflects the TypeBox validation constraints (e.g. `POST /habits` body requires `name` with
  `minLength: 1`, and the check-in `date` carries the `^\d{4}-\d{2}-\d{2}$` pattern). The document is
  generated from the route schemas, so it stays in sync as the contract source of truth.
  `bun run smoke:qc` passes clean. Marked `passes: true`.
- Development seed script (`backend/src/db/seed.ts`, run via `bun run --cwd backend db:seed`):
  inserts four sample habits (Morning run, Read 30 minutes, Meditate, Drink water) with fixed
  well-known ids and shapes their check-ins to produce visible streaks — Morning run has a 6-day
  current streak ending today, and Read 30 minutes has a 10-day longest streak that exceeds its
  3-day current streak (broken-then-resumed). The script is reset-safe: it deletes only its own
  seed habit ids first (the FK cascade clears their check-ins) before reinserting, so repeated
  runs converge on the same state without disturbing hand-created habits.
- Feature `seed-data` verified: `db:seed` ran twice and the DB held a stable 4 habits / 26
  check-ins both times (idempotent); `GET /api/v1/habits` returned the seeded habits and the
  per-habit `/checkins` endpoints confirmed the intended current/longest streak date ranges.
  `bun run smoke:qc` passes clean. Marked `passes: true`.

### Deprecated

### Removed

### Fixed

### Security

## [0.1.0] - 2026-07-02

### Added

- Project initialization complete — ready for feature development.
