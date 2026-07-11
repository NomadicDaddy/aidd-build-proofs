import { and, count, desc, eq, inArray, like, ne, or, type SQL } from 'drizzle-orm';

import type {
	CostCatalogAssumptionRow,
	QuoteScenarioRow,
	ScenarioComparisonResult,
	ScenarioDetail,
	ScenarioFixedCostInput,
	ScenarioLaborEntryInput,
	ScenarioLineItemInput,
	ScenarioInput,
	ScenarioLineItemRow,
	ScenarioListOptions,
	ScenarioListResult,
	ScenarioStatus,
	ScenarioUpdateInput,
} from './scenarioTypes.ts';

import { getDb } from '../../db/index.ts';
import { costCatalogItems } from '../../db/schema/costCatalogItems.ts';
import { quoteScenarios } from '../../db/schema/quoteScenarios.ts';
import { scenarioFixedCosts } from '../../db/schema/scenarioFixedCosts.ts';
import { scenarioLaborEntries } from '../../db/schema/scenarioLaborEntries.ts';
import { scenarioLineItems } from '../../db/schema/scenarioLineItems.ts';
import { calculateScenarioSummary } from './scenarioCalculations.ts';

function getScenarioById(id: number): null | QuoteScenarioRow {
	const row = getDb()
		.select()
		.from(quoteScenarios)
		.where(eq(quoteScenarios.id, id))
		.limit(1)
		.get();

	return row ?? null;
}

function getCatalogAssumptionsForLineItems(
	lineItems: ScenarioLineItemRow[]
): CostCatalogAssumptionRow[] {
	const catalogItemIds = [
		...new Set(
			lineItems
				.map((item) => item.catalogItemId)
				.filter((catalogItemId): catalogItemId is number => catalogItemId !== null)
		),
	];
	if (catalogItemIds.length === 0) return [];

	return getDb()
		.select({
			id: costCatalogItems.id,
			lastReviewedAt: costCatalogItems.lastReviewedAt,
		})
		.from(costCatalogItems)
		.where(inArray(costCatalogItems.id, catalogItemIds))
		.all();
}

function getScenarioDetail(id: number): null | ScenarioDetail {
	const scenario = getScenarioById(id);
	if (!scenario) return null;

	const lineItems = getDb()
		.select()
		.from(scenarioLineItems)
		.where(eq(scenarioLineItems.scenarioId, id))
		.orderBy(scenarioLineItems.sortOrder, scenarioLineItems.id)
		.all();
	const laborEntries = getDb()
		.select()
		.from(scenarioLaborEntries)
		.where(eq(scenarioLaborEntries.scenarioId, id))
		.orderBy(scenarioLaborEntries.sortOrder, scenarioLaborEntries.id)
		.all();
	const fixedCosts = getDb()
		.select()
		.from(scenarioFixedCosts)
		.where(eq(scenarioFixedCosts.scenarioId, id))
		.orderBy(scenarioFixedCosts.sortOrder, scenarioFixedCosts.id)
		.all();
	const catalogAssumptions = getCatalogAssumptionsForLineItems(lineItems);
	const summary = calculateScenarioSummary(
		scenario,
		lineItems,
		laborEntries,
		fixedCosts,
		catalogAssumptions
	);

	return { fixedCosts, laborEntries, lineItems, scenario, summary };
}

function buildScenarioListConditions(options: ScenarioListOptions): SQL[] {
	const conditions: SQL[] = [];

	if (!options.includeArchived) {
		conditions.push(ne(quoteScenarios.status, 'archived'));
	}

	if (options.status) {
		conditions.push(eq(quoteScenarios.status, options.status));
	}

	if (options.search) {
		const searchPattern = `%${options.search}%`;
		conditions.push(
			or(
				like(quoteScenarios.customerName, searchPattern),
				like(quoteScenarios.title, searchPattern)
			) as SQL
		);
	}

	return conditions;
}

function listScenarios(options: ScenarioListOptions): ScenarioListResult {
	const db = getDb();
	const conditions = buildScenarioListConditions(options);
	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
	const offset = (options.page - 1) * options.limit;
	const rows = db
		.select()
		.from(quoteScenarios)
		.where(whereClause)
		.orderBy(desc(quoteScenarios.updatedAt), desc(quoteScenarios.id))
		.limit(options.limit)
		.offset(offset)
		.all();
	const totalRow = db.select({ value: count() }).from(quoteScenarios).where(whereClause).get();

	// Batch-load child rows for all scenario IDs in a single pass instead of
	// calling getScenarioDetail() per row (N+1 pattern — ~102 queries per page).
	const scenarioIds = rows.map((row) => row.id);
	const emptyIds = scenarioIds.length === 0;

	const allLineItems = emptyIds
		? []
		: db
				.select()
				.from(scenarioLineItems)
				.where(inArray(scenarioLineItems.scenarioId, scenarioIds))
				.all();
	const allLaborEntries = emptyIds
		? []
		: db
				.select()
				.from(scenarioLaborEntries)
				.where(inArray(scenarioLaborEntries.scenarioId, scenarioIds))
				.all();
	const allFixedCosts = emptyIds
		? []
		: db
				.select()
				.from(scenarioFixedCosts)
				.where(inArray(scenarioFixedCosts.scenarioId, scenarioIds))
				.all();

	// Group child rows by scenarioId for O(1) lookup.
	const lineItemsByScenario = groupByScenarioId(allLineItems);
	const laborByScenario = groupByScenarioId(allLaborEntries);
	const fixedCostsByScenario = groupByScenarioId(allFixedCosts);

	// Batch catalog assumptions across all line items at once.
	const catalogAssumptions = getCatalogAssumptionsForLineItems(allLineItems);
	const catalogMap = new Map(catalogAssumptions.map((row) => [row.id, row]));

	const data = rows.map((scenario) => {
		const lineItems = lineItemsByScenario.get(scenario.id) ?? [];
		const laborEntries = laborByScenario.get(scenario.id) ?? [];
		const fixedCosts = fixedCostsByScenario.get(scenario.id) ?? [];

		// Filter catalog assumptions to only those referenced by this scenario's line items.
		const scenarioCatalogAssumptions = filterCatalogAssumptionsForScenario(
			lineItems,
			catalogMap
		);
		const summary = calculateScenarioSummary(
			scenario,
			lineItems,
			laborEntries,
			fixedCosts,
			scenarioCatalogAssumptions
		);

		return {
			customerName: scenario.customerName,
			finalPrice: summary.finalPrice,
			id: scenario.id,
			marginPercent: summary.marginPercent,
			riskCount: summary.riskFlags.length,
			riskFlags: summary.riskFlags,
			status: scenario.status as ScenarioStatus,
			targetMarginPercent: scenario.targetMarginPercent,
			title: scenario.title,
			updatedAt: scenario.updatedAt,
		};
	});

	return {
		data,
		limit: options.limit,
		page: options.page,
		total: totalRow?.value ?? 0,
	};
}

/**
 * Groups rows that have a `scenarioId` field into a Map keyed by scenario ID.
 * @param rows
 * @returns Map of scenario ID to array of rows belonging to that scenario
 */
function groupByScenarioId<T extends { scenarioId: number }>(rows: T[]): Map<number, T[]> {
	const map = new Map<number, T[]>();
	for (const row of rows) {
		const group = map.get(row.scenarioId);
		if (group) {
			group.push(row);
		} else {
			map.set(row.scenarioId, [row]);
		}
	}
	return map;
}

/**
 * Filters the pre-loaded catalog assumptions map to only those referenced by
 * a specific scenario's line items.
 * @param lineItems
 * @param catalogMap
 * @returns Array of catalog assumptions referenced by the given line items
 */
function filterCatalogAssumptionsForScenario(
	lineItems: ScenarioLineItemRow[],
	catalogMap: Map<number, CostCatalogAssumptionRow>
): CostCatalogAssumptionRow[] {
	const result: CostCatalogAssumptionRow[] = [];
	for (const item of lineItems) {
		if (item.catalogItemId !== null) {
			const assumption = catalogMap.get(item.catalogItemId);
			if (assumption) {
				result.push(assumption);
			}
		}
	}
	return result;
}

function replaceScenarioLineItems(
	tx: Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0],
	scenarioId: number,
	lineItems: ScenarioLineItemInput[],
	now: Date
): void {
	tx.delete(scenarioLineItems).where(eq(scenarioLineItems.scenarioId, scenarioId)).run();

	if (lineItems.length === 0) return;

	tx.insert(scenarioLineItems)
		.values(
			lineItems.map((item, index) => ({
				catalogItemId: item.catalogItemId ?? null,
				category: item.category,
				createdAt: now,
				markupPercent: item.markupPercent ?? 0,
				name: item.name,
				notes: item.notes ?? null,
				quantity: item.quantity ?? 1,
				scenarioId,
				sortOrder: item.sortOrder ?? index,
				taxable: item.taxable ?? true,
				unit: item.unit,
				unitCost: item.unitCost ?? 0,
				updatedAt: now,
			}))
		)
		.run();
}

function replaceScenarioLaborEntries(
	tx: Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0],
	scenarioId: number,
	laborEntries: ScenarioLaborEntryInput[],
	now: Date
): void {
	tx.delete(scenarioLaborEntries).where(eq(scenarioLaborEntries.scenarioId, scenarioId)).run();

	if (laborEntries.length === 0) return;

	tx.insert(scenarioLaborEntries)
		.values(
			laborEntries.map((entry, index) => ({
				billableHourlyRate: entry.billableHourlyRate ?? 0,
				burdenPercent: entry.burdenPercent ?? 0,
				createdAt: now,
				hours: entry.hours ?? 0,
				internalHourlyCost: entry.internalHourlyCost ?? 0,
				notes: entry.notes ?? null,
				roleName: entry.roleName,
				scenarioId,
				sortOrder: entry.sortOrder ?? index,
				updatedAt: now,
			}))
		)
		.run();
}

function replaceScenarioFixedCosts(
	tx: Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0],
	scenarioId: number,
	fixedCosts: ScenarioFixedCostInput[],
	now: Date
): void {
	tx.delete(scenarioFixedCosts).where(eq(scenarioFixedCosts.scenarioId, scenarioId)).run();

	if (fixedCosts.length === 0) return;

	tx.insert(scenarioFixedCosts)
		.values(
			fixedCosts.map((cost, index) => ({
				cost: cost.cost ?? 0,
				createdAt: now,
				markupPercent: cost.markupPercent ?? 0,
				name: cost.name,
				notes: cost.notes ?? null,
				scenarioId,
				sortOrder: cost.sortOrder ?? index,
				taxable: cost.taxable ?? false,
				updatedAt: now,
			}))
		)
		.run();
}

function createScenario(input: ScenarioInput): ScenarioDetail {
	const now = new Date();
	const db = getDb();
	const scenario = db.transaction((tx) => {
		const created = tx
			.insert(quoteScenarios)
			.values({
				assumptions: input.assumptions ?? null,
				contingencyPercent: input.contingencyPercent ?? 0,
				createdAt: now,
				customerName: input.customerName,
				discountPercent: input.discountPercent ?? 0,
				notes: input.notes ?? null,
				status: input.status ?? 'draft',
				targetMarginPercent: input.targetMarginPercent ?? 30,
				taxRatePercent: input.taxRatePercent ?? 0,
				title: input.title,
				updatedAt: now,
			})
			.returning()
			.get();

		replaceScenarioLineItems(tx, created.id, input.lineItems ?? [], now);
		replaceScenarioLaborEntries(tx, created.id, input.laborEntries ?? [], now);
		replaceScenarioFixedCosts(tx, created.id, input.fixedCosts ?? [], now);

		return created;
	});

	const detail = getScenarioDetail(scenario.id);
	if (!detail) throw new Error('Created scenario could not be loaded');

	return detail;
}

function updateScenario(id: number, input: ScenarioUpdateInput): null | ScenarioDetail {
	const current = getScenarioById(id);
	if (!current) return null;

	const updated = getDb().transaction((tx) => {
		const now = new Date();
		const scenario = tx
			.update(quoteScenarios)
			.set({
				...(input.assumptions !== undefined ? { assumptions: input.assumptions } : {}),
				...(input.contingencyPercent !== undefined
					? { contingencyPercent: input.contingencyPercent }
					: {}),
				...(input.customerName !== undefined ? { customerName: input.customerName } : {}),
				...(input.discountPercent !== undefined
					? { discountPercent: input.discountPercent }
					: {}),
				...(input.notes !== undefined ? { notes: input.notes } : {}),
				...(input.status !== undefined ? { status: input.status } : {}),
				...(input.targetMarginPercent !== undefined
					? { targetMarginPercent: input.targetMarginPercent }
					: {}),
				...(input.taxRatePercent !== undefined
					? { taxRatePercent: input.taxRatePercent }
					: {}),
				...(input.title !== undefined ? { title: input.title } : {}),
				updatedAt: now,
			})
			.where(eq(quoteScenarios.id, id))
			.returning()
			.get();

		if (input.lineItems !== undefined) {
			replaceScenarioLineItems(tx, id, input.lineItems, now);
		}

		if (input.laborEntries !== undefined) {
			replaceScenarioLaborEntries(tx, id, input.laborEntries, now);
		}

		if (input.fixedCosts !== undefined) {
			replaceScenarioFixedCosts(tx, id, input.fixedCosts, now);
		}

		return scenario;
	});

	return getScenarioDetail(updated.id);
}

function archiveScenario(id: number): boolean {
	const current = getScenarioById(id);
	if (!current) return false;

	getDb()
		.update(quoteScenarios)
		.set({ status: 'archived', updatedAt: new Date() })
		.where(eq(quoteScenarios.id, id))
		.run();

	return true;
}

function compareScenarios(ids: number[]): ScenarioComparisonResult {
	const scenarios = ids
		.map((id) => getScenarioDetail(id))
		.filter((detail): detail is ScenarioDetail => detail !== null)
		.map((detail) => ({
			customerName: detail.scenario.customerName,
			id: detail.scenario.id,
			status: detail.scenario.status as ScenarioStatus,
			summary: detail.summary,
			title: detail.scenario.title,
			updatedAt: detail.scenario.updatedAt,
		}));

	return { scenarios };
}

export {
	archiveScenario,
	compareScenarios,
	createScenario,
	getScenarioDetail,
	listScenarios,
	updateScenario,
};
