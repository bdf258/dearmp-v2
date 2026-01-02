/**
 * E2E Test Setup
 *
 * Provides test utilities and mocks for end-to-end API testing.
 */

import express, { Express, RequestHandler } from 'express';
import { vi } from 'vitest';

// Mock types
export interface MockSupabaseQueryBuilder {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  not: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  range: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
  then: ReturnType<typeof vi.fn>;
}

export interface MockSupabaseClient {
  from: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
  auth: {
    getUser: ReturnType<typeof vi.fn>;
  };
}

export interface MockQueueService {
  scheduleSyncAll: ReturnType<typeof vi.fn>;
  scheduleIncrementalSync: ReturnType<typeof vi.fn>;
  scheduleEmailProcessing: ReturnType<typeof vi.fn>;
  submitTriageDecision: ReturnType<typeof vi.fn>;
  scheduleBatchPrefetch: ReturnType<typeof vi.fn>;
  getAllQueueSizes: ReturnType<typeof vi.fn>;
  healthCheck: ReturnType<typeof vi.fn>;
}

/**
 * Create a mock Supabase query builder
 */
export function createMockQueryBuilder(): MockSupabaseQueryBuilder {
  const builder: MockSupabaseQueryBuilder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    rpc: vi.fn().mockReturnThis(),
    then: vi.fn((callback) =>
      Promise.resolve(callback({ data: [], error: null, count: null }))
    ),
  };
  return builder;
}

/**
 * Create a mock Supabase client
 */
export function createMockSupabaseClient(queryBuilder?: MockSupabaseQueryBuilder): MockSupabaseClient {
  const builder = queryBuilder || createMockQueryBuilder();
  return {
    from: vi.fn().mockReturnValue(builder),
    rpc: vi.fn().mockReturnValue(builder),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: 'test-user-id',
            email: 'test@example.com',
          },
        },
        error: null,
      }),
    },
  };
}

/**
 * Create a mock QueueService
 */
export function createMockQueueService(): MockQueueService {
  return {
    scheduleSyncAll: vi.fn().mockResolvedValue('job-id-123'),
    scheduleIncrementalSync: vi.fn().mockResolvedValue('job-id-456'),
    scheduleEmailProcessing: vi.fn().mockResolvedValue('job-id-789'),
    submitTriageDecision: vi.fn().mockResolvedValue('job-id-abc'),
    scheduleBatchPrefetch: vi.fn().mockResolvedValue('job-id-def'),
    getAllQueueSizes: vi.fn().mockResolvedValue({
      'sync:all': 0,
      'sync:constituents': 0,
      'sync:cases': 0,
      'sync:emails': 0,
    }),
    healthCheck: vi.fn().mockResolvedValue({ healthy: true }),
  };
}

/**
 * Test user data for authenticated requests
 */
export const TEST_USER = {
  id: 'test-user-id',
  email: 'test@example.com',
  officeId: '12345678-1234-1234-1234-123456789abc',
  role: 'admin' as const,
};

export const TEST_CASEWORKER_USER = {
  id: 'caseworker-user-id',
  email: 'caseworker@example.com',
  officeId: '12345678-1234-1234-1234-123456789abc',
  role: 'caseworker' as const,
};

export const TEST_VIEWER_USER = {
  id: 'viewer-user-id',
  email: 'viewer@example.com',
  officeId: '12345678-1234-1234-1234-123456789abc',
  role: 'viewer' as const,
};

/**
 * Create a mock authentication middleware for testing
 */
export function createMockAuthMiddleware(user = TEST_USER): RequestHandler {
  return (req, _res, next) => {
    (req as unknown as { user: typeof user; officeId: string }).user = user;
    (req as unknown as { officeId: string }).officeId = user.officeId;
    next();
  };
}

/**
 * Create a test Express app with common middleware
 */
export function createTestApp(): Express {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  return app;
}

/**
 * Error handler for tests
 */
export const testErrorHandler: RequestHandler = (error, _req, res, _next) => {
  if (error.code) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
  } else if (error.name === 'ZodError') {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: { errors: error.errors },
      },
    });
  } else {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message,
      },
    });
  }
};

/**
 * Common test fixtures
 */
export const FIXTURES = {
  syncStatus: {
    entity_type: 'constituents',
    office_id: TEST_USER.officeId,
    last_sync_started_at: '2025-01-15T10:00:00Z',
    last_sync_completed_at: '2025-01-15T10:05:00Z',
    last_sync_success: true,
    last_sync_error: null,
    last_sync_cursor: null,
    records_synced: 150,
    records_failed: 0,
    updated_at: '2025-01-15T10:05:00Z',
  },
  auditLogEntry: {
    id: 'audit-log-id-1',
    office_id: TEST_USER.officeId,
    entity_type: 'constituents',
    operation: 'create',
    external_id: 12345,
    internal_id: 'internal-uuid',
    old_data: null,
    new_data: { firstName: 'John', lastName: 'Doe' },
    conflict_resolution: null,
    error_message: null,
    created_at: '2025-01-15T10:00:00Z',
  },
  email: {
    id: 'email-uuid-123',
    office_id: TEST_USER.officeId,
    external_id: 500,
    subject: 'Test Email Subject',
    html_body: '<p>This is a test email body</p>',
    from_address: 'sender@example.com',
    to_addresses: ['recipient@example.com'],
    cc_addresses: null,
    bcc_addresses: null,
    type: 'received',
    actioned: false,
    received_at: '2025-01-15T09:00:00Z',
    sent_at: null,
    created_at: '2025-01-15T09:00:00Z',
    constituent_id: null,
    case_id: null,
  },
  caseType: {
    id: 'case-type-uuid-1',
    external_id: 1,
    name: 'Housing',
    is_active: true,
    last_synced_at: '2025-01-15T10:00:00Z',
  },
  statusType: {
    id: 'status-type-uuid-1',
    external_id: 1,
    name: 'Open',
    is_active: true,
    last_synced_at: '2025-01-15T10:00:00Z',
  },
  categoryType: {
    id: 'category-type-uuid-1',
    external_id: 1,
    name: 'General',
    is_active: true,
    last_synced_at: '2025-01-15T10:00:00Z',
  },
  contactType: {
    id: 'contact-type-uuid-1',
    external_id: 1,
    name: 'Phone',
    type: 'incoming',
    is_active: true,
    last_synced_at: '2025-01-15T10:00:00Z',
  },
  caseworker: {
    id: 'caseworker-uuid-1',
    external_id: 1,
    name: 'Jane Smith',
    email: 'jane.smith@example.com',
    is_active: true,
    last_synced_at: '2025-01-15T10:00:00Z',
  },
  tag: {
    id: 'tag-uuid-1',
    external_id: 1,
    tag: 'Urgent',
    last_synced_at: '2025-01-15T10:00:00Z',
  },
  flag: {
    id: 'flag-uuid-1',
    external_id: 1,
    flag: 'VIP',
    last_synced_at: '2025-01-15T10:00:00Z',
  },
};
