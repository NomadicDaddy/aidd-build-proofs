import {
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
 * Scenario labor entries table (PostgreSQL variant).
 *
 * @see ../schema/scenarioLaborEntries.ts for SQLite variant and full documentation
 */
const scenarioLaborEntries = pgTable(
	'scenario_labor_entries',
	{
		billableHourlyRate: doublePrecision('billable_hourly_rate').notNull().default(0),
		burdenPercent: doublePrecision('burden_percent').notNull().default(0),
		createdAt: timestamp('created_at', { mode: 'date' })
			.notNull()
			.$defaultFn(() => new Date()),
		hours: doublePrecision('hours').notNull().default(0),
		id: serial('id').primaryKey(),
		internalHourlyCost: doublePrecision('internal_hourly_cost').notNull().default(0),
		notes: text('notes'),
		roleName: text('role_name').notNull(),
		scenarioId: integer('scenario_id').notNull(),
		sortOrder: integer('sort_order').notNull().default(0),
		updatedAt: timestamp('updated_at', { mode: 'date' })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => [
		foreignKey({
			columns: [table.scenarioId],
			foreignColumns: [quoteScenarios.id],
			name: 'fk_scenario_labor_entries_scenario_id_quote_scenarios',
		}).onDelete('cascade'),
		index('idx_scenario_labor_entries_scenario_id').on(table.scenarioId),
		index('idx_scenario_labor_entries_scenario_id_sort_order').on(
			table.scenarioId,
			table.sortOrder
		),
	]
);

export { scenarioLaborEntries };
