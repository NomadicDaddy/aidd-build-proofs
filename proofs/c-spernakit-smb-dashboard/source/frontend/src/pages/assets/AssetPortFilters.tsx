import { useQuery } from '@tanstack/react-query';
import { PORT_EXPOSURE_LEVELS, PORT_PROTOCOLS, PORT_REVIEW_STATES } from 'spernakit-shared';

import { listServices } from '@/api/services';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';

import { portExposureLabel, portReviewLabel } from './portDisplay';

/** Upper bound on the service filter options; the catalog is small in practice. */
const SERVICE_FILTER_LIMIT = 200;

interface AssetPortFiltersProps {
	exposureLevel: string;
	onExposureLevelChange: (value: string) => void;
	onPortNumberChange: (value: string) => void;
	onProtocolChange: (value: string) => void;
	onReviewStateChange: (value: string) => void;
	onServiceIdChange: (value: string) => void;
	portNumber: string;
	protocol: string;
	reviewState: string;
	serviceId: string;
}

/**
 * Secondary filter row for the asset inventory: narrows the list to assets that
 * expose a port matching the chosen protocol, exposure level, review state, port
 * number, or catalog service. Each control maps to a URL-synced filter param via
 * the parent page. Selecting "all" clears the corresponding filter.
 */
export function AssetPortFilters({
	exposureLevel,
	onExposureLevelChange,
	onPortNumberChange,
	onProtocolChange,
	onReviewStateChange,
	onServiceIdChange,
	portNumber,
	protocol,
	reviewState,
	serviceId,
}: AssetPortFiltersProps) {
	const { data: servicesData } = useQuery({
		queryFn: () => listServices({ limit: String(SERVICE_FILTER_LIMIT) }),
		queryKey: ['services', 'port-filter'],
	});
	const services = servicesData?.data ?? [];

	return (
		<div className="flex flex-wrap items-center gap-2">
			<span className="text-muted-foreground text-sm">Ports:</span>
			<Select
				onValueChange={(value) => onProtocolChange(value === 'all' ? '' : value)}
				value={protocol || 'all'}>
				<SelectTrigger aria-label="Filter by port protocol" className="w-[130px]">
					<SelectValue placeholder="Any protocol" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">Any protocol</SelectItem>
					{PORT_PROTOCOLS.map((value) => (
						<SelectItem key={value} value={value}>
							{value.toUpperCase()}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<Select
				onValueChange={(value) => onExposureLevelChange(value === 'all' ? '' : value)}
				value={exposureLevel || 'all'}>
				<SelectTrigger aria-label="Filter by port exposure" className="w-[160px]">
					<SelectValue placeholder="Any exposure" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">Any exposure</SelectItem>
					{PORT_EXPOSURE_LEVELS.map((value) => (
						<SelectItem key={value} value={value}>
							{portExposureLabel(value)}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<Select
				onValueChange={(value) => onReviewStateChange(value === 'all' ? '' : value)}
				value={reviewState || 'all'}>
				<SelectTrigger aria-label="Filter by port review state" className="w-[160px]">
					<SelectValue placeholder="Any review state" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">Any review state</SelectItem>
					{PORT_REVIEW_STATES.map((value) => (
						<SelectItem key={value} value={value}>
							{portReviewLabel(value)}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<Select
				onValueChange={(value) => onServiceIdChange(value === 'all' ? '' : value)}
				value={serviceId || 'all'}>
				<SelectTrigger aria-label="Filter by port service" className="w-[170px]">
					<SelectValue placeholder="Any service" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">Any service</SelectItem>
					{services.map((service) => (
						<SelectItem key={service.id} value={String(service.id)}>
							{service.name}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<Input
				aria-label="Filter by port number"
				className="w-[130px]"
				max={65535}
				min={0}
				onChange={(e) => onPortNumberChange(e.target.value)}
				placeholder="Port number"
				type="number"
				value={portNumber}
			/>
		</div>
	);
}
