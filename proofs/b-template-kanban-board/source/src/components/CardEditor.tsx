import { useEffect, useRef, useState } from 'react';

/** The values captured by the editor and handed back on save. */
export interface CardEditorValues {
	title: string;
	description?: string;
	labels: string[];
}

interface CardEditorProps {
	/** Heading shown at the top of the dialog (e.g. "Add card" / "Edit card"). */
	heading: string;
	/** Label for the primary submit button (e.g. "Add card" / "Save"). */
	submitLabel: string;
	/** Pre-fill values — omitted/empty for a fresh card, populated when editing. */
	initialTitle?: string;
	initialDescription?: string;
	initialLabels?: string[];
	/** Commit handler; only invoked with a non-empty, trimmed title. */
	onSubmit: (values: CardEditorValues) => void;
	/** Close/cancel handler; discards any unsaved edits. */
	onClose: () => void;
}

/**
 * Accessible modal form for creating or editing a card. It owns the full editing surface —
 * title (required), description, and add/remove labels — with cancel/save actions.
 *
 * Focus management: the title field is focused on open, focus is trapped within the dialog
 * while it is open, and the element that was focused before opening is restored on close.
 * Escape, the Cancel button, and a backdrop click all cancel (discarding edits); Save commits
 * a trimmed title (empty titles are rejected, so Save stays disabled) plus the description and
 * labels via the caller's onSubmit.
 */
export function CardEditor({
	heading,
	submitLabel,
	initialTitle = '',
	initialDescription = '',
	initialLabels = [],
	onSubmit,
	onClose,
}: CardEditorProps) {
	const [title, setTitle] = useState(initialTitle);
	const [description, setDescription] = useState(initialDescription);
	const [labels, setLabels] = useState<string[]>(initialLabels);
	const [labelDraft, setLabelDraft] = useState('');

	const dialogRef = useRef<HTMLDivElement>(null);
	const titleRef = useRef<HTMLInputElement>(null);

	// Focus the title on open and restore focus to the opener when the dialog closes.
	useEffect(() => {
		const previouslyFocused = document.activeElement as HTMLElement | null;
		titleRef.current?.focus();
		return () => previouslyFocused?.focus?.();
	}, []);

	function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
		if (event.key === 'Escape') {
			event.preventDefault();
			onClose();
			return;
		}
		if (event.key !== 'Tab') return;

		// Trap focus within the dialog so keyboard users can't tab out to the page behind it.
		const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
			'button:not(:disabled), [href], input, textarea, select, [tabindex]:not([tabindex="-1"])'
		);
		if (!focusable || focusable.length === 0) return;
		const first = focusable[0];
		const last = focusable[focusable.length - 1];
		const active = document.activeElement;
		if (event.shiftKey && active === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && active === last) {
			event.preventDefault();
			first.focus();
		}
	}

	function addLabel() {
		const label = labelDraft.trim();
		// Skip empty and duplicate labels; always clear the draft input.
		if (!label || labels.includes(label)) {
			setLabelDraft('');
			return;
		}
		setLabels([...labels, label]);
		setLabelDraft('');
	}

	function removeLabel(target: string) {
		setLabels(labels.filter((label) => label !== target));
	}

	function handleLabelKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
		if (event.key === 'Enter') {
			event.preventDefault();
			addLabel();
		}
	}

	function save() {
		const nextTitle = title.trim();
		// Title is required — Save is disabled while empty, and this guards the programmatic path.
		if (!nextTitle) return;
		const nextDescription = description.trim();
		onSubmit({
			title: nextTitle,
			description: nextDescription ? nextDescription : undefined,
			labels,
		});
	}

	return (
		<div
			className="card-editor-backdrop"
			role="presentation"
			onMouseDown={(event) => {
				// Only a click that both starts and ends on the backdrop cancels.
				if (event.target === event.currentTarget) onClose();
			}}>
			<div
				className="card-editor"
				ref={dialogRef}
				role="dialog"
				aria-modal="true"
				aria-label={heading}
				onKeyDown={handleKeyDown}>
				<h2 className="card-editor-heading">{heading}</h2>

				<label className="card-editor-field">
					<span className="card-editor-label">Title</span>
					<input
						className="card-input"
						type="text"
						value={title}
						ref={titleRef}
						aria-label="Card title"
						placeholder="Card title"
						onChange={(event) => setTitle(event.target.value)}
					/>
				</label>

				<label className="card-editor-field">
					<span className="card-editor-label">Description</span>
					<textarea
						className="card-textarea"
						value={description}
						aria-label="Card description"
						placeholder="Description (optional)"
						rows={3}
						onChange={(event) => setDescription(event.target.value)}
					/>
				</label>

				<div className="card-editor-field">
					<span className="card-editor-label">Labels</span>
					{labels.length > 0 ? (
						<div className="card-labels">
							{labels.map((label) => (
								<span className="card-label" key={label}>
									{label}
									<button
										type="button"
										className="card-label-remove"
										onClick={() => removeLabel(label)}
										aria-label={`Remove label ${label}`}
										title="Remove label">
										×
									</button>
								</span>
							))}
						</div>
					) : null}
					<div className="card-label-add">
						<input
							className="card-input"
							type="text"
							value={labelDraft}
							aria-label="New label"
							placeholder="Add a label"
							onChange={(event) => setLabelDraft(event.target.value)}
							onKeyDown={handleLabelKeyDown}
						/>
						<button
							type="button"
							className="column-btn"
							onClick={addLabel}
							disabled={!labelDraft.trim()}>
							Add label
						</button>
					</div>
				</div>

				<div className="card-editor-actions">
					<button
						type="button"
						className="column-btn"
						onClick={save}
						disabled={!title.trim()}>
						{submitLabel}
					</button>
					<button type="button" className="column-btn" onClick={onClose}>
						Cancel
					</button>
				</div>
			</div>
		</div>
	);
}
