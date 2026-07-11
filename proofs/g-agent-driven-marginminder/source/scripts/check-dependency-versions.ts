#!/usr/bin/env bun
/**
 * Checks that critical dependencies are pinned to exact versions (no ^ or ~ prefixes).
 *
 * This prevents surprise breaking changes from `bun update` pulling in
 * incompatible versions of core dependencies.
 *
 * See docs/stack.md for version pinning policy.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

/**
 * Critical backend dependencies that must be pinned to exact versions.
 * These are core framework, database, auth, and logging dependencies.
 */
const CRITICAL_BACKEND_DEPS = [
	// Core framework
	'elysia',
	'@elysiajs/swagger',
	// Database
	'drizzle-orm',
	'drizzle-kit',
	// Auth & validation
	'jsonwebtoken',
	'zod',
	// Utilities
	'nodemailer',
	'pino',
	'pino-pretty',
	'pino-roll',
	// Build tools
	'typescript',
];

/**
 * Critical frontend dependencies that must be pinned to exact versions.
 * These are core React, routing, state management, and build dependencies.
 */
const CRITICAL_FRONTEND_DEPS = [
	// Core React
	'react',
	'react-dom',
	// Routing
	'react-router-dom',
	// Data fetching & state
	'@tanstack/react-query',
	'zustand',
	// Build tools
	'vite',
	'typescript',
];

interface PackageJson {
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
}

function checkDependencyVersions(
	packageJsonPath: string,
	criticalDeps: string[],
	packageName: string
): boolean {
	void criticalDeps;
	const content = readFileSync(packageJsonPath, 'utf-8');
	const pkg = JSON.parse(content) as PackageJson & {
		optionalDependencies?: Record<string, string>;
	};

	const deps: Record<string, string> = {
		...(pkg.dependencies ?? {}),
		...(pkg.devDependencies ?? {}),
		...(pkg.optionalDependencies ?? {}),
	};

	const unpinned: string[] = [];

	for (const [name, version] of Object.entries(deps)) {
		if (version.startsWith('^') || version.startsWith('~')) {
			unpinned.push(name);
		}
	}

	if (unpinned.length > 0) {
		console.error(
			`❌ ${packageName}: Found ${unpinned.length} unpinned dependencies (v3.8 LTS requires exact versions):`
		);
		unpinned.forEach((dep) => console.error(`   - ${dep}: ${deps[dep]}`));
		return false;
	}

	console.log(`✅ ${packageName}: All dependencies are pinned to exact versions`);
	return true;
}

function main(): void {
	console.log('Checking for unpinned critical dependencies...\n');

	const backendPath = join(__dirname, '..', 'backend', 'package.json');
	const frontendPath = join(__dirname, '..', 'frontend', 'package.json');

	const backendOk = checkDependencyVersions(backendPath, CRITICAL_BACKEND_DEPS, 'backend');
	const frontendOk = checkDependencyVersions(frontendPath, CRITICAL_FRONTEND_DEPS, 'frontend');

	console.log();

	if (backendOk && frontendOk) {
		console.log('✅ All critical dependencies are properly pinned');
		process.exit(0);
	} else {
		console.error('❌ Some critical dependencies are not pinned to exact versions');
		console.error('   Pin versions by removing ^ or ~ prefix (e.g., "react": "19.2.4")');
		process.exit(1);
	}
}

main();
