import { relations, sql } from 'drizzle-orm';
import {
	boolean,
	foreignKey,
	index,
	integer,
	pgTable,
	serial,
	text,
	timestamp,
	uniqueIndex,
} from 'drizzle-orm/pg-core';
import { ASSET_RELATIONSHIP_TYPES, RELATIONSHIP_CONFIDENCE_LEVELS } from 'spernakit-shared';

import { assets } from './assets.ts';
import { users } from './users.ts';
import { workspaces } from './workspaces.ts';

const RELATIONSHIP_TYPE_VALUES = ASSET_RELATIONSHIP_TYPES as unknown as readonly [
	string,
	...string[],
];
const CONFIDENCE_VALUES = RELATIONSHIP_CONFIDENCE_LEVELS as unknown as readonly [
	string,
	...string[],
];

/**
 * Asset relationships — directed, first-class edges between two assets
 * (source → target) with a typed relationship and confidence rating.
 *
 * Table features:
 * - Soft delete + audit fields
 * - Optional workspace scoping (workspaceId)
 * - A partial unique index prevents duplicate active edges of the same type/direction.
 *
 * Foreign key cascade behavior:
 * - sourceAssetId/targetAssetId: onDelete 'cascade' — an edge disappears with either endpoint.
 * - workspaceId: onDelete 'set null'.
 * - createdBy/updatedBy/deletedBy: onDelete 'set null'.
 */
const assetRelationships = pgTable(
	'asset_relationships',
	{
		confidence: text('confidence', { enum: CONFIDENCE_VALUES }).notNull().default('confirmed'),
		createdAt: timestamp('created_at', { mode: 'date' })
			.notNull()
			.$defaultFn(() => new Date()),
		createdBy: integer('created_by'),
		deletedAt: timestamp('deleted_at', { mode: 'date' }),
		deletedBy: integer('deleted_by'),
		id: serial('id').primaryKey(),
		isDeleted: boolean('is_deleted').notNull().default(false),
		notes: text('notes'),
		relationshipType: text('relationship_type', { enum: RELATIONSHIP_TYPE_VALUES }).notNull(),
		sourceAssetId: integer('source_asset_id').notNull(),
		targetAssetId: integer('target_asset_id').notNull(),
		updatedAt: timestamp('updated_at', { mode: 'date' })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedBy: integer('updated_by'),
		workspaceId: integer('workspace_id'),
	},
	(table) => [
		foreignKey({
			columns: [table.sourceAssetId],
			foreignColumns: [assets.id],
			name: 'fk_asset_relationships_source_asset_id_assets',
		}).onDelete('cascade'),
		foreignKey({
			columns: [table.targetAssetId],
			foreignColumns: [assets.id],
			name: 'fk_asset_relationships_target_asset_id_assets',
		}).onDelete('cascade'),
		foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: 'fk_asset_relationships_workspace_id_workspaces',
		}).onDelete('set null'),
		foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: 'fk_asset_relationships_created_by_users',
		}).onDelete('set null'),
		foreignKey({
			columns: [table.updatedBy],
			foreignColumns: [users.id],
			name: 'fk_asset_relationships_updated_by_users',
		}).onDelete('set null'),
		foreignKey({
			columns: [table.deletedBy],
			foreignColumns: [users.id],
			name: 'fk_asset_relationships_deleted_by_users',
		}).onDelete('set null'),
		index('idx_asset_relationships_source_asset_id').on(table.sourceAssetId),
		index('idx_asset_relationships_target_asset_id').on(table.targetAssetId),
		index('idx_asset_relationships_relationship_type').on(table.relationshipType),
		index('idx_asset_relationships_is_deleted').on(table.isDeleted),
		// Prevents duplicate active edges of the same (source, target, type). Soft-deleted
		// edges are excluded so an edge can be recreated after removal.
		uniqueIndex('idx_asset_relationships_unique_active')
			.on(table.sourceAssetId, table.targetAssetId, table.relationshipType)
			.where(sql`${table.isDeleted} = 0`),
	]
);

const assetRelationshipsRelations = relations(assetRelationships, ({ one }) => ({
	sourceAsset: one(assets, {
		fields: [assetRelationships.sourceAssetId],
		references: [assets.id],
		relationName: 'relationshipSource',
	}),
	targetAsset: one(assets, {
		fields: [assetRelationships.targetAssetId],
		references: [assets.id],
		relationName: 'relationshipTarget',
	}),
}));

export { assetRelationships, assetRelationshipsRelations };
