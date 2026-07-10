import { useState, type DragEvent } from 'react';
import { useBoardStore } from '../store/boardStore.ts';
import type { Card } from '../types/board.ts';
import { CardEditor, type CardEditorValues } from './CardEditor.tsx';
import { CARD_MIME, dragHasType } from './dnd.ts';

interface CardItemProps {
	card: Card;
	/** Position of this card's column within the board (for keyboard move-to-neighbour bounds). */
	columnIndex: number;
	/** Total number of columns on the board (to disable move at the ends). */
	columnCount: number;
}

/**
 * A single task card. In view mode it renders the title, optional description, and any labels
 * (all via plain JSX, so React escapes them — no dangerouslySetInnerHTML). "Edit" opens the
 * shared CardEditor modal pre-filled with the card's values; "Delete" removes the card from its
 * column's cardOrder via the store. Saving flows through updateCard, so createdAt is preserved,
 * updatedAt advances, and the change persists through the store's localStorage subscriber.
 *
 * The ◀/▶ buttons move the card to the previous/next column via the keyboard — the accessible
 * alternative to drag-and-drop, which a keyboard alone cannot operate. They are disabled at the
 * board's ends (no neighbour in that direction).
 */
export function CardItem({ card, columnIndex, columnCount }: CardItemProps) {
	const updateCard = useBoardStore((state) => state.updateCard);
	const removeCard = useBoardStore((state) => state.removeCard);
	const moveCard = useBoardStore((state) => state.moveCard);
	const moveCardToAdjacentColumn = useBoardStore((state) => state.moveCardToAdjacentColumn);

	const [editing, setEditing] = useState(false);
	const [dragging, setDragging] = useState(false);
	const [dropBefore, setDropBefore] = useState(false);

	function save(values: CardEditorValues) {
		updateCard(card.id, {
			title: values.title,
			description: values.description,
			labels: values.labels,
		});
		setEditing(false);
	}

	function handleDragStart(event: DragEvent<HTMLLIElement>) {
		event.dataTransfer.setData(CARD_MIME, card.id);
		event.dataTransfer.effectAllowed = 'move';
		setDragging(true);
	}

	function handleDragOver(event: DragEvent<HTMLLIElement>) {
		if (!dragHasType(event, CARD_MIME)) return;
		// Claim this card as the drop target (insert before it) and stop the column's
		// append-to-end handler from also firing.
		event.preventDefault();
		event.stopPropagation();
		event.dataTransfer.dropEffect = 'move';
		setDropBefore(true);
	}

	function handleDrop(event: DragEvent<HTMLLIElement>) {
		if (!dragHasType(event, CARD_MIME)) return;
		event.preventDefault();
		event.stopPropagation();
		setDropBefore(false);
		const draggedId = event.dataTransfer.getData(CARD_MIME);
		if (draggedId) moveCard(draggedId, card.columnId, card.id);
	}

	const className = [
		'card',
		dragging ? 'card-dragging' : '',
		dropBefore ? 'card-drop-before' : '',
	]
		.filter(Boolean)
		.join(' ');

	return (
		<li
			className={className}
			draggable={!editing}
			onDragStart={handleDragStart}
			onDragEnd={() => setDragging(false)}
			onDragOver={handleDragOver}
			onDragLeave={() => setDropBefore(false)}
			onDrop={handleDrop}>
			<span className="card-title">{card.title}</span>
			{card.description ? <p className="card-description">{card.description}</p> : null}
			{card.labels.length > 0 ? (
				<div className="card-labels">
					{card.labels.map((label) => (
						<span className="card-label" key={label}>
							{label}
						</span>
					))}
				</div>
			) : null}
			<div className="card-actions">
				<button
					type="button"
					className="column-btn"
					onClick={() => moveCardToAdjacentColumn(card.id, 'left')}
					disabled={columnIndex === 0}
					aria-label={`Move card ${card.title} to previous column`}
					title="Move to previous column">
					◀
				</button>
				<button
					type="button"
					className="column-btn"
					onClick={() => moveCardToAdjacentColumn(card.id, 'right')}
					disabled={columnIndex === columnCount - 1}
					aria-label={`Move card ${card.title} to next column`}
					title="Move to next column">
					▶
				</button>
				<button
					type="button"
					className="column-btn"
					onClick={() => setEditing(true)}
					aria-label={`Edit card ${card.title}`}
					title="Edit card">
					Edit
				</button>
				<button
					type="button"
					className="column-btn column-btn-danger"
					onClick={() => removeCard(card.id)}
					aria-label={`Delete card ${card.title}`}
					title="Delete card">
					Delete
				</button>
			</div>

			{editing ? (
				<CardEditor
					heading={`Edit card: ${card.title}`}
					submitLabel="Save"
					initialTitle={card.title}
					initialDescription={card.description ?? ''}
					initialLabels={card.labels}
					onSubmit={save}
					onClose={() => setEditing(false)}
				/>
			) : null}
		</li>
	);
}
