import type { RouteObject } from 'react-router-dom';

import { Navigate } from 'react-router-dom';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { LazyPage } from '@/routes/LazyPage';
import {
	ApiKeysTab,
	AssetDetailPage,
	AssetInventoryPage,
	BusinessMetricsPage,
	CustomDashboardPage,
	DashboardListPage,
	DashboardPage,
	FilesPage,
	GlobalSearchPage,
	ImportDetailPage,
	ImportsPage,
	InfrastructureDashboardPage,
	ManagementSummaryPage,
	NotificationsPage,
	OnboardingPage,
	PersonalInfoTab,
	PreferencesTab,
	ProfileLayout,
	RelationshipMapPage,
	RelationshipsPage,
	ReportsPage,
	SecurityTab,
	ServiceCatalogPage,
	ServiceDetailPage,
	WorkspaceManagementPage,
	WorkspaceSettingsPage,
} from '@/routes/lazyPages';
import { settingsRoute } from '@/routes/settingsRoutes';

/** Authenticated application routes rendered inside the AppShell + ProtectedRoute. */
const appRoutes: RouteObject[] = [
	{
		element: <Navigate replace to="/settings" />,
		path: '/admin',
	},
	{
		element: <LazyPage Component={InfrastructureDashboardPage} />,
		path: '/dashboard',
	},
	{
		element: <LazyPage Component={DashboardPage} />,
		path: '/system-status',
	},
	{
		element: <LazyPage Component={AssetInventoryPage} />,
		path: '/assets',
	},
	{
		element: <LazyPage Component={AssetDetailPage} />,
		path: '/assets/:id',
	},
	{
		element: <LazyPage Component={RelationshipsPage} />,
		path: '/relationships',
	},
	{
		element: <LazyPage Component={RelationshipMapPage} />,
		path: '/relationships/map',
	},
	{
		element: <LazyPage Component={GlobalSearchPage} />,
		path: '/search',
	},
	{
		element: <LazyPage Component={ManagementSummaryPage} />,
		path: '/reports/summary',
	},
	{
		element: <LazyPage Component={ReportsPage} />,
		path: '/reports',
	},
	{
		element: <LazyPage Component={ServiceCatalogPage} />,
		path: '/services',
	},
	{
		element: <LazyPage Component={ServiceDetailPage} />,
		path: '/services/:id',
	},
	{
		children: [
			{ element: <LazyPage Component={ImportsPage} />, index: true },
			{
				element: <LazyPage Component={ImportDetailPage} />,
				path: ':id',
			},
		],
		element: <ProtectedRoute requiredRole="OPERATOR" />,
		path: '/imports',
	},
	{
		element: <LazyPage Component={DashboardListPage} />,
		path: '/dashboards',
	},
	{
		element: <LazyPage Component={CustomDashboardPage} />,
		path: '/dashboards/:id',
	},
	{
		element: <LazyPage Component={NotificationsPage} />,
		path: '/notifications',
	},
	{
		children: [
			{
				element: <LazyPage Component={OnboardingPage} />,
				index: true,
			},
		],
		element: <ProtectedRoute requiredRole="ADMIN" />,
		path: '/onboarding',
	},
	{
		children: [
			{
				element: <LazyPage Component={BusinessMetricsPage} />,
				index: true,
			},
		],
		element: <ProtectedRoute requiredRole="OPERATOR" />,
		path: '/analytics',
	},
	{
		children: [
			{
				element: <LazyPage Component={FilesPage} />,
				index: true,
			},
		],
		element: <ProtectedRoute requiredRole="OPERATOR" />,
		path: '/files',
	},
	{
		element: <LazyPage Component={WorkspaceManagementPage} />,
		path: '/workspaces',
	},
	{
		element: <LazyPage Component={WorkspaceSettingsPage} />,
		path: '/workspaces/:id/settings',
	},
	{
		children: [
			{
				element: <Navigate replace to="/profile/personal" />,
				index: true,
			},
			{
				element: <LazyPage Component={PersonalInfoTab} />,
				path: 'personal',
			},
			{
				element: <LazyPage Component={PreferencesTab} />,
				path: 'preferences',
			},
			{
				element: <LazyPage Component={SecurityTab} />,
				path: 'security',
			},
			{
				element: <LazyPage Component={ApiKeysTab} />,
				path: 'api-keys',
			},
		],
		element: <LazyPage Component={ProfileLayout} />,
		path: '/profile',
	},
	settingsRoute,
];

export { appRoutes };
