/**
 * Service catalog schema barrel.
 *
 * The service catalog, its asset assignments, dependency edges, and asset ports
 * are defined across cohesive submodules to keep each file within the modularity
 * cap. Tables live in `serviceCatalog.ts` (catalog + asset assignments) and
 * `serviceTopology.ts` (dependency edges + asset ports); Drizzle relations live in
 * `serviceRelations.ts`. This barrel preserves the original public import surface.
 */
export { assetServices, serviceCatalog } from './serviceCatalog.ts';
export {
	assetPortsRelations,
	assetServicesRelations,
	serviceCatalogRelations,
	serviceDependenciesRelations,
} from './serviceRelations.ts';
export { assetPorts, serviceDependencies } from './serviceTopology.ts';
