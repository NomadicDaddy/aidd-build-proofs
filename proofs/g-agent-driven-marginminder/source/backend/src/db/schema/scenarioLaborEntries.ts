import { foreignKey, index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { quoteScenarios } from './quoteScenarios.ts';

/**
 * Labor assumptions for a quote scenario.
 */
const scenarioLaborEntries = sqliteTable(
	'scenario_labor_entries',
	{
		billableHourlyRate: real('billable_hourly_rate').notNull().default(0),
		burdenPercent: real('burden_percent').notNull().default(0),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
		hours: real('hours').notNull().default(0),
		id: integer('id').primaryKey({ autoIncrement: true }),
		internalHourlyCost: real('internal_hourly_cost').notNull().default(0),
		notes: text('notes'),
		roleName: text('role_name').notNull(),
		scenarioId: integer('scenario_id').notNull(),
		sortOrder: integer('sort_order').notNull().default(0),
		updatedAt: integer('updated_at', { mode: 'timestamp' })
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
