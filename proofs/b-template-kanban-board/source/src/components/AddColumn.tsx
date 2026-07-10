import { useState } from 'react';
import { useBoardStore } from '../store/boardStore.ts';

interface AddColumnProps {
	/** Board that a new column is appended to. */
	boardId: string;
}

/**
 * Trailing "Add column" affordance for the active board. Clicking reveals an inline text
 * form (Enter commits, Escape cancels) that appends a new column to `board.columnOrder` via
 * the store's addColumn. Empty/whitespace names are rejected (submit disabled + trimmed guard).
 */
export function AddColumn({ boardId }: AddColumnProps) {
	const addColumn = useBoardStore((state) => state.addColumn);

	const [adding, setAdding] = useState(false);
	const [draft, setDraft] = useState('');

	function cancel() {
		setAdding(false);
		setDraft('');
	}

	function submit() {
		const name = draft.trim();
		if (!name) return;
		addColumn(boardId, name);
		setDraft('');
		// Keep the form open so several columns can be added in a row.
	}

	function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
		if (event.key === 'Enter') {
			event.preventDefault();
			submit();
		} else if (event.key === 'Escape') {
			cancel();
		}
	}

	if (!adding) {
		return (
			<button type="button" className="add-column-toggle" onClick={() => setAdding(true)}>
				+ Add column
			</button>
		);
	}

	return (
		<div className="add-column-form">
			<input
				className="column-rename-input"
				type="text"
				value={draft}
				autoFocus
				aria-label="New column name"
				placeholder="New column name"
				onChange={(event) => setDraft(event.target.value)}
				onKeyDown={handleKeyDown}
			/>
			<div className="add-column-actions">
				<button
					type="button"
					className="column-btn"
					onClick={submit}
					disabled={!draft.trim()}>
					Add
				</button>
				<button type="button" className="column-btn" onClick={cancel}>
					Done
				</button>
			</div>
		</div>
	);
}
