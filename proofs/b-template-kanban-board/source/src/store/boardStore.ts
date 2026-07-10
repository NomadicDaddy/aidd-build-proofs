import { create } from 'zustand';
import type { Board, BoardState, Card, Column } from '../types/board.ts';
import { loadState, saveState, toPersistable } from './persistence.ts';
import { createId, createSeedState } from './seed.ts';

/** Fields accepted when creating a card. */
export interface CardInput {
	title: string;
	description?: string;
	labels?: string[];
}

/** Mutable fields on an existing card. */
export type CardPatch = Partial<Pick<Card, 'title' | 'description' | 'labels' | 'columnId'>>;

/** Actions exposed by the store. All produce new state — no in-place mutation. */
export interface BoardActions {
	/** Create a board (with no columns) and return its id. */
	addBoard: (name: string) => string;
	updateBoard: (id: string, patch: Partial<Pick<Board, 'name'>>) => void;
	/** Remove a board and every column/card it owns. */
	removeBoard: (id: string) => void;
	setActiveBoard: (id: string) => void;

	/** Create a column at the end of a board's column order and return its id. */
	addColumn: (boardId: string, name: string) => string;
	updateColumn: (id: string, patch: Partial<Pick<Column, 'name'>>) => void;
	/**
	 * Remove a column and drop it from its board's columnOrder. A non-empty column is NOT
	 * deleted — the rule is to block deletion while cards remain (see column-delete-nonempty-rule),
	 * so no card is ever orphaned. Returns true when the column was removed, false when the
	 * delete was blocked because the column still held cards.
	 */
	removeColumn: (id: string) => boolean;
	/** Move a column one slot left or right within its board's columnOrder (no-op at the ends). */
	moveColumn: (id: string, direction: 'left' | 'right') => void;

	/** Create a card, appending its id to the target column's cardOrder, and return its id. */
	addCard: (columnId: string, input: CardInput) => string;
	updateCard: (id: string, patch: CardPatch) => void;
	/** Remove a card and drop its id from the owning column's cardOrder. */
	removeCard: (id: string) => void;

	/**
	 * Move a card within or across columns. It is dropped immediately before `beforeCardId`
	 * in the target column, or appended when `beforeCardId` is null. Crossing columns also
	 * updates the card's `columnId`. The card id is removed before it is re-inserted, so no
	 * order array can ever contain a duplicate id.
	 */
	moveCard: (cardId: string, toColumnId: string, beforeCardId: string | null) => void;
	/**
	 * Move a card to the column immediately left or right of its current one, appended to the
	 * end of that column. This is the keyboard-accessible alternative to drag-and-drop (drag is
	 * not operable by keyboard alone). A no-op when there is no neighbouring column in that
	 * direction. Returns true when the card actually moved.
	 */
	moveCardToAdjacentColumn: (cardId: string, direction: 'left' | 'right') => boolean;
	/**
	 * Reorder a column within its board's columnOrder: place it immediately before
	 * `beforeColumnId`, or at the end when `beforeColumnId` is null.
	 */
	moveColumnTo: (columnId: string, beforeColumnId: string | null) => void;
}

export type BoardStore = BoardState & BoardActions;

/** Shallow-clone a record with one key removed, without mutating the original. */
function omitKey<T>(record: Record<string, T>, key: string): Record<string, T> {
	const next: Record<string, T> = {};
	for (const [k, v] of Object.entries(record)) {
		if (k !== key) next[k] = v;
	}
	return next;
}

/** Structural equality for two id arrays — used to skip no-op reorders. */
function sameOrder(a: string[], b: string[]): boolean {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) return false;
	}
	return true;
}

/**
 * Insert `id` into a copy of `order` immediately before `beforeId` (or at the end when
 * `beforeId` is null or not found). `id` is filtered out first, so the result never
 * contains a duplicate even if `id` was already present.
 */
function insertBefore(order: string[], id: string, beforeId: string | null): string[] {
	const without = order.filter((existing) => existing !== id);
	const index = beforeId === null ? -1 : without.indexOf(beforeId);
	if (index === -1) {
		without.push(id);
	} else {
		without.splice(index, 0, id);
	}
	return without;
}

export const useBoardStore = create<BoardStore>((set) => ({
	// Hydrate from localStorage; fall back to a fresh seed board when nothing valid is stored.
	...(loadState() ?? createSeedState()),

	addBoard: (name) => {
		const id = createId();
		set((state) => ({
			boards: { ...state.boards, [id]: { id, name, columnOrder: [] } },
			boardOrder: [...state.boardOrder, id],
			activeBoardId: state.activeBoardId ?? id,
		}));
		return id;
	},

	updateBoard: (id, patch) => {
		set((state) => {
			const board = state.boards[id];
			if (!board) return {};
			return { boards: { ...state.boards, [id]: { ...board, ...patch } } };
		});
	},

	removeBoard: (id) => {
		set((state) => {
			const board = state.boards[id];
			if (!board) return {};

			const columns = { ...state.columns };
			const cards = { ...state.cards };
			for (const columnId of board.columnOrder) {
				const column = columns[columnId];
				if (column) {
					for (const cardId of column.cardOrder) delete cards[cardId];
				}
				delete columns[columnId];
			}

			const boardOrder = state.boardOrder.filter((boardId) => boardId !== id);
			const activeBoardId =
				state.activeBoardId === id ? (boardOrder[0] ?? null) : state.activeBoardId;

			return { boards: omitKey(state.boards, id), columns, cards, boardOrder, activeBoardId };
		});
	},

	setActiveBoard: (id) => {
		set((state) => (state.boards[id] ? { activeBoardId: id } : {}));
	},

	addColumn: (boardId, name) => {
		const id = createId();
		set((state) => {
			const board = state.boards[boardId];
			if (!board) return {};
			return {
				columns: { ...state.columns, [id]: { id, boardId, name, cardOrder: [] } },
				boards: {
					...state.boards,
					[boardId]: { ...board, columnOrder: [...board.columnOrder, id] },
				},
			};
		});
		return id;
	},

	updateColumn: (id, patch) => {
		set((state) => {
			const column = state.columns[id];
			if (!column) return {};
			return { columns: { ...state.columns, [id]: { ...column, ...patch } } };
		});
	},

	removeColumn: (id) => {
		let removed = false;
		set((state) => {
			const column = state.columns[id];
			if (!column) return {};
			// Non-empty-column delete rule: block the delete while any card remains so cards are
			// never silently destroyed or orphaned. The caller must clear the column first.
			if (column.cardOrder.length > 0) return {};

			const board = state.boards[column.boardId];
			const boards = board
				? {
						...state.boards,
						[board.id]: {
							...board,
							columnOrder: board.columnOrder.filter((columnId) => columnId !== id),
						},
					}
				: state.boards;

			removed = true;
			return { boards, columns: omitKey(state.columns, id) };
		});
		return removed;
	},

	moveColumn: (id, direction) => {
		set((state) => {
			const column = state.columns[id];
			if (!column) return {};
			const board = state.boards[column.boardId];
			if (!board) return {};

			const index = board.columnOrder.indexOf(id);
			if (index === -1) return {};
			const target = direction === 'left' ? index - 1 : index + 1;
			if (target < 0 || target >= board.columnOrder.length) return {};

			const columnOrder = [...board.columnOrder];
			[columnOrder[index], columnOrder[target]] = [columnOrder[target], columnOrder[index]];

			return { boards: { ...state.boards, [board.id]: { ...board, columnOrder } } };
		});
	},

	addCard: (columnId, input) => {
		const id = createId();
		set((state) => {
			const column = state.columns[columnId];
			if (!column) return {};

			const now = new Date().toISOString();
			const card: Card = {
				id,
				columnId,
				title: input.title,
				description: input.description,
				labels: input.labels ?? [],
				createdAt: now,
				updatedAt: now,
			};

			return {
				cards: { ...state.cards, [id]: card },
				columns: {
					...state.columns,
					[columnId]: { ...column, cardOrder: [...column.cardOrder, id] },
				},
			};
		});
		return id;
	},

	updateCard: (id, patch) => {
		set((state) => {
			const card = state.cards[id];
			if (!card) return {};
			const updated: Card = { ...card, ...patch, updatedAt: new Date().toISOString() };
			return { cards: { ...state.cards, [id]: updated } };
		});
	},

	removeCard: (id) => {
		set((state) => {
			const card = state.cards[id];
			if (!card) return {};

			const column = state.columns[card.columnId];
			const columns = column
				? {
						...state.columns,
						[column.id]: {
							...column,
							cardOrder: column.cardOrder.filter((cardId) => cardId !== id),
						},
					}
				: state.columns;

			return { cards: omitKey(state.cards, id), columns };
		});
	},

	moveCard: (cardId, toColumnId, beforeCardId) => {
		set((state) => {
			const card = state.cards[cardId];
			if (!card) return {};
			const fromColumn = state.columns[card.columnId];
			const toColumn = state.columns[toColumnId];
			if (!fromColumn || !toColumn) return {};
			// Dropping a card onto itself changes nothing.
			if (beforeCardId === cardId) return {};

			if (fromColumn.id === toColumn.id) {
				const cardOrder = insertBefore(fromColumn.cardOrder, cardId, beforeCardId);
				if (sameOrder(cardOrder, fromColumn.cardOrder)) return {};
				return {
					columns: { ...state.columns, [fromColumn.id]: { ...fromColumn, cardOrder } },
				};
			}

			// Cross-column: drop from the source, insert into the target, and restamp the card
			// with its new columnId so status follows the move.
			const fromOrder = fromColumn.cardOrder.filter((id) => id !== cardId);
			const toOrder = insertBefore(toColumn.cardOrder, cardId, beforeCardId);
			return {
				cards: {
					...state.cards,
					[cardId]: {
						...card,
						columnId: toColumnId,
						updatedAt: new Date().toISOString(),
					},
				},
				columns: {
					...state.columns,
					[fromColumn.id]: { ...fromColumn, cardOrder: fromOrder },
					[toColumn.id]: { ...toColumn, cardOrder: toOrder },
				},
			};
		});
	},

	moveCardToAdjacentColumn: (cardId, direction) => {
		let moved = false;
		set((state) => {
			const card = state.cards[cardId];
			if (!card) return {};
			const fromColumn = state.columns[card.columnId];
			if (!fromColumn) return {};
			const board = state.boards[fromColumn.boardId];
			if (!board) return {};

			const index = board.columnOrder.indexOf(fromColumn.id);
			if (index === -1) return {};
			const target = direction === 'left' ? index - 1 : index + 1;
			if (target < 0 || target >= board.columnOrder.length) return {};
			const toColumn = state.columns[board.columnOrder[target]];
			if (!toColumn) return {};

			// Drop from the source and append to the neighbour, restamping columnId so status follows.
			const fromOrder = fromColumn.cardOrder.filter((id) => id !== cardId);
			const toOrder = [...toColumn.cardOrder, cardId];
			moved = true;
			return {
				cards: {
					...state.cards,
					[cardId]: {
						...card,
						columnId: toColumn.id,
						updatedAt: new Date().toISOString(),
					},
				},
				columns: {
					...state.columns,
					[fromColumn.id]: { ...fromColumn, cardOrder: fromOrder },
					[toColumn.id]: { ...toColumn, cardOrder: toOrder },
				},
			};
		});
		return moved;
	},

	moveColumnTo: (columnId, beforeColumnId) => {
		set((state) => {
			const column = state.columns[columnId];
			if (!column) return {};
			const board = state.boards[column.boardId];
			if (!board) return {};
			if (beforeColumnId === columnId) return {};

			const columnOrder = insertBefore(board.columnOrder, columnId, beforeColumnId);
			if (sameOrder(columnOrder, board.columnOrder)) return {};
			return { boards: { ...state.boards, [board.id]: { ...board, columnOrder } } };
		});
	},
}));

// Persist the serializable slice on every change. Skipping writes whose serialized payload
// is unchanged dedups rapid identical edits, and writing to a single key means each save
// overwrites the previous — no unbounded localStorage growth.
let lastSerialized: string | null = null;
useBoardStore.subscribe((state) => {
	const serialized = JSON.stringify(toPersistable(state));
	if (serialized === lastSerialized) return;
	lastSerialized = serialized;
	saveState(state);
});
