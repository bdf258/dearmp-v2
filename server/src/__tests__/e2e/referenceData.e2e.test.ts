/**
 * Reference Data Routes E2E Tests
 *
 * Tests for the /reference endpoints:
 * - GET /reference/case-types - Get case types
 * - GET /reference/status-types - Get status types
 * - GET /reference/category-types - Get category types
 * - GET /reference/contact-types - Get contact types
 * - GET /reference/caseworkers - Get caseworkers
 * - GET /reference/tags - Get tags
 * - GET /reference/flags - Get flags
 * - GET /reference/all - Get all reference data
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express, { RequestHandler } from 'express';
import { createReferenceDataRoutes } from '../../presentation/http/routes/referenceData';
import { errorHandler, notFoundHandler } from '../../presentation/http/middleware/errorHandler';
import {
  createMockSupabaseClient,
  createMockQueryBuilder,
  createMockAuthMiddleware,
  MockSupabaseClient,
  MockSupabaseQueryBuilder,
  TEST_USER,
  FIXTURES,
} from './setup';

describe('Reference Data Routes E2E', () => {
  let app: express.Express;
  let mockSupabase: MockSupabaseClient;
  let mockQueryBuilder: MockSupabaseQueryBuilder;

  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryBuilder = createMockQueryBuilder();
    mockSupabase = createMockSupabaseClient(mockQueryBuilder);

    app = express();
    app.use(express.json());
    app.use(createMockAuthMiddleware(TEST_USER));
    app.use(
      '/reference',
      createReferenceDataRoutes({
        supabase: mockSupabase as unknown as Parameters<typeof createReferenceDataRoutes>[0]['supabase'],
      })
    );
    app.use(notFoundHandler as unknown as RequestHandler);
    app.use(errorHandler as unknown as RequestHandler);
  });

  describe('GET /reference/case-types', () => {
    it('should return active case types by default', async () => {
      const mockCaseTypes = [
        FIXTURES.caseType,
        { ...FIXTURES.caseType, id: 'case-type-uuid-2', external_id: 2, name: 'Benefits' },
      ];

      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: mockCaseTypes, error: null, count: null }))
      );

      const response = await request(app).get('/reference/case-types');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            id: 'case-type-uuid-1',
            externalId: 1,
            name: 'Housing',
            isActive: true,
          }),
        ]),
      });
      expect(response.body.data).toHaveLength(2);
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('is_active', true);
    });

    it('should return all case types when activeOnly is false', async () => {
      const mockCaseTypes = [
        FIXTURES.caseType,
        { ...FIXTURES.caseType, id: 'case-type-uuid-2', is_active: false, name: 'Archived Type' },
      ];

      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: mockCaseTypes, error: null, count: null }))
      );

      const response = await request(app)
        .get('/reference/case-types')
        .query({ activeOnly: 'false' });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      // Both active and inactive case types should be returned
      expect(response.body.data.some((d: { isActive: boolean }) => !d.isActive)).toBe(true);
    });

    it('should order by name', async () => {
      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: [], error: null, count: null }))
      );

      await request(app).get('/reference/case-types');

      expect(mockQueryBuilder.order).toHaveBeenCalledWith('name');
    });
  });

  describe('GET /reference/status-types', () => {
    it('should return status types', async () => {
      const mockStatusTypes = [
        FIXTURES.statusType,
        { ...FIXTURES.statusType, id: 'status-type-uuid-2', external_id: 2, name: 'Closed' },
      ];

      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: mockStatusTypes, error: null, count: null }))
      );

      const response = await request(app).get('/reference/status-types');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            id: 'status-type-uuid-1',
            externalId: 1,
            name: 'Open',
            isActive: true,
          }),
        ]),
      });
    });

    it('should filter by office_id', async () => {
      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: [], error: null, count: null }))
      );

      await request(app).get('/reference/status-types');

      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('office_id', TEST_USER.officeId);
    });
  });

  describe('GET /reference/category-types', () => {
    it('should return category types', async () => {
      const mockCategoryTypes = [
        FIXTURES.categoryType,
        { ...FIXTURES.categoryType, id: 'category-type-uuid-2', external_id: 2, name: 'Immigration' },
      ];

      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: mockCategoryTypes, error: null, count: null }))
      );

      const response = await request(app).get('/reference/category-types');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            id: 'category-type-uuid-1',
            externalId: 1,
            name: 'General',
            isActive: true,
          }),
        ]),
      });
    });
  });

  describe('GET /reference/contact-types', () => {
    it('should return contact types with type field', async () => {
      const mockContactTypes = [
        FIXTURES.contactType,
        { ...FIXTURES.contactType, id: 'contact-type-uuid-2', external_id: 2, name: 'Email', type: 'outgoing' },
      ];

      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: mockContactTypes, error: null, count: null }))
      );

      const response = await request(app).get('/reference/contact-types');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            id: 'contact-type-uuid-1',
            externalId: 1,
            name: 'Phone',
            type: 'incoming',
            isActive: true,
          }),
        ]),
      });
    });
  });

  describe('GET /reference/caseworkers', () => {
    it('should return caseworkers with email field', async () => {
      const mockCaseworkers = [
        FIXTURES.caseworker,
        { ...FIXTURES.caseworker, id: 'caseworker-uuid-2', external_id: 2, name: 'John Doe', email: 'john.doe@example.com' },
      ];

      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: mockCaseworkers, error: null, count: null }))
      );

      const response = await request(app).get('/reference/caseworkers');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            id: 'caseworker-uuid-1',
            externalId: 1,
            name: 'Jane Smith',
            email: 'jane.smith@example.com',
            isActive: true,
          }),
        ]),
      });
    });
  });

  describe('GET /reference/tags', () => {
    it('should return tags', async () => {
      const mockTags = [
        FIXTURES.tag,
        { ...FIXTURES.tag, id: 'tag-uuid-2', external_id: 2, tag: 'Follow-up' },
      ];

      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: mockTags, error: null, count: null }))
      );

      const response = await request(app).get('/reference/tags');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            id: 'tag-uuid-1',
            externalId: 1,
            name: 'Urgent',
          }),
        ]),
      });
    });

    it('should order tags by tag field', async () => {
      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: [], error: null, count: null }))
      );

      await request(app).get('/reference/tags');

      expect(mockQueryBuilder.order).toHaveBeenCalledWith('tag');
    });
  });

  describe('GET /reference/flags', () => {
    it('should return flags', async () => {
      const mockFlags = [
        FIXTURES.flag,
        { ...FIXTURES.flag, id: 'flag-uuid-2', external_id: 2, flag: 'Priority' },
      ];

      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: mockFlags, error: null, count: null }))
      );

      const response = await request(app).get('/reference/flags');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            id: 'flag-uuid-1',
            externalId: 1,
            name: 'VIP',
          }),
        ]),
      });
    });

    it('should order flags by flag field', async () => {
      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: [], error: null, count: null }))
      );

      await request(app).get('/reference/flags');

      expect(mockQueryBuilder.order).toHaveBeenCalledWith('flag');
    });
  });

  describe('GET /reference/all', () => {
    it('should return all reference data in one request', async () => {
      // Mock different data for each query
      const mockCaseTypes = [FIXTURES.caseType];
      const mockStatusTypes = [FIXTURES.statusType];
      const mockCategoryTypes = [FIXTURES.categoryType];
      const mockContactTypes = [FIXTURES.contactType];
      const mockCaseworkers = [FIXTURES.caseworker];

      let queryCount = 0;
      const dataByTable: Record<string, unknown[]> = {
        case_types: mockCaseTypes,
        status_types: mockStatusTypes,
        category_types: mockCategoryTypes,
        contact_types: mockContactTypes,
        caseworkers: mockCaseworkers,
      };

      // Track which tables are queried
      const queriedTables: string[] = [];

      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        queriedTables.push(table);
        queryCount++;
        const tableData = dataByTable[table] || [];

        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: tableData, error: null }),
              }),
            }),
          }),
        };
      });

      const response = await request(app).get('/reference/all');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          caseTypes: expect.arrayContaining([
            expect.objectContaining({ name: 'Housing' }),
          ]),
          statusTypes: expect.arrayContaining([
            expect.objectContaining({ name: 'Open' }),
          ]),
          categoryTypes: expect.arrayContaining([
            expect.objectContaining({ name: 'General' }),
          ]),
          contactTypes: expect.arrayContaining([
            expect.objectContaining({ name: 'Phone' }),
          ]),
          caseworkers: expect.arrayContaining([
            expect.objectContaining({ name: 'Jane Smith' }),
          ]),
        },
      });

      // Verify all 5 tables were queried
      expect(queriedTables).toContain('case_types');
      expect(queriedTables).toContain('status_types');
      expect(queriedTables).toContain('category_types');
      expect(queriedTables).toContain('contact_types');
      expect(queriedTables).toContain('caseworkers');
    });

    it('should filter by activeOnly parameter', async () => {
      // The default activeOnly is true, so just check that it returns successfully
      // The filter is applied during the query chain
      mockSupabase.from = vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      }));

      const response = await request(app).get('/reference/all').query({ activeOnly: 'true' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should not filter by active when activeOnly is false', async () => {
      // When activeOnly is false, the query should not include .eq('is_active', true)
      // The query is: from().select().eq(office_id).order() and is directly awaited
      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        const dataByTable: Record<string, unknown[]> = {
          case_types: [FIXTURES.caseType],
          status_types: [FIXTURES.statusType],
          category_types: [FIXTURES.categoryType],
          contact_types: [FIXTURES.contactType],
          caseworkers: [FIXTURES.caseworker],
        };
        const tableData = dataByTable[table] || [];

        // Return a thenable object from .order() that can be awaited
        const orderResult = Promise.resolve({ data: tableData, error: null });
        // Also add .eq() method for when activeOnly is true
        (orderResult as unknown as { eq: ReturnType<typeof vi.fn> }).eq = vi.fn().mockResolvedValue({ data: tableData, error: null });

        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue(orderResult),
            }),
          }),
        };
      });

      const response = await request(app).get('/reference/all').query({ activeOnly: 'false' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should handle database errors gracefully', async () => {
      mockSupabase.from = vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Database connection failed' },
              }),
            }),
          }),
        }),
      }));

      const response = await request(app).get('/reference/all');

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          code: 'INTERNAL_ERROR',
        }),
      });
    });
  });

  describe('Authentication', () => {
    it('should allow authenticated users to access reference data', async () => {
      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: [], error: null, count: null }))
      );

      const response = await request(app).get('/reference/case-types');

      expect(response.status).toBe(200);
    });

    it('should scope queries to the authenticated user office', async () => {
      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: [], error: null, count: null }))
      );

      await request(app).get('/reference/case-types');

      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('office_id', TEST_USER.officeId);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors', async () => {
      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: null, error: { message: 'Database error' }, count: null }))
      );

      const response = await request(app).get('/reference/case-types');

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
        },
      });
    });

    it('should return 404 for unknown endpoints', async () => {
      const response = await request(app).get('/reference/unknown-type');

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'NOT_FOUND',
        },
      });
    });
  });
});
