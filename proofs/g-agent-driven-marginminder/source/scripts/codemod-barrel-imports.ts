#!/usr/bin/env bun
/**
 * Codemod: Eliminate UI component barrel imports
 *
 * Replaces `import { X, Y } from '@/components/ui'` with direct file imports
 * like `import { X } from '@/components/ui/button'`.
 *
 * Usage: bun scripts/codemod-barrel-imports.ts [--dry-run]
 *   Run from any spernakit app root directory.
 */

import { resolve, relative } from 'path';

// ── Types ───────────────────────────────────────────────────────────────────

interface ExportEntry {
	isTypeOnly: boolean;
	sourceFile: string; // e.g. 'button' (without .tsx)
}

interface ParsedImportName {
	isType: boolean; // inline `type` keyword
	name: string;
}

interface BarrelImportMatch {
	fullMatch: string;
	isWholeStatementType: boolean; // `import type { ... }`
	names: ParsedImportName[];
	startIndex: number;
}

// ── Barrel file parser ──────────────────────────────────────────────────────

function parseBarrelFile(content: string): Map<string, ExportEntry> {
	const exportMap = new Map<string, ExportEntry>();

	// Match: export { Name1, Name2 } from './source-file.tsx';
	// Match: export type { Name1, Name2 } from './source-file.tsx';
	const exportRegex = /export\s+(type\s+)?\{([^}]+)\}\s+from\s+'\.\/([^']+?)(?:\.tsx)?';/g;

	let match: null | RegExpExecArray;
	while ((match = exportRegex.exec(content)) !== null) {
		const isTypeOnly = match[1] !== undefined;
		const namesBlock = match[2] ?? '';
		const sourceFile = (match[3] ?? '').replace(/\.tsx$/, '');

		const names = namesBlock
			.split(',')
			.map((n) => n.trim())
			.filter((n) => n.length > 0);

		for (const name of names) {
			exportMap.set(name, { isTypeOnly, sourceFile });
		}
	}

	return exportMap;
}

// ── Import statement finder ─────────────────────────────────────────────────

function findBarrelImports(content: string): BarrelImportMatch[] {
	const matches: BarrelImportMatch[] = [];

	// Match both single-line and multi-line barrel imports
	// Handles: import { X } from '@/components/ui';
	//          import type { X } from '@/components/ui';
	//          import {\n\tX,\n\tY,\n} from '@/components/ui';
	const importRegex = /import\s+(type\s+)?\{([^}]+)\}\s+from\s+'@\/components\/ui';/g;

	let match: null | RegExpExecArray;
	while ((match = importRegex.exec(content)) !== null) {
		const isWholeStatementType = match[1] !== undefined;
		const namesBlock = match[2] ?? '';

		const names: ParsedImportName[] = namesBlock
			.split(',')
			.map((n) => n.trim())
			.filter((n) => n.length > 0)
			.map((n) => {
				if (n.startsWith('type ')) {
					return { isType: true, name: n.slice(5).trim() };
				}
				return { isType: false, name: n };
			});

		matches.push({
			fullMatch: match[0],
			isWholeStatementType,
			names,
			startIndex: match.index,
		});
	}

	return matches;
}

// ── Import line formatter ───────────────────────────────────────────────────

function formatImportLine(sourceFile: string, names: ParsedImportName[]): string {
	const allTypeOnly = names.every((n) => n.isType);
	const sortedNames = [...names].sort((a, b) => a.name.localeCompare(b.name));

	const typeKeyword = allTypeOnly ? 'type ' : '';
	const namesList = sortedNames
		.map((n) => {
			if (n.isType && !allTypeOnly) {
				return `type ${n.name}`;
			}
			return n.name;
		})
		.join(', ');

	const singleLine = `import ${typeKeyword}{ ${namesList} } from '@/components/ui/${sourceFile}';`;

	if (singleLine.length <= 100) {
		return singleLine;
	}

	// Multi-line format
	const lines = sortedNames.map((n) => {
		const prefix = n.isType && !allTypeOnly ? 'type ' : '';
		return `\t${prefix}${n.name},`;
	});

	return `import ${typeKeyword}{\n${lines.join('\n')}\n} from '@/components/ui/${sourceFile}';`;
}

// ── File processor ──────────────────────────────────────────────────────────

function processFile(
	content: string,
	exportMap: Map<string, ExportEntry>,
	filePath: string
): { content: string; modified: boolean; warnings: string[] } {
	const warnings: string[] = [];
	const barrelImports = findBarrelImports(content);

	if (barrelImports.length === 0) {
		return { content, modified: false, warnings };
	}

	// Collect all imported names from all barrel imports in this file
	const allNames: ParsedImportName[] = [];
	for (const imp of barrelImports) {
		for (const n of imp.names) {
			const isType = imp.isWholeStatementType || n.isType;
			allNames.push({ isType, name: n.name });
		}
	}

	// Group by source file
	const grouped = new Map<string, ParsedImportName[]>();
	for (const n of allNames) {
		const entry = exportMap.get(n.name);
		if (!entry) {
			warnings.push(`  Unknown export '${n.name}' in ${filePath}`);
			continue;
		}
		const sourceFile = entry.sourceFile;
		if (!grouped.has(sourceFile)) {
			grouped.set(sourceFile, []);
		}
		grouped.get(sourceFile)!.push(n);
	}

	// Generate replacement imports, sorted by source file
	const sortedSourceFiles = [...grouped.keys()].sort();
	const replacementLines = sortedSourceFiles.map((sf) => formatImportLine(sf, grouped.get(sf)!));
	const replacement = replacementLines.join('\n');

	// Replace: put all new imports at the position of the first barrel import,
	// remove all other barrel imports
	let result = content;

	// Process in reverse order to preserve indices
	const sorted = [...barrelImports].sort((a, b) => b.startIndex - a.startIndex);

	const firstBarrelImport = barrelImports[0];
	for (const imp of sorted) {
		if (imp === firstBarrelImport) {
			// First barrel import (in original order) — replace with all new imports
			result =
				result.slice(0, imp.startIndex) +
				replacement +
				result.slice(imp.startIndex + imp.fullMatch.length);
		} else {
			// Subsequent barrel imports — remove entirely (including trailing newline)
			let endIndex = imp.startIndex + imp.fullMatch.length;
			if (result[endIndex] === '\n') {
				endIndex++;
			}
			result = result.slice(0, imp.startIndex) + result.slice(endIndex);
		}
	}

	return { content: result, modified: true, warnings };
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const dryRun = args.includes('--dry-run');
	const cwd = process.cwd();

	const barrelPath = resolve(cwd, 'frontend/src/components/ui/index.ts');
	const srcPath = resolve(cwd, 'frontend/src');

	// Read and parse barrel file
	const barrelFile = Bun.file(barrelPath);
	if (!(await barrelFile.exists())) {
		console.error(`Barrel file not found: ${barrelPath}`);
		process.exit(1);
	}

	const barrelContent = (await barrelFile.text()).replace(/\r\n/g, '\n');
	const exportMap = parseBarrelFile(barrelContent);
	console.log(
		`Parsed barrel file: ${exportMap.size} exports from ${new Set([...exportMap.values()].map((e) => e.sourceFile)).size} source files`
	);

	// Find all .ts/.tsx files
	const glob = new Bun.Glob('**/*.{ts,tsx}');
	const allFiles: string[] = [];
	for await (const path of glob.scan({ absolute: true, cwd: srcPath })) {
		// Skip the barrel file itself
		if (path.replace(/\\/g, '/').endsWith('components/ui/index.ts')) continue;
		allFiles.push(path);
	}

	console.log(`Scanning ${allFiles.length} files...`);

	let modifiedCount = 0;
	const allWarnings: string[] = [];

	for (const filePath of allFiles) {
		const file = Bun.file(filePath);
		const rawContent = await file.text();
		const hasCRLF = rawContent.includes('\r\n');
		const content = rawContent.replace(/\r\n/g, '\n');

		// Quick check — skip files without barrel imports
		if (!content.includes("from '@/components/ui';")) continue;

		const rel = relative(cwd, filePath).replace(/\\/g, '/');
		const result = processFile(content, exportMap, rel);

		if (result.warnings.length > 0) {
			allWarnings.push(...result.warnings);
		}

		if (!result.modified) continue;

		modifiedCount++;

		if (dryRun) {
			console.log(`\n[DRY RUN] ${rel}`);
			// Show the diff: find what changed
			const oldLines = content.split('\n');
			const newLines = result.content.split('\n');
			// Simple: just show the new import block for the first ~30 lines
			const maxPreview = 30;
			let diffStart = -1;
			let diffEnd = -1;
			for (let i = 0; i < Math.max(oldLines.length, newLines.length); i++) {
				if (oldLines[i] !== newLines[i]) {
					if (diffStart === -1) diffStart = i;
					diffEnd = i;
				}
			}
			if (diffStart >= 0) {
				const previewEnd = Math.min(diffEnd + 1, diffStart + maxPreview);
				console.log(`  Lines ${diffStart + 1}-${previewEnd + 1}:`);
				for (let i = diffStart; i <= previewEnd; i++) {
					if (i < newLines.length) {
						console.log(`  + ${newLines[i]}`);
					}
				}
				if (previewEnd < diffEnd) {
					console.log(`  ... (${diffEnd - previewEnd} more lines)`);
				}
			}
		} else {
			const output = hasCRLF ? result.content.replace(/\n/g, '\r\n') : result.content;
			await Bun.write(filePath, output);
			console.log(`  Updated: ${rel}`);
		}
	}

	if (allWarnings.length > 0) {
		console.log('\nWarnings:');
		for (const w of allWarnings) {
			console.log(w);
		}
	}

	if (!dryRun && modifiedCount > 0) {
		// Delete the barrel file
		const { unlinkSync } = await import('fs');
		unlinkSync(barrelPath);
		console.log(`\nDeleted: ${relative(cwd, barrelPath).replace(/\\/g, '/')}`);
	}

	console.log(
		`\n${dryRun ? '[DRY RUN] ' : ''}Done. ${modifiedCount} file${modifiedCount === 1 ? '' : 's'} ${dryRun ? 'would be ' : ''}modified.`
	);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
