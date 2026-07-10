import type { ProofConfig } from './types.ts';

export const CAMPAIGN_ID = 'aidd-build-proofs-2026-07';
export const TRANSCRIPT_ASSET = 'aidd-build-proofs-2026-07-transcripts.zip';

export const PROOFS: ProofConfig[] = [
	{
		appName: 'Habit Tracker',
		backend: 'claude-code',
		id: 'a-fresh-habit-tracker',
		lane: 'fresh',
		limitations: [
			'The exact AIDD source revision used for each run was not captured.',
			'The initializer-to-coding and timeout continuations required manual relaunches.',
		],
		model: 'claude-opus-4-8',
		reasoningEffort: 'medium',
		recordedGate: 'bun run smoke:qc',
		recordedNonPassingFeatures: 0,
		recordedPassingFeatures: 25,
		sourceDirectory: 'habit-tracker',
		specFile: 'habit-tracker-spec.md',
		stack: 'Bun, TypeScript, Elysia, React 19, and Drizzle',
	},
	{
		appName: 'Kanban Board',
		backend: 'claude-code',
		id: 'b-template-kanban-board',
		lane: 'third-party-template',
		limitations: [
			'The exact AIDD source revision used for each run was not captured.',
			'Template path handling and spec-to-feature onboarding required intervention.',
		],
		model: 'claude-opus-4-8',
		reasoningEffort: 'medium',
		recordedGate: 'bun run smoke:qc',
		recordedNonPassingFeatures: 0,
		recordedPassingFeatures: 23,
		sourceDirectory: 'kanban-board',
		specFile: 'kanban-board-spec.md',
		stack: 'Vite, React 19, TypeScript, and Zustand',
	},
	{
		appName: 'SMB Infrastructure Dashboard',
		backend: 'claude-code',
		id: 'c-spernakit-smb-dashboard',
		lane: 'spernakit',
		limitations: [
			'The exact AIDD source revision used for each run was not captured.',
			'The retained metadata includes one non-passing remediation alongside 26 passing features.',
			'The campaign exposed masked quality gates and approval-context gaps.',
		],
		model: 'claude-opus-4-8',
		reasoningEffort: 'medium',
		recordedGate: 'bun run smoke:qc',
		recordedNonPassingFeatures: 1,
		recordedPassingFeatures: 26,
		sourceDirectory: 'smb-infrastructure-dashboard',
		specFile: 'smb-infrastructure-dashboard-spec.md',
		stack: 'Spernakit v3: Bun, Elysia, React 19, Drizzle, and SQLite',
	},
	{
		appName: 'Flaskr',
		backend: 'claude-code',
		id: 'd-existing-flaskr',
		lane: 'existing-ingest',
		limitations: [
			'The exact AIDD source revision used for each run was not captured.',
			'The retained 22-feature total includes the post-ingest security stretch work.',
			'Early runs required fixes for scaffold and metadata-only write-boundary assumptions.',
		],
		model: 'claude-opus-4-8',
		reasoningEffort: 'medium',
		recordedGate: 'pytest',
		recordedNonPassingFeatures: 0,
		recordedPassingFeatures: 22,
		sourceDirectory: 'flaskr',
		specFile: 'existing-app-ingest-proof.md',
		stack: 'Python, Flask, SQLite, and pytest',
	},
];

export const CURATED_AIDD_FILES = [
	'CHANGELOG.md',
	'assertions.md',
	'project-profile.json',
	'project-structure.md',
	'questions.md',
	'remediation-review.md',
	'response-review.md',
	'runs.jsonl',
	'testing-scenarios.md',
];

export const CURATED_AIDD_DIRECTORIES = [
	'audit-reports',
	'evidence',
	'features',
	'iterations',
	'reports',
];

export const ALLOWED_PUBLIC_PROJECTS = new Set([
	'aidd',
	'aidd-build-proofs',
	'flaskr',
	'habit-tracker',
	'kanban-board',
	'smb-infrastructure-dashboard',
	'spernakit',
]);
