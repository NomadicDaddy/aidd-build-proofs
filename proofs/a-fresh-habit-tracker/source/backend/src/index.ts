/**
 * Backend entrypoint. Loads config, builds the Elysia app, and listens on the
 * configured backend port. The database path is resolved and logged at startup
 * so it is easy to confirm the SQLite file lands under the project's data/ dir.
 */
import { createApp } from './app.ts';
import { getConfig } from './lib/config.ts';
import { logger } from './lib/logger.ts';

const config = getConfig();
const app = createApp();

app.listen(config.server.backendPort, () => {
	logger.info(
		{
			databasePath: config.databasePath,
			port: config.server.backendPort,
			url: `${config.server.backendUrl}/api/v1`,
		},
		`${config.app.name} backend listening`
	);
});

export { app };
