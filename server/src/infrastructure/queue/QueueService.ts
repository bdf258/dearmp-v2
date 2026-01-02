/**
 * Queue Service
 *
 * High-level service for managing sync and triage jobs.
 * Provides typed methods for common job operations.
 */

import { PgBossClient } from './PgBossClient';
import {
  JobNames,
  JobName,
  SyncConstituentsJobData,
  SyncCasesJobData,
  SyncEmailsJobData,
  SyncReferenceDataJobData,
  SyncAllJobData,
  PushConstituentJobData,
  PushCaseJobData,
  PushEmailJobData,
  TriageProcessEmailJobData,
  TriageSubmitDecisionJobData,
  TriageBatchPrefetchJobData,
  ScheduledPollLegacyJobData,
  ScheduledSyncOfficeJobData,
  JobOptions,
} from './types';

export interface QueueServiceDependencies {
  pgBossClient: PgBossClient;
}

/**
 * Service for scheduling and managing queue jobs
 */
export class QueueService {
  private readonly client: PgBossClient;

  constructor({ pgBossClient }: QueueServiceDependencies) {
    this.client = pgBossClient;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SYNC JOBS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Schedule a full sync for all entity types
   */
  async scheduleSyncAll(
    officeId: string,
    options?: { includeReferenceData?: boolean; initiatedBy?: string }
  ): Promise<string | null> {
    const data: SyncAllJobData = {
      type: JobNames.SYNC_ALL,
      officeId,
      mode: 'full',
      includeReferenceData: options?.includeReferenceData ?? true,
      initiatedBy: options?.initiatedBy,
      correlationId: crypto.randomUUID(),
    };

    return this.client.sendSyncJob(JobNames.SYNC_ALL, data);
  }

  /**
   * Schedule an incremental sync for all entity types
   */
  async scheduleIncrementalSync(
    officeId: string,
    options?: { initiatedBy?: string }
  ): Promise<string | null> {
    const data: SyncAllJobData = {
      type: JobNames.SYNC_ALL,
      officeId,
      mode: 'incremental',
      includeReferenceData: false,
      initiatedBy: options?.initiatedBy,
      correlationId: crypto.randomUUID(),
    };

    return this.client.sendSyncJob(JobNames.SYNC_ALL, data);
  }

  /**
   * Schedule a constituent sync
   */
  async scheduleSyncConstituents(
    officeId: string,
    options?: {
      mode?: 'full' | 'incremental';
      modifiedSince?: Date;
      initiatedBy?: string;
    }
  ): Promise<string | null> {
    const data: SyncConstituentsJobData = {
      type: JobNames.SYNC_CONSTITUENTS,
      officeId,
      mode: options?.mode ?? 'incremental',
      modifiedSince: options?.modifiedSince?.toISOString(),
      initiatedBy: options?.initiatedBy,
      correlationId: crypto.randomUUID(),
    };

    return this.client.sendSyncJob(JobNames.SYNC_CONSTITUENTS, data);
  }

  /**
   * Schedule a case sync
   */
  async scheduleSyncCases(
    officeId: string,
    options?: {
      mode?: 'full' | 'incremental';
      modifiedSince?: Date;
      initiatedBy?: string;
    }
  ): Promise<string | null> {
    const data: SyncCasesJobData = {
      type: JobNames.SYNC_CASES,
      officeId,
      mode: options?.mode ?? 'incremental',
      modifiedSince: options?.modifiedSince?.toISOString(),
      initiatedBy: options?.initiatedBy,
      correlationId: crypto.randomUUID(),
    };

    return this.client.sendSyncJob(JobNames.SYNC_CASES, data);
  }

  /**
   * Schedule an email sync
   */
  async scheduleSyncEmails(
    officeId: string,
    options?: {
      mode?: 'full' | 'incremental';
      modifiedSince?: Date;
      emailType?: 'received' | 'sent' | 'draft';
      actionedOnly?: boolean;
      initiatedBy?: string;
    }
  ): Promise<string | null> {
    const data: SyncEmailsJobData = {
      type: JobNames.SYNC_EMAILS,
      officeId,
      mode: options?.mode ?? 'incremental',
      modifiedSince: options?.modifiedSince?.toISOString(),
      emailType: options?.emailType,
      actionedOnly: options?.actionedOnly,
      initiatedBy: options?.initiatedBy,
      correlationId: crypto.randomUUID(),
    };

    return this.client.sendSyncJob(JobNames.SYNC_EMAILS, data);
  }

  /**
   * Schedule a reference data sync
   */
  async scheduleSyncReferenceData(
    officeId: string,
    options?: {
      entities?: Array<'caseTypes' | 'statusTypes' | 'categoryTypes' | 'contactTypes' | 'caseworkers'>;
      initiatedBy?: string;
    }
  ): Promise<string | null> {
    const data: SyncReferenceDataJobData = {
      type: JobNames.SYNC_REFERENCE_DATA,
      officeId,
      entities: options?.entities,
      initiatedBy: options?.initiatedBy,
      correlationId: crypto.randomUUID(),
    };

    return this.client.sendSyncJob(JobNames.SYNC_REFERENCE_DATA, data);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUSH JOBS (Shadow DB -> Legacy)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Push a constituent to the legacy system
   */
  async pushConstituent(
    officeId: string,
    constituentId: string,
    operation: 'create' | 'update',
    data: PushConstituentJobData['data'],
    options?: JobOptions
  ): Promise<string | null> {
    const jobData: PushConstituentJobData = {
      type: JobNames.PUSH_CONSTITUENT,
      officeId,
      constituentId,
      operation,
      data,
      correlationId: crypto.randomUUID(),
    };

    return this.client.send(JobNames.PUSH_CONSTITUENT, jobData, options);
  }

  /**
   * Push a case to the legacy system
   */
  async pushCase(
    officeId: string,
    caseId: string,
    operation: 'create' | 'update',
    data: PushCaseJobData['data'],
    options?: JobOptions
  ): Promise<string | null> {
    const jobData: PushCaseJobData = {
      type: JobNames.PUSH_CASE,
      officeId,
      caseId,
      operation,
      data,
      correlationId: crypto.randomUUID(),
    };

    return this.client.send(JobNames.PUSH_CASE, jobData, options);
  }

  /**
   * Push an email action to the legacy system
   */
  async pushEmail(
    officeId: string,
    emailId: string,
    operation: 'create' | 'update' | 'send',
    data: PushEmailJobData['data'],
    options?: JobOptions
  ): Promise<string | null> {
    const jobData: PushEmailJobData = {
      type: JobNames.PUSH_EMAIL,
      officeId,
      emailId,
      operation,
      data,
      correlationId: crypto.randomUUID(),
    };

    return this.client.send(JobNames.PUSH_EMAIL, jobData, options);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TRIAGE JOBS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Schedule processing for a single email
   */
  async scheduleEmailProcessing(
    officeId: string,
    email: {
      emailId: string;
      emailExternalId: number;
      fromAddress: string;
      subject?: string;
      isTestEmail?: boolean;
    }
  ): Promise<string | null> {
    const data: TriageProcessEmailJobData = {
      type: JobNames.TRIAGE_PROCESS_EMAIL,
      officeId,
      emailId: email.emailId,
      emailExternalId: email.emailExternalId,
      fromAddress: email.fromAddress,
      subject: email.subject,
      isTestEmail: email.isTestEmail,
      correlationId: crypto.randomUUID(),
    };

    return this.client.send(JobNames.TRIAGE_PROCESS_EMAIL, data);
  }

  /**
   * Schedule batch email prefetching
   */
  async scheduleBatchPrefetch(
    officeId: string,
    emailIds: string[],
    prefetchAhead: number = 3
  ): Promise<string | null> {
    const data: TriageBatchPrefetchJobData = {
      type: JobNames.TRIAGE_BATCH_PREFETCH,
      officeId,
      emailIds,
      prefetchAhead,
      correlationId: crypto.randomUUID(),
    };

    return this.client.send(JobNames.TRIAGE_BATCH_PREFETCH, data);
  }

  /**
   * Submit a triage decision
   */
  async submitTriageDecision(
    officeId: string,
    emailId: string,
    emailExternalId: number,
    decision: TriageSubmitDecisionJobData['decision']
  ): Promise<string | null> {
    const data: TriageSubmitDecisionJobData = {
      type: JobNames.TRIAGE_SUBMIT_DECISION,
      officeId,
      emailId,
      emailExternalId,
      decision,
      correlationId: crypto.randomUUID(),
    };

    return this.client.send(JobNames.TRIAGE_SUBMIT_DECISION, data, {
      priority: 10, // High priority for user-initiated actions
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SCHEDULED JOBS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Set up recurring sync schedules for an office
   */
  async setupOfficeSchedules(
    officeId: string,
    options?: {
      pollCron?: string; // Default: every 5 minutes
      fullSyncCron?: string; // Default: daily at 2am
      timezone?: string;
    }
  ): Promise<void> {
    const tz = options?.timezone ?? 'Europe/London';

    // Schedule recurring poll (every 5 minutes by default)
    const pollData: ScheduledPollLegacyJobData = {
      type: JobNames.SCHEDULED_POLL_LEGACY,
      officeId,
      pollType: 'all',
    };
    await this.client.schedule(
      JobNames.SCHEDULED_POLL_LEGACY,
      options?.pollCron ?? '*/5 * * * *',
      pollData,
      { tz }
    );

    // Schedule daily full sync (2am by default)
    const syncData: ScheduledSyncOfficeJobData = {
      type: JobNames.SCHEDULED_SYNC_OFFICE,
      officeId,
      syncEntities: ['referenceData', 'constituents', 'cases', 'emails'],
    };
    await this.client.schedule(
      JobNames.SCHEDULED_SYNC_OFFICE,
      options?.fullSyncCron ?? '0 2 * * *',
      syncData,
      { tz }
    );

    console.log(`[QueueService] Set up schedules for office: ${officeId}`);
  }

  /**
   * Remove all schedules for an office
   */
  async removeOfficeSchedules(): Promise<void> {
    await this.client.unschedule(JobNames.SCHEDULED_POLL_LEGACY);
    await this.client.unschedule(JobNames.SCHEDULED_SYNC_OFFICE);
    console.log('[QueueService] Removed office schedules');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // QUEUE MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get the size of a specific queue
   */
  async getQueueSize(jobName: keyof typeof JobNames): Promise<number> {
    return this.client.getQueueSize(JobNames[jobName]);
  }

  /**
   * Get sizes for all queues
   */
  async getAllQueueSizes(): Promise<Record<string, number>> {
    const sizes: Record<string, number> = {};
    for (const [key, name] of Object.entries(JobNames)) {
      sizes[key] = await this.client.getQueueSize(name);
    }
    return sizes;
  }

  /**
   * Cancel a specific job
   */
  async cancelJob(jobName: JobName, jobId: string): Promise<void> {
    await this.client.cancel(jobName, jobId);
  }

  /**
   * Get job details
   */
  async getJob(jobName: JobName, jobId: string) {
    return this.client.getJobById(jobName, jobId);
  }

  /**
   * Purge completed jobs from a queue
   */
  async purgeQueue(jobName: keyof typeof JobNames): Promise<void> {
    await this.client.purgeQueue(JobNames[jobName]);
  }

  /**
   * Check if the queue service is healthy
   */
  async healthCheck(): Promise<{ healthy: boolean; error?: string }> {
    try {
      if (!this.client.isRunning()) {
        return { healthy: false, error: 'PgBoss client not running' };
      }
      // Try to get a queue size as a simple health check
      await this.client.getQueueSize(JobNames.SYNC_ALL);
      return { healthy: true };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
