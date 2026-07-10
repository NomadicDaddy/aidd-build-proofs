import { describe, expect, test } from 'bun:test';
import { resolve } from 'node:path';

import { assertInside } from './lib/files.ts';
import { findCredentialTokens, findSensitivePatterns, sanitizeText } from './lib/sanitize.ts';

describe('assertInside', () => {
	test('accepts descendants and rejects traversal outside the root', () => {
		const root = resolve('sandbox');
		expect(assertInside(root, resolve(root, 'child'))).toBe(resolve(root, 'child'));
		expect(() => assertInside(root, resolve(root, '..', 'sibling'))).toThrow(
			'Path escapes allowed root'
		);
	});
});

describe('sanitizeText', () => {
	test('normalizes workspace paths while preserving public proof projects', () => {
		const result = sanitizeText('D:\\applications\\habit-tracker\\README.md');
		expect(result.text).toBe('<WORKSPACE>/habit-tracker\\README.md');
		expect(result.categories).toContain('workspace-root');
	});

	test('redacts unrelated projects after workspace normalization', () => {
		const result = sanitizeText('D:\\applications\\private-project\\secret.txt');
		expect(result.text).toBe('<WORKSPACE>/<REDACTED_PROJECT>\\secret.txt');
		expect(result.categories).toContain('unrelated-project');
	});

	test('does not misclassify a flask slug as a provider token', () => {
		const result = sanitizeText('harden-the-flask-security-boundary');
		expect(result.text).toBe('harden-the-flask-security-boundary');
		expect(result.categories).not.toContain('provider-token');
	});

	test('redacts private network addresses and credentials', () => {
		const result = sanitizeText('password="correct-horse" host=192.168.1.10');
		expect(result.text).toContain('<REDACTED_CREDENTIAL>');
		expect(result.text).toContain('<PRIVATE_IP>');
	});

	test('redacts complete private key blocks', () => {
		const body = 'A'.repeat(100);
		const result = sanitizeText(`-----BEGIN PRIVATE KEY-----${body}-----END PRIVATE KEY-----`);
		expect(result.text).toBe('<REDACTED_PRIVATE_KEY>');
		expect(result.categories).toContain('private-key');
	});
});

describe('findSensitivePatterns', () => {
	test('detects private source material', () => {
		expect(findSensitivePatterns('C:\\Users\\name\\file and 10.0.0.1')).toEqual([
			'absolute-user-path',
			'private-ip',
		]);
	});

	test('allows sanitized paths and loopback addresses', () => {
		expect(findSensitivePatterns('<WORKSPACE>/aidd and 127.0.0.1')).toEqual([]);
	});

	test('distinguishes redacted and unredacted credential assignments', () => {
		expect(findSensitivePatterns("password='<REDACTED_CREDENTIAL>'")).toEqual([]);
		expect(findSensitivePatterns("password='still-secret'")).toEqual(['credential-assignment']);
	});
});

describe('findCredentialTokens', () => {
	test('does not flag private-address fixtures or key-header validators', () => {
		expect(findCredentialTokens("10.0.0.10 and '-----BEGIN PRIVATE KEY-----'")).toEqual([]);
	});
});
