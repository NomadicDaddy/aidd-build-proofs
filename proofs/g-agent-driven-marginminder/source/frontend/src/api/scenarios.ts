import type {
	DataResponse,
	ScenarioComparisonResult,
	ScenarioDetail,
	ScenarioInput,
	ScenarioListResult,
	ScenarioStatus,
	ScenarioUpdateInput,
} from './types';

import { apiClient } from './client';

interface ListScenariosOptions {
	includeArchived?: boolean;
	limit?: number;
	page?: number;
	search?: string;
	status?: 'all' | ScenarioStatus;
}

function listScenarios(
	options: ListScenariosOptions = {}
): Promise<DataResponse<ScenarioListResult>> {
	const params: Record<string, string> = {
		includeArchived: String(options.includeArchived ?? false),
		limit: String(options.limit ?? 100),
		page: String(options.page ?? 1),
	};

	if (options.search) params.search = options.search;
	if (options.status && options.status !== 'all') params.status = options.status;

	return apiClient.get<DataResponse<ScenarioListResult>>('/scenarios', { params });
}

function compareScenarios(scenarioIds: number[]): Promise<DataResponse<ScenarioComparisonResult>> {
	return apiClient.post<DataResponse<ScenarioComparisonResult>>('/scenario-comparison', {
		body: { scenarioIds },
	});
}

function createScenario(input: ScenarioInput): Promise<DataResponse<ScenarioDetail>> {
	return apiClient.post<DataResponse<ScenarioDetail>>('/scenarios', { body: input });
}

function getScenario(id: number): Promise<DataResponse<ScenarioDetail>> {
	return apiClient.get<DataResponse<ScenarioDetail>>(`/scenarios/${id}`);
}

function updateScenario(
	id: number,
	input: ScenarioUpdateInput
): Promise<DataResponse<ScenarioDetail>> {
	return apiClient.put<DataResponse<ScenarioDetail>>(`/scenarios/${id}`, { body: input });
}

export { compareScenarios, createScenario, getScenario, listScenarios, updateScenario };
export type { ListScenariosOptions };
