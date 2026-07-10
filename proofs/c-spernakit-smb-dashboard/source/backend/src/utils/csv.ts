/**
 * Minimal, dependency-free CSV serializer for report/export endpoints.
 *
 * Mirrors the RFC4180 conventions the import parser (assetImportService) reads
 * back: fields containing a comma, double-quote, or line break are wrapped in
 * double quotes and any embedded double-quote is doubled. Rows are joined with
 * CRLF so the output opens cleanly in Excel and other spreadsheet tools.
 */

/** A single report/export column: the row-object key and its header label. */
interface CsvColumn {
	key: string;
	label: string;
}

/**
 * Cells beginning with one of these characters are treated by spreadsheet apps
 * as the start of a formula. Prefixing with a single quote neutralizes the
 * classic CSV-injection vector without changing the visible value.
 */
const FORMULA_TRIGGERS = new Set(['=', '+', '-', '@', '\t', '\r']);

/**
 * Convert an arbitrary cell value to its string form for CSV output.
 * @param value - The cell value to stringify
 * @returns The value's string form ('' for null/undefined, ISO for Date)
 */
function stringifyCell(value: unknown): string {
	if (value === null || value === undefined) return '';
	if (value instanceof Date) return value.toISOString();
	if (typeof value === 'boolean') return value ? 'true' : 'false';
	if (typeof value === 'object') return JSON.stringify(value);
	return String(value);
}

/**
 * Escape a single field, guarding against CSV/formula injection.
 * @param value - The raw cell value to escape
 * @returns The field text, quoted and injection-guarded as needed
 */
function escapeField(value: unknown): string {
	let text = stringifyCell(value);

	// Formula-injection guard: neutralize a leading formula trigger.
	if (text.length > 0 && FORMULA_TRIGGERS.has(text[0]!)) {
		text = `'${text}`;
	}

	if (/[",\r\n]/.test(text)) {
		return `"${text.replace(/"/g, '""')}"`;
	}
	return text;
}

/**
 * Serialize an array of row objects to a CSV document.
 *
 * @param columns - Ordered column definitions (key + header label)
 * @param rows - Row objects keyed by the column keys
 * @returns A CRLF-delimited CSV string with a header row
 */
function toCsv(columns: CsvColumn[], rows: Record<string, unknown>[]): string {
	const header = columns.map((c) => escapeField(c.label)).join(',');
	const body = rows.map((row) => columns.map((c) => escapeField(row[c.key])).join(','));
	return [header, ...body].join('\r\n');
}

export { toCsv };
export type { CsvColumn };
