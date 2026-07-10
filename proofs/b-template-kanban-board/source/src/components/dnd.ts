import type { DragEvent } from 'react';

/**
 * Custom drag MIME types. Cards and columns carry distinct types so a drop target can tell,
 * during `dragover` (when `dataTransfer.getData` is unavailable but `types` is), whether the
 * current drag is something it accepts — a card lane ignores column drags and vice versa.
 */
export const CARD_MIME = 'application/x-kanban-card';
export const COLUMN_MIME = 'application/x-kanban-column';

/** True when the in-flight drag carries the given MIME type. */
export function dragHasType(event: DragEvent, mime: string): boolean {
	return Array.from(event.dataTransfer.types).includes(mime);
}
