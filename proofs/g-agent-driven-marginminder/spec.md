# Margin Minder - Local Pricing and Margin Planner

## Project Identity

- Product name: Margin Minder
- Application slug: marginminder
- Target path: `<WORKSPACE>/marginminder`
- Intended stack: Spernakit v3 full-stack application
- Runtime: Bun
- Backend: Elysia, Drizzle, SQLite, TypeBox route validation, pino logging
- Frontend: React 19, Vite, shadcn/ui, TanStack Query, Zustand, native fetch
- Configuration: JSON only, no `.env` files
- Database file: `data/marginminder.db`
- Current config ports: frontend `3440`, backend `3441`

## Purpose

Margin Minder is a local-first pricing and margin planning tool for small service
businesses. It helps an owner or operator build quote scenarios, model direct costs,
labor, overhead, discounts, taxes, contingency, and target profit before sending pricing
to a customer.

The app is not an accounting system and does not send quotes. Its job is to answer:

- What will this job probably cost?
- What price should I charge to hit my target margin?
- Which scenario is safest, most profitable, or easiest to explain?
- Which assumptions are making the quote risky?

## Product Principles

- Build the actual working app as the first screen, not a marketing landing page.
- Keep the UI operational, dense, and easy to scan.
- Every calculation must be explainable from visible inputs.
- Persist useful work locally so a user can close and reopen the app without losing
  scenarios.
- Prefer clear tables, compact forms, and comparison views over decorative presentation.
- Avoid external services in the initial build.

## Primary Users

### Owner-Operator

Runs a small service business and needs fast pricing confidence before sending a quote.

Goals:

- Save reusable cost assumptions.
- Build one or more quote scenarios for a customer request.
- Compare margin outcomes before choosing a price.
- Export a simple summary that can be copied into email or proposal tools.

### Office Manager

Maintains common rates and checks whether proposed jobs meet company margin rules.

Goals:

- Maintain labor rates, material markups, overhead defaults, and tax profiles.
- Flag risky or underpriced scenarios.
- Review recent quote activity.

## MVP Scope

Build a complete local web app that supports:

- Dashboard with active scenario count, average margin, below-target count, and recent
  scenarios.
- Cost catalog management for reusable labor, material, subcontractor, overhead, and fee
  entries.
- Quote scenario creation and editing.
- Scenario line items with quantity, unit cost, markup percentage, taxability, and category.
- Labor modeling with hours, billable rate, internal cost rate, and burden percentage.
- Fixed costs, discounts, tax, contingency, and target margin assumptions.
- Automatic price, cost, gross profit, margin, markup, and break-even calculations.
- Scenario comparison for at least two saved scenarios.
- Risk flags for below-target margin, high discount, missing contingency, and stale cost
  catalog assumptions.
- Exportable plain-text or Markdown summary for a selected scenario.
- Seed data that demonstrates a realistic service quote without requiring setup.

Do not implement payment processing, invoices, email sending, accounting sync, OAuth,
public sharing, multi-company tenancy, or third-party integrations in the initial build.

## Core Workflows

### 1. Review Business Snapshot

The dashboard shows:

- Total saved scenarios.
- Draft scenarios.
- Scenarios below target margin.
- Average gross margin across active scenarios.
- Recent scenario list with customer, title, status, total price, margin, and last updated.
- Quick actions for new scenario and cost catalog.

### 2. Maintain Cost Catalog

The user can create, edit, archive, and search catalog items.

Catalog item fields:

- Name.
- Category: labor, material, subcontractor, overhead, fee, other.
- Default unit.
- Unit cost.
- Default markup percentage.
- Taxable flag.
- Notes.
- Active or archived status.
- Last reviewed date.

Validation:

- Name is required.
- Unit cost must be zero or positive.
- Markup percentage must be zero or positive.
- Archived items remain visible in existing scenarios but are not suggested by default.

### 3. Create Quote Scenario

The user can create a scenario with:

- Customer name.
- Scenario title.
- Status: draft, review, approved, archived.
- Target margin percentage.
- Default tax rate.
- Contingency percentage.
- Discount percentage.
- Notes and assumptions.

Scenario detail must include editable sections for:

- Labor entries.
- Materials and other line items.
- Fixed costs.
- Summary and risk flags.

### 4. Calculate Pricing

The app calculates totals whenever scenario inputs change.

Definitions:

- Direct cost = sum of all line item costs + labor internal cost + fixed costs.
- Line item sell price = quantity _ unit cost _ (1 + markup percentage / 100).
- Labor internal cost = hours _ internal hourly cost _ (1 + burden percentage / 100).
- Labor sell price = hours \* billable hourly rate.
- Subtotal before discount = line item sell prices + labor sell price + fixed cost sell
  prices + contingency amount.
- Contingency amount = direct cost \* contingency percentage / 100.
- Discount amount = subtotal before discount \* discount percentage / 100.
- Taxable subtotal = sum of taxable sell prices after proportional discount.
- Tax amount = taxable subtotal \* tax rate / 100.
- Final price = subtotal before discount - discount amount + tax amount.
- Gross profit = final price - tax amount - direct cost.
- Margin percentage = gross profit / (final price - tax amount) \* 100.
- Markup percentage = gross profit / direct cost \* 100.
- Break-even price before tax = direct cost.
- Target price before tax = direct cost / (1 - target margin percentage / 100).

Display calculations with currency formatting and one decimal place for percentages.

Guardrails:

- Prevent divide-by-zero errors.
- If direct cost is zero, show margin and markup as unavailable instead of misleading
  percentages.
- Do not allow negative quantities, costs, hours, tax rates, discounts, contingencies, or
  margins.
- Warn, but do not block, a discount over 15 percent.

### 5. Compare Scenarios

The comparison page lets the user select two or more saved scenarios and view:

- Final price.
- Direct cost.
- Gross profit.
- Margin percentage.
- Target margin gap.
- Discount amount.
- Contingency amount.
- Risk flags.

The comparison must make the selected scenario names and key numbers easy to scan.

### 6. Export Scenario Summary

The user can generate and copy a Markdown summary containing:

- Customer and scenario title.
- Status.
- Final price.
- Direct cost.
- Gross profit.
- Margin percentage.
- Target margin.
- Major assumptions.
- Risk flags.

The export does not need PDF generation in the first pass.

## Data Model

Use SQLite with Drizzle schema files. Use snake_case table and column names in the
database and camelCase names in TypeScript.

### Tables

#### cost_catalog_items

- id
- name
- category
- unit
- unit_cost
- default_markup_percent
- taxable
- notes
- active
- last_reviewed_at
- created_at
- updated_at

#### quote_scenarios

- id
- customer_name
- title
- status
- target_margin_percent
- tax_rate_percent
- contingency_percent
- discount_percent
- notes
- assumptions
- created_at
- updated_at

#### scenario_line_items

- id
- scenario_id
- catalog_item_id nullable
- name
- category
- unit
- quantity
- unit_cost
- markup_percent
- taxable
- sort_order
- notes
- created_at
- updated_at

#### scenario_labor_entries

- id
- scenario_id
- role_name
- hours
- internal_hourly_cost
- billable_hourly_rate
- burden_percent
- sort_order
- notes
- created_at
- updated_at

#### scenario_fixed_costs

- id
- scenario_id
- name
- cost
- markup_percent
- taxable
- sort_order
- notes
- created_at
- updated_at

## Backend API

All endpoints should be under `/api/v1`.

Required domains:

- `GET /health`
- `GET /cost-catalog`
- `POST /cost-catalog`
- `PUT /cost-catalog/:id`
- `DELETE /cost-catalog/:id` or archive equivalent
- `GET /scenarios`
- `POST /scenarios`
- `GET /scenarios/:id`
- `PUT /scenarios/:id`
- `DELETE /scenarios/:id` or archive equivalent
- `GET /scenarios/:id/summary`
- `GET /dashboard`
- `POST /scenario-comparison`

Backend expectations:

- Use TypeBox validation on route input.
- Return structured validation errors.
- Keep calculation logic in a shared backend service with focused pure functions where useful.
- Recalculate server-side summaries from stored data instead of trusting frontend totals.
- Register every route file in `create-api-app.ts`.
- Add seed data for at least one realistic quote scenario.

## Frontend Pages

Use React Router and include navigation paths for:

- `/dashboard`
- `/cost-catalog`
- `/scenarios`
- `/scenarios/new`
- `/scenarios/:id`
- `/compare`
- `/settings` if the template already provides or expects it

The default route should take the user to `/dashboard`.

### Dashboard

Use compact metrics, recent scenarios, and clear quick actions.

### Cost Catalog

Use a searchable table with inline actions and a create/edit form.

### Scenarios List

Use status filters, customer/title search, and columns for price, margin, target margin,
risk count, and updated date.

### Scenario Detail

Use tabs or sections for assumptions, line items, labor, fixed costs, summary, and export.
The summary should stay visible enough that edits clearly affect totals.

### Compare

Use scenario selection controls and a comparison table. Include empty states when fewer
than two scenarios are selected.

## Frontend API Types

Define frontend API types independently under the frontend API area. Do not import backend
types into the frontend.

## UI Requirements

- Use shadcn/ui components and lucide icons.
- Use buttons with icons for add, edit, archive/delete, copy, and export actions.
- Use tables for catalog and scenario lists.
- Use forms with labels, inline validation, and disabled states during saves.
- Use toasts for save, copy, and error feedback.
- Use neutral, business-oriented colors with clear warning/error styling for risk flags.
- Avoid oversized hero sections, decorative cards, gradient orb backgrounds, and marketing
  copy.
- Ensure text fits in buttons, table cells, and cards at mobile and desktop widths.
- Include useful empty states that provide actions, not feature explanations.

## Configuration

Use JSON config only.

Expected app config:

- App name and slug.
- Frontend and backend ports.
- Database path under `data/`.
- CORS settings for local frontend/backend.
- Seed toggle if the template supports it.

## Quality Gates

Before considering the initial implementation complete:

- `bun install` has been run if dependencies are missing.
- `bun run smoke:qc` passes.
- Affected pages have been checked with the project crawltest command if available.
- Backend API and frontend build both complete without TypeScript errors.
- No database files exist outside `data/`.
- No `.env` files are introduced.

## Initial Feature Backlog

If the initializer creates `.aidd/features`, create feature metadata for these vertical
slices:

1. `feature-dashboard-snapshot`
    - Dashboard metrics, recent scenario list, risk counts, and quick actions.
2. `feature-cost-catalog`
    - CRUD or archive workflow for reusable cost assumptions.
3. `feature-scenario-editor`
    - Scenario creation, editing, line items, labor, fixed costs, and persistence.
4. `feature-pricing-calculation`
    - Server-side calculation service, frontend summary display, and risk flags.
5. `feature-scenario-comparison`
    - Select multiple scenarios and compare pricing outcomes.
6. `feature-scenario-export`
    - Generate and copy Markdown scenario summaries.

## Acceptance Criteria

The app is acceptable for the first AIDD-created build when:

- A user can open the app, see seeded data, and understand current pricing health.
- A user can create or edit a cost catalog item.
- A user can create a quote scenario with at least one labor entry and one line item.
- The scenario summary updates after saving edits.
- The app flags a below-target margin scenario.
- A user can compare at least two scenarios.
- A user can copy a Markdown summary.
- The local quality gate passes.
