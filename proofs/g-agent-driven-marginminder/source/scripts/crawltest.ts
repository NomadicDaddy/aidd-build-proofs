#!/usr/bin/env bun
/*
  crawltest.ts
  - Dynamically discovers all routes in the application via link scraping
  - Visits every route via direct navigation (no goBack)
  - Asserts page content is present and valid
  - Tests interactive elements: buttons, switches, selects, dialog triggers
  - Captures Web Vitals, console errors, console warnings, network errors
  - Generates a detailed test report

  Usage:
    bun scripts/crawltest.ts --mode dev
    bun scripts/crawltest.ts --mode preview
    bun scripts/crawltest.ts --mode dev --screenshot-pages
    bun scripts/crawltest.ts --mode dev --screenshot-pages path/to/dir
    bun scripts/crawltest.ts --mode dev --page /settings/audit-logs
    bun scripts/crawltest.ts --mode dev --start-from /settings
    bun scripts/crawltest.ts --mode dev --404
    bun scripts/crawltest.ts --mode dev --screenshot-pages --404
    bun scripts/crawltest.ts --mode dev --bug

  Screenshots are saved in versioned subdirectories:
    spernakit (template):  screenshots/v{version}/
    derived apps:          screenshots/v{version}-sv{spernakit_version}/

  Config (from JSON config file):
    testing.crawlLoginEmail       -> login email
    testing.crawlLoginPassword    -> login password
    testing.crawlMaxDepth        -> discovery passes (default 3)
    testing.crawlTimeout         -> timeout per action in ms (default 30000)
    testing.crawlInteractionDelay -> ms between element interactions (default 400)
    testing.crawlPageSettleDelay  -> ms to wait after navigation (default 500)
    testing.crawlContentMinLength -> min chars for content assertion (default 50)
*/
import { Database } from 'bun:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer, {
	type Browser,
	type ConsoleMessage,
	type HTTPRequest,
	type HTTPResponse,
	type Page,
} from 'puppeteer';

import type { CrawlerOpts, CrawlerOptions, CrawlerState } from './crawltest-types';

import {
	logCrawlConfig,
	parseMode,
	parsePage,
	parseScreenshotDir,
	parseStartFrom,
	parseTest404,
	parseTestBug,
} from './crawltest-config';
import { assertImageDimensions, assertPageContent, discoverRoutes } from './crawltest-discovery';
import { getInteractiveElements, testInteractiveElements } from './crawltest-interactions';
import {
	cleanupTestData,
	ensureTestDashboard,
	test404Page,
	testBugReport,
} from './crawltest-pages';
import { getVersionedScreenshotDir, printReport } from './crawltest-reporting';
import { TestResults } from './crawltest-results';
import { screenshotPage, screenshotSubTabs } from './crawltest-screenshots';
import {
	BROWSER_RECYCLE_INTERVAL,
	IGNORED_WARNING_PATTERNS,
	isOnLoginPage,
	waitForContent,
} from './crawltest-types';
import { getFrontendUrl, loadJsonConfig } from './load-json-config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

/** Flush rate limit entries so automated crawling isn't throttled by its own traffic. */
function flushRateLimits(): void {
	try {
		const defaultsPath = path.join(ROOT_DIR, 'backend', 'src', 'config', 'defaults.json');
		const defaults = JSON.parse(fs.readFileSync(defaultsPath, 'utf8')) as {
			app?: { slug?: string };
		};
		const slug = defaults.app?.slug ?? 'app';
		const dbPath = path.join(ROOT_DIR, 'data', `${slug}.db`);
		const db = new Database(dbPath);
		db.run('DELETE FROM rate_limit_entries');
		db.close();
	} catch {
		// DB may not exist yet (fresh setup) — safe to ignore
	}
}

// ---------------------------------------------------------------------------
// Crawler
// ---------------------------------------------------------------------------
class WebCrawler {
	private baseUrl: string;
	private browser: Browser | null = null;
	private contentMinLength: number;
	private interactionDelay: number;
	private isLoggedIn = false;
	private loginCredentials: { email: string; password: string } | null = null;
	private maxDepth: number;
	private page: null | Page = null;
	private pageSettleDelay: number;
	private reLoginFailed = false;
	private results: TestResults;
	private screenshotDir: null | string;
	private seedRoutes: string[];
	private singlePage: null | string;
	private startFromRoute: null | string;
	private state: CrawlerState;
	private test404Flag: boolean;
	private testBugFlag: boolean;
	private timeout: number;

	constructor(baseUrl: string, options: CrawlerOptions = {}) {
		this.baseUrl = baseUrl;
		this.maxDepth = options.maxDepth ?? 3;
		this.timeout = options.timeout ?? 30000;
		this.interactionDelay = options.interactionDelay ?? 400;
		this.pageSettleDelay = options.pageSettleDelay ?? 500;
		this.contentMinLength = options.contentMinLength ?? 50;
		this.screenshotDir = options.screenshotDir ?? null;
		this.seedRoutes = options.seedRoutes ?? [];
		this.singlePage = options.page ?? null;
		this.startFromRoute = options.startFrom ?? null;
		this.test404Flag = options.test404 ?? false;
		this.testBugFlag = options.testBug ?? false;
		this.results = new TestResults();
		this.state = {
			cleaningUp: false,
			consecutiveScreenshotFailures: 0,
			createdTestDashboardId: null,
			csrfToken: null,
			navigationCount: 0,
			screenshotDirCreated: false,
			testing404: false,
		};
	}

	// -----------------------------------------------------------------------
	// Shared context accessors
	// -----------------------------------------------------------------------

	private get opts(): CrawlerOpts {
		return {
			baseUrl: this.baseUrl,
			contentMinLength: this.contentMinLength,
			interactionDelay: this.interactionDelay,
			loginCredentials: this.loginCredentials,
			pageSettleDelay: this.pageSettleDelay,
			screenshotDir: this.screenshotDir,
			timeout: this.timeout,
		};
	}

	// -----------------------------------------------------------------------
	// Lifecycle
	// -----------------------------------------------------------------------

	async init(): Promise<void> {
		console.log('🚀 Launching browser...');
		this.browser = await puppeteer.launch({
			args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
			headless: true,
			protocolTimeout: 120_000,
		});
		this.page = await this.browser.newPage();
		await this.page.setViewport({ height: 1080, width: 1920 });

		this.page.on('console', (msg) => this.handleConsoleMessage(msg));
		this.page.on('pageerror', (err: unknown) => this.handlePageError(err));
		this.page.on('requestfailed', (req) => this.handleRequestFailed(req));
		this.page.on('response', (res) => this.handleResponse(res));
	}

	async close(): Promise<void> {
		if (this.browser) {
			await this.browser.close();
		}
	}

	getResults(): TestResults {
		return this.results;
	}

	// -----------------------------------------------------------------------
	// Pre-login: screenshot unauthenticated pages before logging in
	// -----------------------------------------------------------------------

	async screenshotPreLoginPages(): Promise<void> {
		if (!this.page || !this.screenshotDir) return;

		const preLoginRoutes = ['/register'];
		console.log('📷 Screenshotting pre-login pages...');

		for (const route of preLoginRoutes) {
			const url = `${this.baseUrl}${route}`;
			try {
				await this.page.goto(url, {
					timeout: this.timeout,
					waitUntil: 'networkidle2',
				});
				await waitForContent(this.page, this.pageSettleDelay);
				const ssPath = await screenshotPage(
					this.page,
					this.results,
					this.opts,
					this.state,
					ROOT_DIR,
					url
				);
				if (ssPath) console.log(`   📸 Screenshot: ${ssPath}`);
			} catch {
				console.log(`   ⚠️  Failed to screenshot ${route}`);
			}
		}
	}

	// -----------------------------------------------------------------------
	// Login
	// -----------------------------------------------------------------------

	async login(email: string, password: string): Promise<void> {
		if (!this.page) throw new Error('Browser not initialized');

		console.log('🔐 Logging in...');
		try {
			console.log(`   Navigating to ${this.baseUrl}/login...`);
			await this.page.goto(`${this.baseUrl}/login`, {
				timeout: this.timeout,
				waitUntil: 'networkidle2',
			});

			console.log('   Waiting for username field...');
			await this.page.waitForSelector('#username', { timeout: 15000 });

			console.log('   Entering credentials...');
			await this.page.type('#username', email, { delay: 10 });
			await this.page.type('#password', password, { delay: 10 });

			console.log('   Clicking submit button...');
			await this.page.click('button[type="submit"]');

			console.log('   Waiting for dashboard redirect...');
			await this.page.waitForFunction(() => location.pathname === '/dashboard', {
				timeout: 20000,
			});

			console.log('   Waiting for dashboard content to render...');
			await waitForContent(this.page, this.pageSettleDelay);

			console.log('✅ Login successful');
			this.isLoggedIn = true;
			this.loginCredentials = { email, password };
			this.results.visitedUrls.add(`${this.baseUrl}/login`);
		} catch (err: unknown) {
			const typedErr = err instanceof Error ? err : new Error(String(err));
			console.log(`❌ Login failed: ${typedErr.message}`);
			if (this.page) {
				console.log(`   Current URL: ${this.page.url()}`);
				try {
					await this.page.screenshot({ path: 'scripts/login-error.png' });
					console.log('   Screenshot saved to scripts/login-error.png');
				} catch {
					// Ignore screenshot errors
				}
			}
			this.results.addError('LOGIN_ERROR', typedErr.message, { stack: typedErr.stack });
			throw err;
		}
	}

	// -----------------------------------------------------------------------
	// Navigate to start page (no-login mode)
	// -----------------------------------------------------------------------

	async navigateToStart(): Promise<void> {
		if (!this.page) throw new Error('Browser not initialized');

		console.log(`🏠 Navigating to ${this.baseUrl}/...`);
		await this.page.goto(this.baseUrl, {
			timeout: this.timeout,
			waitUntil: 'networkidle2',
		});
		await waitForContent(this.page, this.pageSettleDelay);
		console.log('✅ Start page loaded');
		this.results.visitedUrls.add(this.baseUrl);
	}

	// -----------------------------------------------------------------------
	// Browser recycling — prevent CDP degradation on long crawls
	// -----------------------------------------------------------------------

	private async recycleBrowser(): Promise<boolean> {
		if (this.reLoginFailed) return false;

		console.log('   ♻️  Recycling browser (CDP reset)...');
		flushRateLimits();
		try {
			if (this.browser) {
				try {
					const closePromise = this.browser.close();
					const timer = Bun.sleep(5000).then(() => {
						throw new Error('close timeout');
					});
					await Promise.race([closePromise, timer]);
				} catch {
					const pid = this.browser.process()?.pid;
					if (pid) {
						try {
							process.kill(pid);
						} catch {
							// Process may already be dead
						}
					}
					await Bun.sleep(2000);
				}
				this.browser = null;
				this.page = null;
			}

			this.browser = await puppeteer.launch({
				args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
				headless: true,
				protocolTimeout: 120_000,
			});
			this.page = await this.browser.newPage();
			await this.page.setViewport({ height: 1080, width: 1920 });

			this.page.on('console', (msg) => this.handleConsoleMessage(msg));
			this.page.on('pageerror', (err: unknown) => this.handlePageError(err));
			this.page.on('requestfailed', (req) => this.handleRequestFailed(req));
			this.page.on('response', (res) => this.handleResponse(res));

			if (this.loginCredentials) {
				await this.page.goto(`${this.baseUrl}/login`, {
					timeout: this.timeout,
					waitUntil: 'networkidle2',
				});
				await this.page.waitForSelector('#username', { timeout: 15000 });
				await this.page.type('#username', this.loginCredentials.email, { delay: 10 });
				await this.page.type('#password', this.loginCredentials.password, { delay: 10 });
				await this.page.click('button[type="submit"]');
				await this.page.waitForFunction(() => location.pathname === '/dashboard', {
					timeout: 20000,
				});
				await waitForContent(this.page, this.pageSettleDelay);

				// Verify dashboard actually rendered — if blank, the dev server may
				// be temporarily overwhelmed (e.g. after heavy database admin clicks).
				// Retry with increasing delays to let the server recover.
				for (let attempt = 0; attempt < 3; attempt++) {
					const contentLen = await this.page.evaluate(() => {
						const main = document.querySelector('main');
						return (main ?? document.body).innerText?.trim().length ?? 0;
					});
					if (contentLen > 50) break;
					const delay = 2000 * (attempt + 1);
					console.log(
						`   ⟳ Dashboard content sparse (${contentLen} chars), retrying in ${delay}ms...`
					);
					await Bun.sleep(delay);
					await this.page.reload({
						timeout: this.timeout,
						waitUntil: 'networkidle2',
					});
					await waitForContent(this.page, this.pageSettleDelay);
				}
			}

			this.reLoginFailed = false;
			console.log('   ♻️  Browser recycled successfully');
			return true;
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			console.log(`   ⚠️  Browser recycle failed: ${msg}`);
			this.reLoginFailed = true;
			return false;
		}
	}

	// -----------------------------------------------------------------------
	// Main crawl orchestrator
	// -----------------------------------------------------------------------

	async crawl(): Promise<void> {
		if (!this.page) return;

		// Phase 0: Ensure test data exists for parameterized routes (only when logged in)
		if (this.isLoggedIn) {
			await ensureTestDashboard(this.page, this.state);
		}

		let routes: string[];

		if (this.singlePage) {
			routes = [`${this.baseUrl}${this.singlePage}`];
			this.results.routesDiscovered = 1;
			console.log(`\n📍 Single page mode: testing ${this.singlePage}\n`);
		} else {
			routes = await discoverRoutes(
				this.page,
				this.opts,
				this.seedRoutes,
				this.maxDepth,
				flushRateLimits
			);

			if (this.startFromRoute) {
				const filtered = routes.filter((url) => {
					const pathname = new URL(url).pathname;
					return pathname.startsWith(this.startFromRoute!);
				});

				if (filtered.length === 0) {
					console.log(
						`\n⚠️  No routes found starting from "${this.startFromRoute}". Discovered routes:`
					);
					for (const r of routes) {
						console.log(`   ${new URL(r).pathname}`);
					}
					this.results.routesDiscovered = routes.length;
					if (this.page) await cleanupTestData(this.page, this.state);
					return;
				}

				console.log(
					`\n📍 Discovered ${routes.length} routes, filtered to ${filtered.length} starting from "${this.startFromRoute}"\n`
				);
				this.results.routesDiscovered = routes.length;
				routes = filtered;
			} else {
				this.results.routesDiscovered = routes.length;
				console.log(`\n📍 Discovered ${routes.length} routes to test\n`);
			}
		}

		// Phase 2: Visit each route with full element testing
		for (const [i, route] of routes.entries()) {
			if (i > 0 && this.state.navigationCount >= BROWSER_RECYCLE_INTERVAL) {
				await this.recycleBrowser();
				this.state.navigationCount = 0;
			} else if (this.state.consecutiveScreenshotFailures >= 2) {
				console.log('   ⚠️  Multiple screenshot failures — forcing browser recycle');
				await this.recycleBrowser();
				this.state.consecutiveScreenshotFailures = 0;
				this.state.navigationCount = 0;
			}
			await this.visitRoute(route);
		}

		// Phase 2b: Test 404 page (if --404 flag is set)
		if (this.test404Flag && this.page) {
			await test404Page(this.page, this.results, this.opts, this.state, ROOT_DIR);
		}

		// Phase 2c: Test bug report submission (if --bug flag is set)
		if (this.testBugFlag && this.page) {
			await testBugReport(this.page, this.results, this.opts, this.state, ROOT_DIR);
		}

		// Phase 3: Flush web vitals
		await this.flushWebVitals();

		// Phase 4: Cleanup test data
		if (this.page) await cleanupTestData(this.page, this.state);
	}

	// -----------------------------------------------------------------------
	// Per-route visit: navigate → assert → test elements
	// -----------------------------------------------------------------------

	private async visitRoute(url: string): Promise<void> {
		if (!this.page) return;

		console.log(`\n📄 Testing: ${url}`);

		try {
			await this.navigateWithRetry(url);
			this.state.navigationCount++;
			await waitForContent(this.page, this.pageSettleDelay);

			// Recovery: detect CDP-degraded page (only layout chrome rendered)
			if (await this.isPageDegraded()) {
				console.log('   ⟳ Page appears degraded — reloading...');
				try {
					await this.page.reload({
						timeout: this.timeout,
						waitUntil: 'domcontentloaded',
					});
					await waitForContent(this.page, this.pageSettleDelay);
				} catch {
					// Reload failed
				}
				if (await this.isPageDegraded()) {
					console.log('   ⟳ Still degraded — recycling browser...');
					const ok = await this.recycleBrowser();
					this.state.navigationCount = 0;
					if (ok && this.page) {
						await this.navigateWithRetry(url);
						this.state.navigationCount++;
						await waitForContent(this.page, this.pageSettleDelay);

						// If still degraded after recycle, wait longer for dev server
						// to recover from proxy pressure before giving up
						if (await this.isPageDegraded()) {
							console.log('   ⟳ Still degraded after recycle — extended wait...');
							await Bun.sleep(3000);
							await this.page.reload({
								timeout: this.timeout,
								waitUntil: 'networkidle2',
							});
							await waitForContent(this.page, this.pageSettleDelay);
						}
					}
				}
			}

			if (isOnLoginPage(this.page) && this.loginCredentials) {
				const ok = await this.recycleBrowser();
				this.state.navigationCount = 0;
				if (ok && this.page) {
					await this.navigateWithRetry(url);
					this.state.navigationCount++;
					await waitForContent(this.page, this.pageSettleDelay);
				}
			}

			if (!this.page) return;

			const finalUrl = this.page.url();
			this.results.visitedUrls.add(finalUrl);
			if (finalUrl !== url) {
				this.results.visitedUrls.add(url);
				console.log(`   Redirected to: ${finalUrl}`);
			}

			// Content assertion
			await assertPageContent(this.page, this.results, this.contentMinLength, finalUrl);

			// CLS guard: every <img> must declare explicit dimensions (or CSS aspect-ratio)
			await assertImageDimensions(this.page, this.results, finalUrl);

			// Screenshot (if enabled) — use original URL for filename so redirected
			// pages (e.g. /explorer → /explorer/databases) still produce explorer.png
			const ssPath = await screenshotPage(
				this.page,
				this.results,
				this.opts,
				this.state,
				ROOT_DIR,
				url
			);
			if (ssPath) console.log(`   📸 Screenshot: ${ssPath}`);

			// Screenshot sub-tabs (in-page view switchers)
			const subTabNavs = await screenshotSubTabs(
				this.page,
				this.results,
				this.opts,
				ROOT_DIR,
				finalUrl
			);
			this.state.navigationCount += subTabNavs;

			// Discover and test interactive elements on this page
			const elements = await getInteractiveElements(this.page);
			const testableCount = elements.filter((e) => e.type !== 'link').length;
			console.log(
				`   Found ${elements.length} elements (${testableCount} testable, ${elements.length - testableCount} links)`
			);

			await testInteractiveElements(this.page, this.results, this.opts, elements, finalUrl);
		} catch (err: unknown) {
			const typedErr = err instanceof Error ? err : new Error(String(err));
			this.results.addError('VISIT_ERROR', typedErr.message, { url });
			console.log(`   ❌ Error visiting: ${typedErr.message}`);
		}
	}

	private async isPageDegraded(): Promise<boolean> {
		if (!this.page) return true;
		try {
			return await this.page.evaluate(() => {
				const main = document.querySelector('main');
				const textLen = (main ?? document.body).innerText?.trim().length ?? 0;
				if (textLen > 100) return false;
				// Layout chrome is ~89 chars — check if sidebar rendered
				const sidebarLinks = document.querySelectorAll('aside a');
				return sidebarLinks.length === 0;
			});
		} catch {
			return true;
		}
	}

	private async navigateWithRetry(url: string): Promise<void> {
		if (!this.page) return;
		try {
			await this.page.goto(url, {
				timeout: this.timeout,
				waitUntil: 'domcontentloaded',
			});
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			if (msg.includes('net::ERR_ABORTED')) {
				console.log('   ⟳ Retrying after ERR_ABORTED...');
				await Bun.sleep(500);
				await this.page.goto(url, {
					timeout: this.timeout,
					waitUntil: 'domcontentloaded',
				});
			} else {
				throw err;
			}
		}
	}

	// -----------------------------------------------------------------------
	// Web Vitals flush
	// -----------------------------------------------------------------------

	private async flushWebVitals(): Promise<void> {
		if (!this.page) return;

		try {
			await this.page.evaluate(() => {
				document.dispatchEvent(new Event('visibilitychange'));
			});
			await Bun.sleep(500);
		} catch {
			// Page context may have been destroyed after a failed navigation
		}
	}

	// -----------------------------------------------------------------------
	// Event handlers
	// -----------------------------------------------------------------------

	private isIgnoredUrl(url: string): boolean {
		return (
			url.includes('.map') ||
			url.includes('/src/') ||
			url.includes('/@') ||
			url.includes('node_modules') ||
			url.includes('favicon.ico')
		);
	}

	private handleConsoleMessage(msg: ConsoleMessage): void {
		if (!this.page) return;
		const type = msg.type();
		const text = msg.text();

		if ((type === 'log' || type === 'debug') && text.startsWith('[Web Vitals] ')) {
			try {
				const data = JSON.parse(text.substring('[Web Vitals] '.length)) as Record<
					string,
					unknown
				>;
				this.results.addWebVital({
					name: data.name as string,
					navigationType: data.navigationType as string,
					rating: data.rating as string,
					timestamp: new Date().toISOString(),
					url: this.page.url(),
					value: data.value as number,
				});
			} catch {
				console.log(`⚠️  Failed to parse Web Vitals: ${text}`);
			}
			return;
		}

		if (type === 'warn') {
			if (IGNORED_WARNING_PATTERNS.some((p) => p.test(text))) return;
			this.results.addConsoleWarning(text, this.page.url());
			console.log(`⚠️  Console Warning: ${text}`);
			return;
		}

		if (type === 'error') {
			if (
				!this.isLoggedIn &&
				(text.includes('401 (Unauthorized)') || text.includes('API Error: 401'))
			) {
				return;
			}
			if (text.includes('[Web Vitals]')) return;
			if (text.includes('favicon.ico') || text.includes('Failed to load resource')) return;
			if (text.includes('Content Security Policy') && text.includes('data:font/')) return;

			this.results.addConsoleError(text, this.page.url());
			console.log(`❌ Console Error: ${text}`);
		}
	}

	private handlePageError(err: unknown): void {
		const error = err as Error;
		// WebSocket reconnection noise during rapid crawl navigation — not a real error
		if (error.message?.includes('send was called before connect')) return;
		if (this.page) {
			this.results.addError('PAGE_ERROR', error.message, {
				stack: error.stack,
				url: this.page.url(),
			});
		}
		console.log(`❌ Page Error: ${error.message}`);
	}

	private handleRequestFailed(request: HTTPRequest): void {
		const url = request.url();
		if (this.isIgnoredUrl(url)) return;
		if (url.startsWith('data:')) return;

		const failure = request.failure();
		if (failure && failure.errorText === 'net::ERR_ABORTED') return;

		this.results.addNetworkError(url, failure?.errorText ?? 'Unknown', 'Request Failed');
		console.log(`❌ Network Error: ${url} - ${failure?.errorText}`);
	}

	private handleResponse(response: HTTPResponse): void {
		const url = response.url();
		if (this.isIgnoredUrl(url)) return;

		// Capture CSRF token from login response for use in ensureTestDashboard/cleanupTestData
		if (url.includes('/auth/login') && response.status() === 200) {
			const csrf = response.headers()['x-csrf-token'];
			if (csrf) {
				this.state.csrfToken = csrf;
			}
		}

		if (response.status() >= 400) {
			if (!this.isLoggedIn && response.status() === 401) return;
			if (response.status() === 401 && this.loginCredentials) return;
			if (this.state.testing404 && response.status() === 404) return;
			if (this.state.cleaningUp) return;
			if (response.status() === 429) return;
			if (response.status() === 403 && url.includes('/auth/demo-accounts')) return;
			// rotate-backup-key returns 400 when no rotation is staged (the default
			// state) — the click-discovery walks the SYSOP rotate button and the
			// validator response is intentional UX, not a regression.
			if (
				response.status() === 400 &&
				url.includes('/settings/auth-security/rotate-backup-key')
			) {
				return;
			}

			this.results.addNetworkError(url, response.status(), response.statusText());
			console.log(`❌ HTTP Error: ${response.status()} ${response.statusText()} - ${url}`);
		}
	}
}

// ---------------------------------------------------------------------------
// Main execution
// ---------------------------------------------------------------------------

async function run(): Promise<void> {
	const args = process.argv.slice(2);
	const mode = parseMode(args);
	const rawScreenshotDir = parseScreenshotDir(args);
	const singlePage = parsePage(args);
	const startFrom = parseStartFrom(args);
	const test404 = parseTest404(args);
	const testBug = parseTestBug(args);

	// Validate mutual exclusivity
	if (singlePage && startFrom) {
		console.error('--page and --start-from cannot be used together.');
		process.exit(1);
	}

	// Load JSON config
	const { config } = loadJsonConfig(ROOT_DIR);

	// Compute versioned screenshot directory
	const screenshotDir = rawScreenshotDir
		? getVersionedScreenshotDir(rawScreenshotDir, ROOT_DIR)
		: null;

	// Get configuration values
	const baseUrl = getFrontendUrl(config, mode);
	const loginEmail = config.testing?.crawlLoginEmail;
	const loginPassword = config.testing?.crawlLoginPassword;
	const maxDepth = config.testing?.crawlMaxDepth ?? 3;
	const timeout = config.testing?.crawlTimeout ?? 30000;
	const interactionDelay = config.testing?.crawlInteractionDelay ?? 400;
	const pageSettleDelay = config.testing?.crawlPageSettleDelay ?? 500;
	const contentMinLength = config.testing?.crawlContentMinLength ?? 50;
	const seedRoutes = config.testing?.crawlSeedRoutes ?? [];
	const requiresLogin = Boolean(loginEmail && loginPassword);

	logCrawlConfig({
		baseUrl,
		contentMinLength,
		interactionDelay,
		maxDepth,
		mode,
		pageSettleDelay,
		screenshotDir,
		singlePage,
		startFrom,
		test404,
		testBug,
		timeout,
	});

	const crawler = new WebCrawler(baseUrl, {
		contentMinLength,
		interactionDelay,
		maxDepth,
		page: singlePage,
		pageSettleDelay,
		screenshotDir,
		seedRoutes,
		startFrom,
		test404,
		testBug,
		timeout,
	});

	try {
		await crawler.init();
		flushRateLimits();
		if (requiresLogin) {
			await crawler.screenshotPreLoginPages();
			await crawler.login(loginEmail!, loginPassword!);
		} else {
			console.log('ℹ️  No login credentials configured — crawling as anonymous user');
			await crawler.navigateToStart();
		}
		await crawler.crawl();

		console.log('\n✅ Crawl completed!');
	} catch (err: unknown) {
		const typedErr = err instanceof Error ? err : new Error(String(err));
		console.error('\n❌ Crawl failed:', typedErr.message);
	} finally {
		await crawler.close();

		const report = crawler.getResults().generateReport();
		const reportPath = path.join(__dirname, '../logs/crawltest.json');
		await Bun.write(reportPath, JSON.stringify(report, null, 2));
		printReport(report, reportPath);
	}
}

run().catch((e: unknown) => {
	console.error('Fatal error:', e);
	process.exit(1);
});
