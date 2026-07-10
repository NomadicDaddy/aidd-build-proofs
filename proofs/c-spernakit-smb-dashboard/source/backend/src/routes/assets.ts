import { Elysia } from 'elysia';

import { assetCoreRoutes } from './assets/core.ts';
import { assetHardwareRoutes } from './assets/hardware.ts';
import { assetMutationRoutes } from './assets/mutations.ts';
import { assetNetworkInterfaceRoutes } from './assets/networkInterfaces.ts';
import { assetPortRoutes } from './assets/ports.ts';
import { assetServiceAssignmentRoutes } from './assets/serviceAssignments.ts';
import { assetStorageRoutes } from './assets/storage.ts';

const assetRoutes = new Elysia({ name: 'asset-routes' })
	.use(assetCoreRoutes)
	.use(assetMutationRoutes)
	.use(assetHardwareRoutes)
	.use(assetNetworkInterfaceRoutes)
	.use(assetStorageRoutes)
	.use(assetServiceAssignmentRoutes)
	.use(assetPortRoutes);

export { assetRoutes };
