#!/usr/bin/env bun
/**
 * Reset Database Script
 *
 * Removes the SQLite database, WAL/SHM files, and the .seeded marker
 * from the data/ directory. The database will be re-created and re-seeded
 * automatically when the backend starts.
 *
 * Usage:
 *   bun scripts/reset-database.ts
 */
import fs from 'node:fs';
import path from 'node:path';

const dataDir = path.resolve(import.meta.dirname, '..', 'data');

if (!fs.existsSync(dataDir)) {
	console.log('   No data/ directory found — nothing to reset.');
	process.exit(0);
}

const files = fs.readdirSync(dataDir);
let removed = 0;

for (const file of files) {
	if (
		file.endsWith('.db') ||
		file.endsWith('.db-shm') ||
		file.endsWith('.db-wal') ||
		file === '.seeded'
	) {
		fs.unlinkSync(path.join(dataDir, file));
		removed++;
	}
}

console.log(`   Cleared ${removed} database file${removed !== 1 ? 's' : ''} from data/`);
