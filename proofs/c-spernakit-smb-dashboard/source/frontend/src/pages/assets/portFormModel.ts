import type {
	PortExposureLevel,
	PortProtocol,
	PortReviewState,
	PortSource,
} from 'spernakit-shared';

import type { AssetPort, PortInput } from '@/api/assets';

/** Upper bound on the service picker options; the catalog is small in practice. */
export const SERVICE_PICKER_LIMIT = 200;

/** Sentinel select value for "no catalog service attributed". */
export const NO_SERVICE = 'none';

/**
 * Local editable shape. Every field is a string so the inputs stay controlled;
 * the port number is parsed on submit and the catalog service id resolves from a
 * select. Empty text fields clear their nullable columns.
 */
export interface PortForm {
	exposureLevel: PortExposureLevel;
	notes: string;
	portNumber: string;
	protocol: PortProtocol;
	reviewState: PortReviewState;
	scope: string;
	serviceId: string;
	serviceName: string;
	source: PortSource;
	verifiedAt: string;
}

export const EMPTY_FORM: PortForm = {
	exposureLevel: 'unknown',
	notes: '',
	portNumber: '',
	protocol: 'tcp',
	reviewState: 'expected',
	scope: '',
	serviceId: '',
	serviceName: '',
	source: 'documented',
	verifiedAt: '',
};

/** Render a nullable value as a form string (numbers become their decimal text). */
function toField(value: null | number | string): string {
	if (value === null) return '';
	return String(value);
}

/** Convert an ISO timestamp to the YYYY-MM-DD value a date input expects. */
function toDateField(value: null | string): string {
	if (!value) return '';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return '';
	return date.toISOString().slice(0, 10);
}

export function portToForm(port: AssetPort): PortForm {
	return {
		exposureLevel: port.exposureLevel,
		notes: toField(port.notes),
		portNumber: String(port.portNumber),
		protocol: port.protocol,
		reviewState: port.reviewState,
		scope: toField(port.scope),
		serviceId: port.serviceId === null ? '' : String(port.serviceId),
		serviceName: toField(port.serviceName),
		source: port.source,
		verifiedAt: toDateField(port.verifiedAt),
	};
}

/** Trimmed text → `null` when empty. */
function orNull(value: string): null | string {
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

export function formToInput(form: PortForm): PortInput {
	return {
		exposureLevel: form.exposureLevel,
		notes: orNull(form.notes),
		portNumber: Math.trunc(Number(form.portNumber)),
		protocol: form.protocol,
		reviewState: form.reviewState,
		scope: orNull(form.scope),
		serviceId: form.serviceId === '' ? null : Number(form.serviceId),
		serviceName: orNull(form.serviceName),
		source: form.source,
		verifiedAt: form.verifiedAt === '' ? null : form.verifiedAt,
	};
}
