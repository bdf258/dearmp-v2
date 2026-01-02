import { SyncService } from '../../application/services';
import { OfficeId } from '../../domain/value-objects';
import { SyncEntityType } from '../../domain/events';
import { PgBossClient } from '../../infrastructure/queue/PgBossClient';
import { JobNames, ScheduledPollLegacyJobData, SyncAllJobData } from '../../infrastructure/queue/types';

/**
 * Job data for sync operations
 */
export interface SyncJobData {
  officeId: string;
  entityType: SyncEntityType;
  syncType: 'full' | 'incremental';
  modifiedSince?: string;
}

export interface SyncWorkerDependencies {
  syncService: SyncService;
  pgBossClient?: PgBossClient;
}

/**
 * Worker: SyncWorker
 *
 * Handles background synchronization jobs.
 * Uses pg-boss for job scheduling and processing.
 */
export class SyncWorker {
  private readonly syncService: SyncService;
  private readonly pgBossClient?: PgBossClient;

  constructor(deps: SyncWorkerDependencies) {
    this.syncService = deps.syncService;
    this.pgBossClient = deps.pgBossClient;
  }

  /**
   * Process a sync job
   */
  async processJob(data: SyncJobData): Promise<void> {
    const officeId = OfficeId.fromTrusted(data.officeId);
    const modifiedSince = data.modifiedSince ? new Date(data.modifiedSince) : undefined;

    console.log(`[SyncWorker] Starting ${data.syncType} sync of ${data.entityType} for office ${data.officeId}`);

    try {
      switch (data.entityType) {
        case 'constituents':
          await this.syncService.syncConstituents(officeId, {
            full: data.syncType === 'full',
            modifiedSince,
          });
          break;

        case 'cases':
          await this.syncService.syncCases(officeId, {
            full: data.syncType === 'full',
            modifiedSince,
          });
          break;

        case 'emails':
          await this.syncService.syncEmails(officeId, {
            full: data.syncType === 'full',
            receivedSince: modifiedSince,
          });
          break;

        case 'caseworkers':
        case 'case_types':
        case 'status_types':
        case 'category_types':
        case 'contact_types':
          await this.syncService.syncReferenceData(officeId);
          break;

        default:
          throw new Error(`Unknown entity type: ${data.entityType}`);
      }

      console.log(`[SyncWorker] Completed sync of ${data.entityType} for office ${data.officeId}`);
    } catch (error) {
      console.error(`[SyncWorker] Failed sync of ${data.entityType} for office ${data.officeId}:`, error);
      throw error; // Re-throw to trigger retry logic
    }
  }

  /**
   * Schedule periodic sync for an office using pg-boss cron scheduling
   *
   * @param officeId - The office to schedule sync for
   * @param intervalMs - Interval in milliseconds (converted to cron expression)
   * @param options - Additional scheduling options
   */
  async schedulePeriodicSync(
    officeId: OfficeId,
    intervalMs: number,
    options?: { timezone?: string }
  ): Promise<void> {
    if (!this.pgBossClient) {
      console.warn('[SyncWorker] PgBoss client not configured, cannot schedule periodic sync');
      return;
    }

    // Convert interval to cron expression
    const cronExpression = this.intervalToCron(intervalMs);
    const tz = options?.timezone ?? 'Europe/London';

    // Schedule incremental sync job
    const syncData: SyncAllJobData = {
      type: JobNames.SYNC_ALL,
      officeId: officeId.toString(),
      mode: 'incremental',
      includeReferenceData: false,
      correlationId: `periodic-${officeId.toString()}`,
    };

    // Create a unique schedule name for this office
    const scheduleName = `${JobNames.SYNC_ALL}:${officeId.toString()}` as typeof JobNames.SYNC_ALL;

    await this.pgBossClient.schedule(scheduleName, cronExpression, syncData, { tz });

    console.log(
      `[SyncWorker] Scheduled periodic sync for office ${officeId.toString()} ` +
      `with cron "${cronExpression}" (every ${intervalMs}ms)`
    );
  }

  /**
   * Cancel periodic sync for an office
   */
  async cancelPeriodicSync(officeId: OfficeId): Promise<void> {
    if (!this.pgBossClient) {
      console.warn('[SyncWorker] PgBoss client not configured, cannot cancel periodic sync');
      return;
    }

    const scheduleName = `${JobNames.SYNC_ALL}:${officeId.toString()}` as typeof JobNames.SYNC_ALL;

    await this.pgBossClient.unschedule(scheduleName);

    console.log(`[SyncWorker] Cancelled periodic sync for office ${officeId.toString()}`);
  }

  /**
   * Schedule polling for new emails/cases from legacy system
   *
   * @param officeId - The office to poll for
   * @param pollIntervalMs - How often to poll (default: 5 minutes)
   */
  async schedulePolling(
    officeId: OfficeId,
    pollIntervalMs: number = 5 * 60 * 1000,
    options?: { timezone?: string }
  ): Promise<void> {
    if (!this.pgBossClient) {
      console.warn('[SyncWorker] PgBoss client not configured, cannot schedule polling');
      return;
    }

    const cronExpression = this.intervalToCron(pollIntervalMs);
    const tz = options?.timezone ?? 'Europe/London';

    const pollData: ScheduledPollLegacyJobData = {
      type: JobNames.SCHEDULED_POLL_LEGACY,
      officeId: officeId.toString(),
      pollType: 'all',
    };

    const scheduleName = `${JobNames.SCHEDULED_POLL_LEGACY}:${officeId.toString()}` as typeof JobNames.SCHEDULED_POLL_LEGACY;

    await this.pgBossClient.schedule(scheduleName, cronExpression, pollData, { tz });

    console.log(
      `[SyncWorker] Scheduled polling for office ${officeId.toString()} ` +
      `with cron "${cronExpression}"`
    );
  }

  /**
   * Cancel polling for an office
   */
  async cancelPolling(officeId: OfficeId): Promise<void> {
    if (!this.pgBossClient) {
      console.warn('[SyncWorker] PgBoss client not configured, cannot cancel polling');
      return;
    }

    const scheduleName = `${JobNames.SCHEDULED_POLL_LEGACY}:${officeId.toString()}` as typeof JobNames.SCHEDULED_POLL_LEGACY;

    await this.pgBossClient.unschedule(scheduleName);

    console.log(`[SyncWorker] Cancelled polling for office ${officeId.toString()}`);
  }

  /**
   * Convert millisecond interval to cron expression
   * Note: Cron has minimum granularity of 1 minute
   */
  private intervalToCron(intervalMs: number): string {
    const minutes = Math.max(1, Math.round(intervalMs / (60 * 1000)));

    if (minutes < 60) {
      // Every N minutes
      return `*/${minutes} * * * *`;
    }

    const hours = Math.round(minutes / 60);
    if (hours < 24) {
      // Every N hours
      return `0 */${hours} * * *`;
    }

    // Daily at midnight
    return '0 0 * * *';
  }
}
