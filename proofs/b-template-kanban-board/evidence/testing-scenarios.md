# Testing Scenarios — Kanban Board

A local, single-user Kanban board: boards own ordered columns, columns own ordered cards, and you drag cards between and within columns to reorder and change status. All state lives in the browser (`localStorage`) — there is no backend, no accounts, and no RBAC, so scenarios exercise client-side flows and reload persistence rather than auth tiers.

## Scenarios

1. `spernakit-tester kanban-board: I want to create a new board, add To Do / Doing / Done columns, drop a couple of cards into To Do, drag one across to Doing, then reload the page and confirm the board, columns, and the card's new column all survived.`
2. `spernakit-tester kanban-board: I want to create several boards, rename one, switch the active board back and forth, then delete a board and confirm the remaining boards and their cards are untouched.`
3. `spernakit-tester kanban-board: I want to add a new column to the active board, rename it, and drag it to a different position in the column order, then reload and confirm the new column name and order persisted.`
4. `spernakit-tester kanban-board: I want to attempt to delete a column that still holds cards and confirm the app follows its defined rule — either blocking the delete of a non-empty column or predictably moving/removing its cards without orphaning any.`
5. `spernakit-tester kanban-board: I want to add a card with a title, description, and one or more labels, then edit each of those fields on the saved card and confirm the updates stick after reload.`
6. `spernakit-tester kanban-board: I want to reorder two cards within a single column by dragging, then reload and confirm the new within-column order was persisted.`
7. `spernakit-tester kanban-board: I want to drag a card from one column to another to change its status, confirm it disappears from the source column and appears in the target column at the drop position, and that the change survives a reload.`
8. `spernakit-tester kanban-board: I want to delete a card from a column and confirm it is removed from the column's card order and does not reappear after reload.`
9. `spernakit-tester kanban-board: I want to filter and search cards by text and by label across the active board and confirm only matching cards remain visible while non-matching cards are hidden until the filter is cleared.`
10. `spernakit-tester kanban-board: I want to verify persistence resilience by corrupting or clearing the localStorage state and reloading, confirming the app falls back to a clean default board without crashing rather than showing a broken screen.`

---

## Post-Test Procedure

- Run the native `bug2feature` ingredient for kanban-board
- delete the ingested bugs from bugs.json files (delete them if only placeholder or tests remain)
- Run the native `feature-review` ingredient for kanban-board
- iterate through remediation features created, resolving all issues and ensuring fixes applied intelligently to template as applicable
- delete remediation features resolved
- create session report (include time taken for each step among details)
