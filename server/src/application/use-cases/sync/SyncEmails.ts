import { IEmailRepository, ILegacyApiClient } from '../../../domain/interfaces';
import { Email } from '../../../domain/entities';
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
 * Use Case: SyncEmails
 *
 * Synchronizes emails from the legacy system to the shadow database.
 * Focuses on unactioned incoming emails for triage.
 */
export class SyncEmails {
  private readonly batchSize = 100;

  constructor(
    private readonly legacyApiClient: ILegacyApiClient,
    private readonly emailRepository: IEmailRepository,
    private readonly eventEmitter: IEventEmitter
  ) {}

  /**
   * Execute the sync operation
   */
  async execute(
    officeId: OfficeId,
    options: {
      full?: boolean;
      receivedSince?: Date;
      actioned?: boolean;
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
      new SyncStartedEvent(officeId, 'emails', options.full ? 'full' : 'incremental')
    );

    try {
      let page = 1;
      let hasMore = true;

      // Default to today for incremental sync
      const dateFrom = options.full
        ? undefined
        : (options.receivedSince ?? this.getStartOfToday());

      while (hasMore) {
        // Fetch batch from legacy API
        const response = await this.legacyApiClient.searchInbox(officeId, {
          actioned: options.actioned ?? false,
          type: 'received',
          dateFrom,
          page,
          limit: this.batchSize,
        });

        // Process each email
        for (const legacyEmail of response.results) {
          try {
            const result = await this.processEmail(officeId, legacyEmail);
            recordsSynced++;
            if (result.created) recordsCreated++;
            if (result.updated) recordsUpdated++;
          } catch (error) {
            recordsFailed++;
            errors.push({
              externalId: legacyEmail.id,
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
        new SyncCompletedEvent(officeId, 'emails', recordsSynced, Date.now() - startTime)
      );

      return {
        entityType: 'emails',
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
          'emails',
          error instanceof Error ? error.message : 'Unknown error',
          recordsSynced
        )
      );

      return {
        entityType: 'emails',
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
   * Process a single email from the legacy system
   */
  private async processEmail(
    officeId: OfficeId,
    legacyData: {
      id: number;
      caseID?: number;
      constituentID?: number;
      type?: 'draft' | 'sent' | 'received' | 'scheduled';
      subject?: string;
      htmlBody?: string;
      from?: string;
      to?: string[];
      cc?: string[];
      bcc?: string[];
      actioned?: boolean;
      assignedToID?: number;
      scheduledAt?: string;
      sentAt?: string;
      receivedAt?: string;
    }
  ): Promise<{ created: boolean; updated: boolean }> {
    const externalId = ExternalId.fromTrusted(legacyData.id);

    // Check if email already exists
    const existing = await this.emailRepository.findByExternalId(officeId, externalId);

    if (existing) {
      // Update existing email
      const updated = existing.updateFromLegacy({
        caseExternalId: legacyData.caseID,
        constituentExternalId: legacyData.constituentID,
        type: legacyData.type,
        subject: legacyData.subject,
        htmlBody: legacyData.htmlBody,
        actioned: legacyData.actioned,
      });

      await this.emailRepository.save(updated);

      this.eventEmitter.emit(
        new EntityUpdatedEvent(
          officeId,
          'emails',
          existing.id!,
          legacyData.id,
          ['actioned', 'caseId'] // Simplified
        )
      );

      return { created: false, updated: true };
    } else {
      // Create new email
      const newEmail = Email.fromLegacy(officeId, externalId, {
        caseExternalId: legacyData.caseID,
        constituentExternalId: legacyData.constituentID,
        type: legacyData.type,
        subject: legacyData.subject,
        htmlBody: legacyData.htmlBody,
        fromAddress: legacyData.from,
        toAddresses: legacyData.to,
        ccAddresses: legacyData.cc,
        bccAddresses: legacyData.bcc,
        actioned: legacyData.actioned,
        assignedToExternalId: legacyData.assignedToID,
        scheduledAt: legacyData.scheduledAt,
        sentAt: legacyData.sentAt,
        receivedAt: legacyData.receivedAt,
      });

      const saved = await this.emailRepository.save(newEmail);

      this.eventEmitter.emit(
        new EntityCreatedEvent(officeId, 'emails', saved.id!, legacyData.id)
      );

      return { created: true, updated: false };
    }
  }

  /**
   * Get start of today (midnight)
   */
  private getStartOfToday(): Date {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }
}
