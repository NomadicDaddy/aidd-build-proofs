import { and, eq, inArray, or } from 'drizzle-orm';

import type { UserRole } from '../../types/roles.ts';
import type { AssetSearchResult, GlobalSearchResults, ServiceSearchResult } from './types.ts';

import { getDb } from '../../db/index.ts';
import { assetNetworkInterfaces } from '../../db/schema/assetProfiles.ts';
import { assetAliases, assets, assetTags } from '../../db/schema/assets.ts';
import { owners } from '../../db/schema/infrastructure.ts';
import { assetPorts, serviceCatalog } from '../../db/schema/services.ts';
import { escapeLikePattern, likeEscaped } from '../../utils/dbHelpers.ts';
import { canViewSensitiveAssetFields } from '../assetVisibility.ts';
import {
	addMatch,
	clampLimit,
	contains,
	PER_SOURCE_SCAN_LIMIT,
	PUBLIC_ASSET_FIELDS,
	SENSITIVE_ASSET_FIELDS,
} from './helpers.ts';

/**
 * Cross-domain search across assets and services and their related records
 * (aliases, tags, network interfaces, ports, owners). Returns typed, grouped
 * results; each result carries the labels of the fields that matched so the UI
 * can explain *why* a record surfaced.
 *
 * Role enforcement: sensitive asset fields (notes, management URL, support
 * contact) and owner contact emails are only searched when the caller's
 * effective role permits it, so restricted content is not discoverable by
 * low-privilege viewers.
 *
 * @param rawTerm - The user-supplied search term
 * @param role - The caller's effective (DB-verified) role, or null
 * @param requestedLimit - Desired max results per group (clamped 1..50)
 * @returns Grouped asset and service results with match context
 */
function globalSearch(
	rawTerm: string,
	role: null | UserRole,
	requestedLimit?: number
): GlobalSearchResults {
	const limit = clampLimit(requestedLimit);
	const term = rawTerm.trim();
	if (term.length === 0) {
		return { assets: [], limit, query: rawTerm, services: [], totalCount: 0 };
	}

	const db = getDb();
	const termLower = term.toLowerCase();
	const pattern = `%${escapeLikePattern(term)}%`;
	const canSensitive = canViewSensitiveAssetFields(role);
	const numericTerm = /^\d+$/.test(term) ? Number(term) : null;

	const assetFieldDefs = canSensitive
		? [...PUBLIC_ASSET_FIELDS, ...SENSITIVE_ASSET_FIELDS]
		: PUBLIC_ASSET_FIELDS;

	// Accumulates, per asset id, the set of labels the term matched on.
	const assetMatches = new Map<number, Set<string>>();
	// Full rows for directly-matched (non-deleted) assets, keyed by id.
	const directRows = new Map<number, typeof assets.$inferSelect>();

	// 1. Direct asset column matches. Select the full row so we can compute which
	//    field(s) matched (including sensitive ones) without extra round-trips.
	const directConditions = assetFieldDefs.map(([column]) => likeEscaped(assets[column], pattern));
	const directAssets = db
		.select()
		.from(assets)
		.where(and(eq(assets.isDeleted, false), or(...directConditions)!))
		.limit(PER_SOURCE_SCAN_LIMIT)
		.all();
	for (const row of directAssets) {
		directRows.set(row.id, row);
		for (const [column, label] of assetFieldDefs) {
			if (contains(row[column], termLower)) addMatch(assetMatches, row.id, label);
		}
	}

	// 2. Alias matches → owning asset.
	for (const row of db
		.select({ assetId: assetAliases.assetId })
		.from(assetAliases)
		.where(likeEscaped(assetAliases.value, pattern))
		.limit(PER_SOURCE_SCAN_LIMIT)
		.all()) {
		addMatch(assetMatches, row.assetId, 'alias');
	}

	// 3. Tag matches → owning asset.
	for (const row of db
		.select({ assetId: assetTags.assetId })
		.from(assetTags)
		.where(likeEscaped(assetTags.label, pattern))
		.limit(PER_SOURCE_SCAN_LIMIT)
		.all()) {
		addMatch(assetMatches, row.assetId, 'tag');
	}

	// 4. Network interface matches (IP / MAC / DNS / interface name) → owning asset.
	for (const row of db
		.select({
			assetId: assetNetworkInterfaces.assetId,
			dnsName: assetNetworkInterfaces.dnsName,
			ipAddress: assetNetworkInterfaces.ipAddress,
			macAddress: assetNetworkInterfaces.macAddress,
			name: assetNetworkInterfaces.name,
		})
		.from(assetNetworkInterfaces)
		.where(
			or(
				likeEscaped(assetNetworkInterfaces.ipAddress, pattern),
				likeEscaped(assetNetworkInterfaces.macAddress, pattern),
				likeEscaped(assetNetworkInterfaces.dnsName, pattern),
				likeEscaped(assetNetworkInterfaces.name, pattern)
			)!
		)
		.limit(PER_SOURCE_SCAN_LIMIT)
		.all()) {
		if (contains(row.ipAddress, termLower)) addMatch(assetMatches, row.assetId, 'IP');
		if (contains(row.macAddress, termLower)) addMatch(assetMatches, row.assetId, 'MAC');
		if (contains(row.dnsName, termLower)) addMatch(assetMatches, row.assetId, 'DNS');
		if (contains(row.name, termLower)) addMatch(assetMatches, row.assetId, 'interface');
	}

	// 5. Port matches (documented service name, or exact port number) → owning asset.
	const portConditions = [likeEscaped(assetPorts.serviceName, pattern)];
	if (numericTerm !== null) {
		portConditions.push(eq(assetPorts.portNumber, numericTerm));
	}
	for (const row of db
		.select({
			assetId: assetPorts.assetId,
			portNumber: assetPorts.portNumber,
			serviceName: assetPorts.serviceName,
		})
		.from(assetPorts)
		.where(or(...portConditions)!)
		.limit(PER_SOURCE_SCAN_LIMIT)
		.all()) {
		if (contains(row.serviceName, termLower))
			addMatch(assetMatches, row.assetId, 'port service');
		if (numericTerm !== null && row.portNumber === numericTerm) {
			addMatch(assetMatches, row.assetId, 'port');
		}
	}

	// 6. Owner matches → assets they own + services they own. Owner email is
	//    contact data, only searched for OPERATOR+ callers.
	const ownerConditions = [likeEscaped(owners.name, pattern)];
	if (canSensitive) {
		ownerConditions.push(likeEscaped(owners.email, pattern));
	}
	const ownerIds = db
		.select({ id: owners.id })
		.from(owners)
		.where(and(eq(owners.isDeleted, false), or(...ownerConditions)!))
		.limit(PER_SOURCE_SCAN_LIMIT)
		.all()
		.map((r) => r.id);
	if (ownerIds.length > 0) {
		for (const row of db
			.select({ id: assets.id })
			.from(assets)
			.where(
				and(
					eq(assets.isDeleted, false),
					or(
						inArray(assets.businessOwnerId, ownerIds),
						inArray(assets.technicalOwnerId, ownerIds)
					)!
				)
			)
			.limit(PER_SOURCE_SCAN_LIMIT)
			.all()) {
			addMatch(assetMatches, row.id, 'owner');
		}
	}

	// Load display data for related-only asset ids (those not already in directRows),
	// filtering out soft-deleted assets so hidden records never surface.
	const relatedOnlyIds = [...assetMatches.keys()].filter((id) => !directRows.has(id));
	const relatedRows = new Map<number, typeof assets.$inferSelect>();
	if (relatedOnlyIds.length > 0) {
		for (const row of db
			.select()
			.from(assets)
			.where(and(eq(assets.isDeleted, false), inArray(assets.id, relatedOnlyIds)))
			.all()) {
			relatedRows.set(row.id, row);
		}
	}

	// Assemble the asset group. Direct rows first (strongest signal), then
	// related-only matches, each sorted by name.
	const assetResults: AssetSearchResult[] = [];
	const toResult = (row: typeof assets.$inferSelect): AssetSearchResult => ({
		assetType: row.assetType,
		criticality: row.criticality,
		hostname: row.hostname,
		id: row.id,
		matchedFields: [...(assetMatches.get(row.id) ?? new Set<string>())],
		name: row.name,
		primaryIp: row.primaryIp,
		status: row.status,
		type: 'asset',
	});
	const byName = (a: { name: string }, b: { name: string }): number =>
		a.name.localeCompare(b.name);
	const directResults = [...directRows.values()].sort(byName).map(toResult);
	const relatedResults = [...relatedRows.values()].sort(byName).map(toResult);
	assetResults.push(...directResults, ...relatedResults);

	// 7. Service matches: name / category / description for everyone; notes for
	//    OPERATOR+ only. Owner-name matches also surface owned services.
	const serviceMatches = new Map<number, Set<string>>();
	const serviceRows = new Map<number, typeof serviceCatalog.$inferSelect>();
	const serviceFieldDefs: [keyof typeof serviceCatalog.$inferSelect, string][] = [
		['name', 'name'],
		['category', 'category'],
		['description', 'description'],
	];
	if (canSensitive) serviceFieldDefs.push(['notes', 'notes']);

	const serviceConditions = serviceFieldDefs.map(([column]) =>
		likeEscaped(serviceCatalog[column], pattern)
	);
	for (const row of db
		.select()
		.from(serviceCatalog)
		.where(and(eq(serviceCatalog.isDeleted, false), or(...serviceConditions)!))
		.limit(PER_SOURCE_SCAN_LIMIT)
		.all()) {
		serviceRows.set(row.id, row);
		for (const [column, label] of serviceFieldDefs) {
			if (contains(row[column], termLower)) addMatch(serviceMatches, row.id, label);
		}
	}

	if (ownerIds.length > 0) {
		const ownedServices = db
			.select()
			.from(serviceCatalog)
			.where(
				and(eq(serviceCatalog.isDeleted, false), inArray(serviceCatalog.ownerId, ownerIds))
			)
			.limit(PER_SOURCE_SCAN_LIMIT)
			.all();
		for (const row of ownedServices) {
			if (!serviceRows.has(row.id)) serviceRows.set(row.id, row);
			addMatch(serviceMatches, row.id, 'owner');
		}
	}

	const serviceResults: ServiceSearchResult[] = [...serviceRows.values()]
		.sort(byName)
		.map((row) => ({
			category: row.category,
			criticality: row.criticality,
			id: row.id,
			matchedFields: [...(serviceMatches.get(row.id) ?? new Set<string>())],
			name: row.name,
			type: 'service',
		}));

	const cappedAssets = assetResults.slice(0, limit);
	const cappedServices = serviceResults.slice(0, limit);

	return {
		assets: cappedAssets,
		limit,
		query: rawTerm,
		services: cappedServices,
		totalCount: cappedAssets.length + cappedServices.length,
	};
}

export { globalSearch };
