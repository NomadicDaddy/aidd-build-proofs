import { foreignKey, index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { quoteScenarios } from './quoteScenarios.ts';

/**
 * Fixed scenario-level costs that are not tied to quantity-based catalog line items.
 */
const scenarioFixedCosts = sqliteTable(
	'scenario_fixed_costs',
	{
		cost: real('cost').notNull().default(0),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
		id: integer('id').primaryKey({ autoIncrement: true }),
		markupPercent: real('markup_percent').notNull().default(0),
		name: text('name').notNull(),
		notes: text('notes'),
		scenarioId: integer('scenario_id').notNull(),
		sortOrder: integer('sort_order').notNull().default(0),
		taxable: integer('taxable', { mode: 'boolean' }).notNull().default(false),
		updatedAt: integer('updated_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => [
		foreignKey({
			columns: [table.scenarioId],
			foreignColumns: [quoteScenarios.id],
			name: 'fk_scenario_fixed_costs_scenario_id_quote_scenarios',
		}).onDelete('cascade'),
		index('idx_scenario_fixed_costs_scenario_id').on(table.scenarioId),
		index('idx_scenario_fixed_costs_scenario_id_sort_order').on(
			table.scenarioId,
			table.sortOrder
		),
	]
);

export { scenarioFixedCosts };
