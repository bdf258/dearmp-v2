/**
 * DTO: SyncStatusDto
 *
 * Current sync status for an entity type.
 */
export interface SyncStatusDto {
  entityType: string;
  officeId: string;
  lastSyncStartedAt?: string;
  lastSyncCompletedAt?: string;
  lastSyncSuccess: boolean;
  lastSyncError?: string;
  lastSyncCursor?: string;
  recordsSynced: number;
  recordsFailed: number;
}

/**
 * DTO: SyncProgressDto
 *
 * Progress information for an ongoing sync.
 */
export interface SyncProgressDto {
  entityType: string;
  officeId: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  progress: number; // 0-100
  recordsProcessed: number;
  recordsTotal: number;
  startedAt: string;
  estimatedCompletionAt?: string;
  currentCursor?: string;
}

/**
 * DTO: StartSyncDto
 *
 * Request to start a sync operation.
 */
export interface StartSyncDto {
  entityTypes: string[];
  syncType: 'full' | 'incremental';
  forceRefresh?: boolean;
}

/**
 * DTO: SyncResultDto
 *
 * Result of a sync operation.
 */
export interface SyncResultDto {
  entityType: string;
  officeId: string;
  success: boolean;
  recordsSynced: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsFailed: number;
  durationMs: number;
  errors?: Array<{
    externalId: number;
    error: string;
  }>;
}

/**
 * DTO: SyncAuditLogDto
 *
 * Audit log entry for a sync operation.
 */
export interface SyncAuditLogDto {
  id: string;
  officeId: string;
  entityType: string;
  operation: 'create' | 'update' | 'delete' | 'conflict';
  externalId?: number;
  internalId?: string;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  conflictResolution?: 'legacy_wins' | 'local_wins' | 'merged';
  errorMessage?: string;
  createdAt: string;
}
