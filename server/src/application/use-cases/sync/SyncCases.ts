import { ICaseRepository, ILegacyApiClient } from '../../../domain/interfaces';
import { Case } from '../../../domain/entities';
import { OfficeId, ExternalId } from '../../../domain/value-objects';
import { SyncResultDto } from '../../dtos';
import { IEventEmitter } from '../../services/SyncService';
import {
  SyncStartedEvent,
  SyncCompletedEvent,
  SyncFailedEvent,
  EntityCreatedEvent,
  EntityUpdatedEvent,
} from '../../../domain/events';

/**
 * Use Case: SyncCases
 *
 * Synchronizes cases from the legacy system to the shadow database.
 * Supports both full and incremental sync modes.
 */
export class SyncCases {
  private readonly batchSize = 100;

  constructor(
    private readonly legacyApiClient: ILegacyApiClient,
    private readonly caseRepository: ICaseRepository,
    private readonly eventEmitter: IEventEmitter
  ) {}

  /**
   * Execute the sync operation
   */
  async execute(
    officeId: OfficeId,
    options: {
      full?: boolean;
      modifiedSince?: Date;
      cursor?: string;
    } = {}
  ): Promise<SyncResultDto> {
    const startTime = Date.now();
    let recordsSynced = 0;
    let recordsCreated = 0;
    let recordsUpdated = 0;
    let recordsFailed = 0;
    const errors: Array<{ externalId: number; error: string }> = [];

    // Emit sync started event
    this.eventEmitter.emit(
      new SyncStartedEvent(officeId, 'cases', options.full ? 'full' : 'incremental')
    );

    try {
      let pageNo = 1;
      let hasMore = true;

      // Calculate date range for search
      const now = new Date();
      const dateFrom = options.full
        ? new Date('2000-01-01') // Far in the past for full sync
        : (options.modifiedSince ?? new Date(Date.now() - 24 * 60 * 60 * 1000));

      while (hasMore) {
        // Fetch batch from legacy API
        const response = await this.legacyApiClient.searchCases(officeId, {
          dateRange: {
            type: options.full ? 'created' : 'modified',
            from: dateFrom,
            to: now,
          },
          pageNo,
          resultsPerPage: this.batchSize,
        });

        // Process each case
        for (const legacyCase of response.results) {
          try {
            const result = await this.processCase(officeId, legacyCase);
            recordsSynced++;
            if (result.created) recordsCreated++;
            if (result.updated) recordsUpdated++;
          } catch (error) {
            recordsFailed++;
            errors.push({
              externalId: legacyCase.id,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }

        // Check if more pages
        hasMore = response.results.length === this.batchSize;
        pageNo++;
      }

      // Emit sync completed event
      this.eventEmitter.emit(
        new SyncCompletedEvent(officeId, 'cases', recordsSynced, Date.now() - startTime)
      );

      return {
        entityType: 'cases',
        officeId: officeId.toString(),
        success: true,
        recordsSynced,
        recordsCreated,
        recordsUpdated,
        recordsFailed,
        durationMs: Date.now() - startTime,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      // Emit sync failed event
      this.eventEmitter.emit(
        new SyncFailedEvent(
          officeId,
          'cases',
          error instanceof Error ? error.message : 'Unknown error',
          recordsSynced
        )
      );

      return {
        entityType: 'cases',
        officeId: officeId.toString(),
        success: false,
        recordsSynced,
        recordsCreated,
        recordsUpdated,
        recordsFailed,
        durationMs: Date.now() - startTime,
        errors: [{ externalId: 0, error: error instanceof Error ? error.message : 'Unknown error' }],
      };
    }
  }

  /**
   * Process a single case from the legacy system
   */
  private async processCase(
    officeId: OfficeId,
    legacyData: {
      id: number;
      constituentID?: number;
      caseTypeID?: number;
      statusID?: number;
      categoryTypeID?: number;
      contactTypeID?: number;
      assignedToID?: number;
      summary?: string;
      reviewDate?: string;
    }
  ): Promise<{ created: boolean; updated: boolean }> {
    const externalId = ExternalId.fromTrusted(legacyData.id);

    // Check if case already exists
    const existing = await this.caseRepository.findByExternalId(officeId, externalId);

    if (existing) {
      // Update existing case
      const updated = existing.updateFromLegacy({
        constituentExternalId: legacyData.constituentID,
        caseTypeExternalId: legacyData.caseTypeID,
        statusExternalId: legacyData.statusID,
        categoryTypeExternalId: legacyData.categoryTypeID,
        contactTypeExternalId: legacyData.contactTypeID,
        assignedToExternalId: legacyData.assignedToID,
        summary: legacyData.summary,
        reviewDate: legacyData.reviewDate,
      });

      await this.caseRepository.save(updated);

      this.eventEmitter.emit(
        new EntityUpdatedEvent(
          officeId,
          'cases',
          existing.id!,
          legacyData.id,
          ['status', 'summary', 'assignedTo'] // Simplified
        )
      );

      return { created: false, updated: true };
    } else {
      // Create new case
      const newCase = Case.fromLegacy(officeId, externalId, {
        constituentExternalId: legacyData.constituentID,
        caseTypeExternalId: legacyData.caseTypeID,
        statusExternalId: legacyData.statusID,
        categoryTypeExternalId: legacyData.categoryTypeID,
        contactTypeExternalId: legacyData.contactTypeID,
        assignedToExternalId: legacyData.assignedToID,
        summary: legacyData.summary,
        reviewDate: legacyData.reviewDate,
      });

      const saved = await this.caseRepository.save(newCase);

      this.eventEmitter.emit(
        new EntityCreatedEvent(officeId, 'cases', saved.id!, legacyData.id)
      );

      return { created: true, updated: false };
    }
  }
}
