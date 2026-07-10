/**
 * SMB Infrastructure Dashboard domain enums.
 *
 * The const arrays are the runtime source of truth; the literal union types are
 * derived from them so the list and type cannot drift. These constants are the
 * single source consumed by the Drizzle schema enums (SQLite + PostgreSQL), the
 * TypeBox route schemas, and the frontend API types.
 *
 * Add a new value by appending to the relevant array and generating a migration.
 */

/** Every infrastructure item type the inventory tracks. Mirrors spec "Required asset types". */
const ASSET_TYPES = [
	'physical_server',
	'virtual_machine',
	'hypervisor_host',
	'storage_appliance',
	'storage_volume',
	'network_device',
	'firewall_router',
	'application_endpoint',
	'business_service',
	'backup_target',
	'other',
] as const;

type AssetType = (typeof ASSET_TYPES)[number];

/** Lifecycle state of an asset. */
const ASSET_STATUSES = [
	'active',
	'planned',
	'maintenance',
	'decommissioned',
	'retired',
	'unknown',
] as const;

type AssetStatus = (typeof ASSET_STATUSES)[number];

/** Business-impact rating shared by assets and services. */
const CRITICALITY_LEVELS = ['critical', 'high', 'medium', 'low', 'unknown'] as const;

type CriticalityLevel = (typeof CRITICALITY_LEVELS)[number];

/** Alternate-identity kinds tracked in asset_aliases. */
const ASSET_ALIAS_TYPES = ['hostname', 'fqdn', 'ip', 'serial', 'asset_tag', 'other'] as const;

type AssetAliasType = (typeof ASSET_ALIAS_TYPES)[number];

/** Directed relationship types between two assets. Mirrors spec "Required relationship types". */
const ASSET_RELATIONSHIP_TYPES = [
	'runs_on',
	'hosts',
	'depends_on',
	'provides_service',
	'connects_to',
	'stores_on',
	'backs_up_to',
	'part_of',
	'owned_by',
] as const;

type AssetRelationshipType = (typeof ASSET_RELATIONSHIP_TYPES)[number];

/** How trustworthy a relationship record is. */
const RELATIONSHIP_CONFIDENCE_LEVELS = ['confirmed', 'likely', 'assumed', 'unverified'] as const;

type RelationshipConfidenceLevel = (typeof RELATIONSHIP_CONFIDENCE_LEVELS)[number];

/** Ownership record kinds. */
const OWNER_KINDS = ['person', 'team', 'vendor'] as const;

type OwnerKind = (typeof OWNER_KINDS)[number];

/** Transport protocol for a documented or observed port. */
const PORT_PROTOCOLS = ['tcp', 'udp', 'icmp', 'other'] as const;

type PortProtocol = (typeof PORT_PROTOCOLS)[number];

/** Network exposure level of a port. */
const PORT_EXPOSURE_LEVELS = ['internal', 'dmz', 'internet', 'unknown'] as const;

type PortExposureLevel = (typeof PORT_EXPOSURE_LEVELS)[number];

/** Where a port record originated — human documentation vs imported scan observation. */
const PORT_SOURCES = ['documented', 'observed', 'imported'] as const;

type PortSource = (typeof PORT_SOURCES)[number];

/** Operator review disposition for a port. */
const PORT_REVIEW_STATES = [
	'expected',
	'unexpected',
	'ignored',
	'historical',
	'needs_review',
] as const;

type PortReviewState = (typeof PORT_REVIEW_STATES)[number];

/** What a staged import targets. */
const IMPORT_KINDS = ['assets', 'services', 'ports', 'relationships'] as const;

type ImportKind = (typeof IMPORT_KINDS)[number];

/** Lifecycle of a staged import batch. */
const IMPORT_STATUSES = ['pending', 'reviewing', 'applied', 'partial', 'rejected'] as const;

type ImportStatus = (typeof IMPORT_STATUSES)[number];

/** Per-row disposition inside a staged import. */
const IMPORT_ROW_STATUSES = [
	'pending',
	'accepted',
	'rejected',
	'needs_review',
	'duplicate',
] as const;

type ImportRowStatus = (typeof IMPORT_ROW_STATUSES)[number];

/**
 * Documentation-completeness gap signals surfaced on the dashboard and drillable
 * as filterable asset list views. Each names one way an asset's documentation can
 * be incomplete. Mirrors spec "Show documentation health".
 */
const DOCUMENTATION_HEALTH_SIGNALS = [
	'stale',
	'missingOwner',
	'missingBackup',
	'missingRelationshipMap',
	'missingServiceRole',
	'unverifiedPorts',
] as const;

type DocumentationHealthSignal = (typeof DOCUMENTATION_HEALTH_SIGNALS)[number];

/** Default stale-data threshold in days when none is configured or requested. */
const DEFAULT_STALE_THRESHOLD_DAYS = 90;

/** Bounds for a caller-supplied stale-data threshold (days). */
const MIN_STALE_THRESHOLD_DAYS = 1;
const MAX_STALE_THRESHOLD_DAYS = 3650;

/**
 * Asset fields an administrator may mark mandatory for manual asset entry.
 *
 * `name` and `assetType` are always required by the create schema and are
 * therefore intentionally excluded. Lifecycle date fields and free-form notes
 * are excluded as they rarely make sense as day-one required documentation.
 * The order here is the display order used by the admin settings UI.
 */
const REQUIRABLE_ASSET_FIELDS = [
	'hostname',
	'fqdn',
	'primaryIp',
	'serialNumber',
	'assetTag',
	'operatingSystem',
	'osVersion',
	'platform',
	'role',
	'description',
	'criticality',
	'siteId',
	'networkZoneId',
	'businessOwnerId',
	'technicalOwnerId',
	'vendorId',
	'managementUrl',
	'documentationUrl',
	'supportContact',
] as const;

type RequirableAssetField = (typeof REQUIRABLE_ASSET_FIELDS)[number];

/**
 * How a staged import reconciles a row that matches an existing record.
 * Consumed by the import-behavior admin setting and the staged-import flow.
 */
const IMPORT_DUPLICATE_STRATEGIES = ['skip', 'review', 'update'] as const;

type ImportDuplicateStrategy = (typeof IMPORT_DUPLICATE_STRATEGIES)[number];

/** Auditable actions recorded in asset_change_events. */
const CHANGE_EVENT_ACTIONS = [
	'create',
	'update',
	'delete',
	'restore',
	'archive',
	'import',
] as const;

type ChangeEventAction = (typeof CHANGE_EVENT_ACTIONS)[number];

/**
 * Inventory filter keys that a saved view may persist. These correspond to the
 * URL-synced filter parameters on the asset inventory page. The backend uses
 * this list to reject unknown keys before storing a view's filter map, and the
 * frontend uses it to serialise the current inventory filters when saving.
 */
const SAVED_VIEW_FILTER_KEYS = [
	'search',
	'type',
	'status',
	'criticality',
	'protocol',
	'exposureLevel',
	'reviewState',
	'portNumber',
	'serviceId',
] as const;

type SavedViewFilterKey = (typeof SAVED_VIEW_FILTER_KEYS)[number];

/** Maximum saved views a single user may keep per workspace. */
const MAX_SAVED_VIEWS_PER_USER = 50;

/** Maximum length of a saved view name. */
const SAVED_VIEW_NAME_MAX_LENGTH = 80;

export {
	ASSET_ALIAS_TYPES,
	ASSET_RELATIONSHIP_TYPES,
	ASSET_STATUSES,
	ASSET_TYPES,
	CHANGE_EVENT_ACTIONS,
	CRITICALITY_LEVELS,
	DEFAULT_STALE_THRESHOLD_DAYS,
	DOCUMENTATION_HEALTH_SIGNALS,
	IMPORT_DUPLICATE_STRATEGIES,
	IMPORT_KINDS,
	IMPORT_ROW_STATUSES,
	IMPORT_STATUSES,
	MAX_SAVED_VIEWS_PER_USER,
	MAX_STALE_THRESHOLD_DAYS,
	MIN_STALE_THRESHOLD_DAYS,
	OWNER_KINDS,
	REQUIRABLE_ASSET_FIELDS,
	PORT_EXPOSURE_LEVELS,
	PORT_PROTOCOLS,
	PORT_REVIEW_STATES,
	PORT_SOURCES,
	RELATIONSHIP_CONFIDENCE_LEVELS,
	SAVED_VIEW_FILTER_KEYS,
	SAVED_VIEW_NAME_MAX_LENGTH,
};
export type {
	AssetAliasType,
	AssetRelationshipType,
	AssetStatus,
	AssetType,
	ChangeEventAction,
	CriticalityLevel,
	DocumentationHealthSignal,
	ImportDuplicateStrategy,
	ImportKind,
	ImportRowStatus,
	ImportStatus,
	OwnerKind,
	RequirableAssetField,
	PortExposureLevel,
	PortProtocol,
	PortReviewState,
	PortSource,
	RelationshipConfidenceLevel,
	SavedViewFilterKey,
};
