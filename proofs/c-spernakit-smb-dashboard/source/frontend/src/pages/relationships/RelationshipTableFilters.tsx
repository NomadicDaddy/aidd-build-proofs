import {
	ASSET_RELATIONSHIP_TYPES,
	ASSET_STATUSES,
	CRITICALITY_LEVELS,
	RELATIONSHIP_CONFIDENCE_LEVELS,
} from 'spernakit-shared';

import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';

import { assetStatusLabel, criticalityLabel } from '../assets/assetDisplay';
import { confidenceLabel, relationshipTypeLabel } from './relationshipDisplay';

interface RelationshipTableFiltersProps {
	confidence: string;
	criticality: string;
	onConfidenceChange: (value: string) => void;
	onCriticalityChange: (value: string) => void;
	onRelationshipTypeChange: (value: string) => void;
	onSearchChange: (value: string) => void;
	onStatusChange: (value: string) => void;
	relationshipType: string;
	search: string;
	status: string;
}

/**
 * Filter bar for the relationship table: a free-text endpoint search (matches
 * either endpoint asset's name / hostname / FQDN / IP) plus relationship type,
 * confidence, and endpoint status / criticality dropdowns. Each control maps to
 * a URL-synced filter param via the parent page.
 */
export function RelationshipTableFilters({
	confidence,
	criticality,
	onConfidenceChange,
	onCriticalityChange,
	onRelationshipTypeChange,
	onSearchChange,
	onStatusChange,
	relationshipType,
	search,
	status,
}: RelationshipTableFiltersProps) {
	return (
		<div className="flex flex-wrap items-center gap-2">
			<Input
				aria-label="Search relationships by endpoint"
				className="max-w-xs"
				onChange={(e) => onSearchChange(e.target.value)}
				placeholder="Search endpoint name, hostname, IP…"
				value={search}
			/>
			<Select
				onValueChange={(value) => onRelationshipTypeChange(value === 'all' ? '' : value)}
				value={relationshipType || 'all'}>
				<SelectTrigger aria-label="Filter by relationship type" className="w-[200px]">
					<SelectValue placeholder="All relationship types" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">All relationship types</SelectItem>
					{ASSET_RELATIONSHIP_TYPES.map((type) => (
						<SelectItem key={type} value={type}>
							{relationshipTypeLabel(type)}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<Select
				onValueChange={(value) => onConfidenceChange(value === 'all' ? '' : value)}
				value={confidence || 'all'}>
				<SelectTrigger aria-label="Filter by confidence" className="w-[160px]">
					<SelectValue placeholder="All confidence" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">All confidence</SelectItem>
					{RELATIONSHIP_CONFIDENCE_LEVELS.map((level) => (
						<SelectItem key={level} value={level}>
							{confidenceLabel(level)}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<Select
				onValueChange={(value) => onStatusChange(value === 'all' ? '' : value)}
				value={status || 'all'}>
				<SelectTrigger aria-label="Filter by endpoint status" className="w-[160px]">
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
				<SelectTrigger aria-label="Filter by endpoint criticality" className="w-[160px]">
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
