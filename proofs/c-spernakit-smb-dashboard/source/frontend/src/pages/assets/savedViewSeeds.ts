/**
 * Built-in "common question" inventory views.
 *
 * These are read-only starter presets that answer the recurring infrastructure
 * questions from the product spec. Each maps to the asset inventory page's
 * URL-synced filter parameters, so selecting one simply applies its `filters`
 * to the current URL. They are always available and are never persisted.
 *
 * Relational questions that cannot be expressed as a single inventory filter —
 * "which VMs run on this specific host" and "what breaks if this asset is
 * offline" — are answered by the dependency topology map (`/relationships/map`)
 * and the per-asset impact analysis (asset detail → Relationships tab), so they
 * are intentionally not duplicated here as filter presets.
 */
interface SavedViewSeed {
	description: string;
	filters: Record<string, string>;
	id: string;
	name: string;
}

const SAVED_VIEW_SEEDS: readonly SavedViewSeed[] = [
	{
		description: 'What physical servers do we have?',
		filters: { type: 'physical_server' },
		id: 'seed-physical-servers',
		name: 'Physical servers',
	},
	{
		description: 'Which assets are virtual machines?',
		filters: { type: 'virtual_machine' },
		id: 'seed-virtual-machines',
		name: 'Virtual machines',
	},
	{
		description: 'Which hosts run our virtual machines?',
		filters: { type: 'hypervisor_host' },
		id: 'seed-hypervisor-hosts',
		name: 'Hypervisor hosts',
	},
	{
		description: 'Which business services do we run?',
		filters: { type: 'business_service' },
		id: 'seed-business-services',
		name: 'Business services',
	},
	{
		description: 'What ports are open to the internet?',
		filters: { exposureLevel: 'internet' },
		id: 'seed-internet-ports',
		name: 'Internet-exposed ports',
	},
	{
		description: 'Which exposed ports still need review?',
		filters: { reviewState: 'needs_review' },
		id: 'seed-ports-needs-review',
		name: 'Ports needing review',
	},
	{
		description: 'Which assets have an unverified (stale) lifecycle state?',
		filters: { status: 'unknown' },
		id: 'seed-unknown-status',
		name: 'Unverified lifecycle',
	},
] as const;

export { SAVED_VIEW_SEEDS };
export type { SavedViewSeed };
