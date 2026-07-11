import { Database } from 'bun:sqlite';
import crypto from 'node:crypto';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import type { DrizzleJournal, JournalEntry } from './journal.ts';

import { logger } from '../../utils/logger.ts';

function assertNoMigrationDrift(migrationsDir: string, journal: DrizzleJournal): void {
	if (!existsSync(migrationsDir)) return;
	const journaledTags = new Set(journal.entries.map((e) => e.tag));
	const sqlFiles = readdirSync(migrationsDir)
		.filter((f) => f.endsWith('.sql'))
		.map((f) => f.replace(/\.sql$/, ''));
	const orphaned = sqlFiles.filter((tag) => !journaledTags.has(tag));
	if (orphaned.length === 0) return;
	logger.error(
		{ orphaned },
		`Migration drift detected: ${orphaned.length} .sql file(s) exist on disk ` +
			`but are not registered in _journal.json. Either delete the orphaned ` +
			`files or add them to _journal.json. Runner refuses to proceed.`
	);
	throw new Error(
		`Migration drift: orphaned .sql file(s) not in journal: ${orphaned.join(', ')}`
	);
}

function openMigrationDatabase(dbPath: string): Database {
	const db = new Database(dbPath);
	db.exec('PRAGMA journal_mode = WAL');
	db.exec('PRAGMA foreign_keys = ON');
	db.exec(`
		CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			hash TEXT NOT NULL,
			created_at INTEGER
		)
	`);
	return db;
}

function selectPendingMigrations(db: Database, entries: JournalEntry[]): JournalEntry[] {
	const applied = db.query<{ hash: string }, []>('SELECT hash FROM __drizzle_migrations').all();
	const appliedHashes = new Set(applied.map((m) => m.hash));
	return entries.filter((entry) => {
		const hash = crypto.createHash('sha256').update(entry.tag).digest('hex');
		return !appliedHashes.has(hash);
	});
}

function resolveJournalPathFromDb(dbPath: string): string | undefined {
	const dataDir = join(dbPath, '..');
	const projectRoot = join(dataDir, '..');
	const journalPath = join(projectRoot, 'backend', 'drizzle', 'meta', '_journal.json');
	return existsSync(journalPath) ? journalPath : undefined;
}

export {
	assertNoMigrationDrift,
	openMigrationDatabase,
	resolveJournalPathFromDb,
	selectPendingMigrations,
};
