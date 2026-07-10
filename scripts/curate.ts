import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';

import { CAMPAIGN_ID, PROOFS, TRANSCRIPT_ASSET } from './config.ts';
import {
	copySanitizedEvidence,
	curateAiddEvidence,
	exportCommittedSource,
	featureCounts,
	iterationRange,
	writeCommitLedger,
} from './lib/curation.ts';
import {
	artifactDigest,
	normalizeRelative,
	pathExists,
	treeDigest,
	writeText,
} from './lib/files.ts';
import type { CampaignManifest, ProofConfig, ProofManifestEntry, ReplayResult } from './types.ts';

const repositoryRoot = resolve(import.meta.dir, '..');

function getSourceRoot(): string {
	const sourceIndex = Bun.argv.indexOf('--source');
	const source = Bun.argv[sourceIndex + 1];
	if (sourceIndex === -1 || !source) {
		throw new Error('Usage: bun run curate -- --source <raw-proof-archive>');
	}
	return resolve(source);
}

async function curateProof(sourceRoot: string, config: ProofConfig): Promise<ProofManifestEntry> {
	const proofRoot = resolve(repositoryRoot, 'proofs', config.id);
	const sourceRepository = resolve(sourceRoot, config.sourceDirectory);
	const sourceDestination = resolve(proofRoot, 'source');
	const evidenceDestination = resolve(proofRoot, 'evidence');
	const specDestination = resolve(proofRoot, 'spec.md');
	const ledgerDestination = resolve(proofRoot, 'commits.tsv');

	if (!(await pathExists(resolve(sourceRepository, '.git')))) {
		throw new Error(`Missing embedded git repository: ${sourceRepository}`);
	}

	const git = await exportCommittedSource(sourceRepository, sourceDestination, repositoryRoot);
	await curateAiddEvidence(
		resolve(sourceRepository, '.aidd'),
		evidenceDestination,
		repositoryRoot
	);
	await copySanitizedEvidence(resolve(sourceRoot, config.specFile), specDestination);
	await writeCommitLedger(sourceRepository, ledgerDestination);

	const counts = await featureCounts(resolve(evidenceDestination, 'features'));
	if (
		counts.passing !== config.recordedPassingFeatures ||
		counts.nonPassing !== config.recordedNonPassingFeatures
	) {
		throw new Error(
			`${config.id} feature mismatch: expected ${config.recordedPassingFeatures}/` +
				`${config.recordedNonPassingFeatures}, got ${counts.passing}/${counts.nonPassing}`
		);
	}
	const iterations = await iterationRange(resolve(evidenceDestination, 'iterations'));
	const sourceTree = await treeDigest(sourceDestination);
	const evidenceTree = await treeDigest(evidenceDestination);
	const keyArtifactPaths = [specDestination, ledgerDestination];
	const runsLedger = resolve(evidenceDestination, 'runs.jsonl');
	if (await pathExists(runsLedger)) keyArtifactPaths.push(runsLedger);

	return {
		appName: config.appName,
		backend: {
			id: config.backend,
			model: config.model,
			reasoningEffort: config.reasoningEffort,
		},
		endedAt: iterations.endedAt,
		evidence: {
			iterationCount: iterations.count,
			path: normalizeRelative(repositoryRoot, evidenceDestination),
			treeSha256: evidenceTree.sha256,
		},
		features: {
			nonPassing: counts.nonPassing,
			passing: counts.passing,
			total: counts.passing + counts.nonPassing,
		},
		id: config.id,
		keyArtifacts: await Promise.all(
			keyArtifactPaths.map((path) => artifactDigest(repositoryRoot, path))
		),
		lane: config.lane,
		limitations: config.limitations,
		source: {
			commitCount: git.commitCount,
			exportedFileCount: sourceTree.fileCount,
			originalHeadCommit: git.head,
			originalRootCommit: git.root,
			path: normalizeRelative(repositoryRoot, sourceDestination),
			treeSha256: sourceTree.sha256,
		},
		stack: config.stack,
		startedAt: iterations.startedAt,
		validation: {
			recordedCommand: config.recordedGate,
			recordedResult: 'passed',
			replay: {
				checkedAt: '',
				command: config.recordedGate,
				status: 'not-run',
			},
		},
	};
}

async function loadExistingReplays(): Promise<Map<string, ReplayResult>> {
	const manifestPath = resolve(repositoryRoot, 'proofs', 'manifest.json');
	if (!(await pathExists(manifestPath))) return new Map();
	const parsed: unknown = JSON.parse(await readFile(manifestPath, 'utf8'));
	if (typeof parsed !== 'object' || parsed === null || !('proofs' in parsed)) return new Map();
	const proofs = (parsed as Record<string, unknown>).proofs;
	if (!Array.isArray(proofs)) return new Map();
	const replays = new Map<string, ReplayResult>();
	for (const proof of proofs) {
		if (typeof proof !== 'object' || proof === null) continue;
		const record = proof as Record<string, unknown>;
		if (
			typeof record.id !== 'string' ||
			typeof record.validation !== 'object' ||
			!record.validation
		) {
			continue;
		}
		const replay = (record.validation as Record<string, unknown>).replay;
		if (typeof replay !== 'object' || !replay) continue;
		const replayRecord = replay as Record<string, unknown>;
		if (
			typeof replayRecord.checkedAt === 'string' &&
			typeof replayRecord.command === 'string' &&
			['failed', 'not-run', 'passed'].includes(String(replayRecord.status))
		) {
			replays.set(record.id, replay as ReplayResult);
		}
	}
	return replays;
}

async function main(): Promise<void> {
	const sourceRoot = getSourceRoot();
	const existingReplays = await loadExistingReplays();
	const entries: ProofManifestEntry[] = [];
	for (const config of PROOFS) {
		console.log(`Curating ${config.id}...`);
		const entry = await curateProof(sourceRoot, config);
		const replay = existingReplays.get(config.id);
		if (replay) entry.validation.replay = replay;
		entries.push(entry);
	}

	const manifest: CampaignManifest = {
		campaign: {
			aiddRepository: 'https://github.com/NomadicDaddy/aidd',
			aiddRevisionCaptured: false,
			environment: {
				bun: '1.3.14',
				os: 'Windows 11',
				shell: 'PowerShell 7',
			},
			id: CAMPAIGN_ID,
			name: 'AIDD four-lane build-proofs campaign',
			publicAiddBaseline: 'v2.102.0',
		},
		proofs: entries,
		schemaVersion: 1,
		transcriptArchive: {
			assetName: TRANSCRIPT_ASSET,
			entryCount: 0,
			indexPath: 'release/transcript-index.json',
			sha256: null,
			uniqueFileCount: 0,
		},
	};
	await writeText(
		resolve(repositoryRoot, 'proofs', 'manifest.json'),
		JSON.stringify(manifest, null, 2)
	);
	console.log(`Curated ${entries.length} proofs from ${sourceRoot}`);
}

await main();
