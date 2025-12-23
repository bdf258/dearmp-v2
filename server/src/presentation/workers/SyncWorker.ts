import { SyncService } from '../../application/services';
import { OfficeId } from '../../domain/value-objects';
import { SyncEntityType } from '../../domain/events';

/**
 * Job data for sync operations
 */
export interface SyncJobData {
  officeId: string;
  entityType: SyncEntityType;
  syncType: 'full' | 'incremental';
  modifiedSince?: string;
}

/**
 * Worker: SyncWorker
 *
 * Handles background synchronization jobs.
 * In production, this would be integrated with BullMQ.
 */
export class SyncWorker {
  constructor(private readonly syncService: SyncService) {}

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
   * Schedule periodic sync for an office
   * In production, this would create recurring BullMQ jobs
   */
  async schedulePeriodicSync(officeId: OfficeId, intervalMs: number): Promise<void> {
    // TODO: Implement with BullMQ repeat jobs
    // const queue = new Queue('sync');
    // await queue.add(
    //   'periodic-sync',
    //   {
    //     officeId: officeId.toString(),
    //     entityType: 'all',
    //     syncType: 'incremental',
    //   },
    //   {
    //     repeat: { every: intervalMs },
    //     jobId: `periodic-sync-${officeId.toString()}`,
    //   }
    // );
    console.log(`[SyncWorker] Would schedule periodic sync every ${intervalMs}ms for office ${officeId.toString()}`);
  }

  /**
   * Cancel periodic sync for an office
   */
  async cancelPeriodicSync(officeId: OfficeId): Promise<void> {
    // TODO: Implement with BullMQ
    // const queue = new Queue('sync');
    // await queue.removeRepeatableByKey(`periodic-sync-${officeId.toString()}`);
    console.log(`[SyncWorker] Would cancel periodic sync for office ${officeId.toString()}`);
  }
}
