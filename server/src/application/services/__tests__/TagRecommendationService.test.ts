import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TagRecommendationService } from '../TagRecommendationService';
import { IEmbeddingService, EmbeddingResult } from '../../../infrastructure/embedding';
import { TagVectorRepository, SimilarTag } from '../../../infrastructure/repositories/TagVectorRepository';

describe('TagRecommendationService', () => {
  let service: TagRecommendationService;
  let mockEmbeddingService: {
    embedText: ReturnType<typeof vi.fn>;
    embedBatch: ReturnType<typeof vi.fn>;
    getModelName: ReturnType<typeof vi.fn>;
  };
  let mockTagVectorRepo: {
    getEmailEmbedding: ReturnType<typeof vi.fn>;
    cacheEmailEmbedding: ReturnType<typeof vi.fn>;
    searchSimilarTags: ReturnType<typeof vi.fn>;
    searchTagsByKeywords: ReturnType<typeof vi.fn>;
    getAllTags: ReturnType<typeof vi.fn>;
  };

  const officeId = '12345678-1234-1234-1234-123456789abc';
  const messageId = 'message-123';

  const mockEmbedding = new Array(768).fill(0.1);
  const mockEmbeddingResult: EmbeddingResult = {
    embedding: mockEmbedding,
    model: 'text-embedding-004',
    tokenCount: 768,
  };

  const mockSimilarTags: SimilarTag[] = [
    { id: 'tag-1', name: 'Housing', description: 'Housing issues', usageHint: 'For housing', similarity: 0.9 },
    { id: 'tag-2', name: 'Benefits', description: 'Benefits claims', usageHint: null, similarity: 0.85 },
    { id: 'tag-3', name: 'NHS', description: 'Healthcare', usageHint: null, similarity: 0.8 },
    { id: 'tag-4', name: 'Schools', description: 'Education', usageHint: null, similarity: 0.75 },
    { id: 'tag-5', name: 'Council Tax', description: 'Local taxes', usageHint: null, similarity: 0.7 },
  ];

  beforeEach(() => {
    mockEmbeddingService = {
      embedText: vi.fn().mockResolvedValue(mockEmbeddingResult),
      embedBatch: vi.fn().mockResolvedValue([mockEmbeddingResult]),
      getModelName: vi.fn().mockReturnValue('text-embedding-004'),
    };

    mockTagVectorRepo = {
      getEmailEmbedding: vi.fn().mockResolvedValue(null),
      cacheEmailEmbedding: vi.fn().mockResolvedValue(undefined),
      searchSimilarTags: vi.fn().mockResolvedValue(mockSimilarTags),
      searchTagsByKeywords: vi.fn().mockResolvedValue([]),
      getAllTags: vi.fn().mockResolvedValue(mockSimilarTags),
    };

    service = new TagRecommendationService(
      mockEmbeddingService as unknown as IEmbeddingService,
      mockTagVectorRepo as unknown as TagVectorRepository,
      {
        minVectorResults: 5,
        maxTags: 20,
        similarityThreshold: 0.3,
        maxContentLength: 2000,
      }
    );
  });

  describe('getRecommendedTags', () => {
    it('should return recommended tags from vector search', async () => {
      const result = await service.getRecommendedTags({
        messageId,
        officeId,
        subject: 'Housing issue',
        body: 'I have a problem with my council house...',
      });

      expect(result.candidateTags).toHaveLength(5);
      expect(result.embeddingCached).toBe(false);
      expect(result.fallbackUsed).toBe(false);
      expect(result.searchTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should use cached embedding when available', async () => {
      mockTagVectorRepo.getEmailEmbedding.mockResolvedValue(mockEmbedding);

      const result = await service.getRecommendedTags({
        messageId,
        officeId,
        subject: 'Test subject',
        body: 'Test body',
      });

      expect(result.embeddingCached).toBe(true);
      expect(mockEmbeddingService.embedText).not.toHaveBeenCalled();
    });

    it('should generate and cache embedding when not cached', async () => {
      const result = await service.getRecommendedTags({
        messageId,
        officeId,
        subject: 'Housing issue',
        body: 'I need help with housing...',
      });

      expect(mockEmbeddingService.embedText).toHaveBeenCalled();
      expect(mockTagVectorRepo.cacheEmailEmbedding).toHaveBeenCalledWith(
        officeId,
        messageId,
        mockEmbedding,
        'text-embedding-004'
      );
    });

    it('should use keyword fallback when vector results are insufficient', async () => {
      mockTagVectorRepo.searchSimilarTags.mockResolvedValue([
        { id: 'tag-1', name: 'Housing', description: null, usageHint: null, similarity: 0.9 },
      ]);
      mockTagVectorRepo.searchTagsByKeywords.mockResolvedValue([
        { id: 'tag-2', name: 'Benefits', description: null, usageHint: null, similarity: 0.5 },
        { id: 'tag-3', name: 'NHS', description: null, usageHint: null, similarity: 0.4 },
      ]);

      const result = await service.getRecommendedTags({
        messageId,
        officeId,
        subject: 'Housing issue',
        body: 'I need help...',
      });

      expect(result.fallbackUsed).toBe(true);
      expect(result.fallbackReason).toContain('Vector search returned only 1 results');
      expect(result.candidateTags).toHaveLength(3); // 1 from vector + 2 from keywords
    });

    it('should deduplicate tags from vector and keyword search', async () => {
      mockTagVectorRepo.searchSimilarTags.mockResolvedValue([
        { id: 'tag-1', name: 'Housing', description: null, usageHint: null, similarity: 0.9 },
      ]);
      mockTagVectorRepo.searchTagsByKeywords.mockResolvedValue([
        { id: 'tag-1', name: 'Housing', description: null, usageHint: null, similarity: 0.5 }, // Duplicate
        { id: 'tag-2', name: 'Benefits', description: null, usageHint: null, similarity: 0.4 },
      ]);

      const result = await service.getRecommendedTags({
        messageId,
        officeId,
        subject: 'Housing issue',
        body: 'I need help...',
      });

      expect(result.candidateTags).toHaveLength(2); // Deduplicated
      expect(result.candidateTags.map(t => t.id)).toEqual(['tag-1', 'tag-2']);
    });

    it('should fall back to keyword search on embedding error', async () => {
      mockEmbeddingService.embedText.mockRejectedValue(new Error('Embedding failed'));
      mockTagVectorRepo.searchTagsByKeywords.mockResolvedValue([
        { id: 'tag-1', name: 'Housing', description: null, usageHint: null, similarity: 0.5 },
      ]);

      const result = await service.getRecommendedTags({
        messageId,
        officeId,
        subject: 'Housing issue',
        body: 'I need help...',
      });

      expect(result.fallbackUsed).toBe(true);
      expect(result.fallbackReason).toContain('Embedding failed');
      expect(result.candidateTags).toHaveLength(1);
    });

    it('should truncate long email body', async () => {
      const longBody = 'A'.repeat(5000);

      await service.getRecommendedTags({
        messageId,
        officeId,
        subject: 'Test',
        body: longBody,
      });

      // Check that the content passed to embedText is truncated
      const embedCall = mockEmbeddingService.embedText.mock.calls[0][0];
      expect(embedCall.length).toBeLessThan(5000);
    });
  });

  describe('getAllTagsForOffice', () => {
    it('should return all tags for an office', async () => {
      const result = await service.getAllTagsForOffice(officeId, 20);

      expect(mockTagVectorRepo.getAllTags).toHaveBeenCalledWith(officeId, 20);
      expect(result).toHaveLength(5);
    });
  });

  describe('prepareEmailContent', () => {
    it('should combine subject and body', async () => {
      await service.getRecommendedTags({
        messageId,
        officeId,
        subject: 'Housing issue',
        body: 'I need help with housing...',
      });

      const embedCall = mockEmbeddingService.embedText.mock.calls[0][0];
      expect(embedCall).toContain('Housing issue');
      expect(embedCall).toContain('I need help with housing');
    });

    it('should handle empty body', async () => {
      await service.getRecommendedTags({
        messageId,
        officeId,
        subject: 'Housing issue',
        body: '',
      });

      const embedCall = mockEmbeddingService.embedText.mock.calls[0][0];
      expect(embedCall).toBe('Housing issue');
    });

    it('should handle empty subject', async () => {
      await service.getRecommendedTags({
        messageId,
        officeId,
        subject: '',
        body: 'I need help with housing...',
      });

      const embedCall = mockEmbeddingService.embedText.mock.calls[0][0];
      expect(embedCall).toContain('I need help with housing');
    });
  });
});
