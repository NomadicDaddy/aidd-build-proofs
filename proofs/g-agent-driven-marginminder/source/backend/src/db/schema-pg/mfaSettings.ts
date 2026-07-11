import {
	boolean,
	foreignKey,
	integer,
	pgTable,
	serial,
	text,
	timestamp,
} from 'drizzle-orm/pg-core';
import { MFA_METHODS } from 'spernakit-shared';

import { users } from './users.ts';

/**
 * MFA settings table for multi-factor authentication (PostgreSQL variant).
 *
 * This schema maintains logical parity with the SQLite variant (../schema/mfaSettings.ts).
 * @see ../schema/mfaSettings.ts for full documentation
 */
const mfaSettings = pgTable(
	'mfa_settings',
	{
		backupCodesEncrypted: text('backup_codes_encrypted'),
		createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
		id: serial('id').primaryKey(),
		isEnabled: boolean('is_enabled').notNull().default(false),
		lastVerifiedAt: timestamp('last_verified_at', { mode: 'date' }),
		method: text('method', { enum: MFA_METHODS }).notNull().default('totp'),
		secretEncrypted: text('secret_encrypted').notNull(),
		updatedAt: timestamp('updated_at', { mode: 'date' }).notNull(),
		userId: integer('user_id').notNull().unique(),
	},
	(table) => [
		foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: 'fk_mfa_settings_user_id_users',
		}).onDelete('cascade'),
	]
);

export { mfaSettings };
