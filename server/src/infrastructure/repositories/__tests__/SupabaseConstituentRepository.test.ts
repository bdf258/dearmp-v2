import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupabaseConstituentRepository, ISupabaseClient, ISupabaseQueryBuilder } from '../SupabaseConstituentRepository';
import { Constituent } from '../../../domain/entities';
import { OfficeId, ExternalId } from '../../../domain/value-objects';

describe('SupabaseConstituentRepository', () => {
  const officeId = OfficeId.fromTrusted('12345678-1234-1234-1234-123456789abc');

  let repository: SupabaseConstituentRepository;
  let mockQueryBuilder: ISupabaseQueryBuilder;
  let mockSupabase: ISupabaseClient;

  const createMockRow = (overrides = {}) => ({
    id: 'const-uuid-123',
    office_id: officeId.toString(),
    external_id: 100,
    first_name: 'John',
    last_name: 'Doe',
    title: 'Mr',
    organisation_type: null,
    geocode_lat: 51.5074,
    geocode_lng: -0.1278,
    last_synced_at: '2025-01-15T10:00:00Z',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-15T10:00:00Z',
    ...overrides,
  });

  const createQueryBuilderMock = () => {
    const builder: ISupabaseQueryBuilder = {
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
    return builder;
  };

  beforeEach(() => {
    mockQueryBuilder = createQueryBuilderMock();

    mockSupabase = {
      from: vi.fn().mockReturnValue(mockQueryBuilder),
    };

    repository = new SupabaseConstituentRepository(mockSupabase);
  });

  describe('findById', () => {
    it('should find constituent by ID', async () => {
      const mockRow = createMockRow();
      mockQueryBuilder.single = vi.fn().mockResolvedValue({ data: mockRow, error: null });

      const result = await repository.findById(officeId, 'const-uuid-123');

      expect(mockSupabase.from).toHaveBeenCalledWith('legacy.constituents');
      expect(mockQueryBuilder.select).toHaveBeenCalledWith('*');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('office_id', officeId.toString());
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'const-uuid-123');
      expect(result).not.toBeNull();
      expect(result?.firstName).toBe('John');
      expect(result?.lastName).toBe('Doe');
    });

    it('should return null when constituent not found', async () => {
      mockQueryBuilder.single = vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } });

      const result = await repository.findById(officeId, 'nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('findByExternalId', () => {
    it('should find constituent by external ID', async () => {
      const mockRow = createMockRow();
      mockQueryBuilder.single = vi.fn().mockResolvedValue({ data: mockRow, error: null });

      const result = await repository.findByExternalId(officeId, ExternalId.fromTrusted(100));

      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('external_id', 100);
      expect(result).not.toBeNull();
      expect(result?.externalId.toNumber()).toBe(100);
    });

    it('should return null when not found', async () => {
      mockQueryBuilder.single = vi.fn().mockResolvedValue({ data: null, error: null });

      const result = await repository.findByExternalId(officeId, ExternalId.fromTrusted(999));

      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should find constituents by email address', async () => {
      const mockContactDetails = [{ constituent_id: 'const-uuid-123' }];
      const mockRow = createMockRow();

      // First call: find contact details - returns from then
      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: mockContactDetails, error: null, count: null }))
      );

      // Second call: find constituent by ID
      mockQueryBuilder.single = vi.fn().mockResolvedValue({ data: mockRow, error: null });

      const result = await repository.findByEmail(officeId, 'john@example.com');

      expect(mockSupabase.from).toHaveBeenCalledWith('legacy.contact_details');
      expect(mockQueryBuilder.ilike).toHaveBeenCalledWith('value', 'john@example.com');
      expect(result).toHaveLength(1);
      expect(result[0].firstName).toBe('John');
    });

    it('should return empty array when no matches found', async () => {
      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: [], error: null, count: null }))
      );

      const result = await repository.findByEmail(officeId, 'notfound@example.com');

      expect(result).toHaveLength(0);
    });
  });

  describe('findByName', () => {
    it('should find constituents by name', async () => {
      const mockRows = [createMockRow(), createMockRow({ id: 'const-uuid-456', first_name: 'Jane' })];
      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: mockRows, error: null, count: null }))
      );

      const result = await repository.findByName(officeId, 'Doe', 20);

      expect(mockQueryBuilder.ilike).toHaveBeenCalledWith('last_name', '%Doe%');
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(20);
      expect(result).toHaveLength(2);
    });
  });

  describe('findAll', () => {
    it('should find all constituents with pagination', async () => {
      const mockRows = [createMockRow()];
      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: mockRows, error: null, count: null }))
      );

      const result = await repository.findAll(officeId, { limit: 50, offset: 10 });

      expect(mockQueryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(mockQueryBuilder.range).toHaveBeenCalledWith(10, 59);
      expect(result).toHaveLength(1);
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
    it('should save a constituent', async () => {
      const mockRow = createMockRow();
      mockQueryBuilder.single = vi.fn().mockResolvedValue({ data: mockRow, error: null });

      const constituent = Constituent.fromLegacy(officeId, ExternalId.fromTrusted(100), {
        firstName: 'John',
        lastName: 'Doe',
        title: 'Mr',
      });

      const result = await repository.save(constituent);

      expect(mockQueryBuilder.upsert).toHaveBeenCalled();
      expect(mockQueryBuilder.select).toHaveBeenCalledWith('*');
      expect(result.firstName).toBe('John');
    });

    it('should throw error on save failure', async () => {
      mockQueryBuilder.single = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      const constituent = Constituent.fromLegacy(officeId, ExternalId.fromTrusted(100), {
        firstName: 'John',
        lastName: 'Doe',
      });

      await expect(repository.save(constituent)).rejects.toThrow();
    });
  });

  describe('saveMany', () => {
    it('should save multiple constituents', async () => {
      const mockRows = [createMockRow(), createMockRow({ id: 'const-uuid-456', external_id: 101 })];
      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: mockRows, error: null, count: null }))
      );

      const constituents = [
        Constituent.fromLegacy(officeId, ExternalId.fromTrusted(100), { firstName: 'John', lastName: 'Doe' }),
        Constituent.fromLegacy(officeId, ExternalId.fromTrusted(101), { firstName: 'Jane', lastName: 'Doe' }),
      ];

      const result = await repository.saveMany(constituents);

      expect(mockQueryBuilder.upsert).toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });
  });

  describe('deleteByExternalId', () => {
    it('should delete constituent by external ID', async () => {
      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: null, error: null, count: null }))
      );

      await repository.deleteByExternalId(officeId, ExternalId.fromTrusted(100));

      expect(mockQueryBuilder.delete).toHaveBeenCalled();
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('office_id', officeId.toString());
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('external_id', 100);
    });
  });

  describe('count', () => {
    it('should count constituents for office', async () => {
      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: null, error: null, count: 42 }))
      );

      const result = await repository.count(officeId);

      expect(result).toBe(42);
    });

    it('should return 0 when count is null', async () => {
      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: null, error: null, count: null }))
      );

      const result = await repository.count(officeId);

      expect(result).toBe(0);
    });
  });
});
