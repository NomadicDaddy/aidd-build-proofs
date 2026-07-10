import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';

import type { ArtifactDigest } from '../types.ts';

export function assertInside(baseDirectory: string, candidate: string): string {
	const base = resolve(baseDirectory);
	const target = resolve(candidate);
	if (target !== base && !target.startsWith(`${base}${sep}`)) {
		throw new Error(`Path escapes allowed root: ${candidate}`);
	}
	return target;
}

export async function ensureEmptyDirectory(baseDirectory: string, target: string): Promise<void> {
	const safeTarget = assertInside(baseDirectory, target);
	if (safeTarget === resolve(baseDirectory)) {
		throw new Error('Refusing to empty the repository root');
	}
	await rm(safeTarget, { force: true, recursive: true });
	await mkdir(safeTarget, { recursive: true });
}

export async function listFiles(root: string): Promise<string[]> {
	const results: string[] = [];
	async function visit(directory: string): Promise<void> {
		for (const entry of await readdir(directory, { withFileTypes: true })) {
			const fullPath = resolve(directory, entry.name);
			if (entry.isDirectory()) {
				await visit(fullPath);
			} else if (entry.isFile()) {
				results.push(fullPath);
			}
		}
	}
	try {
		await visit(root);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
	}
	return results.sort((left, right) => left.localeCompare(right));
}

export function normalizeRelative(root: string, path: string): string {
	return relative(root, path).replaceAll('\\', '/');
}

export function sha256Bytes(bytes: Uint8Array | string): string {
	return createHash('sha256').update(bytes).digest('hex');
}

export async function sha256File(path: string): Promise<string> {
	return sha256Bytes(await readFile(path));
}

export async function treeDigest(root: string): Promise<{ fileCount: number; sha256: string }> {
	const hash = createHash('sha256');
	const files = await listFiles(root);
	for (const file of files) {
		const relativePath = normalizeRelative(root, file);
		hash.update(relativePath);
		hash.update('\0');
		hash.update(await sha256File(file));
		hash.update('\0');
	}
	return { fileCount: files.length, sha256: hash.digest('hex') };
}

export async function writeBytes(path: string, bytes: Uint8Array): Promise<void> {
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, bytes);
}

export async function writeText(path: string, text: string): Promise<void> {
	await mkdir(dirname(path), { recursive: true });
	const normalized = `${text.replaceAll('\r\n', '\n').replace(/\n*$/, '')}\n`;
	await writeFile(path, normalized, 'utf8');
}

export async function artifactDigest(
	repositoryRoot: string,
	path: string
): Promise<ArtifactDigest> {
	return {
		path: normalizeRelative(repositoryRoot, path),
		sha256: await sha256File(path),
	};
}

export async function pathExists(path: string): Promise<boolean> {
	try {
		await stat(path);
		return true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
		throw error;
	}
}
