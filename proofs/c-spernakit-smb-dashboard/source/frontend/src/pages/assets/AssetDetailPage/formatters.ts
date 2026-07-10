/** HTTP status returned when an asset id does not resolve to a record. */
export const HTTP_STATUS_NOT_FOUND = 404;

/** Format an ISO timestamp for display, or an em dash when absent. */
export function formatDate(value: null | string): string {
	if (!value) return '—';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return '—';
	return date.toLocaleDateString(undefined, {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
	});
}

/** Format a foreign-key reference id as a readable token, or an em dash when absent. */
export function formatRef(label: string, id: null | number): string {
	return id === null ? '—' : `${label} #${id}`;
}

/** Number of megabytes in a gigabyte, used to annotate RAM figures. */
const MB_PER_GB = 1024;

/** Format an integer count with thousands separators, or an em dash when absent. */
export function formatCount(value: null | number): string {
	return value === null || value === undefined ? '—' : value.toLocaleString();
}

/** Format a MB memory figure as "65,536 MB (64 GB)", or an em dash when absent. */
export function formatMemory(mb: null | number): string {
	if (mb === null || mb === undefined) return '—';
	const gb = mb / MB_PER_GB;
	const gbLabel = Number.isInteger(gb) ? String(gb) : gb.toFixed(1);
	return `${mb.toLocaleString()} MB (${gbLabel} GB)`;
}

/** Format a GB storage figure as "2,048 GB", or an em dash when absent. */
export function formatStorage(gb: null | number): string {
	return gb === null || gb === undefined ? '—' : `${gb.toLocaleString()} GB`;
}

/** Format a VLAN id as a token, or an em dash when absent. */
export function formatVlan(value: null | number): string {
	return value === null || value === undefined ? '—' : `VLAN ${value}`;
}

/** Compute a "1,200 / 2,048 GB (59%)" usage string, degrading when data is partial. */
export function formatUsage(capacityGb: null | number, usedGb: null | number): string {
	if (usedGb === null || usedGb === undefined) return '—';
	if (capacityGb === null || capacityGb === undefined)
		return `${usedGb.toLocaleString()} GB used`;
	const pct = capacityGb > 0 ? Math.round((usedGb / capacityGb) * 100) : 0;
	return `${usedGb.toLocaleString()} / ${capacityGb.toLocaleString()} GB (${pct}%)`;
}

/** Free capacity (total − used), floored at zero, or null when either figure is absent. */
export function freeCapacityGb(capacityGb: null | number, usedGb: null | number): null | number {
	if (capacityGb === null || capacityGb === undefined) return null;
	if (usedGb === null || usedGb === undefined) return capacityGb;
	return Math.max(0, capacityGb - usedGb);
}
