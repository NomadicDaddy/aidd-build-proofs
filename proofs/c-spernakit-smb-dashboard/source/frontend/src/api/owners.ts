import type { OwnerKind } from 'spernakit-shared';

import type { DataResponse } from './types';

import { apiClient } from './client';

/**
 * An accountable owner (person, team, or vendor) for assets and services, as
 * returned by `GET /owners`. Kept distinct from platform users so ownership can
 * reference staff without app accounts.
 */
interface Owner {
	email: null | string;
	id: number;
	kind: OwnerKind;
	name: string;
	phone: null | string;
}

/** Fetch every active owner, ordered by name. Requires VIEWER role or higher. */
function listOwners(): Promise<DataResponse<Owner[]>> {
	return apiClient.get<DataResponse<Owner[]>>('/owners');
}

export { listOwners };
export type { Owner };
