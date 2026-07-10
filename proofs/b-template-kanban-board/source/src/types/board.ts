/**
 * Core domain model for the Kanban board.
 *
 * Entities are stored normalized (keyed by id) in the store; ordering is expressed
 * exclusively through the explicit `columnOrder` / `cardOrder` arrays so drag-and-drop
 * is deterministic and never relies on implicit sorting.
 */

/** A named board owning an ordered list of columns. */
export interface Board {
	id: string;
	name: string;
	/** Column ids, in display order — the single source of truth for column ordering. */
	columnOrder: string[];
}

/** A named lane owning an ordered list of cards. */
export interface Column {
	id: string;
	boardId: string;
	name: string;
	/** Card ids, in display order — the single source of truth for card ordering. */
	cardOrder: string[];
}

/** A single task card living within a column. */
export interface Card {
	id: string;
	columnId: string;
	title: string;
	description?: string;
	labels: string[];
	/** ISO-8601 timestamp; string so state serializes cleanly to localStorage. */
	createdAt: string;
	/** ISO-8601 timestamp, bumped on every mutation. */
	updatedAt: string;
}

/**
 * Normalized client state: entities keyed by id plus the ordering arrays that give
 * boards their column order and columns their card order.
 */
export interface BoardState {
	boards: Record<string, Board>;
	columns: Record<string, Column>;
	cards: Record<string, Card>;
	/** Board ids, in display order. */
	boardOrder: string[];
	/** The board currently shown; `null` only when no boards exist. */
	activeBoardId: string | null;
}
