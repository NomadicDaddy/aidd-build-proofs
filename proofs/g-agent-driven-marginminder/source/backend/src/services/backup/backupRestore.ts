/**
 * Database restore operations.
 *
 * Handles decryption, decompression, integrity verification,
 * emergency backup creation, and database file replacement.
 *
 * @module backupRestore
 */

import { copyFileSync, existsSync, unlinkSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';

import { getConfig } from '../../config/configLoader.ts';
import { backupDatabaseTo, closeDatabase, getDb, initializeDatabase } from '../../db/index.ts';
import { users } from '../../db/schema/users.ts';
import { logger } from '../../utils/logger.ts';
import { invalidateHealthCache } from '../health/healthChecks.ts';
import { decompressBackupFile, decryptBackupFile } from './backupEncryptionService.ts';
import { verifyDatabaseIntegrity } from './backupIntegrityService.ts';
import { getBackupDirectory } from './backupLifecycleService.ts';

interface RestoreResult {
	durationMs: number;
	emergencyBackupPath: null | string;
	error: null | string;
	sourcePath: string;
	success: boolean;
	warnings?: string[];
}

function validateBackupPath(backupPath: string): { error?: string; valid: boolean } {
	const backupDir = getBackupDirectory();
	const resolvedPath = resolve(backupPath);

	// Use path.relative() for cross-platform path containment check.
	// If the resolved path escapes the backup directory, relative() will start with '..'
	const rel = relative(backupDir, resolvedPath);
	if (rel.startsWith('..') || resolvedPath === backupDir) {
		return { error: 'Invalid backup path: must be within the backup directory', valid: false };
	}

	if (!existsSync(resolvedPath)) {
		logger.error({ resolvedPath }, 'Backup file not found');
		return { error: 'Backup file not found', valid: false };
	}

	return { valid: true };
}

function createEmergencyBackup(dbPath: string): null | string {
	if (!existsSync(dbPath)) {
		return null;
	}

	const backupDir = getBackupDirectory();
	const emergencyFilename = `emergency-${Date.now()}.backup.db`;
	const emergencyBackupPath = join(backupDir, emergencyFilename);
	try {
		backupDatabaseTo(emergencyBackupPath);
	} catch (err) {
		logger.warn(
			{ emergencyBackupPath, err },
			'backupDatabaseTo failed during emergency-backup creation — falling back to copyFileSync'
		);
		// Fall back to file copy if VACUUM INTO fails (e.g., PostgreSQL dialect)
		copyFileSync(dbPath, emergencyBackupPath);
	}
	logger.info({ path: emergencyBackupPath }, 'Created emergency backup before restore');
	return emergencyBackupPath;
}

function rollbackFromEmergency(dbPath: string, emergencyBackupPath: null | string): void {
	if (emergencyBackupPath && existsSync(emergencyBackupPath)) {
		copyFileSync(emergencyBackupPath, dbPath);
		logger.info({ path: emergencyBackupPath }, 'Rolled back from emergency backup');
	}
}

/**
 * Prepare a backup file for restore by decrypting and/or decompressing as needed.
 * Returns the path to a raw SQLite file ready for integrity check and restore.
 *
 * @param backupPath - Path to the backup file
 * @returns Raw SQLite path, temp files to clean up, and optional error
 */
async function prepareForRestore(
	backupPath: string
): Promise<{ error?: string; rawPath: string; tempFiles: string[] }> {
	const tempFiles: string[] = [];
	let currentPath = resolve(backupPath);
	const backupDir = getBackupDirectory();

	try {
		if (currentPath.endsWith('.enc')) {
			const decryptedPath = join(backupDir, `_restore_${Date.now()}.decrypted`);
			await decryptBackupFile(currentPath, decryptedPath);
			tempFiles.push(decryptedPath);
			currentPath = decryptedPath;
		}

		if (backupPath.endsWith('.gz.enc') || backupPath.endsWith('.gz')) {
			const decompressedPath = join(backupDir, `_restore_${Date.now()}.raw.db`);
			await decompressBackupFile(currentPath, decompressedPath);
			tempFiles.push(decompressedPath);
			currentPath = decompressedPath;
		}

		return { rawPath: currentPath, tempFiles };
	} catch (err) {
		for (const tmp of tempFiles) {
			if (existsSync(tmp)) {
				unlinkSync(tmp);
			}
		}
		const errorMessage =
			err instanceof Error ? err.message : 'Unknown error preparing backup for restore';
		return { error: errorMessage, rawPath: '', tempFiles: [] };
	}
}

function cleanupTempFiles(tempFiles: string[]): void {
	for (const tmp of tempFiles) {
		if (existsSync(tmp)) {
			unlinkSync(tmp);
		}
	}
}

function buildRestoreFailure(
	startTime: number,
	backupPath: string,
	error: string,
	emergencyBackupPath: null | string = null
): RestoreResult {
	return {
		durationMs: Math.round(performance.now() - startTime),
		emergencyBackupPath: emergencyBackupPath ? basename(emergencyBackupPath) : null,
		error,
		sourcePath: basename(backupPath),
		success: false,
	};
}

/**
 * Invalidates restored-database sessions after a successful file swap.
 *
 * @returns Warning messages that must be included in the restore response.
 */
function invalidateAllUserSessions(): string[] {
	const warnings: string[] = [];
	try {
		const db = getDb();
		db.update(users)
			.set({
				csrfToken: null,
				refreshTokenHash: null,
				updatedAt: new Date(),
			})
			.run();
		logger.info('Invalidated all user sessions after database restore');
	} catch (err) {
		logger.error({ err }, 'Failed to invalidate sessions after restore');
		warnings.push(
			'Session invalidation failed — active sessions may use stale data. ' +
				'Restart the server to force all users to re-authenticate.'
		);
	}
	return warnings;
}

/**
 * Restores the pre-restore database file and reopens the configured connection.
 *
 * @param dbPath - Active database file path to replace from the emergency backup.
 * @param emergencyBackupPath - Emergency backup path created before the restore attempt.
 */
function attemptRollbackToEmergency(dbPath: string, emergencyBackupPath: string): void {
	try {
		rollbackFromEmergency(dbPath, emergencyBackupPath);
		const config = getConfig();
		initializeDatabase(
			config.database.url,
			config.database.dialect as 'postgres' | 'sqlite',
			config.database.ssl
		);
		logger.info('Rolled back to pre-restore state after failure');
	} catch (err) {
		logger.error(
			{ error: err },
			'Failed to roll back after restore failure — manual recovery may be needed'
		);
	}
}

async function performRestore(
	backupPath: string,
	startTime: number,
	dbPath: string
): Promise<RestoreResult> {
	const pathValidation = validateBackupPath(backupPath);
	if (!pathValidation.valid) {
		logger.error({ error: pathValidation.error }, 'Database restore path validation failed');
		return buildRestoreFailure(startTime, backupPath, pathValidation.error ?? 'Invalid path');
	}

	const preparation = await prepareForRestore(backupPath);
	if (preparation.error) {
		logger.error({ error: preparation.error }, 'Database restore preparation failed');
		return buildRestoreFailure(startTime, backupPath, preparation.error);
	}

	const integrity = verifyDatabaseIntegrity(preparation.rawPath, 'full');
	if (!integrity.healthy) {
		logger.error({ integrityMessage: integrity.message }, 'Backup integrity check failed');
		cleanupTempFiles(preparation.tempFiles);
		return buildRestoreFailure(startTime, backupPath, 'Backup integrity check failed');
	}

	let emergencyBackupPath: null | string = null;

	try {
		emergencyBackupPath = createEmergencyBackup(dbPath);

		// Close database before overwriting the file to avoid corruption
		await closeDatabase();
		copyFileSync(preparation.rawPath, dbPath);

		// Reopen database connection with the restored file
		const config = getConfig();
		initializeDatabase(
			config.database.url,
			config.database.dialect as 'postgres' | 'sqlite',
			config.database.ssl
		);

		const restoredIntegrity = verifyDatabaseIntegrity(dbPath, 'full');
		if (!restoredIntegrity.healthy) {
			logger.error(
				{ integrityMessage: restoredIntegrity.message, rolledBack: !!emergencyBackupPath },
				'Restored database integrity check failed'
			);
			rollbackFromEmergency(dbPath, emergencyBackupPath);
			cleanupTempFiles(preparation.tempFiles);
			throw new Error(
				emergencyBackupPath
					? 'Restored database integrity check failed, rolled back'
					: 'Restored database integrity check failed'
			);
		}

		invalidateHealthCache();
		const warnings = invalidateAllUserSessions();

		const durationMs = Math.round(performance.now() - startTime);
		logger.info({ durationMs, sourcePath: backupPath }, 'Database restored successfully');
		cleanupTempFiles(preparation.tempFiles);

		return {
			durationMs,
			emergencyBackupPath: emergencyBackupPath ? basename(emergencyBackupPath) : null,
			error: null,
			sourcePath: basename(backupPath),
			success: true,
			warnings,
		};
	} catch (err) {
		const errorMessage = err instanceof Error ? err.message : 'Unknown error during restore';
		logger.error({ error: errorMessage }, 'Database restore failed');

		// Attempt rollback from emergency backup if available
		if (emergencyBackupPath) {
			attemptRollbackToEmergency(dbPath, emergencyBackupPath);
		}

		cleanupTempFiles(preparation.tempFiles);
		return buildRestoreFailure(startTime, backupPath, errorMessage, emergencyBackupPath);
	}
}

/**
 * Restore the database from a backup file.
 *
 * @param backupPath - Path to the backup file to restore from
 * @param getDatabasePath - Function that returns the current database file path
 * @param isBackupRunningRef - Object with `value` property for mutex coordination
 * @param isBackupRunningRef.value - Boolean mutex flag indicating if a backup is in progress
 * @returns Restore operation result
 */
async function restoreFromBackup(
	backupPath: string,
	getDatabasePath: () => string,
	isBackupRunningRef: { value: boolean }
): Promise<RestoreResult> {
	const startTime = performance.now();

	if (isBackupRunningRef.value) {
		return buildRestoreFailure(
			startTime,
			backupPath,
			'A backup operation is already in progress'
		);
	}

	isBackupRunningRef.value = true;
	try {
		return await performRestore(backupPath, startTime, getDatabasePath());
	} finally {
		isBackupRunningRef.value = false;
	}
}

export { restoreFromBackup };
export type { RestoreResult };
