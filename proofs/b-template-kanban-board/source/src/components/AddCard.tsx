import { useState } from 'react';
import { useBoardStore } from '../store/boardStore.ts';
import { CardEditor, type CardEditorValues } from './CardEditor.tsx';

interface AddCardProps {
	/** Column that a new card is appended to. */
	columnId: string;
	/** Column name, used to label the affordance for screen readers. */
	columnName: string;
}

/**
 * Trailing "Add card" affordance for a column. Clicking opens the shared CardEditor modal so a
 * new card's title (required), description, and labels can all be set before it is committed.
 * Saving appends the card to the column's `cardOrder` via the store's addCard and closes the
 * editor; Cancel/Escape discards it.
 */
export function AddCard({ columnId, columnName }: AddCardProps) {
	const addCard = useBoardStore((state) => state.addCard);

	const [adding, setAdding] = useState(false);

	function create(values: CardEditorValues) {
		addCard(columnId, {
			title: values.title,
			description: values.description,
			labels: values.labels,
		});
		setAdding(false);
	}

	return (
		<>
			<button
				type="button"
				className="add-card-toggle"
				onClick={() => setAdding(true)}
				aria-label={`Add card to ${columnName}`}>
				+ Add card
			</button>

			{adding ? (
				<CardEditor
					heading={`Add card to ${columnName}`}
					submitLabel="Add card"
					onSubmit={create}
					onClose={() => setAdding(false)}
				/>
			) : null}
		</>
	);
}
