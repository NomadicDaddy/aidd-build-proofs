type CostCatalogCategory = 'fee' | 'labor' | 'material' | 'other' | 'overhead' | 'subcontractor';

interface CostCatalogItem {
	active: boolean;
	category: CostCatalogCategory;
	createdAt: string;
	defaultMarkupPercent: number;
	id: number;
	lastReviewedAt: null | string;
	name: string;
	notes: null | string;
	taxable: boolean;
	unit: string;
	unitCost: number;
	updatedAt: string;
}

interface CostCatalogItemInput {
	active?: boolean;
	category: CostCatalogCategory;
	defaultMarkupPercent?: number;
	lastReviewedAt?: null | string;
	name: string;
	notes?: null | string;
	taxable?: boolean;
	unit: string;
	unitCost?: number;
}

interface CostCatalogItemUpdateInput {
	active?: boolean;
	category?: CostCatalogCategory;
	defaultMarkupPercent?: number;
	lastReviewedAt?: null | string;
	name?: string;
	notes?: null | string;
	taxable?: boolean;
	unit?: string;
	unitCost?: number;
}

export type {
	CostCatalogCategory,
	CostCatalogItem,
	CostCatalogItemInput,
	CostCatalogItemUpdateInput,
};
