#!/usr/bin/env bun
import { Database } from 'bun:sqlite';
/**
 * Database Migration Script for Spernakit v3
 *
 * Manages Drizzle Kit migrations with support for:
 * - Running pending migrations
 * - Baseline marking for existing databases
 * - Migration status reporting
 * - Pre-migration validation
 * - Rollback support
 * - Performance metrics
 *
 * Usage:
 *   bun run db:migrate           - Run pending migrations
 *   bun run db:migrate --status  - Show migration status
 *   bun run db:migrate --baseline - Mark initial migration as applied (for existing dbs)
 *   bun run db:migrate --validate - Check database state before migrating
 *   bun run db:migrate --rollback - Show rollback status
 *
 * IMPORTANT:
 *   - Never use db:push in production
 *   - Always generate migrations after schema changes
 *   - Test migrations in staging before production
 *   - Back up database before migrating
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadJsonConfig } from './load-json-config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = path.resolve(path.join(__dirname, '..'));

/** Journal entry from drizzle's meta/_journal.json */
interface JournalEntry {
	breakpoints: boolean;
	idx: number;
	tag: string;
	version: string;
	when: number;
}

/** Drizzle journal file format */
interface DrizzleJournal {
	dialect: string;
	entries: JournalEntry[];
	version: string;
}

/** Migration record from database */
interface MigrationRecord {
	created_at: number;
	hash: string;
	id: number;
}

/** Result of pre-migration validation */
interface ValidationResult {
	issues: string[];
	valid: boolean;
}

/** Performance metrics for a migration */
interface PerformanceMetrics {
	durationMs: number;
	statementCount: number;
}

/** Migration history entry persisted to data/migration-history.json */
interface MigrationHistoryEntry {
	contentHash?: string;
	durationMs: number;
	error?: string;
	migrationTag: string;
	statementCount: number;
	status: 'failed' | 'success';
	timestamp: string;
}

/** Paths configuration */
interface Paths {
	database: string;
	journalPath: string;
	migrationsDir: string;
	rollbacksDir: string;
}

/**
 * Get paths for migration files and database.
 */
function getPaths(appSlug: string): Paths {
	const backendDir = path.join(repoRoot, 'backend');
	const migrationsDir = path.join(backendDir, 'drizzle');
	const journalPath = path.join(migrationsDir, 'meta', '_journal.json');
	const database = path.join(repoRoot, 'data', `${appSlug}.db`);
	const rollbacksDir = path.join(migrationsDir, 'rollbacks');

	return { database, journalPath, migrationsDir, rollbacksDir };
}

/** Path to migration history file */
function getMigrationHistoryPath(): string {
	return path.join(repoRoot, 'data', 'migration-history.json');
}

/** Read existing migration history from JSON file */
function readMigrationHistory(): MigrationHistoryEntry[] {
	const historyPath = getMigrationHistoryPath();
	if (!fs.existsSync(historyPath)) {
		return [];
	}
	try {
		const content = fs.readFileSync(historyPath, 'utf8');
		return JSON.parse(content) as MigrationHistoryEntry[];
	} catch {
		return [];
	}
}

/** Keep at most this many recent entries per migrationTag. */
const MAX_HISTORY_ENTRIES_PER_TAG = 3;

/** Hard cap on total history entries retained across all tags. */
const MAX_MIGRATION_HISTORY_ENTRIES = 200;

/**
 * Prune a migration history array so that each migrationTag retains only its
 * N most recent entries, and the overall length is capped. Preserves input
 * order between entries of different tags.
 */
function pruneMigrationHistory(history: MigrationHistoryEntry[]): MigrationHistoryEntry[] {
	const perTagRecentCount = new Map<string, number>();
	const pruned: MigrationHistoryEntry[] = [];
	for (let i = history.length - 1; i >= 0; i--) {
		const entry = history[i];
		if (!entry) continue;
		const count = perTagRecentCount.get(entry.migrationTag) ?? 0;
		if (count < MAX_HISTORY_ENTRIES_PER_TAG) {
			pruned.push(entry);
			perTagRecentCount.set(entry.migrationTag, count + 1);
		}
	}
	pruned.reverse();
	if (pruned.length > MAX_MIGRATION_HISTORY_ENTRIES) {
		return pruned.slice(pruned.length - MAX_MIGRATION_HISTORY_ENTRIES);
	}
	return pruned;
}

/** Append a migration history entry to the JSON file */
function appendMigrationHistory(entry: MigrationHistoryEntry): void {
	const historyPath = getMigrationHistoryPath();
	const history = readMigrationHistory();
	history.push(entry);
	const trimmed = pruneMigrationHistory(history);

	// Ensure data directory exists
	const dataDir = path.dirname(historyPath);
	if (!fs.existsSync(dataDir)) {
		fs.mkdirSync(dataDir, { recursive: true });
	}

	fs.writeFileSync(historyPath, JSON.stringify(trimmed, null, 2), 'utf8');
}

/**
 * Read the drizzle journal file.
 */
function readJournal(journalPath: string): DrizzleJournal {
	if (!fs.existsSync(journalPath)) {
		throw new Error(`Journal file not found: ${journalPath}\nRun 'bun run db:generate' first.`);
	}

	const content = fs.readFileSync(journalPath, 'utf8');
	return JSON.parse(content) as DrizzleJournal;
}

/**
 * Read a migration SQL file.
 */
function readMigrationSql(migrationsDir: string, tag: string): string {
	const sqlPath = path.join(migrationsDir, `${tag}.sql`);
	if (!fs.existsSync(sqlPath)) {
		throw new Error(`Migration file not found: ${sqlPath}`);
	}
	return fs.readFileSync(sqlPath, 'utf8');
}

/**
 * Compute hash for a migration tag (matches drizzle-kit's format).
 * Uses the tag name as input to maintain compatibility with drizzle-kit's
 * migration tracking in __drizzle_migrations.
 */
function computeHash(tag: string): string {
	return crypto.createHash('sha256').update(tag).digest('hex');
}

/**
 * Compute a content hash for verifying migration SQL integrity.
 * Unlike computeHash (which hashes the tag name for drizzle compatibility),
 * this hashes the actual SQL to detect tampering.
 */
function computeContentHash(sql: string): string {
	return crypto.createHash('sha256').update(sql).digest('hex');
}

/**
 * Ensure the migrations table exists.
 */
function ensureMigrationsTable(db: Database): void {
	db.exec(`
		CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			hash TEXT NOT NULL,
			created_at INTEGER
		)
	`);
}

/**
 * Get applied migrations from database.
 */
function getAppliedMigrations(db: Database): MigrationRecord[] {
	ensureMigrationsTable(db);
	const stmt = db.query<MigrationRecord, []>(
		'SELECT id, hash, created_at FROM __drizzle_migrations ORDER BY id'
	);
	return stmt.all();
}

/**
 * Validate database state before applying migrations.
 * Checks for NULL values in required columns, duplicate unique keys, and foreign key integrity.
 */
function validatePreMigration(db: Database): ValidationResult {
	const issues: string[] = [];

	const nullChecks = [
		{ column: 'email', table: 'users' },
		{ column: 'username', table: 'users' },
		{ column: 'password_hash', table: 'users' },
		{ column: 'role', table: 'users' },
		{ column: 'name', table: 'workspaces' },
		{ column: 'slug', table: 'workspaces' },
		{ column: 'owner_id', table: 'workspaces' },
	];

	for (const check of nullChecks) {
		try {
			const result = db
				.query<
					{ count: number },
					[]
				>(`SELECT COUNT(*) as count FROM \`${check.table}\` WHERE \`${check.column}\` IS NULL`)
				.get();
			if (result && result.count > 0) {
				issues.push(`${check.table}.${check.column}: ${result.count} NULL values found`);
			}
		} catch {
			// Table or column may not exist yet - skip
		}
	}

	const uniqueChecks = [
		{ column: 'email', table: 'users' },
		{ column: 'username', table: 'users' },
		{ column: 'slug', table: 'workspaces' },
	];

	for (const check of uniqueChecks) {
		try {
			const result = db
				.query<{ count: number }, []>(
					`SELECT COUNT(*) as count FROM (
						SELECT \`${check.column}\` FROM \`${check.table}\`
						WHERE \`${check.column}\` IS NOT NULL
						GROUP BY \`${check.column}\`
						HAVING COUNT(*) > 1
					)`
				)
				.get();
			if (result && result.count > 0) {
				issues.push(
					`${check.table}.${check.column}: ${result.count} duplicate values found`
				);
			}
		} catch {
			// Table or column may not exist yet - skip
		}
	}

	try {
		const fkViolations = db.query<{ count: number }, []>('PRAGMA foreign_key_check').all();
		if (fkViolations.length > 0) {
			issues.push(`Foreign key violations: ${fkViolations.length} references broken`);
		}
	} catch {
		// Ignore if pragma fails
	}

	return { issues, valid: issues.length === 0 };
}

/**
 * Mark a migration as applied.
 */
function markMigrationApplied(db: Database, tag: string): void {
	const hash = computeHash(tag);
	const createdAt = Date.now();
	db.query('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)').run(
		hash,
		createdAt
	);
}

/**
 * Split SQL into statements using drizzle breakpoints.
 * Drizzle uses --> statement-breakpoint as a delimiter.
 */
function splitStatements(sql: string): string[] {
	return sql
		.split('--> statement-breakpoint')
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
}

/**
 * Make a DDL statement idempotent by adding IF [NOT] EXISTS where applicable.
 * This prevents failures when re-running a partially-applied migration
 * (e.g. after a process crash mid-migration in Docker).
 *
 * NOTE: SQLite DDL statements (CREATE TABLE, ALTER TABLE, DROP TABLE) implicitly
 * commit any pending transaction, so a multi-DDL migration is NOT truly atomic.
 * This function mitigates the risk by making each statement safe to re-run.
 *
 * Handles:
 * - CREATE TABLE -> CREATE TABLE IF NOT EXISTS
 * - CREATE INDEX -> CREATE INDEX IF NOT EXISTS
 * - CREATE UNIQUE INDEX -> CREATE UNIQUE INDEX IF NOT EXISTS
 * - DROP TABLE -> DROP TABLE IF EXISTS
 * - DROP INDEX -> DROP INDEX IF EXISTS
 */
function makeStatementIdempotent(statement: string): string {
	// Skip if already has IF NOT EXISTS or IF EXISTS
	if (/IF\s+(?:NOT\s+)?EXISTS/i.test(statement)) {
		return statement;
	}

	// CREATE TABLE `name` -> CREATE TABLE IF NOT EXISTS `name`
	if (/^CREATE\s+TABLE\s+/i.test(statement)) {
		return statement.replace(/^CREATE\s+TABLE\s+/i, 'CREATE TABLE IF NOT EXISTS ');
	}

	// CREATE UNIQUE INDEX `name` -> CREATE UNIQUE INDEX IF NOT EXISTS `name`
	if (/^CREATE\s+UNIQUE\s+INDEX\s+/i.test(statement)) {
		return statement.replace(
			/^CREATE\s+UNIQUE\s+INDEX\s+/i,
			'CREATE UNIQUE INDEX IF NOT EXISTS '
		);
	}

	// CREATE INDEX `name` -> CREATE INDEX IF NOT EXISTS `name`
	if (/^CREATE\s+INDEX\s+/i.test(statement)) {
		return statement.replace(/^CREATE\s+INDEX\s+/i, 'CREATE INDEX IF NOT EXISTS ');
	}

	// DROP TABLE `name` -> DROP TABLE IF EXISTS `name`
	if (/^DROP\s+TABLE\s+/i.test(statement)) {
		return statement.replace(/^DROP\s+TABLE\s+/i, 'DROP TABLE IF EXISTS ');
	}

	// DROP INDEX `name` -> DROP INDEX IF EXISTS `name`
	if (/^DROP\s+INDEX\s+/i.test(statement)) {
		return statement.replace(/^DROP\s+INDEX\s+/i, 'DROP INDEX IF EXISTS ');
	}

	return statement;
}

/**
 * Check if an ALTER TABLE ADD COLUMN statement targets a column that already exists.
 * Returns true if the column already exists (statement should be skipped).
 */
function alterColumnExists(db: Database, statement: string): boolean {
	const match = statement.match(
		/^ALTER\s+TABLE\s+[`"']?(\w+)[`"']?\s+ADD\s+(?:COLUMN\s+)?[`"']?(\w+)[`"']?/i
	);
	if (!match) {
		return false;
	}

	const [, tableName, columnName] = match;
	try {
		const columns = db.query<{ name: string }, []>(`PRAGMA table_info(\`${tableName}\`)`).all();
		return columns.some((col) => col.name === columnName);
	} catch {
		return false;
	}
}

/**
 * Format duration in human-readable format.
 */
function formatDuration(ms: number): string {
	if (ms < 1000) {
		return `${ms.toFixed(0)}ms`;
	} else if (ms < 60000) {
		return `${(ms / 1000).toFixed(2)}s`;
	} else {
		const minutes = Math.floor(ms / 60000);
		const seconds = ((ms % 60000) / 1000).toFixed(0);
		return `${minutes}m ${seconds}s`;
	}
}

/**
 * Read a rollback SQL file.
 */
function readRollbackSql(rollbacksDir: string, tag: string): null | string {
	const sqlPath = path.join(rollbacksDir, `${tag}.rollback.sql`);
	if (!fs.existsSync(sqlPath)) {
		return null;
	}
	return fs.readFileSync(sqlPath, 'utf8');
}

/**
 * List available rollback files.
 */
function listAvailableRollbacks(rollbacksDir: string): string[] {
	if (!fs.existsSync(rollbacksDir)) {
		return [];
	}
	return fs
		.readdirSync(rollbacksDir)
		.filter((f) => f.endsWith('.rollback.sql'))
		.map((f) => f.replace('.rollback.sql', ''))
		.sort((a, b) => b.localeCompare(a)); // Most recent first
}

/**
 * Execute a rollback for a specific migration.
 */
function executeRollback(db: Database, rollbacksDir: string, tag: string, force: boolean): void {
	const rollbackSql = readRollbackSql(rollbacksDir, tag);
	if (!rollbackSql) {
		console.error(`No rollback file found for: ${tag}`);
		console.log('\nTo create a rollback file:');
		console.log(`  1. Create: backend/drizzle/rollbacks/${tag}.rollback.sql`);
		console.log('  2. Include SQL to reverse the migration changes');
		process.exit(1);
	}

	console.log('\n⚠️  ROLLBACK WARNING ⚠️');
	console.log('='.repeat(50));
	console.log(`Rolling back: ${tag}`);
	console.log('This operation may be DESTRUCTIVE and result in DATA LOSS.');
	console.log('Ensure you have a database backup before proceeding.');
	console.log('='.repeat(50));

	if (!force) {
		console.log('\nRun with --force to confirm rollback execution.');
		console.log('Example: bun run db:migrate --rollback --force');
		return;
	}

	const statements = splitStatements(rollbackSql);

	console.log(`\nExecuting ${statements.length} rollback statement(s)...`);

	db.exec('BEGIN');
	try {
		for (const statement of statements) {
			try {
				db.exec(statement);
			} catch (err) {
				console.error(`\nFailed statement: ${statement.substring(0, 100)}...`);
				throw err;
			}
		}

		// Remove migration record
		const hash = computeHash(tag);
		db.query('DELETE FROM __drizzle_migrations WHERE hash = ?').run(hash);

		db.exec('COMMIT');
		console.log(`\n✓ Rollback completed: ${tag}`);
	} catch (err) {
		db.exec('ROLLBACK');
		throw err;
	}
}

/**
 * Show rollback status and available rollbacks.
 */
function showRollbackStatus(paths: Paths): void {
	const journal = readJournal(paths.journalPath);
	const db = new Database(paths.database);

	try {
		const applied = getAppliedMigrations(db);
		const appliedHashes = new Set(applied.map((m) => m.hash));
		const availableRollbacks = listAvailableRollbacks(paths.rollbacksDir);

		console.log('Rollback Status:\n');
		console.log(`Database: ${paths.database}`);
		console.log(`Rollbacks: ${paths.rollbacksDir}\n`);

		if (availableRollbacks.length === 0) {
			console.log('No rollback files available.');
			return;
		}

		console.log('Applied migrations that can be rolled back:\n');

		for (const entry of [...journal.entries].reverse()) {
			const hash = computeHash(entry.tag);
			const isApplied = appliedHashes.has(hash);
			const hasRollback = availableRollbacks.includes(entry.tag);

			if (isApplied) {
				const rollbackStatus = hasRollback ? '✓' : '✗';
				console.log(
					`  ${rollbackStatus} ${entry.tag} ${hasRollback ? '(rollback available)' : '(no rollback file)'}`
				);
			}
		}

		console.log('\nUsage:');
		console.log('  bun run db:migrate --rollback <tag> --force');
	} finally {
		db.close();
	}
}

/**
 * Disable foreign keys before running migrations that contain the Drizzle
 * table-recreation pattern. Returns true if they were disabled so the caller
 * can restore them afterward.
 */
function prepareForeignKeys(db: Database, statements: string[]): boolean {
	const hasFkOff = statements.some((s) => /^PRAGMA\s+foreign_keys\s*=\s*OFF/i.test(s));
	if (hasFkOff) {
		db.exec('PRAGMA foreign_keys = OFF');
	}
	return hasFkOff;
}

/** Re-enable foreign keys after a migration that disabled them. No-op otherwise. */
function restoreForeignKeys(db: Database, wereDisabled: boolean): void {
	if (wereDisabled) {
		db.exec('PRAGMA foreign_keys = ON');
	}
}

/**
 * Execute a migration's statements inside the current transaction. Skips
 * PRAGMA foreign_keys (handled out-of-transaction) and idempotently skips
 * ALTER TABLE ADD COLUMN when the column already exists. Returns the
 * count of statements processed (including skipped ones).
 */
function executeStatements(db: Database, statements: string[]): number {
	let statementCount = 0;
	for (const statement of statements) {
		if (/^PRAGMA\s+foreign_keys/i.test(statement)) {
			statementCount++;
			continue;
		}
		if (/^ALTER\s+TABLE\s+/i.test(statement) && alterColumnExists(db, statement)) {
			console.log(`    Skipped (already exists): ${statement.substring(0, 80)}...`);
			statementCount++;
			continue;
		}
		try {
			db.exec(makeStatementIdempotent(statement));
			statementCount++;
		} catch (err) {
			console.error(`    Failed statement: ${statement.substring(0, 100)}...`);
			throw err;
		}
	}
	return statementCount;
}

/**
 * Post-migration integrity check. Runs after COMMIT because SQLite DDL
 * statements implicitly commit; a partial failure may leave the database in
 * an inconsistent state that a later ROLLBACK cannot undo, so we detect it
 * early rather than carrying forward.
 */
function assertPostMigrationIntegrity(db: Database, tag: string): void {
	const integrityResult = db.query('PRAGMA integrity_check').get() as {
		integrity_check: string;
	} | null;
	if (integrityResult?.integrity_check !== 'ok') {
		console.error(
			`    ❌ Integrity check failed after migration ${tag}: ${integrityResult?.integrity_check ?? 'unknown'}`
		);
		throw new Error(`Database integrity check failed after migration ${tag}`);
	}
}

/** Persist a successful migration to data/migration-history.json. */
function recordMigrationSuccess(args: {
	contentHash: string;
	durationMs: number;
	migrationTag: string;
	statementCount: number;
}): void {
	appendMigrationHistory({
		contentHash: args.contentHash,
		durationMs: args.durationMs,
		migrationTag: args.migrationTag,
		statementCount: args.statementCount,
		status: 'success',
		timestamp: new Date().toISOString(),
	});
}

/** Persist a failed migration to data/migration-history.json. */
function recordMigrationFailure(args: {
	durationMs: number;
	error: unknown;
	migrationTag: string;
	statementCount: number;
}): void {
	appendMigrationHistory({
		durationMs: args.durationMs,
		error: args.error instanceof Error ? args.error.message : String(args.error),
		migrationTag: args.migrationTag,
		statementCount: args.statementCount,
		status: 'failed',
		timestamp: new Date().toISOString(),
	});
}

/**
 * Apply a single migration inside a transaction.
 * If any statement fails, the entire migration is rolled back so the
 * database never ends up in a partially-applied state.
 */
function applyMigration(
	db: Database,
	migrationsDir: string,
	entry: JournalEntry
): PerformanceMetrics {
	const sql = readMigrationSql(migrationsDir, entry.tag);
	const contentHash = computeContentHash(sql);
	const statements = splitStatements(sql);

	console.log(`  Applying: ${entry.tag}`);
	console.log(`    Statements: ${statements.length}`);

	const startTime = performance.now();
	let statementCount = 0;
	const fkWereDisabled = prepareForeignKeys(db, statements);

	db.exec('BEGIN');
	try {
		statementCount = executeStatements(db, statements);
		markMigrationApplied(db, entry.tag);
		db.exec('COMMIT');
		restoreForeignKeys(db, fkWereDisabled);
		assertPostMigrationIntegrity(db, entry.tag);

		const durationMs = performance.now() - startTime;
		console.log(`    ✓ Applied in ${formatDuration(durationMs)}`);
		if (durationMs > 5000) {
			console.log(
				`    ⚠ Migration took longer than 5s - consider reviewing for optimization`
			);
		}
		recordMigrationSuccess({
			contentHash,
			durationMs,
			migrationTag: entry.tag,
			statementCount,
		});
		return { durationMs, statementCount };
	} catch (err) {
		recordMigrationFailure({
			durationMs: performance.now() - startTime,
			error: err,
			migrationTag: entry.tag,
			statementCount,
		});
		db.exec('ROLLBACK');
		restoreForeignKeys(db, fkWereDisabled);
		throw err;
	}
}

/**
 * Run pending migrations.
 */
function runMigrations(paths: Paths): void {
	const journal = readJournal(paths.journalPath);
	const db = new Database(paths.database);

	try {
		// Enable WAL mode for better concurrent access during migrations
		db.exec('PRAGMA journal_mode = WAL');
		// Flush any pending WAL data before migration to ensure consistent state
		db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
		// Enable foreign keys
		db.exec('PRAGMA foreign_keys = ON');

		// Pre-migration validation
		console.log('Validating database state...');
		const validation = validatePreMigration(db);
		if (!validation.valid) {
			console.error('\n❌ Pre-migration validation failed:');
			for (const issue of validation.issues) {
				console.error(`  - ${issue}`);
			}
			console.error('\nFix the above issues before running migrations.');
			console.error('Run with --validate to check without applying migrations.');
			process.exit(1);
		}
		console.log('✓ Validation passed\n');

		const applied = getAppliedMigrations(db);
		const appliedHashes = new Set(applied.map((m) => m.hash));

		const pending = journal.entries.filter((entry) => {
			const hash = computeHash(entry.tag);
			return !appliedHashes.has(hash);
		});

		if (pending.length === 0) {
			console.log('✓ No pending migrations');
			return;
		}

		console.log(`Found ${pending.length} pending migration(s):\n`);

		// Create pre-migration backup using VACUUM INTO for consistency.
		// This is critical because SQLite DDL statements auto-commit, making
		// transaction-based rollback unreliable for schema migrations.
		const backupPath = `${paths.database}.pre-migrate.bak`;
		try {
			db.exec(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`);
			console.log(`✓ Pre-migration backup: ${backupPath}\n`);
		} catch (err) {
			console.warn(
				`⚠ Pre-migration backup failed (proceeding anyway): ${err instanceof Error ? err.message : String(err)}`
			);
		}

		// Track overall performance
		const overallStartTime = performance.now();
		const performanceResults: PerformanceMetrics[] = [];

		for (const entry of pending) {
			const metrics = applyMigration(db, paths.migrationsDir, entry);
			performanceResults.push(metrics);
		}

		const overallDuration = performance.now() - overallStartTime;

		// Performance summary
		console.log(
			`\n✓ Applied ${pending.length} migration(s) in ${formatDuration(overallDuration)}`
		);

		// Log performance summary for multi-migration runs
		if (pending.length > 1) {
			const totalStatements = performanceResults.reduce(
				(sum, m) => sum + m.statementCount,
				0
			);
			const avgDuration =
				performanceResults.reduce((sum, m) => sum + m.durationMs, 0) /
				performanceResults.length;

			console.log('\nPerformance Summary:');
			console.log(`  Total statements: ${totalStatements}`);
			console.log(`  Average migration time: ${formatDuration(avgDuration)}`);
		}

		// Performance warning for slow migrations
		const slowMigrations = performanceResults.filter((m) => m.durationMs > 10000);
		if (slowMigrations.length > 0) {
			console.log(
				`\n⚠ ${slowMigrations.length} migration(s) took more than 10s - consider reviewing schema changes`
			);
		}
	} finally {
		db.close();
	}
}

/**
 * Mark initial migration as applied without running it.
 * Use this for existing databases that were created with db:push.
 */
function baselineMigration(paths: Paths): void {
	const journal = readJournal(paths.journalPath);
	const db = new Database(paths.database);

	try {
		const applied = getAppliedMigrations(db);
		const appliedHashes = new Set(applied.map((m) => m.hash));

		// Find migrations that haven't been applied
		const pending = journal.entries.filter((entry) => {
			const hash = computeHash(entry.tag);
			return !appliedHashes.has(hash);
		});

		if (pending.length === 0) {
			console.log('✓ All migrations already marked as applied');
			return;
		}

		console.log(`Marking ${pending.length} migration(s) as applied (baseline):\n`);

		for (const entry of pending) {
			console.log(`  Baseline: ${entry.tag}`);
			markMigrationApplied(db, entry.tag);
			console.log(`    ✓ Marked as applied`);
		}

		console.log(`\n✓ Baseline complete. ${pending.length} migration(s) marked as applied.`);
		console.log(
			'\nNote: No SQL was executed. The database schema is assumed to match the migration files.'
		);
	} finally {
		db.close();
	}
}

/**
 * Show migration status.
 */
function showStatus(paths: Paths): void {
	const journal = readJournal(paths.journalPath);
	const db = new Database(paths.database);

	try {
		const applied = getAppliedMigrations(db);
		const appliedHashes = new Set(applied.map((m) => m.hash));

		console.log('Migration Status:\n');
		console.log(`Database: ${paths.database}`);
		console.log(`Migrations: ${paths.migrationsDir}\n`);

		if (journal.entries.length === 0) {
			console.log('No migrations found.');
			return;
		}

		let pendingCount = 0;

		for (const entry of journal.entries) {
			const hash = computeHash(entry.tag);
			const isApplied = appliedHashes.has(hash);
			const status = isApplied ? '✓' : '○';
			const statusText = isApplied ? 'applied' : 'pending';

			console.log(`  ${status} ${entry.tag} (${statusText})`);

			if (!isApplied) {
				pendingCount++;
			}
		}

		console.log('');
		if (pendingCount > 0) {
			console.log(`${pendingCount} pending migration(s)`);
			console.log("\nRun 'bun run db:migrate' to apply pending migrations.");
		} else {
			console.log('All migrations applied.');
		}
	} finally {
		db.close();
	}
}

/**
 * Run pre-migration validation only without applying migrations.
 */
function validateOnly(paths: Paths): void {
	console.log('Pre-Migration Validation\n');
	console.log(`Database: ${paths.database}\n`);

	if (!fs.existsSync(paths.database)) {
		console.log('✓ Database does not exist yet - validation skipped (fresh install)');
		return;
	}

	const db = new Database(paths.database);

	try {
		db.exec('PRAGMA foreign_keys = ON');
		const validation = validatePreMigration(db);

		console.log('Validation Results:\n');

		if (validation.valid) {
			console.log('✓ All validation checks passed');
			console.log('\nDatabase is in a valid state for migrations.');
		} else {
			console.log('❌ Validation failed with the following issues:\n');
			for (const issue of validation.issues) {
				console.log(`  - ${issue}`);
			}
			console.log('\nFix the above issues before running migrations.');
			process.exit(1);
		}
	} finally {
		db.close();
	}
}

/**
 * Print help message.
 */
function printHelp(): void {
	console.log(`
Database Migration Script for Spernakit v3

Usage:
  bun run db:migrate [options]

Options:
  --status     Show migration status without applying changes
  --baseline   Mark all migrations as applied without executing SQL
               Use this for existing databases created with db:push
  --validate   Run pre-migration validation without applying migrations
  --rollback   Show rollback status (applied migrations with rollback files)
  --rollback <tag> --force  Execute a specific rollback
  --help       Show this help message

Examples:
  bun run db:migrate            Apply pending migrations
  bun run db:migrate --status   Show which migrations are applied/pending
  bun run db:migrate --baseline Mark existing migrations as applied
  bun run db:migrate --validate Check database state before migrating
  bun run db:migrate --rollback Show rollback status
  bun run db:migrate --rollback 20260210_xxx --force  Execute a rollback

Rollback Safety:
  ⚠️  Rollbacks are DESTRUCTIVE operations that can result in DATA LOSS.
  ⚠️  Always backup your database before executing a rollback.
  ⚠️  Rollbacks require --force flag to prevent accidental execution.

Migration Workflow:
  1. Modify schema files in backend/src/db/schema/
  2. Run 'bun run db:generate' to create migration SQL
  3. Review generated SQL in backend/drizzle/
  4. Run 'bun run db:migrate --validate' to check database state
  5. Run 'bun run db:migrate' to apply migrations
  6. Commit migration files to version control

Best Practices:
  - Never use db:push in production
  - Always generate migrations after schema changes
  - Test migrations in staging before production
  - Back up database before migrating
  - Review generated SQL before committing
  - Run --validate before migrations in production

Safety Guidelines:
  - Never add NOT NULL columns without defaults to non-empty tables
  - See backend/drizzle/MIGRATION_SAFETY.md for detailed safety checklist
  - See backend/drizzle/ROLLBACK.md for rollback procedures
`);
}

/**
 * Check configured database dialect from config file.
 * Returns 'sqlite' if config is unreadable or dialect is not set.
 */
function getConfiguredDialect(appSlug: string): string {
	try {
		const configPath = path.join(repoRoot, 'config', `${appSlug}.json`);
		const raw = fs.readFileSync(configPath, 'utf8');
		const parsed = JSON.parse(raw) as { database?: { dialect?: string } };
		return parsed.database?.dialect ?? 'sqlite';
	} catch {
		return 'sqlite';
	}
}

/**
 * Main entry point.
 */
function main(): void {
	const args = process.argv.slice(2);

	if (args.includes('--help') || args.includes('-h')) {
		printHelp();
		process.exit(0);
	}

	const { appSlug } = loadJsonConfig(repoRoot);

	// Check dialect — this migration script only supports SQLite
	const dialect = getConfiguredDialect(appSlug);
	if (dialect === 'postgres') {
		console.error('This migration script is for SQLite only.');
		console.error("For PostgreSQL, use 'bunx drizzle-kit migrate' or 'bunx drizzle-kit push'.");
		console.error(
			'Drizzle Kit reads the dialect from backend/drizzle.config.ts automatically.'
		);
		process.exit(1);
	}

	const paths = getPaths(appSlug);

	// Log fresh install if database does not exist yet
	if (!fs.existsSync(paths.database)) {
		console.log(`Database not found at ${paths.database} — creating fresh database.`);
	}

	// Verify migrations directory exists
	if (!fs.existsSync(paths.migrationsDir)) {
		console.error(`Migrations directory not found: ${paths.migrationsDir}`);
		console.error("Run 'bun run db:generate' to create the initial migration first.");
		process.exit(1);
	}

	try {
		if (args.includes('--status')) {
			showStatus(paths);
		} else if (args.includes('--baseline')) {
			baselineMigration(paths);
		} else if (args.includes('--validate')) {
			validateOnly(paths);
		} else if (args.includes('--rollback')) {
			const rollbackIndex = args.indexOf('--rollback');
			const nextArg = args[rollbackIndex + 1];
			const force = args.includes('--force');

			if (nextArg && !nextArg.startsWith('--')) {
				const db = new Database(paths.database);
				try {
					db.exec('PRAGMA foreign_keys = ON');
					executeRollback(db, paths.rollbacksDir, nextArg, force);
				} finally {
					db.close();
				}
			} else {
				showRollbackStatus(paths);
			}
		} else {
			runMigrations(paths);
		}
	} catch (err) {
		console.error('\n❌ Migration failed:', err instanceof Error ? err.message : String(err));
		process.exit(1);
	}
}

main();
