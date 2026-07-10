import { Elysia } from 'elysia';

import { serviceReadRoutes } from './services/read.ts';
import { serviceWriteRoutes } from './services/write.ts';

const serviceRoutes = new Elysia({ name: 'service-routes' })
	.use(serviceReadRoutes)
	.use(serviceWriteRoutes);

export { serviceRoutes };
