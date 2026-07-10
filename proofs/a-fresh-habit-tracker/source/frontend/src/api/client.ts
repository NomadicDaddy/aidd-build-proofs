/**
 * Minimal JSON fetch wrapper for the habit-tracker API. All backend routes live
 * under `/api/v1`; requests are same-origin in production and proxied to the
 * backend during development (see `vite.config.ts`). Uses native `fetch` — no
 * Axios or other HTTP client dependency.
 */

const API_BASE = '/api/v1';

/** Error thrown when the API responds with a non-2xx status. */
export class ApiError extends Error {
	readonly status: number;

	constructor(status: number, message: string) {
		super(message);
		this.name = 'ApiError';
		this.status = status;
	}
}

interface RequestOptions {
	body?: unknown;
	method?: string;
	signal?: AbortSignal | undefined;
}

/** Pull an `{ error }` message out of a failed response, falling back to status. */
async function parseError(response: Response): Promise<string> {
	try {
		const data = (await response.json()) as { error?: string };
		if (typeof data.error === 'string') return data.error;
	} catch {
		// Body was empty or not JSON; fall through to the status-based message.
	}
	return response.statusText || `Request failed with status ${response.status}`;
}

/**
 * Issue a JSON request and decode the response body. Returns `undefined` for
 * empty `204 No Content` responses, and throws `ApiError` on any non-2xx status.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
	const { body, method = 'GET', signal } = options;

	const init: RequestInit = { method, signal: signal ?? null };
	if (body !== undefined) {
		init.body = JSON.stringify(body);
		init.headers = { 'Content-Type': 'application/json' };
	}

	const response = await fetch(`${API_BASE}${path}`, init);

	if (!response.ok) {
		throw new ApiError(response.status, await parseError(response));
	}

	if (response.status === 204) {
		return undefined as T;
	}

	return (await response.json()) as T;
}
