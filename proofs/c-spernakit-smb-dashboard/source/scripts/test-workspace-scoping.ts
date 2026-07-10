#!/usr/bin/env bun
/**
 * Verification for feature `workspace-scoping` (Workspace-aware asset boundaries
 * where enabled).
 *
 * Proves, in-process against a throwaway temp-file SQLite DB via app.handle():
 *  1. With `app.workspaces_enabled` ON, a non-SYSOP member of workspace A who
 *     selects workspace A (X-Workspace-ID: A) sees ONLY workspace A's assets.
 *  2. The same user selecting a workspace they do NOT belong to (workspace B)
 *     is rejected 403 by the workspaceAccess guard — no cross-workspace read.
 *  3. Fetching a single asset that lives in workspace B while scoped to
 *     workspace A returns 404 (the boundary is indistinguishable from missing).
 *  4. A non-SYSOP with NO workspace header is rejected 400 (must select a
 *     workspace) — scoping is enforced, not silently bypassed.
 *  5. A SYSOP with NO workspace header reads across ALL workspaces (bypass).
 *  6. Relationships and services are scoped the same way (member sees only A).
 *  7. With the feature OFF, the same non-SYSOP user (no header) sees every
 *     asset — single-inventory behaviour is preserved.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getConfig, initializeConfig } from '../backend/src/config/configLoader.ts';
import { createApiApp } from '../backend/src/create-api-app.ts';
import { runAutoMigrations } from '../backend/src/db/autoMigrate.ts';
import { closeDatabase, getDb, initializeDatabase } from '../backend/src/db/index.ts';
import { assetRelationships } from '../backend/src/db/schema/assetRelationships.ts';
import { assets } from '../backend/src/db/schema/assets.ts';
import { serviceCatalog } from '../backend/src/db/schema/services.ts';
import { users } from '../backend/src/db/schema/users.ts';
import { workspaceMembers, workspaces } from '../backend/src/db/schema/workspaces.ts';
import { signTokenPair } from '../backend/src/plugins/auth.ts';
import { update as upsertSetting } from '../backend/src/services/settingsService.ts';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WS_A = 1;
const WS_B = 2;
const SYSOP_ID = 1;
const OPERATOR_ID = 2;

const failures: string[] = [];
function assert(condition: boolean, message: string): void {
	if (!condition) failures.push(message);
}

/** Toggle the app.workspaces_enabled feature flag in the settings table. */
function setWorkspacesEnabled(enabled: boolean): void {
	upsertSetting({
		key: 'app.workspaces_enabled',
		updatedBy: null,
		value: enabled ? 'true' : 'false',
	});
}

/** Minimal app surface used here — avoids referencing Elysia's very deep type. */
interface HandleableApp {
	handle: (request: Request) => Promise<Response>;
}

/** GET request against the in-process app, returning status + parsed body. */
async function getJson(
	app: HandleableApp,
	path: string,
	accessToken: string,
	workspaceId?: number
): Promise<{ body: unknown; status: number }> {
	const headers: Record<string, string> = {
		cookie: `${getConfig().security.authCookieName}=${accessToken}`,
	};
	if (workspaceId !== undefined) headers['X-Workspace-ID'] = String(workspaceId);
	const response = await app.handle(
		new Request(`http://localhost/api/v1${path}`, { headers, method: 'GET' })
	);
	const text = await response.text();
	let body: unknown;
	try {
		body = JSON.parse(text);
	} catch {
		body = text;
	}
	return { body, status: response.status };
}

/** Count the rows in a paginated list envelope. */
function rowCount(body: unknown): number {
	const data = (body as { data?: unknown[] })?.data;
	return Array.isArray(data) ? data.length : -1;
}

async function run(): Promise<void> {
	initializeConfig();
	getConfig().rateLimit.enabled = false;

	const tmpDir = mkdtempSync(join(tmpdir(), 'spernakit-workspace-scope-'));
	const dbPath = join(tmpDir, 'test.db');
	const migrationsDir = join(repoRoot, 'backend', 'drizzle');

	runAutoMigrations(dbPath, migrationsDir);
	initializeDatabase(dbPath);
	const db = getDb();

	// Two users: a SYSOP and an OPERATOR. The OPERATOR belongs to workspace A only.
	// passwordHash is never exercised — auth uses directly-minted access tokens.
	const passwordHash = 'x'.repeat(60);
	db.insert(users)
		.values([
			{
				email: 'sysop@example.com',
				id: SYSOP_ID,
				passwordHash,
				role: 'SYSOP',
				username: 'sysop',
			},
			{
				email: 'op@example.com',
				id: OPERATOR_ID,
				passwordHash,
				role: 'OPERATOR',
				username: 'operator',
			},
		])
		.run();

	// Two workspaces owned by the SYSOP; OPERATOR is a member of A only.
	db.insert(workspaces)
		.values([
			{ id: WS_A, name: 'Alpha', ownerId: SYSOP_ID, slug: 'alpha' },
			{ id: WS_B, name: 'Bravo', ownerId: SYSOP_ID, slug: 'bravo' },
		])
		.run();
	db.insert(workspaceMembers)
		.values({ role: 'OPERATOR', userId: OPERATOR_ID, workspaceId: WS_A })
		.run();

	// One asset, one relationship, and one service in EACH workspace.
	db.insert(assets)
		.values([
			{ assetType: 'physical_server', id: 1, name: 'A-server', workspaceId: WS_A },
			{ assetType: 'physical_server', id: 2, name: 'A-host', workspaceId: WS_A },
			{ assetType: 'physical_server', id: 3, name: 'B-server', workspaceId: WS_B },
		])
		.run();
	db.insert(assetRelationships)
		.values([
			{
				relationshipType: 'runs_on',
				sourceAssetId: 1,
				targetAssetId: 2,
				workspaceId: WS_A,
			},
		])
		.run();
	db.insert(serviceCatalog)
		.values([
			{ name: 'A-service', workspaceId: WS_A },
			{ name: 'B-service', workspaceId: WS_B },
		])
		.run();

	const sysopToken = signTokenPair({ id: SYSOP_ID, role: 'SYSOP' }).accessToken;
	const opToken = signTokenPair({ id: OPERATOR_ID, role: 'OPERATOR' }).accessToken;
	const app = createApiApp();

	// ---------------------------------------------------------------- ON ---
	setWorkspacesEnabled(true);

	// 1. Member of A, scoped to A → only A's assets (2 of them).
	const aScoped = await getJson(app, '/assets', opToken, WS_A);
	assert(
		aScoped.status === 200 && rowCount(aScoped.body) === 2,
		`Operator scoped to A must see exactly 2 assets, got status ${aScoped.status} count ${rowCount(aScoped.body)}`
	);

	// 2. Member of A, scoped to B (not a member) → 403.
	const bDenied = await getJson(app, '/assets', opToken, WS_B);
	assert(
		bDenied.status === 403,
		`Operator scoped to a non-member workspace must be forbidden (403), got ${bDenied.status}`
	);

	// 3. Single asset in B, scoped to A → 404 (boundary hidden).
	const bAssetScopedA = await getJson(app, '/assets/3', opToken, WS_A);
	assert(
		bAssetScopedA.status === 404,
		`Operator scoped to A must not read B's asset (expect 404), got ${bAssetScopedA.status}`
	);

	// 4. Member of A, NO header → 400 (must select a workspace).
	const noHeader = await getJson(app, '/assets', opToken);
	assert(
		noHeader.status === 400,
		`Non-SYSOP without a workspace header must be rejected (400), got ${noHeader.status}`
	);

	// 5. SYSOP, NO header → sees ALL assets (cross-workspace bypass, 3 of them).
	const sysopAll = await getJson(app, '/assets', sysopToken);
	assert(
		sysopAll.status === 200 && rowCount(sysopAll.body) === 3,
		`SYSOP without a header must see all 3 assets, got status ${sysopAll.status} count ${rowCount(sysopAll.body)}`
	);

	// 6. Relationships + services scoped the same way (member of A sees only A's).
	const relScoped = await getJson(app, '/relationships', opToken, WS_A);
	assert(
		relScoped.status === 200 && rowCount(relScoped.body) === 1,
		`Operator scoped to A must see exactly 1 relationship, got status ${relScoped.status} count ${rowCount(relScoped.body)}`
	);
	const svcScoped = await getJson(app, '/services', opToken, WS_A);
	assert(
		svcScoped.status === 200 && rowCount(svcScoped.body) === 1,
		`Operator scoped to A must see exactly 1 service, got status ${svcScoped.status} count ${rowCount(svcScoped.body)}`
	);
	const svcSysop = await getJson(app, '/services', sysopToken);
	assert(
		svcSysop.status === 200 && rowCount(svcSysop.body) === 2,
		`SYSOP without a header must see all 2 services, got status ${svcSysop.status} count ${rowCount(svcSysop.body)}`
	);

	// --------------------------------------------------------------- OFF ---
	setWorkspacesEnabled(false);

	// 7. Feature off → the same operator with NO header sees EVERY asset.
	const offAll = await getJson(app, '/assets', opToken);
	assert(
		offAll.status === 200 && rowCount(offAll.body) === 3,
		`With workspaces disabled the operator must see all 3 assets, got status ${offAll.status} count ${rowCount(offAll.body)}`
	);

	await closeDatabase();
	try {
		rmSync(tmpDir, { force: true, recursive: true });
	} catch {
		// Windows may briefly hold the WAL handle; temp cleanup is best-effort.
	}

	if (failures.length === 0) {
		console.log('✅ workspace-scoping boundary checks passed');
		process.exit(0);
	}
	console.error('❌ workspace-scoping verification FAILED:');
	for (const f of failures) console.error(' -', f);
	process.exit(1);
}

run().catch((err: unknown) => {
	console.error('Fatal error in test-workspace-scoping:', err);
	process.exit(1);
});
