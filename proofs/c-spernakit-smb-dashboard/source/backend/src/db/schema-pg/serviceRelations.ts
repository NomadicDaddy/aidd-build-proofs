import { relations } from 'drizzle-orm';

import { assets } from './assets.ts';
import { owners, vendors } from './infrastructure.ts';
import { assetServices, serviceCatalog } from './serviceCatalog.ts';
import { assetPorts, serviceDependencies } from './serviceTopology.ts';

const serviceCatalogRelations = relations(serviceCatalog, ({ many, one }) => ({
	assetServices: many(assetServices),
	dependencies: many(serviceDependencies),
	owner: one(owners, { fields: [serviceCatalog.ownerId], references: [owners.id] }),
	vendor: one(vendors, { fields: [serviceCatalog.vendorId], references: [vendors.id] }),
}));

const assetServicesRelations = relations(assetServices, ({ one }) => ({
	asset: one(assets, { fields: [assetServices.assetId], references: [assets.id] }),
	service: one(serviceCatalog, {
		fields: [assetServices.serviceId],
		references: [serviceCatalog.id],
	}),
}));

const serviceDependenciesRelations = relations(serviceDependencies, ({ one }) => ({
	dependsOnAsset: one(assets, {
		fields: [serviceDependencies.dependsOnAssetId],
		references: [assets.id],
	}),
	dependsOnService: one(serviceCatalog, {
		fields: [serviceDependencies.dependsOnServiceId],
		references: [serviceCatalog.id],
		relationName: 'dependsOnService',
	}),
	service: one(serviceCatalog, {
		fields: [serviceDependencies.serviceId],
		references: [serviceCatalog.id],
		relationName: 'dependentService',
	}),
}));

const assetPortsRelations = relations(assetPorts, ({ one }) => ({
	asset: one(assets, { fields: [assetPorts.assetId], references: [assets.id] }),
	service: one(serviceCatalog, {
		fields: [assetPorts.serviceId],
		references: [serviceCatalog.id],
	}),
}));

export {
	assetPortsRelations,
	assetServicesRelations,
	serviceCatalogRelations,
	serviceDependenciesRelations,
};
