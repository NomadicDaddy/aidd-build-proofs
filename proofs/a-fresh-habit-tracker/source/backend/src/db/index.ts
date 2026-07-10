/**
 * SQLite database client.
 *
 * Opens the `bun:sqlite` database at the config-resolved absolute path (always
 * under the project's `data/` directory), enables foreign-key enforcement, and
 * wraps it with Drizzle bound to the app schema. The connection is created
 * lazily and memoized so the file is opened once per process.
 */
import { Database } from 'bun:sqlite';
import { drizzle, type BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';

import { getConfig } from '../lib/config.ts';
import * as schema from './schema/index.ts';

type AppDatabase = BunSQLiteDatabase<typeof schema>;

let sqlite: Database | null = null;
let db: AppDatabase | null = null;

/** Get the memoized Drizzle database instance, opening the connection on first use. */
export function getDb(): AppDatabase {
	if (db) return db;

	const config = getConfig();
	sqlite = new Database(config.databasePath);
	sqlite.exec('PRAGMA journal_mode = WAL');
	sqlite.exec('PRAGMA foreign_keys = ON');
	db = drizzle(sqlite, { schema });
	return db;
}

/** Close the underlying SQLite handle (used by scripts and graceful shutdown). */
export function closeDb(): void {
	if (sqlite) {
		sqlite.close();
		sqlite = null;
		db = null;
	}
}
