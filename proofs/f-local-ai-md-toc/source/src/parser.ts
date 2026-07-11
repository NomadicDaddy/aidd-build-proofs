// src/parser.ts
import { Heading } from '../types/common';

/**
 * Parses markdown text to extract all headings and their levels.
 * State machine implemented to correctly ignore any lines inside fenced code blocks (```).
 * @param content The full markdown string.
 * @returns An array of parsed Heading objects.
 */
export function parseHeadings(content: string): Heading[] {
    const headings: Heading[] = [];
    let inCodeBlock = false;
    const lines = content.split('\\n');

    // Regex for ATX heading detection at the start of a line: /^#{1,6}\s+(.*)$/
    const headingRegex = /^(#{1,6})\s+(.*?)$/;

    for (let i = 0; i < lines.length; i++) {
        const currentLine = lines[i].trim();

        // State machine: Check for code block transitions
        if (currentLine.startsWith('```')) {
            inCodeBlock = !inCodeBlock;
            continue; // Do not check headings on the fence line itself
        }

        // If we are in a code block, skip parsing this line's structure entirely
        if (inCodeBlock) {
            continue;
        }

        // Check for heading match
        const headingMatch = currentLine.match(headingRegex);
        if (headingMatch) {
            const level = headingMatch[1].length;
            // The captured group 2 contains the text after hashes and spaces
            let text = headingMatch[2].trim();

            // Basic cleanup: strip any remaining markdown characters that might have snuck in
            // This is a simplification, but adequate for initial detection.
            text = text.replace(/\[.*?\]\(.*?\)/g, '').trim(); 

            headings.push({
                level: level,
                text: text,
                slug: '' // Slug determined by slugger module later
            });
        }
    }

    return headings;
}