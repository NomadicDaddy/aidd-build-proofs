import type { BoardState, Card, Column } from '../types/board.ts';

/** Generate a fresh id. Uses the platform UUID generator so ids are string + unique. */
export function createId(): string {
	return crypto.randomUUID();
}

/**
 * Build the default seed board (To Do / Doing / Done) used as the initial state when
 * nothing has been persisted yet. Every call produces fresh ids so seeds never collide.
 */
export function createSeedState(): BoardState {
	const now = new Date().toISOString();

	const boardId = createId();
	const todoId = createId();
	const doingId = createId();
	const doneId = createId();

	const welcomeCardId = createId();
	const dragCardId = createId();

	const cards: Record<string, Card> = {
		[welcomeCardId]: {
			id: welcomeCardId,
			columnId: todoId,
			title: 'Welcome to your board',
			description: 'Create columns and cards to organize your work.',
			labels: [],
			createdAt: now,
			updatedAt: now,
		},
		[dragCardId]: {
			id: dragCardId,
			columnId: todoId,
			title: 'Drag me between columns',
			labels: [],
			createdAt: now,
			updatedAt: now,
		},
	};

	const columns: Record<string, Column> = {
		[todoId]: {
			id: todoId,
			boardId,
			name: 'To Do',
			cardOrder: [welcomeCardId, dragCardId],
		},
		[doingId]: { id: doingId, boardId, name: 'Doing', cardOrder: [] },
		[doneId]: { id: doneId, boardId, name: 'Done', cardOrder: [] },
	};

	return {
		boards: {
			[boardId]: {
				id: boardId,
				name: 'My Board',
				columnOrder: [todoId, doingId, doneId],
			},
		},
		columns,
		cards,
		boardOrder: [boardId],
		activeBoardId: boardId,
	};
}
