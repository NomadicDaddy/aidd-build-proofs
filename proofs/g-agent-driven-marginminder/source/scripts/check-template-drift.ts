#!/usr/bin/env bun
/**
 * Template drift detection for Spernakit v3.
 *
 * Compares template-managed files in a derived application against the
 * expected baseline from the spernakit template at the app's declared
 * spernakit_version. Informational only — always exits 0.
 *
 * File enumeration is derived dynamically from git ls-tree of the template,
 * matching the same exclusions used during app initialization.
 * Classification (branded/infrastructure/pure) comes from template-manifest.json.
 *
 * Usage:
 *   bun scripts/check-template-drift.ts [--template /path/to/spernakit]
 */
import path from 'node:path';

import {
	applyTemplateOverrides,
	checkFile,
	classifyFile,
	enumerateTemplateFiles,
	gitTagExists,
	isSpernakitItself,
	loadAppBrandingValues,
	loadClassificationOverrides,
	loadTemplateOverrides,
	readSpernakitVersion,
	resolveSpernakitPath,
	type FileResult,
} from './template-shared.js';

// ===== CONSTANTS =====

const repoRoot = path.resolve(process.cwd());

// ===== HELPERS =====

function parseArgs(): { templatePath: string | undefined } {
	const args = process.argv.slice(2);
	const templateIdx = args.indexOf('--template');
	const templatePath =
		templateIdx !== -1 && args[templateIdx + 1] ? args[templateIdx + 1] : undefined;
	return { templatePath };
}

// ===== REPORTING =====

function printReport(results: FileResult[], version: string): number {
	const pure = results.filter((r) => r.category === 'pure');
	const branded = results.filter((r) => r.category === 'branded');
	const infra = results.filter((r) => r.category === 'infrastructure');

	const countByStatus = (items: FileResult[], status: FileResult['status']): number =>
		items.filter((r) => r.status === status).length;

	const pad = (n: number, width: number): string => String(n).padStart(width);

	console.log(`Template Drift Report (spernakit v${version})`);
	console.log('');

	// Pure template files
	const pureChecked = pure.filter((r) => r.status !== 'missing-in-template').length;
	console.log(`   Pure Template Files (${pureChecked} checked)`);
	const pureIdentical = countByStatus(pure, 'identical');
	const pureDrifted = countByStatus(pure, 'drifted');
	const pureMissing = countByStatus(pure, 'missing-in-app');
	const pureSuppressed = countByStatus(pure, 'suppressed');
	console.log(`     ${pad(pureIdentical, 3)} identical`);
	if (pureDrifted > 0) console.log(`     ${pad(pureDrifted, 3)} drifted`);
	if (pureMissing > 0) console.log(`     ${pad(pureMissing, 3)} missing`);
	if (pureSuppressed > 0) console.log(`     ${pad(pureSuppressed, 3)} suppressed`);
	console.log('');

	// Branded files
	const brandedChecked = branded.filter((r) => r.status !== 'missing-in-template').length;
	console.log(`   Branded Files (${brandedChecked} checked)`);
	const brandedIdentical = countByStatus(branded, 'identical');
	const brandedDrifted = countByStatus(branded, 'drifted');
	const brandedMissing = countByStatus(branded, 'missing-in-app');
	const brandedSuppressed = countByStatus(branded, 'suppressed');
	console.log(`     ${pad(brandedIdentical, 3)} identical (after normalization)`);
	if (brandedDrifted > 0) console.log(`     ${pad(brandedDrifted, 3)} drifted`);
	if (brandedMissing > 0) console.log(`     ${pad(brandedMissing, 3)} missing`);
	if (brandedSuppressed > 0) console.log(`     ${pad(brandedSuppressed, 3)} suppressed`);
	console.log('');

	// Infrastructure files
	const infraChecked = infra.filter((r) => r.status !== 'missing-in-template').length;
	console.log(`   Infrastructure Files (${infraChecked} checked)`);
	const infraIdentical = countByStatus(infra, 'identical');
	const infraDrifted = countByStatus(infra, 'drifted');
	const infraMissing = countByStatus(infra, 'missing-in-app');
	const infraSuppressed = countByStatus(infra, 'suppressed');
	console.log(`     ${pad(infraIdentical, 3)} match baseline`);
	if (infraDrifted > 0) console.log(`     ${pad(infraDrifted, 3)} have domain customizations`);
	if (infraMissing > 0) console.log(`     ${pad(infraMissing, 3)} missing`);
	if (infraSuppressed > 0) console.log(`     ${pad(infraSuppressed, 3)} suppressed`);
	console.log('');

	// Detail sections
	const drifted = results.filter(
		(r) => r.status === 'drifted' && r.category !== 'infrastructure'
	);
	const missing = results.filter((r) => r.status === 'missing-in-app');

	if (drifted.length > 0) {
		console.log('   Drifted files:');
		for (const r of drifted) {
			const label =
				r.category === 'pure' ? 'should match template' : 'differs beyond branding';
			console.log(`     ${r.filePath.padEnd(40)} (${r.category} — ${label})`);
		}
		console.log('');
	}

	if (missing.length > 0) {
		console.log('   Missing files:');
		for (const r of missing) {
			console.log(`     ${r.filePath.padEnd(40)} (exists in template but not in app)`);
		}
		console.log('');
	}

	const suppressed = results.filter((r) => r.status === 'suppressed');
	if (suppressed.length > 0) {
		console.log(`   Suppressed (${suppressed.length}, per .templateoverrides):`);
		for (const r of suppressed) {
			const action = r.suppression?.action ?? 'SKIP';
			const reason = r.suppression?.reason ?? '';
			const tail = reason ? ` — ${reason}` : '';
			console.log(`     ${r.filePath.padEnd(40)} [${action}]${tail}`);
		}
		console.log('');
	}

	const totalDrift = drifted.length + missing.length;
	if (totalDrift === 0) {
		console.log('   No template drift detected.');
	} else {
		console.log(`   ${totalDrift} file(s) need attention.`);
		console.log('   Run /template-refactor to review and fix drift.');
	}
	return totalDrift;
}

// ===== MAIN =====

function main(): void {
	try {
		console.log('Checking template drift...');
		console.log('');

		// Skip if this is spernakit itself
		if (isSpernakitItself(repoRoot)) {
			console.log('   Template drift check is not applicable to spernakit itself.');
			process.exit(0);
		}

		// Read spernakit_version
		const version = readSpernakitVersion(repoRoot);
		if (!version) {
			console.log('   Skipping: could not determine spernakit_version.');
			process.exit(0);
		}

		// Resolve spernakit repo
		const { templatePath } = parseArgs();
		const spernakitPath = resolveSpernakitPath(templatePath, repoRoot);
		if (!spernakitPath) {
			console.log('   Skipping: spernakit repo not available.');
			process.exit(0);
		}

		// Validate git tag
		if (!gitTagExists(spernakitPath, version)) {
			console.log(`   Warning: git tag v${version} not found in spernakit repo.`);
			console.log('   Skipping drift check.');
			process.exit(0);
		}

		// Load classification overrides from spernakit at the declared version
		const overridesResult = loadClassificationOverrides(spernakitPath, version);
		if (!overridesResult) {
			console.log(`   Warning: template-manifest.json not found at v${version} or on disk.`);
			console.log('   Skipping drift check.');
			process.exit(0);
		}
		const { overrides, source: manifestSource } = overridesResult;
		if (manifestSource === 'filesystem') {
			console.log(
				`   Note: manifest loaded from filesystem (not yet tagged at v${version}).`
			);
			console.log('');
		}

		// Enumerate all template files from git ls-tree
		const templateFiles = enumerateTemplateFiles(spernakitPath, version);
		if (templateFiles.length === 0) {
			console.log('   Warning: No template files found.');
			process.exit(0);
		}
		console.log(`   Found ${templateFiles.length} template-managed files.`);
		console.log('');

		// Load app branding values for branded file normalization
		const appBranding = loadAppBrandingValues(repoRoot);

		// Check all files, classifying each as pure/branded/infrastructure
		const results: FileResult[] = [];

		for (const filePath of templateFiles) {
			const category = classifyFile(filePath, overrides);
			results.push(
				checkFile(spernakitPath, version, filePath, category, appBranding, repoRoot)
			);
		}

		// Apply per-app .templateoverrides — converts drifted SKIP/KEEP entries
		// and missing DELETED entries to status 'suppressed' so they don't
		// inflate the drift count.
		const templateOverrides = loadTemplateOverrides(repoRoot);
		const adjusted = applyTemplateOverrides(results, templateOverrides);

		// Filter out files that don't exist in template at this version
		const actionable = adjusted.filter((r) => r.status !== 'missing-in-template');

		const totalDrift = printReport(actionable, version);
		process.exit(totalDrift > 0 ? 1 : 0);
	} catch (err: unknown) {
		const typedErr = err instanceof Error ? err : new Error(String(err));
		console.error(`Template drift check failed: ${typedErr.message}`);
		process.exit(1);
	}
}

main();
