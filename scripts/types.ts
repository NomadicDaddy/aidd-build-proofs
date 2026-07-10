export interface ProofConfig {
	id: string;
	appName: string;
	sourceDirectory: string;
	specFile: string;
	lane: 'existing-ingest' | 'fresh' | 'spernakit' | 'third-party-template';
	stack: string;
	backend: string;
	model: string;
	reasoningEffort: string;
	recordedGate: string;
	recordedPassingFeatures: number;
	recordedNonPassingFeatures: number;
	limitations: string[];
}

export interface ArtifactDigest {
	path: string;
	sha256: string;
}

export interface ReplayResult {
	checkedAt: string;
	command: string;
	note?: string;
	status: 'failed' | 'not-run' | 'passed';
}

export interface ProofManifestEntry {
	id: string;
	appName: string;
	lane: ProofConfig['lane'];
	stack: string;
	startedAt: string;
	endedAt: string;
	backend: {
		id: string;
		model: string;
		reasoningEffort: string;
	};
	source: {
		commitCount: number;
		exportedFileCount: number;
		originalHeadCommit: string;
		originalRootCommit: string;
		path: string;
		treeSha256: string;
	};
	evidence: {
		iterationCount: number;
		path: string;
		treeSha256: string;
	};
	features: {
		nonPassing: number;
		passing: number;
		total: number;
	};
	validation: {
		recordedCommand: string;
		recordedResult: 'passed';
		replay: ReplayResult;
	};
	keyArtifacts: ArtifactDigest[];
	limitations: string[];
}

export interface TranscriptArchiveManifest {
	assetName: string;
	entryCount: number;
	indexPath: string;
	sha256: string | null;
	uniqueFileCount: number;
}

export interface CampaignManifest {
	schemaVersion: 1;
	campaign: {
		id: string;
		name: string;
		publicAiddBaseline: string;
		aiddRevisionCaptured: false;
		aiddRepository: string;
		environment: {
			bun: string;
			os: string;
			shell: string;
		};
	};
	proofs: ProofManifestEntry[];
	transcriptArchive: TranscriptArchiveManifest;
}

export interface SanitizationResult {
	categories: string[];
	text: string;
}

export interface TranscriptIndexEntry {
	proofId: string;
	publishedPath: string;
	redactions: string[];
	sha256: string;
	size: number;
	source: string;
	type: 'campaign-log' | 'iteration-log';
}

export interface TranscriptIndex {
	schemaVersion: 1;
	archive: string;
	entries: TranscriptIndexEntry[];
	generatedAt: string;
	policy: string;
}
