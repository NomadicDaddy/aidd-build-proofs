import { useEffect, useMemo, useState, type DragEvent } from 'react';
import { AddColumn } from './components/AddColumn.tsx';
import { BoardBar } from './components/BoardBar.tsx';
import { BoardFilter } from './components/BoardFilter.tsx';
import { ColumnLane } from './components/ColumnLane.tsx';
import { COLUMN_MIME, dragHasType } from './components/dnd.ts';
import { useBoardStore } from './store/boardStore.ts';
import {
	cardMatchesFilter,
	isCardFilterActive,
	selectActiveBoardView,
	selectBoardLabels,
	type CardFilter,
} from './store/selectors.ts';
import type { Card } from './types/board.ts';
import './App.css';

/** Product name shown in the app header, independent of the active board's name. */
const APP_NAME = 'Kanban Board';

/**
 * Kanban application shell: a header (app name + active board name) above a
 * horizontal, scrollable columns area wired to the domain store. Later features
 * (board-view-render, card-crud, drag-and-drop) add interactivity on top of this
 * same shell and selector.
 */
function App() {
	// Subscribe to the whole store (stable reference between renders) and derive the
	// ordered view with useMemo. Deriving inside the selector would return a fresh
	// object every call and trip React's "getSnapshot should be cached" guard.
	const state = useBoardStore();
	const moveColumnTo = useBoardStore((store) => store.moveColumnTo);
	const board = useMemo(() => selectActiveBoardView(state), [state]);

	// Filter/search state is view-only and never persisted: a reload always starts unfiltered.
	// It is scoped to the active board, so switching boards clears it (labels differ per board).
	const [query, setQuery] = useState('');
	const [label, setLabel] = useState<string | null>(null);
	const boardId = board?.id ?? null;
	useEffect(() => {
		setQuery('');
		setLabel(null);
	}, [boardId]);

	const labels = useMemo(() => selectBoardLabels(board), [board]);
	const filter: CardFilter = { query, label };
	const filterActive = isCardFilterActive(filter);
	const matchCard = filterActive ? (card: Card) => cardMatchesFilter(card, filter) : undefined;

	function clearFilter() {
		setQuery('');
		setLabel(null);
	}

	// End-of-strip drop zone for column reordering: a column dropped on the empty area past
	// the last lane (a drop that did not land on a specific column, which stops propagation)
	// is appended to the end of columnOrder.
	function handleStripDragOver(event: DragEvent<HTMLDivElement>) {
		if (!dragHasType(event, COLUMN_MIME)) return;
		event.preventDefault();
		event.dataTransfer.dropEffect = 'move';
	}

	function handleStripDrop(event: DragEvent<HTMLDivElement>) {
		if (!dragHasType(event, COLUMN_MIME)) return;
		event.preventDefault();
		const columnId = event.dataTransfer.getData(COLUMN_MIME);
		if (columnId) moveColumnTo(columnId, null);
	}

	return (
		<div className="app-shell">
			<header className="app-header">
				<div className="app-title">
					<span className="app-name">{APP_NAME}</span>
					<h1 className="board-name">{board ? board.name : 'No board'}</h1>
				</div>
				<BoardBar />
			</header>

			{board ? (
				<div className="board-toolbar">
					<BoardFilter
						query={query}
						onQueryChange={setQuery}
						labels={labels}
						activeLabel={label}
						onLabelChange={setLabel}
						active={filterActive}
						onClear={clearFilter}
					/>
				</div>
			) : null}

			<main className="board-area">
				{board ? (
					<div
						className="board-columns"
						onDragOver={handleStripDragOver}
						onDrop={handleStripDrop}>
						{board.columns.length === 0 ? (
							<p className="board-columns-empty">
								This board has no columns yet. Add a column to get started.
							</p>
						) : (
							board.columns.map((column, index) => (
								<ColumnLane
									key={column.id}
									column={column}
									index={index}
									count={board.columns.length}
									matchCard={matchCard}
								/>
							))
						)}
						<AddColumn boardId={board.id} />
					</div>
				) : (
					<p className="board-empty">No board yet.</p>
				)}
			</main>
		</div>
	);
}

export default App;
