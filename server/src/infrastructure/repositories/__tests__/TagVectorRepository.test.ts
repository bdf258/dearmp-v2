import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TagVectorRepository } from '../TagVectorRepository';

// Mock Supabase client interface
interface MockQueryBuilder {
  select: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  not: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  then: ReturnType<typeof vi.fn>;
}

interface MockSupabaseClient {
  from: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
}

describe('TagVectorRepository', () => {
  const officeId = '12345678-1234-1234-1234-123456789abc';

  let repository: TagVectorRepository;
  let mockQueryBuilder: MockQueryBuilder;
  let mockSupabase: MockSupabaseClient;

  beforeEach(() => {
    mockQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: vi.fn((callback) =>
        Promise.resolve(callback({ data: [], error: null }))
      ),
    };

    mockSupabase = {
      from: vi.fn().mockReturnValue(mockQueryBuilder),
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    };

    repository = new TagVectorRepository(mockSupabase as any);
  });

  describe('updateTagEmbedding', () => {
    it('should update embedding for a tag', async () => {
      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: null, error: null }))
      );

      const embedding = new Array(768).fill(0.1);
      await repository.updateTagEmbedding('tag-id', embedding, 'text-embedding-004');

      expect(mockSupabase.from).toHaveBeenCalledWith('legacy.tags');
      expect(mockQueryBuilder.update).toHaveBeenCalled();
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'tag-id');
    });

    it('should throw error on update failure', async () => {
      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: null, error: { message: 'Update failed' } }))
      );

      const embedding = new Array(768).fill(0.1);
      await expect(
        repository.updateTagEmbedding('tag-id', embedding, 'model')
      ).rejects.toThrow('Failed to update tag embedding');
    });
  });

  describe('searchSimilarTags', () => {
    it('should search for similar tags using vector similarity', async () => {
      const mockData = [
        { tag_id: 'tag-1', name: 'Housing', description: 'Housing issues', usage_hint: 'Use for housing', similarity: 0.9 },
        { tag_id: 'tag-2', name: 'Benefits', description: null, usage_hint: null, similarity: 0.8 },
      ];
      mockSupabase.rpc = vi.fn().mockResolvedValue({ data: mockData, error: null });

      const embedding = new Array(768).fill(0.1);
      const result = await repository.searchSimilarTags(embedding, officeId, 20, 0.3);

      expect(mockSupabase.rpc).toHaveBeenCalledWith('search_similar_tags', {
        query_embedding: expect.any(String),
        target_office_id: officeId,
        match_count: 20,
        similarity_threshold: 0.3,
      });
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('tag-1');
      expect(result[0].name).toBe('Housing');
      expect(result[0].similarity).toBe(0.9);
    });

    it('should throw error on search failure', async () => {
      mockSupabase.rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'Search failed' } });

      const embedding = new Array(768).fill(0.1);
      await expect(
        repository.searchSimilarTags(embedding, officeId)
      ).rejects.toThrow('Vector search failed');
    });
  });

  describe('searchTagsByKeywords', () => {
    it('should search tags by keywords', async () => {
      const mockData = [
        { tag_id: 'tag-1', name: 'Housing', description: 'Housing issues', usage_hint: null, relevance: 0.8 },
      ];
      mockSupabase.rpc = vi.fn().mockResolvedValue({ data: mockData, error: null });

      const result = await repository.searchTagsByKeywords('housing issues', officeId, 20);

      expect(mockSupabase.rpc).toHaveBeenCalledWith('search_tags_by_keywords', {
        search_text: 'housing issues',
        target_office_id: officeId,
        match_count: 20,
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('tag-1');
    });
  });

  describe('getTagsWithoutEmbeddings', () => {
    it('should return tags without embeddings', async () => {
      const mockData = [
        { id: 'tag-1', search_text: 'Housing issues', external_id: 1 },
        { id: 'tag-2', search_text: 'Benefits claims', external_id: 2 },
      ];
      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: mockData, error: null }))
      );

      const result = await repository.getTagsWithoutEmbeddings(officeId, 100);

      expect(mockSupabase.from).toHaveBeenCalledWith('legacy.tags');
      expect(mockQueryBuilder.is).toHaveBeenCalledWith('embedding', null);
      expect(result).toHaveLength(2);
      expect(result[0].searchText).toBe('Housing issues');
    });

    it('should filter out tags with empty search text', async () => {
      const mockData = [
        { id: 'tag-1', search_text: 'Housing issues', external_id: 1 },
        { id: 'tag-2', search_text: '', external_id: 2 },
        { id: 'tag-3', search_text: '   ', external_id: 3 },
      ];
      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: mockData, error: null }))
      );

      const result = await repository.getTagsWithoutEmbeddings(officeId, 100);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('tag-1');
    });
  });

  describe('cacheEmailEmbedding', () => {
    it('should cache email embedding', async () => {
      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: null, error: null }))
      );

      const embedding = new Array(768).fill(0.1);
      await repository.cacheEmailEmbedding(officeId, 'message-123', embedding, 'text-embedding-004');

      expect(mockSupabase.from).toHaveBeenCalledWith('email_embeddings');
      expect(mockQueryBuilder.upsert).toHaveBeenCalled();
    });
  });

  describe('getEmailEmbedding', () => {
    it('should return cached email embedding', async () => {
      const embedding = new Array(768).fill(0.1);
      mockQueryBuilder.single = vi.fn().mockResolvedValue({
        data: { embedding: JSON.stringify(embedding) },
        error: null,
      });

      const result = await repository.getEmailEmbedding('message-123');

      expect(mockSupabase.from).toHaveBeenCalledWith('email_embeddings');
      expect(result).not.toBeNull();
      expect(result).toHaveLength(768);
    });

    it('should return null when not found', async () => {
      mockQueryBuilder.single = vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      const result = await repository.getEmailEmbedding('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getEmbeddingStats', () => {
    it('should return embedding statistics', async () => {
      mockSupabase.rpc = vi.fn().mockResolvedValue({
        data: {
          total_tags: 100,
          embedded_tags: 75,
          pending_tags: 25,
          percent_complete: 75.0,
        },
        error: null,
      });

      const result = await repository.getEmbeddingStats(officeId);

      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_tag_embedding_stats', {
        target_office_id: officeId,
      });
      expect(result.total).toBe(100);
      expect(result.embedded).toBe(75);
      expect(result.pending).toBe(25);
      expect(result.percentComplete).toBe(75.0);
    });

    it('should return empty stats when no data', async () => {
      mockSupabase.rpc = vi.fn().mockResolvedValue({ data: null, error: null });

      const result = await repository.getEmbeddingStats(officeId);

      expect(result.total).toBe(0);
      expect(result.percentComplete).toBe(100);
    });
  });

  describe('getAllTags', () => {
    it('should return all tags for an office', async () => {
      const mockData = [
        { id: 'tag-1', tag: 'Housing', description: 'Housing issues', usage_hint: 'For housing' },
        { id: 'tag-2', tag: 'Benefits', description: null, usage_hint: null },
      ];
      mockQueryBuilder.then = vi.fn((callback) =>
        Promise.resolve(callback({ data: mockData, error: null }))
      );

      const result = await repository.getAllTags(officeId, 100);

      expect(mockSupabase.from).toHaveBeenCalledWith('legacy.tags');
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Housing');
      expect(result[0].similarity).toBe(1.0);
    });
  });

  describe('getTagById', () => {
    it('should return tag by ID', async () => {
      mockQueryBuilder.single = vi.fn().mockResolvedValue({
        data: { id: 'tag-1', search_text: 'Housing issues', external_id: 1 },
        error: null,
      });

      const result = await repository.getTagById('tag-1');

      expect(result).not.toBeNull();
      expect(result?.searchText).toBe('Housing issues');
    });

    it('should return null when tag not found', async () => {
      mockQueryBuilder.single = vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      const result = await repository.getTagById('nonexistent');

      expect(result).toBeNull();
    });
  });
});
