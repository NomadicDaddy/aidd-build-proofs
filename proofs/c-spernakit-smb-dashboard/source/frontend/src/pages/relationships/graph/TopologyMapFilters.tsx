import { X } from 'lucide-react';
import {
	ASSET_RELATIONSHIP_TYPES,
	ASSET_STATUSES,
	ASSET_TYPES,
	CRITICALITY_LEVELS,
	RELATIONSHIP_CONFIDENCE_LEVELS,
} from 'spernakit-shared';

import type { Owner } from '@/api/owners';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { assetStatusLabel, assetTypeLabel, criticalityLabel } from '@/pages/assets/assetDisplay';

import { confidenceLabel, relationshipTypeLabel } from '../relationshipDisplay';

interface TopologyMapFiltersProps {
	focusName: null | string;
	getFilter: (key: string, defaultValue?: string) => string;
	onClearFocus: () => void;
	owners: Owner[];
	setFilter: (key: string, value: string) => void;
}

/** A URL-synced dropdown that maps its first "all" option to the empty filter value. */
function FilterSelect({
	allLabel,
	ariaLabel,
	onChange,
	options,
	value,
	width = 'w-[170px]',
}: {
	allLabel: string;
	ariaLabel: string;
	onChange: (value: string) => void;
	options: { label: string; value: string }[];
	value: string;
	width?: string;
}) {
	return (
		<Select
			onValueChange={(next) => onChange(next === 'all' ? '' : next)}
			value={value || 'all'}>
			<SelectTrigger aria-label={ariaLabel} className={width}>
				<SelectValue placeholder={allLabel} />
			</SelectTrigger>
			<SelectContent>
				<SelectItem value="all">{allLabel}</SelectItem>
				{options.map((option) => (
					<SelectItem key={option.value} value={option.value}>
						{option.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

/**
 * Filter and scope controls for the topology map. The free-text search plus
 * relationship-type, confidence, endpoint status, criticality, and owner filters
 * are applied server-side; the asset-type filter narrows the rendered graph
 * client-side. When the map is scoped to a single asset, a depth selector
 * controls how many hops of its dependency tree are expanded, and a removable
 * chip identifies the focus asset. Every control writes to a URL param so a
 * given map view is shareable.
 */
function TopologyMapFilters({
	focusName,
	getFilter,
	onClearFocus,
	owners,
	setFilter,
}: TopologyMapFiltersProps) {
	const isFocused = getFilter('scope') === 'focus' && Boolean(getFilter('focus'));

	return (
		<div className="space-y-3">
			<div className="flex flex-wrap items-center gap-2">
				<Input
					aria-label="Search relationships by endpoint"
					className="max-w-xs"
					onChange={(event) => setFilter('search', event.target.value)}
					placeholder="Search endpoint name, hostname, IP…"
					value={getFilter('search')}
				/>
				<FilterSelect
					allLabel="All relationship types"
					ariaLabel="Filter by relationship type"
					onChange={(value) => setFilter('type', value)}
					options={ASSET_RELATIONSHIP_TYPES.map((type) => ({
						label: relationshipTypeLabel(type),
						value: type,
					}))}
					value={getFilter('type')}
					width="w-[200px]"
				/>
				<FilterSelect
					allLabel="All asset types"
					ariaLabel="Filter by asset type"
					onChange={(value) => setFilter('assetType', value)}
					options={ASSET_TYPES.map((type) => ({
						label: assetTypeLabel(type),
						value: type,
					}))}
					value={getFilter('assetType')}
					width="w-[200px]"
				/>
				<FilterSelect
					allLabel="All criticality"
					ariaLabel="Filter by endpoint criticality"
					onChange={(value) => setFilter('criticality', value)}
					options={CRITICALITY_LEVELS.map((level) => ({
						label: criticalityLabel(level),
						value: level,
					}))}
					value={getFilter('criticality')}
				/>
				<FilterSelect
					allLabel="All statuses"
					ariaLabel="Filter by endpoint status"
					onChange={(value) => setFilter('status', value)}
					options={ASSET_STATUSES.map((status) => ({
						label: assetStatusLabel(status),
						value: status,
					}))}
					value={getFilter('status')}
				/>
				<FilterSelect
					allLabel="All confidence"
					ariaLabel="Filter by confidence"
					onChange={(value) => setFilter('confidence', value)}
					options={RELATIONSHIP_CONFIDENCE_LEVELS.map((level) => ({
						label: confidenceLabel(level),
						value: level,
					}))}
					value={getFilter('confidence')}
				/>
				<FilterSelect
					allLabel="All owners"
					ariaLabel="Filter by owner"
					onChange={(value) => setFilter('owner', value)}
					options={owners.map((owner) => ({
						label: owner.name,
						value: String(owner.id),
					}))}
					value={getFilter('owner')}
				/>
			</div>

			{isFocused && (
				<div className="flex flex-wrap items-center gap-2">
					<Badge className="gap-1.5" variant="secondary">
						Focused on {focusName ?? `Asset #${getFilter('focus')}`}
						<button
							aria-label="Clear focus scope"
							className="hover:text-foreground"
							onClick={onClearFocus}
							type="button">
							<X className="size-3" />
						</button>
					</Badge>
					<span className="text-muted-foreground text-sm">Expand</span>
					<FilterSelect
						allLabel="All hops"
						ariaLabel="Dependency expansion depth"
						onChange={(value) => setFilter('depth', value)}
						options={[
							{ label: '1 hop', value: '1' },
							{ label: '2 hops', value: '2' },
							{ label: '3 hops', value: '3' },
						]}
						value={getFilter('depth')}
						width="w-[130px]"
					/>
				</div>
			)}
		</div>
	);
}

export { TopologyMapFilters };
