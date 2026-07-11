import { Elysia } from 'elysia';

import { incrementRequestCount } from '../services/metricsService.ts';
import { logApi } from '../utils/logger.ts';
import { requestIdPlugin } from './requestId.ts';

const loggerPlugin = new Elysia({ name: 'logger' })
	.use(requestIdPlugin)
	.state('requestStart', undefined as number | undefined)
	.onRequest(({ store }) => {
		store.requestStart = Date.now();
		incrementRequestCount();
	})
	.onAfterResponse(({ request, requestId, sessionId, set, store }) => {
		const url = new URL(request.url);
		const duration = store.requestStart ? Date.now() - store.requestStart : undefined;
		const status = typeof set.status === 'number' ? set.status : 200;

		const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';

		logApi(level, `${request.method} ${url.pathname}`, {
			duration,
			method: request.method,
			path: url.pathname,
			requestId,
			sessionId,
			status,
		});
	})
	.onError(({ error, request, requestId, sessionId, set }) => {
		const url = new URL(request.url);
		const status = typeof set.status === 'number' ? set.status : 500;
		const isError = error instanceof Error;

		logApi('error', `${request.method} ${url.pathname} unhandled error`, {
			error: isError ? error.message : String(error),
			method: request.method,
			path: url.pathname,
			requestId,
			sessionId,
			...(isError && error.stack ? { stack: error.stack } : {}),
			status,
		});
	});

export { loggerPlugin };
