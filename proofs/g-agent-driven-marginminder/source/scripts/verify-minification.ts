#!/usr/bin/env bun

/**
 * Minification Analysis Script
 *
 * Compares bundle sizes before and after minification optimization
 */

// ANSI color codes
const colors: Record<string, string> = {
	blue: '\x1b[34m',
	bold: '\x1b[1m',
	cyan: '\x1b[36m',
	green: '\x1b[32m',
	red: '\x1b[31m',
	reset: '\x1b[0m',
	yellow: '\x1b[33m',
};

function log(message: string, color = 'reset'): void {
	console.log(`${colors[color] ?? colors['reset']}${message}${colors['reset']}`);
}

interface BundleSizes {
	[key: string]: number;
}

interface BundleResult {
	afterSize: number;
	beforeSize: number;
	diff: number;
	diffPercent: string;
	file: string;
}

// Before optimization (from previous build)
const before: BundleSizes = {
	'AuditLogsContent.js': 18.87,
	'icons.js': 20.23,
	'index.css': 107.35,
	'index.js': 224.48,
	'Notifications.js': 22.02,
	'Profile.js': 31.85,
	'query.js': 35.47,
	'ResetPassword.js': 11.94,
	'ResetPasswordToken.js': 19.83,
	'Roles.js': 20.58,
	'router.js': 32.3,
	'socket.js': 40.31,
	'toast.js': 11.57,
	'Users.js': 41.05,
	'vendor.js': 356.12,
};

// After optimization (from current build)
const after: BundleSizes = {
	'AuditLogsContent.js': 19.26,
	'icons.js': 20.71,
	'index.css': 109.93,
	'index.js': 227.7,
	'Notifications.js': 22.54,
	'Profile.js': 32.62,
	'query.js': 35.15,
	'ResetPassword.js': 12.23,
	'ResetPasswordToken.js': 20.27,
	'Roles.js': 21.03,
	'router.js': 32.42,
	'socket.js': 41.19,
	'toast.js': 11.86,
	'Users.js': 42.04,
	'vendor.js': 304.12,
};

log('\n╔════════════════════════════════════════════════════════════╗', 'blue');
log('║         Minification Optimization Analysis                ║', 'blue');
log('╚════════════════════════════════════════════════════════════╝', 'blue');

log('\n=== Bundle Size Comparison ===\n', 'cyan');

let totalBefore = 0;
let totalAfter = 0;
let improvements = 0;
let regressions = 0;

const results: BundleResult[] = [];

for (const [file, beforeSize] of Object.entries(before)) {
	const afterSize = after[file] ?? beforeSize;
	const diff = afterSize - beforeSize;
	const diffPercent = ((diff / beforeSize) * 100).toFixed(1);

	totalBefore += beforeSize;
	totalAfter += afterSize;

	if (diff < 0) {
		improvements++;
	} else if (diff > 0) {
		regressions++;
	}

	results.push({
		afterSize,
		beforeSize,
		diff,
		diffPercent,
		file,
	});
}

// Sort by absolute difference (biggest improvements first)
results.sort((a, b) => a.diff - b.diff);

// Display results
for (const result of results) {
	const { afterSize, beforeSize, diff, diffPercent, file } = result;

	const arrow = diff < 0 ? '↓' : diff > 0 ? '↑' : '→';
	const color = diff < 0 ? 'green' : diff > 0 ? 'red' : 'reset';
	const sign = diff > 0 ? '+' : '';

	log(
		`${file.padEnd(25)} ${beforeSize.toFixed(2).padStart(8)} KB → ${afterSize.toFixed(2).padStart(8)} KB  ${arrow} ${sign}${diff.toFixed(2).padStart(7)} KB (${sign}${diffPercent}%)`,
		color
	);
}

log(`\n${'='.repeat(80)}\n`, 'cyan');

// Summary
const totalDiff = totalAfter - totalBefore;
const totalDiffPercent = ((totalDiff / totalBefore) * 100).toFixed(1);
const totalColor = totalDiff < 0 ? 'green' : totalDiff > 0 ? 'red' : 'reset';

log(
	`${'TOTAL'.padEnd(25)} ${totalBefore.toFixed(2).padStart(8)} KB → ${totalAfter.toFixed(2).padStart(8)} KB  ${totalDiff < 0 ? '↓' : '↑'} ${totalDiff > 0 ? '+' : ''}${totalDiff.toFixed(2).padStart(7)} KB (${totalDiff > 0 ? '+' : ''}${totalDiffPercent}%)`,
	totalColor
);

log('\n=== Summary ===\n', 'cyan');

log(`Files analyzed: ${results.length}`, 'cyan');
log(`Improvements: ${improvements}`, improvements > 0 ? 'green' : 'reset');
log(`Regressions: ${regressions}`, regressions > 0 ? 'yellow' : 'reset');
log(`No change: ${results.length - improvements - regressions}`, 'reset');

log('\n=== Analysis ===\n', 'cyan');

if (totalDiff < 0) {
	log(
		`✓ Overall bundle size DECREASED by ${Math.abs(totalDiff).toFixed(2)} KB (${Math.abs(Number(totalDiffPercent))}%)`,
		'green'
	);
	log(`  This is a POSITIVE result - minification is working!`, 'green');
} else if (totalDiff > 0) {
	log(
		`⚠ Overall bundle size INCREASED by ${totalDiff.toFixed(2)} KB (${totalDiffPercent}%)`,
		'yellow'
	);
	log(`  This might be due to:`, 'yellow');
	log(`  - Additional features or dependencies added`, 'yellow');
	log(`  - More aggressive code splitting (more chunks = more overhead)`, 'yellow');
	log(`  - Build configuration changes`, 'yellow');
} else {
	log(`→ Overall bundle size UNCHANGED`, 'reset');
}

// Biggest improvements
log('\n=== Top 3 Improvements ===\n', 'cyan');
const topImprovements = results.filter((r) => r.diff < 0).slice(0, 3);
if (topImprovements.length > 0) {
	topImprovements.forEach((r, i) => {
		log(
			`${i + 1}. ${r.file}: ${Math.abs(r.diff).toFixed(2)} KB saved (${Math.abs(Number(r.diffPercent))}%)`,
			'green'
		);
	});
} else {
	log('No improvements detected', 'yellow');
}

// Biggest regressions
if (regressions > 0) {
	log('\n=== Top 3 Regressions ===\n', 'cyan');
	const topRegressions = results
		.filter((r) => r.diff > 0)
		.slice(-3)
		.reverse();
	topRegressions.forEach((r, i) => {
		log(`${i + 1}. ${r.file}: +${r.diff.toFixed(2)} KB (${r.diffPercent}%)`, 'yellow');
	});
}

log('\n=== Minification Effectiveness ===\n', 'cyan');

// Calculate average compression with gzip
const avgGzipRatio = 0.77; // From previous verification
const beforeGzip = totalBefore * (1 - avgGzipRatio);
const afterGzip = totalAfter * (1 - avgGzipRatio);

log(`Before minification (uncompressed): ${totalBefore.toFixed(2)} KB`, 'reset');
log(`After minification (uncompressed):  ${totalAfter.toFixed(2)} KB`, 'reset');
log(`Estimated with Gzip (before):       ${beforeGzip.toFixed(2)} KB`, 'reset');
log(`Estimated with Gzip (after):        ${afterGzip.toFixed(2)} KB`, 'reset');

log('\n=== Recommendations ===\n', 'cyan');

if (totalDiff < -10) {
	log('✓ Excellent minification results!', 'green');
	log('  Continue monitoring bundle sizes with each build.', 'green');
} else if (totalDiff < 0) {
	log('✓ Good minification results!', 'green');
	log('  Consider additional optimizations:', 'cyan');
	log('  - Remove unused dependencies', 'cyan');
	log('  - Implement lazy loading for heavy components', 'cyan');
	log('  - Use dynamic imports for route-based code splitting', 'cyan');
} else {
	log('⚠ Bundle size increased despite minification.', 'yellow');
	log('  Investigate:', 'yellow');
	log('  - Recent dependency additions', 'yellow');
	log('  - New features that might be adding significant code', 'yellow');
	log('  - Build configuration changes', 'yellow');
}

log(`\n${'='.repeat(80)}\n`, 'cyan');
