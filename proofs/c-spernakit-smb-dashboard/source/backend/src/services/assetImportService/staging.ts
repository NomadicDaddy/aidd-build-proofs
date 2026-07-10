import { and, eq, or, sql } from 'drizzle-orm';
import {
	ASSET_STATUSES,
	ASSET_TYPES,
	CRITICALITY_LEVELS,
	type ImportRowStatus,
} from 'spernakit-shared';

import type { ImportedAssetFields } from './types.ts';

import { getDb } from '../../db/index.ts';
import { assets } from '../../db/schema/assets.ts';
import { missingRequiredAssetFields } from '../infrastructureSettingsService.ts';

/**
 * Map of accepted CSV header aliases (lower-cased, non-alphanumeric stripped) to
 * the canonical asset field. Lets an operator use `asset_type`, `AssetType`, or
 * `type` interchangeably.
 */
const HEADER_ALIASES: Record<string, keyof ImportedAssetFields> = {
	assettag: 'assetTag',
	assettype: 'assetType',
	criticality: 'criticality',
	description: 'description',
	documentationlink: 'documentationUrl',
	documentationurl: 'documentationUrl',
	fqdn: 'fqdn',
	hostname: 'hostname',
	ip: 'primaryIp',
	ipaddress: 'primaryIp',
	managementurl: 'managementUrl',
	name: 'name',
	notes: 'notes',
	operatingsystem: 'operatingSystem',
	os: 'operatingSystem',
	osversion: 'osVersion',
	platform: 'platform',
	primaryip: 'primaryIp',
	role: 'role',
	serial: 'serialNumber',
	serialnumber: 'serialNumber',
	status: 'status',
	supportcontact: 'supportContact',
	type: 'assetType',
};

/** Dedup identity fields checked against existing active assets. */
const DUPLICATE_KEYS = ['hostname', 'fqdn', 'primaryIp', 'serialNumber', 'assetTag'] as const;

const ASSET_TYPE_SET = new Set<string>(ASSET_TYPES);
const ASSET_STATUS_SET = new Set<string>(ASSET_STATUSES);
const CRITICALITY_SET = new Set<string>(CRITICALITY_LEVELS);

/**
 * Normalize a header cell to its alias key: lower-case, alphanumeric only.
 *
 * @param header - Raw CSV header cell
 * @returns The normalized alias key
 */
function normalizeHeader(header: string): string {
	return header.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Map a raw CSV record (header -> cell) onto asset fields using the header
 * aliases. Blank cells are skipped so they neither set nor clear a value.
 *
 * @param record - The raw header/value object for one row
 * @returns The mapped asset fields
 */
function mapRowToAssetFields(record: Record<string, string>): ImportedAssetFields {
	const fields: ImportedAssetFields = {};
	for (const [header, rawValue] of Object.entries(record)) {
		const key = HEADER_ALIASES[normalizeHeader(header)];
		if (!key) continue;
		const value = rawValue.trim();
		if (value.length === 0) continue;
		(fields as Record<string, unknown>)[key] = value;
	}
	return fields;
}

/**
 * Validate a mapped row and return blocking error messages (empty when valid).
 * Blocking errors prevent the row from ever being applied.
 *
 * @param fields - Mapped asset fields for the row
 * @returns Human-readable blocking-error messages
 */
function validationErrors(fields: ImportedAssetFields): string[] {
	const errors: string[] = [];
	if (!fields.name || fields.name.trim().length === 0) {
		errors.push('Missing required field: name');
	}
	if (!fields.assetType) {
		errors.push('Missing required field: assetType');
	} else if (!ASSET_TYPE_SET.has(fields.assetType)) {
		errors.push(`Invalid assetType: "${fields.assetType}"`);
	}
	if (fields.status && !ASSET_STATUS_SET.has(fields.status)) {
		errors.push(`Invalid status: "${fields.status}"`);
	}
	if (fields.criticality && !CRITICALITY_SET.has(fields.criticality)) {
		errors.push(`Invalid criticality: "${fields.criticality}"`);
	}
	return errors;
}

/**
 * Find an existing active asset that matches the row on any dedup identity
 * (hostname, FQDN, IP, serial number, asset tag) or on an exact name match.
 * Comparison is case-insensitive.
 *
 * @param fields - Mapped asset fields for the row
 * @returns The matched asset id and the field that matched, or null
 */
function findDuplicate(fields: ImportedAssetFields): { assetId: number; matchedOn: string } | null {
	const db = getDb();
	const conditions = [];
	for (const key of DUPLICATE_KEYS) {
		const value = fields[key];
		if (typeof value === 'string' && value.trim().length > 0) {
			conditions.push(eq(sql`lower(${assets[key]})`, value.trim().toLowerCase()));
		}
	}
	if (fields.name && fields.name.trim().length > 0) {
		conditions.push(eq(sql`lower(${assets.name})`, fields.name.trim().toLowerCase()));
	}
	if (conditions.length === 0) return null;

	const match = db
		.select({
			assetTag: assets.assetTag,
			fqdn: assets.fqdn,
			hostname: assets.hostname,
			id: assets.id,
			name: assets.name,
			primaryIp: assets.primaryIp,
			serialNumber: assets.serialNumber,
		})
		.from(assets)
		.where(and(eq(assets.isDeleted, false), or(...conditions)))
		.get();
	if (!match) return null;

	const matchedOn =
		DUPLICATE_KEYS.find((key) => {
			const rowValue = fields[key];
			const existing = (match as Record<string, unknown>)[key];
			return (
				typeof rowValue === 'string' &&
				typeof existing === 'string' &&
				rowValue.trim().toLowerCase() === existing.toLowerCase()
			);
		}) ?? 'name';
	return { assetId: match.id, matchedOn };
}

interface StagedRow {
	message: null | string;
	parsedData: Record<string, unknown>;
	rawData: Record<string, string>;
	rowNumber: number;
	status: ImportRowStatus;
	targetAssetId: null | number;
}

/**
 * Build a staged row for one CSV data record: validate, then dedup.
 *
 * @param record - The raw header/value object for one row
 * @param rowNumber - 1-based source row number
 * @returns The staged row (parsed fields, disposition, message, target)
 */
function stageRow(record: Record<string, string>, rowNumber: number): StagedRow {
	const fields = mapRowToAssetFields(record);
	const errors = validationErrors(fields);
	const messages = [...errors];

	if (errors.length > 0) {
		return {
			message: messages.join('; '),
			parsedData: fields as Record<string, unknown>,
			rawData: record,
			rowNumber,
			status: 'needs_review',
			targetAssetId: null,
		};
	}

	// Surface missing admin-required fields as a non-blocking warning: the row is
	// still applicable, but the operator is told what documentation is absent.
	const missing = missingRequiredAssetFields(fields as Record<string, unknown>);
	if (missing.length > 0) {
		messages.push(`Missing recommended field(s): ${missing.join(', ')}`);
	}

	const duplicate = findDuplicate(fields);
	if (duplicate) {
		messages.push(`Matches existing asset #${duplicate.assetId} on ${duplicate.matchedOn}`);
		return {
			message: messages.join('; '),
			parsedData: fields as Record<string, unknown>,
			rawData: record,
			rowNumber,
			status: 'duplicate',
			targetAssetId: duplicate.assetId,
		};
	}

	return {
		message: messages.length > 0 ? messages.join('; ') : null,
		parsedData: fields as Record<string, unknown>,
		rawData: record,
		rowNumber,
		status: 'pending',
		targetAssetId: null,
	};
}

export type { StagedRow };
export { stageRow };
