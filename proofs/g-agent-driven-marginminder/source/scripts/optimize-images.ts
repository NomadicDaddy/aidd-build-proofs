#!/usr/bin/env bun
/**
 * Image Optimization Script
 *
 * Optimizes images in the frontend/public directory by:
 * 1. Converting PNG/JPG to WebP format
 * 2. Compressing images while maintaining quality
 * 3. Generating responsive image variants
 * 4. Preserving original files for fallback
 *
 * Usage:
 *   bun scripts/optimize-images.ts [options]
 *
 * Options:
 *   --quality=<number>  WebP quality (1-100, default: 80)
 *   --sizes=<list>      Comma-separated sizes for responsive images (default: 320,640,1024,1280)
 *   --force             Re-optimize all images even if WebP exists
 *   --dry-run           Show what would be done without making changes
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const DEFAULT_QUALITY = 80;
const DEFAULT_SIZES = [320, 640, 1024, 1280];
const SUPPORTED_FORMATS = ['.jpg', '.jpeg', '.png'];
const PUBLIC_DIR = path.resolve(__dirname, '../frontend/public');

interface OptimizationOptions {
	dryRun: boolean;
	force: boolean;
	quality: number;
	sizes: number[];
}

interface ImageVariant {
	path: string;
	size: string;
	width: number;
}

interface OptimizationResult {
	dryRun?: boolean;
	error?: string;
	originalSize?: string;
	path: string;
	reason?: string;
	savings?: string;
	skipped?: boolean;
	success?: boolean;
	variants?: ImageVariant[];
	webpSize?: string;
}

// Parse command line arguments
const args = process.argv.slice(2);
const options: OptimizationOptions = {
	dryRun: false,
	force: false,
	quality: DEFAULT_QUALITY,
	sizes: DEFAULT_SIZES,
};

args.forEach((arg) => {
	if (arg.startsWith('--quality=')) {
		const value = arg.split('=')[1];
		if (value) {
			options.quality = parseInt(value, 10);
		}
	} else if (arg.startsWith('--sizes=')) {
		const value = arg.split('=')[1];
		if (value) {
			options.sizes = value.split(',').map((s) => parseInt(s.trim(), 10));
		}
	} else if (arg === '--force') {
		options.force = true;
	} else if (arg === '--dry-run') {
		options.dryRun = true;
	}
});

// Validate options
if (options.quality < 1 || options.quality > 100) {
	console.error('Error: Quality must be between 1 and 100');
	process.exit(1);
}

/**
 * Check if a file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
	try {
		await fs.access(filePath);
		return true;
	} catch {
		return false;
	}
}

/**
 * Get all image files in a directory recursively
 */
async function getImageFiles(dir: string, fileList: string[] = []): Promise<string[]> {
	const files = await fs.readdir(dir, { withFileTypes: true });

	for (const file of files) {
		const filePath = path.join(dir, file.name);

		if (file.isDirectory()) {
			// Skip node_modules and hidden directories
			if (!file.name.startsWith('.') && file.name !== 'node_modules') {
				await getImageFiles(filePath, fileList);
			}
		} else {
			const ext = path.extname(file.name).toLowerCase();
			if (SUPPORTED_FORMATS.includes(ext)) {
				fileList.push(filePath);
			}
		}
	}

	return fileList;
}

/**
 * Get file size in KB
 */
async function getFileSize(filePath: string): Promise<string> {
	const stats = await fs.stat(filePath);
	return (stats.size / 1024).toFixed(2);
}

/**
 * Convert image to WebP format
 */
async function convertToWebP(
	inputPath: string,
	outputPath: string,
	quality: number
): Promise<void> {
	await new Bun.Image(inputPath).webp({ quality }).write(outputPath);
}

/**
 * Generate responsive image variant
 */
async function generateResponsiveVariant(
	inputPath: string,
	outputPath: string,
	width: number,
	quality: number
): Promise<void> {
	const metadata = await new Bun.Image(inputPath).metadata();

	const pipeline = new Bun.Image(inputPath);
	if (metadata.width && metadata.width > width) {
		await pipeline
			.resize(width, undefined, { withoutEnlargement: true })
			.webp({ quality })
			.write(outputPath);
	} else {
		await pipeline.webp({ quality }).write(outputPath);
	}
}

/**
 * Optimize a single image
 */
async function optimizeImage(imagePath: string): Promise<null | OptimizationResult> {
	const ext = path.extname(imagePath);
	const basename = path.basename(imagePath, ext);
	const dirname = path.dirname(imagePath);

	// Skip if this is already a WebP file
	if (ext === '.webp') {
		return null;
	}

	// Skip favicon files (they're already optimized by generate-favicons.js)
	if (
		basename.includes('favicon') ||
		basename.includes('android-chrome') ||
		basename.includes('apple-touch')
	) {
		return null;
	}

	const webpPath = path.join(dirname, `${basename}.webp`);
	const originalSize = await getFileSize(imagePath);

	// Check if WebP already exists and we're not forcing re-optimization
	if (!options.force && (await fileExists(webpPath))) {
		return {
			path: imagePath,
			reason: 'WebP already exists',
			skipped: true,
		};
	}

	if (options.dryRun) {
		return {
			dryRun: true,
			originalSize,
			path: imagePath,
		};
	}

	try {
		// Convert to WebP
		await convertToWebP(imagePath, webpPath, options.quality);
		const webpSize = await getFileSize(webpPath);
		const savings = ((1 - parseFloat(webpSize) / parseFloat(originalSize)) * 100).toFixed(1);

		const result: OptimizationResult = {
			originalSize,
			path: imagePath,
			savings: `${savings}%`,
			success: true,
			webpSize,
		};

		// Generate responsive variants if sizes are specified
		if (options.sizes.length > 0) {
			const metadata = await new Bun.Image(imagePath).metadata();
			result.variants = [];

			for (const size of options.sizes) {
				// Only generate variants smaller than the original
				if (metadata.width && size < metadata.width) {
					const variantPath = path.join(dirname, `${basename}-${size}w.webp`);
					await generateResponsiveVariant(imagePath, variantPath, size, options.quality);
					const variantSize = await getFileSize(variantPath);
					result.variants.push({
						path: variantPath,
						size: variantSize,
						width: size,
					});
				}
			}
		}

		return result;
	} catch (err: unknown) {
		const typedErr = err instanceof Error ? err : new Error(String(err));
		return {
			error: typedErr.message,
			path: imagePath,
			success: false,
		};
	}
}

/**
 * Format bytes to human-readable size
 */
function formatBytes(kb: number): string {
	if (kb < 1024) return `${kb} KB`;
	return `${(kb / 1024).toFixed(2)} MB`;
}

/**
 * Main execution
 */
async function main(): Promise<void> {
	console.log('🖼️  Image Optimization Script\n');
	console.log(`📁 Directory: ${PUBLIC_DIR}`);
	console.log(`⚙️  Quality: ${options.quality}`);
	console.log(`📐 Responsive sizes: ${options.sizes.join(', ')}`);
	console.log(`🔄 Force re-optimization: ${options.force}`);
	console.log(`🧪 Dry run: ${options.dryRun}\n`);

	// Check if public directory exists
	if (!(await fileExists(PUBLIC_DIR))) {
		console.error(`❌ Error: Public directory not found: ${PUBLIC_DIR}`);
		process.exit(1);
	}

	// Get all image files
	console.log('🔍 Scanning for images...');
	const imageFiles = await getImageFiles(PUBLIC_DIR);

	if (imageFiles.length === 0) {
		console.log('✅ No images found to optimize');
		return;
	}

	console.log(`📊 Found ${imageFiles.length} image(s)\n`);

	// Optimize each image
	let totalOriginalSize = 0;
	let totalWebPSize = 0;
	let optimizedCount = 0;
	let skippedCount = 0;
	let errorCount = 0;

	for (const imagePath of imageFiles) {
		const result = await optimizeImage(imagePath);

		if (result) {
			if (result.skipped) {
				skippedCount++;
				console.log(
					`⏭️  Skipped: ${path.relative(PUBLIC_DIR, result.path)} (${result.reason})`
				);
			} else if (result.dryRun) {
				console.log(
					`🧪 Would optimize: ${path.relative(PUBLIC_DIR, result.path)} (${result.originalSize} KB)`
				);
			} else if (result.success) {
				optimizedCount++;
				totalOriginalSize += parseFloat(result.originalSize ?? '0');
				totalWebPSize += parseFloat(result.webpSize ?? '0');

				console.log(`✅ Optimized: ${path.relative(PUBLIC_DIR, result.path)}`);
				console.log(
					`   Original: ${result.originalSize} KB → WebP: ${result.webpSize} KB (${result.savings} savings)`
				);

				if (result.variants && result.variants.length > 0) {
					console.log(`   Generated ${result.variants.length} responsive variant(s):`);
					result.variants.forEach((v) => {
						console.log(`     - ${v.width}w: ${v.size} KB`);
					});
				}
			} else if (result.error) {
				errorCount++;
				console.error(`❌ Error: ${path.relative(PUBLIC_DIR, result.path)}`);
				console.error(`   ${result.error}`);
			}
		}
	}

	// Summary
	console.log(`\n${'='.repeat(60)}`);
	console.log('📊 Optimization Summary\n');
	console.log(`Total images processed: ${imageFiles.length}`);
	console.log(`✅ Optimized: ${optimizedCount}`);
	console.log(`⏭️  Skipped: ${skippedCount}`);
	console.log(`❌ Errors: ${errorCount}`);

	if (!options.dryRun && optimizedCount > 0) {
		const totalSavings = totalOriginalSize - totalWebPSize;
		const savingsPercent = ((totalSavings / totalOriginalSize) * 100).toFixed(1);

		console.log(`\n💾 Total size reduction:`);
		console.log(`   Original: ${formatBytes(totalOriginalSize)}`);
		console.log(`   WebP: ${formatBytes(totalWebPSize)}`);
		console.log(`   Savings: ${formatBytes(totalSavings)} (${savingsPercent}%)`);
	}

	console.log('='.repeat(60));

	if (options.dryRun) {
		console.log('\n🧪 This was a dry run. No files were modified.');
		console.log('   Run without --dry-run to perform optimization.');
	}
}

main().catch((err: unknown) => {
	console.error('❌ Fatal error:', err);
	process.exit(1);
});
