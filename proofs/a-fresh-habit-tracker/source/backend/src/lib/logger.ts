/**
 * Shared pino logger for the backend. A single instance is created and reused
 * across the app so request logging, bootstrap logging, and service logging all
 * share the same output stream and formatting.
 */
import { pino } from 'pino';

export const logger = pino({
	base: { app: 'habit-tracker-backend' },
	level: 'info',
});

export type Logger = typeof logger;
