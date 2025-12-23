/**
 * Sync Routes E2E Tests
 *
 * Tests for the /sync endpoints:
 * - GET /sync/status - Get sync status for all entity types
 * - GET /sync/status/:entityType - Get sync status for specific entity
 * - POST /sync/start - Start a sync operation
 * - POST /sync/cancel - Cancel an ongoing sync
 * - GET /sync/audit-log - Get sync audit log
 * - GET /sync/queue-status - Get queue status
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express, { RequestHandler } from 'express';
import { createSyncRoutes } from '../../presentation/http/routes/sync';
import { errorHandler, notFoundHandler } from '../../presentation/http/middleware/errorHandler';
import {
  createMockSupabaseClient,
  createMockQueryBuilder,
  createMockQueueService,
  createMockAuthMiddleware,
  MockSupabaseClient,
  MockSupabaseQueryBuilder,
  MockQueueService,
  TEST_USER,
  TEST_CASEWORKER_USER,
  FIXTURES,
} from './setup';

describe('Sync Routes E2E', () => {
  let app: express.Express;
  let mockSupabase: MockSupabaseClient;
  let mockQueryBuilder: MockSupabaseQueryBuilder;
  let mockQueueService: MockQueueService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryBuilder = createMockQueryBuilder();
    mockSupabase = createMockSupabaseClient(mockQueryBuilder);
    mockQueueService = createMockQueueService();

    app = express();
    app.use(express.json());
    app.use(createMockAuthMiddleware(TEST_USER));
    app.use(
      '/sync',
      createSyncRoutes({
        supabase: mockSupabase as unknown as Parameters<typeof createSyncRoutes>[0]['supabase'],
        queueService: mockQueueService as unknown as Parameters<typeof createSyncRoutes>[0]['queueService'],
      })
    );
    app.use(notFoundHandler as unknown as RequestHandler);
    app.use(errorHandler as unknown as RequestHandler);
  });

  describe('GET /sync/status', () => {
    it('should return sync status for all entity types', async () => {
      const mockStatuses = [
        FIXTURES.syncStatus,
        { ...FIXTURES.syncStatus, entity_type: 'cases' },
        { ...FIXTURES.syncStatus, entity_type: 'emails' },
      ];

      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: mockStatuses, error: null, count: null }))
      );

      const response = await request(app).get('/sync/status');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            entityType: 'constituents',
            officeId: TEST_USER.officeId,
            lastSyncSuccess: true,
            recordsSynced: 150,
          }),
        ]),
      });
      expect(response.body.data).toHaveLength(3);
    });

    it('should return empty array when no sync status exists', async () => {
      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: [], error: null, count: null }))
      );

      const response = await request(app).get('/sync/status');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: [],
      });
    });
  });

  describe('GET /sync/status/:entityType', () => {
    it('should return sync status for specific entity type', async () => {
      mockQueryBuilder.single = vi.fn().mockResolvedValue({
        data: FIXTURES.syncStatus,
        error: null,
      });

      const response = await request(app).get('/sync/status/constituents');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          entityType: 'constituents',
          officeId: TEST_USER.officeId,
          lastSyncStartedAt: '2025-01-15T10:00:00Z',
          lastSyncCompletedAt: '2025-01-15T10:05:00Z',
          lastSyncSuccess: true,
          recordsSynced: 150,
          recordsFailed: 0,
        },
      });
    });

    it('should return 404 when entity type not found', async () => {
      mockQueryBuilder.single = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      const response = await request(app).get('/sync/status/unknown');

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: expect.stringContaining('unknown'),
        },
      });
    });
  });

  describe('POST /sync/start', () => {
    it('should start a sync job for all entities', async () => {
      // Mock check for running sync - none running
      mockQueryBuilder.single = vi.fn().mockResolvedValue({ data: null, error: null });

      const response = await request(app)
        .post('/sync/start')
        .send({
          entityTypes: ['all'],
          syncType: 'full',
        });

      expect(response.status).toBe(202);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          jobId: 'job-id-123',
          message: 'Sync job queued successfully',
          entityTypes: ['all'],
          syncType: 'full',
        },
      });
      expect(mockQueueService.scheduleSyncAll).toHaveBeenCalledWith(
        TEST_USER.officeId,
        expect.objectContaining({
          includeReferenceData: true,
          initiatedBy: TEST_USER.id,
        })
      );
    });

    it('should start an incremental sync job', async () => {
      // Mock check for running sync - none running
      mockQueryBuilder.single = vi.fn().mockResolvedValue({ data: null, error: null });

      const response = await request(app)
        .post('/sync/start')
        .send({
          entityTypes: ['constituents', 'cases'],
          syncType: 'incremental',
        });

      expect(response.status).toBe(202);
      expect(mockQueueService.scheduleIncrementalSync).toHaveBeenCalledWith(
        TEST_USER.officeId,
        expect.objectContaining({
          initiatedBy: TEST_USER.id,
        })
      );
    });

    it('should return 409 when sync is already in progress', async () => {
      // Mock check for running sync - one is running
      mockQueryBuilder.single = vi.fn().mockResolvedValue({
        data: {
          entity_type: 'constituents',
          last_sync_started_at: '2025-01-15T10:00:00Z',
        },
        error: null,
      });

      const response = await request(app)
        .post('/sync/start')
        .send({
          entityTypes: ['all'],
          syncType: 'full',
        });

      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'SYNC_IN_PROGRESS',
          message: expect.stringContaining('already in progress'),
        },
      });
    });

    it('should return validation error for invalid entity types', async () => {
      const response = await request(app)
        .post('/sync/start')
        .send({
          entityTypes: ['invalid_type'],
          syncType: 'full',
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
        },
      });
    });

    it('should require admin role', async () => {
      // Create app with caseworker role
      const caseworkerApp = express();
      caseworkerApp.use(express.json());
      caseworkerApp.use(createMockAuthMiddleware(TEST_CASEWORKER_USER));
      caseworkerApp.use(
        '/sync',
        createSyncRoutes({
          supabase: mockSupabase as unknown as Parameters<typeof createSyncRoutes>[0]['supabase'],
          queueService: mockQueueService as unknown as Parameters<typeof createSyncRoutes>[0]['queueService'],
        })
      );

      const response = await request(caseworkerApp)
        .post('/sync/start')
        .send({
          entityTypes: ['all'],
          syncType: 'full',
        });

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Admin access required',
        },
      });
    });
  });

  describe('POST /sync/cancel', () => {
    it('should cancel an ongoing sync', async () => {
      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: null, error: null, count: null }))
      );

      const response = await request(app)
        .post('/sync/cancel')
        .send({
          entityType: 'constituents',
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          message: expect.stringContaining('cancellation requested'),
          entityType: 'constituents',
        },
      });
    });

    it('should return validation error for invalid entity type', async () => {
      const response = await request(app)
        .post('/sync/cancel')
        .send({
          entityType: 'invalid_type',
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
        },
      });
    });
  });

  describe('GET /sync/audit-log', () => {
    it('should return audit log entries with pagination', async () => {
      const mockLogs = [
        FIXTURES.auditLogEntry,
        { ...FIXTURES.auditLogEntry, id: 'audit-log-id-2', operation: 'update' },
      ];

      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: mockLogs, error: null, count: 2 }))
      );

      const response = await request(app)
        .get('/sync/audit-log')
        .query({ limit: 50, offset: 0 });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            id: 'audit-log-id-1',
            entityType: 'constituents',
            operation: 'create',
          }),
        ]),
        meta: {
          offset: 0,
          limit: 50,
          total: 2,
          hasMore: false,
        },
      });
    });

    it('should filter audit log by entity type', async () => {
      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: [FIXTURES.auditLogEntry], error: null, count: 1 }))
      );

      const response = await request(app)
        .get('/sync/audit-log')
        .query({ entityType: 'constituents' });

      expect(response.status).toBe(200);
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('entity_type', 'constituents');
    });

    it('should filter audit log by operation', async () => {
      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: [], error: null, count: 0 }))
      );

      const response = await request(app)
        .get('/sync/audit-log')
        .query({ operation: 'create' });

      expect(response.status).toBe(200);
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('operation', 'create');
    });

    it('should respect pagination parameters', async () => {
      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: [], error: null, count: 100 }))
      );

      const response = await request(app)
        .get('/sync/audit-log')
        .query({ limit: 25, offset: 50 });

      expect(response.status).toBe(200);
      expect(response.body.meta).toMatchObject({
        offset: 50,
        limit: 25,
        total: 100,
        hasMore: true,
      });
    });
  });

  describe('GET /sync/queue-status', () => {
    it('should return queue status for admin users', async () => {
      mockQueueService.getAllQueueSizes = vi.fn().mockResolvedValue({
        'sync:all': 0,
        'sync:constituents': 5,
        'sync:cases': 2,
        'sync:emails': 10,
      });
      mockQueueService.healthCheck = vi.fn().mockResolvedValue({ healthy: true });

      const response = await request(app).get('/sync/queue-status');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          healthy: true,
          queues: {
            'sync:all': 0,
            'sync:constituents': 5,
            'sync:cases': 2,
            'sync:emails': 10,
          },
        },
      });
    });

    it('should return unhealthy status when queue has issues', async () => {
      mockQueueService.getAllQueueSizes = vi.fn().mockResolvedValue({});
      mockQueueService.healthCheck = vi.fn().mockResolvedValue({
        healthy: false,
        error: 'Connection lost',
      });

      const response = await request(app).get('/sync/queue-status');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          healthy: false,
          error: 'Connection lost',
        },
      });
    });

    it('should require admin role', async () => {
      // Create app with caseworker role
      const caseworkerApp = express();
      caseworkerApp.use(express.json());
      caseworkerApp.use(createMockAuthMiddleware(TEST_CASEWORKER_USER));
      caseworkerApp.use(
        '/sync',
        createSyncRoutes({
          supabase: mockSupabase as unknown as Parameters<typeof createSyncRoutes>[0]['supabase'],
          queueService: mockQueueService as unknown as Parameters<typeof createSyncRoutes>[0]['queueService'],
        })
      );

      const response = await request(caseworkerApp).get('/sync/queue-status');

      expect(response.status).toBe(403);
    });
  });
});
