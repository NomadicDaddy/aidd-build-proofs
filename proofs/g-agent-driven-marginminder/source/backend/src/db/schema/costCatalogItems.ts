import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

const COST_CATALOG_CATEGORIES = [
	'labor',
	'material',
	'subcontractor',
	'overhead',
	'fee',
	'other',
] as const;

/**
 * Reusable cost assumptions for quote scenarios.
 *
 * Catalog rows are archived via active=false instead of deleted so historical
 * scenarios can keep referencing the assumption that seeded a line item.
 */
const costCatalogItems = sqliteTable(
	'cost_catalog_items',
	{
		active: integer('active', { mode: 'boolean' }).notNull().default(true),
		category: text('category', { enum: COST_CATALOG_CATEGORIES }).notNull(),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
		defaultMarkupPercent: real('default_markup_percent').notNull().default(0),
		id: integer('id').primaryKey({ autoIncrement: true }),
		lastReviewedAt: integer('last_reviewed_at', { mode: 'timestamp' }),
		name: text('name').notNull(),
		notes: text('notes'),
		taxable: integer('taxable', { mode: 'boolean' }).notNull().default(true),
		unit: text('unit').notNull(),
		unitCost: real('unit_cost').notNull().default(0),
		updatedAt: integer('updated_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => [
		index('idx_cost_catalog_items_active').on(table.active),
		index('idx_cost_catalog_items_active_category').on(table.active, table.category),
		index('idx_cost_catalog_items_category').on(table.category),
		index('idx_cost_catalog_items_updated_at').on(table.updatedAt),
	]
);

export { costCatalogItems };
