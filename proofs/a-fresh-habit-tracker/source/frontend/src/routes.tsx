import { createBrowserRouter } from 'react-router-dom';

import { RootLayout } from '@/components/layout/RootLayout';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { HabitDetailPage } from '@/pages/habits/HabitDetailPage';
import { HabitsPage } from '@/pages/habits/HabitsPage';
import { NotFoundPage } from '@/pages/not-found/NotFoundPage';

export const router = createBrowserRouter([
	{
		children: [
			{ element: <DashboardPage />, index: true },
			{ element: <HabitsPage />, path: 'habits' },
			{ element: <HabitDetailPage />, path: 'habits/:habitId' },
			{ element: <NotFoundPage />, path: '*' },
		],
		element: <RootLayout />,
		path: '/',
	},
]);
