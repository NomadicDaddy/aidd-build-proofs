#!/usr/bin/env bun
/**
 * Shared utilities for template drift detection and upgrade scripts.
 *
 * Extracted from check-template-drift.ts so both the drift checker and
 * upgrade script can reuse the same classification, normalization, and
 * comparison logic without duplication.
 */
import fs from 'node:fs';
import path from 'node:path';

import { loadJsonConfig } from './load-json-config.js';

// ===== TYPES =====

export interface ClassificationOverrides {
	branded: string[];
	infrastructure: string[];
}

export type DriftCategory = 'branded' | 'infrastructure' | 'pure';

export type TemplateOverrideAction = 'DELETED' | 'KEEP' | 'SKIP';

export interface TemplateOverrides {
	deleted: Map<string, string>;
	keep: Map<string, string>;
	skip: Map<string, string>;
}

export interface FileResult {
	category: DriftCategory;
	filePath: string;
	status: 'drifted' | 'identical' | 'missing-in-app' | 'missing-in-template' | 'suppressed';
	/** When status === 'suppressed', records why and which override action applied */
	suppression?: { action: TemplateOverrideAction; reason: string };
}

export interface BrandingValues {
	backendPort: string;
	description: string;
	frontendPort: string;
	name: string;
	slug: string;
}

// ===== CONSTANTS =====

// Template defaults (the values in the spernakit template before setup.ts runs)
export const TEMPLATE_BRANDING: BrandingValues = {
	backendPort: '3331',
	description: 'Spernakit v3 - Self-Hosted Multi-User Application Template',
	frontendPort: '3330',
	name: 'Spernakit v3',
	slug: 'spernakit',
};

// Directories to exclude from drift checking (must match spernakit_init.ps1 + drift-specific)
// From spernakit_init.ps1:
const INIT_EXCLUDED_DIRS = [
	'.git/',
	'.aidd/',
	'.claude/',
	'.windsurf/',
	'data/',
	'internal/',
	'logs/',
	'node_modules/',
	'dist/',
];

// Additional exclusions for drift detection (generated/app-specific content):
const DRIFT_EXCLUDED_DIRS = [
	'backups/',
	'config/', // generated per-app by setup.ts
	'docs/', // app-specific docs excluded (docs/template/ re-included in isFileExcluded)
	'drizzle/', // migration state diverges
	'backend/drizzle/', // migration state diverges
	'frontend/public/', // app-specific icons
	'screenshots/', // app-specific
];

const EXCLUDED_DIRS = [...INIT_EXCLUDED_DIRS, ...DRIFT_EXCLUDED_DIRS];

// File patterns to exclude from drift checking (must match spernakit_init.ps1)
const EXCLUDED_PATTERNS = [
	/\.db$/,
	/\.db-journal$/,
	/\.db-wal$/,
	/\.lock$/,
	/\.lockb$/,
	/^spernakit\.json$/,
	/^smoke-cache\.json$/,
];

// ===== HELPERS =====

export function resolveSpernakitPath(
	explicit: string | undefined,
	repoRoot: string
): null | string {
	// 1. Explicit CLI arg
	if (explicit) {
		const resolved = path.resolve(explicit);
		if (fs.existsSync(path.join(resolved, '.git'))) return resolved;
		console.log(`   Warning: --template path is not a git repo: ${resolved}`);
		return null;
	}

	// 2. Environment variable
	const envPath = process.env['SPERNAKIT_PATH'];
	if (envPath) {
		const resolved = path.resolve(envPath);
		if (fs.existsSync(path.join(resolved, '.git'))) return resolved;
		console.log(`   Warning: SPERNAKIT_PATH is not a git repo: ${resolved}`);
		return null;
	}

	// 3. Convention: sibling directory
	const sibling = path.resolve(path.join(repoRoot, '..', 'spernakit'));
	if (fs.existsSync(path.join(sibling, '.git'))) return sibling;

	console.log('   Warning: spernakit repo not found at ../spernakit');
	console.log('   Use --template /path/to/spernakit or set SPERNAKIT_PATH');
	return null;
}

export function readSpernakitVersion(repoRoot: string): null | string {
	const pkgPath = path.join(repoRoot, 'package.json');
	try {
		const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as Record<string, unknown>;
		const version = pkg['spernakit_version'] as string | undefined;
		if (version) return version;

		// If this is spernakit itself, there's no spernakit_version field
		const name = pkg['name'] as string | undefined;
		if (name === 'spernakit') return null;

		console.log('   Warning: No spernakit_version field in package.json');
		return null;
	} catch {
		console.log('   Warning: Could not read package.json');
		return null;
	}
}

export function isSpernakitItself(repoRoot: string): boolean {
	const pkgPath = path.join(repoRoot, 'package.json');
	try {
		const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as Record<string, unknown>;
		return pkg['name'] === 'spernakit';
	} catch {
		return false;
	}
}

export function gitTagExists(spernakitPath: string, version: string): boolean {
	const result = Bun.spawnSync(['git', '-C', spernakitPath, 'rev-parse', `v${version}`], {
		stderr: 'pipe',
		stdout: 'pipe',
	});
	return result.exitCode === 0;
}

export function getTemplateFileAtVersion(
	spernakitPath: string,
	version: string,
	filePath: string
): null | string {
	const result = Bun.spawnSync(['git', '-C', spernakitPath, 'show', `v${version}:${filePath}`], {
		stderr: 'pipe',
		stdout: 'pipe',
	});
	if (result.exitCode !== 0) return null;
	return result.stdout.toString();
}

export function readLocalFile(repoRoot: string, filePath: string): null | string {
	const fullPath = path.join(repoRoot, filePath);
	try {
		return fs.readFileSync(fullPath, 'utf8');
	} catch {
		return null;
	}
}

export function normalizeLineEndings(content: string): string {
	return content.replace(/\r\n/g, '\n');
}

export function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ===== BRANDING NORMALIZATION =====

function normalizePackageJson(
	content: string,
	_values: BrandingValues,
	_isTemplate: boolean,
	_filePath: string
): string {
	try {
		const pkg = JSON.parse(content) as Record<string, unknown>;

		// Normalize branded fields to placeholders
		pkg['name'] = '{{SLUG}}';
		pkg['description'] = '{{DESCRIPTION}}';

		// Remove spernakit_version for comparison (only in derived apps, tracks template version)
		delete pkg['spernakit_version'];

		// Remove version for comparison (app version diverges from template)
		delete pkg['version'];

		// Remove GitHub metadata for comparison (may or may not be present after setup)
		delete pkg['bugs'];
		delete pkg['homepage'];
		delete pkg['repository'];

		if (pkg['scripts'] && typeof pkg['scripts'] === 'object') {
			const scripts = pkg['scripts'] as Record<string, string>;
			if (scripts['docker:image:build']) {
				scripts['docker:image:build'] =
					'docker build -t ghcr.io/nomadicdaddy/{{SLUG}}:latest .';
			}
			if (scripts['docker:image:push']) {
				scripts['docker:image:push'] = 'docker push ghcr.io/nomadicdaddy/{{SLUG}}:latest';
			}
		}

		return JSON.stringify(pkg, null, '\t');
	} catch {
		return content;
	}
}

function normalizeDefaultsJson(
	content: string,
	_values: BrandingValues,
	_isTemplate: boolean
): string {
	try {
		const config = JSON.parse(content) as Record<string, unknown>;

		// Normalize app section
		if (config['app'] && typeof config['app'] === 'object') {
			const app = config['app'] as Record<string, unknown>;
			app['slug'] = '{{SLUG}}';
			app['name'] = '{{NAME}}';
			app['description'] = '{{DESCRIPTION}}';
		}

		// Normalize server section
		if (config['server'] && typeof config['server'] === 'object') {
			const server = config['server'] as Record<string, unknown>;
			server['frontendPort'] = '{{FRONTEND_PORT}}';
			server['backendPort'] = '{{BACKEND_PORT}}';
			server['frontendUrl'] = 'http://localhost:{{FRONTEND_PORT}}';
			server['backendUrl'] = 'http://localhost:{{BACKEND_PORT}}';
		}

		// Normalize security section (cookie names)
		if (config['security'] && typeof config['security'] === 'object') {
			const security = config['security'] as Record<string, unknown>;
			security['authCookieName'] = '{{SLUG}}_auth';
			security['csrfCookieName'] = '{{SLUG}}_csrf';
			security['refreshCookieName'] = '{{SLUG}}_refresh';
		}

		// Normalize cors section (dev origins use frontend port)
		if (config['cors'] && typeof config['cors'] === 'object') {
			const cors = config['cors'] as Record<string, unknown>;
			cors['frontendDevOrigins'] = ['http://localhost:{{FRONTEND_PORT}}'];
		}

		// Normalize database section
		if (config['database'] && typeof config['database'] === 'object') {
			const database = config['database'] as Record<string, unknown>;
			database['url'] = 'file:./data/{{SLUG}}.db';
		}

		return JSON.stringify(config, null, '\t');
	} catch {
		return content;
	}
}

function normalizeReadme(content: string, values: BrandingValues, isTemplate: boolean): string {
	let result = content;

	// Normalize heading
	if (isTemplate) {
		result = result.replace(/^# Spernakit v3/gm, '# {{NAME}}');
	} else {
		result = result.replace(new RegExp(`^# ${escapeRegex(values.name)}`, 'gm'), '# {{NAME}}');
	}

	// Normalize config file references - handle template placeholders, template slug, and app slug
	result = result.replace(/config\/\{appname\}\.json/g, 'config/{{SLUG}}.json');
	result = result.replace(/config\/spernakit\.json/g, 'config/{{SLUG}}.json');
	result = result.replace(
		new RegExp(`config\\/${escapeRegex(values.slug)}\\.json`, 'g'),
		'config/{{SLUG}}.json'
	);

	// Normalize directory references - handle both template slug and app slug
	result = result.replace(/spernakit\//g, '{{SLUG}}/');
	result = result.replace(new RegExp(`${escapeRegex(values.slug)}\\/`, 'g'), '{{SLUG}}/');

	// Normalize description line
	if (isTemplate) {
		result = result.replace(/Spernakit v3 is a/gm, '{{NAME}} is a');
	} else {
		result = result.replace(
			new RegExp(`${escapeRegex(values.name)} is a`, 'gm'),
			'{{NAME}} is a'
		);
	}

	// Normalize port references in README
	result = result.replace(
		new RegExp(`localhost:${escapeRegex(values.backendPort)}`, 'g'),
		'localhost:{{BACKEND_PORT}}'
	);
	result = result.replace(
		new RegExp(`localhost:${escapeRegex(values.frontendPort)}`, 'g'),
		'localhost:{{FRONTEND_PORT}}'
	);
	result = result.replace(
		new RegExp(`default: ${escapeRegex(values.backendPort)}`, 'g'),
		'default: {{BACKEND_PORT}}'
	);
	result = result.replace(
		new RegExp(`default: ${escapeRegex(values.frontendPort)}`, 'g'),
		'default: {{FRONTEND_PORT}}'
	);

	// Normalize sub-README heading variants (backend/README.md, frontend/README.md)
	if (isTemplate) {
		result = result.replace(/# Backend - Spernakit v3/g, '# Backend - {{NAME}}');
		result = result.replace(/# Frontend - Spernakit v3/g, '# Frontend - {{NAME}}');
		result = result.replace(
			/The Elysia-based REST API backend for Spernakit v3/g,
			'The Elysia-based REST API backend for {{NAME}}'
		);
		result = result.replace(
			/The React-based frontend application for Spernakit v3/g,
			'The React-based frontend application for {{NAME}}'
		);
	} else {
		result = result.replace(
			new RegExp(`# Backend - ${escapeRegex(values.name)}`, 'g'),
			'# Backend - {{NAME}}'
		);
		result = result.replace(
			new RegExp(`# Frontend - ${escapeRegex(values.name)}`, 'g'),
			'# Frontend - {{NAME}}'
		);
		result = result.replace(
			new RegExp(`The Elysia-based REST API backend for ${escapeRegex(values.name)}`, 'g'),
			'The Elysia-based REST API backend for {{NAME}}'
		);
		result = result.replace(
			new RegExp(`The React-based frontend application for ${escapeRegex(values.name)}`, 'g'),
			'The React-based frontend application for {{NAME}}'
		);
	}

	return result;
}

function normalizeSettingsSmtp(
	content: string,
	values: BrandingValues,
	isTemplate: boolean
): string {
	if (isTemplate) {
		return content.replace(/Spernakit v3/g, '{{NAME}}');
	}
	return content.replace(new RegExp(escapeRegex(values.name), 'g'), '{{NAME}}');
}

function normalizeIndexHtml(content: string, values: BrandingValues, isTemplate: boolean): string {
	let result = normalizeLineEndings(content);

	// Collapse whitespace within HTML tags for consistent comparison
	// Template has multi-line formatting, derived apps may have single-line
	// Match content between < and > and normalize whitespace
	result = result.replace(/<([^>]+)>/g, (_match, inner) => {
		// Collapse multiple whitespace to single space
		return `<${inner.replace(/\s+/g, ' ').trim()}>`;
	});

	// Normalize keywords meta tag (app-specific content, not structural)
	result = result.replace(
		/<meta content="[^"]*" name="keywords" ?\/?>/g,
		'<meta content="{{KEYWORDS}}" name="keywords" />'
	);

	// Normalize meta description - template has "Spernakit v3 - Self-Hosted Multi-User Application Template"
	// and derived apps have "AppName - AppDescription" format
	result = result.replace(
		/Spernakit v3 - Self-Hosted Multi-User Application Template/g,
		'{{NAME}} - {{DESCRIPTION}}'
	);

	// Normalize og/twitter description - template has "Self-Hosted Multi-User Application Template"
	// (without prefix). This is different from meta description and gets replaced separately by
	// setup.ts
	result = result.replace(/Self-Hosted Multi-User Application Template/g, '{{DESCRIPTION}}');

	// Normalize author - template has "Spernakit", apps have app name
	result = result.replace(/"Spernakit"/g, '"{{NAME}}"');
	result = result.replace(new RegExp(`"${escapeRegex(values.name)}"`, 'g'), '"{{NAME}}"');

	// Normalize app name references
	if (isTemplate) {
		result = result.replace(/"Spernakit v3"/g, '"{{NAME}}"');
		result = result.replace(/>Spernakit v3</g, '>{{NAME}}<');
		result = result.replace(/Spernakit v3/g, '{{NAME}}');
	} else {
		result = result.replace(new RegExp(`"${escapeRegex(values.name)}"`, 'g'), '"{{NAME}}"');
		result = result.replace(new RegExp(`>${escapeRegex(values.name)}<`, 'g'), '>{{NAME}}<');
		result = result.replace(new RegExp(escapeRegex(values.name), 'g'), '{{NAME}}');
	}

	// Normalize description - both template's long description and app's short description
	result = result.replace(new RegExp(escapeRegex(values.description), 'g'), '{{DESCRIPTION}}');

	return result;
}

export function normalizeBranding(
	content: string,
	values: BrandingValues,
	filePath: string
): string {
	const isTemplate = values.slug === 'spernakit';

	// Handle JSON files with structured normalization
	if (
		filePath === 'package.json' ||
		filePath === 'backend/package.json' ||
		filePath === 'frontend/package.json'
	) {
		return normalizePackageJson(content, values, isTemplate, filePath);
	}

	if (filePath === 'backend/src/config/defaults.json') {
		return normalizeDefaultsJson(content, values, isTemplate);
	}

	// Handle README
	if (
		filePath === 'README.md' ||
		filePath === 'backend/README.md' ||
		filePath === 'frontend/README.md'
	) {
		return normalizeReadme(content, values, isTemplate);
	}

	// Handle health test (slug assertion)
	if (filePath === 'backend/src/test/health.test.ts') {
		return normalizeLineEndings(content).replace(
			new RegExp(`\\.toBe\\('${escapeRegex(values.slug)}'\\)`, 'g'),
			".toBe('{{SLUG}}')"
		);
	}

	// Handle settings-smtp.ts
	if (filePath === 'backend/src/routes/settings-smtp.ts') {
		return normalizeSettingsSmtp(content, values, isTemplate);
	}

	// Handle index.html with specific patterns
	if (filePath === 'frontend/index.html') {
		return normalizeIndexHtml(content, values, isTemplate);
	}

	// Default text-based normalization for docker files
	let result = normalizeLineEndings(content);

	// Replace specific values with placeholders (longer/more specific patterns first)
	result = result.replace(new RegExp(escapeRegex(values.description), 'g'), '{{DESCRIPTION}}');

	// Slug replacements BEFORE generic name — when name === slug, generic name replacement
	// would consume slug values in slug-specific contexts (service names, container names)
	result = result.replace(
		new RegExp(`container_name: ${escapeRegex(values.slug)}`, 'g'),
		'container_name: {{SLUG}}'
	);
	result = result.replace(
		new RegExp(`APP_SLUG:-${escapeRegex(values.slug)}`, 'g'),
		'APP_SLUG:-{{SLUG}}'
	);
	result = result.replace(new RegExp(`^(\\s+)${escapeRegex(values.slug)}:`, 'gm'), '$1{{SLUG}}:');

	// Generic name replacement (after slug-specific patterns to avoid overlap)
	result = result.replace(new RegExp(escapeRegex(values.name), 'g'), '{{NAME}}');

	// Port replacements — only in known contexts to avoid false positives
	result = result.replace(
		new RegExp(`EXPOSE ${escapeRegex(values.frontendPort)}`, 'g'),
		'EXPOSE {{FRONTEND_PORT}}'
	);
	result = result.replace(
		new RegExp(`localhost:${escapeRegex(values.frontendPort)}`, 'g'),
		'localhost:{{FRONTEND_PORT}}'
	);
	// Docker port mapping: 127.0.0.1:HOST_PORT:CONTAINER_PORT (must come before simpler pattern)
	result = result.replace(
		new RegExp(
			`127\\.0\\.0\\.1:${escapeRegex(values.frontendPort)}:${escapeRegex(values.frontendPort)}`,
			'g'
		),
		'127.0.0.1:{{FRONTEND_PORT}}:{{FRONTEND_PORT}}'
	);
	result = result.replace(
		new RegExp(`127\\.0\\.0\\.1:${escapeRegex(values.frontendPort)}`, 'g'),
		'127.0.0.1:{{FRONTEND_PORT}}'
	);
	result = result.replace(
		new RegExp(
			`'${escapeRegex(values.frontendPort)}:${escapeRegex(values.frontendPort)}'`,
			'g'
		),
		"'{{FRONTEND_PORT}}:{{FRONTEND_PORT}}'"
	);
	result = result.replace(
		new RegExp(`FRONTEND_PORT[=:-]+${escapeRegex(values.frontendPort)}`, 'g'),
		(match) => match.replace(values.frontendPort, '{{FRONTEND_PORT}}')
	);
	result = result.replace(
		new RegExp(`BACKEND_PORT[=:-]+${escapeRegex(values.backendPort)}`, 'g'),
		(match) => match.replace(values.backendPort, '{{BACKEND_PORT}}')
	);
	// Port in Dockerfile comment: "falls back to NNNN" pattern
	result = result.replace(
		new RegExp(`falls back to ${escapeRegex(values.frontendPort)}`, 'g'),
		'falls back to {{FRONTEND_PORT}}'
	);

	return result;
}

// ===== FILE CLASSIFICATION =====

export function isFileExcluded(filePath: string): boolean {
	// docs/template/ is template-managed and must NOT be excluded even though docs/ is
	if (filePath.startsWith('docs/template/')) return false;

	// Check directory exclusions
	for (const dir of EXCLUDED_DIRS) {
		if (filePath.startsWith(dir)) return true;
	}
	// Check file pattern exclusions
	for (const pattern of EXCLUDED_PATTERNS) {
		if (pattern.test(filePath)) return true;
	}
	return false;
}

export function enumerateTemplateFiles(spernakitPath: string, version: string): string[] {
	const result = Bun.spawnSync(
		['git', '-C', spernakitPath, 'ls-tree', '--name-only', '-r', `v${version}`],
		{ stderr: 'pipe', stdout: 'pipe' }
	);

	if (result.exitCode !== 0) {
		console.log(`   Warning: git ls-tree failed for v${version}`);
		return [];
	}

	const allFiles = result.stdout.toString().trim().split('\n').filter(Boolean);
	return allFiles.filter((f) => !isFileExcluded(f));
}

export function loadClassificationOverrides(
	spernakitPath: string,
	version: string
): { overrides: ClassificationOverrides; source: 'filesystem' | 'git' } | null {
	// Check filesystem first - prefer new format (has $comment) over git tag
	const fsPath = path.join(spernakitPath, 'scripts', 'template-manifest.json');
	try {
		const fsContent = fs.readFileSync(fsPath, 'utf8');
		const parsed = JSON.parse(fsContent) as Record<string, unknown>;
		// If filesystem has new format ($comment field), prefer it
		if ('$comment' in parsed) {
			const overrides: ClassificationOverrides = {
				branded: Array.isArray(parsed['branded']) ? (parsed['branded'] as string[]) : [],
				infrastructure: Array.isArray(parsed['infrastructure'])
					? (parsed['infrastructure'] as string[])
					: [],
			};
			return { overrides, source: 'filesystem' };
		}
	} catch {
		// Fall through to git
	}

	// Fallback: load from git tag
	const gitContent = getTemplateFileAtVersion(
		spernakitPath,
		version,
		'scripts/template-manifest.json'
	);
	if (gitContent) {
		try {
			const parsed = JSON.parse(gitContent) as Record<string, unknown>;
			const overrides: ClassificationOverrides = {
				branded: Array.isArray(parsed['branded']) ? (parsed['branded'] as string[]) : [],
				infrastructure: Array.isArray(parsed['infrastructure'])
					? (parsed['infrastructure'] as string[])
					: [],
			};
			return { overrides, source: 'git' };
		} catch {
			return null;
		}
	}

	return null;
}

export function classifyFile(filePath: string, overrides: ClassificationOverrides): DriftCategory {
	if (overrides.branded.includes(filePath)) return 'branded';
	if (overrides.infrastructure.includes(filePath)) return 'infrastructure';
	return 'pure';
}

export function loadAppBrandingValues(repoRoot: string): BrandingValues | null {
	try {
		const { appSlug, config } = loadJsonConfig(repoRoot);
		return {
			backendPort: String(config.server?.backendPort ?? '3331'),
			description: config.app?.description ?? '',
			frontendPort: String(config.server?.frontendPort ?? '3330'),
			name: config.app?.name ?? '',
			slug: appSlug,
		};
	} catch {
		return null;
	}
}

// ===== TEMPLATE OVERRIDES =====

const VALID_OVERRIDE_ACTIONS = new Set<TemplateOverrideAction>(['DELETED', 'KEEP', 'SKIP']);

/**
 * Parse the app's `.templateoverrides` file (if present) into action maps.
 *
 * File format (line-based):
 *   # comment
 *   ACTION  PATH  [# REASON]
 *
 * Where ACTION is one of: DELETED, SKIP, KEEP.
 *   - SKIP / KEEP: drift detection treats this file as 'suppressed' instead of 'drifted'
 *   - DELETED:     drift detection treats a missing-in-app file as 'suppressed' instead of 'missing'
 *
 * Returns empty maps if the file is absent, blank, or unparseable.
 */
export function loadTemplateOverrides(repoRoot: string): TemplateOverrides {
	const overrides: TemplateOverrides = {
		deleted: new Map(),
		keep: new Map(),
		skip: new Map(),
	};
	const filePath = path.join(repoRoot, '.templateoverrides');
	let content: string;
	try {
		content = fs.readFileSync(filePath, 'utf8');
	} catch {
		return overrides;
	}

	const lines = content.split(/\r?\n/);
	for (let i = 0; i < lines.length; i++) {
		const raw = lines[i];
		if (!raw) continue;
		const line = raw.trim();
		if (line.length === 0 || line.startsWith('#')) continue;

		// Split into action + rest, then peel off optional inline `# reason`
		const firstSpace = line.search(/\s/);
		if (firstSpace === -1) {
			console.log(
				`   Warning: .templateoverrides line ${i + 1} is missing a path: "${line}"`
			);
			continue;
		}
		const action = line.slice(0, firstSpace).toUpperCase() as TemplateOverrideAction;
		if (!VALID_OVERRIDE_ACTIONS.has(action)) {
			console.log(
				`   Warning: .templateoverrides line ${i + 1} has unknown action "${action}" (expected DELETED, SKIP, or KEEP)`
			);
			continue;
		}
		const rest = line.slice(firstSpace).trim();
		const reasonStart = rest.indexOf('#');
		const filePathPart = (reasonStart === -1 ? rest : rest.slice(0, reasonStart)).trim();
		const reason = reasonStart === -1 ? '' : rest.slice(reasonStart + 1).trim();
		if (filePathPart.length === 0) {
			console.log(
				`   Warning: .templateoverrides line ${i + 1} has an empty path after action "${action}"`
			);
			continue;
		}

		// Normalise to forward-slash paths so it matches enumerateTemplateFiles output
		const normalisedPath = filePathPart.replace(/\\/g, '/');
		const target =
			action === 'DELETED'
				? overrides.deleted
				: action === 'KEEP'
					? overrides.keep
					: overrides.skip;
		target.set(normalisedPath, reason);
	}

	return overrides;
}

/**
 * Apply `.templateoverrides` to a list of file results, converting drifted
 * SKIP/KEEP entries and missing DELETED entries to status 'suppressed'.
 */
export function applyTemplateOverrides(
	results: FileResult[],
	overrides: TemplateOverrides
): FileResult[] {
	return results.map((r) => {
		if (r.status === 'drifted') {
			const skipReason = overrides.skip.get(r.filePath);
			if (skipReason !== undefined) {
				return {
					...r,
					status: 'suppressed',
					suppression: { action: 'SKIP', reason: skipReason },
				};
			}
			const keepReason = overrides.keep.get(r.filePath);
			if (keepReason !== undefined) {
				return {
					...r,
					status: 'suppressed',
					suppression: { action: 'KEEP', reason: keepReason },
				};
			}
		}
		if (r.status === 'missing-in-app') {
			const deletedReason = overrides.deleted.get(r.filePath);
			if (deletedReason !== undefined) {
				return {
					...r,
					status: 'suppressed',
					suppression: { action: 'DELETED', reason: deletedReason },
				};
			}
		}
		return r;
	});
}

// ===== DRIFT CHECKING =====

export function checkFile(
	spernakitPath: string,
	version: string,
	filePath: string,
	category: DriftCategory,
	appBranding: BrandingValues | null,
	repoRoot: string
): FileResult {
	const templateContent = getTemplateFileAtVersion(spernakitPath, version, filePath);
	const localContent = readLocalFile(repoRoot, filePath);

	if (!templateContent) {
		return { category, filePath, status: 'missing-in-template' };
	}

	if (!localContent) {
		return { category, filePath, status: 'missing-in-app' };
	}

	if (category === 'branded' && appBranding) {
		const normalizedTemplate = normalizeBranding(templateContent, TEMPLATE_BRANDING, filePath);
		const normalizedLocal = normalizeBranding(localContent, appBranding, filePath);
		return {
			category,
			filePath,
			status: normalizedTemplate === normalizedLocal ? 'identical' : 'drifted',
		};
	}

	// Pure and infrastructure: direct content comparison after line ending normalization
	const normalizedTemplate = normalizeLineEndings(templateContent);
	const normalizedLocal = normalizeLineEndings(localContent);

	return {
		category,
		filePath,
		status: normalizedTemplate === normalizedLocal ? 'identical' : 'drifted',
	};
}
