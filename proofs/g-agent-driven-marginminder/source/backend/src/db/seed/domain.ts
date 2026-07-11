import { and, eq } from 'drizzle-orm';

import type { SeedDb } from './types.ts';

import { logDatabase } from '../../utils/logger.ts';
import { costCatalogItems } from '../schema/costCatalogItems.ts';
import { quoteScenarios } from '../schema/quoteScenarios.ts';
import { scenarioFixedCosts } from '../schema/scenarioFixedCosts.ts';
import { scenarioLaborEntries } from '../schema/scenarioLaborEntries.ts';
import { scenarioLineItems } from '../schema/scenarioLineItems.ts';

const SEED_TIMESTAMP = new Date('2026-06-01T12:00:00.000Z');
const STALE_REVIEW_DATE = new Date('2025-11-15T12:00:00.000Z');

type CatalogSeed = typeof costCatalogItems.$inferInsert;
type FixedCostSeed = Omit<typeof scenarioFixedCosts.$inferInsert, 'scenarioId'>;
type LaborSeed = Omit<typeof scenarioLaborEntries.$inferInsert, 'scenarioId'>;
type LineItemSeed = Omit<typeof scenarioLineItems.$inferInsert, 'catalogItemId' | 'scenarioId'> & {
	catalogName: string;
};
type ScenarioSeed = typeof quoteScenarios.$inferInsert;

const catalogSeeds = [
	{
		active: true,
		category: 'labor',
		defaultMarkupPercent: 0,
		lastReviewedAt: SEED_TIMESTAMP,
		name: 'Senior field technician',
		notes: 'Loaded internal labor cost baseline for experienced installation work.',
		taxable: false,
		unit: 'hour',
		unitCost: 58,
	},
	{
		active: true,
		category: 'labor',
		defaultMarkupPercent: 0,
		lastReviewedAt: SEED_TIMESTAMP,
		name: 'Project coordinator',
		notes: 'Coordination and customer communication baseline.',
		taxable: false,
		unit: 'hour',
		unitCost: 46,
	},
	{
		active: true,
		category: 'material',
		defaultMarkupPercent: 35,
		lastReviewedAt: STALE_REVIEW_DATE,
		name: 'Cat6 plenum cable box',
		notes: 'Linked stale catalog assumption so seeded scenarios show a visible risk flag.',
		taxable: true,
		unit: 'box',
		unitCost: 82,
	},
	{
		active: true,
		category: 'material',
		defaultMarkupPercent: 30,
		lastReviewedAt: SEED_TIMESTAMP,
		name: 'Patch panel and keystone kit',
		notes: 'Typical small-office network trim material bundle.',
		taxable: true,
		unit: 'kit',
		unitCost: 140,
	},
	{
		active: true,
		category: 'subcontractor',
		defaultMarkupPercent: 20,
		lastReviewedAt: SEED_TIMESTAMP,
		name: 'Low-voltage certification test',
		notes: 'Third-party certification and documented test results.',
		taxable: false,
		unit: 'job',
		unitCost: 650,
	},
	{
		active: true,
		category: 'fee',
		defaultMarkupPercent: 10,
		lastReviewedAt: SEED_TIMESTAMP,
		name: 'Permit and inspection fee',
		notes: 'Municipal inspection pass-through with light handling markup.',
		taxable: false,
		unit: 'permit',
		unitCost: 185,
	},
	{
		active: true,
		category: 'overhead',
		defaultMarkupPercent: 10,
		lastReviewedAt: SEED_TIMESTAMP,
		name: 'Truck roll and consumables',
		notes: 'Fuel, parking, consumables, and small tool wear.',
		taxable: false,
		unit: 'job',
		unitCost: 325,
	},
] satisfies CatalogSeed[];

const scenarioSeed = {
	assumptions:
		'After-hours install window; customer provides rack access; reusable pathway is available; ' +
		'quote includes test documentation and one return trip for punch-list cleanup.',
	contingencyPercent: 8,
	customerName: 'Northstar Dental Group',
	discountPercent: 18,
	notes:
		'Seeded review scenario intentionally carries risk flags for tester visibility: high ' +
		'discount, below-target margin, and a stale linked material assumption.',
	status: 'review',
	targetMarginPercent: 35,
	taxRatePercent: 8.25,
	title: 'Operatory Network Refresh',
} satisfies ScenarioSeed;

const laborSeeds = [
	{
		billableHourlyRate: 125,
		burdenPercent: 28,
		hours: 18,
		internalHourlyCost: 58,
		notes: 'Two evenings for cable pulls, trim-out, labeling, and validation.',
		roleName: 'Senior field technician',
		sortOrder: 0,
	},
	{
		billableHourlyRate: 95,
		burdenPercent: 22,
		hours: 4,
		internalHourlyCost: 46,
		notes: 'Schedule coordination, customer updates, and closeout package.',
		roleName: 'Project coordinator',
		sortOrder: 1,
	},
] satisfies LaborSeed[];

const lineItemSeeds = [
	{
		catalogName: 'Cat6 plenum cable box',
		category: 'material',
		markupPercent: 35,
		name: 'Cat6 plenum cable box',
		notes: 'Five boxes cover eight operatories plus service loop and waste allowance.',
		quantity: 5,
		sortOrder: 0,
		taxable: true,
		unit: 'box',
		unitCost: 82,
	},
	{
		catalogName: 'Patch panel and keystone kit',
		category: 'material',
		markupPercent: 30,
		name: 'Patch panel and keystone kit',
		notes: 'Panels, keystones, faceplates, and labels.',
		quantity: 2,
		sortOrder: 1,
		taxable: true,
		unit: 'kit',
		unitCost: 140,
	},
	{
		catalogName: 'Low-voltage certification test',
		category: 'subcontractor',
		markupPercent: 20,
		name: 'Low-voltage certification test',
		notes: 'Independent test report for each drop.',
		quantity: 1,
		sortOrder: 2,
		taxable: false,
		unit: 'job',
		unitCost: 650,
	},
	{
		catalogName: 'Permit and inspection fee',
		category: 'fee',
		markupPercent: 10,
		name: 'Permit and inspection fee',
		notes: 'Local permit and inspection handling.',
		quantity: 1,
		sortOrder: 3,
		taxable: false,
		unit: 'permit',
		unitCost: 185,
	},
] satisfies LineItemSeed[];

const fixedCostSeeds = [
	{
		cost: 325,
		markupPercent: 10,
		name: 'Truck roll and consumables',
		notes: 'Fuel, parking, anchors, labels, cable ties, and small consumables.',
		sortOrder: 0,
		taxable: false,
	},
] satisfies FixedCostSeed[];

function upsertCatalogItem(db: SeedDb, seed: CatalogSeed): number {
	const existing = db
		.select({ id: costCatalogItems.id })
		.from(costCatalogItems)
		.where(eq(costCatalogItems.name, seed.name))
		.limit(1)
		.get();

	if (!existing) {
		return db
			.insert(costCatalogItems)
			.values({ ...seed, createdAt: SEED_TIMESTAMP, updatedAt: SEED_TIMESTAMP })
			.returning({ id: costCatalogItems.id })
			.get().id;
	}

	db.update(costCatalogItems)
		.set({ ...seed, updatedAt: SEED_TIMESTAMP })
		.where(eq(costCatalogItems.id, existing.id))
		.run();

	return existing.id;
}

function upsertScenario(db: SeedDb, seed: ScenarioSeed): number {
	const existing = db
		.select({ id: quoteScenarios.id })
		.from(quoteScenarios)
		.where(
			and(
				eq(quoteScenarios.customerName, seed.customerName),
				eq(quoteScenarios.title, seed.title)
			)
		)
		.limit(1)
		.get();

	if (!existing) {
		return db
			.insert(quoteScenarios)
			.values({ ...seed, createdAt: SEED_TIMESTAMP, updatedAt: SEED_TIMESTAMP })
			.returning({ id: quoteScenarios.id })
			.get().id;
	}

	db.update(quoteScenarios)
		.set({ ...seed, updatedAt: SEED_TIMESTAMP })
		.where(eq(quoteScenarios.id, existing.id))
		.run();

	return existing.id;
}

function upsertLaborEntry(db: SeedDb, scenarioId: number, seed: LaborSeed): void {
	const existing = db
		.select({ id: scenarioLaborEntries.id })
		.from(scenarioLaborEntries)
		.where(
			and(
				eq(scenarioLaborEntries.scenarioId, scenarioId),
				eq(scenarioLaborEntries.roleName, seed.roleName)
			)
		)
		.limit(1)
		.get();

	if (!existing) {
		db.insert(scenarioLaborEntries)
			.values({ ...seed, createdAt: SEED_TIMESTAMP, scenarioId, updatedAt: SEED_TIMESTAMP })
			.run();
		return;
	}

	db.update(scenarioLaborEntries)
		.set({ ...seed, updatedAt: SEED_TIMESTAMP })
		.where(eq(scenarioLaborEntries.id, existing.id))
		.run();
}

function upsertLineItem(
	db: SeedDb,
	scenarioId: number,
	catalogIdsByName: Map<string, number>,
	seed: LineItemSeed
): void {
	const existing = db
		.select({ id: scenarioLineItems.id })
		.from(scenarioLineItems)
		.where(
			and(eq(scenarioLineItems.scenarioId, scenarioId), eq(scenarioLineItems.name, seed.name))
		)
		.limit(1)
		.get();
	const { catalogName, ...lineItemSeed } = seed;
	const catalogItemId = catalogIdsByName.get(catalogName) ?? null;

	if (!existing) {
		db.insert(scenarioLineItems)
			.values({
				...lineItemSeed,
				catalogItemId,
				createdAt: SEED_TIMESTAMP,
				scenarioId,
				updatedAt: SEED_TIMESTAMP,
			})
			.run();
		return;
	}

	db.update(scenarioLineItems)
		.set({ ...lineItemSeed, catalogItemId, updatedAt: SEED_TIMESTAMP })
		.where(eq(scenarioLineItems.id, existing.id))
		.run();
}

function upsertFixedCost(db: SeedDb, scenarioId: number, seed: FixedCostSeed): void {
	const existing = db
		.select({ id: scenarioFixedCosts.id })
		.from(scenarioFixedCosts)
		.where(
			and(
				eq(scenarioFixedCosts.scenarioId, scenarioId),
				eq(scenarioFixedCosts.name, seed.name)
			)
		)
		.limit(1)
		.get();

	if (!existing) {
		db.insert(scenarioFixedCosts)
			.values({ ...seed, createdAt: SEED_TIMESTAMP, scenarioId, updatedAt: SEED_TIMESTAMP })
			.run();
		return;
	}

	db.update(scenarioFixedCosts)
		.set({ ...seed, updatedAt: SEED_TIMESTAMP })
		.where(eq(scenarioFixedCosts.id, existing.id))
		.run();
}

function seedDomainQuoteData(db: SeedDb): void {
	const catalogIdsByName = new Map<string, number>();

	for (const seed of catalogSeeds) {
		catalogIdsByName.set(seed.name, upsertCatalogItem(db, seed));
	}

	const scenarioId = upsertScenario(db, scenarioSeed);

	for (const seed of laborSeeds) {
		upsertLaborEntry(db, scenarioId, seed);
	}

	for (const seed of lineItemSeeds) {
		upsertLineItem(db, scenarioId, catalogIdsByName, seed);
	}

	for (const seed of fixedCostSeeds) {
		upsertFixedCost(db, scenarioId, seed);
	}

	logDatabase('info', 'Domain seed complete: quote scenario and cost catalog assumptions ready', {
		scenarioId,
	});
}

export { seedDomainQuoteData };
