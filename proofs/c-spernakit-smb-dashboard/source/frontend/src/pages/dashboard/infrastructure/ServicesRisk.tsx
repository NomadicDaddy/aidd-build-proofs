import type { LucideIcon } from 'lucide-react';
import type { CriticalityLevel } from 'spernakit-shared';

import { Globe, HelpCircle, PackageX, ShieldOff, UserX } from 'lucide-react';

import type { RiskSummary, TopService } from '@/api/infrastructureSummary';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { criticalityLabel, criticalityVariant } from '@/pages/assets/assetDisplay';

interface RiskRow {
	icon: LucideIcon;
	key: keyof RiskSummary;
	label: string;
}

const RISK_ROWS: RiskRow[] = [
	{ icon: Globe, key: 'internetExposedPorts', label: 'Internet-exposed ports' },
	{ icon: HelpCircle, key: 'unknownPorts', label: 'Ports needing review' },
	{ icon: PackageX, key: 'unsupportedOs', label: 'Unsupported / EOL operating systems' },
	{ icon: ShieldOff, key: 'criticalWithoutBackup', label: 'Critical assets without backup' },
	{ icon: UserX, key: 'unownedAssets', label: 'Unowned assets' },
];

/** Top business services ranked by criticality and backing infrastructure. */
function ServicesCard({ topServices }: { topServices: TopService[] }) {
	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="text-sm font-medium">Top Business Services</CardTitle>
				<CardDescription>Ranked by criticality and backing infrastructure.</CardDescription>
			</CardHeader>
			<CardContent>
				{topServices.length === 0 ? (
					<p className="text-muted-foreground text-sm">No services catalogued yet.</p>
				) : (
					<ul className="space-y-3">
						{topServices.map((service) => (
							<li
								className="flex items-center justify-between gap-3"
								key={service.id}>
								<div className="min-w-0">
									<div className="truncate text-sm font-medium">
										{service.name}
									</div>
									<div className="text-muted-foreground text-xs">
										{service.backingAssetCount.toLocaleString()} backing asset
										{service.backingAssetCount === 1 ? '' : 's'}
									</div>
								</div>
								<Badge
									variant={criticalityVariant(
										service.criticality as CriticalityLevel
									)}>
									{criticalityLabel(service.criticality as CriticalityLevel)}
								</Badge>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}

/** Operational risk cues: exposure, lifecycle, and ownership gaps. */
function RiskCard({ risks }: { risks: RiskSummary }) {
	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="text-sm font-medium">Risk Cues</CardTitle>
				<CardDescription>
					Exposure, lifecycle, and ownership gaps to review.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<ul className="grid gap-3 sm:grid-cols-2">
					{RISK_ROWS.map(({ icon: Icon, key, label }) => {
						const value = risks[key];
						const flagged = value > 0;
						return (
							<li className="flex items-center justify-between gap-3" key={key}>
								<div className="flex items-center gap-2.5">
									<Icon
										aria-hidden="true"
										className={cn(
											'size-4 shrink-0',
											flagged ? 'text-destructive' : 'text-muted-foreground'
										)}
									/>
									<span className="text-sm">{label}</span>
								</div>
								<span
									className={cn(
										'text-sm font-semibold tabular-nums',
										flagged && 'text-destructive'
									)}>
									{value.toLocaleString()}
								</span>
							</li>
						);
					})}
				</ul>
			</CardContent>
		</Card>
	);
}

export { RiskCard, ServicesCard };
