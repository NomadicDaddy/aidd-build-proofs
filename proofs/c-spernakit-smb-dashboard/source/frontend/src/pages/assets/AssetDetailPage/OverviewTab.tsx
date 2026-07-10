import { FileText, Info } from 'lucide-react';

import type { Asset } from '@/api/assets';

import { Separator } from '@/components/ui/separator';

import { assetStatusLabel, assetTypeLabel, criticalityLabel } from '../assetDisplay.ts';
import { formatDate, formatRef } from './formatters.ts';
import { ExternalRef, Field, FieldGrid, RestrictedInline, SectionCard } from './primitives.tsx';

/** The Overview tab: identity, ownership, and the free-text description. */
export function OverviewTab({
	asset,
	canSeeSensitive,
}: {
	asset: Asset;
	canSeeSensitive: boolean;
}) {
	return (
		<>
			<SectionCard icon={Info} title="Identity & ownership">
				<FieldGrid>
					<Field label="Name" value={asset.name} />
					<Field label="Type" value={assetTypeLabel(asset.assetType)} />
					<Field label="Role" value={asset.role} />
					<Field label="Status" value={assetStatusLabel(asset.status)} />
					<Field label="Criticality" value={criticalityLabel(asset.criticality)} />
					<Field label="Site" value={formatRef('Site', asset.siteId)} />
					<Field
						label="Business owner"
						value={formatRef('Owner', asset.businessOwnerId)}
					/>
					<Field
						label="Technical owner"
						value={formatRef('Owner', asset.technicalOwnerId)}
					/>
					<Field label="Vendor" value={formatRef('Vendor', asset.vendorId)} />
					<Field
						label="Support contact"
						value={canSeeSensitive ? asset.supportContact : <RestrictedInline />}
					/>
					<Field label="Last verified" value={formatDate(asset.lastVerifiedAt)} />
					<Field label="Created" value={formatDate(asset.createdAt)} />
				</FieldGrid>
				{(asset.managementUrl ?? asset.documentationUrl ?? !canSeeSensitive) && (
					<>
						<Separator className="my-4" />
						<div className="flex flex-wrap items-center gap-4 text-sm">
							{canSeeSensitive ? (
								asset.managementUrl && (
									<ExternalRef
										href={asset.managementUrl}
										label="Management URL"
									/>
								)
							) : (
								<span className="inline-flex items-center gap-1.5">
									<span className="text-muted-foreground">Management URL:</span>
									<RestrictedInline />
								</span>
							)}
							{asset.documentationUrl && (
								<ExternalRef href={asset.documentationUrl} label="Documentation" />
							)}
						</div>
					</>
				)}
			</SectionCard>

			{asset.description && (
				<SectionCard icon={FileText} title="Description">
					<p className="text-sm whitespace-pre-wrap">{asset.description}</p>
				</SectionCard>
			)}
		</>
	);
}
