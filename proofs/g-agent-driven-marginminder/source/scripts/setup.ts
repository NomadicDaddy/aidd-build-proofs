#!/usr/bin/env bun
/**
 * Spernakit Setup Script
 *
 * Generates JSON config file (config/{appname}.json) with secure keys
 * and customizes the application with your settings.
 *
 * Usage:
 *   bun run setup
 *   bun run setup --slug myapp --name "My App" --description "My custom app" --frontend-port 3330 --backend-port 3331
 */
import { execSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

interface Config {
	backendPort?: string;
	description?: string;
	frontendPort?: string;
	name?: string;
	slug?: string;
	version?: string;
}

// Parse command line arguments
const args = process.argv.slice(2);
const config: Config = {};

for (let i = 0; i < args.length; i++) {
	switch (args[i]) {
		case '--backend-port':
			config.backendPort = args[++i]!;
			break;
		case '--description':
			config.description = args[++i]!;
			break;
		case '--frontend-port':
			config.frontendPort = args[++i]!;
			break;
		case '--help':
		case '-h':
			console.log(`\nUsage: bun run setup [options]\n`);
			console.log('Options:');
			console.log('  --slug <value>          Application slug (lowercase, no spaces)');
			console.log('  --name <value>           Application name');
			console.log('  --description <value>    Application description');
			console.log(
				'  --version <value>        Application version (default: keep current version)'
			);
			console.log('  --frontend-port <value>  Frontend port (default: 3330)');
			console.log('  --backend-port <value>   Backend port (default: 3331)');
			console.log('  --help, -h               Show this help message\n');
			process.exit(0);
			break;
		case '--name':
			config.name = args[++i]!;
			break;
		case '--slug':
			config.slug = args[++i]!;
			break;
		case '--version':
			config.version = args[++i]!;
			break;
		default:
			console.error(`Unknown option: ${args[i]}`);
			console.error('Use --help for usage information');
			process.exit(1);
	}
}

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});

async function question(prompt: string, defaultValue?: string): Promise<string> {
	const promptWithDefault = defaultValue ? `${prompt} [${defaultValue}]: ` : `${prompt}: `;
	return new Promise((resolve) => {
		rl.question(promptWithDefault, (answer: string) => {
			resolve(answer || defaultValue || '');
		});
	});
}

function readJsonObjectOrNull(filePath: string): null | Record<string, unknown> {
	if (!fs.existsSync(filePath)) {
		return null;
	}
	try {
		const raw = fs.readFileSync(filePath, 'utf8');
		const parsed = JSON.parse(raw) as unknown;
		if (typeof parsed !== 'object' || parsed === null) {
			return null;
		}
		return parsed as Record<string, unknown>;
	} catch {
		return null;
	}
}

function readStringFromObject(obj: Record<string, unknown>, key: string): string | undefined {
	const value = obj[key];
	return typeof value === 'string' ? value : undefined;
}

function readNumberFromObject(obj: Record<string, unknown>, key: string): number | undefined {
	const value = obj[key];
	return typeof value === 'number' ? value : undefined;
}

function inferExistingPromptDefaults(): {
	backendPort?: string;
	description?: string;
	frontendPort?: string;
	name?: string;
	slug?: string;
	version?: string;
} {
	const defaultsPath = path.join(process.cwd(), 'backend', 'src', 'config', 'defaults.json');
	const defaultsJson = readJsonObjectOrNull(defaultsPath);
	const defaultsApp =
		defaultsJson && typeof defaultsJson['app'] === 'object' && defaultsJson['app'] !== null
			? (defaultsJson['app'] as Record<string, unknown>)
			: null;
	const slugFromDefaults = defaultsApp ? readStringFromObject(defaultsApp, 'slug') : undefined;
	const slugCandidate = config.slug ?? slugFromDefaults;
	if (!slugCandidate) {
		return {};
	}

	const configPath = path.join(process.cwd(), 'config', `${slugCandidate}.json`);
	const existingConfig = readJsonObjectOrNull(configPath);
	if (!existingConfig) {
		return { slug: slugCandidate };
	}

	const app =
		typeof existingConfig['app'] === 'object' && existingConfig['app'] !== null
			? (existingConfig['app'] as Record<string, unknown>)
			: null;
	const server =
		typeof existingConfig['server'] === 'object' && existingConfig['server'] !== null
			? (existingConfig['server'] as Record<string, unknown>)
			: null;

	const frontendPort = server ? readNumberFromObject(server, 'frontendPort') : undefined;
	const backendPort = server ? readNumberFromObject(server, 'backendPort') : undefined;

	const result: {
		backendPort?: string;
		description?: string;
		frontendPort?: string;
		name?: string;
		slug?: string;
		version?: string;
	} = {};

	const description = app ? readStringFromObject(app, 'description') : undefined;
	const name = app ? readStringFromObject(app, 'name') : undefined;
	const slug = app ? readStringFromObject(app, 'slug') : undefined;
	const version = app ? readStringFromObject(app, 'version') : undefined;

	if (backendPort !== undefined) {
		result.backendPort = String(backendPort);
	}
	if (description !== undefined) {
		result.description = description;
	}
	if (frontendPort !== undefined) {
		result.frontendPort = String(frontendPort);
	}
	if (name !== undefined) {
		result.name = name;
	}
	result.slug = slug ?? slugCandidate;
	if (version !== undefined) {
		result.version = version;
	}

	return result;
}

function generateSecretKey(length = 64): string {
	return crypto.randomBytes(length).toString('hex');
}

function generateAlphanumericKey(length = 32): string {
	const chars =
		'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@%^&*()_+-=[]{}|;:,.<>?';
	const maxUnbiased = 256 - (256 % chars.length);
	let key = '';
	while (key.length < length) {
		const bytes = crypto.randomBytes(length * 2);
		for (let i = 0; i < bytes.length && key.length < length; i++) {
			const byte = bytes[i]!;
			if (byte < maxUnbiased) {
				key += chars[byte % chars.length];
			}
		}
	}
	return key;
}

function generateEcKeyPair(): EcKeyPair {
	const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
		namedCurve: 'P-256',
		privateKeyEncoding: { format: 'pem', type: 'pkcs8' },
		publicKeyEncoding: { format: 'pem', type: 'spki' },
	});
	return { privateKey, publicKey };
}

function updateFile(filePath: string, replacements: Record<string, string>): void {
	if (!fs.existsSync(filePath)) {
		console.log(`⚠️  File not found: ${filePath}`);
		return;
	}

	let content = fs.readFileSync(filePath, 'utf8');

	for (const [search, replace] of Object.entries(replacements)) {
		content = content.replace(new RegExp(search, 'g'), replace);
	}

	fs.writeFileSync(filePath, content);
	console.log(`✅ Updated: ${filePath}`);
}

function updateJsonFile(filePath: string, updater: (json: Record<string, unknown>) => void): void {
	if (!fs.existsSync(filePath)) {
		console.log(`⚠️  File not found: ${filePath}`);
		return;
	}

	const raw = fs.readFileSync(filePath, 'utf8');
	const json = JSON.parse(raw) as Record<string, unknown>;
	updater(json);
	fs.writeFileSync(filePath, `${JSON.stringify(json, null, '\t')}\n`, 'utf8');
	console.log(`✅ Updated: ${filePath}`);
}

interface SetupSettings {
	appDescription: string;
	appName: string;
	appSlug: string;
	appVersion: string;
	backendPort: string;
	frontendPort: string;
}

interface EcKeyPair {
	privateKey: string;
	publicKey: string;
}

interface SecurityKeys {
	appApiKey: string;
	cookieSecret: string;
	encryptionKey: string;
	jwtKeyPair: EcKeyPair;
	jwtRefreshKeyPair: EcKeyPair;
}

async function collectSettings(): Promise<SetupSettings> {
	const inferredDefaults = inferExistingPromptDefaults();
	return {
		appDescription:
			config.description ||
			(await question('📝 Application description', inferredDefaults.description)),
		appName: config.name || (await question('📝 Application name', inferredDefaults.name)),
		appSlug:
			config.slug ||
			(await question('📝 Application slug (lowercase, no spaces)', inferredDefaults.slug)),
		appVersion:
			config.version ||
			(await question('📝 Application version', inferredDefaults.version ?? '1.0.0')),
		backendPort:
			config.backendPort ||
			(await question('🔧 Backend port', inferredDefaults.backendPort ?? '3331')),
		frontendPort:
			config.frontendPort ||
			(await question('🌐 Frontend port', inferredDefaults.frontendPort ?? '3330')),
	};
}

function generateKeys(): SecurityKeys {
	return {
		appApiKey: generateAlphanumericKey(48),
		cookieSecret: generateAlphanumericKey(32),
		encryptionKey: generateSecretKey(32),
		jwtKeyPair: generateEcKeyPair(),
		jwtRefreshKeyPair: generateEcKeyPair(),
	};
}

function createJsonConfig(s: SetupSettings, keys: SecurityKeys): void {
	const configDir = path.join(process.cwd(), 'config');
	const configPath = path.join(configDir, `${s.appSlug}.json`);
	const defaultsPath = path.join(process.cwd(), 'backend', 'src', 'config', 'defaults.json');
	const frontendUrl = `http://localhost:${s.frontendPort}`;
	const backendUrl = `http://localhost:${s.backendPort}`;
	const databaseUrl = `file:./data/${s.appSlug}.db`;

	if (!fs.existsSync(defaultsPath)) {
		console.log('⚠️  Warning: defaults.json not found, skipping JSON config creation');
		return;
	}

	if (!fs.existsSync(configDir)) {
		fs.mkdirSync(configDir, { recursive: true });
		console.log(`✅ Created: ${configDir}/`);
	}

	const defaults = JSON.parse(fs.readFileSync(defaultsPath, 'utf8')) as Record<string, unknown>;
	const app = defaults['app'] as Record<string, unknown>;
	const server = defaults['server'] as Record<string, unknown>;
	const security = defaults['security'] as Record<string, unknown>;
	const database = defaults['database'] as Record<string, unknown>;
	const rateLimit = defaults['rateLimit'] as Record<string, unknown> | undefined;

	Object.assign(app, { description: s.appDescription, name: s.appName, slug: s.appSlug });
	Object.assign(server, {
		backendPort: Number.parseInt(s.backendPort, 10),
		backendUrl,
		frontendPort: Number.parseInt(s.frontendPort, 10),
		frontendUrl,
	});
	Object.assign(security, {
		applicationApiKey: keys.appApiKey,
		authCookieName: `${s.appSlug}_auth`,
		cookieSecret: keys.cookieSecret,
		csrfCookieName: `${s.appSlug}_csrf`,
		encryptionKey: keys.encryptionKey,
		jwtPrivateKey: keys.jwtKeyPair.privateKey,
		jwtPublicKey: keys.jwtKeyPair.publicKey,
		jwtRefreshPrivateKey: keys.jwtRefreshKeyPair.privateKey,
		jwtRefreshPublicKey: keys.jwtRefreshKeyPair.publicKey,
		refreshCookieName: `${s.appSlug}_refresh`,
	});
	database['url'] = databaseUrl;

	const cors = defaults['cors'] as Record<string, unknown> | undefined;
	if (cors) {
		cors['frontendDevOrigins'] = [frontendUrl];
	}

	// Dev instances ship with rate limiting off so crawltest / spernakit-tester
	// workflows don't trip the 429 cascade on rapid-fire navigation. Production
	// deployments should flip these back to true via SECRET_CONFIG_KEYS env-var
	// injection or manual config edit. defaults.json itself stays production-safe
	// (rateLimit.enabled=true) — the invariant check in check-config-invariants.ts
	// enforces that; this override only affects the generated instance file.
	if (rateLimit) {
		rateLimit['enabled'] = false;
		rateLimit['authEnabled'] = false;
	}

	fs.writeFileSync(configPath, JSON.stringify(defaults, null, '\t'), 'utf8');
	console.log(`✅ Created: ${configPath}`);

	updateJsonFile(defaultsPath, (defaultsJson) => {
		const dApp = defaultsJson['app'] as Record<string, unknown>;
		const dDatabase = defaultsJson['database'] as Record<string, unknown>;
		const dSecurity = defaultsJson['security'] as Record<string, unknown>;
		const dServer = defaultsJson['server'] as Record<string, unknown>;
		Object.assign(dApp, { description: s.appDescription, name: s.appName, slug: s.appSlug });
		Object.assign(dServer, {
			backendPort: Number.parseInt(s.backendPort, 10),
			backendUrl,
			frontendPort: Number.parseInt(s.frontendPort, 10),
			frontendUrl,
		});
		Object.assign(dSecurity, {
			authCookieName: `${s.appSlug}_auth`,
			csrfCookieName: `${s.appSlug}_csrf`,
			refreshCookieName: `${s.appSlug}_refresh`,
		});
		dDatabase['url'] = databaseUrl;
		const dCors = defaultsJson['cors'] as Record<string, unknown> | undefined;
		if (dCors) {
			dCors['frontendDevOrigins'] = [frontendUrl];
		}
	});
}

/**
 * Shared helper for package.json spernakit_version ordering logic.
 * Re-orders keys so spernakit_version appears immediately after version.
 */
function applySpernakitVersionOrdering(
	pkg: Record<string, unknown>,
	appSlug: string,
	spernakitVersion: string
): void {
	const shouldWrite = appSlug !== 'spernakit';
	if (shouldWrite) {
		pkg['spernakit_version'] = spernakitVersion;
	} else {
		delete pkg['spernakit_version'];
	}

	const ordered: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(pkg)) {
		if (key === 'spernakit_version') continue;
		ordered[key] = value;
		if (key === 'version' && shouldWrite) {
			ordered['spernakit_version'] = spernakitVersion;
		}
	}
	if (shouldWrite && !('spernakit_version' in ordered)) {
		ordered['spernakit_version'] = spernakitVersion;
	}
	for (const key of Object.keys(pkg)) delete pkg[key];
	Object.assign(pkg, ordered);
}

function updatePackageJsonFiles(s: SetupSettings): void {
	const githubBase = `https://github.com/NomadicDaddy/${s.appSlug}`;
	const githubMeta = {
		bugs: { url: `${githubBase}/issues` },
		homepage: `${githubBase}#readme`,
		repository: { type: 'git', url: `${githubBase}.git` },
	};

	updateJsonFile('package.json', (pkg) => {
		const spernakitVersion =
			(pkg['spernakit_version'] as string | undefined) ??
			(pkg['version'] as string | undefined) ??
			'1.0.0';
		pkg['name'] = s.appSlug;
		if (s.appVersion) pkg['version'] = s.appVersion;
		pkg['description'] = s.appDescription;
		applySpernakitVersionOrdering(pkg, s.appSlug, spernakitVersion);
		Object.assign(pkg, githubMeta);

		const scripts = pkg['scripts'] as Record<string, string> | undefined;
		if (scripts) {
			if (scripts['docker:image:build']) {
				scripts['docker:image:build'] =
					`docker build -t ghcr.io/nomadicdaddy/${s.appSlug}:latest .`;
			}
			if (scripts['docker:image:push']) {
				scripts['docker:image:push'] =
					`docker push ghcr.io/nomadicdaddy/${s.appSlug}:latest`;
			}
		}
	});

	updateJsonFile('backend/package.json', (pkg) => {
		pkg['name'] = `${s.appSlug}-backend`;
		pkg['description'] = `Backend API for ${s.appName}`;
		delete pkg['version'];
		delete pkg['spernakit_version'];
	});

	updateJsonFile('frontend/package.json', (pkg) => {
		pkg['name'] = `${s.appSlug}-frontend`;
		pkg['description'] = `Frontend application for ${s.appName}`;
		delete pkg['version'];
		delete pkg['spernakit_version'];
	});
}

function updateDockerFiles(s: SetupSettings): void {
	updateFile('Dockerfile', {
		'# Spernakit v3 - Multi-stage Docker Build': `# ${s.appName} - Multi-stage Docker Build`,
		'EXPOSE 3330': `EXPOSE ${s.frontendPort}`,
		'http://127\\.0\\.0\\.1:3330/api/v1/health': `http://127.0.0.1:${s.frontendPort}/api/v1/health`,
	});

	updateFile('docker-compose.yml', {
		"- '3330:3330'": `- '${s.frontendPort}:${s.frontendPort}'`,
		'- BACKEND_PORT=3331': `- BACKEND_PORT=${s.backendPort}`,
		'- FRONTEND_PORT=3330': `- FRONTEND_PORT=${s.frontendPort}`,
		'container_name: spernakit-dev': `container_name: ${s.appSlug}-dev`,
		'http://127\\.0\\.0\\.1:3330/api/v1/health': `http://127.0.0.1:${s.frontendPort}/api/v1/health`,
		'services:\\r?\\n    spernakit:': `services:\n    ${s.appSlug}:`,
	});

	// start.sh now discovers the slug from defaults.json dynamically

	updateFile('docker-compose.production.yml', {
		'- BACKEND_PORT=3331': `- BACKEND_PORT=${s.backendPort}`,
		'- FRONTEND_PORT=3330': `- FRONTEND_PORT=${s.frontendPort}`,
		'APP_SLUG:-spernakit': `APP_SLUG:-${s.appSlug}`,
		'FRONTEND_PORT:-3330': `FRONTEND_PORT:-${s.frontendPort}`,
		'http://127\\.0\\.0\\.1:3330/api/v1/health': `http://127.0.0.1:${s.frontendPort}/api/v1/health`,
		'services:\\r?\\n    spernakit:': `services:\n    ${s.appSlug}:`,
	});
}

function updateBackendFiles(_s: SetupSettings): void {
	// Cookie names (test-helpers, auth tests) are now config-driven via getConfig().security
	// settings-smtp.ts was consolidated into settings routes in v3 — no branding needed
}

function updateFrontendFiles(s: SetupSettings): void {
	// storageKeys, correlationId, Sidebar, MobileNav now use Vite define
	// (__APP_SLUG__, __APP_NAME__) injected from defaults.json at build time.

	// Note: Patterns must handle multi-line formatting in the template
	// Note: Object keys must be sorted alphabetically for linting
	updateFile('frontend/index.html', {
		// JSON-LD structured data
		'"name": "Spernakit v3"': `"name": "${s.appName}"`,

		// Meta tags with author/app name
		'"Spernakit v3" name="apple-mobile-web-app-title"': `"${s.appName}" name="apple-mobile-web-app-title"`,
		'"Spernakit v3" name="application-name"': `"${s.appName}" name="application-name"`,
		'"Spernakit v3" name="author"': `"${s.appName}" name="author"`,
		'"Spernakit v3" name="twitter:title"': `"${s.appName}" name="twitter:title"`,
		'"Spernakit v3" property="og:site_name"': `"${s.appName}" property="og:site_name"`,
		'"Spernakit v3" property="og:title"': `"${s.appName}" property="og:title"`,

		// Page title
		'>Spernakit v3</title>': `>${s.appName}</title>`,

		// og:description and twitter:description
		'Self-Hosted Multi-User Application Template': `${s.appDescription}`,

		// SEO meta description (with prefix)
		'Spernakit v3 - Self-Hosted Multi-User Application Template': `${s.appName} - ${s.appDescription}`,
	});
}

function updateMiscFiles(s: SetupSettings): void {
	updateFile('README.md', {
		'# Spernakit v3': `# ${s.appName}`,
		'config/spernakit\\.json': `config/${s.appSlug}.json`,
		'spernakit/': `${s.appSlug}/`,
		'Spernakit v3 is a': `${s.appName} is a`,
	});

	// smoke.json now uses {{FRONTEND_PORT}}/{{BACKEND_PORT}} tokens
	// substituted at runtime by smoke.ts from app config.
}

function runVerification(): void {
	console.log('\n🔍 Verifying application checks (check-application)...');
	try {
		execSync('bun run check-application', { stdio: 'inherit' });
		console.log('✅ check-application passed.');
	} catch {
		console.error('❌ check-application failed.');
		process.exit(1);
	}
}

function printSummary(s: SetupSettings): void {
	console.log('\n🎉 Setup complete!');
	console.log('\n📋 Configuration:');
	console.log(`   Config file: config/${s.appSlug}.json`);
	console.log('\nNext steps:');
	console.log('1. bun install                # Install dependencies');
	console.log('2. bun run db:setup           # Initialize database');
	console.log('3. bun run dev                # Start development server');
	console.log('\nYour application will be available at:');
	console.log(`- Frontend: http://localhost:${s.frontendPort}`);
	console.log(`- Backend:  http://localhost:${s.backendPort}`);
	console.log(`\n💡 Tip: Edit config/${s.appSlug}.json to customize your application`);
}

async function main(): Promise<void> {
	console.log('🚀 Spernakit Setup\n');
	console.log('This script will help you customize your new application.\n');

	const settings = await collectSettings();

	console.log('\n🔐 Generating security keys...');
	const keys = generateKeys();

	console.log('\n📁 Updating configuration files...');

	createJsonConfig(settings, keys);
	updatePackageJsonFiles(settings);
	updateBackendFiles(settings);
	updateFrontendFiles(settings);
	updateDockerFiles(settings);
	updateMiscFiles(settings);

	const dbDir = 'data';
	if (!fs.existsSync(dbDir)) {
		fs.mkdirSync(dbDir, { recursive: true });
		console.log(`✅ Created: ${dbDir}/`);
	}

	printSummary(settings);
	runVerification();

	rl.close();
}

main().catch((error: unknown) => {
	console.error('❌ Setup failed:', error);
	process.exit(1);
});
