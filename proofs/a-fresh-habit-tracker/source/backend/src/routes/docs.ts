/**
 * OpenAPI documentation plugin.
 *
 * Mounted inside the app's `/api/v1` prefix, so the generated OpenAPI JSON is
 * served at `/api/v1/docs/json` and the interactive UI at `/api/v1/docs`. The
 * spec is derived automatically from the TypeBox `body`/`params`/`response`
 * schemas declared on each route, so it stays in sync with the actual request
 * and response validation — the OpenAPI document is the contract source of truth.
 */
import { swagger } from '@elysiajs/swagger';
import { Elysia } from 'elysia';

import { getConfig } from '../lib/config.ts';

export function docsRoute() {
	const config = getConfig();
	return new Elysia().use(
		swagger({
			documentation: {
				info: {
					description: config.app.description,
					title: `${config.app.name} API`,
					version: '1.0.0',
				},
				tags: [
					{ description: 'Create, list, update, and archive habits.', name: 'Habits' },
					{
						description: "Mark, unmark, and list a habit's completed days.",
						name: 'Check-ins',
					},
					{ description: 'Service liveness.', name: 'Health' },
				],
			},
			path: '/docs',
		})
	);
}
