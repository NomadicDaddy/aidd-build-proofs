import { mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

import { PROOFS, TRANSCRIPT_ASSET } from './config.ts';
import {
	ensureEmptyDirectory,
	listFiles,
	pathExists,
	sha256Bytes,
	sha256File,
	writeText,
} from './lib/files.ts';
import { sanitizeText } from './lib/sanitize.ts';
import type { CampaignManifest, TranscriptIndex, TranscriptIndexEntry } from './types.ts';

const repositoryRoot = resolve(import.meta.dir, '..');
const releaseRoot = resolve(repositoryRoot, '.release');
const stagingRoot = resolve(releaseRoot, 'transcript-staging');
const trackedReleaseRoot = resolve(repositoryRoot, 'release');

function getSourceRoot(): string {
	const sourceIndex = Bun.argv.indexOf('--source');
	const source = Bun.argv[sourceIndex + 1];
	if (sourceIndex === -1 || !source) {
		throw new Error('Usage: bun run package:transcripts -- --source <raw-proof-archive>');
	}
	return resolve(source);
}

function proofForCampaignLog(filename: string): string | null {
	const normalized = filename.toLowerCase();
	if (normalized.startsWith('habit-tracker-')) return 'a-fresh-habit-tracker';
	if (normalized.startsWith('kanban-board-')) return 'b-template-kanban-board';
	if (normalized.startsWith('smb-')) return 'c-spernakit-smb-dashboard';
	if (normalized.startsWith('flaskr-')) return 'd-existing-flaskr';
	return null;
}

async function collectSources(sourceRoot: string): Promise<
	Array<{
		logicalSource: string;
		path: string;
		proofId: string;
		type: TranscriptIndexEntry['type'];
	}>
> {
	const sources: Array<{
		logicalSource: string;
		path: string;
		proofId: string;
		type: TranscriptIndexEntry['type'];
	}> = [];
	for (const entry of await readdir(sourceRoot, { withFileTypes: true })) {
		if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.log')) continue;
		const proofId = proofForCampaignLog(entry.name);
		if (!proofId) continue;
		sources.push({
			logicalSource: `campaign/${entry.name}`,
			path: resolve(sourceRoot, entry.name),
			proofId,
			type: 'campaign-log',
		});
	}

	for (const proof of PROOFS) {
		const iterationsRoot = resolve(sourceRoot, proof.sourceDirectory, '.aidd', 'iterations');
		for (const path of await listFiles(iterationsRoot)) {
			if (!path.toLowerCase().endsWith('.log')) continue;
			sources.push({
				logicalSource: `${proof.id}/iterations/${basename(path)}`,
				path,
				proofId: proof.id,
				type: 'iteration-log',
			});
		}
	}
	return sources.sort((left, right) => left.logicalSource.localeCompare(right.logicalSource));
}

function publishedPathFor(
	proofId: string,
	type: TranscriptIndexEntry['type'],
	filename: string,
	hash: string
): string {
	const prefix = type === 'campaign-log' ? 'campaign' : 'iteration';
	return `transcripts/${proofId}/${prefix}-${hash.slice(0, 10)}-${filename}`;
}

async function updateCampaignManifest(
	index: TranscriptIndex,
	archiveSha256: string
): Promise<void> {
	const manifestPath = resolve(repositoryRoot, 'proofs', 'manifest.json');
	const parsed: unknown = JSON.parse(await readFile(manifestPath, 'utf8'));
	if (typeof parsed !== 'object' || parsed === null || !('transcriptArchive' in parsed)) {
		throw new Error('Invalid campaign manifest');
	}
	const manifest = parsed as CampaignManifest;
	manifest.transcriptArchive = {
		assetName: TRANSCRIPT_ASSET,
		entryCount: index.entries.length,
		indexPath: 'release/transcript-index.json',
		sha256: archiveSha256,
		uniqueFileCount: new Set(index.entries.map((entry) => entry.publishedPath)).size,
	};
	await writeText(manifestPath, JSON.stringify(manifest, null, 2));
}

async function main(): Promise<void> {
	const sourceRoot = getSourceRoot();
	await mkdir(releaseRoot, { recursive: true });
	await mkdir(trackedReleaseRoot, { recursive: true });
	await ensureEmptyDirectory(repositoryRoot, stagingRoot);
	const archivePath = resolve(releaseRoot, TRANSCRIPT_ASSET);
	if (await pathExists(archivePath)) await rm(archivePath, { force: true });

	const published = new Map<string, string>();
	const entries: TranscriptIndexEntry[] = [];
	for (const source of await collectSources(sourceRoot)) {
		const raw = await readFile(source.path, 'utf8');
		const sanitized = sanitizeText(raw);
		const bytes = new TextEncoder().encode(`${sanitized.text.replace(/\n*$/, '')}\n`);
		const sha256 = sha256Bytes(bytes);
		let publishedPath = published.get(sha256);
		if (!publishedPath) {
			publishedPath = publishedPathFor(
				source.proofId,
				source.type,
				basename(source.path),
				sha256
			);
			published.set(sha256, publishedPath);
			await Bun.write(resolve(stagingRoot, publishedPath), bytes);
		}
		entries.push({
			proofId: source.proofId,
			publishedPath,
			redactions: sanitized.categories,
			sha256,
			size: bytes.byteLength,
			source: source.logicalSource,
			type: source.type,
		});
	}

	const index: TranscriptIndex = {
		archive: TRANSCRIPT_ASSET,
		entries,
		generatedAt: new Date().toISOString(),
		policy:
			'Public transcripts are normalized and scrubbed for credentials, private paths, ' +
			'environment identifiers, private IPs, and unrelated project names.',
		schemaVersion: 1,
	};
	const serializedIndex = JSON.stringify(index, null, 2);
	await writeText(resolve(stagingRoot, 'transcript-index.json'), serializedIndex);
	await writeText(resolve(trackedReleaseRoot, 'transcript-index.json'), serializedIndex);
	await writeText(
		resolve(stagingRoot, 'README.txt'),
		[
			'AIDD Build-Proofs Transcript Archive',
			'',
			'These are historical model and tool transcripts, not authoritative product documentation.',
			'Paths, credentials, private network identifiers, and unrelated local project names were',
			'redacted. See transcript-index.json for provenance, hashes, and redaction categories.',
		].join('\n')
	);

	const tar = Bun.spawnSync(
		[
			'tar',
			'-a',
			'-c',
			'-f',
			archivePath,
			'README.txt',
			'transcript-index.json',
			'transcripts',
		],
		{ cwd: stagingRoot, stderr: 'pipe', stdout: 'pipe' }
	);
	if (tar.exitCode !== 0) {
		throw new Error(`tar failed: ${new TextDecoder().decode(tar.stderr).trim()}`);
	}
	const archiveSha256 = await sha256File(archivePath);
	await writeText(
		resolve(trackedReleaseRoot, 'SHA256SUMS.txt'),
		`${archiveSha256}  ${TRANSCRIPT_ASSET}`
	);
	await updateCampaignManifest(index, archiveSha256);
	await rm(stagingRoot, { force: true, recursive: true });
	console.log(
		`Packaged ${entries.length} transcript references (${published.size} unique files) to ${archivePath}`
	);
}

await main();
