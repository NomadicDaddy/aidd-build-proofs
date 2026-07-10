import type { TSchema } from '@sinclair/typebox';

import { t } from 'elysia';
import {
	ASSET_STATUSES,
	ASSET_TYPES,
	CRITICALITY_LEVELS,
	PORT_EXPOSURE_LEVELS,
	PORT_PROTOCOLS,
	PORT_REVIEW_STATES,
	PORT_SOURCES,
} from 'spernakit-shared';

import type { AuthPayload } from '../../plugins/auth.ts';
import type { ErrorResponse } from '../../utils/errorResponse.ts';

import { HTTP_STATUS } from '../../constants/httpStatus.ts';
import { FIELD_LENGTH_MEDIUM, FIELD_LENGTH_SHORT } from '../../constants/validation.ts';
import { resolveWorkspaceScope } from '../../guards/workspaceScope.ts';
import { getAssetById } from '../../services/assetService.ts';
import { notFoundError } from '../../utils/errorResponse.ts';
import { isValidDateString } from '../../utils/validation.ts';

/**
 * Verify the parent asset exists and is visible within the caller's workspace
 * scope before a nested sub-resource (ports, storage, interfaces, service
 * assignments, hardware) is read or written. Returns a 404 error envelope when
 * the asset is missing or belongs to another workspace — the two are made
 * indistinguishable so a workspace boundary is never leaked. Returns undefined
 * (soft-deleted assets included) when the caller may proceed. A no-op boundary
 * check when workspace scoping is disabled or the caller is a cross-workspace
 * SYSOP.
 *
 * @param assetId - The parent asset id from the route path
 * @param user - The authenticated user payload
 * @param workspaceId - The active workspace from the X-Workspace-ID header
 * @param set - Elysia response context (mutated to set the status code)
 * @returns A not-found error response, or undefined when the asset is visible
 */
export function assertAssetVisible(
	assetId: number,
	user: AuthPayload | null,
	workspaceId: null | number,
	set: { status?: number | string }
): ErrorResponse | undefined {
	const asset = getAssetById(assetId, true, resolveWorkspaceScope(user, workspaceId));
	if (!asset) {
		set.status = HTTP_STATUS.NOT_FOUND;
		return notFoundError('Asset');
	}
	return undefined;
}

export const ASSET_TYPE_SCHEMA = t.Union(ASSET_TYPES.map((v) => t.Literal(v)));
export const ASSET_STATUS_SCHEMA = t.Union(ASSET_STATUSES.map((v) => t.Literal(v)));
export const CRITICALITY_SCHEMA = t.Union(CRITICALITY_LEVELS.map((v) => t.Literal(v)));

const NAME = t.String({ maxLength: FIELD_LENGTH_MEDIUM, minLength: 1 });
const SHORT_TEXT = t.String({ maxLength: FIELD_LENGTH_MEDIUM });
const LONG_TEXT = t.String({ maxLength: 5000 });
const URL_TEXT = t.String({ format: 'uri', maxLength: 2048 });
const DATE_STRING = t.String({ maxLength: 50 });
const nullable = <T extends TSchema>(schema: T) => t.Optional(t.Union([schema, t.Null()]));

/** Lifecycle timestamp fields validated as ISO 8601 strings on write. */
const LIFECYCLE_DATE_FIELDS = [
	'purchaseDate',
	'warrantyExpiresAt',
	'supportEndsAt',
	'plannedReplacementAt',
	'decommissionedAt',
	'lastVerifiedAt',
] as const;

/**
 * Return the first lifecycle date field whose value is a non-ISO string, or
 * null when every provided date is valid (or omitted/cleared to null).
 */
export function firstInvalidLifecycleDate(body: Record<string, unknown>): null | string {
	for (const field of LIFECYCLE_DATE_FIELDS) {
		const value = body[field];
		if (typeof value === 'string' && !isValidDateString(value)) return field;
	}
	return null;
}

/** Writable fields shared by create (required name/type) and update (all optional). */
const writableFields = {
	assetTag: nullable(t.String({ maxLength: FIELD_LENGTH_SHORT })),
	businessOwnerId: nullable(t.Integer({ minimum: 1 })),
	criticality: t.Optional(CRITICALITY_SCHEMA),
	decommissionedAt: nullable(DATE_STRING),
	description: nullable(LONG_TEXT),
	documentationUrl: nullable(URL_TEXT),
	fqdn: nullable(SHORT_TEXT),
	hostname: nullable(SHORT_TEXT),
	isVirtual: t.Optional(t.Boolean()),
	lastVerifiedAt: nullable(DATE_STRING),
	managementUrl: nullable(URL_TEXT),
	networkZoneId: nullable(t.Integer({ minimum: 1 })),
	notes: nullable(LONG_TEXT),
	operatingSystem: nullable(SHORT_TEXT),
	osVersion: nullable(SHORT_TEXT),
	parentHostId: nullable(t.Integer({ minimum: 1 })),
	plannedReplacementAt: nullable(DATE_STRING),
	platform: nullable(SHORT_TEXT),
	primaryIp: nullable(t.String({ maxLength: 45 })),
	purchaseDate: nullable(DATE_STRING),
	role: nullable(SHORT_TEXT),
	serialNumber: nullable(t.String({ maxLength: FIELD_LENGTH_SHORT })),
	siteId: nullable(t.Integer({ minimum: 1 })),
	status: t.Optional(ASSET_STATUS_SCHEMA),
	supportContact: nullable(SHORT_TEXT),
	supportEndsAt: nullable(DATE_STRING),
	technicalOwnerId: nullable(t.Integer({ minimum: 1 })),
	vendorId: nullable(t.Integer({ minimum: 1 })),
	warrantyExpiresAt: nullable(DATE_STRING),
};

/** Bounds for hardware-profile integer fields (CPU counts, RAM MB, storage GB). */
const COUNT_INT = t.Integer({ maximum: 100000000, minimum: 0 });

/** Writable fields for an asset's one-to-one hardware profile (all optional). */
export const hardwareProfileBody = t.Object({
	chassisModel: nullable(SHORT_TEXT),
	clusterName: nullable(SHORT_TEXT),
	cpuCores: nullable(COUNT_INT),
	cpuModel: nullable(SHORT_TEXT),
	cpuSockets: nullable(COUNT_INT),
	cpuThreads: nullable(COUNT_INT),
	formFactor: nullable(SHORT_TEXT),
	guestOs: nullable(SHORT_TEXT),
	hardwareModel: nullable(SHORT_TEXT),
	hostRole: nullable(SHORT_TEXT),
	hypervisor: nullable(SHORT_TEXT),
	notes: nullable(LONG_TEXT),
	ramMb: nullable(COUNT_INT),
	snapshotNotes: nullable(LONG_TEXT),
	totalStorageGb: nullable(COUNT_INT),
	vcpuCount: nullable(COUNT_INT),
	vmToolsStatus: nullable(SHORT_TEXT),
});

/** VLAN id bounds per IEEE 802.1Q (0 = untagged/none, 4094 = max usable). */
const VLAN_INT = t.Integer({ maximum: 4094, minimum: 0 });

/** Writable fields for an asset network interface (all optional). */
export const networkInterfaceBody = t.Object({
	dnsName: nullable(SHORT_TEXT),
	gateway: nullable(t.String({ maxLength: 45 })),
	ipAddress: nullable(t.String({ maxLength: 45 })),
	isPrimary: t.Optional(t.Boolean()),
	macAddress: nullable(t.String({ maxLength: FIELD_LENGTH_SHORT })),
	name: nullable(SHORT_TEXT),
	networkZoneId: nullable(t.Integer({ minimum: 1 })),
	notes: nullable(LONG_TEXT),
	subnetMask: nullable(t.String({ maxLength: 45 })),
	vlanId: nullable(VLAN_INT),
});

export const interfaceParams = t.Object({
	id: t.Numeric({ minimum: 1 }),
	interfaceId: t.Numeric({ minimum: 1 }),
});

/** Writable fields for an asset storage allocation (all optional). */
export const storageAllocationBody = t.Object({
	capacityGb: nullable(COUNT_INT),
	mountPoint: nullable(SHORT_TEXT),
	name: nullable(SHORT_TEXT),
	notes: nullable(LONG_TEXT),
	storagePoolAssetId: nullable(t.Integer({ minimum: 1 })),
	storageType: nullable(SHORT_TEXT),
	usedGb: nullable(COUNT_INT),
});

export const allocationParams = t.Object({
	allocationId: t.Numeric({ minimum: 1 }),
	id: t.Numeric({ minimum: 1 }),
});

/** Body for creating a service assignment — the target service id is required. */
export const createAssignmentBody = t.Object({
	isPrimary: t.Optional(t.Boolean()),
	notes: nullable(LONG_TEXT),
	role: nullable(SHORT_TEXT),
	serviceId: t.Integer({ minimum: 1 }),
});

/** Body for updating a service assignment — the target service cannot change. */
export const updateAssignmentBody = t.Object({
	isPrimary: t.Optional(t.Boolean()),
	notes: nullable(LONG_TEXT),
	role: nullable(SHORT_TEXT),
});

export const assignmentParams = t.Object({
	assignmentId: t.Numeric({ minimum: 1 }),
	id: t.Numeric({ minimum: 1 }),
});

export const PORT_PROTOCOL_SCHEMA = t.Union(PORT_PROTOCOLS.map((v) => t.Literal(v)));
export const PORT_EXPOSURE_SCHEMA = t.Union(PORT_EXPOSURE_LEVELS.map((v) => t.Literal(v)));
export const PORT_SOURCE_SCHEMA = t.Union(PORT_SOURCES.map((v) => t.Literal(v)));
export const PORT_REVIEW_SCHEMA = t.Union(PORT_REVIEW_STATES.map((v) => t.Literal(v)));

/** Valid TCP/UDP port range plus 0 for protocols without a port (e.g. ICMP). */
const PORT_NUMBER = t.Integer({ maximum: 65535, minimum: 0 });

/** Writable port fields shared by create (portNumber required) and update. */
const portWritableFields = {
	exposureLevel: t.Optional(PORT_EXPOSURE_SCHEMA),
	notes: nullable(LONG_TEXT),
	protocol: t.Optional(PORT_PROTOCOL_SCHEMA),
	reviewState: t.Optional(PORT_REVIEW_SCHEMA),
	scope: nullable(SHORT_TEXT),
	serviceId: nullable(t.Integer({ minimum: 1 })),
	serviceName: nullable(SHORT_TEXT),
	source: t.Optional(PORT_SOURCE_SCHEMA),
	verifiedAt: nullable(DATE_STRING),
};

export const createPortBody = t.Object({ ...portWritableFields, portNumber: PORT_NUMBER });
export const updatePortBody = t.Object({
	...portWritableFields,
	portNumber: t.Optional(PORT_NUMBER),
});

export const portParams = t.Object({
	id: t.Numeric({ minimum: 1 }),
	portId: t.Numeric({ minimum: 1 }),
});

export const createAssetBody = t.Object({
	...writableFields,
	assetType: ASSET_TYPE_SCHEMA,
	name: NAME,
});

export const updateAssetBody = t.Object({
	...writableFields,
	assetType: t.Optional(ASSET_TYPE_SCHEMA),
	name: t.Optional(NAME),
});

export const idParams = t.Object({ id: t.Numeric({ minimum: 1 }) });

export const EXAMPLE_ASSET = {
	assetType: 'physical_server',
	createdAt: '2026-07-03T12:00:00.000Z',
	criticality: 'high',
	hostname: 'dc01',
	id: 1,
	isDeleted: false,
	isVirtual: false,
	name: 'DC01 - Domain Controller',
	primaryIp: '10.0.0.10',
	siteId: 1,
	status: 'active',
};
