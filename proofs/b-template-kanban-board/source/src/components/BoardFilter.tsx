interface BoardFilterProps {
	/** Current free-text query. */
	query: string;
	onQueryChange: (value: string) => void;
	/** Distinct labels available on the active board, for the label menu. */
	labels: string[];
	/** Currently selected label, or null for "all labels". */
	activeLabel: string | null;
	onLabelChange: (value: string | null) => void;
	/** Whether any filter criterion is active (enables the Clear control). */
	active: boolean;
	onClear: () => void;
}

/**
 * Filter/search toolbar scoped to the active board: a free-text input (matched against card
 * title + description, case-insensitively) and a label menu. Both narrow the visible cards;
 * clearing restores every card. State is owned by App and lives only for the session — it is
 * never persisted, so a reload always starts unfiltered.
 */
export function BoardFilter({
	query,
	onQueryChange,
	labels,
	activeLabel,
	onLabelChange,
	active,
	onClear,
}: BoardFilterProps) {
	return (
		<div className="board-filter">
			<input
				className="board-filter-input"
				type="search"
				value={query}
				placeholder="Search cards…"
				aria-label="Search cards"
				onChange={(event) => onQueryChange(event.target.value)}
			/>
			<label className="board-filter-label">
				<span className="visually-hidden">Filter by label</span>
				<select
					className="board-filter-select"
					value={activeLabel ?? ''}
					aria-label="Filter by label"
					disabled={labels.length === 0}
					onChange={(event) => onLabelChange(event.target.value || null)}>
					<option value="">All labels</option>
					{labels.map((label) => (
						<option key={label} value={label}>
							{label}
						</option>
					))}
				</select>
			</label>
			<button
				type="button"
				className="board-filter-btn"
				onClick={onClear}
				disabled={!active}
				aria-label="Clear filters">
				Clear
			</button>
		</div>
	);
}
