import type { Board, BoardState, Card, Column } from '../types/board.ts';

/** A board summary for the switcher: id + name, in `boardOrder`. */
export interface BoardSummary {
	id: string;
	name: string;
}

/** Resolve `boardOrder` into board summaries, skipping any dangling ids. */
export function selectBoardList(state: Pick<BoardState, 'boards' | 'boardOrder'>): BoardSummary[] {
	return state.boardOrder
		.map((boardId) => state.boards[boardId])
		.filter((board): board is Board => board !== undefined)
		.map((board) => ({ id: board.id, name: board.name }));
}

/** A column with its cards resolved and ordered per `cardOrder`. */
export interface ColumnView extends Column {
	cards: Card[];
}

/** A board with its columns resolved and ordered per `columnOrder`, each carrying its cards. */
export interface BoardView {
	id: string;
	name: string;
	columns: ColumnView[];
}

/** Resolve a column's `cardOrder` into concrete Card entities, skipping any dangling ids. */
export function selectColumnCards(state: BoardState, columnId: string): Card[] {
	const column = state.columns[columnId];
	if (!column) return [];
	return column.cardOrder
		.map((cardId) => state.cards[cardId])
		.filter((card): card is Card => card !== undefined);
}

/** A view-only filter over the active board's cards. Ephemeral UI state — never persisted. */
export interface CardFilter {
	/** Free text matched (case-insensitively) against a card's title and description. */
	query: string;
	/** When set, only cards carrying this exact label match. */
	label: string | null;
}

/** True when the filter would hide any cards — i.e. it has a text query or a selected label. */
export function isCardFilterActive(filter: CardFilter): boolean {
	return filter.query.trim().length > 0 || filter.label !== null;
}

/**
 * Predicate for a single card against the filter. Text is matched case-insensitively across
 * title + description; a selected label must be present on the card. Both criteria are ANDed,
 * so an empty query with no label matches every card.
 */
export function cardMatchesFilter(card: Card, filter: CardFilter): boolean {
	const query = filter.query.trim().toLowerCase();
	if (query) {
		const haystack = `${card.title}\n${card.description ?? ''}`.toLowerCase();
		if (!haystack.includes(query)) return false;
	}
	if (filter.label !== null && !card.labels.includes(filter.label)) return false;
	return true;
}

/** Distinct labels used by any card on the board, sorted for a stable filter menu. */
export function selectBoardLabels(board: BoardView | null): string[] {
	if (!board) return [];
	const labels = new Set<string>();
	for (const column of board.columns) {
		for (const card of column.cards) {
			for (const label of card.labels) labels.add(label);
		}
	}
	return [...labels].sort((a, b) => a.localeCompare(b));
}

/**
 * Resolve the active board into an ordered view: board -> columns (in columnOrder) ->
 * each column's cards (in cardOrder). Returns `null` when there is no active board.
 */
export function selectActiveBoardView(state: BoardState): BoardView | null {
	const board = state.activeBoardId ? state.boards[state.activeBoardId] : undefined;
	if (!board) return null;

	const columns: ColumnView[] = board.columnOrder
		.map((columnId) => state.columns[columnId])
		.filter((column): column is Column => column !== undefined)
		.map((column) => ({ ...column, cards: selectColumnCards(state, column.id) }));

	return { id: board.id, name: board.name, columns };
}
