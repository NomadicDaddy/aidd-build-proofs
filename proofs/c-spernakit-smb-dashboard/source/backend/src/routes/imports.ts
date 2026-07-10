import { Elysia } from 'elysia';

import { importReadRoutes } from './imports/read.ts';
import { importWriteRoutes } from './imports/write.ts';

/**
 * Staged CSV asset import routes. An operator uploads a CSV, the server parses,
 * validates, and duplicate-checks every row into a `reviewing` batch, the
 * operator accepts/rejects individual rows, then applies the batch — creating or
 * updating assets and recording an `import` audit event for each applied row.
 * Reads are VIEWER+; all write actions are OPERATOR+.
 */
const importRoutes = new Elysia({ name: 'import-routes' })
	.use(importReadRoutes)
	.use(importWriteRoutes);

export { importRoutes };
