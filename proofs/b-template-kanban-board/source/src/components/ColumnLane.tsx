import { useState, type DragEvent } from 'react';
import { useBoardStore } from '../store/boardStore.ts';
import type { ColumnView } from '../store/selectors.ts';
import type { Card } from '../types/board.ts';
import { AddCard } from './AddCard.tsx';
import { CardItem } from './CardItem.tsx';
import { CARD_MIME, COLUMN_MIME, dragHasType } from './dnd.ts';

interface ColumnLaneProps {
	column: ColumnView;
	/** Position of this column within its board's columnOrder. */
	index: number;
	/** Total number of columns on the board (to disable move at the ends). */
	count: number;
	/**
	 * When a board filter is active, the predicate that decides which cards stay visible.
	 * `undefined` means no filter — every card shows. The column's true card count (for the
	 * header badge and the non-empty-delete rule) always reflects `column.cards`, never the
	 * filtered subset, so filtering never enables deleting a column that still holds cards.
	 */
	matchCard?: (card: Card) => boolean;
}

/**
 * A single board column (lane): its header carries the column-management controls —
 * inline rename, move left/right (reorders `board.columnOrder`), and delete — above the
 * column's card list. Rename uses a real DOM input (Enter commits, Escape cancels) rather
 * than window.prompt so the flow is accessible and testable. Delete follows the non-empty-column
 * rule (column-delete-nonempty-rule): the store's removeColumn blocks deleting a column while it
 * still holds cards, so no card is ever orphaned or silently destroyed. The Delete button is
 * disabled (with an explanatory tooltip) until the column is emptied.
 */
export function ColumnLane({ column, index, count, matchCard }: ColumnLaneProps) {
	const updateColumn = useBoardStore((state) => state.updateColumn);
	const removeColumn = useBoardStore((state) => state.removeColumn);
	const moveColumn = useBoardStore((state) => state.moveColumn);
	const moveCard = useBoardStore((state) => state.moveCard);
	const moveColumnTo = useBoardStore((state) => state.moveColumnTo);

	const [renaming, setRenaming] = useState(false);
	const [draft, setDraft] = useState('');
	const [dragging, setDragging] = useState(false);
	const [columnDropBefore, setColumnDropBefore] = useState(false);
	const [cardDropInside, setCardDropInside] = useState(false);

	function startRenaming() {
		setDraft(column.name);
		setRenaming(true);
	}

	function cancel() {
		setRenaming(false);
		setDraft('');
	}

	function submit() {
		const name = draft.trim();
		if (name) updateColumn(column.id, { name });
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

	function handleColumnDragStart(event: DragEvent<HTMLElement>) {
		event.dataTransfer.setData(COLUMN_MIME, column.id);
		event.dataTransfer.effectAllowed = 'move';
		setDragging(true);
	}

	// The whole column accepts both drags: a card dropped anywhere in the column body that is
	// not caught by a specific card is appended to the end (CardItem stops propagation to claim
	// precise before-card drops); a column dropped here is placed before this column.
	function handleSectionDragOver(event: DragEvent<HTMLElement>) {
		if (dragHasType(event, CARD_MIME)) {
			event.preventDefault();
			event.dataTransfer.dropEffect = 'move';
			setCardDropInside(true);
		} else if (dragHasType(event, COLUMN_MIME)) {
			event.preventDefault();
			event.dataTransfer.dropEffect = 'move';
			setColumnDropBefore(true);
		}
	}

	function handleSectionDragLeave() {
		setCardDropInside(false);
		setColumnDropBefore(false);
	}

	function handleSectionDrop(event: DragEvent<HTMLElement>) {
		if (dragHasType(event, CARD_MIME)) {
			event.preventDefault();
			event.stopPropagation();
			setCardDropInside(false);
			const cardId = event.dataTransfer.getData(CARD_MIME);
			if (cardId) moveCard(cardId, column.id, null);
		} else if (dragHasType(event, COLUMN_MIME)) {
			// Stop the strip's end-drop zone from also firing — this column claims the drop and
			// places the dragged column immediately before itself.
			event.preventDefault();
			event.stopPropagation();
			setColumnDropBefore(false);
			const columnId = event.dataTransfer.getData(COLUMN_MIME);
			if (columnId) moveColumnTo(columnId, column.id);
		}
	}

	// Cards actually shown: the filtered subset when a filter is active, otherwise every card.
	// `column.cards` remains the source of truth for the count badge and delete rule below.
	const visibleCards = matchCard ? column.cards.filter(matchCard) : column.cards;
	const filteredEmpty =
		matchCard !== undefined && column.cards.length > 0 && visibleCards.length === 0;

	const sectionClassName = [
		'column',
		dragging ? 'column-dragging' : '',
		columnDropBefore ? 'column-drop-before' : '',
		cardDropInside ? 'column-card-drop' : '',
	]
		.filter(Boolean)
		.join(' ');

	return (
		<section
			className={sectionClassName}
			onDragOver={handleSectionDragOver}
			onDragLeave={handleSectionDragLeave}
			onDrop={handleSectionDrop}>
			<header
				className="column-header"
				draggable={!renaming}
				onDragStart={handleColumnDragStart}
				onDragEnd={() => setDragging(false)}
				title="Drag to reorder column">
				{renaming ? (
					<div className="column-rename">
						<input
							className="column-rename-input"
							type="text"
							value={draft}
							autoFocus
							aria-label="Column name"
							placeholder="Column name"
							onChange={(event) => setDraft(event.target.value)}
							onKeyDown={handleKeyDown}
						/>
						<button
							type="button"
							className="column-btn"
							onClick={submit}
							disabled={!draft.trim()}>
							Save
						</button>
						<button type="button" className="column-btn" onClick={cancel}>
							Cancel
						</button>
					</div>
				) : (
					<>
						<h2 className="column-name">{column.name}</h2>
						<span className="column-count">{column.cards.length}</span>
						<div className="column-actions">
							<button
								type="button"
								className="column-btn"
								onClick={() => moveColumn(column.id, 'left')}
								disabled={index === 0}
								aria-label={`Move column ${column.name} left`}
								title="Move left">
								◀
							</button>
							<button
								type="button"
								className="column-btn"
								onClick={() => moveColumn(column.id, 'right')}
								disabled={index === count - 1}
								aria-label={`Move column ${column.name} right`}
								title="Move right">
								▶
							</button>
							<button
								type="button"
								className="column-btn"
								onClick={startRenaming}
								aria-label={`Rename column ${column.name}`}
								title="Rename">
								Rename
							</button>
							<button
								type="button"
								className="column-btn column-btn-danger"
								onClick={() => removeColumn(column.id)}
								disabled={column.cards.length > 0}
								aria-label={`Delete column ${column.name}`}
								title={
									column.cards.length > 0
										? 'Move or delete this column’s cards before deleting it'
										: 'Delete column'
								}>
								Delete
							</button>
						</div>
					</>
				)}
			</header>

			{visibleCards.length > 0 ? (
				<ul className="card-list">
					{visibleCards.map((card) => (
						<CardItem
							card={card}
							key={card.id}
							columnIndex={index}
							columnCount={count}
						/>
					))}
				</ul>
			) : (
				<div className="card-list-empty">
					{filteredEmpty
						? 'No cards match the filter'
						: 'No cards yet — add one below or drag a card here.'}
				</div>
			)}

			<AddCard columnId={column.id} columnName={column.name} />
		</section>
	);
}
