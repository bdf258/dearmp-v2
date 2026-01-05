/**
 * TagRecommendationService
 *
 * Orchestrates vector-based tag search for email triage.
 * Uses semantic similarity to find relevant tags, with keyword fallback.
 */

import { IEmbeddingService } from '../../infrastructure/embedding';
import { TagVectorRepository, SimilarTag } from '../../infrastructure/repositories/TagVectorRepository';

// ─────────────────────────────────────────────────────────────────────────────
// INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

export interface TagRecommendationInput {
  messageId: string;
  officeId: string;
  subject: string;
  body: string;
  senderEmail?: string;
}

export interface TagRecommendationResult {
  candidateTags: SimilarTag[];
  embeddingCached: boolean;
  searchTimeMs: number;
  fallbackUsed: boolean;
  fallbackReason?: string;
}

export interface TagRecommendationConfig {
  minVectorResults?: number;
  maxTags?: number;
  similarityThreshold?: number;
  maxContentLength?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULTS
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: Required<TagRecommendationConfig> = {
  minVectorResults: 5,
  maxTags: 20,
  similarityThreshold: 0.25,
  maxContentLength: 2000,
};

// ─────────────────────────────────────────────────────────────────────────────
// IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────

export class TagRecommendationService {
  private readonly config: Required<TagRecommendationConfig>;

  constructor(
    private readonly embeddingService: IEmbeddingService,
    private readonly tagVectorRepo: TagVectorRepository,
    config?: TagRecommendationConfig
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get recommended tags for an email based on semantic similarity
   */
  async getRecommendedTags(input: TagRecommendationInput): Promise<TagRecommendationResult> {
    const startTime = Date.now();
    let fallbackUsed = false;
    let fallbackReason: string | undefined;

    try {
      // 1. Check for cached email embedding
      let embedding = await this.tagVectorRepo.getEmailEmbedding(input.messageId);
      let embeddingCached = !!embedding;

      if (!embedding) {
        // 2. Generate embedding from email content
        const contentToEmbed = this.prepareEmailContent(input);

        console.log(`[TagRecommendation] Generating embedding for message ${input.messageId} (${contentToEmbed.length} chars)`);

        const result = await this.embeddingService.embedText(contentToEmbed);
        embedding = result.embedding;

        // 3. Cache the embedding for future use (emails are static)
        await this.tagVectorRepo.cacheEmailEmbedding(
          input.officeId,
          input.messageId,
          embedding,
          result.model
        );
      }

      // 4. Search for similar tags using vector similarity
      let candidateTags = await this.tagVectorRepo.searchSimilarTags(
        embedding,
        input.officeId,
        this.config.maxTags,
        this.config.similarityThreshold
      );

      console.log(`[TagRecommendation] Vector search returned ${candidateTags.length} tags for message ${input.messageId}`);

      // 5. If insufficient results, supplement with keyword matching
      if (candidateTags.length < this.config.minVectorResults) {
        fallbackUsed = true;
        fallbackReason = `Vector search returned only ${candidateTags.length} results (threshold: ${this.config.minVectorResults})`;

        console.log(`[TagRecommendation] Supplementing with keyword search: ${fallbackReason}`);

        const keywordTags = await this.tagVectorRepo.searchTagsByKeywords(
          input.subject,
          input.officeId,
          this.config.maxTags - candidateTags.length
        );

        // Merge and dedupe (vector results take priority)
        const existingIds = new Set(candidateTags.map(t => t.id));
        for (const tag of keywordTags) {
          if (!existingIds.has(tag.id)) {
            candidateTags.push(tag);
          }
        }

        console.log(`[TagRecommendation] After keyword supplement: ${candidateTags.length} tags`);
      }

      const searchTimeMs = Date.now() - startTime;

      console.log(`[TagRecommendation] Completed for message ${input.messageId}: ${candidateTags.length} tags in ${searchTimeMs}ms`);

      return {
        candidateTags,
        embeddingCached,
        searchTimeMs,
        fallbackUsed,
        fallbackReason,
      };

    } catch (error) {
      // If embedding fails entirely, fall back to keyword-only search
      const searchTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error(`[TagRecommendation] Embedding failed, using keyword fallback: ${errorMessage}`);

      const keywordTags = await this.tagVectorRepo.searchTagsByKeywords(
        input.subject,
        input.officeId,
        this.config.maxTags
      );

      return {
        candidateTags: keywordTags,
        embeddingCached: false,
        searchTimeMs: Date.now() - startTime,
        fallbackUsed: true,
        fallbackReason: `Embedding failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Get all tags for an office (fallback when embeddings not available)
   */
  async getAllTagsForOffice(officeId: string, limit: number = 20): Promise<SimilarTag[]> {
    return this.tagVectorRepo.getAllTags(officeId, limit);
  }

  /**
   * Prepare email content for embedding
   */
  private prepareEmailContent(input: TagRecommendationInput): string {
    const parts: string[] = [];

    // Subject is most important, put it first
    if (input.subject) {
      parts.push(input.subject);
    }

    // Truncate body to limit
    if (input.body) {
      const truncatedBody = input.body.slice(0, this.config.maxContentLength);
      parts.push(truncatedBody);
    }

    return parts.filter(Boolean).join('\n\n');
  }
}
