/**
 * EmbeddingService
 *
 * Service for generating text embeddings using Google's Gemini API.
 * Used for semantic tag search in the email triage pipeline.
 */

import { GoogleGenAI } from '@google/genai';

// ─────────────────────────────────────────────────────────────────────────────
// INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  tokenCount: number;
}

export interface IEmbeddingService {
  embedText(text: string): Promise<EmbeddingResult>;
  embedBatch(texts: string[]): Promise<EmbeddingResult[]>;
  getModelName(): string;
}

export interface EmbeddingServiceConfig {
  apiKey: string;
  model?: string;
  batchSize?: number;
  batchDelayMs?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gemini-based embedding service implementation
 */
export class GeminiEmbeddingService implements IEmbeddingService {
  private readonly client: GoogleGenAI;
  private readonly model: string;
  private readonly batchSize: number;
  private readonly batchDelayMs: number;

  constructor(config: EmbeddingServiceConfig) {
    this.client = new GoogleGenAI({ apiKey: config.apiKey });
    this.model = config.model || 'text-embedding-004';
    this.batchSize = config.batchSize ?? 10;
    this.batchDelayMs = config.batchDelayMs ?? 1000;
  }

  getModelName(): string {
    return this.model;
  }

  /**
   * Generate embedding for a single text
   */
  async embedText(text: string): Promise<EmbeddingResult> {
    if (!text || text.trim().length === 0) {
      throw new Error('Cannot generate embedding for empty text');
    }

    // Truncate very long texts to stay within token limits
    // Gemini text-embedding-004 has a context window of 2048 tokens
    const truncatedText = this.truncateText(text, 8000); // ~8000 chars ≈ 2000 tokens

    try {
      const result = await this.client.models.embedContent({
        model: this.model,
        contents: truncatedText,
      });

      if (!result.embeddings || result.embeddings.length === 0) {
        throw new Error('No embeddings returned from Gemini API');
      }

      const embedding = result.embeddings[0];
      return {
        embedding: embedding.values || [],
        model: this.model,
        tokenCount: embedding.values?.length || 768,
      };
    } catch (error) {
      console.error('[EmbeddingService] Failed to generate embedding:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts with rate limiting
   */
  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    if (texts.length === 0) {
      return [];
    }

    const results: EmbeddingResult[] = [];

    // Process in smaller batches with delays to avoid rate limits
    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, i + this.batchSize);

      console.log(`[EmbeddingService] Processing batch ${Math.floor(i / this.batchSize) + 1}/${Math.ceil(texts.length / this.batchSize)}, size: ${batch.length}`);

      // Process batch items in parallel
      const batchPromises = batch.map(async (text, index) => {
        try {
          return await this.embedText(text);
        } catch (error) {
          console.error(`[EmbeddingService] Failed to embed text at index ${i + index}:`, error);
          // Return a null marker for failed embeddings
          throw error;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Add delay between batches to respect rate limits
      if (i + this.batchSize < texts.length) {
        await this.sleep(this.batchDelayMs);
      }
    }

    return results;
  }

  /**
   * Truncate text to stay within token limits
   */
  private truncateText(text: string, maxChars: number): string {
    if (text.length <= maxChars) {
      return text;
    }
    // Truncate at word boundary
    const truncated = text.slice(0, maxChars);
    const lastSpace = truncated.lastIndexOf(' ');
    return lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated;
  }

  /**
   * Sleep utility for rate limiting
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Mock embedding service for testing
 */
export class MockEmbeddingService implements IEmbeddingService {
  private readonly model = 'mock-embedding-model';
  private readonly dimensions = 768;

  getModelName(): string {
    return this.model;
  }

  async embedText(text: string): Promise<EmbeddingResult> {
    // Generate deterministic mock embedding based on text hash
    const embedding = this.generateMockEmbedding(text);
    return {
      embedding,
      model: this.model,
      tokenCount: this.dimensions,
    };
  }

  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    return Promise.all(texts.map(text => this.embedText(text)));
  }

  private generateMockEmbedding(text: string): number[] {
    // Simple hash-based mock embedding for testing
    const hash = this.hashString(text);
    const embedding: number[] = [];
    for (let i = 0; i < this.dimensions; i++) {
      // Generate values between -1 and 1
      embedding.push(Math.sin(hash + i * 0.1));
    }
    // Normalize to unit vector
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / norm);
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash;
  }
}
