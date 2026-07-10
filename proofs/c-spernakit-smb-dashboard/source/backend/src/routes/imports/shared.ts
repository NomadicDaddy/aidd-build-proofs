import { t } from 'elysia';
import { IMPORT_STATUSES } from 'spernakit-shared';

const IMPORT_STATUS_SCHEMA = t.Union(IMPORT_STATUSES.map((v) => t.Literal(v)));

/** Upper bound on a pasted/uploaded CSV document (characters). */
const MAX_CSV_LENGTH = 1_000_000;

const idParams = t.Object({ id: t.Integer({ minimum: 1 }) });
const rowParams = t.Object({
	id: t.Integer({ minimum: 1 }),
	rowId: t.Integer({ minimum: 1 }),
});

export { idParams, IMPORT_STATUS_SCHEMA, MAX_CSV_LENGTH, rowParams };
