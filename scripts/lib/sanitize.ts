import { ALLOWED_PUBLIC_PROJECTS } from '../config.ts';
import type { SanitizationResult } from '../types.ts';

const SECRET_REPLACEMENTS: Array<{ category: string; pattern: RegExp }> = [
	{ category: 'github-token', pattern: /\bgh[opsu]_[A-Za-z0-9]{20,}\b/g },
	{ category: 'github-token', pattern: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g },
	{ category: 'provider-token', pattern: /(?<![A-Za-z0-9])sk-[A-Za-z0-9_-]{24,}\b/g },
	{ category: 'slack-token', pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
	{ category: 'aws-access-key', pattern: /\bAKIA[0-9A-Z]{16}\b/g },
	{
		category: 'jwt',
		pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
	},
];

const CREDENTIAL_ASSIGNMENT =
	/((?:api[_-]?key|access[_-]?token|password|passwd|secret|bearer)["']?\s*[:=]\s*["'])([^"'\r\n]{6,})(["'])/gi;

const PRIVATE_IPV4 =
	/\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})\b/g;
const PRIVATE_KEY_BLOCK =
	/-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----[\s\S]{80,}?-----END (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g;

function replaceWorkspaceProjects(text: string, categories: Set<string>): string {
	return text.replace(/<WORKSPACE>[\\/]([A-Za-z0-9._-]+)/g, (_match, project: string) => {
		if (ALLOWED_PUBLIC_PROJECTS.has(project.toLowerCase())) {
			return `<WORKSPACE>/${project}`;
		}
		categories.add('unrelated-project');
		return '<WORKSPACE>/<REDACTED_PROJECT>';
	});
}

export function sanitizeText(input: string): SanitizationResult {
	const categories = new Set<string>();
	let text = input.replaceAll('\r\n', '\n');

	text = text.replace(/[A-Za-z]:\\Users\\[^\\\s"'`]+/gi, () => {
		categories.add('user-home');
		return '<USER_HOME>';
	});
	text = text.replace(
		/(?:[A-Za-z]:\\|\/[a-z]\/|\/mnt\/[a-z]\/)(?:applications)(?=[\\/])/gi,
		() => {
			categories.add('workspace-root');
			return '<WORKSPACE>';
		}
	);
	text = text.replace(/(?:[A-Za-z]:\\|\/[a-z]\/|\/mnt\/[a-z]\/)(?:__queue)(?=[\\/])/gi, () => {
		categories.add('queue-root');
		return '<QUEUE>';
	});
	text = replaceWorkspaceProjects(text, categories);

	for (const { category, pattern } of SECRET_REPLACEMENTS) {
		text = text.replace(pattern, () => {
			categories.add(category);
			return `<REDACTED_${category.toUpperCase().replaceAll('-', '_')}>`;
		});
	}
	text = text.replace(
		CREDENTIAL_ASSIGNMENT,
		(_match, prefix: string, _value: string, suffix: string) => {
			categories.add('credential-assignment');
			return `${prefix}<REDACTED_CREDENTIAL>${suffix}`;
		}
	);
	text = text.replace(PRIVATE_KEY_BLOCK, () => {
		categories.add('private-key');
		return '<REDACTED_PRIVATE_KEY>';
	});
	text = text.replace(PRIVATE_IPV4, () => {
		categories.add('private-ip');
		return '<PRIVATE_IP>';
	});
	text = text.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, () => {
		categories.add('email-address');
		return '<REDACTED_EMAIL>';
	});
	text = text.replace(/\b(?:WYRD(?:\\SQLX)?|deeper-sql-user|sdv8mn)\b/gi, () => {
		categories.add('private-environment');
		return '<REDACTED_ENVIRONMENT>';
	});

	return { categories: [...categories].sort(), text };
}

export function findSensitivePatterns(text: string): string[] {
	const findings = new Set<string>();
	const patterns: Array<{ name: string; pattern: RegExp }> = [
		{ name: 'absolute-user-path', pattern: /[A-Za-z]:\\Users\\/i },
		{
			name: 'absolute-workspace-path',
			pattern: /(?:[A-Za-z]:\\|\/[a-z]\/|\/mnt\/[a-z]\/)applications[\\/]/i,
		},
		{ name: 'private-ip', pattern: PRIVATE_IPV4 },
		{ name: 'private-environment', pattern: /\b(?:WYRD(?:\\SQLX)?|deeper-sql-user|sdv8mn)\b/i },
		{ name: 'email-address', pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi },
		{ name: 'private-key', pattern: PRIVATE_KEY_BLOCK },
	];
	for (const { name, pattern } of patterns) {
		pattern.lastIndex = 0;
		if (pattern.test(text)) findings.add(name);
	}
	CREDENTIAL_ASSIGNMENT.lastIndex = 0;
	for (const match of text.matchAll(CREDENTIAL_ASSIGNMENT)) {
		const value = match[2];
		if (value && !value.startsWith('<REDACTED_')) findings.add('credential-assignment');
	}
	for (const { category, pattern } of SECRET_REPLACEMENTS) {
		pattern.lastIndex = 0;
		if (pattern.test(text)) findings.add(category);
	}
	return [...findings].sort();
}

export function findCredentialTokens(text: string): string[] {
	const findings = new Set<string>();
	for (const { category, pattern } of SECRET_REPLACEMENTS) {
		pattern.lastIndex = 0;
		if (pattern.test(text)) findings.add(category);
	}
	return [...findings].sort();
}
