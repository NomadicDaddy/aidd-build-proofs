import type { LoginRequest, LoginResult, UserData } from '@/api/auth';

import { getMe, login as apiLogin, logout as apiLogout } from '@/api/auth';
import { trackEvent } from '@/api/businessMetrics';
import { useAuthStore } from '@/stores/authStore';

/**
 * Hook providing auth state and login/logout actions.
 * Wraps the authStore and API calls together.
 */
function useAuth() {
	const user = useAuthStore((s) => s.user);
	const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
	const setUser = useAuthStore((s) => s.setUser);
	const clearUser = useAuthStore((s) => s.logout);

	const login = async (data: LoginRequest): Promise<LoginResult> => {
		const result = await apiLogin(data);
		if (result.kind === 'success') {
			setUser(result.user);
			trackEvent({ eventCategory: 'user_action', eventName: 'login' }).catch(() => {});
		}
		return result;
	};

	const completeMfaLogin = (userData: UserData): void => {
		setUser(userData);
		trackEvent({ eventCategory: 'user_action', eventName: 'login' }).catch(() => {});
	};

	const logout = async (): Promise<void> => {
		await Promise.allSettled([
			trackEvent({ eventCategory: 'user_action', eventName: 'logout' }),
			apiLogout(),
		]);
		clearUser();
	};

	const checkSession = async (): Promise<boolean> => {
		const me = await getMe();
		if (me) {
			setUser(me);
			return true;
		}
		clearUser();
		return false;
	};

	return { checkSession, completeMfaLogin, isAuthenticated, login, logout, user } as const;
}

export { useAuth };
