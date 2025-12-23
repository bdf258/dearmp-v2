import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupabaseEmailRepository } from '../SupabaseEmailRepository';
import { ISupabaseClient, ISupabaseQueryBuilder } from '../SupabaseConstituentRepository';
import { Email } from '../../../domain/entities';
import { OfficeId, ExternalId } from '../../../domain/value-objects';

describe('SupabaseEmailRepository', () => {
  const officeId = OfficeId.fromTrusted('12345678-1234-1234-1234-123456789abc');

  let repository: SupabaseEmailRepository;
  let mockQueryBuilder: ISupabaseQueryBuilder;
  let mockSupabase: ISupabaseClient;

  const createMockRow = (overrides = {}) => ({
    id: 'email-uuid-123',
    office_id: officeId.toString(),
    external_id: 500,
    case_id: 'case-uuid-123',
    case_external_id: 200,
    constituent_id: 'const-uuid-123',
    constituent_external_id: 100,
    type: 'received',
    subject: 'Test Subject',
    html_body: '<p>Test body</p>',
    from_address: 'sender@example.com',
    to_addresses: ['recipient@mp.uk'],
    cc_addresses: null,
    bcc_addresses: null,
    actioned: false,
    assigned_to_id: 'worker-uuid-1',
    assigned_to_external_id: 5,
    scheduled_at: null,
    sent_at: null,
    received_at: '2025-01-15T10:00:00Z',
    last_synced_at: '2025-01-15T10:00:00Z',
    created_at: '2025-01-15T10:00:00Z',
    updated_at: '2025-01-15T10:00:00Z',
    ...overrides,
  });

  beforeEach(() => {
    mockQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: vi.fn((callback) =>
        Promise.resolve(callback({ data: [], error: null, count: null }))
      ),
    };

    mockSupabase = {
      from: vi.fn().mockReturnValue(mockQueryBuilder),
    };

    repository = new SupabaseEmailRepository(mockSupabase);
  });

  describe('findById', () => {
    it('should find email by ID', async () => {
      const mockRow = createMockRow();
      mockQueryBuilder.single = vi.fn().mockResolvedValue({ data: mockRow, error: null });

      const result = await repository.findById(officeId, 'email-uuid-123');

      expect(mockSupabase.from).toHaveBeenCalledWith('legacy.emails');
      expect(mockQueryBuilder.select).toHaveBeenCalledWith('*');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'email-uuid-123');
      expect(result).not.toBeNull();
      expect(result?.subject).toBe('Test Subject');
    });

    it('should return null when email not found', async () => {
      mockQueryBuilder.single = vi.fn().mockResolvedValue({ data: null, error: null });

      const result = await repository.findById(officeId, 'nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('findByExternalId', () => {
    it('should find email by external ID', async () => {
      const mockRow = createMockRow();
      mockQueryBuilder.single = vi.fn().mockResolvedValue({ data: mockRow, error: null });

      const result = await repository.findByExternalId(officeId, ExternalId.fromTrusted(500));

      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('external_id', 500);
      expect(result).not.toBeNull();
      expect(result?.externalId.toNumber()).toBe(500);
    });
  });

  describe('findByCaseId', () => {
    it('should find emails for a case', async () => {
      const mockRows = [createMockRow(), createMockRow({ id: 'email-uuid-456', external_id: 501 })];
      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: mockRows, error: null, count: null }))
      );

      const result = await repository.findByCaseId(officeId, 'case-uuid-123');

      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('case_id', 'case-uuid-123');
      expect(mockQueryBuilder.order).toHaveBeenCalledWith('received_at', { ascending: false });
      expect(result).toHaveLength(2);
    });
  });

  describe('findUnactioned', () => {
    it('should find unactioned received emails', async () => {
      const mockRows = [createMockRow()];
      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: mockRows, error: null, count: null }))
      );

      const result = await repository.findUnactioned(officeId);

      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('actioned', false);
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('type', 'received');
      expect(result).toHaveLength(1);
    });

    it('should filter by receivedSince', async () => {
      const receivedSince = new Date('2025-01-10T00:00:00Z');
      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: [createMockRow()], error: null, count: null }))
      );

      await repository.findUnactioned(officeId, { receivedSince });

      expect(mockQueryBuilder.gte).toHaveBeenCalledWith('received_at', receivedSince.toISOString());
    });

    it('should apply pagination', async () => {
      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: [createMockRow()], error: null, count: null }))
      );

      await repository.findUnactioned(officeId, { limit: 50, offset: 10 });

      expect(mockQueryBuilder.range).toHaveBeenCalledWith(10, 59);
    });
  });

  describe('findByFromAddress', () => {
    it('should find emails by sender address', async () => {
      const mockRows = [createMockRow()];
      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: mockRows, error: null, count: null }))
      );

      const result = await repository.findByFromAddress(officeId, 'sender@example.com');

      expect(mockQueryBuilder.ilike).toHaveBeenCalledWith('from_address', 'sender@example.com');
      expect(result).toHaveLength(1);
    });
  });

  describe('findAll', () => {
    it('should find all emails with pagination', async () => {
      const mockRows = [createMockRow()];
      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: mockRows, error: null, count: null }))
      );

      const result = await repository.findAll(officeId, { limit: 100, offset: 0 });

      expect(mockQueryBuilder.order).toHaveBeenCalledWith('received_at', { ascending: false });
      expect(mockQueryBuilder.range).toHaveBeenCalledWith(0, 99);
      expect(result).toHaveLength(1);
    });

    it('should filter by type', async () => {
      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: [createMockRow()], error: null, count: null }))
      );

      await repository.findAll(officeId, { type: 'sent' });

      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('type', 'sent');
    });

    it('should filter by actioned status', async () => {
      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: [createMockRow()], error: null, count: null }))
      );

      await repository.findAll(officeId, { actioned: true });

      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('actioned', true);
    });

    it('should filter by modifiedSince', async () => {
      const modifiedSince = new Date('2025-01-10T00:00:00Z');
      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: [createMockRow()], error: null, count: null }))
      );

      await repository.findAll(officeId, { modifiedSince });

      expect(mockQueryBuilder.gte).toHaveBeenCalledWith('updated_at', modifiedSince.toISOString());
    });
  });

  describe('save', () => {
    it('should save an email', async () => {
      const mockRow = createMockRow();
      mockQueryBuilder.single = vi.fn().mockResolvedValue({ data: mockRow, error: null });

      const email = Email.fromLegacy(officeId, ExternalId.fromTrusted(500), {
        type: 'received',
        subject: 'Test Subject',
        htmlBody: '<p>Test body</p>',
        fromAddress: 'sender@example.com',
        toAddresses: ['recipient@mp.uk'],
        actioned: false,
      });

      const result = await repository.save(email);

      expect(mockQueryBuilder.upsert).toHaveBeenCalled();
      expect(result.subject).toBe('Test Subject');
    });
  });

  describe('saveMany', () => {
    it('should save multiple emails', async () => {
      const mockRows = [createMockRow(), createMockRow({ id: 'email-uuid-456', external_id: 501 })];
      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: mockRows, error: null, count: null }))
      );

      const emails = [
        Email.fromLegacy(officeId, ExternalId.fromTrusted(500), { subject: 'Email 1' }),
        Email.fromLegacy(officeId, ExternalId.fromTrusted(501), { subject: 'Email 2' }),
      ];

      const result = await repository.saveMany(emails);

      expect(mockQueryBuilder.upsert).toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });
  });

  describe('markActioned', () => {
    it('should mark email as actioned', async () => {
      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: null, error: null, count: null }))
      );

      await repository.markActioned(officeId, ExternalId.fromTrusted(500));

      expect(mockQueryBuilder.update).toHaveBeenCalledWith(expect.objectContaining({
        actioned: true,
      }));
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('external_id', 500);
    });
  });

  describe('deleteByExternalId', () => {
    it('should delete email by external ID', async () => {
      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: null, error: null, count: null }))
      );

      await repository.deleteByExternalId(officeId, ExternalId.fromTrusted(500));

      expect(mockQueryBuilder.delete).toHaveBeenCalled();
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('external_id', 500);
    });
  });

  describe('count', () => {
    it('should count emails for office', async () => {
      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: null, error: null, count: 1250 }))
      );

      const result = await repository.count(officeId);

      expect(result).toBe(1250);
    });
  });

  describe('countUnactioned', () => {
    it('should count unactioned received emails', async () => {
      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: null, error: null, count: 75 }))
      );

      const result = await repository.countUnactioned(officeId);

      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('actioned', false);
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('type', 'received');
      expect(result).toBe(75);
    });
  });

  describe('domain entity mapping', () => {
    it('should correctly map database row to Email entity', async () => {
      const mockRow = createMockRow();
      mockQueryBuilder.single = vi.fn().mockResolvedValue({ data: mockRow, error: null });

      const result = await repository.findById(officeId, 'email-uuid-123');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('email-uuid-123');
      expect(result?.officeId.toString()).toBe(officeId.toString());
      expect(result?.externalId.toNumber()).toBe(500);
      expect(result?.caseId).toBe('case-uuid-123');
      expect(result?.caseExternalId?.toNumber()).toBe(200);
      expect(result?.constituentId).toBe('const-uuid-123');
      expect(result?.constituentExternalId?.toNumber()).toBe(100);
      expect(result?.type).toBe('received');
      expect(result?.subject).toBe('Test Subject');
      expect(result?.htmlBody).toBe('<p>Test body</p>');
      expect(result?.fromAddress).toBe('sender@example.com');
      expect(result?.toAddresses).toEqual(['recipient@mp.uk']);
      expect(result?.actioned).toBe(false);
      expect(result?.receivedAt).toEqual(new Date('2025-01-15T10:00:00Z'));
    });

    it('should handle null optional fields', async () => {
      const mockRow = createMockRow({
        case_id: null,
        case_external_id: null,
        constituent_id: null,
        constituent_external_id: null,
        assigned_to_id: null,
        assigned_to_external_id: null,
        cc_addresses: null,
        bcc_addresses: null,
      });
      mockQueryBuilder.single = vi.fn().mockResolvedValue({ data: mockRow, error: null });

      const result = await repository.findById(officeId, 'email-uuid-123');

      expect(result).not.toBeNull();
      // These fields come from database as null and are cast to their types
      expect(result?.caseId).toBeFalsy();
      expect(result?.caseExternalId).toBeFalsy();
      expect(result?.constituentId).toBeFalsy();
      expect(result?.constituentExternalId).toBeFalsy();
    });
  });

  describe('Email entity helpers', () => {
    it('should identify inbound emails', async () => {
      const mockRow = createMockRow({ type: 'received' });
      mockQueryBuilder.single = vi.fn().mockResolvedValue({ data: mockRow, error: null });

      const result = await repository.findById(officeId, 'email-uuid-123');

      expect(result?.isInbound()).toBe(true);
      expect(result?.isOutbound()).toBe(false);
    });

    it('should identify outbound emails', async () => {
      const mockRow = createMockRow({ type: 'sent' });
      mockQueryBuilder.single = vi.fn().mockResolvedValue({ data: mockRow, error: null });

      const result = await repository.findById(officeId, 'email-uuid-123');

      expect(result?.isInbound()).toBe(false);
      expect(result?.isOutbound()).toBe(true);
    });

    it('should identify emails needing triage', async () => {
      const mockRow = createMockRow({ type: 'received', actioned: false });
      mockQueryBuilder.single = vi.fn().mockResolvedValue({ data: mockRow, error: null });

      const result = await repository.findById(officeId, 'email-uuid-123');

      expect(result?.needsTriage()).toBe(true);
    });

    it('should not need triage if actioned', async () => {
      const mockRow = createMockRow({ type: 'received', actioned: true });
      mockQueryBuilder.single = vi.fn().mockResolvedValue({ data: mockRow, error: null });

      const result = await repository.findById(officeId, 'email-uuid-123');

      expect(result?.needsTriage()).toBe(false);
    });

    it('should not need triage if outbound', async () => {
      const mockRow = createMockRow({ type: 'sent', actioned: false });
      mockQueryBuilder.single = vi.fn().mockResolvedValue({ data: mockRow, error: null });

      const result = await repository.findById(officeId, 'email-uuid-123');

      expect(result?.needsTriage()).toBe(false);
    });
  });
});
