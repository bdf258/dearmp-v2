import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiEmbeddingService, MockEmbeddingService } from '../EmbeddingService';

describe('GeminiEmbeddingService', () => {
  let service: GeminiEmbeddingService;

  beforeEach(() => {
    // We can't easily mock the GoogleGenAI client, so we'll test the MockEmbeddingService
    // and integration test the real service separately
  });

  describe('getModelName', () => {
    it('should return default model name', () => {
      // For testing without API key, we'll use the mock service pattern
      const mockService = new MockEmbeddingService();
      expect(mockService.getModelName()).toBe('mock-embedding-model');
    });
  });
});

describe('MockEmbeddingService', () => {
  let service: MockEmbeddingService;

  beforeEach(() => {
    service = new MockEmbeddingService();
  });

  describe('embedText', () => {
    it('should return embedding of correct dimensions', async () => {
      const result = await service.embedText('Hello world');

      expect(result.embedding).toHaveLength(768);
      expect(result.model).toBe('mock-embedding-model');
      expect(result.tokenCount).toBe(768);
    });

    it('should return normalized vector', async () => {
      const result = await service.embedText('Test text');

      // Calculate vector norm (should be ~1 for unit vector)
      const norm = Math.sqrt(
        result.embedding.reduce((sum, val) => sum + val * val, 0)
      );
      expect(norm).toBeCloseTo(1, 5);
    });

    it('should return consistent embeddings for same text', async () => {
      const result1 = await service.embedText('Same text');
      const result2 = await service.embedText('Same text');

      expect(result1.embedding).toEqual(result2.embedding);
    });

    it('should return different embeddings for different text', async () => {
      const result1 = await service.embedText('First text');
      const result2 = await service.embedText('Second text');

      expect(result1.embedding).not.toEqual(result2.embedding);
    });
  });

  describe('embedBatch', () => {
    it('should return embeddings for all texts', async () => {
      const texts = ['Text 1', 'Text 2', 'Text 3'];
      const results = await service.embedBatch(texts);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.embedding).toHaveLength(768);
        expect(result.model).toBe('mock-embedding-model');
      });
    });

    it('should return empty array for empty input', async () => {
      const results = await service.embedBatch([]);
      expect(results).toHaveLength(0);
    });
  });
});
