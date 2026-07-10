/**
 * Health route: GET /api/v1/health → { status, uptime, timestamp }.
 *
 * A lightweight liveness probe used by the launcher and smoke checks to confirm
 * the backend is up before exercising other routes.
 */
import { Elysia, t } from 'elysia';

export const healthRoute = new Elysia().get(
	'/health',
	() => ({
		status: 'ok' as const,
		timestamp: new Date().toISOString(),
		uptime: process.uptime(),
	}),
	{
		detail: { tags: ['Health'] },
		response: t.Object({
			status: t.Literal('ok'),
			timestamp: t.String(),
			uptime: t.Number(),
		}),
	}
);
