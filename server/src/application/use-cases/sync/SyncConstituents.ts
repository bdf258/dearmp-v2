import { IConstituentRepository, ILegacyApiClient } from '../../../domain/interfaces';
import { Constituent } from '../../../domain/entities';
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
 * Use Case: SyncConstituents
 *
 * Synchronizes constituents from the legacy system to the shadow database.
 * Supports both full and incremental sync modes.
 */
export class SyncConstituents {
  private readonly batchSize = 100;

  constructor(
    private readonly legacyApiClient: ILegacyApiClient,
    private readonly constituentRepository: IConstituentRepository,
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
      new SyncStartedEvent(officeId, 'constituents', options.full ? 'full' : 'incremental')
    );

    try {
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        // Fetch batch from legacy API
        const response = await this.legacyApiClient.searchConstituents(officeId, {
          modifiedAfter: options.full ? undefined : options.modifiedSince,
          page,
          limit: this.batchSize,
        });

        // Process each constituent
        for (const legacyConstituent of response.results) {
          try {
            const result = await this.processConstituent(officeId, legacyConstituent);
            recordsSynced++;
            if (result.created) recordsCreated++;
            if (result.updated) recordsUpdated++;
          } catch (error) {
            recordsFailed++;
            errors.push({
              externalId: legacyConstituent.id,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }

        // Check if more pages
        hasMore = response.results.length === this.batchSize;
        page++;
      }

      // Emit sync completed event
      this.eventEmitter.emit(
        new SyncCompletedEvent(officeId, 'constituents', recordsSynced, Date.now() - startTime)
      );

      return {
        entityType: 'constituents',
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
          'constituents',
          error instanceof Error ? error.message : 'Unknown error',
          recordsSynced
        )
      );

      return {
        entityType: 'constituents',
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
   * Process a single constituent from the legacy system
   */
  private async processConstituent(
    officeId: OfficeId,
    legacyData: {
      id: number;
      firstName?: string;
      lastName?: string;
      title?: string;
      organisationType?: string;
      geocodeLat?: number;
      geocodeLng?: number;
    }
  ): Promise<{ created: boolean; updated: boolean }> {
    const externalId = ExternalId.fromTrusted(legacyData.id);

    // Check if constituent already exists
    const existing = await this.constituentRepository.findByExternalId(officeId, externalId);

    if (existing) {
      // Update existing constituent
      const updated = existing.updateFromLegacy({
        firstName: legacyData.firstName,
        lastName: legacyData.lastName,
        title: legacyData.title,
        organisationType: legacyData.organisationType,
        geocodeLat: legacyData.geocodeLat,
        geocodeLng: legacyData.geocodeLng,
      });

      await this.constituentRepository.save(updated);

      this.eventEmitter.emit(
        new EntityUpdatedEvent(
          officeId,
          'constituents',
          existing.id!,
          legacyData.id,
          ['firstName', 'lastName', 'title', 'organisationType'] // Simplified
        )
      );

      return { created: false, updated: true };
    } else {
      // Create new constituent
      const newConstituent = Constituent.fromLegacy(officeId, externalId, {
        firstName: legacyData.firstName,
        lastName: legacyData.lastName,
        title: legacyData.title,
        organisationType: legacyData.organisationType,
        geocodeLat: legacyData.geocodeLat,
        geocodeLng: legacyData.geocodeLng,
      });

      const saved = await this.constituentRepository.save(newConstituent);

      this.eventEmitter.emit(
        new EntityCreatedEvent(officeId, 'constituents', saved.id!, legacyData.id)
      );

      return { created: true, updated: false };
    }
  }
}
