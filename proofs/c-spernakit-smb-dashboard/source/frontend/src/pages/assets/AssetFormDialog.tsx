import { useState } from 'react';

import type { Asset, CreateAssetInput } from '@/api/assets';

import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';

import type { AssetForm } from './assetFormModel.ts';

import { AssetFormFields } from './AssetFormFields.tsx';
import { assetToForm, EMPTY_FORM, formToInput } from './assetFormModel.ts';

interface AssetFormDialogProps {
	/** Asset being edited, or `null` for create mode. */
	asset: Asset | null;
	isOpen: boolean;
	isPending: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (input: CreateAssetInput) => void;
}

/**
 * Create / edit dialog for an asset. In edit mode the form is seeded from the
 * selected asset; in create mode it starts from sensible defaults. Emits the
 * full writable payload (empty text fields become `null`).
 */
export function AssetFormDialog({
	asset,
	isOpen,
	isPending,
	onOpenChange,
	onSubmit,
}: AssetFormDialogProps) {
	const [form, setForm] = useState<AssetForm>(EMPTY_FORM);
	const isEdit = asset !== null;

	// Re-seed the form whenever the dialog opens (create vs. a specific asset).
	// Adjusting state during render — keyed on the current open target — is
	// React's recommended alternative to `useEffect(setState)` and avoids the
	// cascading renders the react-hooks/set-state-in-effect rule guards against.
	const [seededKey, setSeededKey] = useState<null | string>(null);
	const openKey = isOpen ? (asset ? `edit-${asset.id}` : 'create') : null;
	if (openKey !== seededKey) {
		setSeededKey(openKey);
		if (openKey !== null) setForm(asset ? assetToForm(asset) : EMPTY_FORM);
	}

	const nameValid = form.name.trim().length > 0;

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!nameValid) return;
		onSubmit(formToInput(form));
	}

	return (
		<Dialog onOpenChange={onOpenChange} open={isOpen}>
			<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>{isEdit ? 'Edit Asset' : 'Create Asset'}</DialogTitle>
					<DialogDescription>
						{isEdit
							? 'Update the details for this infrastructure asset.'
							: 'Add a new infrastructure asset to the inventory.'}
					</DialogDescription>
				</DialogHeader>
				<form className="space-y-4" noValidate onSubmit={handleSubmit}>
					<AssetFormFields form={form} nameValid={nameValid} setForm={setForm} />

					<DialogFooter>
						<Button disabled={isPending || !nameValid} type="submit">
							{isPending
								? isEdit
									? 'Saving…'
									: 'Creating…'
								: isEdit
									? 'Save Changes'
									: 'Create Asset'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
