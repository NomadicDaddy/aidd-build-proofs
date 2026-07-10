/**
 * Headless acceptance scenarios for the Kanban board (see .aidd/testing-scenarios.md).
 *
 * This is the "documented crawl step" wired into `bun run smoke:qc`: rather than a UI crawl,
 * it drives the REAL store actions, persistence, and selectors — the same code the browser
 * runs — and asserts each scenario end-to-end, including reload persistence via the actual
 * `loadState()` (exactly what the app calls on hydration). It uses no test framework: a plain
 * assertion runner that exits non-zero on the first failing scenario so the gate fails loudly.
 *
 * Run with: `bun scripts/scenarios.ts`
 */

import assert from 'node:assert/strict';

/**
 * Minimal in-memory localStorage, installed on globalThis BEFORE the store modules are
 * imported so their hydration (and the persist subscription) reads/writes this store. This
 * mirrors the browser Web Storage surface the app relies on.
 */
class MemoryStorage {
	private map = new Map<string, string>();

	get length(): number {
		return this.map.size;
	}

	getItem(key: string): string | null {
		return this.map.has(key) ? (this.map.get(key) as string) : null;
	}

	setItem(key: string, value: string): void {
		this.map.set(key, String(value));
	}

	removeItem(key: string): void {
		this.map.delete(key);
	}

	clear(): void {
		this.map.clear();
	}

	key(index: number): string | null {
		return [...this.map.keys()][index] ?? null;
	}
}

const storage = new MemoryStorage();
(globalThis as { localStorage: Storage }).localStorage = storage as unknown as Storage;

// Import AFTER the storage polyfill is installed — the store hydrates at module load.
const { useBoardStore } = await import('../src/store/boardStore.ts');
const { loadState, STORAGE_KEY, STORAGE_VERSION } = await import('../src/store/persistence.ts');
const { createSeedState } = await import('../src/store/seed.ts');
const {
	selectActiveBoardView,
	selectColumnCards,
	selectBoardList,
	selectBoardLabels,
	cardMatchesFilter,
	isCardFilterActive,
} = await import('../src/store/selectors.ts');

import type { BoardState, Card } from '../src/types/board.ts';
import type { CardFilter } from '../src/store/selectors.ts';

const store = useBoardStore;

/** State as it would be after a page reload: whatever `loadState()` hydrates from storage. */
function reloaded(): BoardState {
	const state = loadState();
	assert(state !== null, 'expected valid persisted state after reload');
	return state as BoardState;
}

/** Reset to a fresh seed board and clear storage so each scenario is isolated. */
function reset(): void {
	storage.clear();
	store.setState(createSeedState());
}

/** Ids of the seed board's To Do / Doing / Done columns on the active board. */
function seedColumnIds(): { boardId: string; todo: string; doing: string; done: string } {
	const s = store.getState();
	const boardId = s.activeBoardId as string;
	const [todo, doing, done] = s.boards[boardId].columnOrder;
	return { boardId, todo, doing, done };
}

const scenarios: Array<{ name: string; run: () => void }> = [
	{
		name: '1. Create board, add To Do/Doing/Done, add cards, drag one to Doing, reload survives',
		run: () => {
			reset();
			const boardId = store.getState().addBoard('Sprint');
			store.getState().setActiveBoard(boardId);
			const todo = store.getState().addColumn(boardId, 'To Do');
			const doing = store.getState().addColumn(boardId, 'Doing');
			const done = store.getState().addColumn(boardId, 'Done');
			const a = store.getState().addCard(todo, { title: 'Card A' });
			store.getState().addCard(todo, { title: 'Card B' });
			store.getState().moveCard(a, doing, null); // drag A across to Doing

			const s = reloaded();
			assert.equal(s.boards[boardId].name, 'Sprint');
			assert.deepEqual(s.boards[boardId].columnOrder, [todo, doing, done]);
			assert.deepEqual(
				s.columns[todo].cardOrder.map((id) => s.cards[id].title),
				['Card B']
			);
			assert.deepEqual(
				s.columns[doing].cardOrder.map((id) => s.cards[id].title),
				['Card A']
			);
			assert.equal(s.cards[a].columnId, doing, 'moved card status follows the column');
		},
	},
	{
		name: '2. Several boards: rename one, switch active, delete one, others untouched',
		run: () => {
			reset();
			const b1 = store.getState().addBoard('Alpha');
			const b2 = store.getState().addBoard('Beta');
			const b3 = store.getState().addBoard('Gamma');
			// Give Beta a column + card to prove it survives deleting a sibling.
			const betaCol = store.getState().addColumn(b2, 'Work');
			const betaCard = store.getState().addCard(betaCol, { title: 'Keep me' });

			store.getState().updateBoard(b1, { name: 'Alpha Renamed' });
			store.getState().setActiveBoard(b2);
			store.getState().setActiveBoard(b1);
			store.getState().removeBoard(b3);

			const s = reloaded();
			const names = selectBoardList(s).map((b) => b.name);
			assert(names.includes('Alpha Renamed'), 'rename persisted');
			assert(names.includes('Beta'), 'untouched board survives');
			assert(!Object.prototype.hasOwnProperty.call(s.boards, b3), 'deleted board is gone');
			assert(!s.boardOrder.includes(b3), 'deleted board dropped from order');
			assert.equal(s.cards[betaCard].title, 'Keep me', 'sibling board card untouched');
			assert.deepEqual(s.columns[betaCol].cardOrder, [betaCard]);
		},
	},
	{
		name: '3. Add column, rename it, reorder it, reload, name + order persisted',
		run: () => {
			reset();
			const { boardId, todo, doing, done } = seedColumnIds();
			const backlog = store.getState().addColumn(boardId, 'Backlog');
			store.getState().updateColumn(backlog, { name: 'Backlog (P2)' });
			// New column is appended last; move it to the front.
			store.getState().moveColumnTo(backlog, todo);

			const s = reloaded();
			assert.equal(s.columns[backlog].name, 'Backlog (P2)', 'rename persisted');
			assert.deepEqual(
				s.boards[boardId].columnOrder,
				[backlog, todo, doing, done],
				'reordered column position persisted'
			);
		},
	},
	{
		name: '4. Deleting a non-empty column is blocked; an empty column deletes',
		run: () => {
			reset();
			const { boardId, todo, doing } = seedColumnIds();
			// To Do holds seed cards -> delete must be blocked, no cards orphaned.
			const blocked = store.getState().removeColumn(todo);
			assert.equal(blocked, false, 'non-empty column delete returns false');
			assert(store.getState().columns[todo] !== undefined, 'blocked column still present');
			assert(
				store.getState().boards[boardId].columnOrder.includes(todo),
				'blocked column stays in order'
			);
			assert(selectColumnCards(store.getState(), todo).length > 0, 'no cards orphaned');

			// Doing is empty in the seed -> delete succeeds.
			const removed = store.getState().removeColumn(doing);
			assert.equal(removed, true, 'empty column delete returns true');

			const s = reloaded();
			assert(s.columns[doing] === undefined, 'empty column removed after reload');
			assert(!s.boards[boardId].columnOrder.includes(doing), 'removed from columnOrder');
			assert(s.columns[todo] !== undefined, 'non-empty column persisted intact');
		},
	},
	{
		name: '5. Add card with title/description/labels, edit each field, reload keeps edits',
		run: () => {
			reset();
			const { todo } = seedColumnIds();
			const id = store.getState().addCard(todo, {
				title: 'Draft',
				description: 'first pass',
				labels: ['bug'],
			});
			const createdAt = store.getState().cards[id].createdAt;

			store.getState().updateCard(id, { title: 'Final title' });
			store.getState().updateCard(id, { description: 'revised description' });
			store.getState().updateCard(id, { labels: ['feature', 'ux'] });

			const s = reloaded();
			const card = s.cards[id];
			assert.equal(card.title, 'Final title');
			assert.equal(card.description, 'revised description');
			assert.deepEqual(card.labels, ['feature', 'ux']);
			assert.equal(card.createdAt, createdAt, 'createdAt preserved across edits');
		},
	},
	{
		name: '6. Reorder two cards within a column, reload keeps within-column order',
		run: () => {
			reset();
			const { doing } = seedColumnIds();
			const first = store.getState().addCard(doing, { title: 'First' });
			const second = store.getState().addCard(doing, { title: 'Second' });
			assert.deepEqual(store.getState().columns[doing].cardOrder, [first, second]);

			// Drag "Second" above "First".
			store.getState().moveCard(second, doing, first);

			const s = reloaded();
			assert.deepEqual(
				s.columns[doing].cardOrder.map((id) => s.cards[id].title),
				['Second', 'First'],
				'within-column reorder persisted'
			);
		},
	},
	{
		name: '7. Move a card across columns: source/target update and survive reload',
		run: () => {
			reset();
			const { todo, done } = seedColumnIds();
			const target = store.getState().addCard(done, { title: 'Anchor' });
			const moved = store.getState().addCard(todo, { title: 'Traveler' });

			// Drop before the existing Done card so drop position is honoured.
			store.getState().moveCard(moved, done, target);

			const s = reloaded();
			assert(!s.columns[todo].cardOrder.includes(moved), 'gone from source column');
			assert.deepEqual(
				s.columns[done].cardOrder.map((id) => s.cards[id].title),
				['Traveler', 'Anchor'],
				'inserted at drop position in target'
			);
			assert.equal(s.cards[moved].columnId, done, 'columnId (status) updated');
		},
	},
	{
		name: '8. Delete a card: removed from cardOrder and absent after reload',
		run: () => {
			reset();
			const { todo } = seedColumnIds();
			const keep = store.getState().addCard(todo, { title: 'Keeper' });
			const drop = store.getState().addCard(todo, { title: 'Doomed' });
			assert(store.getState().columns[todo].cardOrder.includes(drop));

			store.getState().removeCard(drop);
			assert(store.getState().cards[drop] === undefined, 'card removed from cards map');
			assert(
				!store.getState().columns[todo].cardOrder.includes(drop),
				'card id dropped from cardOrder'
			);

			const s = reloaded();
			assert(s.cards[drop] === undefined, 'deleted card absent after reload');
			assert(!s.columns[todo].cardOrder.includes(drop), 'cardOrder clean after reload');
			assert(s.cards[keep] !== undefined, 'sibling card untouched');
		},
	},
	{
		name: '9. Filter/search by text and label shows only matches until cleared',
		run: () => {
			reset();
			const { boardId, todo } = seedColumnIds();
			store.getState().setActiveBoard(boardId);
			store.getState().addCard(todo, { title: 'Fix login bug', labels: ['bug'] });
			store.getState().addCard(todo, { title: 'Write docs', labels: ['docs'] });
			store.getState().addCard(todo, { title: 'Login redesign', labels: ['ux', 'bug'] });

			const view = selectActiveBoardView(store.getState());
			assert(view !== null, 'active board view resolves');
			const allCards: Card[] = view.columns.flatMap((c) => c.cards);

			// Text filter (case-insensitive across title + description).
			const textFilter: CardFilter = { query: 'login', label: null };
			assert.equal(isCardFilterActive(textFilter), true);
			const textMatches = allCards
				.filter((c) => cardMatchesFilter(c, textFilter))
				.map((c) => c.title)
				.sort();
			assert.deepEqual(textMatches, ['Fix login bug', 'Login redesign']);

			// Label filter.
			const labelFilter: CardFilter = { query: '', label: 'bug' };
			assert.equal(isCardFilterActive(labelFilter), true);
			const labelMatches = allCards
				.filter((c) => cardMatchesFilter(c, labelFilter))
				.map((c) => c.title)
				.sort();
			assert.deepEqual(labelMatches, ['Fix login bug', 'Login redesign']);

			// Combined text + label narrows further.
			const combined: CardFilter = { query: 'redesign', label: 'bug' };
			const combinedMatches = allCards.filter((c) => cardMatchesFilter(c, combined));
			assert.deepEqual(
				combinedMatches.map((c) => c.title),
				['Login redesign']
			);

			// Cleared filter shows everything again and is inactive.
			const cleared: CardFilter = { query: '', label: null };
			assert.equal(isCardFilterActive(cleared), false, 'cleared filter is inactive');
			assert.equal(
				allCards.filter((c) => cardMatchesFilter(c, cleared)).length,
				allCards.length,
				'clearing restores every card'
			);

			// Label menu offers the distinct labels in use.
			assert.deepEqual(selectBoardLabels(view), ['bug', 'docs', 'ux']);

			// Filtering is ephemeral — it never touches persistence.
			const s = reloaded();
			assert.equal(
				selectColumnCards(s, todo).length,
				selectColumnCards(store.getState(), todo).length,
				'filter never changes the persisted card count'
			);
		},
	},
	{
		name: '10. Corrupt/clear/version-mismatched storage falls back to a clean default board',
		run: () => {
			// Unparseable JSON -> clean seed, no throw.
			storage.setItem(STORAGE_KEY, '{not valid json at all]');
			assert.equal(loadState(), null, 'corrupt JSON rejected');

			// Structurally wrong shape -> clean seed.
			storage.setItem(
				STORAGE_KEY,
				JSON.stringify({ version: STORAGE_VERSION, state: { boards: 'nope' } })
			);
			assert.equal(loadState(), null, 'wrong-shape envelope rejected');

			// Future/unknown version -> discard foreign data.
			storage.setItem(
				STORAGE_KEY,
				JSON.stringify({
					version: STORAGE_VERSION + 998,
					state: createSeedState(),
				})
			);
			assert.equal(loadState(), null, 'version-mismatched state rejected');

			// Nothing stored -> clean seed.
			storage.clear();
			assert.equal(loadState(), null, 'empty storage yields null');

			// The hydration expression the store actually uses must still yield a usable board.
			const hydrated = loadState() ?? createSeedState();
			const view = selectActiveBoardView(hydrated);
			assert(view !== null, 'fallback seed produces an active board (no crash)');
			assert(view.columns.length > 0, 'fallback board has its default columns');
		},
	},
];

let failures = 0;
for (const scenario of scenarios) {
	try {
		scenario.run();
		console.log(`PASS  ${scenario.name}`);
	} catch (error) {
		failures += 1;
		const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
		console.error(`FAIL  ${scenario.name}\n      ${message}`);
	}
}

console.log(`\n${scenarios.length - failures}/${scenarios.length} scenarios passed.`);
if (failures > 0) {
	process.exit(1);
}
