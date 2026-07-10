import {
	PORT_EXPOSURE_LEVELS,
	PORT_PROTOCOLS,
	PORT_REVIEW_STATES,
	PORT_SOURCES,
	type PortExposureLevel,
	type PortProtocol,
	type PortReviewState,
	type PortSource,
} from 'spernakit-shared';

import type { Service } from '@/api/services';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

import type { PortForm } from './portFormModel.ts';

import { portExposureLabel, portReviewLabel, portSourceLabel } from './portDisplay.ts';
import { NO_SERVICE } from './portFormModel.ts';

interface PortDialogFieldsProps {
	form: PortForm;
	serviceOptions: Service[];
	set: <K extends keyof PortForm>(key: K) => (value: PortForm[K]) => void;
}

/** The editable field body of the port create/edit form. */
export function PortDialogFields({ form, serviceOptions, set }: PortDialogFieldsProps) {
	return (
		<>
			<section className="space-y-3">
				<h3 className="text-sm font-semibold">Port &amp; service</h3>
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div className="space-y-2">
						<Label htmlFor="port-number">Port number</Label>
						<Input
							autoComplete="off"
							id="port-number"
							max={65535}
							min={0}
							onChange={(e) => set('portNumber')(e.target.value)}
							placeholder="e.g. 443"
							type="number"
							value={form.portNumber}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="port-protocol">Protocol</Label>
						<Select
							onValueChange={(value) => set('protocol')(value as PortProtocol)}
							value={form.protocol}>
							<SelectTrigger id="port-protocol">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{PORT_PROTOCOLS.map((protocol) => (
									<SelectItem key={protocol} value={protocol}>
										{protocol.toUpperCase()}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-2">
						<Label htmlFor="port-service-name">Service name</Label>
						<Input
							autoComplete="off"
							id="port-service-name"
							onChange={(e) => set('serviceName')(e.target.value)}
							placeholder="e.g. https, ssh"
							value={form.serviceName}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="port-service">Catalog service</Label>
						<Select
							onValueChange={(value) =>
								set('serviceId')(value === NO_SERVICE ? '' : value)
							}
							value={form.serviceId === '' ? NO_SERVICE : form.serviceId}>
							<SelectTrigger id="port-service">
								<SelectValue placeholder="None" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NO_SERVICE}>None</SelectItem>
								{serviceOptions.map((service) => (
									<SelectItem key={service.id} value={String(service.id)}>
										{service.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>
			</section>

			<section className="space-y-3">
				<h3 className="text-sm font-semibold">Exposure &amp; review</h3>
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div className="space-y-2">
						<Label htmlFor="port-exposure">Exposure level</Label>
						<Select
							onValueChange={(value) =>
								set('exposureLevel')(value as PortExposureLevel)
							}
							value={form.exposureLevel}>
							<SelectTrigger id="port-exposure">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{PORT_EXPOSURE_LEVELS.map((level) => (
									<SelectItem key={level} value={level}>
										{portExposureLabel(level)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-2">
						<Label htmlFor="port-review">Review state</Label>
						<Select
							onValueChange={(value) => set('reviewState')(value as PortReviewState)}
							value={form.reviewState}>
							<SelectTrigger id="port-review">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{PORT_REVIEW_STATES.map((state) => (
									<SelectItem key={state} value={state}>
										{portReviewLabel(state)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-2">
						<Label htmlFor="port-source">Source</Label>
						<Select
							onValueChange={(value) => set('source')(value as PortSource)}
							value={form.source}>
							<SelectTrigger id="port-source">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{PORT_SOURCES.map((source) => (
									<SelectItem key={source} value={source}>
										{portSourceLabel(source)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-2">
						<Label htmlFor="port-verified">Last verified</Label>
						<Input
							id="port-verified"
							onChange={(e) => set('verifiedAt')(e.target.value)}
							type="date"
							value={form.verifiedAt}
						/>
					</div>
					<div className="space-y-2 sm:col-span-2">
						<Label htmlFor="port-scope">Scope</Label>
						<Input
							autoComplete="off"
							id="port-scope"
							onChange={(e) => set('scope')(e.target.value)}
							placeholder="e.g. 10.0.0.0/8, any"
							value={form.scope}
						/>
					</div>
				</div>
			</section>

			<section className="space-y-2">
				<Label htmlFor="port-notes">Notes</Label>
				<Textarea
					id="port-notes"
					onChange={(e) => set('notes')(e.target.value)}
					placeholder="Why is this port open, and which service owns it?"
					rows={2}
					value={form.notes}
				/>
			</section>
		</>
	);
}
