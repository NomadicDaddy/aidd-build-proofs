#!/usr/bin/env bun
/**
 * OpenAPI Spec vs Frontend Type Contract Validation
 *
 * Extracts the OpenAPI spec from the Elysia app (without starting a server)
 * and validates that frontend type definitions are consistent with backend
 * route schemas. Focuses on enum/union type consistency — the highest-value
 * check for catching contract drift.
 *
 * Usage:
 *   bun run check:api-types
 *   bun run check:api-types --json    # Output as JSON (for CI)
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { getConfig, initializeConfig } from '../backend/src/config/configLoader.ts';
import { createApiApp } from '../backend/src/create-api-app.ts';
import {
	ApiKeyScopeSchema,
	NotificationTypeSchema,
	UserRoleSchema,
} from '../backend/src/schemas/domain.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EnumMismatch {
	backendValues: string[];
	frontendValues: string[];
	missingInBackend: string[];
	missingInFrontend: string[];
	name: string;
}

interface ValidationResult {
	endpointCount: number;
	enumMismatches: EnumMismatch[];
	errors: number;
	specExtracted: boolean;
	status: 'fail' | 'pass';
	warnings: string[];
}

interface TypeBoxLiteralSchema {
	const: string;
}

interface TypeBoxUnionSchema {
	anyOf: TypeBoxLiteralSchema[];
}

// ---------------------------------------------------------------------------
// TypeBox Enum Extraction
// ---------------------------------------------------------------------------

/** Extract string literal values from a TypeBox t.Union([t.Literal(...)]) schema. */
function extractTypeBoxEnumValues(schema: TypeBoxUnionSchema): string[] {
	if (!schema.anyOf || !Array.isArray(schema.anyOf)) return [];
	return schema.anyOf
		.filter(
			(item): item is TypeBoxLiteralSchema =>
				'const' in item && typeof item.const === 'string'
		)
		.map((item) => item.const)
		.sort();
}

// ---------------------------------------------------------------------------
// Frontend Type Parsing
// ---------------------------------------------------------------------------

const FRONTEND_TYPES_DIR = join(import.meta.dirname, '..', 'frontend', 'src', 'api', 'types');

/** Extract string-literal union values from a TS source file.
 *  Supports two shapes:
 *   1. Plain union:        type FooType = 'a' | 'b' | 'c';
 *   2. Derived from const: const FOO_TYPES = ['a', 'b', 'c'] as const;
 *                          type FooType = (typeof FOO_TYPES)[number];
 *  Returns null if the type name is not found, or the values list (sorted) otherwise.
 */
function extractUnionValuesFromSource(content: string, typeName: string): null | string[] {
	const typePattern = new RegExp(`type\\s+${typeName}\\s*=\\s*([^;]+);`, 's');
	const typeMatch = typePattern.exec(content);
	if (!typeMatch?.[1]) return null;

	const typeBody = typeMatch[1];
	const values: string[] = [];

	// Pattern 2: type FooType = (typeof SOME_CONST)[number];
	const derivedPattern = /\(\s*typeof\s+(\w+)\s*\)\s*\[\s*number\s*\]/;
	const derivedMatch = derivedPattern.exec(typeBody);
	if (derivedMatch?.[1]) {
		const constName = derivedMatch[1];
		const constPattern = new RegExp(
			`const\\s+${constName}\\s*=\\s*\\[([^\\]]+)\\]\\s*as\\s+const`,
			's'
		);
		const constMatch = constPattern.exec(content);
		if (!constMatch?.[1]) return null;
		const valuePattern = /'([^']+)'/g;
		let valueMatch: null | RegExpExecArray;
		while ((valueMatch = valuePattern.exec(constMatch[1])) !== null) {
			if (valueMatch[1]) values.push(valueMatch[1]);
		}
		return values.sort();
	}

	// Pattern 1: type FooType = 'a' | 'b' | 'c';
	const valuePattern = /'([^']+)'/g;
	let valueMatch: null | RegExpExecArray;
	while ((valueMatch = valuePattern.exec(typeBody)) !== null) {
		if (valueMatch[1]) values.push(valueMatch[1]);
	}
	return values.sort();
}

// ---------------------------------------------------------------------------
// Enum Validation
// ---------------------------------------------------------------------------

interface EnumDefinition {
	backendSchema: TypeBoxUnionSchema;
	frontendFile: string;
	frontendTypeName: string;
	name: string;
}

const PROJECT_ROOT = join(import.meta.dirname, '..');

/** All enum/union types to validate between backend and frontend.
 *  `frontendFile` is relative to project root if it contains '/', otherwise
 *  relative to frontend/src/api/types/. Points at shared/src/ for types that
 *  have been promoted to spernakit-shared. */
const ENUM_DEFINITIONS: EnumDefinition[] = [
	{
		backendSchema: UserRoleSchema as unknown as TypeBoxUnionSchema,
		frontendFile: 'shared/src/roles.ts',
		frontendTypeName: 'UserRole',
		name: 'UserRole',
	},
	{
		backendSchema: NotificationTypeSchema as unknown as TypeBoxUnionSchema,
		frontendFile: 'shared/src/notificationTypes.ts',
		frontendTypeName: 'NotificationType',
		name: 'NotificationType',
	},
	{
		backendSchema: ApiKeyScopeSchema as unknown as TypeBoxUnionSchema,
		frontendFile: 'shared/src/apiKeyScopes.ts',
		frontendTypeName: 'ApiKeyScope',
		name: 'ApiKeyScope',
	},
];

/** WorkspaceMemberRole is declared in spernakit-shared but not surfaced as a
 *  TypeBox schema (it is not used in any route schema). We hand-pin the
 *  backend values and validate that the shared declaration stays in sync. */
const WORKSPACE_MEMBER_ROLE_VALUES = ['ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER'];

function validateEnums(): EnumMismatch[] {
	const mismatches: EnumMismatch[] = [];

	for (const def of ENUM_DEFINITIONS) {
		const backendValues = extractTypeBoxEnumValues(def.backendSchema);
		const frontendFile = def.frontendFile.includes('/')
			? join(PROJECT_ROOT, def.frontendFile)
			: join(FRONTEND_TYPES_DIR, def.frontendFile);

		let content: string;
		try {
			content = readFileSync(frontendFile, 'utf8');
		} catch {
			mismatches.push({
				backendValues,
				frontendValues: [],
				missingInBackend: [],
				missingInFrontend: backendValues,
				name: def.name,
			});
			continue;
		}

		const frontendValues = extractUnionValuesFromSource(content, def.frontendTypeName);
		if (frontendValues === null) {
			mismatches.push({
				backendValues,
				frontendValues: [],
				missingInBackend: [],
				missingInFrontend: backendValues,
				name: def.name,
			});
			continue;
		}

		const missingInFrontend = backendValues.filter((v) => !frontendValues.includes(v));
		const missingInBackend = frontendValues.filter((v) => !backendValues.includes(v));

		if (missingInFrontend.length > 0 || missingInBackend.length > 0) {
			mismatches.push({
				backendValues,
				frontendValues,
				missingInBackend,
				missingInFrontend,
				name: def.name,
			});
		}
	}

	// WorkspaceMemberRole — declared in shared/src/workspaceRoles.ts; not a TypeBox schema.
	const wsmrFilePath = join(PROJECT_ROOT, 'shared/src/workspaceRoles.ts');
	let wsmrContent: string;
	try {
		wsmrContent = readFileSync(wsmrFilePath, 'utf8');
	} catch {
		mismatches.push({
			backendValues: WORKSPACE_MEMBER_ROLE_VALUES,
			frontendValues: [],
			missingInBackend: [],
			missingInFrontend: WORKSPACE_MEMBER_ROLE_VALUES,
			name: 'WorkspaceMemberRole',
		});
		return mismatches;
	}
	const wsmrFrontend = extractUnionValuesFromSource(wsmrContent, 'WorkspaceMemberRole');
	if (wsmrFrontend === null) {
		mismatches.push({
			backendValues: WORKSPACE_MEMBER_ROLE_VALUES,
			frontendValues: [],
			missingInBackend: [],
			missingInFrontend: WORKSPACE_MEMBER_ROLE_VALUES,
			name: 'WorkspaceMemberRole',
		});
	} else {
		const sorted = [...WORKSPACE_MEMBER_ROLE_VALUES].sort();
		const missingInFrontend = sorted.filter((v) => !wsmrFrontend.includes(v));
		const missingInBackend = wsmrFrontend.filter((v) => !sorted.includes(v));

		if (missingInFrontend.length > 0 || missingInBackend.length > 0) {
			mismatches.push({
				backendValues: sorted,
				frontendValues: wsmrFrontend,
				missingInBackend,
				missingInFrontend,
				name: 'WorkspaceMemberRole',
			});
		}
	}

	return mismatches;
}

// ---------------------------------------------------------------------------
// OpenAPI Spec Extraction
// ---------------------------------------------------------------------------

interface OpenAPISpec {
	info: { title: string; version: string };
	paths: Record<string, Record<string, unknown>>;
}

async function extractOpenAPISpec(): Promise<{ endpointCount: number; spec: OpenAPISpec } | null> {
	try {
		initializeConfig();
		// Disable rate limiting for spec extraction — no database is available and
		// rate limiting is irrelevant when extracting the OpenAPI schema.
		getConfig().rateLimit.enabled = false;
		const app = createApiApp({ forceSwagger: true });

		const response = await app.handle(new Request('http://localhost/api/v1/docs/json'));

		if (!response.ok) {
			return null;
		}

		const spec = (await response.json()) as OpenAPISpec;

		// Count endpoints (each path + method combination)
		let endpointCount = 0;
		for (const methods of Object.values(spec.paths ?? {})) {
			for (const method of Object.keys(methods as Record<string, unknown>)) {
				if (['delete', 'get', 'patch', 'post', 'put'].includes(method)) {
					endpointCount++;
				}
			}
		}

		return { endpointCount, spec };
	} catch {
		return null;
	}
}

// ---------------------------------------------------------------------------
// OpenAPI Enum Cross-Check
// ---------------------------------------------------------------------------

/** Walk the OpenAPI spec to find all anyOf/oneOf enum schemas and compare
 *  against the known backend TypeBox schemas. This catches cases where inline
 *  route schemas diverge from the canonical schemas/domain.ts definitions. */
function findSpecEnumValues(obj: unknown, results: Map<string, Set<string>>): void {
	if (obj === null || obj === undefined || typeof obj !== 'object') return;

	const record = obj as Record<string, unknown>;

	// Check for anyOf with const values (TypeBox union pattern in OpenAPI 3.1)
	if (Array.isArray(record['anyOf'])) {
		const values: string[] = [];
		for (const item of record['anyOf'] as Record<string, unknown>[]) {
			if (typeof item['const'] === 'string') {
				values.push(item['const']);
			}
		}
		if (values.length > 0) {
			const key = values.sort().join(',');
			const existing = results.get(key);
			if (existing) {
				for (const v of values) existing.add(v);
			} else {
				results.set(key, new Set(values));
			}
		}
	}

	// Recurse into all values
	for (const value of Object.values(record)) {
		if (typeof value === 'object' && value !== null) {
			findSpecEnumValues(value, results);
		}
	}
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function printResult(result: ValidationResult): void {
	console.log('\nAPI Type Contract Validation');
	console.log('');

	// Spec extraction
	console.log('SPEC EXTRACTION');
	if (result.specExtracted) {
		console.log(`  [PASS] OpenAPI spec extracted (${result.endpointCount} endpoints)`);
	} else {
		console.log('  [FAIL] Failed to extract OpenAPI spec from Elysia app');
	}
	console.log('');

	// Enum validation
	console.log('ENUM VALIDATION');
	if (result.enumMismatches.length === 0) {
		console.log('  [PASS] All enum types consistent between backend and frontend');
	} else {
		for (const m of result.enumMismatches) {
			console.log(`  [FAIL] ${m.name}`);
			if (m.missingInFrontend.length > 0) {
				console.log(`         Missing in frontend: ${m.missingInFrontend.join(', ')}`);
			}
			if (m.missingInBackend.length > 0) {
				console.log(`         Missing in backend:  ${m.missingInBackend.join(', ')}`);
			}
		}
	}
	console.log('');

	// Warnings
	if (result.warnings.length > 0) {
		console.log('WARNINGS');
		for (const w of result.warnings) {
			console.log(`  [WARN] ${w}`);
		}
		console.log('');
	}

	// Summary
	console.log('SUMMARY');
	console.log(`  Errors: ${result.errors} | Warnings: ${result.warnings.length}`);
	if (result.status === 'pass' && result.warnings.length > 0) {
		console.log('  Status: PASS (warnings only)');
	} else if (result.status === 'pass') {
		console.log('  Status: PASS');
	} else {
		console.log('  Status: FAIL');
	}
	console.log('');
}

function printJsonResult(result: ValidationResult): void {
	console.log(JSON.stringify(result, null, '\t'));
}

async function main(): Promise<void> {
	const jsonMode = process.argv.includes('--json');

	const result: ValidationResult = {
		endpointCount: 0,
		enumMismatches: [],
		errors: 0,
		specExtracted: false,
		status: 'pass',
		warnings: [],
	};

	try {
		// 1. Extract OpenAPI spec (validates spec generation works)
		const specResult = await extractOpenAPISpec();
		if (specResult) {
			result.specExtracted = true;
			result.endpointCount = specResult.endpointCount;

			// Cross-check: find all enum-like schemas in the spec
			const specEnums = new Map<string, Set<string>>();
			findSpecEnumValues(specResult.spec.paths, specEnums);

			// Verify known enums appear in the spec
			const knownEnums = [
				{
					name: 'NotificationType',
					values: extractTypeBoxEnumValues(
						NotificationTypeSchema as unknown as TypeBoxUnionSchema
					),
				},
				{
					name: 'ApiKeyScope',
					values: extractTypeBoxEnumValues(
						ApiKeyScopeSchema as unknown as TypeBoxUnionSchema
					),
				},
				{
					name: 'UserRole',
					values: extractTypeBoxEnumValues(
						UserRoleSchema as unknown as TypeBoxUnionSchema
					),
				},
			];
			for (const known of knownEnums) {
				const key = known.values.sort().join(',');
				if (!specEnums.has(key)) {
					result.warnings.push(
						`${known.name} enum not found in OpenAPI spec request schemas ` +
							`(may only appear in response examples)`
					);
				}
			}
		} else {
			result.errors++;
			result.status = 'fail';
		}

		// 2. Validate enum consistency (backend TypeBox vs frontend types)
		result.enumMismatches = validateEnums();
		result.errors += result.enumMismatches.length;

		if (result.errors > 0) {
			result.status = 'fail';
		}

		if (jsonMode) {
			printJsonResult(result);
		} else {
			printResult(result);
		}

		process.exit(result.status === 'pass' ? 0 : 1);
	} catch (err: unknown) {
		if (jsonMode) {
			console.log(
				JSON.stringify({
					error: err instanceof Error ? err.message : String(err),
					status: 'fail',
				})
			);
		} else {
			console.error(
				`API type validation error: ${err instanceof Error ? err.message : String(err)}`
			);
		}
		process.exit(1);
	}
}

await main();
