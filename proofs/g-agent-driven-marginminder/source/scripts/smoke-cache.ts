/**
 * Smoke test caching system for spernakit.
 *
 * Provides fast change detection to skip unchanged QC steps by tracking
 * file hashes and execution results.
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

// ===== TYPE DEFINITIONS =====

interface StepDependencies {
	collector?: 'prettier';
	directoryGlobs?: string[];
	excludes: string[];
	globs: string[];
	outputs?: string[];
}

interface StepCacheEntry {
	duration: number;
	hash: string;
	lastRun: string;
	result: 'fail' | 'pass';
}

interface SmokeCache {
	lastRun: string;
	steps: Record<string, StepCacheEntry>;
	version: number;
}

interface CacheCheckResult {
	reason: string;
	skip: boolean;
}

interface CacheStatus {
	cached: boolean;
	lastResult: 'fail' | 'pass' | undefined;
	lastRun: string | undefined;
	reason: string;
	step: string;
}

// ===== CONSTANTS =====

const CACHE_VERSION = 1;
const CACHE_FILENAME = 'smoke-cache.json';

// ===== DEPENDENCY CONFIGURATIONS =====

const COMMON_EXCLUDES = [
	'**/node_modules/**',
	'**/dist/**',
	'.git/**',
	'logs/**',
	'backups/**',
	'artifacts/**',
	'.aidd/**',
	'.claude/**',
];

const PACKAGE_GLOBS = [
	'package.json',
	'bun.lock',
	'backend/package.json',
	'frontend/package.json',
	'shared/package.json',
];

const CONFIG_JSON_GLOBS = [
	'backend/src/config/**/*.json',
	'config/**/*.json',
	'config/**/*.json.example',
];

const CONFIG_SCHEMA_GLOBS = [
	'backend/src/config/**/*.ts',
	...CONFIG_JSON_GLOBS,
	'package.json',
	'scripts/load-json-config.ts',
];

const PRETTIER_CANDIDATE_GLOBS = [
	'**/*.css',
	'**/*.html',
	'**/*.js',
	'**/*.json',
	'**/*.jsx',
	'**/*.md',
	'**/*.toml',
	'**/*.ts',
	'**/*.tsx',
	'**/*.yaml',
	'**/*.yml',
];

const FORMAT_GLOBS = ['.prettierrc', '.prettierignore', ...PACKAGE_GLOBS];

const LINT_GLOBS = [
	'backend/src/**/*.ts',
	'frontend/**/*.js',
	'frontend/**/*.jsx',
	'frontend/**/*.ts',
	'frontend/**/*.tsx',
	'shared/src/**/*.ts',
	'scripts/**/*.ts',
	'eslint.config.js',
	'frontend/eslint.config.js',
	'frontend/tsconfig*.json',
	...PACKAGE_GLOBS,
];

const SOURCE_GLOBS = [
	'backend/src/**/*.ts',
	'frontend/src/**/*.ts',
	'frontend/src/**/*.tsx',
	'shared/src/**/*.ts',
];

const APPLICATION_CHECK_FILE_GLOBS = [
	'.env*',
	'backend/src/config/configUtils.ts',
	'backend/src/config/defaults.json',
	'backend/src/plugins/securityHeaders.ts',
	'backend/package.json',
	'config/**/*.json',
	'docker/nginx.conf',
	'frontend/index.html',
	'frontend/package.json',
	'package.json',
	'scripts/check-application.ts',
	'scripts/lib/crypto-keys.ts',
	'scripts/load-json-config.ts',
	'**/*.db',
];

const APPLICATION_CHECK_DIRECTORY_GLOBS = [
	'backend/backup',
	'backend/backups',
	'backend/data',
	'frontend/backup',
	'frontend/backups',
	'frontend/data',
];

const STEP_DEPENDENCIES: Record<string, StepDependencies> = {
	build: {
		directoryGlobs: APPLICATION_CHECK_DIRECTORY_GLOBS,
		excludes: [...COMMON_EXCLUDES, 'data/**'],
		globs: [
			...APPLICATION_CHECK_FILE_GLOBS,
			'frontend/src/**/*.ts',
			'frontend/src/**/*.tsx',
			'frontend/src/**/*.css',
			'frontend/index.html',
			'frontend/vite.config.ts',
			'frontend/vite-plugins/**/*.ts',
			'frontend/tsconfig.json',
			'frontend/tsconfig.app.json',
			'frontend/tsconfig.build.json',
			'frontend/package.json',
			'shared/src/**/*.ts',
			'shared/tsconfig.json',
			'shared/package.json',
			'backend/src/**/*.ts',
			'backend/tsconfig.json',
			'backend/package.json',
			...PACKAGE_GLOBS,
		],
		outputs: ['frontend/dist'],
	},
	'check-application': {
		directoryGlobs: APPLICATION_CHECK_DIRECTORY_GLOBS,
		excludes: [...COMMON_EXCLUDES, 'data/**'],
		globs: APPLICATION_CHECK_FILE_GLOBS,
	},
	'check-deps': {
		excludes: COMMON_EXCLUDES,
		globs: [
			'backend/package.json',
			'frontend/package.json',
			'package.json',
			'scripts/check-dependency-versions.ts',
		],
	},
	'check:api-types': {
		excludes: COMMON_EXCLUDES,
		globs: [
			'backend/src/**/*.ts',
			'config/**/*.json',
			'frontend/src/api/types/**/*.ts',
			'shared/src/**/*.ts',
			'scripts/validate-api-types.ts',
		],
	},
	'check:config': {
		excludes: COMMON_EXCLUDES,
		globs: [
			'backend/src/config/defaults.json',
			'package.json',
			'scripts/check-config-invariants.ts',
		],
	},
	'check:destructive-confirmation': {
		excludes: COMMON_EXCLUDES,
		globs: [
			'backend/src/config/configUtils.ts',
			'frontend/src/**/*.tsx',
			'scripts/check-destructive-confirmation.ts',
		],
	},
	'check:drift': {
		excludes: COMMON_EXCLUDES,
		globs: [
			'.templateoverrides',
			'package.json',
			'scripts/check-template-drift.ts',
			'scripts/load-json-config.ts',
			'scripts/template-manifest.json',
			'scripts/template-shared.ts',
			// Pure template files
			'.dockerignore',
			'.editorconfig',
			'.gitattributes',
			'.gitignore',
			'.nvmrc',
			'.prettierignore',
			'.prettierrc',
			'backend/bunfig.toml',
			'backend/drizzle.config.ts',
			'backend/tsconfig.json',
			'bunfig.toml',
			'docker/nginx.conf',
			'docker/start.sh',
			'docker/supervisord.conf',
			'docker-compose.test.yml',
			'docs/template/**/*.md',
			'eslint.config.js',
			'frontend/components.json',
			'frontend/eslint.config.js',
			'frontend/tsconfig.app.json',
			'frontend/tsconfig.build.json',
			'frontend/tsconfig.json',
			'frontend/tsconfig.node.json',
			'frontend/vite.config.ts',
			'knip.json',
			'opencode.json',
			'scripts/tsconfig.json',
			// Branded template files
			'Dockerfile',
			'docker-compose.production.yml',
			'docker-compose.yml',
			'frontend/index.html',
			// Infrastructure files
			'backend/src/app.ts',
			'backend/src/create-api-app.ts',
			'frontend/src/App.tsx',
			'frontend/src/main.tsx',
			'frontend/src/routes.tsx',
			'frontend/src/tailwind.css',
		],
	},
	'check:feature-integration': {
		excludes: COMMON_EXCLUDES,
		globs: [
			'backend/src/create-api-app.ts',
			'backend/src/routes/**/*.ts',
			'frontend/src/components/**/*.ts',
			'frontend/src/components/**/*.tsx',
			'frontend/src/pages/**/*.ts',
			'frontend/src/pages/**/*.tsx',
			'frontend/src/routes/lazyPages.ts',
			'scripts/check-feature-integration.ts',
		],
	},
	'check:lockfile-frozen': {
		excludes: COMMON_EXCLUDES,
		globs: ['bun.lock', 'scripts/check-lockfile-frozen.ts'],
	},
	'check:lts-surface': {
		excludes: COMMON_EXCLUDES,
		globs: [
			'backend/src/config/configSecrets.ts',
			'backend/src/config/configSchema.ts',
			'docs/lts-baseline/**/*.json',
			'scripts/check-lts-surface.ts',
			'scripts/template-manifest.json',
		],
	},
	'check:process-env': {
		excludes: COMMON_EXCLUDES,
		globs: [...SOURCE_GLOBS, 'scripts/check-process-env.ts'],
	},
	'check:schema-drift': {
		excludes: COMMON_EXCLUDES,
		globs: [...CONFIG_SCHEMA_GLOBS, 'scripts/check-config-schema-drift.ts'],
	},
	'check:schema-parity': {
		excludes: COMMON_EXCLUDES,
		globs: [
			'backend/src/db/schema/**/*.ts',
			'backend/src/db/schema-pg/**/*.ts',
			'scripts/check-schema-parity.ts',
		],
	},
	'check:secrets-shape': {
		excludes: COMMON_EXCLUDES,
		globs: [
			'backend/src/config/configUtils.ts',
			...CONFIG_JSON_GLOBS,
			'scripts/check-secrets-shape.ts',
		],
	},
	'config:validate': {
		excludes: COMMON_EXCLUDES,
		globs: [...CONFIG_SCHEMA_GLOBS, 'scripts/validate-config.ts'],
	},
	format: {
		collector: 'prettier',
		excludes: COMMON_EXCLUDES,
		globs: FORMAT_GLOBS,
	},
	'format:check': {
		collector: 'prettier',
		excludes: COMMON_EXCLUDES,
		globs: FORMAT_GLOBS,
	},
	lint: {
		excludes: COMMON_EXCLUDES,
		globs: LINT_GLOBS,
	},
	'lint:fix': {
		excludes: COMMON_EXCLUDES,
		globs: LINT_GLOBS,
	},
	typecheck: {
		excludes: COMMON_EXCLUDES,
		globs: [
			'backend/src/**/*.ts',
			'backend/package.json',
			'backend/tsconfig.json',
			'frontend/src/**/*.ts',
			'frontend/src/**/*.tsx',
			'frontend/package.json',
			'frontend/tsconfig.json',
			'frontend/tsconfig.app.json',
			'frontend/tsconfig.node.json',
			'frontend/tsconfig.build.json',
			'shared/src/**/*.ts',
			'shared/package.json',
			'shared/tsconfig.json',
			'scripts/**/*.ts',
			'scripts/tsconfig.json',
			'package.json',
			'bun.lock',
		],
	},
};

// ===== CORE FUNCTIONS =====

function getCachePath(projectRoot: string): string {
	return join(projectRoot, 'scripts', CACHE_FILENAME);
}

function loadCache(projectRoot: string): SmokeCache {
	const cachePath = getCachePath(projectRoot);

	if (!existsSync(cachePath)) {
		return {
			lastRun: '',
			steps: {},
			version: CACHE_VERSION,
		};
	}

	try {
		const raw = readFileSync(cachePath, 'utf-8');
		const cache = JSON.parse(raw) as SmokeCache;

		if (cache.version !== CACHE_VERSION) {
			return { lastRun: '', steps: {}, version: CACHE_VERSION };
		}

		return cache;
	} catch {
		return { lastRun: '', steps: {}, version: CACHE_VERSION };
	}
}

function saveCache(projectRoot: string, cache: SmokeCache): void {
	const cachePath = getCachePath(projectRoot);
	const logsDir = dirname(cachePath);

	if (!existsSync(logsDir)) {
		mkdirSync(logsDir, { recursive: true });
	}

	writeFileSync(cachePath, JSON.stringify(cache, null, '\t'), 'utf-8');
}

function normalizePath(filePath: string): string {
	return filePath.replace(/\\/g, '/');
}

async function collectFiles(
	projectRoot: string,
	globs: string[],
	excludes: string[]
): Promise<string[]> {
	const allFiles = new Set<string>();

	for (const pattern of globs) {
		const glob = new Bun.Glob(pattern);

		for await (const file of glob.scan({
			absolute: false,
			cwd: projectRoot,
			onlyFiles: true,
		})) {
			const normalizedFile = normalizePath(file);
			let excluded = false;
			for (const excludePattern of excludes) {
				const excludeGlob = new Bun.Glob(excludePattern);
				if (excludeGlob.match(normalizedFile)) {
					excluded = true;
					break;
				}
			}

			if (!excluded) {
				allFiles.add(normalizedFile);
			}
		}
	}

	return Array.from(allFiles).sort();
}

async function collectDirectories(
	projectRoot: string,
	globs: string[],
	excludes: string[]
): Promise<string[]> {
	const allDirectories = new Set<string>();

	for (const pattern of globs) {
		const glob = new Bun.Glob(pattern);

		for await (const entry of glob.scan({
			absolute: false,
			cwd: projectRoot,
			onlyFiles: false,
		})) {
			const normalizedEntry = normalizePath(entry);
			let excluded = false;
			for (const excludePattern of excludes) {
				const excludeGlob = new Bun.Glob(excludePattern);
				if (excludeGlob.match(normalizedEntry)) {
					excluded = true;
					break;
				}
			}
			if (excluded) continue;

			try {
				if (statSync(join(projectRoot, normalizedEntry)).isDirectory()) {
					allDirectories.add(normalizedEntry);
				}
			} catch {
				// Missing paths simply do not contribute to the dependency hash.
			}
		}
	}

	return Array.from(allDirectories).sort();
}

async function collectPrettierFiles(
	projectRoot: string,
	deps: StepDependencies
): Promise<string[]> {
	const { getFileInfo } = await import('prettier');
	const candidates = await collectFiles(projectRoot, PRETTIER_CANDIDATE_GLOBS, deps.excludes);
	const prettierFiles = new Set<string>();

	for (const file of candidates) {
		const info = await getFileInfo(join(projectRoot, file), {
			ignorePath: join(projectRoot, '.prettierignore'),
			resolveConfig: true,
			withNodeModules: false,
		});

		if (!info.ignored && info.inferredParser) {
			prettierFiles.add(file);
		}
	}

	const toolFiles = await collectFiles(projectRoot, deps.globs, []);
	for (const file of toolFiles) {
		prettierFiles.add(file);
	}

	return Array.from(prettierFiles).sort();
}

async function collectDependencyFiles(
	projectRoot: string,
	deps: StepDependencies
): Promise<string[]> {
	if (deps.collector === 'prettier') {
		return collectPrettierFiles(projectRoot, deps);
	}

	return collectFiles(projectRoot, deps.globs, deps.excludes);
}

async function hashFile(projectRoot: string, filePath: string): Promise<string> {
	try {
		const fullPath = join(projectRoot, filePath);
		const file = Bun.file(fullPath);
		const content = await file.arrayBuffer();
		return Bun.hash(content).toString(16);
	} catch {
		return 'missing';
	}
}

async function computeStepHash(projectRoot: string, stepName: string): Promise<string> {
	const deps = STEP_DEPENDENCIES[stepName];

	if (!deps) {
		return Date.now().toString();
	}

	const files = await collectDependencyFiles(projectRoot, deps);
	const directories = deps.directoryGlobs
		? await collectDirectories(projectRoot, deps.directoryGlobs, deps.excludes)
		: [];

	const BATCH_SIZE = 100;
	const fileHashes: string[] = [];

	for (let i = 0; i < files.length; i += BATCH_SIZE) {
		const batch = files.slice(i, i + BATCH_SIZE);
		const batchHashes = await Promise.all(batch.map((f) => hashFile(projectRoot, f)));
		fileHashes.push(...batchHashes);
	}

	const fileEntries = files.map((f, i) => `file:${f}:${fileHashes[i]}`);
	const directoryEntries = directories.map((d) => `dir:${d}:present`);
	const combined = [...fileEntries, ...directoryEntries].join('\n');

	return Bun.hash(combined).toString(16);
}

async function outputsExist(projectRoot: string, stepName: string): Promise<boolean> {
	const deps = STEP_DEPENDENCIES[stepName];

	if (!deps?.outputs) {
		return true;
	}

	for (const output of deps.outputs) {
		const outputPath = join(projectRoot, output);
		if (!existsSync(outputPath)) {
			return false;
		}

		const glob = new Bun.Glob('**/*');
		let hasFiles = false;
		for await (const _ of glob.scan({ cwd: outputPath, onlyFiles: true })) {
			hasFiles = true;
			break;
		}

		if (!hasFiles) {
			return false;
		}
	}

	return true;
}

// ===== PUBLIC API =====

export async function canSkipStep(
	projectRoot: string,
	stepName: string
): Promise<CacheCheckResult> {
	const cache = loadCache(projectRoot);
	const cached = cache.steps[stepName];

	if (!cached) {
		return { reason: 'No cache entry', skip: false };
	}

	if (cached.result === 'fail') {
		return { reason: 'Previous run failed', skip: false };
	}

	if (!(await outputsExist(projectRoot, stepName))) {
		return { reason: 'Outputs missing', skip: false };
	}

	const currentHash = await computeStepHash(projectRoot, stepName);

	if (currentHash !== cached.hash) {
		return { reason: 'Files changed', skip: false };
	}

	return {
		reason: `Unchanged since ${cached.lastRun} (${cached.duration}ms)`,
		skip: true,
	};
}

export async function recordStepResult(
	projectRoot: string,
	stepName: string,
	result: 'fail' | 'pass',
	duration: number
): Promise<void> {
	const cache = loadCache(projectRoot);
	const hash = await computeStepHash(projectRoot, stepName);

	cache.steps[stepName] = {
		duration,
		hash,
		lastRun: new Date().toISOString(),
		result,
	};

	cache.lastRun = new Date().toISOString();

	saveCache(projectRoot, cache);
}

export async function getCacheStatus(projectRoot: string, steps: string[]): Promise<CacheStatus[]> {
	const statuses: CacheStatus[] = [];

	for (const step of steps) {
		const { reason, skip } = await canSkipStep(projectRoot, step);
		const cache = loadCache(projectRoot);
		const cached = cache.steps[step];

		statuses.push({
			cached: skip,
			lastResult: cached?.result,
			lastRun: cached?.lastRun,
			reason,
			step,
		});
	}

	return statuses;
}
