interface ParsedCsv {
	headers: string[];
	rows: string[][];
}

/**
 * Parse CSV text into a header row and data rows. Handles quoted fields,
 * embedded commas/newlines, and doubled-quote escaping ("" -> "). Tolerates
 * both LF and CRLF line endings. A trailing empty line is ignored.
 *
 * @param text - Raw CSV document
 * @returns The header cells and the data-row cell matrix
 */
function parseCsv(text: string): ParsedCsv {
	const rows: string[][] = [];
	let field = '';
	let row: string[] = [];
	let inQuotes = false;

	const pushField = (): void => {
		row.push(field);
		field = '';
	};
	const pushRow = (): void => {
		pushField();
		rows.push(row);
		row = [];
	};

	for (let i = 0; i < text.length; i += 1) {
		const char = text[i];
		if (inQuotes) {
			if (char === '"') {
				if (text[i + 1] === '"') {
					field += '"';
					i += 1;
				} else {
					inQuotes = false;
				}
			} else {
				field += char;
			}
			continue;
		}
		if (char === '"') {
			inQuotes = true;
		} else if (char === ',') {
			pushField();
		} else if (char === '\r') {
			// Swallow; the following \n (or end) terminates the row.
		} else if (char === '\n') {
			pushRow();
		} else {
			field += char;
		}
	}
	// Flush a final field/row that was not terminated by a trailing newline.
	if (field.length > 0 || row.length > 0) {
		pushRow();
	}

	// Drop fully-empty rows (e.g., a blank trailing line).
	const nonEmpty = rows.filter((cells) => cells.some((cell) => cell.trim().length > 0));
	if (nonEmpty.length === 0) {
		return { headers: [], rows: [] };
	}
	const [headers, ...dataRows] = nonEmpty;
	return { headers: headers ?? [], rows: dataRows };
}

export type { ParsedCsv };
export { parseCsv };
