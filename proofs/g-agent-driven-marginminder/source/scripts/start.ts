#!/usr/bin/env bun
/**
 * Background Server Launcher
 *
 * Starts both backend and frontend servers as detached background processes.
 * Output is redirected to rotating log files in the /logs directory.
 * PID files are written for reliable process management by stop.ts.
 * Verifies processes are listening on their ports before reporting success.
 *
 * Usage:
 *   bun scripts/start.ts          # Start both services
 *   bun scripts/start.ts --check  # Run check-application before starting
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { loadJsonConfig } from './load-json-config.ts';

const rootDir = path.resolve(import.meta.dirname, '..');
const logsDir = path.join(rootDir, 'logs');

// Parse arguments
const { values } = parseArgs({
	args: process.argv.slice(2),
	options: {
		check: { default: false, type: 'boolean' },
	},
	strict: true,
});

// Ensure logs directory exists
if (!fs.existsSync(logsDir)) {
	fs.mkdirSync(logsDir, { recursive: true });
}

// Load config
const { appSlug, config } = loadJsonConfig(rootDir);
const backendPort = config.server?.backendPort ?? 3331;
const frontendPort = config.server?.frontendPort ?? 3330;
const CHILD_ENV_KEYS = [
	'APP_SLUG',
	'APP_VERSION',
	'APPDATA',
	'APPDATA_ROOT',
	'BACKEND_PORT',
	'BACKUPS_ROOT',
	'BUN_INSTALL',
	'COMSPEC',
	'CONFIG_DIR',
	'FRONTEND_PORT',
	'HOME',
	'LOCALAPPDATA',
	'NODE_ENV',
	'PATH',
	'PATHEXT',
	'Path',
	'PROGRAMDATA',
	'PROGRAMFILES',
	'PROGRAMFILES(X86)',
	'PSMODULEPATH',
	'SYSTEMDRIVE',
	'SYSTEMROOT',
	'TEMP',
	'TMP',
	'USERPROFILE',
	'WINDIR',
] as const;

/**
 * Build a minimal environment for child processes instead of inheriting every
 * parent variable, which may include unrelated operator or CI secrets.
 */
function createChildEnv(): NodeJS.ProcessEnv {
	const env: NodeJS.ProcessEnv = {};

	for (const key of CHILD_ENV_KEYS) {
		const value = process.env[key];
		if (value !== undefined) {
			env[key] = value;
		}
	}

	return env;
}

/**
 * Write a PID file for later process management.
 */
function writePidFile(name: string, pid: number): void {
	const pidPath = path.join(logsDir, `${name}.pid`);
	fs.writeFileSync(pidPath, String(pid), 'utf8');
}

/**
 * Read a PID file if it exists.
 */
function readPidFile(name: string): null | number {
	const pidPath = path.join(logsDir, `${name}.pid`);
	if (!fs.existsSync(pidPath)) return null;
	const content = fs.readFileSync(pidPath, 'utf8').trim();
	const pid = Number(content);
	return Number.isFinite(pid) && pid > 0 ? pid : null;
}

/**
 * Check if a process with a given PID is alive. Duplicated from stop.ts so start
 * can detect a stale backend.pid without importing from stop.ts.
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
 * Kill a process by PID file if it exists.
 */
function killProcessByPidFile(name: string): void {
	const pid = readPidFile(name);
	if (pid) {
		try {
			process.kill(pid, 'SIGTERM');
		} catch {
			// Process already dead
		}
		const pidPath = path.join(logsDir, `${name}.pid`);
		fs.unlinkSync(pidPath);
	}
}

const PORT_CHECK_TIMEOUT_MS = 10_000;
const PORT_CHECK_INTERVAL_MS = 500;

/**
 * Wait for a port to become available (TCP connection succeeds).
 * Returns true if port is available within timeout, false otherwise.
 */
async function waitForPort(port: number, serviceName: string): Promise<boolean> {
	const deadline = Date.now() + PORT_CHECK_TIMEOUT_MS;

	while (Date.now() < deadline) {
		const socket = new net.Socket();
		const available = await new Promise<boolean>((resolve) => {
			socket.setTimeout(PORT_CHECK_INTERVAL_MS);
			socket.once('connect', () => {
				socket.destroy();
				resolve(true);
			});
			socket.once('error', () => {
				socket.destroy();
				resolve(false);
			});
			socket.once('timeout', () => {
				socket.destroy();
				resolve(false);
			});
			socket.connect(port, '127.0.0.1');
		});

		if (available) {
			console.log(`   ✓ ${serviceName} listening on port ${port}`);
			return true;
		}
	}

	return false;
}

/**
 * Open a log file descriptor for appending.
 */
function openLogFd(filename: string): number {
	const logPath = path.join(logsDir, filename);
	return fs.openSync(logPath, 'a');
}

/**
 * Spawn a detached background process with output redirected to log files.
 */
function spawnBackground(
	name: string,
	command: string,
	args: string[],
	cwd: string
): null | number {
	const stdoutFd = openLogFd(`${name}.log`);
	const stderrFd = openLogFd(`${name}.error.log`);

	const proc = spawn(command, args, {
		cwd,
		detached: true,
		env: createChildEnv(),
		stdio: ['ignore', stdoutFd, stderrFd],
		windowsHide: true,
	});

	if (!proc.pid) {
		console.error(`   ❌ Failed to start ${name}`);
		fs.closeSync(stdoutFd);
		fs.closeSync(stderrFd);
		return null;
	}

	// Detach from parent — parent can exit without killing children
	proc.unref();

	// Close FDs in parent after handing off to child
	fs.closeSync(stdoutFd);
	fs.closeSync(stderrFd);

	writePidFile(name, proc.pid);

	return proc.pid;
}

// Run check-application if requested
if (values.check) {
	const checkResult = Bun.spawnSync(['bun', 'run', 'check-application'], {
		cwd: rootDir,
		stdio: ['inherit', 'inherit', 'inherit'],
	});
	if (checkResult.exitCode !== 0) {
		process.exit(checkResult.exitCode ?? 1);
	}
}

// Surface a richer hint when the previous backend exited silently, then let
// stop.ts handle the actual cleanup. We pass --from-start so stop treats stale
// PID files (backend OR frontend) as the normal recoverable case and cleans
// them up without exiting non-zero — so the operator recovers with a single
// `bun run start` instead of having to run it twice.
const existingBackendPid = readPidFile('backend');
if (existingBackendPid !== null && !isProcessAlive(existingBackendPid)) {
	console.log(
		`⚠ Found stale backend.pid (PID ${existingBackendPid}) — previous backend exited silently. Check logs/backend.error.log.`
	);
}

// Stop any existing processes first
const stopResult = Bun.spawnSync(['bun', 'run', 'stop', '--', '--from-start'], {
	cwd: rootDir,
	stdio: ['inherit', 'inherit', 'inherit'],
});
if (stopResult.exitCode !== 0) {
	console.error('❌ Failed to stop existing processes');
	process.exit(1);
}

console.log(`\n🚀 Starting ${appSlug} in background mode...`);
console.log(`   Logs directory: ${logsDir}`);

// Start backend
const backendPid = spawnBackground('backend', 'bun', ['src/app.ts'], path.join(rootDir, 'backend'));

if (!backendPid) {
	console.error('   ❌ Failed to spawn backend process');
	process.exit(1);
}

console.log(`   ✓ Backend spawned (PID: ${backendPid}, port: ${backendPort})`);
console.log(`   Waiting for backend to be ready...`);

const backendReady = await waitForPort(backendPort, 'Backend');
if (!backendReady) {
	console.error(`   ❌ Backend failed to start within ${PORT_CHECK_TIMEOUT_MS / 1000}s`);
	console.error(`   Check logs at ${logsDir}/backend.error.log`);
	killProcessByPidFile('backend');
	process.exit(1);
}

// Start frontend
const frontendPid = spawnBackground(
	'frontend',
	'bun',
	['run', 'dev'],
	path.join(rootDir, 'frontend')
);

if (!frontendPid) {
	console.error('   ❌ Failed to spawn frontend process');
	killProcessByPidFile('backend');
	process.exit(1);
}

console.log(`   ✓ Frontend spawned (PID: ${frontendPid}, port: ${frontendPort})`);
console.log(`   Waiting for frontend to be ready...`);

const frontendReady = await waitForPort(frontendPort, 'Frontend');
if (!frontendReady) {
	console.error(`   ❌ Frontend failed to start within ${PORT_CHECK_TIMEOUT_MS / 1000}s`);
	console.error(`   Check logs at ${logsDir}/frontend.error.log`);
	killProcessByPidFile('frontend');
	killProcessByPidFile('backend');
	process.exit(1);
}

console.log(`\n✅ ${appSlug} is running in the background.`);
console.log(`   Backend:  http://localhost:${backendPort}`);
console.log(`   Frontend: http://localhost:${frontendPort}`);
console.log(`   Logs:     ${logsDir}/`);
console.log(`   Stop:     bun run stop`);
