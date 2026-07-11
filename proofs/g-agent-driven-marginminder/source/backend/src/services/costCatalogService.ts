import { and, count, desc, eq, like, or, type SQL } from 'drizzle-orm';

import { getDb } from '../db/index.ts';
import { costCatalogItems } from '../db/schema/costCatalogItems.ts';

type CostCatalogCategory = 'fee' | 'labor' | 'material' | 'other' | 'overhead' | 'subcontractor';
type CostCatalogItemRow = typeof costCatalogItems.$inferSelect;

interface CostCatalogInput {
	active?: boolean;
	category: CostCatalogCategory;
	defaultMarkupPercent?: number;
	lastReviewedAt?: Date | null;
	name: string;
	notes?: null | string;
	taxable?: boolean;
	unit: string;
	unitCost?: number;
}

interface CostCatalogUpdateInput {
	active?: boolean;
	category?: CostCatalogCategory;
	defaultMarkupPercent?: number;
	lastReviewedAt?: Date | null;
	name?: string;
	notes?: null | string;
	taxable?: boolean;
	unit?: string;
	unitCost?: number;
}

interface CostCatalogListOptions {
	active?: boolean;
	category?: CostCatalogCategory;
	includeArchived: boolean;
	limit: number;
	page: number;
	search?: string;
}

interface CostCatalogListResult {
	data: CostCatalogItemRow[];
	limit: number;
	page: number;
	total: number;
}

function trimNullable(value: null | string | undefined): null | string {
	if (value === undefined || value === null) return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function getCostCatalogItem(id: number): CostCatalogItemRow | null {
	const row = getDb()
		.select()
		.from(costCatalogItems)
		.where(eq(costCatalogItems.id, id))
		.limit(1)
		.get();

	return row ?? null;
}

function buildCostCatalogConditions(options: CostCatalogListOptions): SQL[] {
	const conditions: SQL[] = [];

	if (!options.includeArchived) {
		conditions.push(eq(costCatalogItems.active, true));
	}

	if (options.active !== undefined) {
		conditions.push(eq(costCatalogItems.active, options.active));
	}

	if (options.category) {
		conditions.push(eq(costCatalogItems.category, options.category));
	}

	if (options.search) {
		const searchPattern = `%${options.search}%`;
		conditions.push(
			or(
				like(costCatalogItems.name, searchPattern),
				like(costCatalogItems.category, searchPattern),
				like(costCatalogItems.unit, searchPattern),
				like(costCatalogItems.notes, searchPattern)
			) as SQL
		);
	}

	return conditions;
}

function listCostCatalogItems(options: CostCatalogListOptions): CostCatalogListResult {
	const db = getDb();
	const conditions = buildCostCatalogConditions(options);
	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
	const offset = (options.page - 1) * options.limit;
	const rows = db
		.select()
		.from(costCatalogItems)
		.where(whereClause)
		.orderBy(desc(costCatalogItems.updatedAt), desc(costCatalogItems.id))
		.limit(options.limit)
		.offset(offset)
		.all();
	const totalRow = db.select({ value: count() }).from(costCatalogItems).where(whereClause).get();

	return {
		data: rows,
		limit: options.limit,
		page: options.page,
		total: totalRow?.value ?? 0,
	};
}

function createCostCatalogItem(input: CostCatalogInput): CostCatalogItemRow {
	const now = new Date();

	return getDb()
		.insert(costCatalogItems)
		.values({
			active: input.active ?? true,
			category: input.category,
			createdAt: now,
			defaultMarkupPercent: input.defaultMarkupPercent ?? 0,
			lastReviewedAt: input.lastReviewedAt ?? null,
			name: input.name.trim(),
			notes: trimNullable(input.notes),
			taxable: input.taxable ?? true,
			unit: input.unit.trim(),
			unitCost: input.unitCost ?? 0,
			updatedAt: now,
		})
		.returning()
		.get();
}

function updateCostCatalogItem(
	id: number,
	input: CostCatalogUpdateInput
): CostCatalogItemRow | null {
	const current = getCostCatalogItem(id);
	if (!current) return null;

	return getDb()
		.update(costCatalogItems)
		.set({
			...(input.active !== undefined ? { active: input.active } : {}),
			...(input.category !== undefined ? { category: input.category } : {}),
			...(input.defaultMarkupPercent !== undefined
				? { defaultMarkupPercent: input.defaultMarkupPercent }
				: {}),
			...(input.lastReviewedAt !== undefined ? { lastReviewedAt: input.lastReviewedAt } : {}),
			...(input.name !== undefined ? { name: input.name.trim() } : {}),
			...(input.notes !== undefined ? { notes: trimNullable(input.notes) } : {}),
			...(input.taxable !== undefined ? { taxable: input.taxable } : {}),
			...(input.unit !== undefined ? { unit: input.unit.trim() } : {}),
			...(input.unitCost !== undefined ? { unitCost: input.unitCost } : {}),
			updatedAt: new Date(),
		})
		.where(eq(costCatalogItems.id, id))
		.returning()
		.get();
}

function archiveCostCatalogItem(id: number): boolean {
	const current = getCostCatalogItem(id);
	if (!current) return false;

	getDb()
		.update(costCatalogItems)
		.set({ active: false, updatedAt: new Date() })
		.where(eq(costCatalogItems.id, id))
		.run();

	return true;
}

export {
	archiveCostCatalogItem,
	createCostCatalogItem,
	getCostCatalogItem,
	listCostCatalogItems,
	updateCostCatalogItem,
};
export type {
	CostCatalogCategory,
	CostCatalogInput,
	CostCatalogItemRow,
	CostCatalogListOptions,
	CostCatalogListResult,
	CostCatalogUpdateInput,
};
