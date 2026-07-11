# Pantry — household pantry/stock tracker

A small hypermedia web app for tracking what's in the pantry, built on this repo's existing
framework: **Pode (PowerShell) server, htmx frontend, server-rendered views**. Follow the
framework's established idioms — routes in `api/`, views in `views/`, static assets in `public/`,
tests in `tests/`, started via `podex.ps1`. Do not introduce a SPA framework, a bundler, or a
Node server; htmx partial swaps against server-rendered fragments are the interaction model.

## Core features

1. **Item model + storage.** Pantry items with: name, category, quantity, unit, expiry date
   (optional), notes (optional), created/updated timestamps. Persist using whatever lightweight
   storage the framework already supports (JSON file or SQLite — pick the one that fits podex
   conventions; keep it swappable behind a small data-access layer).
2. **Item CRUD.** Server-rendered list page with add/edit/delete. Add and edit are inline forms
   (htmx `hx-post`/`hx-put` returning the updated row/fragment); delete with a confirm step.
   Server-side validation (name required, quantity ≥ 0, valid date) with errors rendered in the
   fragment.
3. **Inventory list view.** The main page: all items grouped by category, sorted by name, with
   quantity + unit and an expiry badge. Empty state with a call-to-action when no items exist.
4. **Category filter + text search.** A filter bar (category select + search input) that swaps the
   list fragment via `hx-get` — no full page reloads. Search matches name and notes,
   case-insensitive.
5. **Low-stock view.** Items at or below a per-item reorder threshold (add `threshold` to the
   model, default 1). A dedicated view or filter chip; count surfaced in the nav.
6. **Expiring-soon view.** Items whose expiry date is within 7 days (or past), soonest first, with
   clear expired-vs-expiring visual distinction. Count surfaced in the nav.
7. **Quick adjust.** +/− quantity buttons on each row (htmx swap of just that row) for the common
   "used one / bought more" flow without opening the edit form.
8. **CSV export.** An endpoint that downloads the full inventory as CSV (proper headers, quoting).
9. **Seed data script.** A script that loads ~20 realistic sample items across categories,
   including a few low-stock and expiring rows, so every view has content to show.

## Quality bar

- All features covered by the repo's test framework in `tests/`; the repo's existing build/test
  entry points (`.build.ps1`, `package.json` scripts) stay green.
- Keep views accessible: labeled inputs, button semantics, keyboard-usable forms.
- No authentication, no realtime, no external APIs, single household (no multi-tenancy).
