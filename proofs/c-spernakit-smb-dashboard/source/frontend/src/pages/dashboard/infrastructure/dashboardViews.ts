import type { AssetStatus, AssetType, CriticalityLevel } from 'spernakit-shared';

import { assetStatusLabel, assetTypeLabel, criticalityLabel } from '@/pages/assets/assetDisplay';

/** The renderable sections of the operational dashboard, keyed for view presets. */
type SectionKey = 'breakdown' | 'capacity' | 'health' | 'overview' | 'risk' | 'services';

/** A saved dashboard view: an audience-oriented preset of ordered sections. */
interface DashboardView {
	description: string;
	id: string;
	label: string;
	sections: SectionKey[];
}

/**
 * Saved dashboard filters for the three primary audiences. Each preset reorders
 * and scopes the sections to what that audience cares about; the active view is
 * persisted in the URL (`?view=`) so it can be shared and bookmarked.
 */
const MANAGEMENT_VIEW: DashboardView = {
	description: 'Business risk, critical services, and inventory shape at a glance.',
	id: 'management',
	label: 'Management',
	sections: ['overview', 'risk', 'health', 'services', 'breakdown'],
};

const DASHBOARD_VIEWS: DashboardView[] = [
	MANAGEMENT_VIEW,
	{
		description: 'Capacity, virtualization, and the operational makeup of the estate.',
		id: 'operations',
		label: 'Operations',
		sections: ['overview', 'capacity', 'health', 'breakdown', 'services'],
	},
	{
		description: 'Exposure, ownership gaps, and support-lifecycle risk for review.',
		id: 'audit',
		label: 'Audit',
		sections: ['overview', 'risk', 'health', 'breakdown'],
	},
];

const DEFAULT_VIEW_ID = 'management';

/** Resolve a URL `view` param to a known view, falling back to the default. */
function resolveView(viewId: null | string): DashboardView {
	return DASHBOARD_VIEWS.find((v) => v.id === viewId) ?? MANAGEMENT_VIEW;
}

/** Prettify an asset-type enum key, leaving unknown keys untouched. */
function typeLabel(key: string): string {
	return assetTypeLabel(key as AssetType);
}

/** Prettify a lifecycle-status enum key, leaving unknown keys untouched. */
function statusLabel(key: string): string {
	return assetStatusLabel(key as AssetStatus);
}

/** Prettify a criticality enum key, leaving unknown keys untouched. */
function critLabel(key: string): string {
	return criticalityLabel(key as CriticalityLevel);
}

export { critLabel, DASHBOARD_VIEWS, DEFAULT_VIEW_ID, resolveView, statusLabel, typeLabel };
export type { DashboardView, SectionKey };
