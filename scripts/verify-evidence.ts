import { basename, extname, resolve } from 'node:path';
import { readFile, rm, stat } from 'node:fs/promises';

import { PROOFS, TRANSCRIPT_ASSET } from './config.ts';
import {
	assertInside,
	ensureEmptyDirectory,
	listFiles,
	normalizeRelative,
	pathExists,
	sha256File,
	treeDigest,
} from './lib/files.ts';
import { findCredentialTokens, findSensitivePatterns } from './lib/sanitize.ts';
import type { CampaignManifest, ProofManifestEntry, TranscriptIndex } from './types.ts';

const repositoryRoot = resolve(import.meta.dir, '..');
const failures: string[] = [];

function fail(message: string): void {
	failures.push(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

async function readCampaignManifest(): Promise<CampaignManifest> {
	const path = resolve(repositoryRoot, 'proofs', 'manifest.json');
	const parsed: unknown = JSON.parse(await readFile(path, 'utf8'));
	if (!isRecord(parsed) || parsed.schemaVersion !== 1 || !Array.isArray(parsed.proofs)) {
		throw new Error('proofs/manifest.json does not match schema version 1');
	}
	return parsed as unknown as CampaignManifest;
}

async function readTranscriptIndex(): Promise<TranscriptIndex> {
	const path = resolve(repositoryRoot, 'release', 'transcript-index.json');
	const parsed: unknown = JSON.parse(await readFile(path, 'utf8'));
	if (!isRecord(parsed) || parsed.schemaVersion !== 1 || !Array.isArray(parsed.entries)) {
		throw new Error('release/transcript-index.json does not match schema version 1');
	}
	return parsed as unknown as TranscriptIndex;
}

async function countFeatureResults(
	featuresRoot: string
): Promise<{ nonPassing: number; passing: number }> {
	let passing = 0;
	let nonPassing = 0;
	for (const file of await listFiles(featuresRoot)) {
		if (basename(file) !== 'feature.json') continue;
		const parsed: unknown = JSON.parse(await readFile(file, 'utf8'));
		if (!isRecord(parsed) || typeof parsed.passes !== 'boolean') {
			fail(`Invalid feature record: ${normalizeRelative(repositoryRoot, file)}`);
			continue;
		}
		if (parsed.passes) passing += 1;
		else nonPassing += 1;
	}
	return { nonPassing, passing };
}

async function verifyProof(entry: ProofManifestEntry): Promise<void> {
	const sourceRoot = resolve(repositoryRoot, entry.source.path);
	const evidenceRoot = resolve(repositoryRoot, entry.evidence.path);
	if (!(await pathExists(sourceRoot))) fail(`Missing source directory for ${entry.id}`);
	if (!(await pathExists(evidenceRoot))) fail(`Missing evidence directory for ${entry.id}`);

	const sourceTree = await treeDigest(sourceRoot);
	const evidenceTree = await treeDigest(evidenceRoot);
	if (sourceTree.sha256 !== entry.source.treeSha256)
		fail(`${entry.id} source tree hash mismatch`);
	if (sourceTree.fileCount !== entry.source.exportedFileCount) {
		fail(`${entry.id} source file count mismatch`);
	}
	if (evidenceTree.sha256 !== entry.evidence.treeSha256)
		fail(`${entry.id} evidence tree hash mismatch`);

	const features = await countFeatureResults(resolve(evidenceRoot, 'features'));
	if (features.passing !== entry.features.passing)
		fail(`${entry.id} passing feature count mismatch`);
	if (features.nonPassing !== entry.features.nonPassing) {
		fail(`${entry.id} non-passing feature count mismatch`);
	}
	const iterations = (await listFiles(resolve(evidenceRoot, 'iterations'))).filter(
		(path) => extname(path).toLowerCase() === '.json'
	);
	if (iterations.length !== entry.evidence.iterationCount) {
		fail(`${entry.id} iteration count mismatch`);
	}
	for (const iteration of iterations) {
		try {
			JSON.parse(await readFile(iteration, 'utf8'));
		} catch {
			fail(`Invalid iteration JSON: ${normalizeRelative(repositoryRoot, iteration)}`);
		}
	}

	for (const artifact of entry.keyArtifacts) {
		const path = resolve(repositoryRoot, artifact.path);
		if (!(await pathExists(path))) {
			fail(`Missing key artifact: ${artifact.path}`);
			continue;
		}
		if ((await sha256File(path)) !== artifact.sha256)
			fail(`Artifact hash mismatch: ${artifact.path}`);
	}
}

async function verifyRepositorySafety(): Promise<void> {
	const ignoredRoots = new Set(['.git', '.release', 'node_modules']);
	const forbiddenDirectories = new Set(['.git', '.venv', 'node_modules']);
	const forbiddenExtensions = new Set([
		'.db',
		'.log',
		'.pem',
		'.pfx',
		'.p12',
		'.sqlite',
		'.sqlite3',
	]);
	for (const file of await listFiles(repositoryRoot)) {
		const relativePath = normalizeRelative(repositoryRoot, file);
		const segments = relativePath.split('/');
		if (ignoredRoots.has(segments[0] ?? '')) continue;
		if (segments.some((segment) => forbiddenDirectories.has(segment))) {
			fail(`Forbidden directory content: ${relativePath}`);
		}
		if (forbiddenExtensions.has(extname(file).toLowerCase())) {
			fail(`Forbidden file type: ${relativePath}`);
		}
		if (
			new Set(['.json', '.jsonl', '.md', '.rst', '.ts', '.tsv', '.txt', '.yml', '.yaml']).has(
				extname(file).toLowerCase()
			)
		) {
			const isSourceSnapshot = /^proofs\/[^/]+\/source\//.test(relativePath);
			const isDetectionCode = new Set([
				'scripts/lib/sanitize.ts',
				'scripts/sanitize.test.ts',
				'scripts/verify-evidence.ts',
			]).has(relativePath);
			const text = await readFile(file, 'utf8');
			const findings = isDetectionCode
				? []
				: isSourceSnapshot
					? findCredentialTokens(text)
					: findSensitivePatterns(text);
			for (const finding of findings) fail(`Sensitive ${finding} in ${relativePath}`);
		}
	}

	for (const required of [
		'LICENSE-CC-BY-4.0.txt',
		'LICENSE-MIT.txt',
		'THIRD_PARTY_NOTICES.md',
		'proofs/d-existing-flaskr/source/LICENSE.txt',
		'proofs/c-spernakit-smb-dashboard/source/LICENSE',
	]) {
		if (!(await pathExists(resolve(repositoryRoot, required))))
			fail(`Missing license file: ${required}`);
	}
}

async function verifyRelease(manifest: CampaignManifest): Promise<void> {
	const index = await readTranscriptIndex();
	if (index.archive !== TRANSCRIPT_ASSET) fail('Transcript index archive name mismatch');
	if (index.entries.length !== manifest.transcriptArchive.entryCount) {
		fail('Transcript entry count mismatch');
	}
	const uniqueFiles = new Set(index.entries.map((entry) => entry.publishedPath)).size;
	if (uniqueFiles !== manifest.transcriptArchive.uniqueFileCount) {
		fail('Unique transcript file count mismatch');
	}
	for (const entry of index.entries) {
		if (!PROOFS.some((proof) => proof.id === entry.proofId)) {
			fail(`Transcript references unknown proof: ${entry.proofId}`);
		}
		if (entry.source.includes(':\\') || entry.source.startsWith('/')) {
			fail(`Transcript index exposes an absolute source path: ${entry.source}`);
		}
	}
	const sums = (
		await readFile(resolve(repositoryRoot, 'release', 'SHA256SUMS.txt'), 'utf8')
	).trim();
	const expected = `${manifest.transcriptArchive.sha256}  ${TRANSCRIPT_ASSET}`;
	if (sums !== expected) fail('SHA256SUMS.txt does not match the campaign manifest');

	const archivePath = resolve(repositoryRoot, '.release', TRANSCRIPT_ASSET);
	if (!(await pathExists(archivePath))) return;
	if ((await sha256File(archivePath)) !== manifest.transcriptArchive.sha256) {
		fail('Local transcript archive checksum does not match the manifest');
		return;
	}
	const listing = Bun.spawnSync(['tar', '-t', '-f', archivePath], {
		stderr: 'pipe',
		stdout: 'pipe',
	});
	if (listing.exitCode !== 0) {
		fail(
			`Unable to list transcript archive: ${new TextDecoder().decode(listing.stderr).trim()}`
		);
		return;
	}
	for (const archiveEntry of new TextDecoder()
		.decode(listing.stdout)
		.split(/\r?\n/)
		.filter(Boolean)) {
		const normalized = archiveEntry.replaceAll('\\', '/');
		if (normalized.startsWith('/') || normalized.split('/').includes('..')) {
			fail(`Unsafe transcript archive path: ${archiveEntry}`);
		}
	}

	const extractionRoot = resolve(repositoryRoot, '.release', 'archive-verification');
	await ensureEmptyDirectory(repositoryRoot, extractionRoot);
	const extraction = Bun.spawnSync(['tar', '-x', '-f', archivePath, '-C', extractionRoot], {
		stderr: 'pipe',
		stdout: 'pipe',
	});
	if (extraction.exitCode !== 0) {
		fail(
			`Unable to extract transcript archive: ${new TextDecoder().decode(extraction.stderr).trim()}`
		);
		await rm(extractionRoot, { force: true, recursive: true });
		return;
	}
	for (const entry of index.entries) {
		const publishedPath = assertInside(
			extractionRoot,
			resolve(extractionRoot, entry.publishedPath)
		);
		if (!(await pathExists(publishedPath))) {
			fail(`Transcript missing from archive: ${entry.publishedPath}`);
			continue;
		}
		if ((await sha256File(publishedPath)) !== entry.sha256) {
			fail(`Transcript hash mismatch: ${entry.publishedPath}`);
		}
		if ((await stat(publishedPath)).size !== entry.size) {
			fail(`Transcript size mismatch: ${entry.publishedPath}`);
		}
		for (const finding of findSensitivePatterns(await readFile(publishedPath, 'utf8'))) {
			fail(`Sensitive ${finding} in archived transcript ${entry.publishedPath}`);
		}
	}
	await rm(extractionRoot, { force: true, recursive: true });
}

async function main(): Promise<void> {
	const manifest = await readCampaignManifest();
	const expectedIds = PROOFS.map((proof) => proof.id).sort();
	const actualIds = manifest.proofs.map((proof) => proof.id).sort();
	if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds))
		fail('Manifest proof IDs are incomplete');
	if (manifest.campaign.aiddRevisionCaptured !== false) {
		fail('Campaign must disclose that the AIDD revision was not captured');
	}
	for (const proof of manifest.proofs) await verifyProof(proof);
	await verifyRepositorySafety();
	await verifyRelease(manifest);

	if (failures.length > 0) {
		for (const failure of failures) console.error(`- ${failure}`);
		throw new Error(`Evidence verification failed with ${failures.length} issue(s)`);
	}
	console.log(
		`Verified ${manifest.proofs.length} proofs and ${manifest.transcriptArchive.entryCount} transcripts.`
	);
}

await main();
