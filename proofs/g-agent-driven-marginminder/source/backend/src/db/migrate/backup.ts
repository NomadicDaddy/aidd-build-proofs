import { copyFileSync, existsSync, unlinkSync } from 'node:fs';

const PRE_MIGRATE_BACKUP_SUFFIX = '.pre-migrate.bak';

function createPreMigrationBackup(dbPath: string): string {
	const backupPath = dbPath + PRE_MIGRATE_BACKUP_SUFFIX;
	copyFileSync(dbPath, backupPath);
	return backupPath;
}

function restoreFromBackup(dbPath: string, backupPath: string): void {
	copyFileSync(backupPath, dbPath);
}

function removePreMigrationBackup(backupPath: string): void {
	try {
		if (existsSync(backupPath)) {
			unlinkSync(backupPath);
		}
	} catch {
		// Non-critical — don't fail startup over backup cleanup
	}
}

export {
	createPreMigrationBackup,
	PRE_MIGRATE_BACKUP_SUFFIX,
	removePreMigrationBackup,
	restoreFromBackup,
};
