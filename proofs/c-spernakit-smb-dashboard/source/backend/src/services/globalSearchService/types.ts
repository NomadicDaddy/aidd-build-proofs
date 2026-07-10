/** A single asset hit, with the human-readable fields the term matched on. */
interface AssetSearchResult {
	assetType: string;
	criticality: string;
	hostname: null | string;
	id: number;
	/** Distinct labels describing where the term matched (e.g. "name", "IP", "alias"). */
	matchedFields: string[];
	name: string;
	primaryIp: null | string;
	status: string;
	type: 'asset';
}

/** A single service hit, with the fields the term matched on. */
interface ServiceSearchResult {
	category: null | string;
	criticality: string;
	id: number;
	matchedFields: string[];
	name: string;
	type: 'service';
}

/** Typed, grouped global-search payload. */
interface GlobalSearchResults {
	assets: AssetSearchResult[];
	limit: number;
	query: string;
	services: ServiceSearchResult[];
	totalCount: number;
}

export type { AssetSearchResult, GlobalSearchResults, ServiceSearchResult };
