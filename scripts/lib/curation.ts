import { basename, extname, resolve } from 'node:path';
import { readFile } from 'node:fs/promises';

import { CURATED_AIDD_DIRECTORIES, CURATED_AIDD_FILES } from '../config.ts';
import {
	assertInside,
	ensureEmptyDirectory,
	listFiles,
	normalizeRelative,
	pathExists,
	writeBytes,
	writeText,
} from './files.ts';
import { sanitizeText } from './sanitize.ts';

const decoder = new TextDecoder();

function runGit(repository: string, args: string[]): Uint8Array {
	const result = Bun.spawnSync(['git', '-C', repository, ...args], {
		stderr: 'pipe',
		stdout: 'pipe',
	});
	if (result.exitCode !== 0) {
		throw new Error(
			`git ${args.join(' ')} failed in ${repository}: ${decoder.decode(result.stderr).trim()}`
		);
	}
	return result.stdout;
}

function isForbiddenSourcePath(path: string): boolean {
	const normalized = path.replaceAll('\\', '/');
	const segments = normalized.split('/');
	const forbiddenDirectories = new Set([
		'.git',
		'.venv',
		'build',
		'coverage',
		'dist',
		'node_modules',
	]);
	const forbiddenExtensions = new Set([
		'.db',
		'.log',
		'.pem',
		'.pfx',
		'.p12',
		'.sqlite',
		'.sqlite3',
	]);
	return (
		normalized.startsWith('.aidd/') ||
		segments.some((segment) => segment.toLowerCase() === 'agents.md') ||
		segments.some((segment) => forbiddenDirectories.has(segment)) ||
		forbiddenExtensions.has(extname(normalized).toLowerCase())
	);
}

function isTextEvidence(path: string): boolean {
	return new Set(['.json', '.jsonl', '.md', '.rst', '.txt', '.tsv']).has(
		extname(path).toLowerCase()
	);
}

export async function exportCommittedSource(
	repository: string,
	destination: string,
	allowedRoot: string
): Promise<{ commitCount: number; head: string; root: string }> {
	await ensureEmptyDirectory(allowedRoot, destination);
	const tracked = decoder
		.decode(runGit(repository, ['ls-tree', '-r', '--name-only', '-z', 'HEAD']))
		.split('\0')
		.filter((path) => path.length > 0 && !isForbiddenSourcePath(path));

	for (const relativePath of tracked) {
		const target = assertInside(destination, resolve(destination, relativePath));
		await writeBytes(target, runGit(repository, ['show', `HEAD:${relativePath}`]));
	}

	return {
		commitCount: Number(
			decoder.decode(runGit(repository, ['rev-list', '--count', 'HEAD'])).trim()
		),
		head: decoder.decode(runGit(repository, ['rev-parse', 'HEAD'])).trim(),
		root: decoder.decode(runGit(repository, ['rev-list', '--max-parents=0', 'HEAD'])).trim(),
	};
}

export async function copySanitizedEvidence(source: string, destination: string): Promise<void> {
	const bytes = await readFile(source);
	if (isTextEvidence(source)) {
		await writeText(destination, sanitizeText(decoder.decode(bytes)).text);
		return;
	}
	await writeBytes(destination, bytes);
}

export async function curateAiddEvidence(
	aiddRoot: string,
	destination: string,
	allowedRoot: string
): Promise<void> {
	await ensureEmptyDirectory(allowedRoot, destination);
	for (const filename of CURATED_AIDD_FILES) {
		const source = resolve(aiddRoot, filename);
		if (await pathExists(source)) {
			await copySanitizedEvidence(source, resolve(destination, filename));
		}
	}

	for (const directoryName of CURATED_AIDD_DIRECTORIES) {
		const sourceDirectory = resolve(aiddRoot, directoryName);
		const destinationDirectory = directoryName === 'evidence' ? 'media' : directoryName;
		if (!(await pathExists(sourceDirectory))) continue;
		for (const source of await listFiles(sourceDirectory)) {
			const relativePath = normalizeRelative(sourceDirectory, source);
			if (directoryName === 'iterations' && extname(source) !== '.json') continue;
			if (directoryName === 'features' && basename(source) !== 'feature.json') continue;
			if (extname(source).toLowerCase() === '.log') continue;
			await copySanitizedEvidence(
				source,
				assertInside(destination, resolve(destination, destinationDirectory, relativePath))
			);
		}
	}
}

function readStringField(value: unknown, field: string, path: string): string {
	if (typeof value !== 'object' || value === null || !(field in value)) {
		throw new Error(`Missing ${field} in ${path}`);
	}
	const fieldValue = (value as Record<string, unknown>)[field];
	if (typeof fieldValue !== 'string') throw new Error(`Invalid ${field} in ${path}`);
	return fieldValue;
}

export async function iterationRange(iterationsDirectory: string): Promise<{
	count: number;
	endedAt: string;
	startedAt: string;
}> {
	const files = (await listFiles(iterationsDirectory)).filter(
		(path) => extname(path) === '.json'
	);
	const starts: string[] = [];
	const ends: string[] = [];
	for (const file of files) {
		const parsed: unknown = JSON.parse(await readFile(file, 'utf8'));
		starts.push(readStringField(parsed, 'startedAt', file));
		ends.push(readStringField(parsed, 'endedAt', file));
	}
	if (starts.length === 0) throw new Error(`No iteration JSON found in ${iterationsDirectory}`);
	starts.sort();
	ends.sort();
	return { count: files.length, endedAt: ends.at(-1) ?? '', startedAt: starts[0] ?? '' };
}

export async function featureCounts(
	featuresDirectory: string
): Promise<{ nonPassing: number; passing: number }> {
	let passing = 0;
	let nonPassing = 0;
	for (const file of await listFiles(featuresDirectory)) {
		if (basename(file) !== 'feature.json') continue;
		const parsed: unknown = JSON.parse(await readFile(file, 'utf8'));
		if (typeof parsed !== 'object' || parsed === null || !('passes' in parsed)) {
			throw new Error(`Feature lacks passes field: ${file}`);
		}
		if ((parsed as Record<string, unknown>).passes === true) passing += 1;
		else nonPassing += 1;
	}
	return { nonPassing, passing };
}

export async function writeCommitLedger(repository: string, destination: string): Promise<void> {
	const log = decoder.decode(
		runGit(repository, [
			'log',
			'--reverse',
			'--date=iso-strict',
			'--pretty=format:%H%x09%aI%x09%s',
		])
	);
	await writeText(destination, `commit\tauthored_at\tsubject\n${sanitizeText(log).text}`);
}
