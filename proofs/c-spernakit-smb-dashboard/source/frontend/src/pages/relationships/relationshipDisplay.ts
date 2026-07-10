import type { VariantProps } from 'class-variance-authority';
import type { AssetRelationshipType, RelationshipConfidenceLevel } from 'spernakit-shared';

import { type badgeVariants } from '@/components/ui/badge';

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>;

/** Human-readable label for each directed relationship type. */
const RELATIONSHIP_TYPE_LABELS: Record<AssetRelationshipType, string> = {
	backs_up_to: 'Backs Up To',
	connects_to: 'Connects To',
	depends_on: 'Depends On',
	hosts: 'Hosts',
	owned_by: 'Owned By',
	part_of: 'Part Of',
	provides_service: 'Provides Service',
	runs_on: 'Runs On',
	stores_on: 'Stores On',
};

/** Human-readable label for each confidence level. */
const CONFIDENCE_LABELS: Record<RelationshipConfidenceLevel, string> = {
	assumed: 'Assumed',
	confirmed: 'Confirmed',
	likely: 'Likely',
	unverified: 'Unverified',
};

/** Badge styling for each confidence level. */
const CONFIDENCE_VARIANTS: Record<RelationshipConfidenceLevel, BadgeVariant> = {
	assumed: 'outline',
	confirmed: 'default',
	likely: 'secondary',
	unverified: 'outline',
};

function relationshipTypeLabel(type: AssetRelationshipType): string {
	return RELATIONSHIP_TYPE_LABELS[type] ?? type;
}

function confidenceLabel(level: RelationshipConfidenceLevel): string {
	return CONFIDENCE_LABELS[level] ?? level;
}

function confidenceVariant(level: RelationshipConfidenceLevel): BadgeVariant {
	return CONFIDENCE_VARIANTS[level] ?? 'outline';
}

export { confidenceLabel, confidenceVariant, relationshipTypeLabel };
