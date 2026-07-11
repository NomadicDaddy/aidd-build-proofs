import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Calculator, Save } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

import type { ScenarioDetail } from '@/api/types';

import { getScenario } from '@/api/scenarios';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import {
	ScenarioExportTab,
	ScenarioFixedCostsTab,
	ScenarioHeaderFields,
	ScenarioLaborTab,
	ScenarioLineItemsTab,
	ScenarioSidebarSummary,
	ScenarioSummaryTab,
} from './components';
import { isScenarioEditorTabKey } from './components/helpers';
import { ScenarioFormContext } from './components/ScenarioFormContext';
import { useScenarioFormActions } from './components/useScenarioFormActions';

function ScenarioEditorPage() {
	const params = useParams();
	const scenarioId = params.id ? Number(params.id) : null;
	const isEditMode = scenarioId !== null && Number.isFinite(scenarioId);
	const detailQuery = useQuery({
		enabled: isEditMode,
		queryFn: () => getScenario(scenarioId ?? 0),
		queryKey: ['scenario', scenarioId],
	});
	const detail = detailQuery.data?.data ?? null;

	if (params.id && !isEditMode) {
		return <div className="text-destructive p-6 text-sm">Invalid scenario id.</div>;
	}

	if (isEditMode && detailQuery.isLoading) {
		return <div className="text-muted-foreground p-6 text-sm">Loading scenario...</div>;
	}

	if (isEditMode && detailQuery.isError) {
		return <div className="text-destructive p-6 text-sm">Unable to load scenario.</div>;
	}

	return (
		<ScenarioEditorForm
			initialDetail={detail}
			isEditMode={isEditMode}
			key={scenarioId ?? 'new'}
			scenarioId={scenarioId}
		/>
	);
}

interface ScenarioEditorFormProps {
	initialDetail: null | ScenarioDetail;
	isEditMode: boolean;
	scenarioId: null | number;
}

function ScenarioEditorForm({ initialDetail, isEditMode, scenarioId }: ScenarioEditorFormProps) {
	const actions = useScenarioFormActions(initialDetail, isEditMode, scenarioId);
	const { activeTab, saveError, saveMutation, setActiveTab } = actions;

	function updateActiveTab(value: string) {
		if (isScenarioEditorTabKey(value)) {
			setActiveTab(value);
		}
	}

	function handleSave(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		actions.submitPayload();
	}

	return (
		<ScenarioFormContext.Provider value={actions}>
			<form className="space-y-5 p-6" noValidate onSubmit={handleSave}>
				<PageHeader
					className="bg-background/95 sticky top-0 z-30 -mx-6 px-6 pt-6 backdrop-blur"
					description="Create or update pricing assumptions and saved quote inputs."
					icon={Calculator}
					title={isEditMode ? 'Edit Scenario' : 'New Scenario'}>
					<Button asChild type="button" variant="outline">
						<Link to="/scenarios">
							<ArrowLeft aria-hidden="true" className="size-4" />
							Scenarios
						</Link>
					</Button>
					<Button disabled={saveMutation.isPending} type="submit">
						<Save aria-hidden="true" className="size-4" />
						{saveMutation.isPending ? 'Saving...' : 'Save'}
					</Button>
				</PageHeader>
				{saveError && (
					<div
						className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-4 py-3 text-sm"
						role="alert">
						{saveError}
					</div>
				)}

				<div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
					<div className="space-y-5">
						<ScenarioHeaderFields />

						<Tabs onValueChange={updateActiveTab} value={activeTab}>
							<TabsList
								className="w-full justify-start overflow-x-auto"
								variant="line">
								<TabsTrigger
									onClick={() => setActiveTab('line-items')}
									type="button"
									value="line-items">
									Line Items
								</TabsTrigger>
								<TabsTrigger
									onClick={() => setActiveTab('labor')}
									type="button"
									value="labor">
									Labor
								</TabsTrigger>
								<TabsTrigger
									onClick={() => setActiveTab('fixed-costs')}
									type="button"
									value="fixed-costs">
									Fixed Costs
								</TabsTrigger>
								<TabsTrigger
									onClick={() => setActiveTab('summary')}
									type="button"
									value="summary">
									Summary
								</TabsTrigger>
								<TabsTrigger
									onClick={() => setActiveTab('export')}
									type="button"
									value="export">
									Export
								</TabsTrigger>
							</TabsList>

							<TabsContent value="line-items">
								<ScenarioLineItemsTab />
							</TabsContent>

							<TabsContent value="labor">
								<ScenarioLaborTab />
							</TabsContent>

							<TabsContent value="fixed-costs">
								<ScenarioFixedCostsTab />
							</TabsContent>

							<TabsContent value="summary">
								<ScenarioSummaryTab />
							</TabsContent>

							<TabsContent value="export">
								<ScenarioExportTab />
							</TabsContent>
						</Tabs>
					</div>

					<aside className="space-y-4">
						<ScenarioSidebarSummary />
					</aside>
				</div>
			</form>
		</ScenarioFormContext.Provider>
	);
}

export { ScenarioEditorPage };
