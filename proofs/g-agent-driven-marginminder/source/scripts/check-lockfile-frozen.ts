#!/usr/bin/env bun
/**
 * LTS lockfile freeze guard.
 *
 * Fails when bun.lock has uncommitted changes unless LTS_LOCKFILE_BUMP=1 is set.
 * Security advisories that require a lockfile change must be applied with the
 * env override and accompanied by an ADR documenting the CVE and fix scope.
 */
import { execSync } from 'node:child_process';

function main(): void {
	if (process.env.LTS_LOCKFILE_BUMP === '1') {
		console.log('LTS_LOCKFILE_BUMP=1 set — bypassing lockfile freeze guard.');
		console.log('Reminder: log the CVE/ADR justifying this bump.');
		process.exit(0);
	}

	const status = execSync('git status --porcelain bun.lock', { encoding: 'utf-8' }).trim();

	if (status.length === 0) {
		console.log('bun.lock unchanged — lockfile freeze respected.');
		process.exit(0);
	}

	console.error('bun.lock has uncommitted changes. v3.8 LTS requires lockfile stability.');
	console.error('If this is a security advisory bump, set LTS_LOCKFILE_BUMP=1 and add an ADR.');
	console.error(`   ${status}`);
	process.exit(1);
}

main();
