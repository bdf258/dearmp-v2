import { OfficeId } from '../value-objects';

/**
 * Base interface for all domain events
 */
export interface DomainEvent {
  readonly eventType: string;
  readonly occurredAt: Date;
  readonly officeId: OfficeId;
}

/**
 * Entity types that can be synced
 */
export type SyncEntityType =
  | 'constituents'
  | 'cases'
  | 'emails'
  | 'caseworkers'
  | 'tags'
  | 'flags'
  | 'case_types'
  | 'status_types'
  | 'category_types'
  | 'contact_types';

/**
 * Event: Sync Started
 *
 * Emitted when a sync operation begins for an entity type.
 */
export class SyncStartedEvent implements DomainEvent {
  readonly eventType = 'sync.started';
  readonly occurredAt: Date;

  constructor(
    readonly officeId: OfficeId,
    readonly entityType: SyncEntityType,
    readonly syncType: 'full' | 'incremental'
  ) {
    this.occurredAt = new Date();
  }
}

/**
 * Event: Sync Completed
 *
 * Emitted when a sync operation completes successfully.
 */
export class SyncCompletedEvent implements DomainEvent {
  readonly eventType = 'sync.completed';
  readonly occurredAt: Date;

  constructor(
    readonly officeId: OfficeId,
    readonly entityType: SyncEntityType,
    readonly recordsSynced: number,
    readonly durationMs: number
  ) {
    this.occurredAt = new Date();
  }
}

/**
 * Event: Sync Failed
 *
 * Emitted when a sync operation fails.
 */
export class SyncFailedEvent implements DomainEvent {
  readonly eventType = 'sync.failed';
  readonly occurredAt: Date;

  constructor(
    readonly officeId: OfficeId,
    readonly entityType: SyncEntityType,
    readonly error: string,
    readonly recordsProcessed: number
  ) {
    this.occurredAt = new Date();
  }
}

/**
 * Event: Sync Conflict
 *
 * Emitted when a data conflict is detected during sync.
 */
export class SyncConflictEvent implements DomainEvent {
  readonly eventType = 'sync.conflict';
  readonly occurredAt: Date;

  constructor(
    readonly officeId: OfficeId,
    readonly entityType: SyncEntityType,
    readonly externalId: number,
    readonly resolution: 'legacy_wins' | 'local_wins' | 'merged',
    readonly details: Record<string, unknown>
  ) {
    this.occurredAt = new Date();
  }
}

/**
 * Event: Entity Created
 *
 * Emitted when a new entity is created via sync.
 */
export class EntityCreatedEvent implements DomainEvent {
  readonly eventType = 'entity.created';
  readonly occurredAt: Date;

  constructor(
    readonly officeId: OfficeId,
    readonly entityType: SyncEntityType,
    readonly internalId: string,
    readonly externalId: number
  ) {
    this.occurredAt = new Date();
  }
}

/**
 * Event: Entity Updated
 *
 * Emitted when an existing entity is updated via sync.
 */
export class EntityUpdatedEvent implements DomainEvent {
  readonly eventType = 'entity.updated';
  readonly occurredAt: Date;

  constructor(
    readonly officeId: OfficeId,
    readonly entityType: SyncEntityType,
    readonly internalId: string,
    readonly externalId: number,
    readonly changedFields: string[]
  ) {
    this.occurredAt = new Date();
  }
}
