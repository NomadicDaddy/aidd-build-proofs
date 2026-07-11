import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

const QUOTE_SCENARIO_STATUSES = ['draft', 'review', 'approved', 'archived'] as const;

/**
 * Top-level quote scenario assumptions.
 *
 * Scenario child rows hold editable labor, material, and fixed-cost details.
 * Pricing totals are intentionally recalculated from those rows instead of
 * stored here.
 */
const quoteScenarios = sqliteTable(
	'quote_scenarios',
	{
		assumptions: text('assumptions'),
		contingencyPercent: real('contingency_percent').notNull().default(0),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
		customerName: text('customer_name').notNull(),
		discountPercent: real('discount_percent').notNull().default(0),
		id: integer('id').primaryKey({ autoIncrement: true }),
		notes: text('notes'),
		status: text('status', { enum: QUOTE_SCENARIO_STATUSES }).notNull().default('draft'),
		targetMarginPercent: real('target_margin_percent').notNull().default(30),
		taxRatePercent: real('tax_rate_percent').notNull().default(0),
		title: text('title').notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => [
		index('idx_quote_scenarios_status').on(table.status),
		index('idx_quote_scenarios_status_updated_at').on(table.status, table.updatedAt),
		index('idx_quote_scenarios_updated_at').on(table.updatedAt),
	]
);

export { quoteScenarios };
