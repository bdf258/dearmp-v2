import {
  IConstituentRepository,
  ICaseRepository,
  IEmailRepository,
  ILegacyApiClient,
} from '../../domain/interfaces';
import { OfficeId, ExternalId } from '../../domain/value-objects';
import {
  SyncEntityType,
  DomainEvent,
  SyncStartedEvent,
  SyncCompletedEvent,
  SyncFailedEvent,
  EntityCreatedEvent,
  EntityUpdatedEvent,
} from '../../domain/events';
import { SyncStatusDto, SyncResultDto, StartSyncDto } from '../dtos';
import { Constituent, Case, Email } from '../../domain/entities';

/**
 * Event emitter interface for publishing domain events
 */
export interface IEventEmitter {
  emit(event: DomainEvent): void;
}

/**
 * Sync status repository interface
 */
export interface ISyncStatusRepository {
  getStatus(officeId: OfficeId, entityType: SyncEntityType): Promise<SyncStatusDto | null>;
  updateStatus(officeId: OfficeId, entityType: SyncEntityType, status: Partial<SyncStatusDto>): Promise<void>;
  getAllStatuses(officeId: OfficeId): Promise<SyncStatusDto[]>;
  getLastSyncTime(officeId: OfficeId, entityType: SyncEntityType): Promise<Date | null>;
  markSyncRunning(officeId: OfficeId, entityType: SyncEntityType): Promise<void>;
  markSyncCancelled(officeId: OfficeId, entityType: SyncEntityType): Promise<void>;
  isSyncCancelled(officeId: OfficeId, entityType: SyncEntityType): Promise<boolean>;
}

/**
 * Reference data repository interface for syncing lookup tables
 */
export interface IReferenceDataRepository {
  upsertCaseTypes(officeId: OfficeId, caseTypes: Array<{ externalId: number; name: string; isActive: boolean }>): Promise<number>;
  upsertStatusTypes(officeId: OfficeId, statusTypes: Array<{ externalId: number; name: string; isActive: boolean }>): Promise<number>;
  upsertCategoryTypes(officeId: OfficeId, categoryTypes: Array<{ externalId: number; name: string; isActive: boolean }>): Promise<number>;
  upsertContactTypes(officeId: OfficeId, contactTypes: Array<{ externalId: number; name: string; type: string; isActive: boolean }>): Promise<number>;
  upsertCaseworkers(officeId: OfficeId, caseworkers: Array<{ externalId: number; name: string; email?: string; isActive: boolean }>): Promise<number>;
}

/**
 * Logger interface - allows injecting a logger instead of using console directly
 */
export interface ILogger {
  log(message: string): void;
  warn(message: string): void;
  error(message: string, error?: unknown): void;
}

/**
 * Default console logger implementation
 */
const defaultLogger: ILogger = {
  log: (message: string) => {
    (globalThis as { console?: { log: (m: string) => void } }).console?.log(message);
  },
  warn: (message: string) => {
    (globalThis as { console?: { warn: (m: string) => void } }).console?.warn(message);
  },
  error: (message: string, error?: unknown) => {
    (globalThis as { console?: { error: (m: string, e?: unknown) => void } }).console?.error(message, error);
  },
};

/**
 * Service: SyncService
 *
 * Orchestrates synchronization between the legacy system and shadow database.
 * Handles full and incremental sync strategies with rate limiting.
 */
export class SyncService {
  private readonly batchSize = 100;
  private readonly logger: ILogger;

  constructor(
    private readonly legacyApiClient: ILegacyApiClient,
    private readonly constituentRepository: IConstituentRepository,
    private readonly caseRepository: ICaseRepository,
    private readonly emailRepository: IEmailRepository,
    private readonly syncStatusRepository: ISyncStatusRepository,
    private readonly eventEmitter: IEventEmitter,
    private readonly referenceDataRepository?: IReferenceDataRepository,
    logger?: ILogger
  ) {
    this.logger = logger ?? defaultLogger;
  }

  /**
   * Get sync status for all entity types
   */
  async getSyncStatuses(officeId: OfficeId): Promise<SyncStatusDto[]> {
    return this.syncStatusRepository.getAllStatuses(officeId);
  }

  /**
   * Get sync status for a specific entity type
   */
  async getSyncStatus(officeId: OfficeId, entityType: SyncEntityType): Promise<SyncStatusDto | null> {
    return this.syncStatusRepository.getStatus(officeId, entityType);
  }

  /**
   * Start a sync operation
   */
  async startSync(officeId: OfficeId, request: StartSyncDto): Promise<void> {
    // Validate office has valid API credentials by attempting authentication
    try {
      await this.legacyApiClient.authenticate(officeId);
    } catch (error) {
      throw new Error(`Failed to authenticate with legacy API: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Process each entity type in the request
    for (const entityType of request.entityTypes) {
      const syncEntityType = entityType as SyncEntityType;

      // Check if sync is already running
      const currentStatus = await this.syncStatusRepository.getStatus(officeId, syncEntityType);
      if (currentStatus?.lastSyncStartedAt && !currentStatus.lastSyncCompletedAt) {
        // Sync appears to be running
        const startedAt = new Date(currentStatus.lastSyncStartedAt);
        const runningForMs = Date.now() - startedAt.getTime();
        const maxRunTimeMs = 30 * 60 * 1000; // 30 minutes

        if (runningForMs < maxRunTimeMs) {
          this.logger.log(`[SyncService] Sync for ${entityType} is already running, skipping`);
          continue;
        }
        // If running for too long, assume it's stale and restart
        this.logger.log(`[SyncService] Stale sync detected for ${entityType}, restarting`);
      }

      // Mark sync as started
      await this.syncStatusRepository.markSyncRunning(officeId, syncEntityType);

      // Determine sync parameters
      const isFull = request.syncType === 'full' || Boolean(request.forceRefresh);
      const modifiedSince = isFull ? undefined : await this.syncStatusRepository.getLastSyncTime(officeId, syncEntityType) ?? undefined;

      // Execute sync based on entity type
      try {
        switch (syncEntityType) {
          case 'constituents': {
            const opts = isFull ? { full: true as const } : (modifiedSince ? { modifiedSince } : {});
            await this.syncConstituents(officeId, opts);
            break;
          }
          case 'cases': {
            const opts = isFull ? { full: true as const } : (modifiedSince ? { modifiedSince } : {});
            await this.syncCases(officeId, opts);
            break;
          }
          case 'emails': {
            const opts = isFull ? { full: true as const } : (modifiedSince ? { receivedSince: modifiedSince } : {});
            await this.syncEmails(officeId, opts);
            break;
          }
          case 'caseworkers':
          case 'case_types':
          case 'status_types':
          case 'category_types':
          case 'contact_types':
            await this.syncReferenceData(officeId);
            break;
          default:
            this.logger.warn(`[SyncService] Unknown entity type: ${entityType}`);
        }
      } catch (error) {
        this.logger.error(`[SyncService] Sync failed for ${entityType}:`, error);
        await this.syncStatusRepository.updateStatus(officeId, syncEntityType, {
          lastSyncSuccess: false,
          lastSyncError: error instanceof Error ? error.message : 'Unknown error',
          lastSyncCompletedAt: new Date().toISOString(),
        });
      }
    }
  }

  /**
   * Sync constituents from legacy system
   */
  async syncConstituents(
    officeId: OfficeId,
    options: { full?: boolean; modifiedSince?: Date } = {}
  ): Promise<SyncResultDto> {
    const startTime = Date.now();
    let recordsSynced = 0;
    let recordsCreated = 0;
    let recordsUpdated = 0;
    let recordsFailed = 0;
    const errors: Array<{ externalId: number; error: string }> = [];

    // Emit sync started event
    this.eventEmitter.emit(
      new SyncStartedEvent(officeId, 'constituents', options.full === true ? 'full' : 'incremental')
    );

    try {
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        // Check for cancellation
        if (await this.syncStatusRepository.isSyncCancelled(officeId, 'constituents')) {
          this.logger.log(`[SyncService] Constituent sync cancelled for office ${officeId.toString()}`);
          break;
        }

        // Fetch batch from legacy API - build params carefully
        const baseParams = { page, limit: this.batchSize };
        const searchParams = options.full !== true && options.modifiedSince
          ? { ...baseParams, modifiedAfter: options.modifiedSince }
          : baseParams;
        const response = await this.legacyApiClient.searchConstituents(officeId, searchParams);

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

        // Update progress
        await this.syncStatusRepository.updateStatus(officeId, 'constituents', {
          recordsSynced,
          recordsFailed,
          lastSyncCursor: String(page),
        });

        // Check if more pages
        hasMore = response.results.length === this.batchSize;
        page++;
      }

      // Emit sync completed event
      this.eventEmitter.emit(
        new SyncCompletedEvent(officeId, 'constituents', recordsSynced, Date.now() - startTime)
      );

      // Update final status
      await this.syncStatusRepository.updateStatus(officeId, 'constituents', {
        lastSyncCompletedAt: new Date().toISOString(),
        lastSyncSuccess: recordsFailed === 0,
        recordsSynced,
        recordsFailed,
      });

      const result: SyncResultDto = {
        entityType: 'constituents',
        officeId: officeId.toString(),
        success: true,
        recordsSynced,
        recordsCreated,
        recordsUpdated,
        recordsFailed,
        durationMs: Date.now() - startTime,
      };
      if (errors.length > 0) {
        result.errors = errors;
      }
      return result;
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

      // Update status with failure
      await this.syncStatusRepository.updateStatus(officeId, 'constituents', {
        lastSyncCompletedAt: new Date().toISOString(),
        lastSyncSuccess: false,
        lastSyncError: error instanceof Error ? error.message : 'Unknown error',
        recordsSynced,
        recordsFailed,
      });

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

    // Build update data, only including defined values
    const updateData: {
      firstName?: string;
      lastName?: string;
      title?: string;
      organisationType?: string;
      geocodeLat?: number;
      geocodeLng?: number;
    } = {};
    if (legacyData.firstName !== undefined) updateData.firstName = legacyData.firstName;
    if (legacyData.lastName !== undefined) updateData.lastName = legacyData.lastName;
    if (legacyData.title !== undefined) updateData.title = legacyData.title;
    if (legacyData.organisationType !== undefined) updateData.organisationType = legacyData.organisationType;
    if (legacyData.geocodeLat !== undefined) updateData.geocodeLat = legacyData.geocodeLat;
    if (legacyData.geocodeLng !== undefined) updateData.geocodeLng = legacyData.geocodeLng;

    if (existing) {
      // Update existing constituent
      const updated = existing.updateFromLegacy(updateData);
      await this.constituentRepository.save(updated);

      this.eventEmitter.emit(
        new EntityUpdatedEvent(
          officeId,
          'constituents',
          existing.id!,
          legacyData.id,
          Object.keys(updateData)
        )
      );

      return { created: false, updated: true };
    } else {
      // Create new constituent
      const newConstituent = Constituent.fromLegacy(officeId, externalId, updateData);
      const saved = await this.constituentRepository.save(newConstituent);

      this.eventEmitter.emit(
        new EntityCreatedEvent(officeId, 'constituents', saved.id!, legacyData.id)
      );

      return { created: true, updated: false };
    }
  }

  /**
   * Sync cases from legacy system
   */
  async syncCases(
    officeId: OfficeId,
    options: { full?: boolean; modifiedSince?: Date } = {}
  ): Promise<SyncResultDto> {
    const startTime = Date.now();
    let recordsSynced = 0;
    let recordsCreated = 0;
    let recordsUpdated = 0;
    let recordsFailed = 0;
    const errors: Array<{ externalId: number; error: string }> = [];

    // Emit sync started event
    this.eventEmitter.emit(
      new SyncStartedEvent(officeId, 'cases', options.full === true ? 'full' : 'incremental')
    );

    try {
      let pageNo = 1;
      let hasMore = true;

      // Calculate date range for search
      const now = new Date();
      const dateFrom = options.full === true
        ? new Date('2000-01-01') // Far in the past for full sync
        : (options.modifiedSince ?? new Date(Date.now() - 24 * 60 * 60 * 1000));

      while (hasMore) {
        // Check for cancellation
        if (await this.syncStatusRepository.isSyncCancelled(officeId, 'cases')) {
          this.logger.log(`[SyncService] Case sync cancelled for office ${officeId.toString()}`);
          break;
        }

        // Fetch batch from legacy API
        const response = await this.legacyApiClient.searchCases(officeId, {
          dateRange: {
            type: options.full === true ? 'created' : 'modified',
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

        // Update progress
        await this.syncStatusRepository.updateStatus(officeId, 'cases', {
          recordsSynced,
          recordsFailed,
          lastSyncCursor: String(pageNo),
        });

        // Check if more pages
        hasMore = response.results.length === this.batchSize;
        pageNo++;
      }

      // Emit sync completed event
      this.eventEmitter.emit(
        new SyncCompletedEvent(officeId, 'cases', recordsSynced, Date.now() - startTime)
      );

      // Update final status
      await this.syncStatusRepository.updateStatus(officeId, 'cases', {
        lastSyncCompletedAt: new Date().toISOString(),
        lastSyncSuccess: recordsFailed === 0,
        recordsSynced,
        recordsFailed,
      });

      const result: SyncResultDto = {
        entityType: 'cases',
        officeId: officeId.toString(),
        success: true,
        recordsSynced,
        recordsCreated,
        recordsUpdated,
        recordsFailed,
        durationMs: Date.now() - startTime,
      };
      if (errors.length > 0) {
        result.errors = errors;
      }
      return result;
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

      // Update status with failure
      await this.syncStatusRepository.updateStatus(officeId, 'cases', {
        lastSyncCompletedAt: new Date().toISOString(),
        lastSyncSuccess: false,
        lastSyncError: error instanceof Error ? error.message : 'Unknown error',
        recordsSynced,
        recordsFailed,
      });

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

    // Build update data, only including defined values
    const updateData: {
      constituentExternalId?: number;
      caseTypeExternalId?: number;
      statusExternalId?: number;
      categoryTypeExternalId?: number;
      contactTypeExternalId?: number;
      assignedToExternalId?: number;
      summary?: string;
      reviewDate?: string;
    } = {};
    if (legacyData.constituentID !== undefined) updateData.constituentExternalId = legacyData.constituentID;
    if (legacyData.caseTypeID !== undefined) updateData.caseTypeExternalId = legacyData.caseTypeID;
    if (legacyData.statusID !== undefined) updateData.statusExternalId = legacyData.statusID;
    if (legacyData.categoryTypeID !== undefined) updateData.categoryTypeExternalId = legacyData.categoryTypeID;
    if (legacyData.contactTypeID !== undefined) updateData.contactTypeExternalId = legacyData.contactTypeID;
    if (legacyData.assignedToID !== undefined) updateData.assignedToExternalId = legacyData.assignedToID;
    if (legacyData.summary !== undefined) updateData.summary = legacyData.summary;
    if (legacyData.reviewDate !== undefined) updateData.reviewDate = legacyData.reviewDate;

    if (existing) {
      // Update existing case
      const updated = existing.updateFromLegacy(updateData);
      await this.caseRepository.save(updated);

      this.eventEmitter.emit(
        new EntityUpdatedEvent(
          officeId,
          'cases',
          existing.id!,
          legacyData.id,
          Object.keys(updateData)
        )
      );

      return { created: false, updated: true };
    } else {
      // Create new case
      const newCase = Case.fromLegacy(officeId, externalId, updateData);
      const saved = await this.caseRepository.save(newCase);

      this.eventEmitter.emit(
        new EntityCreatedEvent(officeId, 'cases', saved.id!, legacyData.id)
      );

      return { created: true, updated: false };
    }
  }

  /**
   * Sync emails from legacy system
   */
  async syncEmails(
    officeId: OfficeId,
    options: { full?: boolean; receivedSince?: Date } = {}
  ): Promise<SyncResultDto> {
    const startTime = Date.now();
    let recordsSynced = 0;
    let recordsCreated = 0;
    let recordsUpdated = 0;
    let recordsFailed = 0;
    const errors: Array<{ externalId: number; error: string }> = [];

    // Emit sync started event
    this.eventEmitter.emit(
      new SyncStartedEvent(officeId, 'emails', options.full === true ? 'full' : 'incremental')
    );

    try {
      let page = 1;
      let hasMore = true;

      // Default to today for incremental sync
      const dateFrom = options.full === true
        ? undefined
        : (options.receivedSince ?? this.getStartOfToday());

      while (hasMore) {
        // Check for cancellation
        if (await this.syncStatusRepository.isSyncCancelled(officeId, 'emails')) {
          this.logger.log(`[SyncService] Email sync cancelled for office ${officeId.toString()}`);
          break;
        }

        // Fetch batch from legacy API - build params carefully
        const baseEmailParams = { actioned: false, type: 'received' as const, page, limit: this.batchSize };
        const searchParams = dateFrom
          ? { ...baseEmailParams, dateFrom }
          : baseEmailParams;
        const response = await this.legacyApiClient.searchInbox(officeId, searchParams);

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

        // Update progress
        await this.syncStatusRepository.updateStatus(officeId, 'emails', {
          recordsSynced,
          recordsFailed,
          lastSyncCursor: String(page),
        });

        // Check if more pages
        hasMore = response.results.length === this.batchSize;
        page++;
      }

      // Emit sync completed event
      this.eventEmitter.emit(
        new SyncCompletedEvent(officeId, 'emails', recordsSynced, Date.now() - startTime)
      );

      // Update final status
      await this.syncStatusRepository.updateStatus(officeId, 'emails', {
        lastSyncCompletedAt: new Date().toISOString(),
        lastSyncSuccess: recordsFailed === 0,
        recordsSynced,
        recordsFailed,
      });

      const result: SyncResultDto = {
        entityType: 'emails',
        officeId: officeId.toString(),
        success: true,
        recordsSynced,
        recordsCreated,
        recordsUpdated,
        recordsFailed,
        durationMs: Date.now() - startTime,
      };
      if (errors.length > 0) {
        result.errors = errors;
      }
      return result;
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

      // Update status with failure
      await this.syncStatusRepository.updateStatus(officeId, 'emails', {
        lastSyncCompletedAt: new Date().toISOString(),
        lastSyncSuccess: false,
        lastSyncError: error instanceof Error ? error.message : 'Unknown error',
        recordsSynced,
        recordsFailed,
      });

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

    // Build update data for existing emails, only including defined values
    type EmailUpdateData = {
      caseExternalId?: number;
      constituentExternalId?: number;
      type?: 'draft' | 'sent' | 'received' | 'scheduled';
      subject?: string;
      htmlBody?: string;
      actioned?: boolean;
    };
    const updateData: EmailUpdateData = {};
    if (legacyData.caseID !== undefined) updateData.caseExternalId = legacyData.caseID;
    if (legacyData.constituentID !== undefined) updateData.constituentExternalId = legacyData.constituentID;
    if (legacyData.type !== undefined) updateData.type = legacyData.type;
    if (legacyData.subject !== undefined) updateData.subject = legacyData.subject;
    if (legacyData.htmlBody !== undefined) updateData.htmlBody = legacyData.htmlBody;
    if (legacyData.actioned !== undefined) updateData.actioned = legacyData.actioned;

    if (existing) {
      // Update existing email
      const updated = existing.updateFromLegacy(updateData);
      await this.emailRepository.save(updated);

      this.eventEmitter.emit(
        new EntityUpdatedEvent(
          officeId,
          'emails',
          existing.id!,
          legacyData.id,
          Object.keys(updateData)
        )
      );

      return { created: false, updated: true };
    } else {
      // Build create data for new emails, only including defined values
      type EmailCreateData = {
        caseExternalId?: number;
        constituentExternalId?: number;
        type?: 'draft' | 'sent' | 'received' | 'scheduled';
        subject?: string;
        htmlBody?: string;
        fromAddress?: string;
        toAddresses?: string[];
        ccAddresses?: string[];
        bccAddresses?: string[];
        actioned?: boolean;
        assignedToExternalId?: number;
        scheduledAt?: string;
        sentAt?: string;
        receivedAt?: string;
      };
      const createData: EmailCreateData = {};
      if (legacyData.caseID !== undefined) createData.caseExternalId = legacyData.caseID;
      if (legacyData.constituentID !== undefined) createData.constituentExternalId = legacyData.constituentID;
      if (legacyData.type !== undefined) createData.type = legacyData.type;
      if (legacyData.subject !== undefined) createData.subject = legacyData.subject;
      if (legacyData.htmlBody !== undefined) createData.htmlBody = legacyData.htmlBody;
      if (legacyData.from !== undefined) createData.fromAddress = legacyData.from;
      if (legacyData.to !== undefined) createData.toAddresses = legacyData.to;
      if (legacyData.cc !== undefined) createData.ccAddresses = legacyData.cc;
      if (legacyData.bcc !== undefined) createData.bccAddresses = legacyData.bcc;
      if (legacyData.actioned !== undefined) createData.actioned = legacyData.actioned;
      if (legacyData.assignedToID !== undefined) createData.assignedToExternalId = legacyData.assignedToID;
      if (legacyData.scheduledAt !== undefined) createData.scheduledAt = legacyData.scheduledAt;
      if (legacyData.sentAt !== undefined) createData.sentAt = legacyData.sentAt;
      if (legacyData.receivedAt !== undefined) createData.receivedAt = legacyData.receivedAt;

      // Create new email
      const newEmail = Email.fromLegacy(officeId, externalId, createData);
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

  /**
   * Sync reference data (case types, statuses, etc.)
   */
  async syncReferenceData(officeId: OfficeId): Promise<SyncResultDto[]> {
    const results: SyncResultDto[] = [];
    const startTime = Date.now();

    if (!this.referenceDataRepository) {
      this.logger.warn('[SyncService] Reference data repository not configured, skipping reference data sync');
      return results;
    }

    // Emit sync started event
    this.eventEmitter.emit(
      new SyncStartedEvent(officeId, 'case_types', 'full')
    );

    try {
      // 1. Sync case types
      const caseTypesResult = await this.syncCaseTypes(officeId);
      results.push(caseTypesResult);

      // 2. Sync status types
      const statusTypesResult = await this.syncStatusTypes(officeId);
      results.push(statusTypesResult);

      // 3. Sync category types
      const categoryTypesResult = await this.syncCategoryTypes(officeId);
      results.push(categoryTypesResult);

      // 4. Sync contact types
      const contactTypesResult = await this.syncContactTypes(officeId);
      results.push(contactTypesResult);

      // 5. Sync caseworkers
      const caseworkersResult = await this.syncCaseworkers(officeId);
      results.push(caseworkersResult);

      // Emit completion event
      const totalSynced = results.reduce((sum, r) => sum + r.recordsSynced, 0);
      this.eventEmitter.emit(
        new SyncCompletedEvent(officeId, 'case_types', totalSynced, Date.now() - startTime)
      );

      return results;
    } catch (error) {
      this.eventEmitter.emit(
        new SyncFailedEvent(
          officeId,
          'case_types',
          error instanceof Error ? error.message : 'Unknown error',
          0
        )
      );
      throw error;
    }
  }

  /**
   * Sync case types from legacy system
   */
  private async syncCaseTypes(officeId: OfficeId): Promise<SyncResultDto> {
    const startTime = Date.now();
    try {
      const caseTypes = await this.legacyApiClient.getCaseTypes(officeId);
      const mapped = caseTypes.map(ct => ({
        externalId: ct.id,
        name: ct.name,
        isActive: ct.isActive,
      }));

      const synced = await this.referenceDataRepository!.upsertCaseTypes(officeId, mapped);

      return {
        entityType: 'case_types',
        officeId: officeId.toString(),
        success: true,
        recordsSynced: synced,
        recordsCreated: synced,
        recordsUpdated: 0,
        recordsFailed: 0,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        entityType: 'case_types',
        officeId: officeId.toString(),
        success: false,
        recordsSynced: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        recordsFailed: 1,
        durationMs: Date.now() - startTime,
        errors: [{ externalId: 0, error: error instanceof Error ? error.message : 'Unknown error' }],
      };
    }
  }

  /**
   * Sync status types from legacy system
   */
  private async syncStatusTypes(officeId: OfficeId): Promise<SyncResultDto> {
    const startTime = Date.now();
    try {
      const statusTypes = await this.legacyApiClient.getStatusTypes(officeId);
      const mapped = statusTypes.map(st => ({
        externalId: st.id,
        name: st.name,
        isActive: st.isActive,
      }));

      const synced = await this.referenceDataRepository!.upsertStatusTypes(officeId, mapped);

      return {
        entityType: 'status_types',
        officeId: officeId.toString(),
        success: true,
        recordsSynced: synced,
        recordsCreated: synced,
        recordsUpdated: 0,
        recordsFailed: 0,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        entityType: 'status_types',
        officeId: officeId.toString(),
        success: false,
        recordsSynced: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        recordsFailed: 1,
        durationMs: Date.now() - startTime,
        errors: [{ externalId: 0, error: error instanceof Error ? error.message : 'Unknown error' }],
      };
    }
  }

  /**
   * Sync category types from legacy system
   */
  private async syncCategoryTypes(officeId: OfficeId): Promise<SyncResultDto> {
    const startTime = Date.now();
    try {
      const categoryTypes = await this.legacyApiClient.getCategoryTypes(officeId);
      const mapped = categoryTypes.map(cat => ({
        externalId: cat.id,
        name: cat.name,
        isActive: cat.isActive,
      }));

      const synced = await this.referenceDataRepository!.upsertCategoryTypes(officeId, mapped);

      return {
        entityType: 'category_types',
        officeId: officeId.toString(),
        success: true,
        recordsSynced: synced,
        recordsCreated: synced,
        recordsUpdated: 0,
        recordsFailed: 0,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        entityType: 'category_types',
        officeId: officeId.toString(),
        success: false,
        recordsSynced: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        recordsFailed: 1,
        durationMs: Date.now() - startTime,
        errors: [{ externalId: 0, error: error instanceof Error ? error.message : 'Unknown error' }],
      };
    }
  }

  /**
   * Sync contact types from legacy system
   */
  private async syncContactTypes(officeId: OfficeId): Promise<SyncResultDto> {
    const startTime = Date.now();
    try {
      const contactTypes = await this.legacyApiClient.getContactTypes(officeId);
      const mapped = contactTypes.map(ct => ({
        externalId: ct.id,
        name: ct.name,
        type: ct.type,
        isActive: ct.isActive,
      }));

      const synced = await this.referenceDataRepository!.upsertContactTypes(officeId, mapped);

      return {
        entityType: 'contact_types',
        officeId: officeId.toString(),
        success: true,
        recordsSynced: synced,
        recordsCreated: synced,
        recordsUpdated: 0,
        recordsFailed: 0,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        entityType: 'contact_types',
        officeId: officeId.toString(),
        success: false,
        recordsSynced: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        recordsFailed: 1,
        durationMs: Date.now() - startTime,
        errors: [{ externalId: 0, error: error instanceof Error ? error.message : 'Unknown error' }],
      };
    }
  }

  /**
   * Sync caseworkers from legacy system
   */
  private async syncCaseworkers(officeId: OfficeId): Promise<SyncResultDto> {
    const startTime = Date.now();
    try {
      const caseworkers = await this.legacyApiClient.getCaseworkers(officeId);
      // Map caseworkers, filtering out undefined emails to satisfy exactOptionalPropertyTypes
      const mapped = caseworkers.map(cw => {
        const result: { externalId: number; name: string; email?: string; isActive: boolean } = {
          externalId: cw.id,
          name: cw.name,
          isActive: cw.isActive,
        };
        if (cw.email !== undefined) {
          result.email = cw.email;
        }
        return result;
      });

      const synced = await this.referenceDataRepository!.upsertCaseworkers(officeId, mapped);

      return {
        entityType: 'caseworkers',
        officeId: officeId.toString(),
        success: true,
        recordsSynced: synced,
        recordsCreated: synced,
        recordsUpdated: 0,
        recordsFailed: 0,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        entityType: 'caseworkers',
        officeId: officeId.toString(),
        success: false,
        recordsSynced: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        recordsFailed: 1,
        durationMs: Date.now() - startTime,
        errors: [{ externalId: 0, error: error instanceof Error ? error.message : 'Unknown error' }],
      };
    }
  }

  /**
   * Cancel an ongoing sync operation
   */
  async cancelSync(officeId: OfficeId, entityType: SyncEntityType): Promise<void> {
    // Check if sync is running
    const status = await this.syncStatusRepository.getStatus(officeId, entityType);
    if (!status || status.lastSyncCompletedAt) {
      this.logger.log(`[SyncService] No running sync found for ${entityType}`);
      return;
    }

    // Mark cancellation flag - sync loop will check this and exit gracefully
    await this.syncStatusRepository.markSyncCancelled(officeId, entityType);

    this.logger.log(`[SyncService] Cancellation requested for ${entityType} sync on office ${officeId.toString()}`);
  }

  /**
   * Perform a full sync of all entity types
   */
  async syncAll(officeId: OfficeId, options: { full?: boolean } = {}): Promise<SyncResultDto[]> {
    const results: SyncResultDto[] = [];

    // Sync reference data first
    const refDataResults = await this.syncReferenceData(officeId);
    results.push(...refDataResults);

    // Then sync main entities
    const constituentResult = await this.syncConstituents(officeId, options.full === true ? { full: true } : {});
    results.push(constituentResult);

    const caseResult = await this.syncCases(officeId, options.full === true ? { full: true } : {});
    results.push(caseResult);

    const emailResult = await this.syncEmails(officeId, options.full === true ? { full: true } : {});
    results.push(emailResult);

    return results;
  }
}
