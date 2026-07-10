import type { HardwareProfile, HardwareProfileInput } from '@/api/assets';

/**
 * Local editable shape. Every field is a string so the inputs stay controlled;
 * numeric fields are parsed on submit. Empty strings clear the column.
 */
export interface ProfileForm {
	chassisModel: string;
	clusterName: string;
	cpuCores: string;
	cpuModel: string;
	cpuSockets: string;
	cpuThreads: string;
	formFactor: string;
	guestOs: string;
	hardwareModel: string;
	hostRole: string;
	hypervisor: string;
	notes: string;
	ramMb: string;
	snapshotNotes: string;
	totalStorageGb: string;
	vcpuCount: string;
	vmToolsStatus: string;
}

export const EMPTY_FORM: ProfileForm = {
	chassisModel: '',
	clusterName: '',
	cpuCores: '',
	cpuModel: '',
	cpuSockets: '',
	cpuThreads: '',
	formFactor: '',
	guestOs: '',
	hardwareModel: '',
	hostRole: '',
	hypervisor: '',
	notes: '',
	ramMb: '',
	snapshotNotes: '',
	totalStorageGb: '',
	vcpuCount: '',
	vmToolsStatus: '',
};

/** Render a nullable value as a form string (numbers become their decimal text). */
function toField(value: null | number | string): string {
	if (value === null) return '';
	return String(value);
}

export function profileToForm(profile: HardwareProfile): ProfileForm {
	return {
		chassisModel: toField(profile.chassisModel),
		clusterName: toField(profile.clusterName),
		cpuCores: toField(profile.cpuCores),
		cpuModel: toField(profile.cpuModel),
		cpuSockets: toField(profile.cpuSockets),
		cpuThreads: toField(profile.cpuThreads),
		formFactor: toField(profile.formFactor),
		guestOs: toField(profile.guestOs),
		hardwareModel: toField(profile.hardwareModel),
		hostRole: toField(profile.hostRole),
		hypervisor: toField(profile.hypervisor),
		notes: toField(profile.notes),
		ramMb: toField(profile.ramMb),
		snapshotNotes: toField(profile.snapshotNotes),
		totalStorageGb: toField(profile.totalStorageGb),
		vcpuCount: toField(profile.vcpuCount),
		vmToolsStatus: toField(profile.vmToolsStatus),
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

export function formToInput(form: ProfileForm): HardwareProfileInput {
	return {
		chassisModel: orNull(form.chassisModel),
		clusterName: orNull(form.clusterName),
		cpuCores: orNullInt(form.cpuCores),
		cpuModel: orNull(form.cpuModel),
		cpuSockets: orNullInt(form.cpuSockets),
		cpuThreads: orNullInt(form.cpuThreads),
		formFactor: orNull(form.formFactor),
		guestOs: orNull(form.guestOs),
		hardwareModel: orNull(form.hardwareModel),
		hostRole: orNull(form.hostRole),
		hypervisor: orNull(form.hypervisor),
		notes: orNull(form.notes),
		ramMb: orNullInt(form.ramMb),
		snapshotNotes: orNull(form.snapshotNotes),
		totalStorageGb: orNullInt(form.totalStorageGb),
		vcpuCount: orNullInt(form.vcpuCount),
		vmToolsStatus: orNull(form.vmToolsStatus),
	};
}
