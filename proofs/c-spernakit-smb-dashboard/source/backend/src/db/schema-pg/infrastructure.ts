import { relations } from 'drizzle-orm';
import {
	boolean,
	foreignKey,
	index,
	integer,
	pgTable,
	serial,
	text,
	timestamp,
} from 'drizzle-orm/pg-core';
import { OWNER_KINDS } from 'spernakit-shared';

import { users } from './users.ts';

const OWNER_KIND_VALUES = OWNER_KINDS as unknown as readonly [string, ...string[]];

/**
 * Sites — physical or logical locations that group infrastructure assets
 * (offices, data centers, closets, cloud regions).
 *
 * Table features:
 * - Soft delete: isDeleted, deletedAt, deletedBy for recoverable deletion
 * - Audit fields: createdBy, updatedBy for tracking who created/modified records
 *
 * Foreign key cascade behavior:
 * - createdBy/updatedBy/deletedBy: onDelete 'set null' — records persist when the actor is deleted.
 */
const sites = pgTable(
	'sites',
	{
		address: text('address'),
		code: text('code'),
		createdAt: timestamp('created_at', { mode: 'date' })
			.notNull()
			.$defaultFn(() => new Date()),
		createdBy: integer('created_by'),
		deletedAt: timestamp('deleted_at', { mode: 'date' }),
		deletedBy: integer('deleted_by'),
		description: text('description'),
		id: serial('id').primaryKey(),
		isDeleted: boolean('is_deleted').notNull().default(false),
		name: text('name').notNull(),
		notes: text('notes'),
		updatedAt: timestamp('updated_at', { mode: 'date' })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedBy: integer('updated_by'),
	},
	(table) => [
		foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: 'fk_sites_created_by_users',
		}).onDelete('set null'),
		foreignKey({
			columns: [table.deletedBy],
			foreignColumns: [users.id],
			name: 'fk_sites_deleted_by_users',
		}).onDelete('set null'),
		foreignKey({
			columns: [table.updatedBy],
			foreignColumns: [users.id],
			name: 'fk_sites_updated_by_users',
		}).onDelete('set null'),
		index('idx_sites_is_deleted').on(table.isDeleted),
		index('idx_sites_name').on(table.name),
	]
);

/**
 * Network zones — logical network segments (VLANs, subnets, trust boundaries)
 * optionally scoped to a site.
 *
 * Foreign key cascade behavior:
 * - siteId: onDelete 'set null' — a zone survives deletion of its site.
 * - createdBy/updatedBy/deletedBy: onDelete 'set null'.
 */
const networkZones = pgTable(
	'network_zones',
	{
		cidr: text('cidr'),
		createdAt: timestamp('created_at', { mode: 'date' })
			.notNull()
			.$defaultFn(() => new Date()),
		createdBy: integer('created_by'),
		deletedAt: timestamp('deleted_at', { mode: 'date' }),
		deletedBy: integer('deleted_by'),
		description: text('description'),
		id: serial('id').primaryKey(),
		isDeleted: boolean('is_deleted').notNull().default(false),
		name: text('name').notNull(),
		notes: text('notes'),
		siteId: integer('site_id'),
		trustLevel: text('trust_level'),
		updatedAt: timestamp('updated_at', { mode: 'date' })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedBy: integer('updated_by'),
		vlanId: integer('vlan_id'),
	},
	(table) => [
		foreignKey({
			columns: [table.siteId],
			foreignColumns: [sites.id],
			name: 'fk_network_zones_site_id_sites',
		}).onDelete('set null'),
		foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: 'fk_network_zones_created_by_users',
		}).onDelete('set null'),
		foreignKey({
			columns: [table.deletedBy],
			foreignColumns: [users.id],
			name: 'fk_network_zones_deleted_by_users',
		}).onDelete('set null'),
		foreignKey({
			columns: [table.updatedBy],
			foreignColumns: [users.id],
			name: 'fk_network_zones_updated_by_users',
		}).onDelete('set null'),
		index('idx_network_zones_site_id').on(table.siteId),
		index('idx_network_zones_is_deleted').on(table.isDeleted),
	]
);

/**
 * Owners — accountable people or teams for assets and services. Kept distinct
 * from platform users so ownership can reference staff without app accounts.
 *
 * Foreign key cascade behavior:
 * - createdBy/updatedBy/deletedBy: onDelete 'set null'.
 */
const owners = pgTable(
	'owners',
	{
		createdAt: timestamp('created_at', { mode: 'date' })
			.notNull()
			.$defaultFn(() => new Date()),
		createdBy: integer('created_by'),
		deletedAt: timestamp('deleted_at', { mode: 'date' }),
		deletedBy: integer('deleted_by'),
		email: text('email'),
		id: serial('id').primaryKey(),
		isDeleted: boolean('is_deleted').notNull().default(false),
		kind: text('kind', { enum: OWNER_KIND_VALUES }).notNull().default('person'),
		name: text('name').notNull(),
		notes: text('notes'),
		phone: text('phone'),
		updatedAt: timestamp('updated_at', { mode: 'date' })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedBy: integer('updated_by'),
	},
	(table) => [
		foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: 'fk_owners_created_by_users',
		}).onDelete('set null'),
		foreignKey({
			columns: [table.deletedBy],
			foreignColumns: [users.id],
			name: 'fk_owners_deleted_by_users',
		}).onDelete('set null'),
		foreignKey({
			columns: [table.updatedBy],
			foreignColumns: [users.id],
			name: 'fk_owners_updated_by_users',
		}).onDelete('set null'),
		index('idx_owners_is_deleted').on(table.isDeleted),
		index('idx_owners_name').on(table.name),
	]
);

/**
 * Vendors — hardware/software suppliers and support providers referenced by
 * assets and services.
 *
 * Foreign key cascade behavior:
 * - createdBy/updatedBy/deletedBy: onDelete 'set null'.
 */
const vendors = pgTable(
	'vendors',
	{
		createdAt: timestamp('created_at', { mode: 'date' })
			.notNull()
			.$defaultFn(() => new Date()),
		createdBy: integer('created_by'),
		deletedAt: timestamp('deleted_at', { mode: 'date' }),
		deletedBy: integer('deleted_by'),
		id: serial('id').primaryKey(),
		isDeleted: boolean('is_deleted').notNull().default(false),
		name: text('name').notNull(),
		notes: text('notes'),
		supportContact: text('support_contact'),
		supportEmail: text('support_email'),
		supportPhone: text('support_phone'),
		updatedAt: timestamp('updated_at', { mode: 'date' })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedBy: integer('updated_by'),
		website: text('website'),
	},
	(table) => [
		foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: 'fk_vendors_created_by_users',
		}).onDelete('set null'),
		foreignKey({
			columns: [table.deletedBy],
			foreignColumns: [users.id],
			name: 'fk_vendors_deleted_by_users',
		}).onDelete('set null'),
		foreignKey({
			columns: [table.updatedBy],
			foreignColumns: [users.id],
			name: 'fk_vendors_updated_by_users',
		}).onDelete('set null'),
		index('idx_vendors_is_deleted').on(table.isDeleted),
		index('idx_vendors_name').on(table.name),
	]
);

const sitesRelations = relations(sites, ({ many }) => ({
	networkZones: many(networkZones),
}));

const networkZonesRelations = relations(networkZones, ({ one }) => ({
	site: one(sites, { fields: [networkZones.siteId], references: [sites.id] }),
}));

export { networkZones, networkZonesRelations, owners, sites, sitesRelations, vendors };
