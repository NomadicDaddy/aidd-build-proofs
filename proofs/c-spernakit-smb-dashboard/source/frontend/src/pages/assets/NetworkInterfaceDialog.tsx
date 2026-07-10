import { useState } from 'react';

import type { NetworkInterface, NetworkInterfaceInput } from '@/api/assets';

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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

/**
 * Local editable shape. Every text field is a string so the inputs stay
 * controlled; numeric fields are parsed on submit and empty strings clear the
 * column. `isPrimary` is a boolean bound to a switch.
 */
interface InterfaceForm {
	dnsName: string;
	gateway: string;
	ipAddress: string;
	isPrimary: boolean;
	macAddress: string;
	name: string;
	networkZoneId: string;
	notes: string;
	subnetMask: string;
	vlanId: string;
}

const EMPTY_FORM: InterfaceForm = {
	dnsName: '',
	gateway: '',
	ipAddress: '',
	isPrimary: false,
	macAddress: '',
	name: '',
	networkZoneId: '',
	notes: '',
	subnetMask: '',
	vlanId: '',
};

/** Render a nullable value as a form string (numbers become their decimal text). */
function toField(value: null | number | string): string {
	if (value === null) return '';
	return String(value);
}

function interfaceToForm(iface: NetworkInterface): InterfaceForm {
	return {
		dnsName: toField(iface.dnsName),
		gateway: toField(iface.gateway),
		ipAddress: toField(iface.ipAddress),
		isPrimary: iface.isPrimary,
		macAddress: toField(iface.macAddress),
		name: toField(iface.name),
		networkZoneId: toField(iface.networkZoneId),
		notes: toField(iface.notes),
		subnetMask: toField(iface.subnetMask),
		vlanId: toField(iface.vlanId),
	};
}

/** Trimmed text → `null` when empty. */
function orNull(value: string): null | string {
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

/** Parse a non-negative integer field → number, or `null` when blank/invalid. */
function orNullInt(value: string): null | number {
	const trimmed = value.trim();
	if (trimmed.length === 0) return null;
	const parsed = Number(trimmed);
	if (!Number.isFinite(parsed) || parsed < 0) return null;
	return Math.trunc(parsed);
}

function formToInput(form: InterfaceForm): NetworkInterfaceInput {
	return {
		dnsName: orNull(form.dnsName),
		gateway: orNull(form.gateway),
		ipAddress: orNull(form.ipAddress),
		isPrimary: form.isPrimary,
		macAddress: orNull(form.macAddress),
		name: orNull(form.name),
		networkZoneId: orNullInt(form.networkZoneId),
		notes: orNull(form.notes),
		subnetMask: orNull(form.subnetMask),
		vlanId: orNullInt(form.vlanId),
	};
}

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

interface NetworkInterfaceDialogProps {
	isOpen: boolean;
	isPending: boolean;
	/** Existing interface to seed the form, or `null` when adding a new one. */
	networkInterface: NetworkInterface | null;
	onOpenChange: (open: boolean) => void;
	onSubmit: (input: NetworkInterfaceInput) => void;
}

/**
 * Create / edit dialog for a single asset network interface. Captures the name,
 * addressing (MAC, IP, subnet, gateway), VLAN, DNS name, network zone, primary
 * flag, and notes, emitting the full writable payload (empty fields → `null`).
 */
export function NetworkInterfaceDialog({
	isOpen,
	isPending,
	networkInterface,
	onOpenChange,
	onSubmit,
}: NetworkInterfaceDialogProps) {
	const [form, setForm] = useState<InterfaceForm>(EMPTY_FORM);

	// Re-seed whenever the dialog opens for a given interface (or a fresh add).
	const [seededKey, setSeededKey] = useState<null | string>(null);
	const openKey = isOpen ? (networkInterface ? `edit-${networkInterface.id}` : 'create') : null;
	if (openKey !== seededKey) {
		setSeededKey(openKey);
		if (openKey !== null) {
			setForm(networkInterface ? interfaceToForm(networkInterface) : EMPTY_FORM);
		}
	}

	const set = (key: keyof InterfaceForm) => (value: string) =>
		setForm((f) => ({ ...f, [key]: value }));

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		onSubmit(formToInput(form));
	}

	return (
		<Dialog onOpenChange={onOpenChange} open={isOpen}>
			<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>
						{networkInterface ? 'Edit network interface' : 'Add network interface'}
					</DialogTitle>
					<DialogDescription>
						Record addressing, VLAN, DNS, and network-zone details for this interface.
					</DialogDescription>
				</DialogHeader>
				<form className="space-y-6" onSubmit={handleSubmit}>
					<section className="space-y-3">
						<h3 className="text-sm font-semibold">Identity &amp; addressing</h3>
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<TextField
								id="ni-name"
								label="Interface name"
								onChange={set('name')}
								placeholder="e.g. eth0"
								value={form.name}
							/>
							<TextField
								id="ni-mac"
								label="MAC address"
								onChange={set('macAddress')}
								placeholder="e.g. 00:1a:2b:3c:4d:5e"
								value={form.macAddress}
							/>
							<TextField
								id="ni-ip"
								label="IP address"
								onChange={set('ipAddress')}
								placeholder="e.g. 10.0.0.10"
								value={form.ipAddress}
							/>
							<TextField
								id="ni-subnet"
								label="Subnet mask"
								onChange={set('subnetMask')}
								placeholder="e.g. 255.255.255.0"
								value={form.subnetMask}
							/>
							<TextField
								id="ni-gateway"
								label="Gateway"
								onChange={set('gateway')}
								placeholder="e.g. 10.0.0.1"
								value={form.gateway}
							/>
							<TextField
								id="ni-dns"
								label="DNS name"
								onChange={set('dnsName')}
								placeholder="e.g. dc01.corp.local"
								value={form.dnsName}
							/>
							<TextField
								id="ni-vlan"
								label="VLAN ID"
								onChange={set('vlanId')}
								type="number"
								value={form.vlanId}
							/>
							<TextField
								id="ni-zone"
								label="Network zone ID"
								onChange={set('networkZoneId')}
								type="number"
								value={form.networkZoneId}
							/>
						</div>
						<div className="flex items-center gap-3 pt-1">
							<Switch
								checked={form.isPrimary}
								id="ni-primary"
								onCheckedChange={(checked) =>
									setForm((f) => ({ ...f, isPrimary: checked }))
								}
							/>
							<Label htmlFor="ni-primary">Primary interface</Label>
						</div>
					</section>

					<section className="space-y-2">
						<Label htmlFor="ni-notes">Notes</Label>
						<Textarea
							id="ni-notes"
							onChange={(e) => set('notes')(e.target.value)}
							rows={2}
							value={form.notes}
						/>
					</section>

					<DialogFooter>
						<Button disabled={isPending} type="submit">
							{isPending ? 'Saving…' : 'Save interface'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
