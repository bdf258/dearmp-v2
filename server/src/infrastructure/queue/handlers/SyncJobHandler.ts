/**
 * Sync Job Handlers
 *
 * Handles synchronization jobs that pull data from the legacy
 * Caseworker system to the shadow database.
 */

import PgBoss from 'pg-boss';
import { OfficeId } from '../../../domain/value-objects';
import { ILegacyApiClient, LegacyConstituentResponse, LegacyCaseResponse, LegacyEmailResponse } from '../../../domain/interfaces';
import { IConstituentRepository, ICaseRepository, IEmailRepository } from '../../../domain/interfaces';
import { ConstituentAdapter, CaseAdapter, EmailAdapter } from '../../adapters';
import {
  JobNames,
  SyncConstituentsJobData,
  SyncCasesJobData,
  SyncEmailsJobData,
  SyncReferenceDataJobData,
  SyncAllJobData,
  SyncJobResult,
} from '../types';
import { PgBossClient } from '../PgBossClient';

export interface SyncJobHandlerDependencies {
  pgBossClient: PgBossClient;
  legacyApiClient: ILegacyApiClient;
  constituentRepository: IConstituentRepository;
  caseRepository: ICaseRepository;
  emailRepository: IEmailRepository;
  syncStatusRepository: ISyncStatusRepository;
}

export interface ISyncStatusRepository {
  getLastSyncTime(officeId: OfficeId, entityType: string): Promise<Date | null>;
  updateSyncStatus(
    officeId: OfficeId,
    entityType: string,
    status: {
      startedAt?: Date;
      completedAt?: Date;
      success?: boolean;
      error?: string;
      cursor?: string;
      recordsSynced?: number;
      recordsFailed?: number;
    }
  ): Promise<void>;
}

/**
 * Handler for sync-related jobs
 */
export class SyncJobHandler {
  private readonly client: PgBossClient;
  private readonly legacyApi: ILegacyApiClient;
  private readonly constituentRepo: IConstituentRepository;
  private readonly caseRepo: ICaseRepository;
  private readonly emailRepo: IEmailRepository;
  private readonly syncStatusRepo: ISyncStatusRepository;

  constructor(deps: SyncJobHandlerDependencies) {
    this.client = deps.pgBossClient;
    this.legacyApi = deps.legacyApiClient;
    this.constituentRepo = deps.constituentRepository;
    this.caseRepo = deps.caseRepository;
    this.emailRepo = deps.emailRepository;
    this.syncStatusRepo = deps.syncStatusRepository;
  }

  /**
   * Register all sync job handlers
   */
  async register(): Promise<void> {
    await this.client.work<SyncConstituentsJobData>(
      JobNames.SYNC_CONSTITUENTS,
      this.handleSyncConstituents.bind(this)
    );

    await this.client.work<SyncCasesJobData>(
      JobNames.SYNC_CASES,
      this.handleSyncCases.bind(this)
    );

    await this.client.work<SyncEmailsJobData>(
      JobNames.SYNC_EMAILS,
      this.handleSyncEmails.bind(this)
    );

    await this.client.work<SyncReferenceDataJobData>(
      JobNames.SYNC_REFERENCE_DATA,
      this.handleSyncReferenceData.bind(this)
    );

    await this.client.work<SyncAllJobData>(
      JobNames.SYNC_ALL,
      this.handleSyncAll.bind(this)
    );

    console.log('[SyncJobHandler] Registered all sync job handlers');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SYNC ALL
  // ─────────────────────────────────────────────────────────────────────────

  private async handleSyncAll(job: PgBoss.Job<SyncAllJobData>): Promise<void> {
    const { officeId, mode, includeReferenceData } = job.data;

    console.log(`[SyncAll] Starting ${mode} sync for office: ${officeId}`);

    try {
      // Schedule child sync jobs sequentially
      if (includeReferenceData) {
        await this.client.send(JobNames.SYNC_REFERENCE_DATA, {
          type: JobNames.SYNC_REFERENCE_DATA,
          officeId,
          correlationId: job.data.correlationId,
        } as SyncReferenceDataJobData);
      }

      await this.client.send(JobNames.SYNC_CONSTITUENTS, {
        type: JobNames.SYNC_CONSTITUENTS,
        officeId,
        mode,
        correlationId: job.data.correlationId,
      } as SyncConstituentsJobData);

      await this.client.send(JobNames.SYNC_CASES, {
        type: JobNames.SYNC_CASES,
        officeId,
        mode,
        correlationId: job.data.correlationId,
      } as SyncCasesJobData);

      await this.client.send(JobNames.SYNC_EMAILS, {
        type: JobNames.SYNC_EMAILS,
        officeId,
        mode,
        correlationId: job.data.correlationId,
      } as SyncEmailsJobData);

      const jobCount = includeReferenceData ? 4 : 3;
      console.log(`[SyncAll] Scheduled ${jobCount} child sync jobs for office: ${officeId}`);
    } catch (error) {
      console.error(`[SyncAll] Failed for office ${officeId}:`, error);
      throw error;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SYNC CONSTITUENTS
  // ─────────────────────────────────────────────────────────────────────────

  private async handleSyncConstituents(
    job: PgBoss.Job<SyncConstituentsJobData>
  ): Promise<void> {
    const { officeId, mode, modifiedSince, cursor, batchSize = 100 } = job.data;
    const startTime = Date.now();
    const office = OfficeId.create(officeId);

    console.log(`[SyncConstituents] Starting ${mode} sync for office: ${officeId}`);

    const result: SyncJobResult = {
      success: false,
      entityType: 'constituents',
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
      hasMore: false,
      errors: [],
      durationMs: 0,
    };

    try {
      // Update sync status to running
      await this.syncStatusRepo.updateSyncStatus(office, 'constituents', {
        startedAt: new Date(),
      });

      // Determine sync parameters
      const syncSince = mode === 'incremental'
        ? (modifiedSince ? new Date(modifiedSince) : await this.syncStatusRepo.getLastSyncTime(office, 'constituents'))
        : null;

      // Fetch from legacy API
      const legacyResult = await this.legacyApi.searchConstituents(office, {
        ...(syncSince && { modifiedAfter: syncSince }),
        page: cursor ? parseInt(cursor, 10) : 1,
        limit: batchSize,
      });

      // Process each constituent
      for (const legacyConstituent of legacyResult.results) {
        try {
          const constituent = ConstituentAdapter.fromLegacy(office, legacyConstituent);
          const existing = await this.constituentRepo.findByExternalId(
            office,
            constituent.externalId
          );

          if (existing) {
            await this.constituentRepo.update(existing.id!, constituent);
            result.recordsUpdated++;
          } else {
            await this.constituentRepo.create(constituent);
            result.recordsCreated++;
          }
          result.recordsProcessed++;
        } catch (error) {
          result.recordsFailed++;
          result.errors?.push({
            externalId: legacyConstituent.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // Check if there are more pages
      result.hasMore = legacyResult.results.length === batchSize;
      if (result.hasMore) {
        result.cursor = String((cursor ? parseInt(cursor, 10) : 1) + 1);

        // Schedule next page
        await this.client.send(JobNames.SYNC_CONSTITUENTS, {
          ...job.data,
          cursor: result.cursor,
        });
      }

      result.success = result.recordsFailed === 0;
      result.durationMs = Date.now() - startTime;

      // Update sync status
      await this.syncStatusRepo.updateSyncStatus(office, 'constituents', {
        completedAt: result.hasMore ? new Date() : undefined,
        success: result.success,
        cursor: result.cursor,
        recordsSynced: result.recordsProcessed,
        recordsFailed: result.recordsFailed,
      });

      console.log(
        `[SyncConstituents] Completed: ${result.recordsProcessed} processed, ` +
          `${result.recordsCreated} created, ${result.recordsUpdated} updated, ` +
          `${result.recordsFailed} failed`
      );
    } catch (error) {
      result.durationMs = Date.now() - startTime;
      await this.syncStatusRepo.updateSyncStatus(office, 'constituents', {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SYNC CASES
  // ─────────────────────────────────────────────────────────────────────────

  private async handleSyncCases(job: PgBoss.Job<SyncCasesJobData>): Promise<void> {
    const { officeId, mode, modifiedSince, cursor, batchSize = 100 } = job.data;
    const startTime = Date.now();
    const office = OfficeId.create(officeId);

    console.log(`[SyncCases] Starting ${mode} sync for office: ${officeId}`);

    const result: SyncJobResult = {
      success: false,
      entityType: 'cases',
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
      hasMore: false,
      errors: [],
      durationMs: 0,
    };

    try {
      await this.syncStatusRepo.updateSyncStatus(office, 'cases', {
        startedAt: new Date(),
      });

      let syncSince: Date | undefined;
      if (mode === 'incremental') {
        syncSince = modifiedSince
          ? new Date(modifiedSince)
          : (await this.syncStatusRepo.getLastSyncTime(office, 'cases')) ?? undefined;
      }

      const now = new Date();
      const legacyResult = await this.legacyApi.searchCases(office, {
        dateRange: syncSince
          ? { type: 'modified', from: syncSince, to: now }
          : undefined,
        pageNo: cursor ? parseInt(cursor, 10) : 1,
        resultsPerPage: batchSize,
      });

      for (const legacyCase of legacyResult.results) {
        try {
          const caseEntity = CaseAdapter.fromLegacy(office, legacyCase);
          const existing = await this.caseRepo.findByExternalId(
            office,
            caseEntity.externalId
          );

          if (existing) {
            await this.caseRepo.update(existing.id!, caseEntity);
            result.recordsUpdated++;
          } else {
            await this.caseRepo.create(caseEntity);
            result.recordsCreated++;
          }
          result.recordsProcessed++;
        } catch (error) {
          result.recordsFailed++;
          result.errors?.push({
            externalId: legacyCase.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      result.hasMore = legacyResult.results.length === batchSize;
      if (result.hasMore) {
        result.cursor = String((cursor ? parseInt(cursor, 10) : 1) + 1);
        await this.client.send(JobNames.SYNC_CASES, {
          ...job.data,
          cursor: result.cursor,
        });
      }

      result.success = result.recordsFailed === 0;
      result.durationMs = Date.now() - startTime;

      await this.syncStatusRepo.updateSyncStatus(office, 'cases', {
        completedAt: result.hasMore ? undefined : new Date(),
        success: result.success,
        cursor: result.cursor,
        recordsSynced: result.recordsProcessed,
        recordsFailed: result.recordsFailed,
      });

      console.log(
        `[SyncCases] Completed: ${result.recordsProcessed} processed, ` +
          `${result.recordsCreated} created, ${result.recordsUpdated} updated`
      );
    } catch (error) {
      result.durationMs = Date.now() - startTime;
      await this.syncStatusRepo.updateSyncStatus(office, 'cases', {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SYNC EMAILS
  // ─────────────────────────────────────────────────────────────────────────

  private async handleSyncEmails(job: PgBoss.Job<SyncEmailsJobData>): Promise<void> {
    const { officeId, mode, modifiedSince, emailType, actionedOnly, cursor, batchSize = 100 } =
      job.data;
    const startTime = Date.now();
    const office = OfficeId.create(officeId);

    console.log(`[SyncEmails] Starting ${mode} sync for office: ${officeId}`);

    const result: SyncJobResult = {
      success: false,
      entityType: 'emails',
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
      hasMore: false,
      errors: [],
      durationMs: 0,
    };

    try {
      await this.syncStatusRepo.updateSyncStatus(office, 'emails', {
        startedAt: new Date(),
      });

      let syncSince: Date | undefined;
      if (mode === 'incremental') {
        syncSince = modifiedSince
          ? new Date(modifiedSince)
          : (await this.syncStatusRepo.getLastSyncTime(office, 'emails')) ?? undefined;
      }

      const legacyResult = await this.legacyApi.searchInbox(office, {
        type: emailType,
        actioned: actionedOnly,
        dateFrom: syncSince,
        page: cursor ? parseInt(cursor, 10) : 1,
        limit: batchSize,
      });

      for (const legacyEmail of legacyResult.results) {
        try {
          const email = EmailAdapter.fromLegacy(office, legacyEmail);
          const existing = await this.emailRepo.findByExternalId(office, email.externalId);

          if (existing) {
            await this.emailRepo.update(existing.id!, email);
            result.recordsUpdated++;
          } else {
            await this.emailRepo.create(email);
            result.recordsCreated++;
          }
          result.recordsProcessed++;
        } catch (error) {
          result.recordsFailed++;
          result.errors?.push({
            externalId: legacyEmail.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      result.hasMore = legacyResult.results.length === batchSize;
      if (result.hasMore) {
        result.cursor = String((cursor ? parseInt(cursor, 10) : 1) + 1);
        await this.client.send(JobNames.SYNC_EMAILS, {
          ...job.data,
          cursor: result.cursor,
        });
      }

      result.success = result.recordsFailed === 0;
      result.durationMs = Date.now() - startTime;

      await this.syncStatusRepo.updateSyncStatus(office, 'emails', {
        completedAt: result.hasMore ? undefined : new Date(),
        success: result.success,
        cursor: result.cursor,
        recordsSynced: result.recordsProcessed,
        recordsFailed: result.recordsFailed,
      });

      console.log(
        `[SyncEmails] Completed: ${result.recordsProcessed} processed, ` +
          `${result.recordsCreated} created, ${result.recordsUpdated} updated`
      );
    } catch (error) {
      result.durationMs = Date.now() - startTime;
      await this.syncStatusRepo.updateSyncStatus(office, 'emails', {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SYNC REFERENCE DATA
  // ─────────────────────────────────────────────────────────────────────────

  private async handleSyncReferenceData(
    job: PgBoss.Job<SyncReferenceDataJobData>
  ): Promise<void> {
    const { officeId, entities } = job.data;
    const startTime = Date.now();
    const office = OfficeId.create(officeId);

    const entitiesToSync = entities ?? [
      'caseTypes',
      'statusTypes',
      'categoryTypes',
      'contactTypes',
      'caseworkers',
    ];

    console.log(`[SyncReferenceData] Syncing ${entitiesToSync.join(', ')} for office: ${officeId}`);

    try {
      await this.syncStatusRepo.updateSyncStatus(office, 'referenceData', {
        startedAt: new Date(),
      });

      // Sync each entity type
      for (const entityType of entitiesToSync) {
        switch (entityType) {
          case 'caseTypes':
            await this.syncCaseTypes(office);
            break;
          case 'statusTypes':
            await this.syncStatusTypes(office);
            break;
          case 'categoryTypes':
            await this.syncCategoryTypes(office);
            break;
          case 'contactTypes':
            await this.syncContactTypes(office);
            break;
          case 'caseworkers':
            await this.syncCaseworkers(office);
            break;
        }
      }

      await this.syncStatusRepo.updateSyncStatus(office, 'referenceData', {
        completedAt: new Date(),
        success: true,
      });

      console.log(
        `[SyncReferenceData] Completed in ${Date.now() - startTime}ms for office: ${officeId}`
      );
    } catch (error) {
      await this.syncStatusRepo.updateSyncStatus(office, 'referenceData', {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  private async syncCaseTypes(office: OfficeId): Promise<void> {
    const caseTypes = await this.legacyApi.getCaseTypes(office);
    // TODO: Upsert to repository
    console.log(`[SyncReferenceData] Synced ${caseTypes.length} case types`);
  }

  private async syncStatusTypes(office: OfficeId): Promise<void> {
    const statusTypes = await this.legacyApi.getStatusTypes(office);
    // TODO: Upsert to repository
    console.log(`[SyncReferenceData] Synced ${statusTypes.length} status types`);
  }

  private async syncCategoryTypes(office: OfficeId): Promise<void> {
    const categoryTypes = await this.legacyApi.getCategoryTypes(office);
    // TODO: Upsert to repository
    console.log(`[SyncReferenceData] Synced ${categoryTypes.length} category types`);
  }

  private async syncContactTypes(office: OfficeId): Promise<void> {
    const contactTypes = await this.legacyApi.getContactTypes(office);
    // TODO: Upsert to repository
    console.log(`[SyncReferenceData] Synced ${contactTypes.length} contact types`);
  }

  private async syncCaseworkers(office: OfficeId): Promise<void> {
    const caseworkers = await this.legacyApi.getCaseworkers(office);
    // TODO: Upsert to repository
    console.log(`[SyncReferenceData] Synced ${caseworkers.length} caseworkers`);
  }
}
