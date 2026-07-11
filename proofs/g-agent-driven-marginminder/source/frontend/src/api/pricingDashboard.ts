import type { DataResponse, PricingDashboardData } from './types';

import { apiClient } from './client';

function getPricingDashboard(): Promise<DataResponse<PricingDashboardData>> {
	return apiClient.get<DataResponse<PricingDashboardData>>('/dashboard');
}

export { getPricingDashboard };
