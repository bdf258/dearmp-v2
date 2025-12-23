/**
 * Triage Routes E2E Tests
 *
 * Tests for the /triage endpoints:
 * - GET /triage/queue - Get emails pending triage
 * - GET /triage/email/:id - Get email details
 * - POST /triage/confirm - Confirm triage decision
 * - POST /triage/dismiss - Dismiss emails
 * - GET /triage/stats - Get triage statistics
 * - POST /triage/process - Queue email for processing
 * - POST /triage/batch-prefetch - Batch prefetch emails
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express, { RequestHandler } from 'express';
import { createTriageRoutes } from '../../presentation/http/routes/triage';
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
  TEST_VIEWER_USER,
  FIXTURES,
} from './setup';

describe('Triage Routes E2E', () => {
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
    app.use(createMockAuthMiddleware(TEST_CASEWORKER_USER));
    app.use(
      '/triage',
      createTriageRoutes({
        supabase: mockSupabase as unknown as Parameters<typeof createTriageRoutes>[0]['supabase'],
        queueService: mockQueueService as unknown as Parameters<typeof createTriageRoutes>[0]['queueService'],
      })
    );
    app.use(notFoundHandler as unknown as RequestHandler);
    app.use(errorHandler as unknown as RequestHandler);
  });

  describe('GET /triage/queue', () => {
    it('should return pending triage emails with pagination', async () => {
      const mockEmails = [
        FIXTURES.email,
        { ...FIXTURES.email, id: 'email-uuid-456', external_id: 501, subject: 'Another Email' },
      ];

      // Mock RPC failure to trigger direct query fallback
      mockSupabase.rpc = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: { message: 'RPC not found' }, count: null }),
      });

      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: mockEmails, error: null, count: 2 }))
      );

      const response = await request(app)
        .get('/triage/queue')
        .query({ limit: 50, offset: 0 });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            id: 'email-uuid-123',
            externalId: 500,
            subject: 'Test Email Subject',
            fromAddress: 'sender@example.com',
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

    it('should respect ordering parameters', async () => {
      mockSupabase.rpc = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: { message: 'RPC not found' }, count: null }),
      });

      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: [], error: null, count: 0 }))
      );

      await request(app)
        .get('/triage/queue')
        .query({ orderBy: 'created_at', orderDir: 'asc' });

      expect(mockQueryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: true });
    });

    it('should require caseworker role', async () => {
      // Create app with viewer role
      const viewerApp = express();
      viewerApp.use(express.json());
      viewerApp.use(createMockAuthMiddleware(TEST_VIEWER_USER));
      viewerApp.use(
        '/triage',
        createTriageRoutes({
          supabase: mockSupabase as unknown as Parameters<typeof createTriageRoutes>[0]['supabase'],
          queueService: mockQueueService as unknown as Parameters<typeof createTriageRoutes>[0]['queueService'],
        })
      );

      const response = await request(viewerApp).get('/triage/queue');

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Caseworker access required',
        },
      });
    });

    it('should allow admin role access', async () => {
      // Create app with admin role
      const adminApp = express();
      adminApp.use(express.json());
      adminApp.use(createMockAuthMiddleware(TEST_USER));
      adminApp.use(
        '/triage',
        createTriageRoutes({
          supabase: mockSupabase as unknown as Parameters<typeof createTriageRoutes>[0]['supabase'],
          queueService: mockQueueService as unknown as Parameters<typeof createTriageRoutes>[0]['queueService'],
        })
      );

      mockSupabase.rpc = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: { message: 'RPC not found' }, count: null }),
      });

      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: [], error: null, count: 0 }))
      );

      const response = await request(adminApp).get('/triage/queue');

      expect(response.status).toBe(200);
    });
  });

  describe('GET /triage/email/:id', () => {
    it('should return email details', async () => {
      mockQueryBuilder.single = vi.fn().mockResolvedValue({
        data: FIXTURES.email,
        error: null,
      });

      const response = await request(app).get('/triage/email/email-uuid-123');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: 'email-uuid-123',
          officeId: TEST_USER.officeId,
          externalId: 500,
          subject: 'Test Email Subject',
          htmlBody: '<p>This is a test email body</p>',
          fromAddress: 'sender@example.com',
          toAddresses: ['recipient@example.com'],
          type: 'received',
          actioned: false,
        },
      });
    });

    it('should return 404 for non-existent email', async () => {
      mockQueryBuilder.single = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      const response = await request(app).get('/triage/email/non-existent-id');

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Email not found',
        },
      });
    });
  });

  describe('POST /triage/confirm', () => {
    it('should confirm triage decision and link to case', async () => {
      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: null, error: null, count: null }))
      );

      const response = await request(app)
        .post('/triage/confirm')
        .send({
          messageIds: ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'],
          caseId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          confirmedCount: 1,
          caseId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        },
      });
    });

    it('should confirm triage and create new case', async () => {
      // Mock update success
      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: null, error: null, count: null }))
      );

      // Mock email lookup for case creation
      mockQueryBuilder.single = vi.fn().mockResolvedValue({
        data: {
          external_id: 500,
          from_address: 'sender@example.com',
          subject: 'Test Email',
        },
        error: null,
      });

      const response = await request(app)
        .post('/triage/confirm')
        .send({
          messageIds: ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'],
          createCase: true,
          newCase: {
            caseTypeExternalId: 1,
            statusExternalId: 1,
            summary: 'New case from email',
          },
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          confirmedCount: 1,
        },
      });
      expect(mockQueueService.submitTriageDecision).toHaveBeenCalled();
    });

    it('should validate required messageIds', async () => {
      const response = await request(app)
        .post('/triage/confirm')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
        },
      });
    });

    it('should validate messageIds is not empty', async () => {
      const response = await request(app)
        .post('/triage/confirm')
        .send({
          messageIds: [],
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
        },
      });
    });

    it('should validate messageIds are UUIDs', async () => {
      const response = await request(app)
        .post('/triage/confirm')
        .send({
          messageIds: ['not-a-uuid'],
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

  describe('POST /triage/dismiss', () => {
    it('should dismiss emails with reason', async () => {
      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: null, error: null, count: null }))
      );

      const response = await request(app)
        .post('/triage/dismiss')
        .send({
          messageIds: ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'],
          reason: 'Spam emails',
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          dismissedCount: 2,
        },
      });
    });

    it('should dismiss emails without reason', async () => {
      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: null, error: null, count: null }))
      );

      const response = await request(app)
        .post('/triage/dismiss')
        .send({
          messageIds: ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'],
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          dismissedCount: 1,
        },
      });
    });

    it('should validate required messageIds', async () => {
      const response = await request(app)
        .post('/triage/dismiss')
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('GET /triage/stats', () => {
    it('should return triage statistics', async () => {
      // The stats endpoint makes 3 separate queries to supabase:
      // 1. Pending count: select().eq(office_id).eq(actioned:false).eq(type:received)
      // 2. Actioned today: select().eq(office_id).eq(actioned:true).eq(type:received).gte(updated_at)
      // 3. Week data: select().eq(office_id).eq(type:received).gte(received_at)
      let callCount = 0;
      mockSupabase.from = vi.fn().mockImplementation(() => {
        callCount++;
        // Create a mock chain that tracks depth
        const createChain = (depth: number = 0): Record<string, unknown> => {
          // At depth 3+ we might need to return either .gte() or final result
          if (depth >= 3) {
            return {
              eq: vi.fn().mockResolvedValue({ count: 25, data: null, error: null }),
              gte: vi.fn().mockImplementation(() => {
                // For actioned today query (has .gte at end)
                if (callCount === 2) {
                  return Promise.resolve({ count: 10, data: null, error: null });
                }
                // For week data query
                return Promise.resolve({
                  data: [
                    { received_at: '2025-01-14T09:00:00Z', actioned: true },
                    { received_at: '2025-01-15T09:00:00Z', actioned: false },
                    { received_at: '2025-01-15T10:00:00Z', actioned: true },
                  ],
                  error: null,
                });
              }),
            };
          }
          return {
            eq: vi.fn().mockReturnValue(createChain(depth + 1)),
            gte: vi.fn().mockReturnValue(createChain(depth + 1)),
          };
        };

        return {
          select: vi.fn().mockReturnValue(createChain(0)),
        };
      });

      const response = await request(app).get('/triage/stats');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          pendingCount: expect.any(Number),
          actionedTodayCount: expect.any(Number),
        }),
      });
    });
  });

  describe('POST /triage/process', () => {
    it('should queue email for processing', async () => {
      const response = await request(app)
        .post('/triage/process')
        .send({
          emailId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          emailExternalId: 500,
          fromAddress: 'sender@example.com',
          subject: 'Test Email',
        });

      expect(response.status).toBe(202);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          jobId: 'job-id-789',
          message: 'Email queued for processing',
        },
      });
      expect(mockQueueService.scheduleEmailProcessing).toHaveBeenCalledWith(
        TEST_CASEWORKER_USER.officeId,
        expect.objectContaining({
          emailId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          emailExternalId: 500,
          fromAddress: 'sender@example.com',
          subject: 'Test Email',
        })
      );
    });

    it('should queue email without subject', async () => {
      const response = await request(app)
        .post('/triage/process')
        .send({
          emailId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          emailExternalId: 500,
          fromAddress: 'sender@example.com',
        });

      expect(response.status).toBe(202);
      expect(mockQueueService.scheduleEmailProcessing).toHaveBeenCalledWith(
        TEST_CASEWORKER_USER.officeId,
        expect.objectContaining({
          emailId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          emailExternalId: 500,
          fromAddress: 'sender@example.com',
        })
      );
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/triage/process')
        .send({
          emailId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          // Missing emailExternalId and fromAddress
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
        },
      });
    });

    it('should validate email address format', async () => {
      const response = await request(app)
        .post('/triage/process')
        .send({
          emailId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          emailExternalId: 500,
          fromAddress: 'invalid-email',
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

  describe('POST /triage/batch-prefetch', () => {
    it('should queue batch of emails for prefetching', async () => {
      const response = await request(app)
        .post('/triage/batch-prefetch')
        .send({
          emailIds: [
            'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
            'cccccccc-cccc-cccc-cccc-cccccccccccc',
          ],
          prefetchAhead: 5,
        });

      expect(response.status).toBe(202);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          jobId: 'job-id-def',
          message: '3 emails queued for prefetching',
        },
      });
      expect(mockQueueService.scheduleBatchPrefetch).toHaveBeenCalledWith(
        TEST_CASEWORKER_USER.officeId,
        expect.arrayContaining([
          'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          'cccccccc-cccc-cccc-cccc-cccccccccccc',
        ]),
        5
      );
    });

    it('should use default prefetchAhead value', async () => {
      const response = await request(app)
        .post('/triage/batch-prefetch')
        .send({
          emailIds: ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'],
        });

      expect(response.status).toBe(202);
      expect(mockQueueService.scheduleBatchPrefetch).toHaveBeenCalledWith(
        TEST_CASEWORKER_USER.officeId,
        ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'],
        3
      );
    });

    it('should validate emailIds array is not empty', async () => {
      const response = await request(app)
        .post('/triage/batch-prefetch')
        .send({
          emailIds: [],
        });

      expect(response.status).toBe(400);
    });

    it('should validate emailIds array max size', async () => {
      const manyIds = Array.from({ length: 15 }, (_, i) =>
        `${String(i).padStart(8, '0')}-0000-0000-0000-000000000000`
      );

      const response = await request(app)
        .post('/triage/batch-prefetch')
        .send({
          emailIds: manyIds,
        });

      expect(response.status).toBe(400);
    });

    it('should validate prefetchAhead range', async () => {
      const response = await request(app)
        .post('/triage/batch-prefetch')
        .send({
          emailIds: ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'],
          prefetchAhead: 20,
        });

      expect(response.status).toBe(400);
    });
  });
});
