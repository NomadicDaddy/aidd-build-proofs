import { foreignKey, index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

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
 * Quantity-based scenario line items.
 *
 * catalogItemId is nullable so archived or removed catalog assumptions do not
 * break existing scenario records.
 */
const scenarioLineItems = sqliteTable(
	'scenario_line_items',
	{
		catalogItemId: integer('catalog_item_id'),
		category: text('category', { enum: SCENARIO_LINE_ITEM_CATEGORIES }).notNull(),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
		id: integer('id').primaryKey({ autoIncrement: true }),
		markupPercent: real('markup_percent').notNull().default(0),
		name: text('name').notNull(),
		notes: text('notes'),
		quantity: real('quantity').notNull().default(1),
		scenarioId: integer('scenario_id').notNull(),
		sortOrder: integer('sort_order').notNull().default(0),
		taxable: integer('taxable', { mode: 'boolean' }).notNull().default(true),
		unit: text('unit').notNull(),
		unitCost: real('unit_cost').notNull().default(0),
		updatedAt: integer('updated_at', { mode: 'timestamp' })
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
