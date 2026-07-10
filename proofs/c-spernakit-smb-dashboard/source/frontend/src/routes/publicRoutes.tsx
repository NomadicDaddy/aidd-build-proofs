import type { RouteObject } from 'react-router-dom';

import { LazyPage } from '@/routes/LazyPage';
import {
	ConfirmEmailChangePage,
	ForcePasswordChangePage,
	LoginPage,
	MfaVerifyPage,
	OAuthCallbackPage,
	RegisterPage,
	ResetPasswordConfirmPage,
	ResetPasswordPage,
	SharedDashboardPage,
	VerifyEmailPage,
} from '@/routes/lazyPages';

/** Public routes reachable without authentication (auth flows + shared dashboards). */
const publicRoutes: RouteObject[] = [
	{
		element: <LazyPage Component={LoginPage} />,
		path: '/login',
	},
	{
		element: <LazyPage Component={RegisterPage} />,
		path: '/register',
	},
	{
		element: <LazyPage Component={ForcePasswordChangePage} />,
		path: '/change-password',
	},
	{
		element: <LazyPage Component={ResetPasswordPage} />,
		path: '/forgot-password',
	},
	{
		element: <LazyPage Component={ResetPasswordConfirmPage} />,
		path: '/reset-password',
	},
	{
		element: <LazyPage Component={OAuthCallbackPage} />,
		path: '/auth/callback',
	},
	{
		element: <LazyPage Component={VerifyEmailPage} />,
		path: '/verify-email',
	},
	{
		element: <LazyPage Component={ConfirmEmailChangePage} />,
		path: '/confirm-email-change',
	},
	{
		element: <LazyPage Component={MfaVerifyPage} />,
		path: '/mfa-verify',
	},
	{
		element: <LazyPage Component={SharedDashboardPage} />,
		path: '/dashboards/shared/:token',
	},
];

export { publicRoutes };
