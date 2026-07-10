import type { SeedDb } from './types.ts';

import { logDatabase } from '../../utils/logger.ts';
import { owners, sites } from '../schema/infrastructure.ts';
import { serviceCatalog } from '../schema/services.ts';

/**
 * Seed baseline reference data for the SMB infrastructure domain: a couple of
 * sites, a starter set of owners, and a neutral starter service catalog. Runs
 * once on a fresh database and is idempotent — each table is only populated when
 * it is empty, so re-running never duplicates rows.
 *
 * @param db - SQLite Drizzle handle (synchronous methods)
 * @param actorId - user id recorded as createdBy/updatedBy (typically sysop)
 */
function seedDomainReferenceData(db: SeedDb, actorId: number): void {
	const existingSites = db.select().from(sites).limit(1).all();
	if (existingSites.length === 0) {
		db.insert(sites)
			.values([
				{
					code: 'HQ',
					createdBy: actorId,
					description: 'Primary office location',
					name: 'Headquarters',
					updatedBy: actorId,
				},
				{
					code: 'DC1',
					createdBy: actorId,
					description: 'Primary on-premises data center / server room',
					name: 'Primary Data Center',
					updatedBy: actorId,
				},
			])
			.run();
		logDatabase('info', 'Seeded starter sites');
	}

	const existingOwners = db.select().from(owners).limit(1).all();
	if (existingOwners.length === 0) {
		db.insert(owners)
			.values([
				{
					createdBy: actorId,
					kind: 'team',
					name: 'IT Operations',
					notes: 'Default technical owner for infrastructure assets',
					updatedBy: actorId,
				},
				{
					createdBy: actorId,
					kind: 'team',
					name: 'Management',
					notes: 'Default business owner for critical services',
					updatedBy: actorId,
				},
			])
			.run();
		logDatabase('info', 'Seeded starter owners');
	}

	const existingServices = db.select().from(serviceCatalog).limit(1).all();
	if (existingServices.length === 0) {
		db.insert(serviceCatalog)
			.values([
				{
					category: 'directory',
					createdBy: actorId,
					criticality: 'critical',
					description: 'Active Directory / identity and authentication',
					name: 'Active Directory',
					updatedBy: actorId,
				},
				{
					category: 'networking',
					createdBy: actorId,
					criticality: 'critical',
					description: 'DNS name resolution',
					name: 'DNS',
					updatedBy: actorId,
				},
				{
					category: 'networking',
					createdBy: actorId,
					criticality: 'high',
					description: 'DHCP address assignment',
					name: 'DHCP',
					updatedBy: actorId,
				},
				{
					category: 'storage',
					createdBy: actorId,
					criticality: 'high',
					description: 'Shared file storage',
					name: 'File Sharing',
					updatedBy: actorId,
				},
				{
					category: 'data-protection',
					createdBy: actorId,
					criticality: 'high',
					description: 'Backup and recovery',
					name: 'Backup',
					updatedBy: actorId,
				},
				{
					category: 'connectivity',
					createdBy: actorId,
					criticality: 'high',
					description: 'Remote access VPN',
					name: 'VPN',
					updatedBy: actorId,
				},
				{
					category: 'data',
					createdBy: actorId,
					criticality: 'high',
					description: 'Relational database service',
					name: 'Database',
					updatedBy: actorId,
				},
			])
			.run();
		logDatabase('info', 'Seeded starter service catalog');
	}
}

export { seedDomainReferenceData };
