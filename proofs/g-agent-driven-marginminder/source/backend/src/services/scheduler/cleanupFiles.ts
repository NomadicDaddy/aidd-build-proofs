import { and, eq, lt, sql } from 'drizzle-orm';

import { getConfig } from '../../config/configLoader.ts';
import { MAX_CLEANUP_BATCH_SIZE } from '../../constants/scheduler.ts';
import { getDb } from '../../db/index.ts';
import { fileUploads } from '../../db/schema/fileUploads.ts';
import { getStorageAdapter } from '../../storage/index.ts';
import { logScheduler } from '../../utils/logger.ts';
import { log as logAudit } from '../auditService.ts';
import { cutoffDate, MAX_CLEANUP_BATCHES } from './cleanupUtils.ts';

async function softDeletedFilesCleanupTask(): Promise<{ batches: number; cleaned: number }> {
	const config = getConfig();
	const db = getDb();
	const storage = getStorageAdapter();
	const cutoff = cutoffDate(new Date(), config.retention.softDeletedFilesDays);

	let totalCleaned = 0;
	let batches = 0;

	while (batches < MAX_CLEANUP_BATCHES) {
		const files = db
			.select({
				id: fileUploads.id,
				storagePath: fileUploads.storagePath,
				thumbnailKey: fileUploads.thumbnailKey,
			})
			.from(fileUploads)
			.where(and(eq(fileUploads.isDeleted, true), lt(fileUploads.deletedAt, cutoff)))
			.limit(MAX_CLEANUP_BATCH_SIZE)
			.all();

		if (files.length === 0) break;

		// Delete files from storage (handle missing files gracefully)
		for (const file of files) {
			await safeStorageDelete(storage, file.storagePath);
			if (file.thumbnailKey) {
				await safeStorageDelete(storage, file.thumbnailKey);
			}
		}

		// Hard-delete records from database
		const idsToDelete = files.map((f) => f.id);
		db.delete(fileUploads)
			.where(sql`${fileUploads.id} IN ${idsToDelete}`)
			.run();

		totalCleaned += files.length;
		batches++;

		logScheduler('info', 'Soft-deleted files cleanup batch completed', {
			batchCleaned: files.length,
			batchNumber: batches,
			totalCleaned,
		});
	}

	logScheduler('info', 'Soft-deleted files cleanup task completed', {
		batches,
		cleaned: totalCleaned,
	});

	// Audit log for permanent file deletion (system-initiated, no userId)
	if (totalCleaned > 0) {
		logAudit({
			action: 'SYSTEM_CLEANUP file_uploads hard_delete',
			details: { batches, cleaned: totalCleaned },
			entityType: 'file_uploads',
		});
	}

	return { batches, cleaned: totalCleaned };
}

async function safeStorageDelete(
	storage: ReturnType<typeof getStorageAdapter>,
	key: string
): Promise<void> {
	try {
		await storage.delete(key);
	} catch {
		logScheduler('warn', 'Failed to delete file from storage', { key });
	}
}

export { softDeletedFilesCleanupTask };
