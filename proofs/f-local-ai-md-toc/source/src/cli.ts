// src/cli.ts
import * as fs from 'fs';
import { Heading } from '../types/common';
import { parseHeadings } from './parser';
import { generateSlugs, runSlugGeneration } from './slugger';
import { renderTOC } from './renderer';

/**
 * Executes the full TOC generation and replacement workflow for a single file.
 * @param filePath The path to the markdown file.
 * @param options CLI execution options (depth, checkMode).
 */
async function processFile(filePath: string, options: { depth?: number; check?: boolean }): Promise<void> {
    console.log(`\n[Processing ${filePath}] Starting analysis...`);

    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found at path: ${filePath}`);
    }

    try {
        const content = fs.readFileSync(filePath, 'utf8');

        // 1. Parse Headings (State machine handles code blocks)
        let headings: Heading[] = parseHeadings(content);
        console.log(`✅ Step 1/4: Parsed ${headings.length} potential headings.`);

        if (headings.length === 0) {
            console.warn(`⚠️ Warning: No ATX headings found in ${filePath}. Skipping TOC generation.`);
            return;
        }

        // 2. Generate Slugs and finalize heading list
        const result = runSlugGeneration(headings); // Using the wrapper function
        if (!result.success) {
             throw new Error("Failed to generate slugs for all headings.");
        }
        headings = result.finalHeadings;
        console.log(`✅ Step 2/4: Generated unique GitHub-style slugs.`);

        // 3. Render TOC
        const tocContent = renderTOC(headings);
        if (!tocContent) {
             throw new Error("Failed to render TOC content.");
        }
        console.log(`✅ Step 3/4: Rendered nested TOC structure.`);

        // 4. Insert/Replace Markers and Write
        await processMarkersAndWrite(filePath, tocContent, options.check);
        console.log(`✨ Successfully processed ${filePath}.`);

    } catch (error) {
        if (error instanceof Error) {
            console.error(`\n❌ Critical Failure processing ${filePath}:`, error.message);
        } else {
            console.error(`\n❌ An unexpected error occurred during processing ${filePath}.`);
        }
        // In a real CLI, we would track per-file success/failure here.
    }
}

/**
 * Determines the TOC insertion location using markers and writes the content.
 * @param filePath The file to modify.
 * @param tocContent The generated markdown content.
 * @param checkMode If true, only validates without writing.
 */
async function processMarkersAndWrite(filePath: string, tocContent: string, checkMode: boolean): Promise<void> {
    console.log("   -> Step 4/4: Searching for TOC markers (<!-- toc --> / <!-- /toc -->)...");

    const content = fs.readFileSync(filePath, 'utf8');
    let startMarkers = [
        '<!-- toc -->'
    ].join('|');
    let endMarker = '<!-- /toc -->';

    // Check if the file contains markers
    const startIndexMatch = content.search(new RegExp(`(${startMarkers})`, 'g'));
    if (startIndexMatch === -1) {
        console.log("   [SUCCESS] No opening TOC markers found.");
        if (!checkMode) {
            // If no markers, prepend a warning/suggestion or simply fail based on spec:
            // Spec says: "If no markers exist, print a clear error and exit non-zero"
            throw new Error("TOC Markers Missing. Please add '<!-- toc -->' and '<!-- /toc -->' to the file.");
        }
    } else {
        const startIndex = content.indexOf('<!-- toc -->');
        const endIndex = content.indexOf('<!-- /toc -->', startIndex);

        if (endIndex === -1) {
            console.warn("   [WARNING] Opening marker found, but closing marker is missing.");
            if (!checkMode) {
                // Action: Append the closing tag and write
                const newContent = content + '\n' + endMarker;
                fs.writeFileSync(filePath, newContent, 'utf8');
                console.log(`   [ACTION] Appended closing marker to ${filePath}.`);
            } else {
                throw new Error("TOC Markers Incomplete. Missing closing marker.");
            }
        } else {
            // Markers found and complete: replace the content between them
            const preContent = content.substring(0, startIndex + '<!-- toc -->'.length);
            const postContent = content.substring(endIndex + '<!-- /toc -->'.length);

            if (checkMode) {
                console.log("   [SUCCESS] TOC markers found and structure is valid for check mode.");
            } else {
                // Write the replacement
                const newContent = `${preContent}${tocContent}${postContent}`;
                fs.writeFileSync(filePath, newContent, 'utf8');
                console.log(`   [ACTION] Successfully updated TOC content in ${filePath}.`);
            }
        }
    }
}

/**
 * CLI entry point simulation. In a real execution environment, this would be the main executable function.
 * @param filePaths Array of markdown files to process.
 * @param options Global command line flags (e.g., --depth).
 */
export async function main(filePaths: string[], options: { depth?: number; check?: boolean }) {
    console.log("=========================================");
    console.log("🚀 md-toc CLI Initialized");
    console.log(`Running mode: ${options.check ? 'CHECK' : 'WRITE'}; Depth limit: ${options.depth || 3}`);
    console.log("=========================================");

    for (const filePath of filePaths) {
        await processFile(filePath, options);
    }
}