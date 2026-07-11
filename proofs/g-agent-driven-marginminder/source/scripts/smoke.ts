#!/usr/bin/env bun
/**
 * Smoke test runner - executes a chain of commands based on mode configuration.
 *
 * Usage:
 *   bun scripts/smoke.ts [--mode <mode>] [--force] [--cache-status]
 *   bun scripts/smoke.ts --mode qc           # Run QC with caching
 *   bun scripts/smoke.ts --mode qc --force   # Bypass cache, run all steps
 *   bun scripts/smoke.ts --mode qc --cache-status  # Show what would run
 *   bun scripts/smoke.ts --mode dev          # Run dev mode (no caching)
 *
 * Flags:
 *   --mode, -m       Mode to run (default: dev). Modes defined in smoke.json.
 *   --force, -f      Bypass cache and run all steps (qc mode only)
 *   --cache-status   Show cache status without running (qc mode only)
 *
 * Caching (qc mode only):
 *   The qc mode tracks file changes and skips steps where no relevant files
 *   have changed since the last successful run. Cache stored in scripts/smoke-cache.json.
 *
 * Cross-platform: uses Bun.spawn with shell for command execution.
 */
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	unlinkSync,
	writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { loadJsonConfig } from './load-json-config.ts';
import { canSkipStep, getCacheStatus, recordStepResult } from './smoke-cache.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

interface Step {
	command: string;
	description: string;
	logFile?: string;
}

interface ModeConfig {
	steps: Step[];
}

interface SmokeConfig {
	modes: Record<string, ModeConfig>;
}

interface ParsedArguments {
	cacheStatus: boolean;
	force: boolean;
	mode: string;
	screenshotPages: boolean;
}

const CHILD_ENV_KEYS = [
	'APP_SLUG',
	'APP_VERSION',
	'APPDATA',
	'APPDATA_ROOT',
	'BACKEND_PORT',
	'BACKUPS_ROOT',
	'BUN_INSTALL',
	'COMSPEC',
	'CONFIG_DIR',
	'FRONTEND_PORT',
	'HOME',
	'LOCALAPPDATA',
	'NODE_ENV',
	'PATH',
	'PATHEXT',
	'Path',
	'PROGRAMDATA',
	'PROGRAMFILES',
	'PROGRAMFILES(X86)',
	'PSMODULEPATH',
	'SYSTEMDRIVE',
	'SYSTEMROOT',
	'TEMP',
	'TMP',
	'USERPROFILE',
	'WINDIR',
] as const;

/**
 * Build a minimal environment for child commands after loadConfig() has set the
 * runtime variables smoke modes intentionally pass to Docker and Bun processes.
 */
function createChildEnv(): NodeJS.ProcessEnv {
	const env: NodeJS.ProcessEnv = {};

	for (const key of CHILD_ENV_KEYS) {
		const value = process.env[key];
		if (value !== undefined) {
			env[key] = value;
		}
	}

	return env;
}

function parseArguments(): ParsedArguments {
	const { values } = parseArgs({
		args: process.argv.slice(2),
		options: {
			'cache-status': { default: false, type: 'boolean' },
			force: { default: false, short: 'f', type: 'boolean' },
			mode: { default: 'dev', short: 'm', type: 'string' },
			'screenshot-pages': { default: false, type: 'boolean' },
		},
		strict: true,
	});

	return {
		cacheStatus: values['cache-status'] ?? false,
		force: values.force ?? false,
		mode: values.mode ?? 'dev',
		screenshotPages: values['screenshot-pages'] ?? false,
	};
}

function loadConfig(): SmokeConfig {
	// Load JSON config first — also provides port values for token substitution
	const { appSlug, config: appConfig } = loadJsonConfig(projectRoot);

	// Export env vars so docker compose commands inherit them via Bun.spawn()
	const frontendPort = String(appConfig.server?.frontendPort ?? '');
	const backendPort = String(appConfig.server?.backendPort ?? '');
	process.env.APP_SLUG ??= appSlug;
	process.env.FRONTEND_PORT ??= frontendPort;
	process.env.BACKEND_PORT ??= backendPort;
	// docker-compose.production.yml requires APP_VERSION (no :latest fallback).
	// Pin smoke runs to the current package.json version so prod-compose interpolation
	// succeeds without operators having to set the var manually for each dance.
	if (process.env.APP_VERSION === undefined) {
		const pkgRaw = readFileSync(join(projectRoot, 'package.json'), 'utf-8');
		const pkg = JSON.parse(pkgRaw) as { version?: string };
		if (typeof pkg.version === 'string' && pkg.version.length > 0) {
			process.env.APP_VERSION = pkg.version;
		}
	}
	// Default docker volume roots to an environment-specific directory outside the
	// source tree. Layout: {appdata}/test/{slug}/ on Windows, /tmp/{slug}-test/ on Linux.
	const defaultDockerRoot =
		process.platform === 'win32'
			? join('D:\\appdata', 'test')
			: join('/tmp', `${appSlug}-test`);
	process.env.APPDATA_ROOT ??= appConfig.docker?.appdataRoot || defaultDockerRoot;
	process.env.BACKUPS_ROOT ??= appConfig.docker?.backupsRoot || defaultDockerRoot;

	const configPath = join(__dirname, 'smoke.json');

	if (!existsSync(configPath)) {
		console.error(`Configuration file not found: ${configPath}`);
		process.exit(1);
	}

	// Substitute {{APP_SLUG}}, {{FRONTEND_PORT}}, and {{BACKEND_PORT}} tokens from app config
	const configRaw = readFileSync(configPath, 'utf-8')
		.replaceAll('{{APP_SLUG}}', appSlug)
		.replaceAll('{{FRONTEND_PORT}}', frontendPort)
		.replaceAll('{{BACKEND_PORT}}', backendPort);

	return JSON.parse(configRaw) as SmokeConfig;
}

function ensureLogsDirectory(): void {
	const logsPath = join(projectRoot, 'logs');
	if (!existsSync(logsPath)) {
		mkdirSync(logsPath, { recursive: true });
	}
}

/**
 * Disable `rateLimit.enabled` and `rateLimit.authEnabled` in the config at `configPath`.
 * Used by both docker-prod (on the mount copy) and dev-mode crawl (on the real file,
 * via {@link disableDevRateLimit}) to keep crawltest's rapid-fire navigation from
 * tripping the 429 cascade that fails content assertions and degrades page loads.
 */
function writeRateLimitDisable(configPath: string): void {
	try {
		const cfg = JSON.parse(readFileSync(configPath, 'utf-8'));
		if (cfg.rateLimit) {
			cfg.rateLimit.enabled = false;
			cfg.rateLimit.authEnabled = false;
			writeFileSync(configPath, JSON.stringify(cfg, null, '\t'));
		}
	} catch {
		// Non-fatal — crawltest may hit 429s but won't crash
	}
}

/**
 * Backup `config/{slug}.json` and disable its rate limiter in-place. The backup is
 * written to a sibling `.pre-crawl-bak` file so a crashed smoke run can be recovered
 * on the next invocation via {@link recoverDevRateLimitBackup}. Returns the restore
 * function the caller must invoke (directly and/or via process exit handlers).
 */
function disableDevRateLimit(): () => void {
	const appSlug = process.env.APP_SLUG ?? '';
	if (!appSlug) return () => {};

	const configPath = join(projectRoot, 'config', `${appSlug}.json`);
	if (!existsSync(configPath)) return () => {};

	const backupPath = `${configPath}.pre-crawl-bak`;
	const original = readFileSync(configPath, 'utf-8');
	writeFileSync(backupPath, original, 'utf-8');
	writeRateLimitDisable(configPath);

	let restored = false;
	return () => {
		if (restored) return;
		restored = true;
		if (existsSync(backupPath)) {
			writeFileSync(configPath, readFileSync(backupPath, 'utf-8'), 'utf-8');
			unlinkSync(backupPath);
		}
	};
}

/**
 * Recover a stale `.pre-crawl-bak` left behind by a previous smoke run that crashed
 * before its restore handler ran. Runs at smoke startup so a new run always begins
 * with the real config in place.
 */
function recoverDevRateLimitBackup(): void {
	const appSlug = process.env.APP_SLUG ?? '';
	if (!appSlug) return;

	const configPath = join(projectRoot, 'config', `${appSlug}.json`);
	const backupPath = `${configPath}.pre-crawl-bak`;
	if (!existsSync(backupPath)) return;

	console.log('Recovering config from previous crashed crawl run...');
	writeFileSync(configPath, readFileSync(backupPath, 'utf-8'), 'utf-8');
	unlinkSync(backupPath);
}

/**
 * Ensure docker volume mount directories exist on the host for docker-local and
 * docker-prod modes. Both mount the `${APPDATA_ROOT}/${APP_SLUG}/...` layout — local
 * via docker-compose.test.yml overlay, prod via docker-compose.production.yml.
 */
function ensureDockerTestDirs(): void {
	const appSlug = process.env.APP_SLUG ?? '';
	const appdataRoot = process.env.APPDATA_ROOT ?? '';
	const backupsRoot = process.env.BACKUPS_ROOT ?? '';

	if (!appSlug || !appdataRoot) return;

	const dirs = [
		join(appdataRoot, appSlug, 'config'),
		join(appdataRoot, appSlug, 'data'),
		join(appdataRoot, appSlug, 'logs'),
		join(backupsRoot || appdataRoot, appSlug),
	];

	for (const dir of dirs) {
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true });
		}
	}

	// Skip config/secrets sync when running against a persistent staging mount.
	// The staging config is authored to hold true production posture (nodeEnv=production,
	// cookieSecure, real secrets, allowedOrigins) and must not be clobbered by the local
	// dev config every run. Detected by 'staging' segment in the appdata path.
	const isStagingMount = /[\\/]staging[\\/]/i.test(appdataRoot);

	if (!isStagingMount) {
		// Sync every config/*.json file into the docker-prod config mount so the container
		// starts with current dev config. Walks the directory rather than hardcoding
		// {slug}.json + {slug}.secrets.json — apps frequently ship supplemental configs
		// (e.g. aidd-squad's squad-doctrine.json) that must travel alongside the canonicals.
		// example.json is excluded — it's a template artifact, not runtime config.
		const srcConfigDir = join(projectRoot, 'config');
		if (existsSync(srcConfigDir)) {
			const mainConfig = `${appSlug}.json`;
			for (const entry of readdirSync(srcConfigDir)) {
				if (!entry.endsWith('.json') || entry === 'example.json') continue;
				const src = join(srcConfigDir, entry);
				const dest = join(appdataRoot, appSlug, 'config', entry);
				copyFileSync(src, dest);
				if (entry === mainConfig) {
					writeRateLimitDisable(dest);
				}
			}
		}
	} else {
		console.log(`   Staging mount detected at ${appdataRoot} — skipping config sync`);
		// On a fresh STG wipe (no config yet) leave a marker so docker/start.sh applies
		// the staging-specific CORS overrides (cors.inheritFrontendUrl=true,
		// cors.frontendDevOrigins=[]) when it creates the initial config from defaults.
		// Real production should set allowedOrigins explicitly and not need the marker.
		const stgConfigPath = join(appdataRoot, appSlug, 'config', `${appSlug}.json`);
		if (!existsSync(stgConfigPath)) {
			const markerPath = join(appdataRoot, appSlug, 'config', '.stg-bootstrap');
			writeFileSync(markerPath, 'STG bootstrap marker — consumed by docker/start.sh\n');
			console.log(`   Fresh STG config — wrote bootstrap marker`);
		}
	}

	// Reset docker-prod data directory so container starts from a clean database
	const dataDir = join(appdataRoot, appSlug, 'data');
	if (existsSync(dataDir)) {
		const files = readdirSync(dataDir);
		let removed = 0;
		for (const file of files) {
			if (
				file.endsWith('.db') ||
				file.endsWith('.db-shm') ||
				file.endsWith('.db-wal') ||
				file === '.seeded'
			) {
				unlinkSync(join(dataDir, file));
				removed++;
			}
		}
		if (removed > 0) {
			console.log(`   Reset docker-prod data: cleared ${removed} file(s)`);
		}
	}
}

function getShell(): string[] {
	if (process.platform === 'win32') {
		try {
			const pwshCheck = Bun.spawnSync([
				'pwsh',
				'-NoLogo',
				'-NoProfile',
				'-Command',
				'exit 0',
			]);
			if (pwshCheck.success) {
				return ['pwsh', '-NoLogo', '-NoProfile', '-Command'];
			}
		} catch {
			// pwsh not available
		}
		return ['cmd', '/c'];
	}
	return ['bash', '-c'];
}

// Rewrite leading `bun ` (and `bun` after `&&`/`||`/`;`/`|`) to the absolute
// path of the currently-running Bun executable. This sidesteps PATH/PATHEXT
// resolution in child shells — pwsh -NoProfile in particular won't always
// resolve `bun` to `bun.exe`, even when `.bun\bin` is on PATH, and the failure
// is a non-terminating error so it can't be detected by exit code alone.
function rewriteBunCommand(command: string): string {
	if (process.platform !== 'win32') return command;
	const bunPath = process.execPath;
	const quoted = bunPath.includes(' ') ? `"${bunPath}"` : bunPath;
	return command.replace(/(^|[\s&|;])bun(\s)/g, `$1${quoted}$2`);
}

function getStepKey(command: string): string {
	const match = command.match(/bun run (\S+)/);
	return match?.[1] ?? command;
}

async function showCacheStatus(steps: Step[]): Promise<void> {
	const stepKeys = steps.map((s) => getStepKey(s.command));
	const statuses = await getCacheStatus(projectRoot, stepKeys);

	console.log('\nCache Status:');
	console.log('─'.repeat(70));

	for (const status of statuses) {
		const icon = status.cached ? '✓' : '○';
		const state = status.cached ? 'CACHED' : 'PENDING';
		console.log(`${icon} ${status.step.padEnd(20)} ${state.padEnd(10)} ${status.reason}`);
	}

	console.log('─'.repeat(70));
}

async function runCommand(
	command: string,
	description: string,
	shell: string[],
	force: boolean,
	useCache: boolean,
	logFile?: string
): Promise<void> {
	const stepKey = getStepKey(command);

	if (useCache && !force) {
		const { reason, skip } = await canSkipStep(projectRoot, stepKey);
		if (skip) {
			console.log(`\n==> ${description}`);
			console.log(`    [CACHED] ${reason}`);
			return;
		}
	}

	console.log(`\n==> ${description}`);
	console.log(`    ${command}`);

	const startTime = performance.now();
	let exitCode: number;
	const spawnCommand = rewriteBunCommand(command);

	if (logFile) {
		const logPath = join(projectRoot, logFile);
		const fileWriter = Bun.file(logPath).writer();

		const proc = Bun.spawn([...shell, spawnCommand], {
			cwd: projectRoot,
			env: createChildEnv(),
			stderr: 'pipe',
			stdin: 'inherit',
			stdout: 'pipe',
		});

		const pipe = async (stream: ReadableStream<Uint8Array>, output: NodeJS.WriteStream) => {
			for await (const chunk of stream) {
				output.write(chunk);
				fileWriter.write(chunk);
			}
		};

		await Promise.all([pipe(proc.stdout, process.stdout), pipe(proc.stderr, process.stderr)]);
		fileWriter.end();
		exitCode = await proc.exited;
	} else {
		const proc = Bun.spawn([...shell, spawnCommand], {
			cwd: projectRoot,
			env: createChildEnv(),
			stdio: ['inherit', 'inherit', 'inherit'],
		});
		exitCode = await proc.exited;
	}

	const duration = Math.round(performance.now() - startTime);

	if (exitCode !== 0) {
		console.error(`[FAIL] ${description} (exit code ${exitCode})`);
		if (useCache) {
			await recordStepResult(projectRoot, stepKey, 'fail', duration);
		}
		process.exit(exitCode);
	}

	console.log(`[OK] ${description}`);
	if (useCache) {
		await recordStepResult(projectRoot, stepKey, 'pass', duration);
	}
}

async function main(): Promise<void> {
	console.log("Don't Panic.");

	const { cacheStatus, force, mode, screenshotPages } = parseArguments();
	const config = loadConfig();
	const shell = getShell();

	console.log(`Running smoke tests for mode: ${mode}`);

	const modeKey = mode.toLowerCase();
	const modeConfig = config.modes[modeKey];

	if (!modeConfig) {
		console.error(`Unknown mode: ${mode}`);
		const availableModes = Object.keys(config.modes).join(', ');
		console.error(`Available modes: ${availableModes}`);
		process.exit(1);
	}

	ensureLogsDirectory();
	recoverDevRateLimitBackup();
	if (modeKey === 'docker-prod' || modeKey === 'docker-local') {
		ensureDockerTestDirs();
	}

	// Handle --cache-status flag
	if (cacheStatus) {
		await showCacheStatus(modeConfig.steps);
		return;
	}

	// Caching only applies to qc mode
	const useCache = modeKey === 'qc';

	if (force && useCache) {
		console.log('[FORCE] Bypassing cache, running all steps');
	}

	// Dev-mode crawl tests hit the backend directly against config/{slug}.json,
	// so the docker-prod-only override doesn't cover them. Disable rate-limit
	// in-place for the duration of the run and always restore afterward.
	const modesThatCrawlDev = new Set(['dev', 'screenshots']);
	const restoreDevConfig = modesThatCrawlDev.has(modeKey) ? disableDevRateLimit() : () => {};
	const exitHandler = (): void => restoreDevConfig();
	process.on('exit', exitHandler);
	process.on('SIGINT', exitHandler);
	process.on('SIGTERM', exitHandler);
	process.on('uncaughtException', exitHandler);

	try {
		for (const step of modeConfig.steps) {
			let command = step.command;

			// Pass --screenshot-pages through to crawltest commands
			if (screenshotPages && command.includes('crawltest')) {
				command = command.replace('crawltest.ts', 'crawltest.ts --screenshot-pages');
			}

			await runCommand(command, step.description, shell, force, useCache, step.logFile);
		}
	} finally {
		restoreDevConfig();
	}

	console.log(`\nAll smoke tests for mode '${mode}' completed successfully.`);
}

main().catch((err: unknown) => {
	console.error('Fatal error:', (err as Error).message);
	process.exit(1);
});
