import type { ComponentType } from 'react';

import { lazy } from 'react';

/** Create a lazy component from a named export. Reduces repeated `.then(m => ...)` boilerplate. */
function lazyNamed<T extends Record<string, unknown>>(
	importFn: () => Promise<T>,
	name: keyof T & string
) {
	return lazy(() => importFn().then((m) => ({ default: m[name] as ComponentType })));
}

// Auth pages
export const LoginPage = lazyNamed(() => import('@/pages/auth/LoginPage'), 'LoginPage');
export const RegisterPage = lazyNamed(() => import('@/pages/auth/RegisterPage'), 'RegisterPage');
export const ForcePasswordChangePage = lazyNamed(
	() => import('@/pages/auth/ForcePasswordChangePage'),
	'ForcePasswordChangePage'
);
export const ResetPasswordPage = lazyNamed(
	() => import('@/pages/auth/ResetPasswordPage'),
	'ResetPasswordPage'
);
export const ResetPasswordConfirmPage = lazyNamed(
	() => import('@/pages/auth/ResetPasswordConfirmPage'),
	'ResetPasswordConfirmPage'
);
export const OAuthCallbackPage = lazyNamed(
	() => import('@/pages/auth/OAuthCallbackPage'),
	'OAuthCallbackPage'
);
export const VerifyEmailPage = lazyNamed(
	() => import('@/pages/auth/VerifyEmailPage'),
	'VerifyEmailPage'
);
export const ConfirmEmailChangePage = lazyNamed(
	() => import('@/pages/auth/ConfirmEmailChangePage'),
	'ConfirmEmailChangePage'
);
export const MfaVerifyPage = lazyNamed(() => import('@/pages/auth/MfaVerifyPage'), 'MfaVerifyPage');

// Dashboard pages
export const InfrastructureDashboardPage = lazyNamed(
	() => import('@/pages/dashboard/infrastructure/InfrastructureDashboardPage'),
	'InfrastructureDashboardPage'
);
export const DashboardPage = lazyNamed(
	() => import('@/pages/dashboard/DashboardPage'),
	'DashboardPage'
);
export const DashboardListPage = lazyNamed(
	() => import('@/pages/dashboards/DashboardListPage'),
	'DashboardListPage'
);
export const CustomDashboardPage = lazyNamed(
	() => import('@/pages/dashboards/CustomDashboardPage'),
	'CustomDashboardPage'
);
export const SharedDashboardPage = lazyNamed(
	() => import('@/pages/dashboards/SharedDashboardPage'),
	'SharedDashboardPage'
);

// Feature pages
export const AssetInventoryPage = lazyNamed(
	() => import('@/pages/assets/AssetInventoryPage'),
	'AssetInventoryPage'
);
export const AssetDetailPage = lazyNamed(
	() => import('@/pages/assets/AssetDetailPage'),
	'AssetDetailPage'
);
export const RelationshipsPage = lazyNamed(
	() => import('@/pages/relationships/RelationshipsPage'),
	'RelationshipsPage'
);
export const RelationshipMapPage = lazyNamed(
	() => import('@/pages/relationships/RelationshipMapPage'),
	'RelationshipMapPage'
);
export const ImportsPage = lazyNamed(() => import('@/pages/imports/ImportsPage'), 'ImportsPage');
export const ImportDetailPage = lazyNamed(
	() => import('@/pages/imports/ImportDetailPage'),
	'ImportDetailPage'
);
export const GlobalSearchPage = lazyNamed(
	() => import('@/pages/search/GlobalSearchPage'),
	'GlobalSearchPage'
);
export const ReportsPage = lazyNamed(() => import('@/pages/reports/ReportsPage'), 'ReportsPage');
export const ManagementSummaryPage = lazyNamed(
	() => import('@/pages/reports/ManagementSummaryPage'),
	'ManagementSummaryPage'
);
export const ServiceCatalogPage = lazyNamed(
	() => import('@/pages/services/ServiceCatalogPage'),
	'ServiceCatalogPage'
);
export const ServiceDetailPage = lazyNamed(
	() => import('@/pages/services/ServiceDetailPage'),
	'ServiceDetailPage'
);
export const BusinessMetricsPage = lazyNamed(
	() => import('@/pages/analytics/BusinessMetricsPage'),
	'BusinessMetricsPage'
);
export const NotificationsPage = lazyNamed(
	() => import('@/pages/notifications/NotificationsPage'),
	'NotificationsPage'
);
export const OnboardingPage = lazyNamed(
	() => import('@/pages/onboarding/OnboardingPage'),
	'OnboardingPage'
);
export const FilesPage = lazyNamed(() => import('@/pages/files/FilesPage'), 'FilesPage');
export const WorkspaceManagementPage = lazyNamed(
	() => import('@/pages/workspaces/WorkspaceManagementPage'),
	'WorkspaceManagementPage'
);
export const WorkspaceSettingsPage = lazyNamed(
	() => import('@/pages/workspaces/WorkspaceSettingsPage'),
	'WorkspaceSettingsPage'
);

// Profile pages
export const ProfileLayout = lazyNamed(
	() => import('@/pages/profile/ProfileLayout'),
	'ProfileLayout'
);
export const PersonalInfoTab = lazyNamed(
	() => import('@/pages/profile/PersonalInfoTab'),
	'PersonalInfoTab'
);
export const PreferencesTab = lazyNamed(
	() => import('@/pages/profile/PreferencesTab'),
	'PreferencesTab'
);
export const ApiKeysTab = lazyNamed(() => import('@/pages/profile/ApiKeysTab'), 'ApiKeysTab');
export const SecurityTab = lazyNamed(() => import('@/pages/profile/SecurityTab'), 'SecurityTab');

// Settings pages
export const SettingsLayout = lazyNamed(
	() => import('@/pages/settings/SettingsLayout'),
	'SettingsLayout'
);
export const ApplicationTab = lazyNamed(
	() => import('@/pages/settings/application/ApplicationTab'),
	'ApplicationTab'
);
export const AuthenticationTab = lazyNamed(
	() => import('@/pages/settings/auth/AuthenticationTab'),
	'AuthenticationTab'
);
export const UsersTab = lazyNamed(() => import('@/pages/settings/users/UsersTab'), 'UsersTab');
export const RolesTab = lazyNamed(() => import('@/pages/settings/roles/RolesTab'), 'RolesTab');
export const AuditLogsTab = lazyNamed(
	() => import('@/pages/settings/audit/AuditLogsTab'),
	'AuditLogsTab'
);
export const EmailTab = lazyNamed(() => import('@/pages/settings/email/EmailTab'), 'EmailTab');
export const SystemHealthTab = lazyNamed(
	() => import('@/pages/settings/health/SystemHealthTab'),
	'SystemHealthTab'
);
export const ScheduledTasksTab = lazyNamed(
	() => import('@/pages/settings/scheduler/ScheduledTasksTab'),
	'ScheduledTasksTab'
);
export const NotificationSettingsTab = lazyNamed(
	() => import('@/pages/settings/notifications/NotificationSettingsTab'),
	'NotificationSettingsTab'
);
export const BackupTab = lazyNamed(() => import('@/pages/settings/backup/BackupTab'), 'BackupTab');
export const BugsTab = lazyNamed(() => import('@/pages/settings/bugs/BugsTab'), 'BugsTab');
export const DatabaseTab = lazyNamed(
	() => import('@/pages/settings/database/DatabaseTab'),
	'DatabaseTab'
);
export const RuntimeConfigTab = lazyNamed(
	() => import('@/pages/settings/runtime/RuntimeConfigTab'),
	'RuntimeConfigTab'
);
export const InfrastructureTab = lazyNamed(
	() => import('@/pages/settings/infrastructure/InfrastructureTab'),
	'InfrastructureTab'
);

// Other pages
export const NotFoundPage = lazyNamed(() => import('@/pages/errors/NotFoundPage'), 'NotFoundPage');
