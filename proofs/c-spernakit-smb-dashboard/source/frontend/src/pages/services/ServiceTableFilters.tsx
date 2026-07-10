import { CRITICALITY_LEVELS } from 'spernakit-shared';

import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';

import { categoryLabel, criticalityLabel, SERVICE_CATEGORY_SUGGESTIONS } from './serviceDisplay';

interface ServiceTableFiltersProps {
	category: string;
	criticality: string;
	onCategoryChange: (value: string) => void;
	onCriticalityChange: (value: string) => void;
	onSearchChange: (value: string) => void;
	search: string;
}

/**
 * Filter bar for the service catalog table: a free-text search (name / category
 * / description) plus category and criticality dropdowns. Each control maps to a
 * URL-synced filter param via the parent page.
 */
export function ServiceTableFilters({
	category,
	criticality,
	onCategoryChange,
	onCriticalityChange,
	onSearchChange,
	search,
}: ServiceTableFiltersProps) {
	return (
		<div className="flex flex-wrap items-center gap-2">
			<Input
				aria-label="Search services"
				className="max-w-xs"
				onChange={(e) => onSearchChange(e.target.value)}
				placeholder="Search name, category…"
				value={search}
			/>
			<Select
				onValueChange={(value) => onCategoryChange(value === 'all' ? '' : value)}
				value={category || 'all'}>
				<SelectTrigger aria-label="Filter by category" className="w-[180px]">
					<SelectValue placeholder="All categories" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">All categories</SelectItem>
					{SERVICE_CATEGORY_SUGGESTIONS.map((cat) => (
						<SelectItem key={cat} value={cat}>
							{categoryLabel(cat)}
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
