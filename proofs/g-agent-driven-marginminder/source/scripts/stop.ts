/**
 * Stop Script
 *
 * Stops running spernakit processes by:
 * 1. Reading PID files from logs/ directory (written by start.ts)
 * 2. Falling back to port-based detection if PID files are missing
 * 3. Running docker-compose down if Docker containers are running
 *
 * Usage:
 *   bun scripts/stop.ts              # Stop both backend and frontend
 *   bun scripts/stop.ts --backend    # Stop backend only
 *   bun scripts/stop.ts --frontend   # Stop frontend only
 *   bun scripts/stop.ts --from-start # Called by start.ts: clean stale PIDs without
 *                                    # exiting non-zero (a stale PID with nothing to
 *                                    # kill is the normal recoverable case here)
 */
import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { loadJsonConfig } from './load-json-config.ts';

const repoRoot = path.resolve(import.meta.dirname, '..');
const logsDir = path.join(repoRoot, 'logs');

// Parse arguments
const { values } = parseArgs({
	args: process.argv.slice(2),
	options: {
		backend: { default: false, type: 'boolean' },
		'from-start': { default: false, type: 'boolean' },
		frontend: { default: false, type: 'boolean' },
	},
	strict: true,
});

// If neither flag is set, stop both
const stopBackend = values.backend || (!values.backend && !values.frontend);
const stopFrontend = values.frontend || (!values.backend && !values.frontend);

// Tracks whether any service had a stale PID file pointing at a dead process.
// Surfaced at the end of the run so a silent backend crash produces a visible hint
// (and a non-zero exit) instead of a misleading "No running processes found".
let sawStalePid = false;

/**
 * Check if Docker containers are running for this app.
 */
function isDockerRunning(): boolean {
	try {
		const result = spawnSync('docker', ['compose', 'ps', '-q'], {
			cwd: repoRoot,
			encoding: 'utf8',
			stdio: ['pipe', 'pipe', 'pipe'],
		});

		if (result.status !== 0) {
			return false;
		}

		const output = result.stdout?.trim() || '';
		return output.length > 0;
	} catch {
		return false;
	}
}

/**
 * Stop Docker containers.
 */
function stopDocker(): void {
	console.log('🐳 Stopping Docker containers...');
	try {
		execSync('docker compose down', {
			cwd: repoRoot,
			stdio: 'inherit',
		});
		console.log('✅ Docker containers stopped.');
	} catch (err) {
		console.error('❌ Failed to stop Docker containers:', err);
		process.exit(1);
	}
}

/**
 * Check if a process with a given PID is alive.
 */
function isProcessAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

/**
 * Read a PID from a PID file. Returns null if file missing or PID is stale.
 */
function readPidFile(name: string): null | number {
	const pidPath = path.join(logsDir, `${name}.pid`);

	if (!fs.existsSync(pidPath)) {
		return null;
	}

	try {
		const content = fs.readFileSync(pidPath, 'utf8').trim();
		const pid = parseInt(content, 10);

		if (isNaN(pid) || pid <= 0) {
			removePidFile(name);
			return null;
		}

		return pid;
	} catch {
		return null;
	}
}

/**
 * Remove a PID file.
 */
function removePidFile(name: string): void {
	const pidPath = path.join(logsDir, `${name}.pid`);
	try {
		if (fs.existsSync(pidPath)) {
			fs.unlinkSync(pidPath);
		}
	} catch {
		// Ignore cleanup errors
	}
}

/**
 * Find process ID using a port (Windows).
 */
function findPidOnPortWindows(port: number): null | string {
	try {
		const result = spawnSync('netstat', ['-ano'], {
			encoding: 'utf8',
			stdio: ['pipe', 'pipe', 'pipe'],
		});

		if (result.status !== 0 || !result.stdout) {
			return null;
		}

		const lines = result.stdout.split('\n');
		for (const line of lines) {
			const match = line.match(new RegExp(`:\\s*${port}\\s+.*LISTENING\\s+(\\d+)`));
			if (match?.[1]) {
				return match[1];
			}
		}
		return null;
	} catch {
		return null;
	}
}

/**
 * Find process ID using a port (Unix/Linux/macOS).
 */
function findPidOnPortUnix(port: number): null | string {
	try {
		const result = spawnSync('lsof', ['-ti', `:${port}`], {
			encoding: 'utf8',
			stdio: ['pipe', 'pipe', 'pipe'],
		});

		if (result.status !== 0 || !result.stdout) {
			return null;
		}

		const pid = result.stdout.trim().split('\n')[0];
		return pid || null;
	} catch {
		return null;
	}
}

/**
 * Wait for a process to exit, checking every 500ms.
 * @returns true if the process exited within the timeout.
 */
function waitForExit(pid: number, timeoutMs: number): boolean {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		if (!isProcessAlive(pid)) return true;
		spawnSync('sleep', ['0.5']);
	}
	return !isProcessAlive(pid);
}

/**
 * Kill a process by PID. Sends SIGTERM first, waits up to 10s, then escalates to SIGKILL.
 */
function killProcess(pid: number | string, label: string): boolean {
	const isWindows = process.platform === 'win32';
	const pidNum = Number(pid);
	const pidStr = String(pid);

	try {
		if (isWindows) {
			execSync(`taskkill /F /T /PID ${pidStr}`, { stdio: 'pipe' });
		} else {
			// Graceful shutdown: SIGTERM first
			execSync(`kill -15 ${pidStr}`, { stdio: 'pipe' });
			if (!waitForExit(pidNum, 10_000)) {
				// Escalate to SIGKILL after 10s
				console.log(`   ⚠ Process ${pidStr} did not exit after SIGTERM, sending SIGKILL`);
				execSync(`kill -9 ${pidStr}`, { stdio: 'pipe' });
			}
		}
		console.log(`   ✓ Stopped process ${pidStr} (${label})`);
		return true;
	} catch {
		console.log(`   ⚠ Could not stop process ${pidStr} (${label})`);
		return false;
	}
}

/**
 * Stop a single service by name. Kills the recorded parent via PID file, then
 * scans the port for orphaned children that survived (e.g. vite spawned by the
 * bun shim — on Windows `taskkill /F /T` does not always reach grandchildren
 * detached from the parent's job object). Retries the port scan a few times
 * to handle slow OS port release and respawns.
 */
function stopService(name: string, port: number): boolean {
	const isWindows = process.platform === 'win32';
	const findPid = isWindows ? findPidOnPortWindows : findPidOnPortUnix;
	let killedAny = false;
	let killedViaPidFile = false;

	const filePid = readPidFile(name);
	if (filePid !== null) {
		if (isProcessAlive(filePid)) {
			console.log(`   Found ${name} via PID file (PID: ${filePid})`);
			if (killProcess(filePid, `${name} port ${port}`)) {
				killedAny = true;
				killedViaPidFile = true;
			}
		} else {
			console.log(
				`   ⚠ Stale PID file for ${name} (PID ${filePid} not running) — cleaning up`
			);
			sawStalePid = true;
		}
		removePidFile(name);
	}

	for (let attempt = 0; attempt < 3; attempt++) {
		const portPid = findPid(port);
		if (!portPid) break;
		if (attempt === 0 && !killedViaPidFile) {
			console.log(`   Found ${name} on port ${port} (PID: ${portPid})`);
		} else {
			console.log(`   Orphan ${name} listener on port ${port} (PID: ${portPid})`);
		}
		if (killProcess(portPid, `${name} port ${port}`)) {
			killedAny = true;
		}
		spawnSync('sleep', ['0.3']);
	}

	return killedAny;
}

// Main execution
const { appSlug, config } = loadJsonConfig(repoRoot);
const frontendPort = config.server?.frontendPort ?? 3330;
const backendPort = config.server?.backendPort ?? 3331;

const scope = stopBackend && stopFrontend ? '' : stopBackend ? ' (backend)' : ' (frontend)';
console.log(`\n🛑 Stopping ${appSlug}${scope}...`);
console.log(`   Frontend port: ${frontendPort}`);
console.log(`   Backend port: ${backendPort}\n`);

if (stopBackend && stopFrontend && isDockerRunning()) {
	stopDocker();
} else {
	console.log('🔍 Looking for processes...');

	let killedAny = false;

	if (stopFrontend) {
		if (stopService('frontend', frontendPort)) {
			killedAny = true;
		}
	}

	if (stopBackend) {
		if (stopService('backend', backendPort)) {
			killedAny = true;
		}
	}

	if (killedAny) {
		console.log('✅ Processes stopped.');
	} else {
		const portList = [
			...(stopFrontend ? [frontendPort] : []),
			...(stopBackend ? [backendPort] : []),
		].join(' or ');
		console.log(`ℹ️  No running processes found on ports ${portList}`);
	}

	// When invoked directly, a stale PID with nothing to kill means a service
	// crashed silently — surface it loudly with a non-zero exit. When invoked by
	// start.ts (--from-start), that same condition is the normal recoverable case:
	// just clean up and let start proceed.
	if (sawStalePid && !killedAny && !values['from-start']) {
		console.log(
			'ℹ Hint: backend may have crashed mid-session — check logs/backend.log and logs/backend.error.log'
		);
		process.exit(1);
	}
}
