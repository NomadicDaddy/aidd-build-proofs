import { and, eq } from 'drizzle-orm';

import type { CreateServiceInput, UpdateServiceInput } from '../serviceCatalogQueries.ts';

import { getDb } from '../../db/index.ts';
import { assets } from '../../db/schema/assets.ts';

/**
 * Build the concrete insert/update payload from the writable-field subset,
 * skipping keys the caller left undefined (so a partial update never clears an
 * unrelated column).
 *
 * @param input - The writable service fields to include
 * @returns A record of column values suitable for insert/update
 */
function buildWriteValues(input: UpdateServiceInput): Record<string, unknown> {
	const values: Record<string, unknown> = {};
	const assign = <T>(key: keyof CreateServiceInput, value: T | undefined): void => {
		if (value !== undefined) values[key] = value;
	};
	assign('name', input.name?.trim());
	assign('category', input.category);
	assign('criticality', input.criticality);
	assign('expectedAvailability', input.expectedAvailability);
	assign('description', input.description);
	assign('notes', input.notes);
	assign('ownerId', input.ownerId);
	assign('vendorId', input.vendorId);
	return values;
}

/**
 * Whether an active (non-deleted) asset exists for the given id.
 *
 * @param id - Asset id
 * @returns True when an active asset row matches
 */
function activeAssetExists(id: number): boolean {
	const db = getDb();
	const row = db
		.select({ id: assets.id })
		.from(assets)
		.where(and(eq(assets.id, id), eq(assets.isDeleted, false)))
		.get();
	return row !== undefined;
}

export { activeAssetExists, buildWriteValues };
