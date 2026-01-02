/**
 * DearMP v2 - Legacy Integration Server
 *
 * This server provides the Anti-Corruption Layer (ACL) for integrating
 * with the legacy Caseworker system. It handles:
 *
 * - Bidirectional data synchronization via pg-boss queue
 * - Email triage with LLM-assisted suggestions
 * - Rate-limited legacy API access
 * - Scheduled polling and full syncs
 *
 * Architecture: Clean Architecture with the following layers:
 * - Domain: Entities, Value Objects, Events, Interfaces
 * - Application: Services, Use Cases, DTOs
 * - Infrastructure: Repositories, API Clients, Adapters, Queue
 * - Presentation: HTTP Routes, Background Workers
 *
 * Queue System (pg-boss):
 * - Sync Jobs: Pull data from legacy to shadow DB
 * - Push Jobs: Push data from shadow DB to legacy
 * - Triage Jobs: Process emails for triage suggestions
 * - Scheduled Jobs: Recurring sync and cleanup tasks
 *
 * To start the worker: npm run worker
 * To start in dev mode: npm run worker:dev
 */

// Domain Layer - entities and interfaces
export * from './domain/entities';
export * from './domain/value-objects';
export * from './domain/events';
export * from './domain/interfaces';

// Application Layer - services and DTOs
export * from './application/dtos';
export * from './application/use-cases';
export { SyncService, type ILLMAnalysisService } from './application/services';

// Infrastructure Layer - implementations
export {
  LegacyApiClient,
  type ICredentialsRepository,
} from './infrastructure/api/LegacyApiClient';
export * from './infrastructure/repositories';
export * from './infrastructure/adapters';
export {
  PgBossClient,
  createPgBossClient,
  QueueService,
  SyncJobHandler,
  PushJobHandler,
  TriageJobHandler,
  ScheduledJobHandler,
  JobNames,
  type JobName,
  type AllJobData,
  type JobOptions,
  type SyncJobHandlerDependencies,
  type PushJobHandlerDependencies,
  type TriageJobHandlerDependencies,
  type ScheduledJobHandlerDependencies,
  type ISyncStatusRepository,
  type IAuditLogRepository,
  type ITriageCacheRepository,
  type IPollStatusRepository,
  type SyncJobData,
  type PushJobResult,
  type TriageJobResult,
} from './infrastructure/queue';
export * from './infrastructure/llm';

// Configuration
export * from './config';

// Presentation Layer (Workers)
export * from './presentation/workers';

// Presentation Layer (HTTP)
export * from './presentation/http';

/**
 * Example: Using the pg-boss queue system
 *
 * ```typescript
 * import { createClient } from '@supabase/supabase-js';
 * import {
 *   loadConfig,
 *   validateConfig,
 *   createPgBossClient,
 *   QueueService,
 *   SyncJobHandler,
 *   PushJobHandler,
 *   TriageJobHandler,
 * } from './server';
 *
 * // Load config
 * const config = loadConfig();
 * validateConfig(config);
 *
 * // Create pg-boss client
 * const pgBossClient = await createPgBossClient({ config });
 *
 * // Create queue service
 * const queueService = new QueueService({ pgBossClient });
 *
 * // Schedule a sync job
 * await queueService.scheduleSyncAll('office-uuid', {
 *   includeReferenceData: true,
 *   initiatedBy: 'admin',
 * });
 *
 * // Schedule email processing
 * await queueService.scheduleEmailProcessing('office-uuid', {
 *   emailId: 'email-uuid',
 *   emailExternalId: 12345,
 *   fromAddress: 'constituent@example.com',
 *   subject: 'Help needed',
 * });
 *
 * // Submit a triage decision
 * await queueService.submitTriageDecision(
 *   'office-uuid',
 *   'email-uuid',
 *   12345,
 *   {
 *     action: 'create_new',
 *     newConstituent: {
 *       firstName: 'John',
 *       lastName: 'Doe',
 *       email: 'john@example.com',
 *     },
 *     newCase: {
 *       caseTypeId: 1,
 *       statusId: 1,
 *       summary: 'Issue reported via email',
 *     },
 *     markActioned: true,
 *   }
 * );
 *
 * // Set up recurring schedules for an office
 * await queueService.setupOfficeSchedules('office-uuid', {
 *   pollCron: '*\/5 * * * *',     // Every 5 minutes
 *   fullSyncCron: '0 2 * * *',    // Daily at 2am
 *   timezone: 'Europe/London',
 * });
 * ```
 */

// Version info
export const VERSION = '0.1.0';
export const NAME = 'dearmp-legacy-integration';
