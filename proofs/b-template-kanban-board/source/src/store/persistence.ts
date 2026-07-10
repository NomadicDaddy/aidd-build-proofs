import type { Board, BoardState, Card, Column } from '../types/board.ts';

/**
 * localStorage persistence for the board store.
 *
 * State is written under a single namespaced, versioned key so a reload restores the
 * board exactly. Every read validates the parsed shape against the domain model before
 * adopting it; anything missing or corrupt falls back to a clean seed board without
 * crashing. The version field lets future schema changes migrate rather than discard.
 */

/** Namespaced storage key. Bump the version suffix only alongside a migration. */
export const STORAGE_KEY = 'kanban-board:v1';

/** Envelope schema version, persisted alongside the state for future migrations. */
export const STORAGE_VERSION = 1;

/** The persisted, serializable slice of the store — data fields only, no actions. */
export type PersistableState = Pick<
	BoardState,
	'boards' | 'columns' | 'cards' | 'boardOrder' | 'activeBoardId'
>;

/** On-disk shape: a version tag wrapping the board state. */
interface PersistedEnvelope {
	version: number;
	state: PersistableState;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isBoard(value: unknown): value is Board {
	if (!isRecord(value)) return false;
	return (
		typeof value.id === 'string' &&
		typeof value.name === 'string' &&
		isStringArray(value.columnOrder)
	);
}

function isColumn(value: unknown): value is Column {
	if (!isRecord(value)) return false;
	return (
		typeof value.id === 'string' &&
		typeof value.boardId === 'string' &&
		typeof value.name === 'string' &&
		isStringArray(value.cardOrder)
	);
}

function isCard(value: unknown): value is Card {
	if (!isRecord(value)) return false;
	return (
		typeof value.id === 'string' &&
		typeof value.columnId === 'string' &&
		typeof value.title === 'string' &&
		(value.description === undefined || typeof value.description === 'string') &&
		isStringArray(value.labels) &&
		typeof value.createdAt === 'string' &&
		typeof value.updatedAt === 'string'
	);
}

/** True when every value in `record` satisfies `guard`. */
function isRecordOf<T>(value: unknown, guard: (v: unknown) => v is T): value is Record<string, T> {
	if (!isRecord(value)) return false;
	return Object.values(value).every(guard);
}

function isPersistableState(value: unknown): value is PersistableState {
	if (!isRecord(value)) return false;
	return (
		isRecordOf(value.boards, isBoard) &&
		isRecordOf(value.columns, isColumn) &&
		isRecordOf(value.cards, isCard) &&
		isStringArray(value.boardOrder) &&
		(value.activeBoardId === null || typeof value.activeBoardId === 'string')
	);
}

function isEnvelope(value: unknown): value is PersistedEnvelope {
	if (!isRecord(value)) return false;
	return typeof value.version === 'number' && isPersistableState(value.state);
}

/** Narrow the full store to just the serializable state fields. */
export function toPersistable(state: PersistableState): PersistableState {
	return {
		boards: state.boards,
		columns: state.columns,
		cards: state.cards,
		boardOrder: state.boardOrder,
		activeBoardId: state.activeBoardId,
	};
}

/**
 * Read and validate persisted state. Returns `null` when nothing is stored, the value
 * is unparseable, or its shape does not match the domain model — the caller then seeds a
 * clean board. Never throws.
 */
export function loadState(): PersistableState | null {
	if (typeof localStorage === 'undefined') return null;

	let raw: string | null;
	try {
		raw = localStorage.getItem(STORAGE_KEY);
	} catch {
		return null;
	}
	if (raw === null) return null;

	try {
		const parsed: unknown = JSON.parse(raw);
		if (!isEnvelope(parsed)) return null;
		// A future/unknown schema version cannot be trusted to match the current shape, so
		// discard it and let the caller seed a clean default board rather than adopting
		// foreign data. Bumping STORAGE_VERSION alongside a migration is what re-admits it.
		if (parsed.version !== STORAGE_VERSION) return null;
		return parsed.state;
	} catch {
		return null;
	}
}

/**
 * Persist state under the versioned key. Serialization/quota errors are swallowed so a
 * failed write can never crash the app. Writing to a single key means each save overwrites
 * the previous one — no unbounded growth on rapid edits.
 */
export function saveState(state: PersistableState): void {
	if (typeof localStorage === 'undefined') return;

	try {
		const envelope: PersistedEnvelope = {
			version: STORAGE_VERSION,
			state: toPersistable(state),
		};
		localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
	} catch {
		// Ignore quota / serialization failures — persistence is best-effort.
	}
}
