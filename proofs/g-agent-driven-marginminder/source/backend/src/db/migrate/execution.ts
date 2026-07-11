import { type Database } from 'bun:sqlite';
import crypto from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { JournalEntry } from './journal.ts';

import { logger } from '../../utils/logger.ts';
import { createPreMigrationBackup, restoreFromBackup } from './backup.ts';
import { rewriteSqlForIdempotency } from './idempotency.ts';
import { validateDatabaseIntegrity } from './validate.ts';

function assertPreMigrationIntegrity(db: Database): void {
	const preErrors = validateDatabaseIntegrity(db);
	if (preErrors.length === 0) return;
	for (const error of preErrors) {
		logger.error({ error }, 'Pre-migration validation failed');
	}
	throw new Error(
		`Pre-migration database validation failed. Manual intervention required. ` +
			`Errors: ${preErrors.join('; ')}`
	);
}

function tryCreatePreMigrationBackup(dbPath: string): string | undefined {
	try {
		const backupPath = createPreMigrationBackup(dbPath);
		logger.info(`Pre-migration backup created: ${backupPath}`);
		return backupPath;
	} catch (err) {
		logger.warn({ err }, 'Failed to create pre-migration backup — proceeding without backup');
		return undefined;
	}
}

function assertPostMigrationIntegrity(
	db: Database,
	dbPath: string,
	backupPath: string | undefined
): void {
	const postErrors = validateDatabaseIntegrity(db);
	if (postErrors.length === 0) return;
	for (const error of postErrors) {
		logger.error({ error }, 'Post-migration validation failed');
	}
	if (!backupPath) return;

	logger.error(
		'Post-migration validation failed — attempting to restore from pre-migration backup'
	);
	db.close();
	try {
		restoreFromBackup(dbPath, backupPath);
		logger.error('Database restored from pre-migration backup. Manual migration required.');
	} catch (err) {
		logger.error(
			{ err },
			'Failed to restore from backup — database may be in inconsistent state'
		);
	}
	throw new Error(
		'Post-migration validation failed. Database restored from backup. Manual intervention required.'
	);
}

function applyMigrationEntry(db: Database, entry: JournalEntry, migrationsDir: string): void {
	const sqlPath = join(migrationsDir, `${entry.tag}.sql`);
	if (!existsSync(sqlPath)) {
		throw new Error(`Migration file not found: ${sqlPath}`);
	}

	const sql = readFileSync(sqlPath, 'utf8');
	const statements = sql
		.split('--> statement-breakpoint')
		.map((s) => s.trim())
		.filter((s) => s.length > 0);

	db.exec('BEGIN');
	try {
		for (const statement of statements) {
			try {
				db.exec(rewriteSqlForIdempotency(statement));
			} catch (err) {
				if (isBenignDdlError(err, entry.tag, statement)) {
					continue;
				}
				throw err;
			}
		}

		const hash = crypto.createHash('sha256').update(entry.tag).digest('hex');
		db.query('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)').run(
			hash,
			Date.now()
		);

		db.exec('COMMIT');
		logger.info(`  Applied migration: ${entry.tag}`);
	} catch (err) {
		db.exec('ROLLBACK');
		throw err;
	}
}

function isBenignDdlError(err: unknown, tag: string, statement: string): boolean {
	if (!(err instanceof Error)) return false;
	const msg = err.message.toLowerCase();
	const isBenign =
		msg.includes('duplicate column name') ||
		(msg.includes('already exists') &&
			(msg.includes('table') || msg.includes('index') || msg.includes('view'))) ||
		msg.includes('no such column');

	if (isBenign) {
		logger.warn(
			{ statement: statement.substring(0, 200) },
			`Benign DDL error in migration ${tag}, statement skipped: ${err.message}`
		);
	}

	return isBenign;
}

export {
	applyMigrationEntry,
	assertPostMigrationIntegrity,
	assertPreMigrationIntegrity,
	tryCreatePreMigrationBackup,
};
