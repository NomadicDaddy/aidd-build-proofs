// src/renderer.ts
import { Heading } from '../types/common';

/**
 * Generates the Markdown string for a TOC from an array of headings.
 * Uses indentation to represent heading depth structure.
 * @param headings The parsed and slugged heading data.
 * @returns The rendered markdown list, or an empty string if no headings are provided.
 */
export function renderTOC(headings: Heading[]): string {
    if (headings.length === 0) {
        return '';
    }

    let markdown = [];
    for (const h of headings) {
        // Calculate indentation based on level difference from the top-level heading (Level 1).
        // Level 1 -> 0 spaces
        // Level 2 -> 2 spaces
        // Level N -> 2 * (N - 1) spaces
        const indent = '  '.repeat(Math.max(0, h.level - 1));
        
        // Format: Indent* [Text](#slug)\n
        markdown.push(`${indent}* [${h.text}](#${h.slug})`);
    }

    return '\n' + markdown.join('\n') + '\n';
}