import {
	boolean,
	doublePrecision,
	foreignKey,
	index,
	integer,
	pgTable,
	serial,
	text,
	timestamp,
} from 'drizzle-orm/pg-core';

import { quoteScenarios } from './quoteScenarios.ts';

/**
 * Scenario fixed costs table (PostgreSQL variant).
 *
 * @see ../schema/scenarioFixedCosts.ts for SQLite variant and full documentation
 */
const scenarioFixedCosts = pgTable(
	'scenario_fixed_costs',
	{
		cost: doublePrecision('cost').notNull().default(0),
		createdAt: timestamp('created_at', { mode: 'date' })
			.notNull()
			.$defaultFn(() => new Date()),
		id: serial('id').primaryKey(),
		markupPercent: doublePrecision('markup_percent').notNull().default(0),
		name: text('name').notNull(),
		notes: text('notes'),
		scenarioId: integer('scenario_id').notNull(),
		sortOrder: integer('sort_order').notNull().default(0),
		taxable: boolean('taxable').notNull().default(false),
		updatedAt: timestamp('updated_at', { mode: 'date' })
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
