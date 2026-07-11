# Testing Scenarios — Pantry

Pantry is a small hypermedia web app for tracking what's in the household pantry, built on this
repo's Pode (PowerShell) server with an htmx frontend and server-rendered views. It has no
authentication, no realtime, and no multi-tenancy — a single household managing one inventory. The
scenarios below exercise the nine core features from `.aidd/spec.md` (item model, CRUD, grouped
inventory list, category filter + search, low-stock view, expiring-soon view, quick adjust, CSV
export, seed data). Because the current build is a generic feature/CRUD scaffold with known
spec-drift, several scenarios are expected to surface gaps; that is intentional — run them, then
follow the Post-Test Procedure to feed findings into remediation.

> **Note:** This app is not a React/bun spernakit app; it is a Pode + htmx server-rendered app
> started via `podex.ps1`. Scenarios are still executed through the browser-driven
> `spernakit-tester` ingredient against the running frontend.

## Scenarios

1. `spernakit-tester pantry: I want to add a new pantry item with a name, category, quantity, unit, and expiry date through the Add Item form, then confirm it appears in the inventory list under its category.`
2. `spernakit-tester pantry: I want to inline-edit an existing item's quantity and notes and save it, then confirm the row updates in place without a full page reload.`
3. `spernakit-tester pantry: I want to delete an item, confirm the delete-confirmation step appears first, and verify the item is gone from the list after I confirm.`
4. `spernakit-tester pantry: I want to open a pantry with no items and confirm the empty-state message and add-item call-to-action are shown instead of a table.`
5. `spernakit-tester pantry: I want to verify the main inventory list groups items by category, sorts them by name within each group, and shows quantity, unit, and an expiry badge on each row.`
6. `spernakit-tester pantry: I want to filter the list by a single category and simultaneously type a case-insensitive search term that matches an item name and its notes, and confirm only matching rows remain without a page reload.`
7. `spernakit-tester pantry: I want to open the low-stock view and confirm it shows only items at or below their per-item reorder threshold, and that the low-stock count in the nav matches.`
8. `spernakit-tester pantry: I want to open the expiring-soon view and confirm it lists items expiring within seven days or already expired, soonest first, with expired items visually distinct from expiring ones, and the nav count matching.`
9. `spernakit-tester pantry: I want to use the plus and minus quick-adjust buttons on a row to change its quantity, and confirm only that row swaps rather than the whole list.`
10. `spernakit-tester pantry: I want to submit the add-item form with a blank name, a negative quantity, and an invalid expiry date, and confirm each server-side validation error renders inline in the form fragment without losing my other input.`
11. `spernakit-tester pantry: I want to export the full inventory via the CSV export endpoint and confirm the download has proper headers, quoted fields, and one row per item.`
12. `spernakit-tester pantry: I want to run the seed-data script and confirm roughly twenty realistic items load across categories, including at least one low-stock item and one expiring item so every view has content.`
13. `spernakit-tester pantry: I want to quick-adjust an item's quantity down past its reorder threshold and confirm it then appears in the low-stock view and increments the nav low-stock count.`
14. `spernakit-tester pantry: I want to add an item whose expiry date is three days out and confirm it immediately shows in the expiring-soon view with an expiring (not expired) badge.`

---

## Post-Test Procedure

- Run the AIDD-local `bug2feature` ingredient for pantry
- delete the ingested bugs from bugs.json files (delete them if only placeholder or tests remain)
- Run the AIDD-local `feature-review` ingredient for pantry
- iterate through remediation features created, resolving all issues and ensuring fixes applied intelligently to template as applicable
- delete remediation features resolved
- create session report (include time taken for each step among details)
