import type { ApiKeyScope } from '../types/apiKeys.ts';
import type { UserRole } from '../types/roles.ts';
import type { AuthPayload } from './authTokens.ts';

import { getConfig } from '../config/configLoader.ts';
import { validateApiKey } from '../services/apiKeyService.ts';
import { isTokenRevoked, isUserTokensRevokedAfter } from '../utils/auth/tokenBlacklist.ts';
import { logger } from '../utils/logger.ts';
import { parseCookies, verifyAccessToken } from './authTokens.ts';

const apiKeyScopeToRole: Record<ApiKeyScope, UserRole> = {
	admin: 'ADMIN',
	read: 'VIEWER',
	write: 'OPERATOR',
};

function resolveUserFromRequest(request: Request): AuthPayload | null {
	const config = getConfig();
	const cookieHeader = request.headers.get('cookie');
	if (!cookieHeader) return null;

	const cookies = parseCookies(cookieHeader);
	const accessToken = cookies[config.security.authCookieName];
	if (!accessToken) return null;

	if (isTokenRevoked(accessToken)) {
		logger.debug('Access token has been revoked');
		return null;
	}

	const payload = verifyAccessToken(accessToken);
	if (!payload) {
		logger.debug('Invalid or expired access token');
		return null;
	}

	const iat = (payload as AuthPayload & { iat?: number }).iat;
	if (iat && isUserTokensRevokedAfter(payload.id, new Date(iat * 1000))) {
		logger.debug({ userId: payload.id }, 'User tokens revoked after token issuance');
		return null;
	}

	return payload;
}

async function resolveApiKeyUser(
	request: Request,
	apiKeyHeader: string
): Promise<AuthPayload | null> {
	const hasHmacHeaders =
		request.headers.get('x-api-signature') !== null &&
		request.headers.get('x-api-timestamp') !== null &&
		request.headers.get('x-api-nonce') !== null;

	let validated;
	if (hasHmacHeaders) {
		const timestamp = Number.parseInt(request.headers.get('x-api-timestamp') ?? '0', 10);
		const url = new URL(request.url);
		const body = await request.clone().text();
		validated = await validateApiKey({
			apiKey: apiKeyHeader,
			body,
			method: request.method,
			nonce: request.headers.get('x-api-nonce') ?? '',
			path: url.pathname + url.search,
			signature: request.headers.get('x-api-signature') ?? '',
			timestamp,
		});
	} else {
		validated = await validateApiKey(apiKeyHeader);
	}

	if (!validated) return null;

	return {
		id: validated.createdBy,
		isApiKey: true,
		role: apiKeyScopeToRole[validated.keyScope] ?? 'VIEWER',
	};
}

export { resolveApiKeyUser, resolveUserFromRequest };
