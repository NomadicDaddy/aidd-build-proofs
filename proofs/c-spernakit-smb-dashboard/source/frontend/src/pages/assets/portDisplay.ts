import type { VariantProps } from 'class-variance-authority';
import type { PortExposureLevel, PortReviewState, PortSource } from 'spernakit-shared';

import { type badgeVariants } from '@/components/ui/badge';

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>;

/** Human-readable label for each port exposure level. */
const EXPOSURE_LABELS: Record<PortExposureLevel, string> = {
	dmz: 'DMZ',
	internal: 'Internal',
	internet: 'Internet-facing',
	unknown: 'Unknown',
};

/** Badge styling for each exposure level (internet exposure reads as a risk). */
const EXPOSURE_VARIANTS: Record<PortExposureLevel, BadgeVariant> = {
	dmz: 'secondary',
	internal: 'outline',
	internet: 'destructive',
	unknown: 'outline',
};

/** Human-readable label for each port review state. */
const REVIEW_LABELS: Record<PortReviewState, string> = {
	expected: 'Expected',
	historical: 'Historical',
	ignored: 'Ignored',
	needs_review: 'Needs review',
	unexpected: 'Unexpected',
};

/** Badge styling for each review state (unexpected / needs-review flag attention). */
const REVIEW_VARIANTS: Record<PortReviewState, BadgeVariant> = {
	expected: 'default',
	historical: 'outline',
	ignored: 'outline',
	needs_review: 'secondary',
	unexpected: 'destructive',
};

/** Human-readable label for each port source. */
const SOURCE_LABELS: Record<PortSource, string> = {
	documented: 'Documented',
	imported: 'Imported scan',
	observed: 'Observed',
};

function portExposureLabel(level: PortExposureLevel): string {
	return EXPOSURE_LABELS[level] ?? level;
}

function portExposureVariant(level: PortExposureLevel): BadgeVariant {
	return EXPOSURE_VARIANTS[level] ?? 'outline';
}

function portReviewLabel(state: PortReviewState): string {
	return REVIEW_LABELS[state] ?? state;
}

function portReviewVariant(state: PortReviewState): BadgeVariant {
	return REVIEW_VARIANTS[state] ?? 'outline';
}

function portSourceLabel(source: PortSource): string {
	return SOURCE_LABELS[source] ?? source;
}

export {
	portExposureLabel,
	portExposureVariant,
	portReviewLabel,
	portReviewVariant,
	portSourceLabel,
};
