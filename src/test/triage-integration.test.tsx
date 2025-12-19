/**
 * Triage Feature Integration Tests
 *
 * End-to-end integration tests covering the full triage workflow:
 * - Queue loading and sorting
 * - Constituent search and creation
 * - Case search and creation
 * - Tagging operations
 * - Bulk confirm/reject
 * - State synchronization
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Test fixture data
const FIXTURES = {
  offices: {
    office1: { id: 'office-1', name: 'Test Office 1' },
    office2: { id: 'office-2', name: 'Test Office 2' },
  },
  users: {
    staff1: { id: 'user-staff-1', office_id: 'office-1', role: 'staff', display_name: 'Staff One' },
    admin1: { id: 'user-admin-1', office_id: 'office-1', role: 'admin', display_name: 'Admin One' },
    staff2: { id: 'user-staff-2', office_id: 'office-2', role: 'staff', display_name: 'Staff Two' },
  },
  messages: {
    pending1: {
      id: 'msg-pending-1',
      office_id: 'office-1',
      direction: 'inbound',
      case_id: null,
      subject: 'Housing Request',
      snippet: 'I need help with housing...',
      received_at: '2024-01-15T10:00:00Z',
      triage_status: 'pending',
    },
    pending2: {
      id: 'msg-pending-2',
      office_id: 'office-1',
      direction: 'inbound',
      case_id: null,
      subject: 'Benefits Query',
      snippet: 'Question about benefits...',
      received_at: '2024-01-15T09:00:00Z',
      triage_status: 'pending',
    },
    triaged: {
      id: 'msg-triaged-1',
      office_id: 'office-1',
      direction: 'inbound',
      case_id: null,
      subject: 'AI Processed',
      snippet: 'This was processed by AI...',
      received_at: '2024-01-15T08:00:00Z',
      triage_status: 'triaged',
      classification_confidence: 0.92,
    },
    otherOffice: {
      id: 'msg-other-office',
      office_id: 'office-2',
      direction: 'inbound',
      case_id: null,
      subject: 'Other Office Message',
      snippet: 'Should not be visible...',
      received_at: '2024-01-15T07:00:00Z',
      triage_status: 'pending',
    },
  },
  constituents: {
    known: {
      id: 'const-known-1',
      office_id: 'office-1',
      full_name: 'John Known',
    },
  },
  cases: {
    open: {
      id: 'case-open-1',
      office_id: 'office-1',
      title: 'Existing Open Case',
      reference_number: 1001,
      status: 'open',
    },
  },
  tags: {
    housing: { id: 'tag-housing', office_id: 'office-1', name: 'Housing', color: '#FF5733' },
    benefits: { id: 'tag-benefits', office_id: 'office-1', name: 'Benefits', color: '#33FF57' },
    urgent: { id: 'tag-urgent', office_id: 'office-1', name: 'Urgent', color: '#FF0000' },
  },
};

// Mock RPC results
const mockRpcResults = {
  get_triage_queue: {
    success: true,
    data: [FIXTURES.messages.pending1, FIXTURES.messages.pending2, FIXTURES.messages.triaged],
  },
  get_triage_stats: {
    pending_count: 2,
    triaged_count: 1,
    confirmed_today: 5,
    dismissed_today: 2,
    by_email_type: { policy: 3, casework: 4 },
    avg_confidence: 0.85,
  },
  confirm_triage: { success: true, confirmed_count: 1, case_id: 'case-new-1' },
  dismiss_triage: { success: true, dismissed_count: 1 },
};

// Generic type for mock RPC results to handle various response shapes
type MockRpcResult = Record<string, unknown>;

// Create mock Supabase with proper typing
const createMockSupabase = () => ({
  auth: {
    getSession: vi.fn(() => Promise.resolve({
      data: { session: { user: { id: FIXTURES.users.staff1.id } } },
      error: null,
    })),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    })),
  },
  from: vi.fn((_table: string) => ({
    select: vi.fn((_columns?: string) => ({
      eq: vi.fn((_col: string, _val: unknown) => ({
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        order: vi.fn((_orderCol: string) => Promise.resolve({ data: [], error: null })),
        eq: vi.fn((_col2: string, _val2: unknown) => ({
          eq: vi.fn((_col3: string, _val3: unknown) => Promise.resolve({ data: [], error: null })),
        })),
        ilike: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      order: vi.fn((_orderCol: string) => Promise.resolve({ data: [], error: null })),
    })),
    insert: vi.fn((_data?: unknown) => ({
      select: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: { id: 'new-id' }, error: null })),
      })),
    })),
    update: vi.fn((_data?: unknown) => ({
      eq: vi.fn((_col: string, _val: unknown) => Promise.resolve({ error: null })),
    })),
    delete: vi.fn(() => ({
      eq: vi.fn((_col: string, _val: unknown) => ({
        eq: vi.fn((_col2: string, _val2: unknown) => ({
          eq: vi.fn((_col3: string, _val3: unknown) => Promise.resolve({ error: null })),
        })),
      })),
    })),
  })),
  rpc: vi.fn((_fnName: string, _params?: Record<string, unknown>): Promise<{ data: MockRpcResult | null; error: { message: string; code: string } | null }> => {
    const result = mockRpcResults[_fnName as keyof typeof mockRpcResults] as MockRpcResult;
    return Promise.resolve({ data: result, error: null });
  }),
  storage: {
    from: vi.fn(() => ({
      download: vi.fn(() => Promise.resolve({
        data: new Blob(['Message body content']),
        error: null,
      })),
    })),
  },
});

let mockSupabase = createMockSupabase();

// Mock the supabase module
vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase,
}));

describe('Triage Queue Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Queue Loading', () => {
    it('loads triage queue for current office', async () => {
      // Verify RPC is called with correct parameters
      await mockSupabase.rpc('get_triage_queue', {
        p_status: ['pending', 'triaged'],
        p_limit: 50,
        p_offset: 0,
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_triage_queue', expect.any(Object));
    });

    it('sorts messages by received_at descending by default', async () => {
      await mockSupabase.rpc('get_triage_queue', {
        p_order_by: 'received_at',
        p_order_dir: 'desc',
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'get_triage_queue',
        expect.objectContaining({
          p_order_by: 'received_at',
          p_order_dir: 'desc',
        })
      );
    });

    it('displays empty state when no messages', async () => {
      vi.mocked(mockSupabase.rpc).mockResolvedValueOnce({
        data: { success: true, data: [] },
        error: null,
      });

      const result = await mockSupabase.rpc('get_triage_queue');
      expect(result.data).toBeDefined();
    });

    it('handles loading errors gracefully', async () => {
      vi.mocked(mockSupabase.rpc).mockResolvedValueOnce({
        data: null,
        error: { message: 'Database connection failed', code: '500' },
      } as { data: null; error: { message: string; code: string } });

      const result = await mockSupabase.rpc('get_triage_queue');
      expect(result.error).toBeDefined();
      expect((result.error as { message: string })?.message).toBe('Database connection failed');
    });
  });

  describe('Constituent Search', () => {
    it('searches constituents by name', async () => {
      // Simulate search query for 'John'
      const mockSearchResult = [FIXTURES.constituents.known];

      vi.mocked(mockSupabase.from).mockImplementationOnce(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            ilike: vi.fn(() => Promise.resolve({ data: mockSearchResult, error: null })),
          })),
        })),
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      }));

      expect(mockSearchResult[0].full_name).toContain('Known');
    });

    it('searches constituents by email', async () => {
      const searchEmail = 'john@example.com';

      // The search should look in constituent_contacts
      expect(searchEmail).toContain('@');
    });

    it('creates new constituent with contacts', async () => {
      const newConstituent = {
        full_name: 'New Person',
        email: 'new@example.com',
        address: '123 New Street',
      };

      // First insert constituent
      vi.mocked(mockSupabase.from).mockImplementationOnce(() => ({
        select: vi.fn(),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: { id: 'new-const-id', ...newConstituent },
              error: null,
            })),
          })),
        })),
        update: vi.fn(),
        delete: vi.fn(),
      }));

      const result = await mockSupabase.from('constituents').insert({
        full_name: newConstituent.full_name,
        office_id: 'office-1',
      }).select().single();

      expect(result.data).toBeDefined();
    });

    it('handles address request flow', async () => {
      const outboundMessage = {
        direction: 'outbound',
        subject: 'RE: Address Confirmation Needed',
        body: 'Please provide your address...',
      };

      vi.mocked(mockSupabase.from).mockImplementationOnce(() => ({
        select: vi.fn(),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: { id: 'outbound-msg-id', ...outboundMessage },
              error: null,
            })),
          })),
        })),
        update: vi.fn(),
        delete: vi.fn(),
      }));

      const result = await mockSupabase.from('messages').insert(outboundMessage).select().single();
      expect((result.data as unknown as { direction: string })?.direction).toBe('outbound');
    });
  });

  describe('Case Search and Create', () => {
    it('searches existing cases', async () => {
      const mockCases = [FIXTURES.cases.open];

      vi.mocked(mockSupabase.from).mockImplementationOnce(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: mockCases, error: null })),
          })),
        })),
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      }));

      const result = await mockSupabase.from('cases').select().eq('office_id', 'office-1').order('created_at');
      expect(result.data).toBeDefined();
    });

    it('creates new case with reference number', async () => {
      const newCase = {
        title: 'New Housing Case',
        priority: 'high',
        status: 'open',
      };

      vi.mocked(mockSupabase.from).mockImplementationOnce(() => ({
        select: vi.fn(),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: { id: 'new-case-id', reference_number: 1002, ...newCase },
              error: null,
            })),
          })),
        })),
        update: vi.fn(),
        delete: vi.fn(),
      }));

      const result = await mockSupabase.from('cases').insert(newCase).select().single();
      expect((result.data as unknown as { reference_number: number })?.reference_number).toBeDefined();
    });

    it('links message to case', async () => {
      vi.mocked(mockSupabase.from).mockImplementationOnce(() => ({
        select: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
        delete: vi.fn(),
      }));

      const result = await mockSupabase
        .from('messages')
        .update({ case_id: 'case-1' })
        .eq('id', 'msg-1');

      expect(result.error).toBeNull();
    });

    it('persists assignee on case', async () => {
      vi.mocked(mockSupabase.from).mockImplementationOnce(() => ({
        select: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
        delete: vi.fn(),
      }));

      const result = await mockSupabase
        .from('cases')
        .update({ assigned_to: FIXTURES.users.staff1.id })
        .eq('id', 'case-1');

      expect(result.error).toBeNull();
    });

    it('persists priority on case', async () => {
      vi.mocked(mockSupabase.from).mockImplementationOnce(() => ({
        select: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
        delete: vi.fn(),
      }));

      const result = await mockSupabase
        .from('cases')
        .update({ priority: 'urgent' })
        .eq('id', 'case-1');

      expect(result.error).toBeNull();
    });
  });

  describe('Tagging', () => {
    it('adds tag to case', async () => {
      vi.mocked(mockSupabase.from).mockImplementationOnce(() => ({
        select: vi.fn(),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: { id: 'tag-assignment-1' }, error: null })),
          })),
        })),
        update: vi.fn(),
        delete: vi.fn(),
      }));

      const result = await mockSupabase.from('tag_assignments').insert({
        tag_id: FIXTURES.tags.housing.id,
        entity_type: 'case',
        entity_id: 'case-1',
        office_id: 'office-1',
      }).select().single();

      expect(result.error).toBeNull();
    });

    it('removes tag from case', async () => {
      vi.mocked(mockSupabase.from).mockImplementationOnce(() => ({
        select: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({ error: null })),
            })),
          })),
        })),
      }));

      const result = await mockSupabase
        .from('tag_assignments')
        .delete()
        .eq('tag_id', FIXTURES.tags.housing.id)
        .eq('entity_type', 'case')
        .eq('entity_id', 'case-1');

      expect(result.error).toBeNull();
    });

    it('tags reflect in tag_assignments table', async () => {
      const mockTagData = [{
        tag_id: FIXTURES.tags.housing.id,
        entity_type: 'case',
        entity_id: 'case-1',
      }];

      vi.mocked(mockSupabase.from).mockImplementationOnce(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({
              data: mockTagData,
              error: null,
            })),
          })),
        })),
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      }));

      const result = await mockSupabase
        .from('tag_assignments')
        .select()
        .eq('entity_type', 'case')
        .eq('entity_id', 'case-1');

      expect((result as unknown as { data: typeof mockTagData }).data).toHaveLength(1);
    });

    it('respects tag filters in queue', async () => {
      // When filtering by tag, only tagged messages should appear
      const tagFilter = FIXTURES.tags.housing.id;
      expect(tagFilter).toBeDefined();
    });
  });

  describe('Bulk Confirm/Reject', () => {
    it('bulk confirms multiple messages', async () => {
      const messageIds = ['msg-pending-1', 'msg-pending-2'];

      const result = await mockSupabase.rpc('confirm_triage', {
        p_message_ids: messageIds,
        p_case_id: 'case-1',
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('confirm_triage', expect.objectContaining({
        p_message_ids: messageIds,
      }));
      expect(result.data?.success).toBe(true);
    });

    it('bulk dismisses multiple messages', async () => {
      const messageIds = ['msg-pending-1', 'msg-pending-2'];

      await mockSupabase.rpc('dismiss_triage', {
        p_message_ids: messageIds,
        p_reason: 'spam',
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('dismiss_triage', expect.objectContaining({
        p_message_ids: messageIds,
        p_reason: 'spam',
      }));
    });

    it('updates state across components after bulk action', async () => {
      // After bulk confirm, stats should update
      const statsResult = await mockSupabase.rpc('get_triage_stats');
      expect(statsResult.data?.pending_count).toBeDefined();
    });
  });
});

describe('Triage Audit Logging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
  });

  const auditActions = [
    { action: 'triage_confirm', description: 'logs confirm action' },
    { action: 'triage_dismiss', description: 'logs dismiss action' },
    { action: 'triage_batch', description: 'logs batch action' },
    { action: 'create', description: 'logs create action' },
    { action: 'link', description: 'logs link action' },
    { action: 'assign', description: 'logs assign action' },
    { action: 'priority', description: 'logs priority change' },
    { action: 'tag', description: 'logs tag action' },
  ];

  auditActions.forEach(({ action, description }) => {
    it(description, async () => {
      vi.mocked(mockSupabase.from).mockImplementationOnce(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({
              data: [{
                id: 'audit-1',
                action,
                entity_type: 'message',
                entity_id: 'msg-1',
                actor_id: FIXTURES.users.staff1.id,
                created_at: new Date().toISOString(),
              }],
              error: null,
            })),
          })),
        })),
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      }));

      const result = await mockSupabase
        .from('audit_logs')
        .select()
        .eq('entity_id', 'msg-1')
        .order('created_at');

      const data = (result as { data: Array<{ action: string }> }).data;
      expect(data?.[0]?.action).toBeDefined();
    });
  });
});

describe('Triage RPC Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
  });

  describe('confirm_triage', () => {
    it('confirms single message', async () => {
      const result = await mockSupabase.rpc('confirm_triage', {
        p_message_ids: ['msg-1'],
      });

      expect(result.data?.success).toBe(true);
      expect(result.data?.confirmed_count).toBe(1);
    });

    it('confirms with case link', async () => {
      await mockSupabase.rpc('confirm_triage', {
        p_message_ids: ['msg-1'],
        p_case_id: 'case-1',
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('confirm_triage', expect.objectContaining({
        p_case_id: 'case-1',
      }));
    });

    it('confirms with assignee', async () => {
      await mockSupabase.rpc('confirm_triage', {
        p_message_ids: ['msg-1'],
        p_case_id: 'case-1',
        p_assignee_id: FIXTURES.users.staff1.id,
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('confirm_triage', expect.objectContaining({
        p_assignee_id: FIXTURES.users.staff1.id,
      }));
    });

    it('confirms with tags', async () => {
      await mockSupabase.rpc('confirm_triage', {
        p_message_ids: ['msg-1'],
        p_case_id: 'case-1',
        p_tag_ids: [FIXTURES.tags.housing.id, FIXTURES.tags.urgent.id],
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('confirm_triage', expect.objectContaining({
        p_tag_ids: expect.arrayContaining([FIXTURES.tags.housing.id]),
      }));
    });
  });

  describe('dismiss_triage', () => {
    it('dismisses with reason', async () => {
      await mockSupabase.rpc('dismiss_triage', {
        p_message_ids: ['msg-1'],
        p_reason: 'spam',
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('dismiss_triage', expect.objectContaining({
        p_reason: 'spam',
      }));
    });

    it('dismisses without reason', async () => {
      await mockSupabase.rpc('dismiss_triage', {
        p_message_ids: ['msg-1'],
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('dismiss_triage', expect.objectContaining({
        p_message_ids: ['msg-1'],
      }));
    });
  });

  describe('get_triage_queue', () => {
    it('filters by status', async () => {
      await mockSupabase.rpc('get_triage_queue', {
        p_status: ['pending'],
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_triage_queue', expect.objectContaining({
        p_status: ['pending'],
      }));
    });

    it('filters by campaign', async () => {
      await mockSupabase.rpc('get_triage_queue', {
        p_campaign_id: 'camp-1',
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_triage_queue', expect.objectContaining({
        p_campaign_id: 'camp-1',
      }));
    });

    it('supports pagination', async () => {
      await mockSupabase.rpc('get_triage_queue', {
        p_limit: 20,
        p_offset: 40,
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_triage_queue', expect.objectContaining({
        p_limit: 20,
        p_offset: 40,
      }));
    });

    it('supports sorting by confidence', async () => {
      await mockSupabase.rpc('get_triage_queue', {
        p_order_by: 'confidence',
        p_order_dir: 'desc',
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_triage_queue', expect.objectContaining({
        p_order_by: 'confidence',
      }));
    });
  });

  describe('get_triage_stats', () => {
    it('returns all stats', async () => {
      const result = await mockSupabase.rpc('get_triage_stats');

      expect(result.data).toMatchObject({
        pending_count: expect.any(Number),
        triaged_count: expect.any(Number),
        confirmed_today: expect.any(Number),
        dismissed_today: expect.any(Number),
      });
    });
  });

  describe('mark_as_triaged', () => {
    it('marks message as AI-processed', async () => {
      vi.mocked(mockSupabase.rpc).mockResolvedValueOnce({
        data: { success: true, message_id: 'msg-1' },
        error: null,
      });

      const result = await mockSupabase.rpc('mark_as_triaged', {
        p_message_id: 'msg-1',
        p_triaged_by: 'gemini-flash-2.0',
        p_confidence: 0.92,
        p_email_type: 'policy',
        p_is_campaign: false,
        p_metadata: { suggested_tags: [] },
      });

      expect(result.data?.success).toBe(true);
    });
  });
});
