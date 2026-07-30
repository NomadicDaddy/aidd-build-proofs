import { join } from 'node:path';

const decoder = new TextDecoder();

export interface ArchiveResult {
	stderr: string;
	stdout: string;
	success: boolean;
}

let resolvedTool: string | null | undefined;

function candidateTools(): string[] {
	if (process.platform !== 'win32') return ['bsdtar', 'tar'];
	const systemRoot = process.env.SystemRoot ?? process.env.SYSTEMROOT ?? 'C:\\Windows';
	return [join(systemRoot, 'System32', 'tar.exe'), 'bsdtar', 'tar'];
}

function reportsLibarchive(command: string): boolean {
	try {
		const version = Bun.spawnSync([command, '--version'], { stderr: 'pipe', stdout: 'pipe' });
		if (version.exitCode !== 0) return false;
		return decoder.decode(version.stdout).toLowerCase().includes('libarchive');
	} catch {
		return false;
	}
}

/**
 * The transcript archive is a zip, which GNU tar can neither create nor read, and GNU tar also
 * misreads a Windows `D:\...` argument as a remote `host:path`. Both problems disappear once the
 * resolved binary is libarchive-backed, so require that explicitly rather than trusting `tar`.
 */
export function resolveArchiveTool(): string {
	if (resolvedTool === undefined) {
		resolvedTool = candidateTools().find((candidate) => reportsLibarchive(candidate)) ?? null;
	}
	if (resolvedTool === null) {
		throw new Error(
			'No libarchive-backed tar found on PATH. The transcript archive is a .zip, which GNU ' +
				'tar cannot read. macOS and Windows 10+ ship bsdtar as `tar`; on Debian or Ubuntu ' +
				'install it with `apt install libarchive-tools`.'
		);
	}
	return resolvedTool;
}

function run(args: string[], workingDirectory?: string): ArchiveResult {
	const result = Bun.spawnSync([resolveArchiveTool(), ...args], {
		...(workingDirectory === undefined ? {} : { cwd: workingDirectory }),
		stderr: 'pipe',
		stdout: 'pipe',
	});
	return {
		stderr: decoder.decode(result.stderr).trim(),
		stdout: decoder.decode(result.stdout),
		success: result.exitCode === 0,
	};
}

export function createArchive(
	archivePath: string,
	workingDirectory: string,
	entries: string[]
): ArchiveResult {
	return run(['-a', '-c', '-f', archivePath, ...entries], workingDirectory);
}

export function extractArchive(archivePath: string, destination: string): ArchiveResult {
	return run(['-x', '-f', archivePath, '-C', destination]);
}

export function listArchive(archivePath: string): ArchiveResult {
	return run(['-t', '-f', archivePath]);
}
