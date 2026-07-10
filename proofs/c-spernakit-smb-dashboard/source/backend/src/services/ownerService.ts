import { and, asc, eq } from 'drizzle-orm';

import { getDb } from '../db/index.ts';
import { owners } from '../db/schema/infrastructure.ts';

type OwnerRow = typeof owners.$inferSelect;

/**
 * List active (non-deleted) owners, ordered by name. Used to populate owner
 * selectors on the service catalog and asset forms; ownership records are kept
 * distinct from platform users so staff without app accounts can be referenced.
 *
 * @returns All active owner rows, alphabetically by name
 */
function listOwners(): OwnerRow[] {
	const db = getDb();
	return db
		.select()
		.from(owners)
		.where(eq(owners.isDeleted, false))
		.orderBy(asc(owners.name))
		.all();
}

/**
 * Whether an active (non-deleted) owner exists for the given id.
 *
 * @param id - Owner id
 * @returns True when an active owner row matches
 */
function ownerExists(id: number): boolean {
	const db = getDb();
	const row = db
		.select({ id: owners.id })
		.from(owners)
		.where(and(eq(owners.id, id), eq(owners.isDeleted, false)))
		.get();
	return row !== undefined;
}

export type { OwnerRow };
export { listOwners, ownerExists };
