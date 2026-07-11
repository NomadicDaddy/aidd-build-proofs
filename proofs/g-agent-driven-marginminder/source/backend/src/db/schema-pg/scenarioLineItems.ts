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

import { costCatalogItems } from './costCatalogItems.ts';
import { quoteScenarios } from './quoteScenarios.ts';

const SCENARIO_LINE_ITEM_CATEGORIES = [
	'labor',
	'material',
	'subcontractor',
	'overhead',
	'fee',
	'other',
] as const;

/**
 * Scenario line items table (PostgreSQL variant).
 *
 * @see ../schema/scenarioLineItems.ts for SQLite variant and full documentation
 */
const scenarioLineItems = pgTable(
	'scenario_line_items',
	{
		catalogItemId: integer('catalog_item_id'),
		category: text('category', { enum: SCENARIO_LINE_ITEM_CATEGORIES }).notNull(),
		createdAt: timestamp('created_at', { mode: 'date' })
			.notNull()
			.$defaultFn(() => new Date()),
		id: serial('id').primaryKey(),
		markupPercent: doublePrecision('markup_percent').notNull().default(0),
		name: text('name').notNull(),
		notes: text('notes'),
		quantity: doublePrecision('quantity').notNull().default(1),
		scenarioId: integer('scenario_id').notNull(),
		sortOrder: integer('sort_order').notNull().default(0),
		taxable: boolean('taxable').notNull().default(true),
		unit: text('unit').notNull(),
		unitCost: doublePrecision('unit_cost').notNull().default(0),
		updatedAt: timestamp('updated_at', { mode: 'date' })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => [
		foreignKey({
			columns: [table.catalogItemId],
			foreignColumns: [costCatalogItems.id],
			name: 'fk_scenario_line_items_catalog_item_id_cost_catalog_items',
		}).onDelete('set null'),
		foreignKey({
			columns: [table.scenarioId],
			foreignColumns: [quoteScenarios.id],
			name: 'fk_scenario_line_items_scenario_id_quote_scenarios',
		}).onDelete('cascade'),
		index('idx_scenario_line_items_catalog_item_id').on(table.catalogItemId),
		index('idx_scenario_line_items_scenario_id').on(table.scenarioId),
		index('idx_scenario_line_items_scenario_id_sort_order').on(
			table.scenarioId,
			table.sortOrder
		),
	]
);

export { scenarioLineItems };
