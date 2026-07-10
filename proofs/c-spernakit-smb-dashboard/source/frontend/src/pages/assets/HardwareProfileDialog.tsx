import { useState } from 'react';

import type { HardwareProfile, HardwareProfileInput } from '@/api/assets';

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
import { Textarea } from '@/components/ui/textarea';

import type { ProfileForm } from './hardwareProfileModel.ts';

import { EMPTY_FORM, formToInput, profileToForm } from './hardwareProfileModel.ts';

interface TextFieldProps {
	id: string;
	label: string;
	onChange: (value: string) => void;
	placeholder?: string;
	type?: 'number' | 'text';
	value: string;
}

function TextField({ id, label, onChange, placeholder, type = 'text', value }: TextFieldProps) {
	return (
		<div className="space-y-2">
			<Label htmlFor={id}>{label}</Label>
			<Input
				autoComplete="off"
				id={id}
				{...(type === 'number' ? { min: 0, type: 'number' } : {})}
				onChange={(e) => onChange(e.target.value)}
				placeholder={placeholder}
				value={value}
			/>
		</div>
	);
}

interface HardwareProfileDialogProps {
	isOpen: boolean;
	isPending: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (input: HardwareProfileInput) => void;
	/** Existing profile to seed the form, or `null` when creating a first profile. */
	profile: HardwareProfile | null;
}

/**
 * Create / edit dialog for an asset's hardware profile. Groups the CPU, memory,
 * storage, virtualization, and physical-host facts and emits the full writable
 * payload (empty fields become `null`).
 */
export function HardwareProfileDialog({
	isOpen,
	isPending,
	onOpenChange,
	onSubmit,
	profile,
}: HardwareProfileDialogProps) {
	const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);

	// Re-seed whenever the dialog opens for a given profile (or a first create).
	const [seededKey, setSeededKey] = useState<null | string>(null);
	const openKey = isOpen ? (profile ? `edit-${profile.id}` : 'create') : null;
	if (openKey !== seededKey) {
		setSeededKey(openKey);
		if (openKey !== null) setForm(profile ? profileToForm(profile) : EMPTY_FORM);
	}

	const set = (key: keyof ProfileForm) => (value: string) =>
		setForm((f) => ({ ...f, [key]: value }));

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		onSubmit(formToInput(form));
	}

	return (
		<Dialog onOpenChange={onOpenChange} open={isOpen}>
			<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>Edit hardware profile</DialogTitle>
					<DialogDescription>
						Record CPU, memory, storage, virtualization, and physical-host facts for
						this asset.
					</DialogDescription>
				</DialogHeader>
				<form className="space-y-6" onSubmit={handleSubmit}>
					<section className="space-y-3">
						<h3 className="text-sm font-semibold">Compute &amp; platform</h3>
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<TextField
								id="hp-cpu-model"
								label="CPU model"
								onChange={set('cpuModel')}
								placeholder="e.g. Intel Xeon Silver 4310"
								value={form.cpuModel}
							/>
							<TextField
								id="hp-hardware-model"
								label="Hardware model"
								onChange={set('hardwareModel')}
								placeholder="e.g. Dell PowerEdge R650"
								value={form.hardwareModel}
							/>
							<TextField
								id="hp-cpu-cores"
								label="CPU cores"
								onChange={set('cpuCores')}
								type="number"
								value={form.cpuCores}
							/>
							<TextField
								id="hp-cpu-sockets"
								label="CPU sockets"
								onChange={set('cpuSockets')}
								type="number"
								value={form.cpuSockets}
							/>
							<TextField
								id="hp-cpu-threads"
								label="CPU threads"
								onChange={set('cpuThreads')}
								type="number"
								value={form.cpuThreads}
							/>
							<TextField
								id="hp-ram"
								label="RAM (MB)"
								onChange={set('ramMb')}
								type="number"
								value={form.ramMb}
							/>
							<TextField
								id="hp-storage"
								label="Total storage (GB)"
								onChange={set('totalStorageGb')}
								type="number"
								value={form.totalStorageGb}
							/>
							<TextField
								id="hp-hypervisor"
								label="Hypervisor"
								onChange={set('hypervisor')}
								placeholder="e.g. VMware ESXi 8.0"
								value={form.hypervisor}
							/>
						</div>
					</section>

					<section className="space-y-3">
						<h3 className="text-sm font-semibold">Virtualization (VM)</h3>
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<TextField
								id="hp-guest-os"
								label="Guest OS"
								onChange={set('guestOs')}
								placeholder="e.g. Ubuntu 24.04 LTS"
								value={form.guestOs}
							/>
							<TextField
								id="hp-vcpu"
								label="vCPU count"
								onChange={set('vcpuCount')}
								type="number"
								value={form.vcpuCount}
							/>
							<TextField
								id="hp-tools"
								label="VM tools status"
								onChange={set('vmToolsStatus')}
								placeholder="e.g. Running (current)"
								value={form.vmToolsStatus}
							/>
							<TextField
								id="hp-cluster"
								label="Cluster"
								onChange={set('clusterName')}
								value={form.clusterName}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="hp-snapshot">Snapshot notes</Label>
							<Textarea
								id="hp-snapshot"
								onChange={(e) => set('snapshotNotes')(e.target.value)}
								rows={2}
								value={form.snapshotNotes}
							/>
						</div>
					</section>

					<section className="space-y-3">
						<h3 className="text-sm font-semibold">Physical host</h3>
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<TextField
								id="hp-chassis"
								label="Chassis / model"
								onChange={set('chassisModel')}
								value={form.chassisModel}
							/>
							<TextField
								id="hp-form-factor"
								label="Form factor"
								onChange={set('formFactor')}
								placeholder="e.g. 1U rack"
								value={form.formFactor}
							/>
							<TextField
								id="hp-host-role"
								label="Host role"
								onChange={set('hostRole')}
								value={form.hostRole}
							/>
						</div>
					</section>

					<section className="space-y-2">
						<Label htmlFor="hp-notes">Notes</Label>
						<Textarea
							id="hp-notes"
							onChange={(e) => set('notes')(e.target.value)}
							rows={2}
							value={form.notes}
						/>
					</section>

					<DialogFooter>
						<Button disabled={isPending} type="submit">
							{isPending ? 'Saving…' : 'Save profile'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
