// src/slugger.ts
import { Heading } from '../types/common';

/**
 * Helper function to sanitize text into a GitHub-compatible anchor slug.
 * @param text The raw heading text.
 * @returns The sanitized slug string.
 */
function generateSlug(text: string): string {
    let slug = text.toLowerCase();

    // 1. Strip most punctuation, keeping alphanumeric and hyphens/spaces initially.
    slug = slug.replace(/[^a-z0-9\s-]/g, '');

    // 2. Replace spaces with hyphens (standard GitHub behavior).
    slug = slug.replace(/\s+/g, '-');

    // 3. Remove leading/trailing hyphens that might result from stripping punctuation
    slug = slug.replace(/^-+|-$/g, '');

    return slug;
}

/**
 * Processes all headings to ensure slugs are unique and correctly generated.
 * Handles duplicate slugs by appending -1, -2, etc.
 * @param headings Array of raw heading objects without slugs.
 * @returns An object containing success status and the array with populated slugs.
 */
export function generateSlugs(headings: Heading[]): { success: boolean; finalHeadings: Heading[] } {
    const slugMap = new Map<string, number>(); // Tracks count for each generated slug
    const finalHeadings: Heading[] = [];

    for (let i = 0; i < headings.length; i++) {
        const heading = headings[i];
        // Generate the base slug
        let baseSlug = generateSlug(heading.text);
        
        // Check for duplicates and adjust if necessary
        if (slugMap.has(baseSlug)) {
            const count = slugMap.get(baseSlug)! + 1;
            let uniqueSlug = `${baseSlug}-${count}`;
            finalHeadings.push({ ...heading, slug: uniqueSlug });
            slugMap.set(uniqueSlug, count); // Record the actual generated slug
        } else {
            // First time seeing this base slug
            finalHeadings.push({ ...heading, slug: baseSlug });
            slugMap.set(baseSlug, 1);
        }
    }

    return { success: true, finalHeadings };
}

/**
 * Wrapper function that handles the full slug generation lifecycle (used by CLI).
 */
export function runSlugGeneration(headings: Heading[]): { success: boolean; finalHeadings: Heading[] } {
    // For simplicity in this initial pass, we assume all slugs can be generated successfully.
    return generateSlugs(headings); 
}