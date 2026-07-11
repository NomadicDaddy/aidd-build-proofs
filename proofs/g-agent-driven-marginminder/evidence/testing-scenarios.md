# Testing Scenarios - Margin Minder

Local-first pricing and margin planning for small service businesses.

## Scenarios

1. `/spernakit-tester marginminder: Log in as OPERATOR, open /dashboard, verify saved scenario metrics and recent scenarios render from seeded data, use the Cost Catalog quick action, return to /dashboard, use the New Scenario quick action, and confirm both routes load without console or network errors`
2. `/spernakit-tester marginminder: Open /cost-catalog, search the catalog, create a new material item with unit cost, markup, taxable flag, notes, and last-reviewed date, edit it, archive it, enable Show archived catalog items, and confirm the archived row is still visible but inactive`
3. `/spernakit-tester marginminder: Create a new scenario from /scenarios/new with customer, title, target margin, tax, contingency, discount, notes, assumptions, one catalog-backed line item, one labor entry, and one fixed cost; save it and verify the app navigates to /scenarios/:id with totals and risk flags visible`
4. `/spernakit-tester marginminder: Open an existing scenario detail page, change assumptions, add another line item, update labor hours, add a taxable fixed cost, save, reload the page, and confirm all child rows and recalculated totals persist`
5. `/spernakit-tester marginminder: In the scenario editor, enter negative quantity, unit cost, line markup, labor hours, internal rate, billable rate, burden, fixed cost, fixed cost markup, target margin over 99.99, and discount over 100 where applicable; verify inline validation blocks save until corrected`
6. `/spernakit-tester marginminder: Build a scenario with high discount, no contingency, stale or missing catalog review date, and below-target margin; verify risk flags appear in the scenario summary, scenario list, dashboard recent row, comparison table, and Markdown export`
7. `/spernakit-tester marginminder: Open /scenarios, search by customer and title, filter by each status, toggle archived scenarios, clear filters from the empty state, and confirm pricing columns, target margin, risk counts, and edit links remain correct`
8. `/spernakit-tester marginminder: Open /compare, verify the empty state with zero and one selected scenario, select two seeded scenarios, compare final price, direct cost, gross profit, margin, target margin gap, discount, contingency, and risk flags, then clear the selection`
9. `/spernakit-tester marginminder: Open a saved scenario, switch to the Export tab, verify the Markdown includes customer, title, status, final price, direct cost, gross profit, margin, target margin, assumptions, and risks, click Copy, and confirm success feedback appears`
10. `/spernakit-tester marginminder: Log in as VIEWER and confirm product data can be browsed but mutating actions are unavailable or rejected; log in as OPERATOR and confirm catalog and scenario mutation workflows are available`
11. `/spernakit-tester marginminder: Log in as ADMIN, verify Settings tabs for application, users, roles, notifications, system health, scheduled tasks, audit logs, and bugs; confirm SYSOP-only tabs are not available until logging in as SYSOP`
12. `/spernakit-tester marginminder: Log in as SYSOP, open Settings > Authentication, Email, Backup, and Database, verify each SYSOP-gated tab loads, run a read-only database admin inspection of domain tables, and confirm no database file exists outside root data/`
13. `/spernakit-tester marginminder: Exercise the bug-report dialog from the app shell on a product page, submit a test bug report, open Settings > Bugs as ADMIN, and confirm the report appears for triage`
14. `/spernakit-tester marginminder: Switch the active workspace, verify the product navigation remains available, open dashboard/scenarios/catalog, and confirm workspace selection does not break route rendering or auth state`
15. `/spernakit-tester marginminder: Run a responsive pass on /dashboard, /cost-catalog, /scenarios, /scenarios/new, /scenarios/:id, and /compare at mobile and desktop widths, checking that tables scroll intentionally and buttons/text do not overlap`

## Post-Test Procedure

- Run `/bug2feature marginminder` if tester bugs were filed.
- Review any generated bug reports before deleting `data/bugs.json`.
- Run feature metadata validation after creating or changing feature records.
- Run `bun run smoke:qc` before committing fixes.
