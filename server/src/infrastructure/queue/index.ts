/**
 * Queue Infrastructure Index
 *
 * Exports the pg-boss queue system components for managing
 * synchronization between the new and legacy databases.
 */

// Types
export * from './types';

// Client
export { PgBossClient, createPgBossClient, type PgBossClientOptions } from './PgBossClient';

// Service
export { QueueService, type QueueServiceDependencies } from './QueueService';

// Handlers
export * from './handlers';
