#!/usr/bin/env bun
/**
 * Application consistency checker for Spernakit v3.
 *
 * Validates:
 * - Config file exists and is valid JSON with required fields
 * - Database files are only in data/ (architectural constraint)
 * - Package.json files have correct names and workspaces
 * - No unauthorized .db files outside data/
 * - No rogue data/ or backup/ folders outside root (architectural constraint)
 * - No .env files in repository root (JSON-only config policy)
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadJsonConfig } from './load-json-config.js';

type UnknownRecord = Record<string, unknown>;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = path.resolve(path.join(__dirname, '..'));

function isRecord(value: unknown): value is UnknownRecord {
	return typeof value === 'object' && value !== null;
}

function readJsonFileOrThrow(filePath: string): unknown {
	try {
		return JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
	} catch (err: unknown) {
		throw new Error(`Failed to read JSON file: ${filePath}. ${String(err)}`, { cause: err });
	}
}

function assertEqual<T>(label: string, actual: T, expected: T): void {
	if (actual !== expected) {
		throw new Error(
			`${label} mismatch. Expected: ${String(expected)}, Found: ${String(actual)}`
		);
	}
}

function assertDefined<T>(label: string, value: null | T | undefined): T {
	if (value === undefined || value === null) {
		throw new Error(`${label} is missing`);
	}
	return value;
}

function normalizeRelPath(p: string): string {
	return p.replace(/\\/g, '/');
}

function readString(json: UnknownRecord, key: string): string | undefined {
	const value = json[key];
	return typeof value === 'string' ? value : undefined;
}

const EXCLUDE_DIRECTORIES: readonly string[] = [
	'.cache',
	'.git',
	'.idea',
	'.next',
	'.turbo',
	'.vscode',
	'.worktrees',
	'backups',
	'build',
	'coverage',
	'dist',
	'node_modules',
	'temp',
	'tmp',
];

async function findDbFiles(dir: string, basePath = ''): Promise<string[]> {
	const dbFiles: string[] = [];

	try {
		const entries = await readdir(dir);

		for (const entry of entries) {
			const fullPath = path.join(dir, entry);
			const relativePath = path.join(basePath, entry);

			if (EXCLUDE_DIRECTORIES.includes(entry)) {
				continue;
			}

			const stats = await stat(fullPath);
			if (stats.isDirectory()) {
				const subFiles = await findDbFiles(fullPath, relativePath);
				dbFiles.push(...subFiles);
				continue;
			}

			if (entry.endsWith('.db')) {
				dbFiles.push(relativePath);
			}
		}
	} catch {
		// Ignore permission errors and continue
	}

	return dbFiles;
}

/**
 * Find rogue data/ or backup/ folders that exist outside the root directory.
 * These folders are restricted to root only - no backend/data or backend/backup.
 *
 * Only checks immediate children of backend/ and frontend/ directories to avoid
 * false positives on legitimate source code folders like backend/src/services/backup.
 */
async function findRogueFolders(): Promise<string[]> {
	const rogueFolders: string[] = [];
	const restrictedNames = ['data', 'backup', 'backups'];
	const workspaceDirs = ['backend', 'frontend'];

	for (const workspace of workspaceDirs) {
		const workspacePath = path.join(repoRoot, workspace);

		if (!fs.existsSync(workspacePath)) {
			continue;
		}

		try {
			const entries = await readdir(workspacePath);

			for (const entry of entries) {
				const fullPath = path.join(workspacePath, entry);
				const relativePath = path.join(workspace, entry);

				const stats = await stat(fullPath);
				if (stats.isDirectory() && restrictedNames.includes(entry.toLowerCase())) {
					rogueFolders.push(relativePath);
				}
			}
		} catch {
			// Ignore permission errors and continue
		}
	}

	return rogueFolders;
}

type AppConfig = {
	app?: {
		description?: string;
		name?: string;
		slug?: string;
	};
	database?: {
		url?: string;
	};
	security?: {
		authCookieName?: string;
		csrfCookieName?: string;
		refreshCookieName?: string;
	};
	server?: {
		backendPort?: number;
		backendUrl?: string;
		frontendPort?: number;
		frontendUrl?: string;
	};
};

function checkConfigConsistency(): {
	backendPort: number;
	frontendPort: number;
	slug: string;
} {
	const { appSlug } = loadJsonConfig(repoRoot);
	const configDir = process.env['CONFIG_DIR'] || path.join(repoRoot, 'config');
	const configPath = path.join(configDir, `${appSlug}.json`);

	if (!fs.existsSync(configPath)) {
		throw new Error(`Config file not found: ${configPath}`);
	}

	const configUnknown = readJsonFileOrThrow(configPath);
	if (!isRecord(configUnknown)) {
		throw new Error(`Config file is not an object: ${configPath}`);
	}

	const config = configUnknown as AppConfig;

	const slug = assertDefined('config: app.slug', config.app?.slug);
	assertDefined('config: app.name', config.app?.name);
	assertDefined('config: app.description', config.app?.description);
	const frontendPort = assertDefined('config: server.frontendPort', config.server?.frontendPort);
	const backendPort = assertDefined('config: server.backendPort', config.server?.backendPort);
	const frontendUrl = assertDefined('config: server.frontendUrl', config.server?.frontendUrl);
	const backendUrl = assertDefined('config: server.backendUrl', config.server?.backendUrl);
	const databaseUrl = assertDefined('config: database.url', config.database?.url);

	assertEqual('config.server.frontendUrl', frontendUrl, `http://localhost:${frontendPort}`);
	assertEqual('config.server.backendUrl', backendUrl, `http://localhost:${backendPort}`);
	assertEqual('config.database.url', databaseUrl, `file:./data/${slug}.db`);

	const authCookieName = assertDefined(
		'config: security.authCookieName',
		config.security?.authCookieName
	);
	const csrfCookieName = assertDefined(
		'config: security.csrfCookieName',
		config.security?.csrfCookieName
	);
	const refreshCookieName = assertDefined(
		'config: security.refreshCookieName',
		config.security?.refreshCookieName
	);
	assertEqual('config.security.authCookieName', authCookieName, `${slug}_auth`);
	assertEqual('config.security.csrfCookieName', csrfCookieName, `${slug}_csrf`);
	assertEqual('config.security.refreshCookieName', refreshCookieName, `${slug}_refresh`);

	return { backendPort, frontendPort, slug };
}

function checkPackageJsonFiles(slug: string): void {
	const rootPkgPath = path.join(repoRoot, 'package.json');
	const rootPkgUnknown = readJsonFileOrThrow(rootPkgPath);
	if (!isRecord(rootPkgUnknown)) {
		throw new Error(`package.json is not an object: ${rootPkgPath}`);
	}

	assertEqual('package.json name', readString(rootPkgUnknown, 'name'), slug);

	const workspaces = rootPkgUnknown['workspaces'];
	if (!Array.isArray(workspaces)) {
		throw new Error('package.json missing workspaces array');
	}
	if (!workspaces.includes('backend') || !workspaces.includes('frontend')) {
		throw new Error('package.json workspaces must include backend and frontend');
	}

	assertEqual('package.json type', readString(rootPkgUnknown, 'type'), 'module');

	// Check workspace package.json files
	const backendPkgPath = path.join(repoRoot, 'backend', 'package.json');
	if (fs.existsSync(backendPkgPath)) {
		const backendPkg = readJsonFileOrThrow(backendPkgPath);
		if (isRecord(backendPkg)) {
			assertEqual(
				'backend/package.json name',
				readString(backendPkg, 'name'),
				`${slug}-backend`
			);
			assertEqual('backend/package.json type', readString(backendPkg, 'type'), 'module');
		}
	}

	const frontendPkgPath = path.join(repoRoot, 'frontend', 'package.json');
	if (fs.existsSync(frontendPkgPath)) {
		const frontendPkg = readJsonFileOrThrow(frontendPkgPath);
		if (isRecord(frontendPkg)) {
			assertEqual(
				'frontend/package.json name',
				readString(frontendPkg, 'name'),
				`${slug}-frontend`
			);
			assertEqual('frontend/package.json type', readString(frontendPkg, 'type'), 'module');
		}
	}
}

async function checkDatabaseLocation(slug: string): Promise<void> {
	console.log('   Checking for unauthorized database files...');
	const dbFiles = await findDbFiles(repoRoot);

	const unauthorizedFiles = dbFiles.filter((file) => {
		return normalizeRelPath(file) !== `data/${slug}.db`;
	});

	if (unauthorizedFiles.length > 0) {
		console.error('   Unauthorized database files detected:');
		for (const file of unauthorizedFiles) {
			console.error(`     ${file}`);
		}
		throw new Error(
			`Database files should only exist at data/${slug}.db. Found unauthorized files.`
		);
	}

	console.log('   No unauthorized database files found.');
}

async function checkRogueFolders(): Promise<void> {
	console.log('   Checking for rogue data/ or backup/ folders...');
	const rogueFolders = await findRogueFolders();

	if (rogueFolders.length > 0) {
		console.error('   Rogue data/ or backup/ folders detected (restricted to root only):');
		for (const folder of rogueFolders) {
			console.error(`     ${folder}`);
		}
		throw new Error(
			`data/ and backup/ folders are restricted to root only. Found rogue folders at: ${rogueFolders.join(', ')}`
		);
	}

	console.log('   No rogue data/ or backup/ folders found.');
}

/**
 * Compute the SHA-256 hash of the inline theme-init script in frontend/index.html
 * and verify it matches the CSP hashes in securityHeaders.ts and nginx.conf.
 *
 * This prevents the CSP hash from drifting when the inline script is modified,
 * which would cause all pages to fail with CSP violations in production/Docker.
 */
function checkCspHashConsistency(): void {
	console.log('   Checking CSP inline script hash consistency...');

	const indexHtmlPath = path.join(repoRoot, 'frontend', 'index.html');
	if (!fs.existsSync(indexHtmlPath)) {
		console.log('   Skipped (frontend/index.html not found).');
		return;
	}

	const html = fs.readFileSync(indexHtmlPath, 'utf8');
	const scriptMatch = html.match(/<script>[\s\S]*?<\/script>/);
	if (!scriptMatch) {
		console.log('   Skipped (no inline script found in index.html).');
		return;
	}

	// Extract content between <script> and </script>
	const contentMatch = scriptMatch[0].match(/<script>([\s\S]*?)<\/script>/);
	if (!contentMatch?.[1]) {
		console.log('   Skipped (empty inline script).');
		return;
	}

	const scriptContent = contentMatch[1];
	const actualHash = `sha256-${createHash('sha256').update(scriptContent).digest('base64')}`;

	// Check securityHeaders.ts
	const secHeadersPath = path.join(repoRoot, 'backend', 'src', 'plugins', 'securityHeaders.ts');
	if (fs.existsSync(secHeadersPath)) {
		const secHeaders = fs.readFileSync(secHeadersPath, 'utf8');
		const hashMatch = secHeaders.match(/sha256-[A-Za-z0-9+/]+=*/g);
		if (hashMatch && !hashMatch.includes(actualHash)) {
			throw new Error(
				`CSP hash mismatch in securityHeaders.ts.\n` +
					`     Inline script hash: ${actualHash}\n` +
					`     securityHeaders.ts has: ${hashMatch.join(', ')}\n` +
					`     Update the CSP hash in securityHeaders.ts to match.`
			);
		}
	}

	// Check nginx.conf
	const nginxConfPath = path.join(repoRoot, 'docker', 'nginx.conf');
	if (fs.existsSync(nginxConfPath)) {
		const nginxConf = fs.readFileSync(nginxConfPath, 'utf8');
		const hashMatch = nginxConf.match(/sha256-[A-Za-z0-9+/]+=*/g);
		if (hashMatch && !hashMatch.includes(actualHash)) {
			throw new Error(
				`CSP hash mismatch in docker/nginx.conf.\n` +
					`     Inline script hash: ${actualHash}\n` +
					`     nginx.conf has: ${hashMatch.join(', ')}\n` +
					`     Update the CSP hash in nginx.conf to match.`
			);
		}
	}

	console.log(`   CSP hash consistent: ${actualHash}`);
}

/**
 * Secret-backed config keys that must contain placeholder values in tracked files.
 * Actual secrets must only live in gitignored config/{slug}.json or env vars.
 */
const SECRET_CONFIG_KEYS = [
	'security.applicationApiKey',
	'security.cookieSecret',
	'security.encryptionKey',
	'security.jwtPrivateKey',
	'security.jwtPublicKey',
	'security.jwtRefreshPrivateKey',
	'security.jwtRefreshPublicKey',
] as const;

const PLACEHOLDER_PATTERN = /CHANGE.?ME|CHANGE.?REQUIRED|GENERATE.?ME|PRODUCTION/i;

/**
 * Get a nested value from an object using a dot-separated path.
 */
function getNestedValue(obj: UnknownRecord, dotPath: string): string | undefined {
	const segments = dotPath.split('.');
	let current: unknown = obj;
	for (const segment of segments) {
		if (current === null || current === undefined || typeof current !== 'object')
			return undefined;
		current = (current as UnknownRecord)[segment];
	}
	return typeof current === 'string' ? current : undefined;
}

/**
 * Check that tracked config files (defaults.json, config/example.json) do not
 * contain real secret values. All secret-backed keys must use placeholder patterns.
 * This prevents secrets from being committed to the repository.
 */
function checkNoCommittedSecrets(): void {
	console.log('Checking tracked config files for committed secrets...');

	const trackedFiles = [
		path.join(repoRoot, 'backend', 'src', 'config', 'defaults.json'),
		path.join(repoRoot, 'config', 'example.json'),
	];

	const violations: string[] = [];

	for (const filePath of trackedFiles) {
		if (!fs.existsSync(filePath)) continue;

		const relativePath = path.relative(repoRoot, filePath);
		const content = readJsonFileOrThrow(filePath);
		if (!isRecord(content)) continue;

		for (const secretKey of SECRET_CONFIG_KEYS) {
			const value = getNestedValue(content, secretKey);
			if (value === undefined) continue;
			if (!PLACEHOLDER_PATTERN.test(value)) {
				violations.push(`${relativePath}: ${secretKey} contains a non-placeholder value`);
			}
		}
	}

	if (violations.length > 0) {
		throw new Error(
			`Committed secrets detected in tracked config files:\n  ${violations.join('\n  ')}\n` +
				'  Secret values must use PRODUCTION_CHANGE_REQUIRED-* placeholders. ' +
				'Actual secrets belong in gitignored config/{slug}.json or environment variables.'
		);
	}

	console.log('   No committed secrets found in tracked config files.');
}

/**
 * Check that no .env files exist in the repository root.
 * JSON-only configuration policy forbids dotenv files.
 */
function checkNoEnvFiles(): void {
	console.log('Checking for .env files (JSON-only config policy)...');
	const envFiles = fs.readdirSync(repoRoot).filter((name) => name.startsWith('.env'));
	if (envFiles.length > 0) {
		throw new Error(
			`JSON-only config policy violation: found .env files in repository root: ${envFiles.join(', ')}. Use config/*.json instead.`
		);
	}
	console.log('   No .env files found.');
}

async function main(): Promise<void> {
	try {
		console.log('Checking application configuration...');
		console.log('');

		console.log('   Checking config consistency...');
		const { backendPort, frontendPort, slug } = checkConfigConsistency();
		console.log(`   APP_SLUG: ${slug}`);
		console.log(`   BACKEND_PORT: ${backendPort}`);
		console.log(`   FRONTEND_PORT: ${frontendPort}`);
		console.log('');

		console.log('   Checking package.json files...');
		checkPackageJsonFiles(slug);
		console.log('');

		await checkDatabaseLocation(slug);
		console.log('');

		await checkRogueFolders();
		console.log('');

		checkNoEnvFiles();
		console.log('');

		checkNoCommittedSecrets();
		console.log('');

		checkCspHashConsistency();
		console.log('');

		console.log('Application checks passed.');
		process.exit(0);
	} catch (err: unknown) {
		const typedErr = err instanceof Error ? err : new Error(String(err));
		console.error(`Application check failed: ${typedErr.message}`);
		process.exit(1);
	}
}

main();
