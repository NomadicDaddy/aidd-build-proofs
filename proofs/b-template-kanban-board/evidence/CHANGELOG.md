# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Acceptance testing scenarios wired into the gate (2026-07-02):** Completed feature
  `testing-scenarios` (priority 3; depends on the passing `card-crud` + `card-drag-and-drop` +
  `local-persistence`). Authored `scripts/scenarios.ts` — a headless "documented crawl step" that
  drives the **real** store actions, persistence, and selectors (the same code the browser runs), not
  a reimplementation — and asserts all ten scenarios from `.aidd/testing-scenarios.md` end-to-end,
  including reload persistence via the actual `loadState()` (exactly what the app hydrates from on a
  page refresh). It installs a small in-memory `localStorage` polyfill on `globalThis` before the
  store modules load so hydration and the persist subscription round-trip through it. No test
  framework was added: a plain `node:assert/strict` runner reports PASS/FAIL per scenario and exits
  non-zero on any failure. Coverage maps 1:1 to the spec's scenarios — (1) create board + To
  Do/Doing/Done, add cards, drag one across, reload survives; (2) multi-board rename/switch/delete
  with siblings untouched; (3) add/rename/reorder a column, reload keeps name + order; (4) non-empty
  column delete blocked (no orphaned cards) while an empty column deletes; (5) card
  title/description/labels edited field-by-field, `createdAt` preserved; (6) within-column reorder;
  (7) cross-column move updates source/target + `columnId` and survives reload; (8) card delete
  clears `cardOrder` and stays gone; (9) text/label/combined filtering shows only matches and never
  touches the persisted count; (10) corrupt / wrong-shape / version-mismatched / empty storage all
  fall back to a clean seed board with no crash. Wired into the gate via a new `test:scenarios`
  script appended to `smoke:qc` (`typecheck && lint && build && format:check && test:scenarios`).
  **Verification:** `bun run smoke:qc` passes clean and exits 0 with all 10 scenarios reporting PASS
  (spec points 11 & 12). Source (`src/**`) was not modified — this iteration only added the scenario
  harness and the `package.json` script wiring.

- **User-facing usage documentation (2026-07-02):** Completed feature `usage-documentation`
  (priority 5; depends on the passing `card-crud` + `card-drag-and-drop`). The root `README.md` was
  stale — it carried a "Status: scaffold / not implemented yet" notice and described only target
  behavior. Rewrote it into a usage guide that reflects the shipped UI, verified section-by-section
  against the actual components/store: board management (BoardBar — switch/new/rename/delete, the
  only-board-can't-be-deleted rule), column management (AddColumn + ColumnLane header — add, rename,
  ◀/▶ + drag reorder, and the **non-empty-column delete rule** that disables Delete while cards
  remain), card CRUD (AddCard/CardEditor modal — required title, optional description, add/remove
  labels; Edit preserves createdAt), drag-and-drop (drop-on-card = insert before, drop-in-empty =
  append; within and across columns) plus the keyboard ◀/▶ card-move accessible alternative,
  filter/search (title+description case-insensitive search + label menu, session-only and never
  persisted, never affecting the real card count), and persistence (single-user, local-only
  `localStorage` under `kanban-board:v1`, with the **corrupt/missing/version-mismatched fallback** to
  a clean reseeded board). All four content spec points plus the "reflects shipped UI, not the stock
  Vite template" check are satisfied. Documentation-only change — no source touched.
  **Verification:** `bun run smoke:qc` (typecheck + oxlint + build + format:check) passes clean;
  README claims cross-checked against `src/App.tsx`, `BoardBar`, `ColumnLane`, `CardItem`,
  `CardEditor`, `AddCard`, `AddColumn`, and `store/persistence.ts`.

- **Responsive board layout (2026-07-02):** Verified and completed feature `responsive-layout`
  (priority 4; depends on the passing `app-shell-layout`). All three spec points are satisfied by the
  existing shell CSS (`src/App.css`), so this iteration verified the behavior end-to-end rather than
  rebuilding it: (1) the columns strip scrolls horizontally when columns exceed the viewport —
  `.board-columns { display: flex; overflow-x: auto; overflow-y: hidden }` with fixed-width
  `.column { flex: 0 0 260px }` lanes; (2) the layout stays usable at a narrow mobile width — a single
  260px lane fits the client area with the rest reachable by horizontal scroll; (3) only the columns
  area scrolls, never the whole page — `.board-area { overflow: hidden }` caps the strip inside the
  shell so the document width never exceeds the viewport.
  **Verification:** browser (`agent-browser` against the already-running `vite preview` on :4173
  serving the fresh build; localStorage cleared afterward to restore the seed board). At a 375px
  viewport the document did not overflow (`documentElement.scrollWidth === window.innerWidth === 375`)
  while the columns area itself scrolled (`scrollWidth > clientWidth`, a 260px lane in a 327px client).
  At a 1280px desktop viewport, adding four columns through the "+ Add column" UI (7 lanes total,
  `colsScrollW 2152 > clientW 1232`) made the columns strip scroll horizontally with the page still
  not overflowing (`pageOverflow: false`). `agent-browser errors` was empty throughout. `bun run
  smoke:qc` (typecheck + oxlint + build + format:check) passes clean. No source changes were required.

- **Persistence resilience — corrupt-state fallback (2026-07-02):** Completed feature
  `persistence-resilience` (priority 4; depends on the passing `local-persistence`). The persistence
  layer (`src/store/persistence.ts`) already parsed defensively (try/catch around `JSON.parse`) and
  validated the parsed envelope shape against the domain model before adopting it, with
  `useBoardStore` falling back to `createSeedState()` via `loadState() ?? createSeedState()` — so
  invalid and wrong-shape payloads were already handled. This session closed the one gap the feature
  description called out (**version-mismatched** storage must yield the clean default board):
  `loadState()` now rejects any envelope whose `version !== STORAGE_VERSION` (a future/unknown schema
  version can't be trusted to match the current shape), so an unknown version discards the stored
  data and seeds a fresh board rather than adopting foreign data. Bumping `STORAGE_VERSION` alongside
  a real migration is what re-admits it.
  **Verification:** browser (`agent-browser` against the already-running `vite preview` on :4173
  serving the fresh build; localStorage cleared afterward). All five spec points confirmed with an
  empty `agent-browser errors` throughout: (1) injecting `{not valid json at all]` and reloading
  rendered the clean seed board ("My Board" / To Do·Doing·Done / Welcome card); (2) a
  structurally-valid but wrong-shape envelope (`{version:1, state:{foo:'bar', boards:'not-an-object'}}`)
  fell back to the seed board; (3) a `version:999` envelope carrying a distinct "STALE BOARD" name
  rendered the seed "My Board" instead — proving the version-mismatch rejection; (4) no reload showed
  a blank or error screen; (5) after the v999 fallback, adding a "Persistence check card" through the
  UI re-persisted a valid `version:1` envelope containing the seed board plus the new card.
  `bun run smoke:qc` (typecheck + oxlint + build + format:check) passes clean.

- **Keyboard accessibility for core interactions (2026-07-02):** Completed feature
  `keyboard-accessibility` (priority 4; depends on the passing `card-drag-and-drop` +
  `card-editor-form`). Two changes close the gaps the spec's four points required, on top of the
  already-accessible editor and labelled controls:
  1. **Keyboard-operable card move between columns (spec #3).** Drag-and-drop is not operable by
     keyboard alone, so each card now carries ◀/▶ buttons (`src/components/CardItem.tsx`) that move it
     to the previous/next column. They delegate to a new store action
     `moveCardToAdjacentColumn(cardId, direction)` (`src/store/boardStore.ts`) that resolves the card
     → column → board → `columnOrder`, appends the card to the neighbouring column, and restamps its
     `columnId`/`updatedAt` so status follows the move — a no-op with no neighbour, returning whether
     it moved. The buttons are disabled at the board's ends; `ColumnLane` passes each card its
     `columnIndex`/`columnCount` so the bounds match the column's real position.
  2. **Visible focus ring (spec #1).** A global `:focus-visible` rule in `src/index.css` paints a 2px
     accent-coloured outline (offset 2px) only for keyboard-driven focus, so tabbing shows a clear
     ring while mouse clicks stay clean.

  Spec #2 (editor traps focus + closes on Escape) and #4 (accessible names) were already satisfied by
  `CardEditor` and the existing `aria-label`s; this session verified them rather than rebuilding.
  **Verification:** browser (`agent-browser` against the already-running `vite preview` on :4173
  serving the fresh build; localStorage cleared before and after). Real `Tab` navigation reported
  `:focus-visible` true with a `rgb(192,132,252) solid 2px` outline (the dark-mode accent); the ◀/▶
  buttons rendered with accessible names ("Move card … to previous/next column"), disabled at the
  first/last column, and clicking "next" on the seed "Welcome to your board" card moved it To Do →
  Doing (which then disabled Delete-column on the now non-empty Doing). Opening the editor focused the
  title input inside a `role=dialog` / `aria-modal=true`; Escape closed it and restored focus to the
  opening "Edit card" button. `agent-browser errors` was empty throughout. `bun run smoke:qc`
  (typecheck + oxlint + build + format:check) passes clean.

- **Empty / first-run states (2026-07-02):** Verified and completed feature `empty-and-loading-states`
  (priority 4; depends on the passing `board-view-render`). All four spec points are satisfied by the
  app shell: (1) a board with **no columns** renders `.board-columns-empty` — "This board has no
  columns yet. Add a column to get started." (`src/App.tsx`); (3) **first-run / no boards** is handled
  by the persisted store always falling back to `createSeedState()` (the default "My Board"), so a
  fresh/cleared localStorage loads a ready-to-use board rather than an empty screen
  (`src/store/boardStore.ts`, `src/store/seed.ts`); (4) each empty state is conditional on real
  content length, so it disappears the moment a column/card is added. The one enhancement this session
  targeted spec point (2), the **empty drop area** for a column with no cards: `ColumnLane`'s
  `.card-list-empty` message was upgraded from the bare "No cards yet" to the action-guiding "No cards
  yet — add one below or drag a card here." (the distinct filtered-empty "No cards match the filter"
  message is preserved for the filter case). **Verification:** browser (`agent-browser` against the
  already-running `vite preview` on :4173 serving the fresh build; localStorage cleared before/after).
  Cleared storage reloaded the default seed board (point 3); the empty "Doing"/"Done" columns showed
  the new guidance (point 2); creating a fresh board rendered the no-columns empty state (point 1);
  adding a "Backlog" column removed the no-columns message and the new column showed the empty-card
  guidance (point 4). `agent-browser errors` was empty throughout. `bun run smoke:qc` (typecheck +
  oxlint + build + format:check) passes clean.

- **Board filter/search (2026-07-02):** Implemented feature `board-filters-search` (priority 4;
  depends on the passing `card-crud` + `app-shell-layout`). A new filter toolbar
  (`src/components/BoardFilter.tsx`) sits between the app header and the columns strip, scoped to the
  active board, offering (1) a free-text `<input type="search" aria-label="Search cards">` matched
  case-insensitively against each card's title **and** description, and (2) a `<select
  aria-label="Filter by label">` populated with the distinct labels used by cards on the active board
  (disabled with an "All labels" placeholder when the board has none). A **Clear** button (disabled
  until a criterion is active) resets both. Filter state is owned by `App` via `useState` and is
  **never persisted** — a reload always starts unfiltered — and it resets on board switch (labels
  differ per board). Pure helpers live in `src/store/selectors.ts`: `cardMatchesFilter` (text AND
  label, ANDed), `isCardFilterActive`, and `selectBoardLabels`. `ColumnLane` gained an optional
  `matchCard` predicate; when present it renders only the matching subset, but the header count badge
  and the non-empty-column delete rule ([[column-delete-nonempty-rule]]) still key off the column's
  **true** `column.cards`, so filtering never enables deleting a column that still holds (hidden)
  cards. A column whose cards are all filtered out renders empty with a "No cards match the filter"
  message (distinct from the genuinely-empty "No cards yet"), satisfying spec #6.
  **Verification:** browser (`agent-browser` against the already-running `vite preview` on :4173 that
  served the fresh build; localStorage cleared before and after). Against the seed board: typing
  "WELCOME" (uppercase) left only "Welcome to your board" visible and hid "Drag me between columns"
  (spec #3, #5); a no-match query left To Do showing count "2" with 0 rendered cards and the "No cards
  match the filter" empty state while Delete-column stayed disabled (spec #6 + delete-rule integrity);
  Clear restored both cards (spec #4); adding an "urgent" label to a card enabled the label menu, and
  selecting it left only the labelled card visible (spec #1, #2). `agent-browser errors` was empty
  throughout. `bun run smoke:qc` (typecheck + oxlint + build + format:check) passes clean.

### Blocked

- **Blocker Recorded: 2026-07-02 — Feature `testing-scenarios` (Crawl Testing Scenarios).**
  Selected this iteration; declared dependencies (`card-crud`, `card-drag-and-drop`,
  `local-persistence`) are all `passes: true`. Spec item 12 requires **all 10** scenarios in
  `.aidd/testing-scenarios.md` to pass and the gate to exit 0. Verification of the codebase found:
  - **Scenarios 1–8 and 10 are supported** by existing, passing features. In particular scenario 10
    (persistence resilience) is already fully handled in `src/store/persistence.ts` — `loadState()`
    validates the parsed envelope against the domain model and returns `null` (→ clean seed board)
    for invalid JSON, wrong-shape JSON, or a version/shape mismatch, and never throws.
  - **Scenario 9 (filter/search cards by text and by label) is not implementable without building a
    separate feature.** There is no search/filter UI anywhere in `src/` (confirmed by grep). This
    functionality is owned by the distinct backlog feature **`board-filters-search`** (priority 4,
    `status: backlog`, `passes: false`, with its own 6-item spec), which is **not** listed in
    `testing-scenarios.dependencies`.

  **Why this is a blocker, not agent-guessable:** the single-feature **scope guard** forbids
  implementing, marking complete, or committing another incomplete feature in the same run. Making
  scenario 9 pass means implementing `board-filters-search` — a separate feature. This is a
  work-ordering/prerequisite decision (sequence `board-filters-search` before this capstone, or add
  it as an explicit dependency), which belongs to the product owner / orchestrator.

  **Options considered:**
  1. Implement filter/search inline here — **rejected**: violates the scope guard (does another
     feature's work under this feature's id).
  2. Mark `testing-scenarios` complete for the 9 passing scenarios only — **rejected**: spec item 12
     requires *all* scenarios; would be a false positive.
  3. Report the blocker and set `waiting_approval` — **chosen**.

  **Recommended resolution:** build `board-filters-search` (and optionally the `persistence-resilience`
  verification feature) first, then re-select `testing-scenarios` to author/wire and verify all 10
  scenarios. **Next action:** left `testing-scenarios` as `waiting_approval` / `passes: false`; no
  `AIDD_RESULT` emitted. Build baseline (`bun run smoke:qc`) is green.

### Added

- **Column header controls (2026-07-02):** Verified and completed feature `column-header-controls`
  (priority 3; depends on the passing `column-management` + `app-shell-layout`). Each column lane
  header (`src/components/ColumnLane.tsx`) already carried the full control set required by the spec,
  and this session verified every point end-to-end: (1) the header renders the column `name` in an
  `<h2 class="column-name">` alongside a live card count (`<span class="column-count">` bound to
  `column.cards.length`); (2) an inline **Rename** affordance swaps the header for a real DOM `<input
  aria-label="Column name">` with Save/Cancel plus Enter-commits / Escape-cancels, committing through
  the store's `updateColumn` (no `window.prompt`); (3) a **Delete** affordance that honors the
  non-empty-column rule ([[column-delete-nonempty-rule]]) — disabled with an explanatory tooltip while
  the column holds cards, calling `removeColumn` only when empty; (4) a trailing per-column **Add
  card** affordance (`src/components/AddCard.tsx`) that opens the shared `CardEditor` scoped to that
  column and appends via `addCard(columnId, …)`; and (5) all controls are keyboard-reachable native
  `<button>`s / labeled inputs with descriptive `aria-label`s (e.g. "Rename column To Do", "Add card
  to Doing"). **Verification:** browser (`agent-browser` against a background `vite preview` on :4173
  that this session started and stopped after; localStorage cleared afterward). Against the fresh seed
  board (To Do: 2 cards / Doing / Done): the accessibility snapshot showed each header's name + count
  and the labeled Rename/Delete/Add-card buttons, with "Delete column To Do" disabled (2 cards) while
  empty Doing/Done were enabled (spec #1, #3, #5); clicking Rename on "To Do", filling the input, and
  Save updated the heading to "To Do (renamed)" with the count preserved and persisted the new name to
  `kanban-board:v1` state.columns (spec #2); clicking "Add card to Doing" opened a `CardEditor` headed
  "Add card to Doing" with a "Card title" field, confirming the affordance is column-scoped (spec #4).
  `agent-browser errors` was empty across every flow (no console errors). `bun run smoke:qc`
  (typecheck + oxlint + build + format:check) passes clean.

- **Non-empty column delete rule (2026-07-02):** Implemented feature `column-delete-nonempty-rule`
  (priority 3; depends on the passing `column-management` + `card-crud`). Chose and enforced the
  spec's MVP-suggested rule: **deleting a column that still holds cards is blocked** — cards are never
  silently destroyed or orphaned. The rule is enforced at the source of truth in
  `src/store/boardStore.ts`: `removeColumn(id)` now returns early (unchanged state) when the target
  column's `cardOrder` is non-empty, and only drops the column from its board's `columnOrder` +
  deletes the (empty) column record when it holds no cards. Its signature changed from `void` to
  `boolean` (true = removed, false = blocked) so callers can react. Because the guard means the column
  is always empty at deletion time, the previous cascade card-deletion loop was removed — there are no
  cards to delete, so no card can ever be orphaned. `removeBoard` still cascades (deletes a board's
  columns + cards inline) and is unaffected. In `src/components/ColumnLane.tsx` the column-header
  **Delete** button is now `disabled` while `column.cards.length > 0`, with an explanatory
  tooltip ("Move or delete this column's cards before deleting it"); the existing `.column-btn:disabled`
  style makes the blocked state visible. Emptying a column re-enables its Delete button live.
  **Verification:** browser (`agent-browser` against a background `vite preview` on :4173, stopped
  after; localStorage cleared afterward). Against the fresh seed board (To Do: 2 cards / Doing / Done):
  the non-empty "To Do" column's Delete rendered disabled with the tooltip while empty "Doing"/"Done"
  were enabled (spec #1, #3); deleted empty "Doing" → columns became [To Do, Done] and the persisted
  `kanban-board:v1` had 2 cards and **0 orphans** (spec #2, #4); reloaded → [To Do, Done] survived and
  To Do's Delete was still disabled with the tooltip (spec #5); deleted both of To Do's cards → its
  Delete button flipped to enabled live, then deleting the now-empty column succeeded leaving [Done]
  with 0 cards and 0 orphans (spec #2, #3, #4). `agent-browser errors` was empty across every flow
  (no console errors). `bun run smoke:qc` (typecheck + oxlint + build + format:check) passes clean.

- **Card & column drag-and-drop (2026-07-02):** Implemented feature `card-drag-and-drop` (priority 3;
  depends on the passing `card-crud` + `column-management`). Cards can now be reordered within a
  column, moved across columns (changing status), and columns reordered — all via native HTML5
  drag-and-drop (no new dependency). Two deterministic store actions do the ordering work in
  `src/store/boardStore.ts`: `moveCard(cardId, toColumnId, beforeCardId)` and
  `moveColumnTo(columnId, beforeColumnId)`, both built on a shared `insertBefore` helper that
  **filters the moved id out before re-inserting**, so no `cardOrder`/`columnOrder` array can ever
  hold a duplicate id (spec #8). A cross-column `moveCard` drops the id from the source column,
  inserts it into the target at the drop position, and restamps the card's `columnId` + `updatedAt`
  so status follows the move (spec #2, #3); a `beforeCardId` of `null` appends to the end, otherwise
  the card lands immediately before the target card (exact position, not appended — spec #4).
  `sameOrder` guards make same-column no-op reorders return unchanged state (spec #6). The UI wires
  this up with distinct drag MIME types (`src/components/dnd.ts`: `application/x-kanban-card` /
  `application/x-kanban-column`) so a lane can tell during `dragover` — when `dataTransfer.getData`
  is unavailable but `types` is — whether the current drag is a card or a column and only accept the
  right one. `CardItem` (`src/components/CardItem.tsx`) is `draggable` (disabled while its editor is
  open) and is itself a drop target that inserts *before* it (`stopPropagation` so the column's
  append handler does not also fire); `ColumnLane` (`src/components/ColumnLane.tsx`) makes the column
  header draggable for column reorder and makes the whole column body a drop target that appends a
  card to the end or places a dragged column before itself; `App.tsx` adds an end-of-strip drop zone
  so a column can be dropped past the last lane to become last. Drag affordances (grab cursor, 50%
  drag opacity, an accent insertion edge on the drop-before card, and an accent body/edge highlight
  on the target column) were added to `src/App.css`. Card text still renders via plain JSX (React
  escaping — no `dangerouslySetInnerHTML`).
  **Verification:** browser (`agent-browser` against a background `vite preview` on :4173, stopped
  after; localStorage cleared afterward). Against the fresh seed board (To Do: [Welcome, Drag me] /
  Doing / Done): dragged "Drag me" above "Welcome" — cardOrder became [Drag me, Welcome] and the
  persisted `kanban-board:v1` matched with no duplicate ids (spec #1, #8, #9); dragged "Welcome" into
  the empty Doing column — it left To Do's cardOrder, entered Doing's, and its `columnId` now matched
  Doing (spec #2, #3, #7); dragged "Drag me" onto "Welcome" in Doing — it inserted *before* Welcome
  giving Doing [Drag me, Welcome] and leaving To Do empty-but-valid (spec #4, #7); dragged the Doing
  column name before To Do — `board.columnOrder` became [Doing, To Do, Done] with no dupes (spec #5);
  reloaded the page — the cross-column move and column reorder both survived (spec #9, #10); dropped a
  card onto itself — layout unchanged and still globally duplicate-free (spec #6, #8). `agent-browser
  errors` was empty across every flow (spec #11). `bun run smoke:qc` (typecheck + oxlint + build +
  format:check) passes clean (spec #12).

- **Board switcher UI (2026-07-02):** Verified and completed feature `board-switcher-ui` (priority 3;
  depends on the passing `board-management` + `app-shell-layout`). The switcher was already
  implemented in `src/components/BoardBar.tsx` (rendered in the app header by `src/App.tsx`): a
  `<select aria-label="Active board">` lists every board from `selectBoardList` with the active board
  bound to `value={activeBoardId}` (spec #1), changing the selection calls `setActiveBoard`, which
  re-renders the board view through the store subscription (spec #2), a "New board" button opens an
  inline, accessible name form (Enter/Escape, no `window.prompt`) that creates the board and switches
  to it (spec #3), and "Rename"/"Delete" act on the active board — Delete is disabled when only one
  board remains and the store falls back to the first remaining board on deletion (spec #4). This
  iteration added no code changes; it hardened the feature by full browser verification.
  **Verification:** browser (`agent-browser` against a background `vite preview` on :4173, stopped
  after): confirmed the switcher listed the seed board with the active one selected and Delete
  disabled (spec #1, #4); created "Project Beta" via New board → it became active, both boards listed,
  Delete enabled (spec #3, #5); selected "My Board" from the dropdown → it became active and its
  columns re-rendered (spec #2); renamed it to "My Board Renamed" → header and dropdown option both
  updated live (spec #4, #5); deleted the active board → it fell back to "Project Beta" as active and
  Delete re-disabled (spec #4, #5). `agent-browser errors` was empty across every flow; cleared the
  test localStorage afterward. `bun run smoke:qc` (typecheck + oxlint + build + format:check) passes
  clean.

- **Card item rendering — truncated preview + overflow-safe layout (2026-07-02):** Implemented
  feature `card-item-render` (priority 2; depends on the passing `card-crud` + `app-shell-layout`).
  The `CardItem` view already rendered the title, description, label chips, and Edit/Delete
  affordances, so this feature hardened the two remaining spec points that were unmet: the card view
  now shows a **truncated** three-line description *preview* rather than the full body, and long
  titles/descriptions no longer break the column layout. In `src/App.css`: `.card-description` gained
  a `-webkit-box` + `line-clamp: 3` clamp (with `overflow: hidden`) so long descriptions render as a
  bounded preview with an ellipsis, and both `.card-title` and `.card-description` gained
  `overflow-wrap: anywhere` + `word-break: break-word` so an unbroken 90-character title wraps inside
  the card instead of overflowing the column. No component/logic changes — card text still renders
  via plain JSX (React escaping, no `dangerouslySetInnerHTML`), and the full description remains
  editable/visible in the `CardEditor` modal.
  **Verification:** browser (`agent-browser` against a background `vite preview` on :4173, stopped
  after): added a card with a 90-char unbroken title and a multi-paragraph description — the title
  wrapped fully within the card with no horizontal overflow (spec #5), the description clamped to
  three lines ending in an ellipsis (spec #2), the "urgent" label chip rendered (spec #3), the title
  rendered prominently (spec #1), and Edit/Delete buttons were present (spec #4); the card's right
  edge stayed within the column bounds (measured via `getBoundingClientRect`), computed
  `-webkit-line-clamp` read `3`, and `agent-browser errors` was empty. Cleared the test card from
  localStorage afterward. `bun run smoke:qc` (typecheck + oxlint + build + format:check) passes clean.

- **Card editor form / modal (2026-07-02):** Implemented feature `card-editor-form` (priority 2;
  depends on the passing `card-crud` + `app-shell-layout`). Consolidated the two ad-hoc inline
  editors (create was a title-only inline form in `AddCard`; edit was a full inline form inside
  `CardItem`) into one shared, accessible modal — `src/components/CardEditor.tsx`. The modal owns the
  full editing surface for both flows: a required title, an optional description, and add/remove
  labels, with Cancel/Save actions. It exposes a mode-agnostic `onSubmit(values)` /`onClose`
  contract and pre-fill props (`initialTitle`/`initialDescription`/`initialLabels`), so `AddCard`
  wires it to `addCard` (create mode, empty pre-fill, "Add card" button) and `CardItem` wires it to
  `updateCard` (edit mode, pre-filled from the card, "Save" button). Validation: Save/Add stays
  `disabled` while the trimmed title is empty, and `save()` guards the programmatic path (spec #3).
  Labels: an add-label input (Enter or the button) skips empty/duplicate entries, and each chip has
  a per-chip × remove button (spec #4). Accessibility/focus management (spec #6): the title field is
  focused on open, focus is trapped within the dialog on Tab/Shift+Tab, and the previously-focused
  element (the Edit / Add-card opener) is restored on close via a `useEffect` cleanup; Escape, the
  Cancel button, and a backdrop click all cancel and discard edits, while the modal is marked
  `role="dialog" aria-modal="true"` with an `aria-label`. Rewrote `src/components/CardItem.tsx` (now
  view-only chrome + an "Edit" button that mounts `<CardEditor>`) and `src/components/AddCard.tsx`
  (now a single "+ Add card" button that mounts `<CardEditor>`), removing their bespoke inline-edit
  state. Added `.card-editor-backdrop`/`.card-editor`/`.card-editor-heading`/`.card-editor-field`/
  `.card-editor-label`/`.card-editor-actions` styles to `src/App.css` (centered overlay dialog on a
  dimmed backdrop) and removed the now-dead `.card-editing`/`.add-card-form` rules. All card text
  still renders via plain JSX (React escaping — no `dangerouslySetInnerHTML`). Persistence is
  automatic via the store's existing subscribe-and-save.
  **Verification:** browser (`agent-browser` against a background `vite preview` on :4173, stopped
  after): opened the editor for the Doing column and confirmed Add stayed disabled with an empty
  title — spec #1, #3; typed a title, description, and a label draft "urgent", added the chip,
  removed it, re-added it (spec #4), and saved — the card appeared in the column with its description
  and label, modal closed — spec #1, #5; clicked Edit on the new card and confirmed the modal
  pre-filled title/description/label — spec #2; changed the title then Cancel and confirmed the card
  was unchanged — spec #5; reopened, pressed Escape and confirmed the modal closed and focus returned
  to the Edit button (`document.activeElement` aria-label = "Edit card Write the report") — spec #6;
  edited the description, saved, and reloaded — the new description and label read back from
  localStorage — spec #5 persistence. Zero console errors across every flow. `bun run smoke:qc`
  (typecheck + oxlint + build + format:check) passes clean.

- **Card CRUD — title, description, labels (2026-07-02):** Implemented feature `card-crud`
  (priority 2; depends on the passing `board-domain-model` + `column-management`). The store already
  exposed the full mutation surface (`addCard`/`updateCard`/`removeCard` in `src/store/boardStore.ts`,
  where `addCard` stamps `createdAt`/`updatedAt` on creation and `updateCard` bumps `updatedAt` on
  every patch), so this feature is the card UI on top of it. Added `src/components/AddCard.tsx` — a
  trailing "+ Add card" affordance per column that reveals an inline title form (Enter commits,
  Escape cancels), rejecting empty/whitespace-only titles (submit disabled + trimmed guard) and
  appending via `addCard` to the column's `cardOrder`; the form stays open so several cards can be
  entered in a row. Added `src/components/CardItem.tsx` — a card with a view mode (title, optional
  description, label chips, plus Edit/Delete controls) and an inline edit mode (title input,
  description textarea, a label editor with per-chip remove buttons and an add-label input). Save
  commits title/description/labels through `updateCard` (empty title rejected; blank description
  normalized to `undefined`; duplicate labels skipped); Delete calls `removeCard`, which drops the id
  from the owning column's `cardOrder`. All card text renders via plain JSX (React escaping — no
  `dangerouslySetInnerHTML`). Rewired `src/components/ColumnLane.tsx` to render each card as
  `<CardItem>` and append `<AddCard>` under the list. Added `.card-actions`, `.card-editing`,
  `.card-input`, `.card-textarea`, `.card-labels`, `.card-label(+ -remove)`, `.card-label-add`,
  `.card-form-actions`, `.add-card-toggle`, and `.add-card-form` styles to `src/App.css` (pill label
  chips, dashed add-card tiles, danger hover on Delete/remove). Every card control carries an
  `aria-label` naming its card/label so the UI is keyboard-reachable and screen-reader labeled.
  Persistence is automatic via the store's existing subscribe-and-save.
  **Verification:** browser (`agent-browser` against a background `vite preview` on :4173, stopped
  after): from the seed board added "Ship the feature" to the Doing column (appended to `cardOrder`)
  — spec #1; edited it to add the description "Wire card CRUD end to end" and the label "urgent",
  saved, and confirmed both rendered in view mode — spec #3, #4, #5; reloaded — title, description,
  and label all read back from localStorage — spec #10 (and #2, since a persisted card carries its
  timestamps); re-edited to remove the "urgent" label, saved, and confirmed the chip was gone and
  stayed gone — spec #6; deleted the card and confirmed it left the column — spec #7; opened the
  To Do add-card form, typed a whitespace-only title, and confirmed the Add button stayed disabled —
  spec #8. Card text renders through JSX only, no `dangerouslySetInnerHTML` — spec #9. Zero console
  errors across every flow. `bun run smoke:qc` (typecheck + oxlint + build + format:check) passes
  clean — spec #11, #12.

- **Board view — render columns and cards in order (2026-07-02):** Implemented feature
  `board-view-render` (priority 2; depends on the passing `column-management` + `app-shell-layout`).
  The ordered render path already existed from those dependencies — `selectActiveBoardView`
  (`src/store/selectors.ts`) resolves `board.columnOrder` → columns and each column's `cardOrder` →
  cards, `App.tsx` maps columns to lanes in `columnOrder`, and `ColumnLane.tsx` maps `column.cards`
  in `cardOrder` — so this feature added the two explicit empty-state affordances the spec calls out
  and verified the full ordering contract end-to-end. Added a `.card-list-empty` "No cards yet" drop
  area to `src/components/ColumnLane.tsx` (rendered in place of the `<ul>` when a column has zero
  cards, spec #4) and a `.board-columns-empty` "This board has no columns yet. Add a column to get
  started." call-to-action to `src/App.tsx` (rendered in place of the lane map when the active board
  has zero columns, with the trailing `+ Add column` affordance still present, spec #5). Added the
  matching `.board-columns-empty` and `.card-list-empty` (dashed placeholder) styles to `src/App.css`.
  No store or selector changes — ordering stays driven entirely by the `columnOrder`/`cardOrder`
  arrays.
  **Verification:** browser (`agent-browser` against a background `vite preview` on :4173, killed
  after): fresh seed board rendered its three lanes in `columnOrder` (To Do, Doing, Done) with To
  Do's two cards in `cardOrder` (Welcome to your board, then Drag me between columns) — spec #1, #2;
  clicking "Move column To Do right" re-rendered the lanes in the new order (Doing, To Do, Done),
  confirming the UI follows the reordered array — spec #3; the empty Doing and Done columns each
  rendered the "No cards yet" drop area — spec #4; deleting every column showed the "add a column to
  get started" call-to-action with the + Add column button still available — spec #5. Zero console
  errors on a clean session (an earlier React #185 "max update depth" entry was an artifact of a
  synchronous rapid-fire delete loop in the test harness, not the app — it did not reproduce on a
  fresh session or during normal single-click interaction). `bun run smoke:qc`
  (typecheck + oxlint + build + format:check) passes clean.

- **Column management — add/rename/delete/reorder (2026-07-02):** Implemented feature
  `column-management` (priority 2; depends on the passing `board-domain-model`). Added a
  `moveColumn(id, direction)` action to `src/store/boardStore.ts` that swaps a column with its
  left/right neighbor inside the owning board's `columnOrder` (no-op at the ends, no-op for unknown
  column/board) — reorder is expressed purely through `columnOrder`, matching the deterministic
  ordering invariant. Added `src/components/ColumnLane.tsx` (renders one lane: header with the
  column name + card count, and per-column controls — move left/right, inline Rename, Delete — above
  the card list) and `src/components/AddColumn.tsx` (a trailing "+ Add column" affordance that
  reveals an inline form appending via `addColumn`; stays open so several columns can be added in a
  row). Rewired `src/App.tsx` to map columns to `<ColumnLane index count>` and append `<AddColumn>`
  (the read-only card markup moved verbatim into `ColumnLane`). Rename uses a real DOM input (Enter
  commits, Escape cancels, empty/whitespace rejected) rather than `window.prompt`, so it's accessible
  and testable; every move/rename/delete button carries an `aria-label` naming its column, so the
  controls are keyboard-reachable and screen-reader labeled. Move-left is disabled on the first
  column and move-right on the last. Delete uses the store's existing cascade-safe `removeColumn`
  (drops the column from `columnOrder` and deletes its cards, so nothing is orphaned); the dedicated
  non-empty-delete policy is the separate downstream `column-delete-nonempty-rule` feature (which
  depends on this one + `card-crud`), so no product decision was pre-empted here. Persistence is
  automatic via the store's existing subscribe-and-save. Added `.column-name`, `.column-actions`,
  `.column-rename`, `.column-rename-input`, `.column-btn(+ -danger)`, `.add-column-toggle`, and
  `.add-column-form` styles to `src/App.css` (dashed add-column tiles, danger hover on Delete),
  and let the column header wrap so the action row sits under the title.
  **Verification:** browser (`agent-browser` against a background `vite preview` on :4173, killed
  after): from the seed board (To Do/Doing/Done, Welcome + Drag cards) added "Backlog" (appended to
  `columnOrder`, len 4); moved it left one slot (order became To Do,Doing,Backlog,Done); renamed it
  to "Ideas" (header updated); reloaded — add + reorder + rename all survived (To Do,Doing,Ideas,Done
  read back from localStorage); deleted "Ideas" — lane removed, back to the 3 seed columns, and a
  localStorage check confirmed 2 cards remain with zero orphans (no card references a missing column).
  Move-left disabled on the first lane and move-right on the last (verified in the accessibility
  snapshot). No console errors after exercising every flow. `bun run smoke:qc`
  (typecheck + oxlint + build + format:check) passes clean.

- **Board management — create/rename/delete/switch (2026-07-02):** Implemented feature
  `board-management` (priority 2; depends on the passing `board-domain-model` + `local-persistence`).
  Added `src/components/BoardBar.tsx`, wired into the header of `src/App.tsx` beside the app title:
  a `<select>` board switcher (bound to `activeBoardId`, changes it via `setActiveBoard`), a
  **New board** button that reveals an inline text form (create → `addBoard`, then auto-switch to the
  new board), a **Rename** button (inline form pre-filled with the active board's name → `updateBoard`),
  and a **Delete** button (`removeBoard`). Create/rename use real DOM inputs (Enter submits, Escape
  cancels) rather than `window.prompt`, so the flow is accessible and testable; empty/whitespace names
  are rejected (submit disabled + trimmed guard). Delete is disabled when only one board remains, so
  the app always has a board to show; deleting the active board falls back to the first remaining
  board (store's existing `removeBoard` behavior — `boardOrder[0] ?? null`) and cascade-deletes its
  columns/cards so no orphans remain. Added `selectBoardList` to `src/store/selectors.ts` (resolves
  `boardOrder` → `{id, name}` summaries, skipping dangling ids; typed to accept just the
  `boards`/`boardOrder` slices). `BoardBar` subscribes to the raw `boards`/`boardOrder`/`activeBoardId`
  slices and derives the list with `useMemo` — mirroring the cached-snapshot pattern already in
  `App.tsx` — because a store selector that builds a fresh array each call trips zustand v5's snapshot
  cache and unmounts the app (caught and fixed during browser verification). Added `.board-bar*`
  styles to `src/App.css` (switcher + buttons, danger hover on Delete, `.visually-hidden` label) and
  made `.app-header` space the title and controls apart.
  **Verification:** browser (`agent-browser` against a background `vite preview` on :4173, killed
  after): from a cleared-storage seed ("My Board", 3 columns, Delete disabled), created "Personal"
  (appears in switcher, auto-selected, header updates, empty columns as expected); renamed it to
  "Personal Tasks" (header + switcher option both reflect the new name); switched back to "My Board"
  (its 3 columns re-render); reloaded — both boards and the active-board id survived; deleted the
  active "Personal Tasks" — fell back to "My Board" (3 columns render), no crash, Delete re-disabled
  as the only board. Console/error buffers empty after clearing and exercising the create flow (zero
  console errors). `bun run smoke:qc` (typecheck + oxlint + build + format:check) passes clean.

- **Kanban app shell (2026-07-02):** Implemented feature `app-shell-layout` (priority 2; depends on
  the passing `board-domain-model`). Restructured `src/App.tsx` from the earlier read-only board view
  into a proper application shell: a top `header.app-header` showing the fixed product name
  ("Kanban Board", `APP_NAME` constant) alongside the active board's name (`h1.board-name`), above a
  `main.board-area` that hosts the horizontal, scrollable `.board-columns` region. The shell stays
  wired to the same Zustand store + `selectActiveBoardView` selector (whole-state subscribe +
  `useMemo` derive, preserving the cached-snapshot fix from `board-domain-model`); when there is no
  active board it renders "No board" in the header and a "No board yet." empty state instead of
  crashing. Reworked `src/App.css` to a flex column shell (header + flex-1 board area) with the
  columns row scrolling on the x-axis and each column capped to viewport height with its card list
  scrolling on the y-axis. Cleaned residual Vite-starter styling out of `src/index.css`: removed the
  fixed `width: 1126px` centered `#root` (now a full-width, full-height flex column app layout),
  deleted the dead `#social .button-icon`, `code`, and `.counter` rules, and renamed the
  `--social-bg` custom property to the semantic `--column-bg`. No stock counter/doc/social-links
  markup or hero/react/vite asset references remain in the rendered UI.
  **Verification:** browser (`agent-browser` against a background `vite preview` on :4173, stopped
  after): a fresh session renders app name "Kanban Board" + board "My Board" with columns To Do (2),
  Doing (0), Done (0) and the two seed cards; DOM eval confirms the header text, column names/counts,
  card count, and that a regex sweep of the rendered `body.innerHTML` for `vite|react.svg|hero|counter`
  returns `null` (no starter leftovers); `agent-browser errors` is empty (zero console errors) on a
  clean load of the production build. `bun run smoke:qc` (typecheck + oxlint + build + format:check)
  passes clean. Later UI features (`board-view-render`, `card-item-render`, `card-crud`,
  `card-drag-and-drop`) build interactivity on top of this shell.

- **localStorage persistence + corruption guard (2026-07-02):** Implemented feature
  `local-persistence` (priority 1; depends on the now-passing `board-domain-model`). Added
  `src/store/persistence.ts`: state is read/written under a single namespaced, versioned key
  (`kanban-board:v1`) wrapped in an envelope `{ version: 1, state }` so future schema changes can
  migrate rather than discard. `loadState()` parses the key and validates the parsed shape against
  the domain model with explicit per-entity type guards (boards/columns/cards records, `boardOrder`,
  nullable `activeBoardId`) before adopting it; anything missing, unparseable, or shape-invalid
  returns `null` and never throws. `saveState()` writes the envelope and swallows quota/serialization
  errors (best-effort). Wired into `src/store/boardStore.ts`: initial state is now
  `loadState() ?? createSeedState()` (hydrate-or-seed), and a `useBoardStore.subscribe` listener
  persists the serializable slice (`toPersistable`, actions excluded) on every mutating action.
  The subscriber dedups by comparing the serialized payload to the last write, so rapid identical
  edits don't re-write; writing to a single key means each save overwrites the previous — no
  unbounded localStorage growth. On first load with nothing stored the seed is shown but not
  force-persisted (it persists on the first real mutation), so a missing key never produces a spurious
  write. `App.tsx` and the store's public API are unchanged.
  **Verification:** browser (`agent-browser`, fresh sessions to avoid a stale error buffer — the
  CLI's `errors --clear` did not flush a reused browser): injecting a valid envelope + reload restores
  that board/column/card; injecting `"{not json"` or a shape-invalid value + reload falls back to the
  clean "My Board" (To Do/Doing/Done) seed with no blank/broken screen and **zero console errors** on
  a clean first load of both dev and production builds. A throwaway Bun harness (localStorage polyfill;
  not committed) exercised the save path the read-only UI can't yet reach: mutation → write, version
  field present, round-trip of added/reordered/moved cards, dedup of identical-state sets, and the
  three corruption paths → `null` — all 15 checks pass. `bun run smoke:qc` (typecheck + oxlint +
  build + format:check) passes clean. Later interactive features (`card-crud`, `card-drag-and-drop`)
  will exercise the persist-on-mutation path through the UI directly.

- **Board/Column/Card domain model + store (2026-07-02):** Implemented feature `board-domain-model`
  (priority 1, first product feature — the scaffold was previously 0/20). Added typed entities in
  `src/types/board.ts` (`Board { id, name, columnOrder }`, `Column { id, boardId, name, cardOrder }`,
  `Card { id, columnId, title, description?, labels, createdAt, updatedAt }`) plus a normalized
  `BoardState` (entities keyed by id + `boardOrder` + `activeBoardId`). Ordering is expressed
  exclusively through `columnOrder` / `cardOrder` — no implicit sort. Built a **Zustand** store
  (`src/store/boardStore.ts`, per AGENTS.md/spec: Zustand over React Context) exposing immutable
  add/update/remove actions for boards, columns, and cards; every action returns new state (verified
  no in-place mutation). `addCard` appends the new id to the target column's `cardOrder`; `removeCard`
  drops the id from the owning column; `removeColumn` drops the id from the board's `columnOrder` and
  **cascade-deletes its cards so none are orphaned** (the non-empty-delete UI guard is the separate
  `column-delete-nonempty-rule` feature). Ids come from `crypto.randomUUID()`. Added a seed board
  (To Do / Doing / Done) as the store's initial state (`src/store/seed.ts`), used when nothing is
  persisted; localStorage hydration is deferred to the `local-persistence` feature. Selectors
  (`src/store/selectors.ts`) resolve the active board → columns (in `columnOrder`) → each column's
  cards (in `cardOrder`) as `selectActiveBoardView`. Wired an immediate consumer: `App.tsx` now
  renders a minimal read-only board (title, columns with card counts, cards) replacing the stock Vite
  scaffold, with matching styles in `App.css`. Later UI features (`app-shell-layout`,
  `board-view-render`, `card-drag-and-drop`) build on this same store.
  **Bug found + fixed during browser verification:** deriving the view inside the zustand selector
  returned a fresh object every call, tripping React's `useSyncExternalStore` "getSnapshot should be
  cached" guard → blank page. Fixed by subscribing to the stable whole-state reference and deriving
  the view with `useMemo`. Verified via `agent-browser` (board renders: To Do=2, Doing=0, Done=0; no
  live console errors; screenshot captured) and a throwaway Bun harness exercising the store
  (append-on-add, drop-on-remove, cascade column delete without orphaning, immutability,
  `updatedAt` bump — all pass; harness deleted, not committed). No `any`; strict mode compiles;
  `bun run smoke:qc` (typecheck + oxlint + build + format:check) passes clean. Added `zustand@5` as a
  dependency.

### Removed

- **Vestigial spernakit config drift removed (2026-07-02):** Implemented feature
  `remediation-remove-config-drift`. Deleted the two orphaned eslint.config.js files (root and
  `frontend/`) that carried over from the spernakit template into this bare vite-react scaffold.
  Both imported packages that are not installed here (`@eslint/js`, `typescript-eslint`,
  `eslint-plugin-perfectionist`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`,
  `eslint-plugin-unused-imports`, `globals`) and configured file globs for `backend/**`,
  `scripts/**`, `drizzle.config.ts`, and `tailwind.config.js` — none of which exist in this
  client-only Vite SPA. Linting runs via oxlint (`.oxlintrc.json`), so these ESLint configs were
  dead and could never execute; keeping them would mislead contributors into thinking an ESLint
  toolchain was active. Also removed the now-empty `frontend/` directory (it contained only the
  removed eslint config; all source lives under `src/`). Kept `.prettierrc`: unlike the eslint
  configs it is live — backed by the prettier + plugins installed in
  `remediation-quality-gate-scripts`, with the tailwind plugin already dropped — so it was not
  orphaned and per the spec's fork ("removed OR backed by installed prettier") stays. Config-only
  change with no runtime/UI surface to browser-verify; `bun run smoke:qc` (typecheck + oxlint +
  `tsc -b && vite build` + format:check) passes clean after the cleanup.

### Added

- **Onboarding: product feature backlog materialized (2026-07-02):** Completed the onboarding phase
  for the (previously intake-processed) scaffold. The 8 `spec.md` backlog capabilities had never been
  turned into `feature.json` records — only the 3 `remediation-*` quality items existed. Created **20
  product feature JSONs** under `.aidd/features/` (23 total with the remediations), all conservatively
  marked `passes: false`, `status: "backlog"`, ordered by priority, with `dependencies` wired by id
  and every `dir == id`: `board-domain-model`, `local-persistence`, `app-shell-layout`,
  `board-view-render`, `board-management`, `board-switcher-ui`, `column-management`,
  `column-header-controls`, `card-crud`, `card-editor-form`, `card-item-render`, `card-drag-and-drop`,
  `column-delete-nonempty-rule`, `board-filters-search`, `empty-and-loading-states`,
  `keyboard-accessibility`, `responsive-layout`, `testing-scenarios`, `persistence-resilience`,
  `usage-documentation`. Five are comprehensive (12-step) tests (`board-domain-model`,
  `local-persistence`, `card-crud`, `card-drag-and-drop`, `testing-scenarios`); the rest are narrow
  (3-6 step) checks. Coverage mirrors the existing `feature-coverage-audit`
  (`.aidd/reports/feature-coverage-audit-2026-07-02.md`): 0/20 product capabilities implemented (the
  tree is still the stock Vite scaffold), so nothing was marked passing. Also filled in the
  `project-structure.md` template with the real bare-Vite layout, created `.aidd/todo.md` capturing
  discovered issues, and rewrote the stock template `README.md` to describe the kanban board.
  **Discovered regression (logged in todo.md):** the two vestigial `eslint.config.js` files (root +
  `frontend/`) that committed feature `remediation-remove-config-drift` deleted have reappeared as
  untracked, byte-identical copies (drift re-synced from the template). They do not break the gate
  (`bun run smoke:qc` still exits 0 — prettier accepts them and lint runs via oxlint), so they were
  left for a remediation iteration rather than deleted during onboarding. Also restored this CHANGELOG
  from HEAD — the working copy had been reverted to the empty skeleton, discarding the committed
  remediation entries. Writes confined to `.aidd/`, `README.md`. `bun run smoke:qc` verified green.

- **TypeScript strict mode enabled (2026-07-02):** Implemented feature `remediation-tsconfig-strict`.
  Added `"strict": true` to `compilerOptions` in both `tsconfig.app.json` and `tsconfig.node.json`,
  preserving the existing `noUnusedLocals` / `noUnusedParameters` / `noFallthroughCasesInSwitch`
  linting options. Enabling strict before any board/column/card code is authored satisfies the
  AGENTS.md zero-tolerance-for-`any` policy and ensures type safety from the first line rather than
  retrofitting later. `bun run smoke:qc` (typecheck + oxlint + `tsc -b && vite build` + format:check)
  passes clean with strict enabled; no `any`, `@ts-expect-error`, or `@ts-ignore` were introduced to
  force the build green. Config-only change (no UI surface to browser-verify).

- **Quality-gate scripts + prettier adopted (2026-07-02):** Implemented feature
  `remediation-quality-gate-scripts`. Added the quality-gate scripts the spec assumes exist:
  `typecheck` (`tsc -b --noEmit`), `format` (`prettier --write .`), `format:check`
  (`prettier --check .`), and `smoke:qc` (`bun run typecheck && bun run lint && bun run build &&
  bun run format:check`). `bun run smoke:qc` now exits 0 on the tree. **Resolved the prettier
  adopt-vs-remove fork by ADOPTING prettier**, per `.aidd/project.md` (highest-priority override):
  "all architecture, tech stack, style, and tooling should be spernakit-like" — spernakit ships
  prettier with exactly the AGENTS.md style (tabs, 100-col, single quotes, semicolons). Installed
  `prettier@3.9.4`, `prettier-plugin-organize-attributes@1.0.0`, `prettier-plugin-sort-json@4.2.0`
  (dropped `prettier-plugin-tailwindcss` from `.prettierrc` since this SPA has no tailwind), backing
  the previously-orphaned `.prettierrc` with real devDependencies. Added `.aidd/` to `.prettierignore`
  so aidd-managed artifacts (feature JSONs, reports) are never reformatted. Ran `bun run format`
  (13 source/config files reformatted to the spernakit style). Initialized the kanban-board git repo
  (`git init`) to match its sibling apps under `D:/applications` — each app is its own repo; the
  container repo ignores all subdirs via `/**/`, and kanban-board had a prepared `.gitignore` but no
  `.git` yet. This unblocks the spec acceptance criterion `bun run smoke:qc passes`.

- **Intake report written (2026-07-02):** Consolidated the intake-phase `.aidd` artifacts into
  `.aidd/reports/intake.md` (overwrite-safe, date-stamped). Summarizes the detected stack + inferred
  profile (client-only Vite 8 / React 19 / TS 6 SPA, `static-spa`, `auth: none`, low sensitivity/
  criticality), the artifacts created/refreshed during intake (project-profile.json, testing-scenarios,
  3 remediation feature JSONs, codebase analysis, 34 audit reports, coverage audit, interview response),
  the feature inventory (0 implemented / 8 spec backlog / 3 remediation), the audit findings summary
  (0 Crit/High/Med/Low new findings — clean scaffold; all gaps tracked by the three remediations), the
  open-questions state (no `questions.md`; the latent prettier adopt-vs-remove fork noted), and
  recommended next actions. Read-only analysis; no source touched; writes confined to `.aidd`.

- **Testing scenarios seeded (2026-07-02):** Ran the aidd `testing-scenarios` ingredient (seed mode)
  to create `.aidd/testing-scenarios.md`. Authored 10 `spernakit-tester` scenarios from the `spec.md`
  blueprint covering the full feature backlog: board management, column management (incl. non-empty
  column delete rule), card CRUD with labels, within/cross-column drag reorder, column reordering,
  filter/search, and localStorage persistence/corruption resilience. No RBAC scenarios — this is a
  client-only, single-user SPA with no backend or auth tiers.

- **Feature review re-run (2026-07-02):** Re-ran the aidd `feature-review` ingredient over the three
  backlog `remediation-*` feature JSONs. Independently re-verified every spec claim against the tree:
  no `"strict": true` in either tsconfig, no `typecheck`/`smoke:qc`/`format` scripts in package.json,
  and `prettier` (+ its 3 plugins), `eslint`/`typescript-eslint`/`perfectionist`, `tailwindcss`, and
  `drizzle` all absent from `bun.lock` (so both `eslint.config.js` files and `.prettierrc` are
  genuinely orphaned) — all claims accurate. No template (`spernakit_version`) features; no
  `roadmap.json` (lite app, Phase 6.5 skipped); no `remediation-review.md`. No codebase duplication
  or cathedral risks (tooling-only features). **Idempotent result: 0 features modified** — the prior
  feature-review already applied all auto-fixable items (real-newline specs, the
  `remediation-quality-gate-scripts` dependency on `remediation-remove-config-drift`, timestamp
  bumps), and nothing new was fixable. Remaining items are report-only product decisions: the prettier
  adopt-vs-remove fork in both features (spec.md defines `smoke:qc` as typecheck+build+crawl with no
  `format`, while AGENTS.md prescribes a prettier style and includes `format` in its pipeline —
  genuinely ambiguous), plus two MINOR nits left untouched under fix constraints (non-standard
  `status:"todo"` and dateless `remediation-{slug}` IDs — both immutable per fix rules). No feature
  files changed; writes confined to `.aidd`.

- **Feature coverage audit (2026-07-02):** Ran the aidd `feature-coverage-audit` ingredient in
  `--apply` mode. Report saved to `.aidd/reports/feature-coverage-audit-2026-07-02.md`. Outcome: the
  repo has **zero implemented product capabilities** (still a pristine `vite-react` scaffold —
  `src/App.tsx` is the stock counter/landing page), so there is nothing implemented to document or
  backfill. No feature JSONs were created: the only source artifact is transitional scaffold
  boilerplate the spec designates for replacement, which cannot honestly be marked
  `completed`/`passes`. The three existing `remediation-*` feature JSONs already cover the identified
  quality gaps and needed no tightening. No feature metadata changed, so `--check-features` and
  `roadmap:apply` were not run. Writes confined to `.aidd`.

- **Codebase analysis (2026-07-02):** Ran the aidd `codebase-analysis` ingredient across the repo.
  Report saved to `.aidd/audit-reports/CODEBASE_ANALYSIS-2026-07-02.md`. Key finding: the repo is a
  pristine `vite-react` scaffold — 0 of 8 spec features are implemented (`src/App.tsx` is still the
  stock Vite starter). Build and lint pass clean, but the spec-required `bun run smoke:qc` gate does
  not exist, no tsconfig enables `strict`, and vestigial spernakit config (two orphaned
  `eslint.config.js`, an orphaned `.prettierrc`, an empty `frontend/` dir) has drifted into the bare
  scaffold. Created three remediation backlog entries under `.aidd/features/`:
  `remediation-tsconfig-strict`, `remediation-quality-gate-scripts`, `remediation-remove-config-drift`.
  Analysis only — no source files modified (writes confined to `.aidd`).

- **Project assurance profile (2026-07-02):** Inferred and wrote `.aidd/project-profile.json` from
  the codebase analysis and source tree. Captured: client-only Vite 8 + React 19 + TS 6 SPA stack,
  `static-spa` deployment (no server), `auth: none` (single-user local), low data sensitivity
  (only user board content in browser localStorage; no PII/secrets/network), low criticality, no
  external integrations, and a minimal security surface. Recorded the real runnable validation
  command (`bun run build && bun run lint`) and flagged that the spec-declared `bun run smoke:qc`
  gate does not exist yet. Writes confined to `.aidd`.

- **Feature review (2026-07-02):** Ran the aidd `feature-review` ingredient over the three backlog
  `remediation-*` feature JSONs. Verified every spec claim against the actual repo (no `strict` in
  either tsconfig, no `typecheck`/`smoke:qc`/`format` scripts, orphaned `eslint.config.js` ×2 and
  `.prettierrc` referencing plugins absent from `bun.lock`, empty `frontend/` dir) — all claims are
  accurate. No template (`spernakit_version`) features present; no `roadmap.json` (lite app, Phase 6.5
  skipped); no `remediation-review.md`. No codebase duplication or cathedral risks (tooling-only
  features). Fixes applied: (1) all three specs stored their numbered lists as a single line with
  literal `\n` escapes — rewrote to real newlines so they render as lists; (2) added the missing
  `remediation-quality-gate-scripts` dependency to `remediation-remove-config-drift` (both share the
  unresolved prettier adopt-or-remove decision, resolved in the quality-gate feature); (3) bumped
  `updatedAt`. Left report-only (require product decision, not auto-fixed): the prettier
  adopt-vs-remove fork in both features (spec.md's `smoke:qc` omits `format` while AGENTS.md prescribes
  a prettier style — genuinely ambiguous), and the non-standard `status: "todo"` value (fix
  constraints forbid changing `status`). Writes confined to `.aidd`.

- **Audit finding review (2026-07-02):** Ran the aidd `audit-finding-review` ingredient over the
  three audit-sourced `remediation-*` findings. Verified every claim against the current tree:
  (1) `remediation-quality-gate-scripts` — ACCURATE (package.json defines only dev/build/lint/preview;
  no `typecheck`/`smoke:qc`; `.prettierrc` references three plugins absent from `bun.lock` — prettier
  is not installed) while AGENTS.md L169 and spec.md L32/76 require `bun run smoke:qc`;
  (2) `remediation-remove-config-drift` — ACCURATE (root `eslint.config.js` references non-existent
  `backend/**`, `scripts/**`, `drizzle.config.ts`, `tailwind.config.js` and imports eslint plugins
  not installed — lint actually runs via oxlint/`.oxlintrc.json`; `frontend/` holds only a second dead
  `eslint.config.js`; `.prettierrc` orphaned);
  (3) `remediation-tsconfig-strict` — ACCURATE (neither `tsconfig.app.json` nor `tsconfig.node.json`
  sets `"strict": true`, against AGENTS.md zero-tolerance-for-`any`). Disposition: all three **KEEP**
  (accurate + necessary + app-specific). This is a bare Vite+React SPA, not a `spernakit_version`
  derived app, so nothing is TEMPLATE-APPLICABLE and nothing ESCALATEs; the config-drift finding is a
  remove-the-drift cleanup, not a template gap. No REMOVE / CONSOLIDATE / DOWNGRADE. No feature.json
  mutations made (KEEP = leave as-is). Phase 6.6 roadmap reconciliation skipped — no
  `.aidd/roadmap.json` exists. Verification: all three feature.json parse as valid JSON, no orphaned
  feature dirs, and the sole dependency (`remediation-remove-config-drift` -> `remediation-quality-gate-scripts`)
  resolves. Note: `kanban-board/` is git-ignored by the parent `d:/applications` repo and has no repo
  of its own, so there is nothing to commit; writes confined to `.aidd`.

### Changed

### Deprecated

### Removed

### Fixed

### Security
