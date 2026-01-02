/**
 * Health Routes E2E Tests
 *
 * Tests for the /health endpoints:
 * - GET /health - Basic health check
 * - GET /health/live - Liveness probe
 * - GET /health/ready - Readiness probe
 * - GET /health/metrics - Server metrics
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createHealthRoutes } from '../../presentation/http/routes/health';
import {
  createMockSupabaseClient,
  createMockQueryBuilder,
  createMockQueueService,
  MockSupabaseClient,
  MockSupabaseQueryBuilder,
  MockQueueService,
} from './setup';

describe('Health Routes E2E', () => {
  let app: express.Express;
  let mockSupabase: MockSupabaseClient;
  let mockQueryBuilder: MockSupabaseQueryBuilder;
  let mockQueueService: MockQueueService;
  const startTime = new Date();

  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryBuilder = createMockQueryBuilder();
    mockSupabase = createMockSupabaseClient(mockQueryBuilder);
    mockQueueService = createMockQueueService();

    app = express();
    app.use(express.json());
    app.use(
      '/health',
      createHealthRoutes({
        supabase: mockSupabase as unknown as Parameters<typeof createHealthRoutes>[0]['supabase'],
        queueService: mockQueueService as unknown as Parameters<typeof createHealthRoutes>[0]['queueService'],
        startTime,
      })
    );
  });

  describe('GET /health', () => {
    it('should return healthy status with uptime', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          status: 'healthy',
        },
      });
      expect(response.body.data.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should return JSON content type', async () => {
      const response = await request(app).get('/health');

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('GET /health/live', () => {
    it('should return alive status', async () => {
      const response = await request(app).get('/health/live');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'alive' });
    });
  });

  describe('GET /health/ready', () => {
    it('should return healthy when database and queue are available', async () => {
      // Mock database check - successful
      mockQueryBuilder.single = vi.fn().mockResolvedValue({ data: { id: 'office-1' }, error: null });
      mockQueryBuilder.limit = vi.fn().mockReturnThis();

      // Mock queue health check - healthy
      mockQueueService.healthCheck = vi.fn().mockResolvedValue({ healthy: true });

      const response = await request(app).get('/health/ready');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          status: 'healthy',
          checks: {
            database: true,
            queue: true,
          },
        },
      });
      expect(response.body.data.timestamp).toBeDefined();
      expect(response.body.data.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should return degraded when database is available but queue is not', async () => {
      // Mock database check - successful
      mockQueryBuilder.single = vi.fn().mockResolvedValue({ data: { id: 'office-1' }, error: null });
      mockQueryBuilder.limit = vi.fn().mockReturnThis();

      // Mock queue health check - unhealthy
      mockQueueService.healthCheck = vi.fn().mockResolvedValue({ healthy: false, error: 'Queue unavailable' });

      const response = await request(app).get('/health/ready');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          status: 'degraded',
          checks: {
            database: true,
            queue: false,
          },
        },
      });
    });

    it('should return degraded when queue is available but database is not', async () => {
      // Create fresh mocks for this test with database failure
      const failedDbSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: null, error: { message: 'Connection failed' } }),
          }),
        }),
        auth: { getUser: vi.fn() },
      };
      const healthyQueueService = createMockQueueService();
      healthyQueueService.healthCheck = vi.fn().mockResolvedValue({ healthy: true });

      const degradedApp = express();
      degradedApp.use(express.json());
      degradedApp.use(
        '/health',
        createHealthRoutes({
          supabase: failedDbSupabase as unknown as Parameters<typeof createHealthRoutes>[0]['supabase'],
          queueService: healthyQueueService as unknown as Parameters<typeof createHealthRoutes>[0]['queueService'],
          startTime,
        })
      );

      const response = await request(degradedApp).get('/health/ready');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          status: 'degraded',
          checks: {
            database: false,
            queue: true,
          },
        },
      });
    });

    it('should return unhealthy (503) when both database and queue are unavailable', async () => {
      // Create fresh mocks for this test with both failures
      const failedDbSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: null, error: { message: 'Connection failed' } }),
          }),
        }),
        auth: { getUser: vi.fn() },
      };
      const failedQueueService = createMockQueueService();
      failedQueueService.healthCheck = vi.fn().mockResolvedValue({ healthy: false, error: 'Queue unavailable' });

      const unhealthyApp = express();
      unhealthyApp.use(express.json());
      unhealthyApp.use(
        '/health',
        createHealthRoutes({
          supabase: failedDbSupabase as unknown as Parameters<typeof createHealthRoutes>[0]['supabase'],
          queueService: failedQueueService as unknown as Parameters<typeof createHealthRoutes>[0]['queueService'],
          startTime,
        })
      );

      const response = await request(unhealthyApp).get('/health/ready');

      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({
        success: false,
        data: {
          status: 'unhealthy',
          checks: {
            database: false,
            queue: false,
          },
        },
      });
    });

    it('should handle queue service not being configured', async () => {
      // Create app without queue service
      const appWithoutQueue = express();
      appWithoutQueue.use(express.json());
      appWithoutQueue.use(
        '/health',
        createHealthRoutes({
          supabase: mockSupabase as unknown as Parameters<typeof createHealthRoutes>[0]['supabase'],
          queueService: undefined,
          startTime,
        })
      );

      // Mock database check - successful
      mockQueryBuilder.single = vi.fn().mockResolvedValue({ data: { id: 'office-1' }, error: null });
      mockQueryBuilder.limit = vi.fn().mockReturnThis();

      const response = await request(appWithoutQueue).get('/health/ready');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          status: 'healthy',
          checks: {
            database: true,
          },
        },
      });
      // Queue check should not be present when queueService is undefined
      expect(response.body.data.checks.queue).toBeUndefined();
    });
  });

  describe('GET /health/metrics', () => {
    it('should return server metrics', async () => {
      mockQueueService.getAllQueueSizes = vi.fn().mockResolvedValue({
        'sync:all': 5,
        'sync:constituents': 10,
        'sync:cases': 3,
      });

      const response = await request(app).get('/health/metrics');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          uptime: expect.any(Number),
          memory: {
            rss: expect.any(Number),
            heapTotal: expect.any(Number),
            heapUsed: expect.any(Number),
            external: expect.any(Number),
          },
          cpu: {
            user: expect.any(Number),
            system: expect.any(Number),
          },
          nodeVersion: expect.any(String),
          platform: expect.any(String),
          queues: {
            'sync:all': 5,
            'sync:constituents': 10,
            'sync:cases': 3,
          },
        },
      });
    });

    it('should return metrics without queue data when queue service is unavailable', async () => {
      mockQueueService.getAllQueueSizes = vi.fn().mockRejectedValue(new Error('Queue unavailable'));

      const response = await request(app).get('/health/metrics');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          uptime: expect.any(Number),
          memory: expect.any(Object),
          cpu: expect.any(Object),
        },
      });
      expect(response.body.data.queues).toBeUndefined();
    });

    it('should handle missing queue service', async () => {
      // Create app without queue service
      const appWithoutQueue = express();
      appWithoutQueue.use(express.json());
      appWithoutQueue.use(
        '/health',
        createHealthRoutes({
          supabase: mockSupabase as unknown as Parameters<typeof createHealthRoutes>[0]['supabase'],
          queueService: undefined,
          startTime,
        })
      );

      const response = await request(appWithoutQueue).get('/health/metrics');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.queues).toBeUndefined();
    });
  });
});
