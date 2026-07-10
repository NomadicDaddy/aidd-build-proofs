import type { Dispatch, SetStateAction } from 'react';

import { ASSET_STATUSES, ASSET_TYPES, CRITICALITY_LEVELS } from 'spernakit-shared';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

import type { AssetForm } from './assetFormModel.ts';

import { assetStatusLabel, assetTypeLabel, criticalityLabel } from './assetDisplay.ts';

interface AssetFormFieldsProps {
	form: AssetForm;
	nameValid: boolean;
	setForm: Dispatch<SetStateAction<AssetForm>>;
}

/** The editable field body of the asset create/edit form. */
export function AssetFormFields({ form, nameValid, setForm }: AssetFormFieldsProps) {
	return (
		<>
			<div className="space-y-2">
				<Label htmlFor="asset-name">Name</Label>
				<Input
					autoComplete="off"
					id="asset-name"
					onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
					required
					value={form.name}
					{...(nameValid ? {} : { 'aria-invalid': true })}
				/>
			</div>

			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div className="space-y-2">
					<Label htmlFor="asset-type">Type</Label>
					<Select
						onValueChange={(value) =>
							setForm((f) => ({
								...f,
								assetType: value as AssetForm['assetType'],
							}))
						}
						value={form.assetType}>
						<SelectTrigger id="asset-type">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{ASSET_TYPES.map((assetType) => (
								<SelectItem key={assetType} value={assetType}>
									{assetTypeLabel(assetType)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="space-y-2">
					<Label htmlFor="asset-status">Status</Label>
					<Select
						onValueChange={(value) =>
							setForm((f) => ({ ...f, status: value as AssetForm['status'] }))
						}
						value={form.status}>
						<SelectTrigger id="asset-status">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{ASSET_STATUSES.map((assetStatus) => (
								<SelectItem key={assetStatus} value={assetStatus}>
									{assetStatusLabel(assetStatus)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="space-y-2">
					<Label htmlFor="asset-criticality">Criticality</Label>
					<Select
						onValueChange={(value) =>
							setForm((f) => ({
								...f,
								criticality: value as AssetForm['criticality'],
							}))
						}
						value={form.criticality}>
						<SelectTrigger id="asset-criticality">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{CRITICALITY_LEVELS.map((level) => (
								<SelectItem key={level} value={level}>
									{criticalityLabel(level)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="space-y-2">
					<Label htmlFor="asset-role">Role</Label>
					<Input
						autoComplete="off"
						id="asset-role"
						onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
						placeholder="e.g. Domain Controller"
						value={form.role}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="asset-hostname">Hostname</Label>
					<Input
						autoComplete="off"
						id="asset-hostname"
						onChange={(e) => setForm((f) => ({ ...f, hostname: e.target.value }))}
						spellCheck={false}
						value={form.hostname}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="asset-fqdn">FQDN</Label>
					<Input
						autoComplete="off"
						id="asset-fqdn"
						onChange={(e) => setForm((f) => ({ ...f, fqdn: e.target.value }))}
						spellCheck={false}
						value={form.fqdn}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="asset-ip">Primary IP</Label>
					<Input
						autoComplete="off"
						id="asset-ip"
						onChange={(e) => setForm((f) => ({ ...f, primaryIp: e.target.value }))}
						spellCheck={false}
						value={form.primaryIp}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="asset-os">Operating System</Label>
					<Input
						autoComplete="off"
						id="asset-os"
						onChange={(e) =>
							setForm((f) => ({ ...f, operatingSystem: e.target.value }))
						}
						value={form.operatingSystem}
					/>
				</div>
			</div>

			<div className="flex items-center justify-between rounded-md border px-3 py-2">
				<Label className="cursor-pointer" htmlFor="asset-virtual">
					Virtual asset
				</Label>
				<Switch
					checked={form.isVirtual}
					id="asset-virtual"
					onCheckedChange={(checked) => setForm((f) => ({ ...f, isVirtual: checked }))}
				/>
			</div>

			<div className="space-y-2">
				<Label htmlFor="asset-description">Description</Label>
				<Textarea
					id="asset-description"
					onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
					rows={3}
					value={form.description}
				/>
			</div>

			<fieldset className="space-y-3 rounded-md border p-3">
				<legend className="text-muted-foreground px-1 text-xs font-medium tracking-wide uppercase">
					Lifecycle
				</legend>
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div className="space-y-2">
						<Label htmlFor="asset-purchase-date">Purchase date</Label>
						<Input
							id="asset-purchase-date"
							onChange={(e) =>
								setForm((f) => ({ ...f, purchaseDate: e.target.value }))
							}
							type="date"
							value={form.purchaseDate}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="asset-warranty">Warranty expires</Label>
						<Input
							id="asset-warranty"
							onChange={(e) =>
								setForm((f) => ({
									...f,
									warrantyExpiresAt: e.target.value,
								}))
							}
							type="date"
							value={form.warrantyExpiresAt}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="asset-support-end">Support ends</Label>
						<Input
							id="asset-support-end"
							onChange={(e) =>
								setForm((f) => ({ ...f, supportEndsAt: e.target.value }))
							}
							type="date"
							value={form.supportEndsAt}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="asset-planned-replacement">Planned replacement</Label>
						<Input
							id="asset-planned-replacement"
							onChange={(e) =>
								setForm((f) => ({
									...f,
									plannedReplacementAt: e.target.value,
								}))
							}
							type="date"
							value={form.plannedReplacementAt}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="asset-last-verified">Last verified</Label>
						<Input
							id="asset-last-verified"
							onChange={(e) =>
								setForm((f) => ({ ...f, lastVerifiedAt: e.target.value }))
							}
							type="date"
							value={form.lastVerifiedAt}
						/>
					</div>
				</div>
			</fieldset>
		</>
	);
}
