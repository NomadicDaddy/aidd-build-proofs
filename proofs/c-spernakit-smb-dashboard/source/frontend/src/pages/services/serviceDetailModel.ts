import type { ServiceDependency } from '@/api/services';

/** Human-readable summary of a dependency's target (service or asset). */
export function dependencyTargetLabel(dep: ServiceDependency): string {
	if (dep.dependsOnServiceId !== null) {
		return dep.dependsOnServiceName ?? `Service #${dep.dependsOnServiceId}`;
	}
	if (dep.dependsOnAssetId !== null) {
		return dep.dependsOnAssetName ?? `Asset #${dep.dependsOnAssetId}`;
	}
	return 'Unknown';
}
