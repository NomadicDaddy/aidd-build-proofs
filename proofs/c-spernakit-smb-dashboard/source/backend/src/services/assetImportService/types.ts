import { type importRows, type imports } from '../../db/schema/assetImports.ts';

type ImportRow = typeof importRows.$inferSelect;
type ImportBatch = typeof imports.$inferSelect;

/** Asset fields an import row may map from a CSV column. */
interface ImportedAssetFields {
	assetTag?: null | string;
	assetType?: string;
	criticality?: string;
	description?: null | string;
	documentationUrl?: null | string;
	fqdn?: null | string;
	hostname?: null | string;
	managementUrl?: null | string;
	name?: string;
	notes?: null | string;
	operatingSystem?: null | string;
	osVersion?: null | string;
	platform?: null | string;
	primaryIp?: null | string;
	role?: null | string;
	serialNumber?: null | string;
	status?: string;
	supportContact?: null | string;
}

interface ImportWithRows {
	import: ImportBatch;
	rows: ImportRow[];
}

export type { ImportBatch, ImportedAssetFields, ImportRow, ImportWithRows };
