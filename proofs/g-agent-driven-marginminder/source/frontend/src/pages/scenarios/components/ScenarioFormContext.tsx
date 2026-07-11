import { createContext, use } from 'react';

import type { ScenarioFormActions } from './useScenarioFormActions';

export type ScenarioFormContextValue = ScenarioFormActions;

export const ScenarioFormContext = createContext<null | ScenarioFormContextValue>(null);

export function useScenarioForm(): ScenarioFormContextValue {
	const context = use(ScenarioFormContext);
	if (!context) {
		throw new Error('useScenarioForm must be used within a ScenarioFormContext.Provider');
	}
	return context;
}
