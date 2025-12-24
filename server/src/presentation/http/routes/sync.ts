/**
 * Sync Routes
 *
 * HTTP endpoints for sync operations:
 * - GET /sync/status - Get sync status for all entity types
 * - GET /sync/status/:entityType - Get sync status for specific entity type
 * - POST /sync/start - Start a sync operation (queues job)
 * - POST /sync/cancel - Cancel an ongoing sync
 * - GET /sync/audit-log - Get sync audit log
 */

import { Router, RequestHandler } from 'express';
import { z } from 'zod';
import { SupabaseClient } from '@supabase/supabase-js';
import { AuthenticatedRequest, ApiResponse, ApiError } from '../types';
import { requireAdmin, strictRateLimiter } from '../middleware';
import { QueueService } from '../../../infrastructure/queue';

// Request validation schemas
const StartSyncSchema = z.object({
  entityTypes: z.array(
    z.enum(['constituents', 'cases', 'emails', 'caseworkers', 'case_types', 'status_types', 'category_types', 'contact_types', 'all'])
  ),
  syncType: z.enum(['full', 'incremental']).default('incremental'),
  forceRefresh: z.boolean().optional(),
});

const CancelSyncSchema = z.object({
  entityType: z.enum(['constituents', 'cases', 'emails', 'caseworkers', 'case_types', 'status_types', 'category_types', 'contact_types']),
});

const AuditLogQuerySchema = z.object({
  entityType: z.string().max(100).optional(),
  operation: z.enum(['create', 'update', 'delete', 'conflict']).optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

export interface SyncRoutesDependencies {
  supabase: SupabaseClient;
  queueService: QueueService;
}

// Sync status record type from database
interface SyncStatusRecord {
  entity_type: string;
  office_id: string;
  last_sync_started_at: string | null;
  last_sync_completed_at: string | null;
  last_sync_success: boolean;
  last_sync_error: string | null;
  last_sync_cursor: string | null;
  records_synced: number;
  records_failed: number;
  updated_at: string;
}

// Audit log record type from database
interface AuditLogRecord {
  id: string;
  office_id: string;
  entity_type: string;
  operation: string;
  external_id: number | null;
  internal_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  conflict_resolution: string | null;
  error_message: string | null;
  created_at: string;
}

/**
 * Create sync routes
 */
export function createSyncRoutes({ supabase, queueService }: SyncRoutesDependencies): Router {
  const router = Router();

  /**
   * GET /sync/status
   * Get sync status for all entity types
   */
  const getStatusHandler: RequestHandler = async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { data, error } = await supabase
        .from('sync_status')
        .select('*')
        .eq('office_id', authReq.officeId)
        .order('entity_type');

      if (error) throw error;

      const statuses = (data || []) as SyncStatusRecord[];
      const response: ApiResponse = {
        success: true,
        data: statuses.map((status) => ({
          entityType: status.entity_type,
          officeId: status.office_id,
          lastSyncStartedAt: status.last_sync_started_at,
          lastSyncCompletedAt: status.last_sync_completed_at,
          lastSyncSuccess: status.last_sync_success,
          lastSyncError: status.last_sync_error,
          lastSyncCursor: status.last_sync_cursor,
          recordsSynced: status.records_synced,
          recordsFailed: status.records_failed,
          updatedAt: status.updated_at,
        })),
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  router.get('/status', getStatusHandler);

  /**
   * GET /sync/status/:entityType
   * Get sync status for a specific entity type
   */
  const getStatusByTypeHandler: RequestHandler = async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { entityType } = authReq.params;

      const { data, error } = await supabase
        .from('sync_status')
        .select('*')
        .eq('office_id', authReq.officeId)
        .eq('entity_type', entityType)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (!data) {
        throw ApiError.notFound(`No sync status found for entity type: ${entityType}`);
      }

      const status = data as SyncStatusRecord;
      const response: ApiResponse = {
        success: true,
        data: {
          entityType: status.entity_type,
          officeId: status.office_id,
          lastSyncStartedAt: status.last_sync_started_at,
          lastSyncCompletedAt: status.last_sync_completed_at,
          lastSyncSuccess: status.last_sync_success,
          lastSyncError: status.last_sync_error,
          lastSyncCursor: status.last_sync_cursor,
          recordsSynced: status.records_synced,
          recordsFailed: status.records_failed,
          updatedAt: status.updated_at,
        },
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  router.get('/status/:entityType', getStatusByTypeHandler);

  /**
   * POST /sync/start
   * Start a sync operation (queues a job)
   */
  const startSyncHandler: RequestHandler = async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const body = StartSyncSchema.parse(authReq.body);
      const officeId = authReq.officeId;

      // Check if any sync is already in progress
      const { data: runningSync } = await supabase
        .from('sync_status')
        .select('entity_type, last_sync_started_at')
        .eq('office_id', officeId)
        .is('last_sync_completed_at', null)
        .not('last_sync_started_at', 'is', null)
        .limit(1)
        .single();

      if (runningSync) {
        const syncData = runningSync as { entity_type: string; last_sync_started_at: string };
        throw new ApiError(
          'SYNC_IN_PROGRESS',
          `A sync is already in progress for ${syncData.entity_type}`,
          409,
          { entityType: syncData.entity_type, startedAt: syncData.last_sync_started_at }
        );
      }

      // Reference data entity types
      const refDataTypes = ['caseworkers', 'case_types', 'status_types', 'category_types', 'contact_types'];

      // Queue the sync job
      let jobId: string | null;
      if (body.entityTypes.includes('all')) {
        jobId = await queueService.scheduleSyncAll(officeId, {
          includeReferenceData: true,
          initiatedBy: authReq.user.id,
        });
      } else if (body.syncType === 'full') {
        jobId = await queueService.scheduleSyncAll(officeId, {
          includeReferenceData: body.entityTypes.some((e) => refDataTypes.includes(e)),
          initiatedBy: authReq.user.id,
        });
      } else {
        jobId = await queueService.scheduleIncrementalSync(officeId, {
          initiatedBy: authReq.user.id,
        });
      }

      const response: ApiResponse = {
        success: true,
        data: {
          jobId,
          message: 'Sync job queued successfully',
          entityTypes: body.entityTypes,
          syncType: body.syncType,
        },
      };
      res.status(202).json(response);
    } catch (error) {
      next(error);
    }
  };

  // Apply strict rate limiting (10 req/min) to prevent resource exhaustion
  router.post('/start', strictRateLimiter, requireAdmin as RequestHandler, startSyncHandler);

  /**
   * POST /sync/cancel
   * Cancel an ongoing sync operation
   */
  const cancelSyncHandler: RequestHandler = async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const body = CancelSyncSchema.parse(authReq.body);
      const officeId = authReq.officeId;

      // Mark the sync as cancelled in the database
      const { error } = await supabase
        .from('sync_status')
        .update({
          last_sync_error: 'Cancelled by user',
          last_sync_completed_at: new Date().toISOString(),
          last_sync_success: false,
          updated_at: new Date().toISOString(),
        })
        .eq('office_id', officeId)
        .eq('entity_type', body.entityType)
        .is('last_sync_completed_at', null);

      if (error) throw error;

      const response: ApiResponse = {
        success: true,
        data: {
          message: `Sync cancellation requested for ${body.entityType}`,
          entityType: body.entityType,
        },
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  router.post('/cancel', requireAdmin as RequestHandler, cancelSyncHandler);

  /**
   * GET /sync/audit-log
   * Get sync audit log entries
   */
  const getAuditLogHandler: RequestHandler = async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const query = AuditLogQuerySchema.parse(authReq.query);
      const officeId = authReq.officeId;

      let dbQuery = supabase
        .from('sync_audit_log')
        .select('*', { count: 'exact' })
        .eq('office_id', officeId)
        .order('created_at', { ascending: false })
        .range(query.offset, query.offset + query.limit - 1);

      if (query.entityType) {
        dbQuery = dbQuery.eq('entity_type', query.entityType);
      }
      if (query.operation) {
        dbQuery = dbQuery.eq('operation', query.operation);
      }

      const { data, error, count } = await dbQuery;

      if (error) throw error;

      const logs = (data || []) as AuditLogRecord[];
      const response: ApiResponse = {
        success: true,
        data: logs.map((log) => ({
          id: log.id,
          officeId: log.office_id,
          entityType: log.entity_type,
          operation: log.operation,
          externalId: log.external_id,
          internalId: log.internal_id,
          oldData: log.old_data,
          newData: log.new_data,
          conflictResolution: log.conflict_resolution,
          errorMessage: log.error_message,
          createdAt: log.created_at,
        })),
        meta: {
          offset: query.offset,
          limit: query.limit,
          total: count ?? 0,
          hasMore: (count ?? 0) > query.offset + query.limit,
        },
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  router.get('/audit-log', getAuditLogHandler);

  /**
   * GET /sync/queue-status
   * Get the status of all sync queues
   */
  const getQueueStatusHandler: RequestHandler = async (_req, res, next) => {
    try {
      const queueSizes = await queueService.getAllQueueSizes();
      const healthCheck = await queueService.healthCheck();

      const response: ApiResponse = {
        success: true,
        data: {
          healthy: healthCheck.healthy,
          error: healthCheck.error,
          queues: queueSizes,
        },
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  // Apply strict rate limiting to queue-status to prevent abuse
  router.get('/queue-status', strictRateLimiter, requireAdmin as RequestHandler, getQueueStatusHandler);

  return router;
}
