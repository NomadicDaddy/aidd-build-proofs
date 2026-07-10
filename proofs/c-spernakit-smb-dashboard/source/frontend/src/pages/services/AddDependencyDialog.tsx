import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import type { DependencyInput } from '@/api/services';

import { listAssets } from '@/api/assets';
import { listServices } from '@/api/services';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';

/** How many candidate targets to load for the dependency pickers. */
const TARGET_LIMIT = 100;

type TargetType = 'asset' | 'service';

interface AddDependencyDialogProps {
	isOpen: boolean;
	isPending: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (input: DependencyInput) => void;
	/** The service the dependency belongs to — excluded from the service picker. */
	serviceId: number;
}

/**
 * Dialog for adding a dependency from a service onto exactly one target: another
 * catalog service or an infrastructure asset. The target type toggles which
 * picker is shown; candidates are loaded from the service and asset list APIs.
 */
export function AddDependencyDialog({
	isOpen,
	isPending,
	onOpenChange,
	onSubmit,
	serviceId,
}: AddDependencyDialogProps) {
	const [targetType, setTargetType] = useState<TargetType>('service');
	const [targetId, setTargetId] = useState<string>('');
	const [dependencyType, setDependencyType] = useState<string>('');

	const { data: servicesData } = useQuery({
		enabled: isOpen,
		queryFn: () => listServices({ limit: String(TARGET_LIMIT), page: '1' }),
		queryKey: ['services', 'dependency-picker'],
	});
	const { data: assetsData } = useQuery({
		enabled: isOpen,
		queryFn: () => listAssets({ limit: String(TARGET_LIMIT), page: '1' }),
		queryKey: ['assets', 'dependency-picker'],
	});

	const services = (servicesData?.data ?? []).filter((s) => s.id !== serviceId);
	const assets = assetsData?.data ?? [];

	// Re-seed the form whenever the dialog opens.
	const [seededOpen, setSeededOpen] = useState(false);
	if (isOpen !== seededOpen) {
		setSeededOpen(isOpen);
		if (isOpen) {
			setTargetType('service');
			setTargetId('');
			setDependencyType('');
		}
	}

	function handleTargetTypeChange(value: string) {
		setTargetType(value as TargetType);
		setTargetId('');
	}

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!targetId) return;
		const trimmedType = dependencyType.trim();
		onSubmit({
			...(trimmedType ? { dependencyType: trimmedType } : {}),
			...(targetType === 'service'
				? { dependsOnServiceId: Number(targetId) }
				: { dependsOnAssetId: Number(targetId) }),
		});
	}

	return (
		<Dialog onOpenChange={onOpenChange} open={isOpen}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Add dependency</DialogTitle>
					<DialogDescription>
						Record that this service depends on another service or an infrastructure
						asset.
					</DialogDescription>
				</DialogHeader>
				<form className="space-y-4" noValidate onSubmit={handleSubmit}>
					<div className="space-y-2">
						<Label htmlFor="dependency-target-type">Depends on</Label>
						<Select onValueChange={handleTargetTypeChange} value={targetType}>
							<SelectTrigger id="dependency-target-type">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="service">A service</SelectItem>
								<SelectItem value="asset">An asset</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label htmlFor="dependency-target">
							{targetType === 'service' ? 'Service' : 'Asset'}
						</Label>
						<Select onValueChange={setTargetId} value={targetId}>
							<SelectTrigger
								aria-label={`Select ${targetType}`}
								id="dependency-target">
								<SelectValue placeholder={`Select a ${targetType}…`} />
							</SelectTrigger>
							<SelectContent>
								{targetType === 'service'
									? services.map((s) => (
											<SelectItem key={s.id} value={String(s.id)}>
												{s.name}
											</SelectItem>
										))
									: assets.map((a) => (
											<SelectItem key={a.id} value={String(a.id)}>
												{a.name}
											</SelectItem>
										))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label htmlFor="dependency-type">Relationship (optional)</Label>
						<Input
							autoComplete="off"
							id="dependency-type"
							onChange={(e) => setDependencyType(e.target.value)}
							placeholder="e.g. requires, uses"
							value={dependencyType}
						/>
					</div>

					<DialogFooter>
						<Button disabled={isPending || !targetId} type="submit">
							{isPending ? 'Adding…' : 'Add dependency'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
