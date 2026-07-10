/**
 * Drizzle Kit configuration for `db:push` / `db:generate`.
 *
 * The database URL is taken from the app config's resolved absolute path so the
 * SQLite file always lands under the project-root `data/` directory, matching
 * the runtime client. Migrations are emitted to `backend/drizzle/`.
 */
import { defineConfig } from 'drizzle-kit';

import { loadConfig } from './src/lib/config.ts';

const config = loadConfig();

export default defineConfig({
	breakpoints: true,
	dbCredentials: { url: config.databasePath },
	dialect: 'sqlite',
	out: './drizzle',
	schema: './src/db/schema',
	strict: true,
	verbose: true,
});
