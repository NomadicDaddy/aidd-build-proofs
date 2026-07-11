import { doublePrecision, index, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

const QUOTE_SCENARIO_STATUSES = ['draft', 'review', 'approved', 'archived'] as const;

/**
 * Quote scenarios table (PostgreSQL variant).
 *
 * @see ../schema/quoteScenarios.ts for SQLite variant and full documentation
 */
const quoteScenarios = pgTable(
	'quote_scenarios',
	{
		assumptions: text('assumptions'),
		contingencyPercent: doublePrecision('contingency_percent').notNull().default(0),
		createdAt: timestamp('created_at', { mode: 'date' })
			.notNull()
			.$defaultFn(() => new Date()),
		customerName: text('customer_name').notNull(),
		discountPercent: doublePrecision('discount_percent').notNull().default(0),
		id: serial('id').primaryKey(),
		notes: text('notes'),
		status: text('status', { enum: QUOTE_SCENARIO_STATUSES }).notNull().default('draft'),
		targetMarginPercent: doublePrecision('target_margin_percent').notNull().default(30),
		taxRatePercent: doublePrecision('tax_rate_percent').notNull().default(0),
		title: text('title').notNull(),
		updatedAt: timestamp('updated_at', { mode: 'date' })
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
