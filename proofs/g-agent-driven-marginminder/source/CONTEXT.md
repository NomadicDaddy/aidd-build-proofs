# Margin Minder Context

Margin Minder is the pricing and margin planning context for small service-business quote
work. Its language centers on reusable cost assumptions, quote scenarios, server-derived
pricing outcomes, and risk signals before a quote leaves the business.

## Language

**Cost Catalog Item**:
A reusable cost assumption that can seed scenario pricing without becoming the live source
of truth for an existing scenario.
_Avoid_: Product, SKU, inventory item

**Catalog Assumption**:
The copied cost, markup, taxability, and review-date information carried from a
**Cost Catalog Item** into a scenario.
_Avoid_: Live catalog link, inventory sync

**Quote Scenario**:
A saved pricing model for one possible response to a customer request.
_Avoid_: Invoice, estimate, job, order

**Scenario Status**:
The lifecycle label for a **Quote Scenario**: draft, review, approved, or archived.
_Avoid_: Workflow state, approval step

**Scenario Line Item**:
A quantity-based scenario cost component with unit cost, markup, category, taxability, and
optional catalog source.
_Avoid_: Invoice line, cart item

**Labor Entry**:
An hourly role-based labor component with internal cost, billable rate, and burden.
_Avoid_: Timesheet, employee record, payroll item

**Fixed Cost**:
A scenario-level cost component priced without quantity and unit-cost math.
_Avoid_: Overhead bucket, fee schedule

**Direct Cost**:
The pre-margin cost basis made from scenario line-item cost, labor internal cost, and fixed
cost.
_Avoid_: Expense total, subtotal

**Sell Price**:
The pre-tax price contribution produced by marking up scenario cost components or billing
labor hours.
_Avoid_: Revenue, invoice amount

**Final Price**:
The customer-facing scenario price after contingency, discount, and tax are applied.
_Avoid_: Total cost, gross profit

**Gross Profit**:
The amount left after subtracting **Direct Cost** from pre-tax **Final Price**.
_Avoid_: Margin, markup, net income

**Margin**:
Gross profit expressed as a percentage of pre-tax **Final Price**.
_Avoid_: Markup

**Markup**:
Gross profit expressed as a percentage of **Direct Cost**.
_Avoid_: Margin

**Target Margin**:
The desired minimum **Margin** for a **Quote Scenario**.
_Avoid_: Goal markup, required profit

**Target Margin Gap**:
The difference between actual **Margin** and **Target Margin**.
_Avoid_: Variance, delta

**Break-Even Price**:
The pre-tax price at which a **Quote Scenario** covers **Direct Cost** with no gross
profit.
_Avoid_: Minimum quote, floor price

**Contingency**:
An added amount based on **Direct Cost** to cover uncertainty in the scenario assumptions.
_Avoid_: Buffer, padding

**Discount**:
A reduction applied to the pre-tax subtotal before taxable amounts are calculated.
_Avoid_: Coupon, write-off

**Taxable Subtotal**:
The discounted sell-price amount subject to tax.
_Avoid_: Tax base, taxable revenue

**Risk Flag**:
A warning attached to a **Quote Scenario** when pricing assumptions may need review.
_Avoid_: Error, blocker, validation failure

**Stale Catalog Assumption**:
A **Risk Flag** raised when a scenario line references an unreviewed or outdated
**Cost Catalog Item**.
_Avoid_: Broken catalog item, missing catalog item

**Scenario Summary**:
The calculated pricing outcome for one **Quote Scenario**.
_Avoid_: Report, dashboard card

**Markdown Summary**:
A copyable plain-text version of a **Scenario Summary** for reuse outside Margin Minder.
_Avoid_: PDF export, public quote

## Relationships

- A **Quote Scenario** has zero or more **Scenario Line Items**, **Labor Entries**, and
  **Fixed Costs**.
- A **Scenario Line Item** may reference one **Cost Catalog Item**, but it keeps copied
  **Catalog Assumptions** after that catalog item changes or is archived.
- A **Scenario Summary** belongs to exactly one **Quote Scenario** and is calculated from
  persisted scenario inputs.
- **Direct Cost** is made from **Scenario Line Items**, **Labor Entries**, and
  **Fixed Costs**.
- **Final Price** includes tax; **Gross Profit**, **Margin**, and **Markup** use pre-tax
  price.
- A **Risk Flag** belongs to a **Scenario Summary** and does not block saving the
  underlying **Quote Scenario**.
- A **Markdown Summary** is derived from a saved **Quote Scenario** and its
  **Scenario Summary**.

## Example dialogue

> **Dev:** "When a **Cost Catalog Item** changes, should every linked **Quote Scenario**
> recalculate from the new catalog values?"
> **Domain expert:** "No. Each **Scenario Line Item** keeps its copied
> **Catalog Assumptions**. If the catalog review date becomes stale, the
> **Scenario Summary** can show a **Risk Flag**, but the quote math should remain based on
> the saved scenario inputs."

## Flagged ambiguities

- "scenario" is the common UI shorthand for **Quote Scenario**; use **Quote Scenario**
  when the domain boundary matters.
- "labor" can mean a catalog category, a scenario line-item category, or a structured
  **Labor Entry**; resolved: **Labor Entry** owns hours, internal cost, billable rate,
  and burden.
- "margin" and **Markup** are not interchangeable; **Margin** compares gross profit to
  pre-tax price, while **Markup** compares gross profit to **Direct Cost**.
