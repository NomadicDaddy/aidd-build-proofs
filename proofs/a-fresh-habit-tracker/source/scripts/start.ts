/**
 * Agent-safe launcher: starts the backend and frontend dev servers DETACHED and
 * returns immediately (never blocks the terminal). PIDs are recorded in
 * .dev-servers.json so `bun run stop` can shut them down.
 *
 * Only workspaces that already expose a `dev` script are started; workspaces not
 * yet scaffolded are skipped with a note. This keeps the launch contract valid
 * during early development before both servers exist.
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PID_FILE = '.dev-servers.json';

type WorkspacePid = { name: string; pid: number };

function hasDevScript(root: string, workspace: string): boolean {
	const pkgPath = join(root, workspace, 'package.json');
	if (!existsSync(pkgPath)) return false;
	try {
		const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
			scripts?: Record<string, string>;
		};
		return Boolean(pkg.scripts?.dev);
	} catch {
		return false;
	}
}

function start(root: string): void {
	const workspaces = ['backend', 'frontend'];
	const started: WorkspacePid[] = [];

	for (const workspace of workspaces) {
		if (!hasDevScript(root, workspace)) {
			console.log(`- ${workspace}: no dev script yet, skipping`);
			continue;
		}
		const child = spawn('bun', ['run', '--cwd', workspace, 'dev'], {
			cwd: root,
			detached: true,
			stdio: 'ignore',
		});
		child.unref();
		if (child.pid !== undefined) {
			started.push({ name: workspace, pid: child.pid });
			console.log(`✓ ${workspace}: started (pid ${child.pid})`);
		}
	}

	if (started.length === 0) {
		console.log('No workspaces started. Build the backend/frontend workspaces first.');
		return;
	}

	writeFileSync(join(root, PID_FILE), `${JSON.stringify(started, null, '\t')}\n`);
	console.log(
		`\nRecorded ${started.length} process(es) in ${PID_FILE}. Run \`bun run stop\` to stop.`
	);
}

start(process.cwd());
