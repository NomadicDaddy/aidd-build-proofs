/**
 * JSON configuration loader for the backend.
 *
 * Reads `config/{slug}.json` from the project root (JSON-only, no `.env`) and
 * exposes a typed, validated configuration object. The database URL from config
 * (`file:./data/habit-tracker.db`) is resolved to an absolute path anchored at
 * the project root so the SQLite file always lands in `data/` — never inside
 * `backend/` or wherever the process happens to be launched from.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface AppConfig {
	app: AppSection;
	database: DatabaseSection;
	server: ServerSection;
}

interface AppSection {
	description: string;
	name: string;
	slug: string;
}

interface DatabaseSection {
	allowDbPush: boolean;
	url: string;
}

export interface ResolvedConfig extends AppConfig {
	/** Absolute path to the SQLite database file under the project's data/ dir. */
	databasePath: string;
	/** Absolute path of the project root the config was resolved against. */
	projectRoot: string;
}

interface ServerSection {
	backendPort: number;
	backendUrl: string;
	frontendPort: number;
	frontendUrl: string;
}

/** Project root is three levels up from backend/src/lib. */
const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(MODULE_DIR, '..', '..', '..');

const DEFAULT_SLUG = 'habit-tracker';

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error(`Invalid config: ${message}`);
}

/** Convert a `file:./relative/path.db` (or absolute) URL into an absolute path. */
function resolveDatabasePath(url: string, root: string): string {
	const withoutScheme = url.startsWith('file:') ? url.slice('file:'.length) : url;
	if (isAbsolute(withoutScheme)) return withoutScheme;
	return resolve(root, withoutScheme);
}

function validate(raw: unknown): AppConfig {
	assert(typeof raw === 'object' && raw !== null, 'root must be an object');
	const cfg = raw as Record<string, unknown>;

	const app = cfg.app as Record<string, unknown> | undefined;
	assert(app && typeof app.name === 'string', 'app.name is required');
	assert(typeof app.slug === 'string', 'app.slug is required');
	assert(typeof app.description === 'string', 'app.description is required');

	const database = cfg.database as Record<string, unknown> | undefined;
	assert(database && typeof database.url === 'string', 'database.url is required');
	assert(typeof database.allowDbPush === 'boolean', 'database.allowDbPush is required');

	const server = cfg.server as Record<string, unknown> | undefined;
	assert(server && typeof server.backendPort === 'number', 'server.backendPort is required');
	assert(typeof server.backendUrl === 'string', 'server.backendUrl is required');
	assert(typeof server.frontendPort === 'number', 'server.frontendPort is required');
	assert(typeof server.frontendUrl === 'string', 'server.frontendUrl is required');

	return {
		app: {
			description: app.description as string,
			name: app.name as string,
			slug: app.slug as string,
		},
		database: {
			allowDbPush: database.allowDbPush,
			url: database.url as string,
		},
		server: {
			backendPort: server.backendPort,
			backendUrl: server.backendUrl as string,
			frontendPort: server.frontendPort,
			frontendUrl: server.frontendUrl as string,
		},
	};
}

/** Load and validate the app config, resolving derived paths against the root. */
export function loadConfig(slug: string = DEFAULT_SLUG): ResolvedConfig {
	const configPath = join(PROJECT_ROOT, 'config', `${slug}.json`);
	if (!existsSync(configPath)) {
		throw new Error(`Config file not found at ${configPath}. Run \`bun run setup\` first.`);
	}

	const raw = JSON.parse(readFileSync(configPath, 'utf8')) as unknown;
	const config = validate(raw);

	return {
		...config,
		databasePath: resolveDatabasePath(config.database.url, PROJECT_ROOT),
		projectRoot: PROJECT_ROOT,
	};
}

let cached: null | ResolvedConfig = null;

/** Memoized accessor so the config file is read once per process. */
export function getConfig(): ResolvedConfig {
	if (cached === null) cached = loadConfig();
	return cached;
}
