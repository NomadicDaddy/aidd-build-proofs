import { criticalityLabel, criticalityVariant } from '@/pages/assets/assetDisplay';

/**
 * Suggested service categories. Category is a free-text column on the service
 * catalog, but offering a curated starter list keeps the seeded services and
 * new entries consistent. Users may still type any value in the form.
 */
const SERVICE_CATEGORY_SUGGESTIONS = [
	'directory',
	'networking',
	'connectivity',
	'storage',
	'data',
	'data-protection',
	'security',
	'monitoring',
	'communication',
	'application',
	'other',
] as const;

/** Turn a category slug like `data-protection` into a readable `Data Protection`. */
function categoryLabel(category: null | string): string {
	if (!category) return '—';
	return category
		.split(/[-_\s]+/)
		.filter(Boolean)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');
}

export { categoryLabel, criticalityLabel, criticalityVariant, SERVICE_CATEGORY_SUGGESTIONS };
