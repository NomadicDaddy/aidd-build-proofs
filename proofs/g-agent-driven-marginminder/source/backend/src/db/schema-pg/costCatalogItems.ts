import {
	boolean,
	doublePrecision,
	index,
	pgTable,
	serial,
	text,
	timestamp,
} from 'drizzle-orm/pg-core';

const COST_CATALOG_CATEGORIES = [
	'labor',
	'material',
	'subcontractor',
	'overhead',
	'fee',
	'other',
] as const;

/**
 * Cost catalog items table (PostgreSQL variant).
 *
 * @see ../schema/costCatalogItems.ts for SQLite variant and full documentation
 */
const costCatalogItems = pgTable(
	'cost_catalog_items',
	{
		active: boolean('active').notNull().default(true),
		category: text('category', { enum: COST_CATALOG_CATEGORIES }).notNull(),
		createdAt: timestamp('created_at', { mode: 'date' })
			.notNull()
			.$defaultFn(() => new Date()),
		defaultMarkupPercent: doublePrecision('default_markup_percent').notNull().default(0),
		id: serial('id').primaryKey(),
		lastReviewedAt: timestamp('last_reviewed_at', { mode: 'date' }),
		name: text('name').notNull(),
		notes: text('notes'),
		taxable: boolean('taxable').notNull().default(true),
		unit: text('unit').notNull(),
		unitCost: doublePrecision('unit_cost').notNull().default(0),
		updatedAt: timestamp('updated_at', { mode: 'date' })
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
