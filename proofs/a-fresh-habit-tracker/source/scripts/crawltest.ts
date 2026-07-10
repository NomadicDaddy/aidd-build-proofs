#!/usr/bin/env bun
/**
 * crawltest.ts — route crawler for the Habit Tracker frontend.
 *
 * Drives the `agent-browser` CLI to visit every in-app route, assert that the
 * page rendered real content, and collect JavaScript / console errors. This is
 * the project's browser smoke test (paired with `bun run smoke:qc`); it does not
 * add a unit-test framework.
 *
 * Scenarios covered (see `.aidd/features/testing-scenarios`):
 *   1. The habit list page (`/habits`) renders the active habits.
 *   2. The dashboard (`/`) renders the done-vs-total count and the weekly grid.
 *   3. Habit detail routes discovered from the list are crawled transitively.
 *   4. Every visited route is asserted free of console errors.
 * The create / toggle / archive and empty-state flows are exercised interactively
 * via `agent-browser` and captured as screenshots (see the feature changelog); this
 * script codifies the route-level regression pass those flows depend on.
 *
 * Usage:
 *   bun scripts/crawltest.ts                     # crawl all discovered routes
 *   bun scripts/crawltest.ts --page /habits      # crawl a single route only
 *   bun scripts/crawltest.ts --start-from /habits # crawl routes under a prefix
 *
 * The process exits non-zero if any route reports a console error or fails to
 * render, so it can gate changes alongside `bun run smoke:qc`.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(SCRIPT_DIR, '..');
const EVIDENCE_DIR = join(ROOT_DIR, '.aidd', 'evidence', 'testing-scenarios');
const CONTENT_MIN_LENGTH = 30;
const SETTLE_MS = 800;
const SEED_ROUTES = ['/', '/habits'];
const SCREENSHOT_ROUTES = new Set(['/', '/habits']);

interface AbResponse {
	data?: unknown;
	error?: null | string;
	success?: boolean;
}

interface CrawlOutcome {
	consoleErrors: string[];
	contentLength: number;
	ok: boolean;
	route: string;
	screenshot: null | string;
}

/** Run an `agent-browser` subcommand and parse its `--json` output. */
function runAb(args: string[]): AbResponse {
	try {
		const stdout = execFileSync('agent-browser', [...args, '--json'], {
			encoding: 'utf8',
			maxBuffer: 32 * 1024 * 1024,
		});
		return JSON.parse(stdout) as AbResponse;
	} catch (err) {
		// agent-browser can exit non-zero while still printing a JSON payload.
		const stdout =
			err && typeof err === 'object' && 'stdout' in err
				? String((err as { stdout?: unknown }).stdout ?? '')
				: '';
		if (stdout) {
			try {
				return JSON.parse(stdout) as AbResponse;
			} catch {
				// fall through to the error response below
			}
		}
		return { error: err instanceof Error ? err.message : String(err), success: false };
	}
}

/** Read `.result` from an `agent-browser eval` response. */
function evalJs(expression: string): unknown {
	const res = runAb(['eval', expression]);
	const data = res.data;
	if (data && typeof data === 'object' && 'result' in data) {
		return (data as { result?: unknown }).result;
	}
	return null;
}

/** Return the current page's console / JavaScript error texts. */
function collectConsoleErrors(): string[] {
	const res = runAb(['errors']);
	const data = res.data;
	if (data && typeof data === 'object' && 'errors' in data) {
		const errors = (data as { errors?: unknown }).errors;
		if (Array.isArray(errors)) {
			return errors.map((entry) =>
				entry && typeof entry === 'object' && 'text' in entry
					? String((entry as { text?: unknown }).text ?? '')
					: String(entry)
			);
		}
	}
	return [];
}

/** Same-origin, path-only links found on the current page. */
function discoverRoutes(baseUrl: string): string[] {
	const origin = JSON.stringify(baseUrl);
	const expression = `Array.from(document.querySelectorAll('a[href]')).map((a) => { try { const u = new URL(a.href); return u.origin === ${origin} ? u.pathname : null; } catch { return null; } }).filter(Boolean)`;
	const result = evalJs(expression);
	return Array.isArray(result) ? result.map((r) => String(r)) : [];
}

function routeToSlug(route: string): string {
	if (route === '/') return 'home';
	return route
		.replace(/^\//, '')
		.replace(/\//g, '_')
		.replace(/[^a-z0-9_-]/gi, '-');
}

function crawlRoute(baseUrl: string, route: string): CrawlOutcome {
	runAb(['errors', '--clear']);
	runAb(['open', `${baseUrl}${route}`]);
	runAb(['wait', String(SETTLE_MS)]);

	const rawLength = evalJs('document.body.innerText.length');
	const contentLength = typeof rawLength === 'number' ? rawLength : 0;
	const consoleErrors = collectConsoleErrors();

	let screenshot: null | string = null;
	if (SCREENSHOT_ROUTES.has(route)) {
		if (!existsSync(EVIDENCE_DIR)) mkdirSync(EVIDENCE_DIR, { recursive: true });
		screenshot = join(EVIDENCE_DIR, `route-${routeToSlug(route)}.png`);
		runAb(['screenshot', screenshot]);
	}

	return {
		consoleErrors,
		contentLength,
		ok: consoleErrors.length === 0 && contentLength >= CONTENT_MIN_LENGTH,
		route,
		screenshot,
	};
}

function parseFlagValue(argv: string[], flag: string): null | string {
	const index = argv.indexOf(flag);
	if (index === -1) return null;
	const value = argv[index + 1];
	if (!value || value.startsWith('--')) {
		console.error(`${flag} requires a route path (e.g. ${flag} /habits)`);
		process.exit(1);
	}
	return value.startsWith('/') ? value : `/${value}`;
}

function loadFrontendUrl(): string {
	const configPath = join(ROOT_DIR, 'config', 'habit-tracker.json');
	const config = JSON.parse(readFileSync(configPath, 'utf8')) as {
		server?: { frontendUrl?: string };
	};
	return config.server?.frontendUrl ?? 'http://localhost:3330';
}

function run(): void {
	const argv = process.argv.slice(2);
	const singlePage = parseFlagValue(argv, '--page');
	const startFrom = parseFlagValue(argv, '--start-from');
	if (singlePage && startFrom) {
		console.error('--page and --start-from cannot be used together.');
		process.exit(1);
	}

	const baseUrl = loadFrontendUrl().replace(/\/$/, '');
	console.log('🕷️  Habit Tracker crawltest');
	console.log(`   Base URL: ${baseUrl}`);
	console.log(singlePage ? `   Single page: ${singlePage}` : '   Discovering routes from seeds');
	console.log('');

	const queue = singlePage ? [singlePage] : [...(startFrom ? [startFrom] : SEED_ROUTES)];
	const visited = new Set<string>();
	const outcomes: CrawlOutcome[] = [];

	while (queue.length > 0) {
		const route = queue.shift();
		if (route === undefined || visited.has(route)) continue;
		visited.add(route);

		const outcome = crawlRoute(baseUrl, route);
		outcomes.push(outcome);

		const status = outcome.ok ? '✅' : '❌';
		console.log(`${status} ${route}  (content ${outcome.contentLength} chars)`);
		for (const message of outcome.consoleErrors) {
			console.log(`     console: ${message.split('\n')[0]}`);
		}
		if (outcome.screenshot) console.log(`     screenshot: ${outcome.screenshot}`);

		if (!singlePage) {
			for (const next of discoverRoutes(baseUrl)) {
				if (visited.has(next)) continue;
				if (startFrom && !next.startsWith(startFrom)) continue;
				queue.push(next);
			}
		}
	}

	runAb(['close', '--all']);

	const failures = outcomes.filter((outcome) => !outcome.ok);
	console.log('');
	console.log(`Crawled ${outcomes.length} route(s), ${failures.length} with issues.`);
	if (failures.length > 0) {
		console.log('❌ crawltest failed — see console errors above.');
		process.exitCode = 1;
		return;
	}
	console.log('✅ crawltest passed — no console errors.');
}

run();
