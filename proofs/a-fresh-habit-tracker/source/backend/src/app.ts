/**
 * Elysia application factory. All routes are mounted under `/api/v1`, and every
 * request is logged via the shared pino logger. Kept as a factory (rather than a
 * module-level singleton) so tests and the entrypoint can build isolated apps.
 */
import { Elysia } from 'elysia';

import { logger } from './lib/logger.ts';
import { checkinsRoute } from './routes/checkins.ts';
import { docsRoute } from './routes/docs.ts';
import { habitsRoute } from './routes/habits.ts';
import { healthRoute } from './routes/health.ts';
import { statsRoute } from './routes/stats.ts';

export function createApp() {
	return new Elysia({ prefix: '/api/v1' })
		.onRequest(({ request }) => {
			const { method, url } = request;
			logger.info({ method, path: new URL(url).pathname }, 'request');
		})
		.onError(({ code, error }) => {
			logger.error(
				{ code, err: error instanceof Error ? error.message : String(error) },
				'error'
			);
		})
		.use(docsRoute())
		.use(healthRoute)
		.use(habitsRoute)
		.use(checkinsRoute)
		.use(statsRoute);
}
