import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import type { AssetPort, PortInput } from '@/api/assets';

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

import type { PortForm } from './portFormModel.ts';

import { PortDialogFields } from './PortDialogFields.tsx';
import { EMPTY_FORM, formToInput, portToForm, SERVICE_PICKER_LIMIT } from './portFormModel.ts';

interface PortDialogProps {
	isOpen: boolean;
	isPending: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (input: PortInput) => void;
	/** Existing port to seed the form, or `null` when adding a new one. */
	port: AssetPort | null;
}

/**
 * Create / edit dialog for a single asset port. Captures the protocol, port
 * number, service attribution (free-text name and optional catalog service),
 * scope, exposure level, source, review state, verification date, and notes,
 * emitting the full writable payload (empty fields → `null`).
 */
export function PortDialog({ isOpen, isPending, onOpenChange, onSubmit, port }: PortDialogProps) {
	const [form, setForm] = useState<PortForm>(EMPTY_FORM);

	// Re-seed whenever the dialog opens for a given port (or a fresh add).
	const [seededKey, setSeededKey] = useState<null | string>(null);
	const openKey = isOpen ? (port ? `edit-${port.id}` : 'create') : null;
	if (openKey !== seededKey) {
		setSeededKey(openKey);
		if (openKey !== null) setForm(port ? portToForm(port) : EMPTY_FORM);
	}

	const { data: servicesData } = useQuery({
		enabled: isOpen,
		queryFn: () => listServices({ limit: String(SERVICE_PICKER_LIMIT) }),
		queryKey: ['services', 'port-picker'],
	});
	const serviceOptions = servicesData?.data ?? [];

	const portNumberValid =
		form.portNumber.trim() !== '' &&
		Number.isInteger(Number(form.portNumber)) &&
		Number(form.portNumber) >= 0 &&
		Number(form.portNumber) <= 65535;

	function set<K extends keyof PortForm>(key: K) {
		return (value: PortForm[K]) => setForm((f) => ({ ...f, [key]: value }));
	}

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!portNumberValid) return;
		onSubmit(formToInput(form));
	}

	return (
		<Dialog onOpenChange={onOpenChange} open={isOpen}>
			<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>{port ? 'Edit port' : 'Add port'}</DialogTitle>
					<DialogDescription>
						Record the protocol, port number, exposure, and review state for this port,
						and document why it is open.
					</DialogDescription>
				</DialogHeader>
				<form className="space-y-6" noValidate onSubmit={handleSubmit}>
					<PortDialogFields form={form} serviceOptions={serviceOptions} set={set} />

					<DialogFooter>
						<Button disabled={isPending || !portNumberValid} type="submit">
							{isPending ? 'Saving…' : 'Save port'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
