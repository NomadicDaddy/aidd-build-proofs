# Domain Context — Pantry

Shared vocabulary and entity model for the Pantry app. This describes the **product domain** from
`.aidd/spec.md`. Note: as of onboarding the product is not yet implemented — the repo ships the
stock Podex demo. Treat this as the target domain, and verify against source before assuming any of
it exists in code.

## What this app is

A small, single-household web app for tracking what's in the pantry: what you have, how much, what's
running low, and what's about to expire. Built on the repo's Podex stack (PowerShell/Pode server,
htmx + server-rendered fragments). No accounts, no multi-tenancy, no external services — one
household, one instance.

## Key entities

### Item

The single core entity. A physical thing kept in the pantry.

| Field        | Meaning                                                      | Notes     |
| ------------ | ------------------------------------------------------------ | --------- |
| `name`       | Human name of the item (e.g. "Olive oil")                    | required  |
| `category`   | Grouping used for the inventory view (e.g. "Oils", "Grains") | required  |
| `quantity`   | How many/much on hand                                        | ≥ 0       |
| `unit`       | Unit for the quantity (e.g. "bottles", "g", "cans")          |           |
| `expiry`     | Expiry date                                                  | optional  |
| `notes`      | Freeform notes                                               | optional  |
| `threshold`  | Reorder point; item is "low stock" at or below this          | default 1 |
| `created_at` | Timestamp                                                    |           |
| `updated_at` | Timestamp                                                    |           |

## Key relationships / derived views

There are no relational joins in the planned model — everything is a flat list of **Items**. The
"views" are filtered/derived projections of that one list:

- **Inventory** — all items, grouped by `category`, sorted by `name`.
- **Low stock** — items where `quantity <= threshold`. Count surfaced in the nav.
- **Expiring soon** — items whose `expiry` is within 7 days or already past, soonest first;
  expired vs. expiring shown distinctly. Count surfaced in the nav.
- **Filter/search** — a category select + text search over `name` and `notes` (case-insensitive),
  applied as an htmx fragment swap.

## Core interactions (vocabulary)

- **CRUD** — add / edit / delete an item. Add & edit are inline htmx forms; delete has a confirm step.
- **Quick adjust** — +/− buttons on a row that change only `quantity` and swap just that row
  (the "used one / bought more" flow) without opening the edit form.
- **CSV export** — download the full inventory as CSV.
- **Seed data** — a script that loads ~20 realistic sample items (including some low-stock and
  expiring rows) so every view has content.

## Boundaries (explicitly out of scope)

No authentication, no realtime, no external APIs, single household (no multi-tenancy). Keep views
accessible (labeled inputs, button semantics, keyboard-usable forms). Persist with the framework's
existing lightweight storage (SQLite) behind a small data-access layer.

## Framework vs. product

The **Podex framework** (routes in `api/`, views in `views/`, static assets in `public/`, started
via `podex.ps1`) is the substrate. **Pantry** is the product to build on it. Current
`.aidd/features/*` items are audit/remediation findings against the demo code, not pantry features;
pantry feature specs are captured in `.aidd/spec.md`.
