import { useMemo, useState } from 'react';
import { useBoardStore } from '../store/boardStore.ts';
import { selectBoardList } from '../store/selectors.ts';

type Mode = 'idle' | 'creating' | 'renaming';

/**
 * Board management controls: switch the active board, and create, rename, or
 * delete boards. Create/rename use an inline text form (no window.prompt) so the
 * flow is testable and accessible. Deleting the active board falls back to the
 * first remaining board (handled by the store); the last board can't be deleted,
 * so the app always has a board to show.
 */
export function BoardBar() {
	// Subscribe to the raw slices (stable references between renders) and derive the
	// summary list with useMemo. A selector that builds a fresh array on every call
	// would return a new snapshot each render and trip zustand v5's snapshot cache.
	const boardsById = useBoardStore((state) => state.boards);
	const boardOrder = useBoardStore((state) => state.boardOrder);
	const activeBoardId = useBoardStore((state) => state.activeBoardId);
	const boards = useMemo(
		() => selectBoardList({ boards: boardsById, boardOrder }),
		[boardsById, boardOrder]
	);
	const addBoard = useBoardStore((state) => state.addBoard);
	const updateBoard = useBoardStore((state) => state.updateBoard);
	const removeBoard = useBoardStore((state) => state.removeBoard);
	const setActiveBoard = useBoardStore((state) => state.setActiveBoard);

	const [mode, setMode] = useState<Mode>('idle');
	const [draft, setDraft] = useState('');

	const activeBoard = boards.find((board) => board.id === activeBoardId) ?? null;

	function startCreating() {
		setDraft('');
		setMode('creating');
	}

	function startRenaming() {
		setDraft(activeBoard?.name ?? '');
		setMode('renaming');
	}

	function cancel() {
		setMode('idle');
		setDraft('');
	}

	function submit() {
		const name = draft.trim();
		if (!name) return;
		if (mode === 'creating') {
			const id = addBoard(name);
			setActiveBoard(id);
		} else if (mode === 'renaming' && activeBoard) {
			updateBoard(activeBoard.id, { name });
		}
		cancel();
	}

	function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
		if (event.key === 'Enter') {
			event.preventDefault();
			submit();
		} else if (event.key === 'Escape') {
			cancel();
		}
	}

	function handleDelete() {
		if (!activeBoard) return;
		removeBoard(activeBoard.id);
	}

	if (mode !== 'idle') {
		return (
			<div className="board-bar">
				<input
					className="board-bar-input"
					type="text"
					value={draft}
					autoFocus
					placeholder={mode === 'creating' ? 'New board name' : 'Board name'}
					aria-label={mode === 'creating' ? 'New board name' : 'Board name'}
					onChange={(event) => setDraft(event.target.value)}
					onKeyDown={handleKeyDown}
				/>
				<button
					type="button"
					className="board-bar-btn"
					onClick={submit}
					disabled={!draft.trim()}>
					{mode === 'creating' ? 'Create' : 'Save'}
				</button>
				<button type="button" className="board-bar-btn" onClick={cancel}>
					Cancel
				</button>
			</div>
		);
	}

	return (
		<div className="board-bar">
			<label className="board-bar-switch">
				<span className="visually-hidden">Active board</span>
				<select
					className="board-bar-select"
					value={activeBoardId ?? ''}
					aria-label="Active board"
					disabled={boards.length === 0}
					onChange={(event) => setActiveBoard(event.target.value)}>
					{boards.length === 0 ? (
						<option value="">No boards</option>
					) : (
						boards.map((board) => (
							<option key={board.id} value={board.id}>
								{board.name}
							</option>
						))
					)}
				</select>
			</label>

			<button type="button" className="board-bar-btn" onClick={startCreating}>
				New board
			</button>
			<button
				type="button"
				className="board-bar-btn"
				onClick={startRenaming}
				disabled={!activeBoard}>
				Rename
			</button>
			<button
				type="button"
				className="board-bar-btn board-bar-btn-danger"
				onClick={handleDelete}
				disabled={!activeBoard || boards.length <= 1}
				title={boards.length <= 1 ? "Can't delete the only board" : undefined}>
				Delete
			</button>
		</div>
	);
}
