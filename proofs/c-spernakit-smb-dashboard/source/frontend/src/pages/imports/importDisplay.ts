import type { ImportRowStatus, ImportStatus } from 'spernakit-shared';

type BadgeVariant = 'default' | 'destructive' | 'outline' | 'secondary';

/** Human-readable labels for import batch lifecycle statuses. */
const IMPORT_STATUS_LABELS: Record<ImportStatus, string> = {
	applied: 'Applied',
	partial: 'Partially applied',
	pending: 'Pending',
	rejected: 'Rejected',
	reviewing: 'In review',
};

/** Badge styling for import batch statuses. */
const IMPORT_STATUS_VARIANTS: Record<ImportStatus, BadgeVariant> = {
	applied: 'default',
	partial: 'outline',
	pending: 'secondary',
	rejected: 'destructive',
	reviewing: 'secondary',
};

/** Human-readable labels for per-row dispositions. */
const ROW_STATUS_LABELS: Record<ImportRowStatus, string> = {
	accepted: 'Accepted',
	duplicate: 'Duplicate',
	needs_review: 'Needs review',
	pending: 'New',
	rejected: 'Rejected',
};

/** Badge styling for per-row dispositions. */
const ROW_STATUS_VARIANTS: Record<ImportRowStatus, BadgeVariant> = {
	accepted: 'default',
	duplicate: 'outline',
	needs_review: 'outline',
	pending: 'secondary',
	rejected: 'destructive',
};

export { IMPORT_STATUS_LABELS, IMPORT_STATUS_VARIANTS, ROW_STATUS_LABELS, ROW_STATUS_VARIANTS };
export type { BadgeVariant };
