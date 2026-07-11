import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { afterEach, describe, expect, test } from 'bun:test';

import { copySanitizedEvidence, iterationRange } from './lib/curation.ts';

const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
	const directory = await mkdtemp(resolve(tmpdir(), 'aidd-build-proofs-'));
	temporaryDirectories.push(directory);
	return directory;
}

afterEach(async () => {
	await Promise.all(
		temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true }))
	);
});

describe('copySanitizedEvidence', () => {
	test('preserves valid JSON formatting', async () => {
		const directory = await temporaryDirectory();
		const source = resolve(directory, 'source.json');
		const destination = resolve(directory, 'destination.json');
		const original = '{\n\t"passes": false,\n\t"spec": "retained evidence"\n}\n';
		await writeFile(source, original);

		await copySanitizedEvidence(source, destination);

		expect(await readFile(destination, 'utf8')).toBe(original);
	});

	test('normalizes a backslash-backtick escape from malformed model evidence', async () => {
		const directory = await temporaryDirectory();
		const source = resolve(directory, 'source.json');
		const destination = resolve(directory, 'destination.json');
		await writeFile(source, '{"passes":false,"spec":"inline code (`\\``)"}\n');

		await copySanitizedEvidence(source, destination);

		const copied = await readFile(destination, 'utf8');
		expect(JSON.parse(copied)).toEqual({ passes: false, spec: 'inline code (```)' });
	});
});

describe('iterationRange', () => {
	test('uses completed iterations for the end while retaining incomplete iterations in the count', async () => {
		const directory = await temporaryDirectory();
		await writeFile(
			resolve(directory, '001.json'),
			JSON.stringify({
				endedAt: '2026-06-01T10:10:00.000Z',
				startedAt: '2026-06-01T10:00:00.000Z',
			})
		);
		await writeFile(
			resolve(directory, '002.json'),
			JSON.stringify({ endedAt: null, startedAt: '2026-06-01T10:20:00.000Z' })
		);

		expect(await iterationRange(directory)).toEqual({
			count: 2,
			endedAt: '2026-06-01T10:10:00.000Z',
			startedAt: '2026-06-01T10:00:00.000Z',
		});
	});
});
