/**
 * Scheduled Job Handlers
 *
 * Handles recurring scheduled jobs for:
 * - Polling the legacy system for new data
 * - Running periodic full syncs
 * - Cleanup of old data
 */

import PgBoss from 'pg-boss';
import { OfficeId } from '../../../domain/value-objects';
import { ILegacyApiClient, IReferenceDataRepository } from '../../../domain/interfaces';
import { IEmailRepository, IConstituentRepository, ICaseRepository } from '../../../domain/interfaces';
import {
  JobNames,
  ScheduledPollLegacyJobData,
  ScheduledSyncOfficeJobData,
  ScheduledCleanupJobData,
  ScheduledJobResult,
} from '../types';
import { PgBossClient } from '../PgBossClient';
import { QueueService } from '../QueueService';

export interface ScheduledJobHandlerDependencies {
  pgBossClient: PgBossClient;
  queueService: QueueService;
  legacyApiClient: ILegacyApiClient;
  emailRepository: IEmailRepository;
  constituentRepository: IConstituentRepository;
  caseRepository: ICaseRepository;
  referenceDataRepository: IReferenceDataRepository;
  pollStatusRepository: IPollStatusRepository;
  syncStatusRepository: ISyncStatusRepository;
}

export interface IPollStatusRepository {
  getLastPollTime(officeId: OfficeId, pollType: string): Promise<Date | null>;
  updateLastPollTime(officeId: OfficeId, pollType: string, pollTime: Date): Promise<void>;
}

export interface ISyncStatusRepository {
  deleteOldSyncStatuses(officeId: OfficeId, olderThan: Date): Promise<number>;
  getActiveOffices(): Promise<OfficeId[]>;
}

/**
 * Handler for scheduled recurring jobs
 */
export class ScheduledJobHandler {
  private readonly client: PgBossClient;
  private readonly queueService: QueueService;
  private readonly legacyApi: ILegacyApiClient;
  private readonly emailRepo: IEmailRepository;
  private readonly constituentRepo: IConstituentRepository;
  private readonly caseRepo: ICaseRepository;
  private readonly referenceDataRepo: IReferenceDataRepository;
  private readonly pollStatus: IPollStatusRepository;
  private readonly syncStatus: ISyncStatusRepository;

  constructor(deps: ScheduledJobHandlerDependencies) {
    this.client = deps.pgBossClient;
    this.queueService = deps.queueService;
    this.legacyApi = deps.legacyApiClient;
    this.emailRepo = deps.emailRepository;
    this.constituentRepo = deps.constituentRepository;
    this.caseRepo = deps.caseRepository;
    this.referenceDataRepo = deps.referenceDataRepository;
    this.pollStatus = deps.pollStatusRepository;
    this.syncStatus = deps.syncStatusRepository;
  }

  /**
   * Register all scheduled job handlers
   */
  async register(): Promise<void> {
    await this.client.work<ScheduledPollLegacyJobData>(
      JobNames.SCHEDULED_POLL_LEGACY,
      this.handlePollLegacy.bind(this),
      { teamSize: 1, teamConcurrency: 1 }
    );

    await this.client.work<ScheduledSyncOfficeJobData>(
      JobNames.SCHEDULED_SYNC_OFFICE,
      this.handleSyncOffice.bind(this),
      { teamSize: 1, teamConcurrency: 1 }
    );

    await this.client.work<ScheduledCleanupJobData>(
      JobNames.SCHEDULED_CLEANUP,
      this.handleCleanup.bind(this),
      { teamSize: 1, teamConcurrency: 1 }
    );

    console.log('[ScheduledJobHandler] Registered all scheduled job handlers');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // POLL LEGACY
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Poll the legacy system for new data
   */
  private async handlePollLegacy(
    job: PgBoss.Job<ScheduledPollLegacyJobData>
  ): Promise<void> {
    const { officeId, pollType, lastPollAt } = job.data;
    const startTime = Date.now();
    const office = OfficeId.create(officeId);

    console.log(`[PollLegacy] Starting ${pollType} poll for office: ${officeId}`);

    const result: ScheduledJobResult = {
      success: false,
      jobType: 'poll_legacy',
      itemsProcessed: 0,
      durationMs: 0,
    };

    try {
      // Get last poll time
      const lastPoll = lastPollAt
        ? new Date(lastPollAt)
        : await this.pollStatus.getLastPollTime(office, pollType);

      const pollSince = lastPoll ?? new Date(Date.now() - 24 * 60 * 60 * 1000); // Default to 24h ago

      if (pollType === 'emails' || pollType === 'all') {
        result.itemsProcessed += await this.pollNewEmails(office, pollSince);
      }

      if (pollType === 'cases' || pollType === 'all') {
        result.itemsProcessed += await this.pollModifiedCases(office, pollSince);
      }

      if (pollType === 'constituents' || pollType === 'all') {
        result.itemsProcessed += await this.pollModifiedConstituents(office, pollSince);
      }

      // Update poll status
      const now = new Date();
      await this.pollStatus.updateLastPollTime(office, pollType, now);

      result.success = true;
      result.nextRunAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes
      result.durationMs = Date.now() - startTime;

      console.log(
        `[PollLegacy] Completed: ${result.itemsProcessed} items found in ${result.durationMs}ms`
      );
    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown error';
      result.durationMs = Date.now() - startTime;

      console.error(`[PollLegacy] Failed:`, error);
      throw error;
    }
  }

  /**
   * Poll for new unactioned emails
   */
  private async pollNewEmails(office: OfficeId, since: Date): Promise<number> {
    const emails = await this.legacyApi.searchInbox(office, {
      actioned: false,
      type: 'received',
      dateFrom: since,
      limit: 100,
    });

    console.log(`[PollLegacy] Found ${emails.data.length} new emails`);

    // Schedule triage processing for each new email
    for (const email of emails.data) {
      // Check if we already have this email
      const exists = await this.emailRepo.findByExternalId(
        office,
        { toNumber: () => email.id } as any
      );

      if (!exists) {
        await this.queueService.scheduleEmailProcessing(office.toString(), {
          emailId: crypto.randomUUID(), // Will be created during sync
          emailExternalId: email.id,
          fromAddress: email.from ?? '',
          subject: email.subject,
        });
      }
    }

    // Also trigger a sync to get full email data
    if (emails.data.length > 0) {
      await this.queueService.scheduleSyncEmails(office.toString(), {
        mode: 'incremental',
        modifiedSince: since,
      });
    }

    return emails.data.length;
  }

  /**
   * Poll for modified cases
   */
  private async pollModifiedCases(office: OfficeId, since: Date): Promise<number> {
    const cases = await this.legacyApi.searchCases(office, {
      dateRange: {
        type: 'modified',
        from: since,
        to: new Date(),
      },
      resultsPerPage: 100,
    });

    console.log(`[PollLegacy] Found ${cases.data.length} modified cases`);

    if (cases.data.length > 0) {
      await this.queueService.scheduleSyncCases(office.toString(), {
        mode: 'incremental',
        modifiedSince: since,
      });
    }

    return cases.data.length;
  }

  /**
   * Poll for modified constituents
   */
  private async pollModifiedConstituents(office: OfficeId, since: Date): Promise<number> {
    const constituents = await this.legacyApi.searchConstituents(office, {
      modifiedAfter: since,
      limit: 100,
    });

    console.log(`[PollLegacy] Found ${constituents.data.length} modified constituents`);

    if (constituents.data.length > 0) {
      await this.queueService.scheduleSyncConstituents(office.toString(), {
        mode: 'incremental',
        modifiedSince: since,
      });
    }

    return constituents.data.length;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SYNC OFFICE
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Run a full sync for an office (typically scheduled for off-peak hours)
   */
  private async handleSyncOffice(
    job: PgBoss.Job<ScheduledSyncOfficeJobData>
  ): Promise<void> {
    const { officeId, syncEntities } = job.data;
    const startTime = Date.now();

    console.log(
      `[SyncOffice] Starting scheduled sync for office: ${officeId}, ` +
        `entities: ${syncEntities.join(', ')}`
    );

    const result: ScheduledJobResult = {
      success: false,
      jobType: 'sync_office',
      itemsProcessed: 0,
      durationMs: 0,
    };

    try {
      // Schedule sync jobs for each entity type
      for (const entity of syncEntities) {
        switch (entity) {
          case 'referenceData':
            await this.queueService.scheduleSyncReferenceData(officeId);
            break;
          case 'constituents':
            await this.queueService.scheduleSyncConstituents(officeId, { mode: 'full' });
            break;
          case 'cases':
            await this.queueService.scheduleSyncCases(officeId, { mode: 'full' });
            break;
          case 'emails':
            await this.queueService.scheduleSyncEmails(officeId, { mode: 'incremental' });
            break;
        }
        result.itemsProcessed++;
      }

      result.success = true;
      result.nextRunAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // Next day
      result.durationMs = Date.now() - startTime;

      console.log(
        `[SyncOffice] Scheduled ${result.itemsProcessed} sync jobs in ${result.durationMs}ms`
      );
    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown error';
      result.durationMs = Date.now() - startTime;

      console.error(`[SyncOffice] Failed:`, error);
      throw error;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CLEANUP
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Clean up old data and jobs
   */
  private async handleCleanup(
    job: PgBoss.Job<ScheduledCleanupJobData>
  ): Promise<void> {
    const { officeId, cleanupType, olderThanDays = 30 } = job.data;
    const startTime = Date.now();

    console.log(
      `[Cleanup] Starting ${cleanupType} cleanup for office: ${officeId}, ` +
        `older than ${olderThanDays} days`
    );

    const result: ScheduledJobResult = {
      success: false,
      jobType: 'cleanup',
      itemsProcessed: 0,
      durationMs: 0,
    };

    try {
      const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
      const office = OfficeId.create(officeId);

      switch (cleanupType) {
        case 'old_jobs':
          // pg-boss handles this automatically via deleteAfterDays config
          console.log('[Cleanup] Job cleanup handled by pg-boss automatically');
          break;

        case 'stale_syncs':
          // Clean up sync status entries older than cutoff
          const deletedSyncStatuses = await this.syncStatus.deleteOldSyncStatuses(office, cutoffDate);
          result.itemsProcessed += deletedSyncStatuses;
          console.log(`[Cleanup] Deleted ${deletedSyncStatuses} stale sync status entries`);
          break;

        case 'orphaned_records':
          // Clean up stale reference data (records not synced recently)
          const deletedRefData = await this.referenceDataRepo.deleteStaleRecords(office, cutoffDate);
          result.itemsProcessed += deletedRefData;
          console.log(`[Cleanup] Deleted ${deletedRefData} stale reference data records`);

          // For orphaned records in main entities, we'd need to:
          // 1. Fetch IDs from legacy system
          // 2. Compare with local IDs
          // 3. Delete records that don't exist in legacy
          // This is expensive and should be done carefully
          // For now, we just clean up old records that haven't been synced
          console.log('[Cleanup] Full orphan reconciliation should be triggered via maintenance job');
          break;
      }

      result.success = true;
      result.durationMs = Date.now() - startTime;

      console.log(`[Cleanup] Completed in ${result.durationMs}ms, processed ${result.itemsProcessed} items`);
    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown error';
      result.durationMs = Date.now() - startTime;

      console.error(`[Cleanup] Failed:`, error);
      throw error;
    }
  }
}
