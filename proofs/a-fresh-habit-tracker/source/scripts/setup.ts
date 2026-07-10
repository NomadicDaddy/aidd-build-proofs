/**
 * Development environment setup for Habit Tracker.
 *
 * Responsibilities:
 *   - Validate prerequisites (Bun version).
 *   - Install root workspace dependencies.
 *   - Ensure the local config file and data/ directory exist.
 *   - Print the commands used to start the app (does NOT start any server).
 *
 * This script never launches a blocking dev server. Later sessions build the
 * backend (Elysia) and frontend (Vite) workspaces; run `bun run start` then.
 *
 * Usage:
 *   bun run scripts/setup.ts \
 *     --slug habit-tracker --name "Habit Tracker" \
 *     --description "A local-first habit tracker" \
 *     --frontend-port 3330 --backend-port 3331
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

type Args = Record<string, string>;

function parseArgs(argv: string[]): Args {
	const args: Args = {};
	for (let i = 0; i < argv.length; i += 1) {
		const token = argv[i];
		if (token.startsWith('--')) {
			const key = token.slice(2);
			const next = argv[i + 1];
			if (next && !next.startsWith('--')) {
				args[key] = next;
				i += 1;
			} else {
				args[key] = 'true';
			}
		}
	}
	return args;
}

function requireBun(): void {
	const version = process.versions.bun;
	if (!version) {
		console.error('This project requires the Bun runtime. Run scripts with `bun run`.');
		process.exit(1);
	}
	const [major, minor] = version.split('.').map((n) => Number.parseInt(n, 10));
	const ok = major > 1 || (major === 1 && minor >= 3);
	if (!ok) {
		console.error(`Bun >= 1.3 required, found ${version}. Aborting.`);
		process.exit(1);
	}
	console.log(`✓ Bun ${version}`);
}

function ensureDirs(root: string): void {
	for (const dir of ['data', 'config']) {
		const path = join(root, dir);
		if (!existsSync(path)) {
			mkdirSync(path, { recursive: true });
			console.log(`✓ created ${dir}/`);
		} else {
			console.log(`✓ ${dir}/ present`);
		}
	}
}

function ensureConfig(root: string, slug: string): void {
	const configPath = join(root, 'config', `${slug}.json`);
	if (existsSync(configPath)) {
		console.log(`✓ config/${slug}.json present`);
		return;
	}
	const examplePath = join(root, 'config', 'example.json');
	if (existsSync(examplePath)) {
		copyFileSync(examplePath, configPath);
		console.log(`✓ created config/${slug}.json from example.json`);
	} else {
		console.warn(`! config/${slug}.json missing and no example.json to copy from.`);
	}
}

function installDeps(root: string): void {
	console.log('Installing root dependencies (bun install)...');
	const result = spawnSync('bun', ['install'], { cwd: root, stdio: 'inherit' });
	if (result.status !== 0) {
		console.error('bun install failed.');
		process.exit(result.status ?? 1);
	}
	console.log('✓ dependencies installed');
}

function main(): void {
	const args = parseArgs(process.argv.slice(2));
	const root = process.cwd();
	const slug = args.slug ?? 'habit-tracker';
	const name = args.name ?? 'Habit Tracker';
	const frontendPort = args['frontend-port'] ?? '3330';
	const backendPort = args['backend-port'] ?? '3331';

	console.log(`Setting up ${name} (${slug})`);
	requireBun();
	ensureDirs(root);
	ensureConfig(root, slug);
	installDeps(root);

	console.log('\nSetup complete. Next steps (run in later sessions once workspaces exist):');
	console.log('  bun run start    # start backend + frontend detached (agent-safe)');
	console.log('  bun run stop     # stop servers started by `bun run start`');
	console.log('  bun run smoke:qc # run the quality gate');
	console.log(`\nBackend will serve on :${backendPort}, frontend on :${frontendPort}.`);
}

main();
