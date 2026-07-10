import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { AlertTriangle, ArrowLeft, Lock, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface FieldProps {
	label: string;
	value: ReactNode;
}

/** A single labelled fact rendered in a responsive definition grid. */
export function Field({ label, value }: FieldProps) {
	const isEmpty = value === null || value === undefined || value === '' || value === '—';
	return (
		<div className="space-y-0.5">
			<dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
				{label}
			</dt>
			<dd className={isEmpty ? 'text-muted-foreground text-sm' : 'text-sm break-words'}>
				{isEmpty ? '—' : value}
			</dd>
		</div>
	);
}

/**
 * Inline marker shown in place of a sensitive field (management URL, support
 * contact, operator notes) for viewers who lack the privilege to see it. The
 * backend redacts these values to null for below-OPERATOR roles; this makes the
 * redaction legible rather than looking like missing data.
 */
export function RestrictedInline() {
	return (
		<span className="text-muted-foreground inline-flex items-center gap-1 text-sm italic">
			<Lock aria-hidden="true" className="size-3.5" />
			Restricted · operator access required
		</span>
	);
}

interface SectionCardProps {
	action?: ReactNode;
	children: ReactNode;
	description?: string;
	icon: LucideIcon;
	title: string;
}

/** A titled card wrapping one asset detail section, with an optional header action. */
export function SectionCard({
	action,
	children,
	description,
	icon: Icon,
	title,
}: SectionCardProps) {
	return (
		<Card>
			<CardHeader>
				<div className="flex items-start justify-between gap-4">
					<div className="space-y-1">
						<CardTitle className="flex items-center gap-2 text-base">
							<Icon aria-hidden="true" className="text-muted-foreground size-4" />
							{title}
						</CardTitle>
						{description && (
							<p className="text-muted-foreground text-sm">{description}</p>
						)}
					</div>
					{action}
				</div>
			</CardHeader>
			<CardContent>{children}</CardContent>
		</Card>
	);
}

/** A responsive definition grid for a set of labelled fields. */
export function FieldGrid({ children }: { children: ReactNode }) {
	return <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</dl>;
}

/**
 * Empty-state panel for a detail domain whose dedicated records are not yet
 * tracked (services, ports, storage, relationships, history). These are backed
 * by separate backlog features; until those land the section renders a clear,
 * non-error placeholder rather than a blank card.
 */
export function NotYetTracked({
	description,
	icon,
	title,
}: {
	description: string;
	icon: LucideIcon;
	title: string;
}) {
	return <EmptyState description={description} icon={icon} title={title} variant="compact" />;
}

/** A secondary badge with a leading icon, used for the asset-type chip. */
export function IconBadge({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
	return (
		<Badge className="gap-1.5" variant="secondary">
			<Icon aria-hidden="true" className="size-3" />
			{label}
		</Badge>
	);
}

/** External link rendered as a labelled inline reference. */
export function ExternalRef({ href, label }: { href: string; label: string }) {
	return (
		<a
			className="text-primary inline-flex items-center gap-1.5 hover:underline"
			href={href}
			rel="noreferrer"
			target="_blank">
			<ShieldCheck aria-hidden="true" className="size-4" />
			{label}
		</a>
	);
}

/** Shared not-found panel for invalid ids and missing/deleted assets. */
export function AssetNotFound() {
	return (
		<>
			<PageHeader
				breadcrumbs={[{ label: 'Assets', to: '/assets' }, { label: 'Not found' }]}
				title="Asset not found"
			/>
			<EmptyState
				action={
					<Button asChild variant="outline">
						<Link to="/assets">
							<ArrowLeft aria-hidden="true" className="size-4" />
							Back to inventory
						</Link>
					</Button>
				}
				description="This asset does not exist or is no longer available. It may have been deleted."
				icon={AlertTriangle}
				title="We couldn't find that asset"
			/>
		</>
	);
}
