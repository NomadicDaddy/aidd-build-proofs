/**
 * Stops the dev servers started by `bun run start` using the PIDs recorded in
 * .dev-servers.json. Safe to run when nothing is running.
 */
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const PID_FILE = '.dev-servers.json';

type WorkspacePid = { name: string; pid: number };

function stop(root: string): void {
	const pidPath = join(root, PID_FILE);
	if (!existsSync(pidPath)) {
		console.log('No .dev-servers.json found — nothing to stop.');
		return;
	}

	let entries: WorkspacePid[];
	try {
		entries = JSON.parse(readFileSync(pidPath, 'utf8')) as WorkspacePid[];
	} catch {
		console.warn('Could not parse .dev-servers.json; removing it.');
		rmSync(pidPath);
		return;
	}

	for (const entry of entries) {
		try {
			process.kill(entry.pid);
			console.log(`✓ stopped ${entry.name} (pid ${entry.pid})`);
		} catch {
			console.log(`- ${entry.name} (pid ${entry.pid}) not running`);
		}
	}

	rmSync(pidPath);
	console.log('Cleared .dev-servers.json.');
}

stop(process.cwd());
