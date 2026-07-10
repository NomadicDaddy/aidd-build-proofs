import type { RouteObject } from 'react-router-dom';

import { Navigate } from 'react-router-dom';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { LazyPage } from '@/routes/LazyPage';
import {
	ApplicationTab,
	AuditLogsTab,
	AuthenticationTab,
	BackupTab,
	BugsTab,
	DatabaseTab,
	EmailTab,
	InfrastructureTab,
	NotificationSettingsTab,
	RolesTab,
	RuntimeConfigTab,
	ScheduledTasksTab,
	SettingsLayout,
	SystemHealthTab,
	UsersTab,
} from '@/routes/lazyPages';

/** The `/settings` admin route: the SettingsLayout shell and all its tab children. */
const settingsRoute: RouteObject = {
	children: [
		{
			children: [
				{
					element: <Navigate replace to="/settings/application" />,
					index: true,
				},
				{
					element: <LazyPage Component={ApplicationTab} />,
					path: 'application',
				},
				{
					children: [
						{
							element: <LazyPage Component={AuthenticationTab} />,
							index: true,
						},
					],
					element: <ProtectedRoute requiredRole="SYSOP" />,
					path: 'authentication',
				},
				{
					element: <LazyPage Component={UsersTab} />,
					path: 'users',
				},
				{
					element: <LazyPage Component={RolesTab} />,
					path: 'roles',
				},
				{
					element: <LazyPage Component={NotificationSettingsTab} />,
					path: 'notifications',
				},
				{
					element: <LazyPage Component={InfrastructureTab} />,
					path: 'infrastructure',
				},
				{
					children: [
						{
							element: <LazyPage Component={EmailTab} />,
							index: true,
						},
					],
					element: <ProtectedRoute requiredRole="SYSOP" />,
					path: 'email',
				},
				{
					element: <LazyPage Component={SystemHealthTab} />,
					path: 'system-health',
				},
				{
					element: <LazyPage Component={ScheduledTasksTab} />,
					path: 'scheduled-tasks',
				},
				{
					element: <LazyPage Component={AuditLogsTab} />,
					path: 'audit-logs',
				},
				{
					children: [
						{
							element: <LazyPage Component={BackupTab} />,
							index: true,
						},
					],
					element: <ProtectedRoute requiredRole="SYSOP" />,
					path: 'backup',
				},
				{
					children: [
						{
							element: <LazyPage Component={DatabaseTab} />,
							index: true,
						},
					],
					element: <ProtectedRoute requiredRole="SYSOP" />,
					path: 'database',
				},
				{
					children: [
						{
							element: <LazyPage Component={RuntimeConfigTab} />,
							index: true,
						},
					],
					element: <ProtectedRoute requiredRole="SYSOP" />,
					path: 'runtime-config',
				},
				{
					element: <LazyPage Component={BugsTab} />,
					path: 'bugs',
				},
			],
			element: <LazyPage Component={SettingsLayout} />,
		},
	],
	element: <ProtectedRoute requiredRole="ADMIN" />,
	path: '/settings',
};

export { settingsRoute };
