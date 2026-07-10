import { ASSET_STATUSES, ASSET_TYPES, CRITICALITY_LEVELS } from 'spernakit-shared';

import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';

import { assetStatusLabel, assetTypeLabel, criticalityLabel } from './assetDisplay';

interface AssetTableFiltersProps {
	criticality: string;
	onCriticalityChange: (value: string) => void;
	onSearchChange: (value: string) => void;
	onStatusChange: (value: string) => void;
	onTypeChange: (value: string) => void;
	search: string;
	status: string;
	type: string;
}

/**
 * Filter bar for the asset inventory table: a free-text search (name / hostname
 * / FQDN / IP) plus type, status, and criticality dropdowns. Each control maps
 * to a URL-synced filter param via the parent page.
 */
export function AssetTableFilters({
	criticality,
	onCriticalityChange,
	onSearchChange,
	onStatusChange,
	onTypeChange,
	search,
	status,
	type,
}: AssetTableFiltersProps) {
	return (
		<div className="flex flex-wrap items-center gap-2">
			<Input
				aria-label="Search assets"
				className="max-w-xs"
				onChange={(e) => onSearchChange(e.target.value)}
				placeholder="Search name, hostname, IP…"
				value={search}
			/>
			<Select
				onValueChange={(value) => onTypeChange(value === 'all' ? '' : value)}
				value={type || 'all'}>
				<SelectTrigger aria-label="Filter by type" className="w-[180px]">
					<SelectValue placeholder="All types" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">All types</SelectItem>
					{ASSET_TYPES.map((assetType) => (
						<SelectItem key={assetType} value={assetType}>
							{assetTypeLabel(assetType)}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<Select
				onValueChange={(value) => onStatusChange(value === 'all' ? '' : value)}
				value={status || 'all'}>
				<SelectTrigger aria-label="Filter by status" className="w-[150px]">
					<SelectValue placeholder="All statuses" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">All statuses</SelectItem>
					{ASSET_STATUSES.map((assetStatus) => (
						<SelectItem key={assetStatus} value={assetStatus}>
							{assetStatusLabel(assetStatus)}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<Select
				onValueChange={(value) => onCriticalityChange(value === 'all' ? '' : value)}
				value={criticality || 'all'}>
				<SelectTrigger aria-label="Filter by criticality" className="w-[150px]">
					<SelectValue placeholder="All criticality" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">All criticality</SelectItem>
					{CRITICALITY_LEVELS.map((level) => (
						<SelectItem key={level} value={level}>
							{criticalityLabel(level)}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}
