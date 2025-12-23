import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupabaseCaseRepository } from '../SupabaseCaseRepository';
import { ISupabaseClient, ISupabaseQueryBuilder } from '../SupabaseConstituentRepository';
import { Case } from '../../../domain/entities';
import { OfficeId, ExternalId } from '../../../domain/value-objects';

describe('SupabaseCaseRepository', () => {
  const officeId = OfficeId.fromTrusted('12345678-1234-1234-1234-123456789abc');

  let repository: SupabaseCaseRepository;
  let mockQueryBuilder: ISupabaseQueryBuilder;
  let mockSupabase: ISupabaseClient;

  const createMockRow = (overrides = {}) => ({
    id: 'case-uuid-123',
    office_id: officeId.toString(),
    external_id: 200,
    constituent_id: 'const-uuid-123',
    constituent_external_id: 100,
    case_type_id: 'type-uuid-1',
    case_type_external_id: 1,
    status_id: 'status-uuid-1',
    status_external_id: 1,
    category_type_id: null,
    category_type_external_id: null,
    contact_type_id: null,
    contact_type_external_id: null,
    assigned_to_id: 'worker-uuid-1',
    assigned_to_external_id: 5,
    summary: 'Test case summary',
    review_date: '2025-02-01T00:00:00Z',
    last_synced_at: '2025-01-15T10:00:00Z',
    created_at: '2025-01-01T00:00:00Z',
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

    repository = new SupabaseCaseRepository(mockSupabase);
  });

  describe('findById', () => {
    it('should find case by ID', async () => {
      const mockRow = createMockRow();
      mockQueryBuilder.single = vi.fn().mockResolvedValue({ data: mockRow, error: null });

      const result = await repository.findById(officeId, 'case-uuid-123');

      expect(mockSupabase.from).toHaveBeenCalledWith('legacy.cases');
      expect(mockQueryBuilder.select).toHaveBeenCalledWith('*');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'case-uuid-123');
      expect(result).not.toBeNull();
      expect(result?.summary).toBe('Test case summary');
    });

    it('should return null when case not found', async () => {
      mockQueryBuilder.single = vi.fn().mockResolvedValue({ data: null, error: null });

      const result = await repository.findById(officeId, 'nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('findByExternalId', () => {
    it('should find case by external ID', async () => {
      const mockRow = createMockRow();
      mockQueryBuilder.single = vi.fn().mockResolvedValue({ data: mockRow, error: null });

      const result = await repository.findByExternalId(officeId, ExternalId.fromTrusted(200));

      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('external_id', 200);
      expect(result).not.toBeNull();
      expect(result?.externalId.toNumber()).toBe(200);
    });
  });

  describe('findByConstituentId', () => {
    it('should find cases for a constituent', async () => {
      const mockRows = [createMockRow(), createMockRow({ id: 'case-uuid-456', external_id: 201 })];
      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: mockRows, error: null, count: null }))
      );

      const result = await repository.findByConstituentId(officeId, 'const-uuid-123');

      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('constituent_id', 'const-uuid-123');
      expect(mockQueryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(result).toHaveLength(2);
    });
  });

  describe('findByConstituentExternalId', () => {
    it('should find cases by constituent external ID', async () => {
      const mockRows = [createMockRow()];
      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: mockRows, error: null, count: null }))
      );

      const result = await repository.findByConstituentExternalId(officeId, ExternalId.fromTrusted(100));

      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('constituent_external_id', 100);
      expect(result).toHaveLength(1);
    });
  });

  describe('findOpenCasesForConstituent', () => {
    it('should find open cases for a constituent', async () => {
      const mockRows = [createMockRow()];
      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: mockRows, error: null, count: null }))
      );

      const result = await repository.findOpenCasesForConstituent(officeId, 'const-uuid-123');

      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('constituent_id', 'const-uuid-123');
      expect(result).toHaveLength(1);
    });
  });

  describe('findAll', () => {
    it('should find all cases with pagination', async () => {
      const mockRows = [createMockRow()];
      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: mockRows, error: null, count: null }))
      );

      const result = await repository.findAll(officeId, { limit: 25, offset: 0 });

      expect(mockQueryBuilder.range).toHaveBeenCalledWith(0, 24);
      expect(result).toHaveLength(1);
    });

    it('should filter by status', async () => {
      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: [createMockRow()], error: null, count: null }))
      );

      await repository.findAll(officeId, { statusId: 'status-uuid-1' });

      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('status_id', 'status-uuid-1');
    });

    it('should filter by case type', async () => {
      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: [createMockRow()], error: null, count: null }))
      );

      await repository.findAll(officeId, { caseTypeId: 'type-uuid-1' });

      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('case_type_id', 'type-uuid-1');
    });

    it('should filter by assignee', async () => {
      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: [createMockRow()], error: null, count: null }))
      );

      await repository.findAll(officeId, { assignedToId: 'worker-uuid-1' });

      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('assigned_to_id', 'worker-uuid-1');
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
    it('should save a case', async () => {
      const mockRow = createMockRow();
      mockQueryBuilder.single = vi.fn().mockResolvedValue({ data: mockRow, error: null });

      const caseEntity = Case.fromLegacy(officeId, ExternalId.fromTrusted(200), {
        constituentExternalId: 100,
        caseTypeExternalId: 1,
        statusExternalId: 1,
        summary: 'Test case',
      });

      const result = await repository.save(caseEntity);

      expect(mockQueryBuilder.upsert).toHaveBeenCalled();
      expect(result.summary).toBe('Test case summary');
    });
  });

  describe('saveMany', () => {
    it('should save multiple cases', async () => {
      const mockRows = [createMockRow(), createMockRow({ id: 'case-uuid-456', external_id: 201 })];
      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: mockRows, error: null, count: null }))
      );

      const cases = [
        Case.fromLegacy(officeId, ExternalId.fromTrusted(200), { summary: 'Case 1' }),
        Case.fromLegacy(officeId, ExternalId.fromTrusted(201), { summary: 'Case 2' }),
      ];

      const result = await repository.saveMany(cases);

      expect(mockQueryBuilder.upsert).toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });
  });

  describe('deleteByExternalId', () => {
    it('should delete case by external ID', async () => {
      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: null, error: null, count: null }))
      );

      await repository.deleteByExternalId(officeId, ExternalId.fromTrusted(200));

      expect(mockQueryBuilder.delete).toHaveBeenCalled();
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('external_id', 200);
    });
  });

  describe('count', () => {
    it('should count cases for office', async () => {
      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: null, error: null, count: 150 }))
      );

      const result = await repository.count(officeId);

      expect(result).toBe(150);
    });
  });

  describe('countByStatus', () => {
    it('should count cases grouped by status', async () => {
      const mockRows = [
        { status_id: 'status-open' },
        { status_id: 'status-open' },
        { status_id: 'status-closed' },
        { status_id: null },
      ];
      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: mockRows, error: null, count: null }))
      );

      const result = await repository.countByStatus(officeId);

      expect(result['status-open']).toBe(2);
      expect(result['status-closed']).toBe(1);
      expect(result['unassigned']).toBe(1);
    });
  });
});
