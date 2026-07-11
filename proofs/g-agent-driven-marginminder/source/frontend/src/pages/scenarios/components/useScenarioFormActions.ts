import {
	useMutation,
	useQuery,
	useQueryClient,
	type UseMutationResult,
} from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import type { CostCatalogItem, ScenarioDetail, ScenarioInput, ScenarioSummary } from '@/api/types';

import { listCostCatalogItems } from '@/api/costCatalog';
import { createScenario, updateScenario } from '@/api/scenarios';

import type {
	CopyFeedback,
	ErrorMap,
	FixedCostDraft,
	LaborEntryDraft,
	LaborNumberFieldKey,
	LineItemDraft,
	ScenarioEditorTabKey,
	ScenarioFormState,
	ScenarioNumericFieldKey,
} from './types';

import {
	blankFixedCost,
	blankLaborEntry,
	blankLineItem,
	buildExportText,
	buildPayload,
	formStateFromDetail,
	formatNumberInput,
	getInitialFormState,
	getNumberValidationError,
} from './helpers';
import { ZERO_SUMMARY } from './types';

export interface ScenarioFormActions {
	activeTab: ScenarioEditorTabKey;
	addFixedCost: () => void;
	addLaborEntry: () => void;
	addLineItem: () => void;
	catalogItems: CostCatalogItem[];
	copyExport: () => Promise<void>;
	copyFeedback: CopyFeedback | null;
	errors: ErrorMap;
	exportText: string;
	form: ScenarioFormState;
	isEditMode: boolean;
	removeFixedCost: (index: number) => void;
	removeLaborEntry: (index: number) => void;
	removeLineItem: (index: number) => void;
	savedDetail: null | ScenarioDetail;
	saveError: null | string;
	saveMutation: UseMutationResult<{ data: ScenarioDetail }, Error, ScenarioInput, unknown>;
	setActiveTab: (tab: ScenarioEditorTabKey) => void;
	setErrors: React.Dispatch<React.SetStateAction<ErrorMap>>;
	setForm: React.Dispatch<React.SetStateAction<ScenarioFormState>>;
	submitPayload: () => void;
	summary: ScenarioSummary;
	updateFixedCost: (index: number, patch: Partial<FixedCostDraft>) => void;
	updateFixedCostNumber: (
		index: number,
		key: 'cost' | 'markupPercent',
		value: string,
		label: string
	) => void;
	updateForm: (patch: Partial<ScenarioFormState>) => void;
	updateLaborEntry: (index: number, patch: Partial<LaborEntryDraft>) => void;
	updateLaborEntryNumber: (
		index: number,
		key: LaborNumberFieldKey,
		value: string,
		label: string
	) => void;
	updateLineItem: (index: number, patch: Partial<LineItemDraft>) => void;
	updateLineItemCatalog: (index: number, value: string) => void;
	updateScenarioNumericField: (
		key: ScenarioNumericFieldKey,
		value: string,
		label: string,
		maximum?: number
	) => void;
}

export function useScenarioFormActions(
	initialDetail: null | ScenarioDetail,
	isEditMode: boolean,
	scenarioId: null | number
): ScenarioFormActions {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const catalogQuery = useQuery({
		queryFn: () =>
			listCostCatalogItems({
				active: true,
				includeArchived: false,
				limit: 100,
			}),
		queryKey: ['cost-catalog', 'scenario-line-items'],
	});
	const [form, setForm] = useState<ScenarioFormState>(() =>
		initialDetail ? formStateFromDetail(initialDetail) : getInitialFormState()
	);
	const [errors, setErrors] = useState<ErrorMap>({});
	const [saveError, setSaveError] = useState<null | string>(null);
	const [savedDetail, setSavedDetail] = useState<null | ScenarioDetail>(() => initialDetail);
	const [activeTab, setActiveTab] = useState<ScenarioEditorTabKey>('line-items');
	const [copyFeedback, setCopyFeedback] = useState<CopyFeedback | null>(null);
	const catalogItems = catalogQuery.data?.data ?? [];
	const summary = savedDetail?.summary ?? ZERO_SUMMARY;
	const exportText = buildExportText(savedDetail);

	const saveMutation = useMutation({
		mutationFn: (payload: ScenarioInput) => {
			if (isEditMode && scenarioId !== null) {
				return updateScenario(scenarioId, payload);
			}
			return createScenario(payload);
		},
		onError: (error) => {
			setSaveError(
				error instanceof Error
					? error.message
					: 'Unable to save scenario. Check the highlighted fields and try again.'
			);
		},
		onSuccess: async (response) => {
			const saved = response.data;
			setForm(formStateFromDetail(saved));
			setSavedDetail(saved);
			setErrors({});
			setSaveError(null);
			await queryClient.invalidateQueries({ queryKey: ['scenarios'] });
			await queryClient.invalidateQueries({ queryKey: ['scenario', saved.scenario.id] });
			toast.success('Scenario saved');
			if (!isEditMode) {
				void navigate(`/scenarios/${saved.scenario.id}`, { replace: true });
			}
		},
	});

	function updateForm(patch: Partial<ScenarioFormState>) {
		setForm((current) => ({ ...current, ...patch }));
	}

	function updateScenarioNumericField(
		key: ScenarioNumericFieldKey,
		value: string,
		label: string,
		maximum?: number
	) {
		updateForm({ [key]: value });
		const nextError = getNumberValidationError(value, label, maximum);
		setErrors((current) => {
			if (!current[key]) return current;
			if (nextError === current[key]) return current;
			if (nextError === null) {
				const { [key]: _clearedError, ...rest } = current;
				return rest;
			}
			return { ...current, [key]: nextError };
		});
	}

	function addLineItem() {
		setForm((current) => ({ ...current, lineItems: [...current.lineItems, blankLineItem()] }));
	}

	function removeLineItem(index: number) {
		setForm((current) => ({
			...current,
			lineItems: current.lineItems.filter((_, i) => i !== index),
		}));
	}

	function updateLineItem(index: number, patch: Partial<LineItemDraft>) {
		setForm((current) => ({
			...current,
			lineItems: current.lineItems.map((item, i) =>
				i === index ? { ...item, ...patch } : item
			),
		}));
	}

	function updateLineItemCatalog(index: number, value: string) {
		if (value === 'custom') {
			updateLineItem(index, { catalogItemId: null });
			return;
		}

		const catalogItem = catalogItems.find((item) => String(item.id) === value);
		if (!catalogItem) return;

		updateLineItem(index, {
			catalogItemId: catalogItem.id,
			category: catalogItem.category,
			markupPercent: formatNumberInput(catalogItem.defaultMarkupPercent),
			name: catalogItem.name,
			taxable: catalogItem.taxable,
			unit: catalogItem.unit,
			unitCost: formatNumberInput(catalogItem.unitCost),
		});
	}

	function addLaborEntry() {
		setForm((current) => ({
			...current,
			laborEntries: [...current.laborEntries, blankLaborEntry()],
		}));
	}

	function removeLaborEntry(index: number) {
		setForm((current) => ({
			...current,
			laborEntries: current.laborEntries.filter((_, i) => i !== index),
		}));
	}

	function updateLaborEntry(index: number, patch: Partial<LaborEntryDraft>) {
		setForm((current) => ({
			...current,
			laborEntries: current.laborEntries.map((entry, i) =>
				i === index ? { ...entry, ...patch } : entry
			),
		}));
	}

	function updateLaborEntryNumber(
		index: number,
		key: LaborNumberFieldKey,
		value: string,
		label: string
	) {
		updateLaborEntry(index, { [key]: value });
		const errorKey = `laborEntries.${index}.${key}`;
		const nextError = getNumberValidationError(value, label);
		setErrors((current) => {
			if (nextError === null) {
				const { [errorKey]: _clearedError, ...rest } = current;
				return rest;
			}
			return { ...current, [errorKey]: nextError };
		});
	}

	function addFixedCost() {
		setForm((current) => ({
			...current,
			fixedCosts: [...current.fixedCosts, blankFixedCost()],
		}));
	}

	function removeFixedCost(index: number) {
		setForm((current) => ({
			...current,
			fixedCosts: current.fixedCosts.filter((_, i) => i !== index),
		}));
	}

	function updateFixedCost(index: number, patch: Partial<FixedCostDraft>) {
		setForm((current) => ({
			...current,
			fixedCosts: current.fixedCosts.map((cost, i) =>
				i === index ? { ...cost, ...patch } : cost
			),
		}));
	}

	function updateFixedCostNumber(
		index: number,
		key: 'cost' | 'markupPercent',
		value: string,
		label: string
	) {
		if (key === 'cost') {
			updateFixedCost(index, { cost: value });
		} else {
			updateFixedCost(index, { markupPercent: value });
		}
		const errorKey = `fixedCosts.${index}.${key}`;
		const nextError = getNumberValidationError(value, label);
		setErrors((current) => {
			if (nextError === null) {
				const { [errorKey]: _clearedError, ...rest } = current;
				return rest;
			}
			return { ...current, [errorKey]: nextError };
		});
	}

	function submitPayload() {
		const { errors: nextErrors, payload } = buildPayload(form);
		setErrors(nextErrors);
		if (Object.keys(nextErrors).length > 0) {
			setSaveError('Fix the highlighted validation errors before saving.');
			return;
		}
		setSaveError(null);
		saveMutation.mutate(payload);
	}

	async function copyExport() {
		const canCopyExport = exportText.length > 0;
		if (!canCopyExport) {
			const message = 'Save the scenario before copying a summary.';
			setCopyFeedback({ message, type: 'error' });
			toast.error(message);
			return;
		}

		try {
			await navigator.clipboard.writeText(exportText);
			const message = 'Markdown summary copied.';
			setCopyFeedback({ message, type: 'success' });
			toast.success(message);
		} catch {
			const message = 'Unable to copy summary.';
			setCopyFeedback({ message, type: 'error' });
			toast.error(message);
		}
	}

	return {
		activeTab,
		addFixedCost,
		addLaborEntry,
		addLineItem,
		catalogItems,
		copyExport,
		copyFeedback,
		errors,
		exportText,
		form,
		isEditMode,
		removeFixedCost,
		removeLaborEntry,
		removeLineItem,
		savedDetail,
		saveError,
		saveMutation,
		setActiveTab,
		setErrors,
		setForm,
		submitPayload,
		summary,
		updateFixedCost,
		updateFixedCostNumber,
		updateForm,
		updateLaborEntry,
		updateLaborEntryNumber,
		updateLineItem,
		updateLineItemCatalog,
		updateScenarioNumericField,
	};
}
