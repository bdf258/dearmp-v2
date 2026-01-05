/**
 * EmbeddingJobHandler
 *
 * Handles background jobs for generating and maintaining tag embeddings.
 * Supports both single tag and batch embedding generation.
 */

import PgBoss from 'pg-boss';
import { SupabaseClient } from '@supabase/supabase-js';
import { IEmbeddingService } from '../../embedding';
import { TagVectorRepository } from '../../repositories/TagVectorRepository';
import { PgBossClient } from '../PgBossClient';
import {
  JobNames,
  EmbeddingGenerateTagJobData,
  EmbeddingBackfillJobData,
  EmbeddingRefreshJobData,
  ScheduledEmbeddingRefreshJobData,
} from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

export interface EmbeddingJobHandlerDependencies {
  pgBossClient: PgBossClient;
  embeddingService: IEmbeddingService;
  tagVectorRepo: TagVectorRepository;
  supabase: SupabaseClient;
}

export interface EmbeddingJobResult {
  success: boolean;
  processedCount: number;
  failedCount: number;
  durationMs: number;
  error?: string;
}

// Re-export types for convenience
export type {
  EmbeddingGenerateTagJobData,
  EmbeddingBackfillJobData,
  EmbeddingRefreshJobData,
  ScheduledEmbeddingRefreshJobData,
};

// ─────────────────────────────────────────────────────────────────────────────
// IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────

export class EmbeddingJobHandler {
  private readonly client: PgBossClient;
  private readonly embeddingService: IEmbeddingService;
  private readonly tagVectorRepo: TagVectorRepository;
  private readonly supabase: SupabaseClient;

  constructor(deps: EmbeddingJobHandlerDependencies) {
    this.client = deps.pgBossClient;
    this.embeddingService = deps.embeddingService;
    this.tagVectorRepo = deps.tagVectorRepo;
    this.supabase = deps.supabase;

    console.log('[EmbeddingJobHandler] Initialized with embedding service:', deps.embeddingService.getModelName());
  }

  /**
   * Register all embedding job handlers
   */
  async register(): Promise<void> {
    await this.client.work<EmbeddingGenerateTagJobData, EmbeddingJobResult>(
      JobNames.EMBEDDING_GENERATE_TAG,
      this.handleGenerateTag.bind(this)
    );

    await this.client.work<EmbeddingBackfillJobData, EmbeddingJobResult>(
      JobNames.EMBEDDING_BACKFILL,
      this.handleBackfill.bind(this)
    );

    await this.client.work<EmbeddingRefreshJobData, EmbeddingJobResult>(
      JobNames.EMBEDDING_REFRESH,
      this.handleRefresh.bind(this)
    );

    await this.client.work<ScheduledEmbeddingRefreshJobData, EmbeddingJobResult>(
      JobNames.SCHEDULED_EMBEDDING_REFRESH,
      this.handleScheduledRefresh.bind(this)
    );

    console.log('[EmbeddingJobHandler] Registered all embedding job handlers');
  }

  /**
   * Generate embedding for a single tag
   */
  private async handleGenerateTag(
    job: PgBoss.Job<EmbeddingGenerateTagJobData>
  ): Promise<EmbeddingJobResult> {
    const { tagId, officeId } = job.data;
    const startTime = Date.now();

    console.log(`[EmbeddingGenerateTag] Processing tag ${tagId} for office ${officeId}`);

    try {
      const tag = await this.tagVectorRepo.getTagById(tagId);

      if (!tag) {
        console.warn(`[EmbeddingGenerateTag] Tag not found: ${tagId}`);
        return {
          success: false,
          processedCount: 0,
          failedCount: 1,
          durationMs: Date.now() - startTime,
          error: 'Tag not found',
        };
      }

      if (!tag.searchText || tag.searchText.trim() === '') {
        console.warn(`[EmbeddingGenerateTag] Tag ${tagId} has empty search text`);
        return {
          success: false,
          processedCount: 0,
          failedCount: 1,
          durationMs: Date.now() - startTime,
          error: 'Empty search text',
        };
      }

      const result = await this.embeddingService.embedText(tag.searchText);
      await this.tagVectorRepo.updateTagEmbedding(tagId, result.embedding, result.model);

      console.log(`[EmbeddingGenerateTag] Generated embedding for tag ${tagId}`);

      return {
        success: true,
        processedCount: 1,
        failedCount: 0,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[EmbeddingGenerateTag] Failed for tag ${tagId}:`, error);

      return {
        success: false,
        processedCount: 0,
        failedCount: 1,
        durationMs: Date.now() - startTime,
        error: errorMessage,
      };
    }
  }

  /**
   * Backfill embeddings for all tags without embeddings in an office
   */
  private async handleBackfill(
    job: PgBoss.Job<EmbeddingBackfillJobData>
  ): Promise<EmbeddingJobResult> {
    const { officeId } = job.data;
    const startTime = Date.now();
    const batchSize = 50;

    console.log(`[EmbeddingBackfill] Starting for office ${officeId}`);

    let processed = 0;
    let failed = 0;
    let hasMore = true;

    while (hasMore) {
      const tags = await this.tagVectorRepo.getTagsWithoutEmbeddings(officeId, batchSize);

      if (tags.length === 0) {
        hasMore = false;
        break;
      }

      console.log(`[EmbeddingBackfill] Processing batch of ${tags.length} tags (${processed} processed so far)`);

      try {
        const embeddings = await this.embeddingService.embedBatch(
          tags.map(t => t.searchText)
        );

        // Update all tags with their embeddings
        await Promise.all(
          tags.map((tag, i) =>
            this.tagVectorRepo.updateTagEmbedding(
              tag.id,
              embeddings[i].embedding,
              embeddings[i].model
            )
          )
        );

        processed += tags.length;
      } catch (error) {
        failed += tags.length;
        console.error(`[EmbeddingBackfill] Batch failed:`, error);
        // Continue with next batch rather than failing entirely
      }

      console.log(`[EmbeddingBackfill] Progress: ${processed} processed, ${failed} failed`);
    }

    const durationMs = Date.now() - startTime;
    console.log(`[EmbeddingBackfill] Complete for office ${officeId}: ${processed} processed, ${failed} failed in ${durationMs}ms`);

    return {
      success: failed === 0,
      processedCount: processed,
      failedCount: failed,
      durationMs,
    };
  }

  /**
   * Refresh embeddings for tags that have been updated
   */
  private async handleRefresh(
    job: PgBoss.Job<EmbeddingRefreshJobData>
  ): Promise<EmbeddingJobResult> {
    const { officeId } = job.data;
    const startTime = Date.now();
    const batchSize = 50;

    console.log(`[EmbeddingRefresh] Starting for office ${officeId}`);

    // Get tags needing re-embedding (updated since last embed)
    const tagsNeedingUpdate = await this.tagVectorRepo.getTagsNeedingReembedding(officeId, batchSize);

    // Also get any new tags without embeddings
    const newTags = await this.tagVectorRepo.getTagsWithoutEmbeddings(officeId, batchSize);

    const allTags = [...tagsNeedingUpdate, ...newTags];

    if (allTags.length === 0) {
      console.log(`[EmbeddingRefresh] No tags need refresh for office ${officeId}`);
      return {
        success: true,
        processedCount: 0,
        failedCount: 0,
        durationMs: Date.now() - startTime,
      };
    }

    console.log(`[EmbeddingRefresh] Processing ${allTags.length} tags (${tagsNeedingUpdate.length} updates, ${newTags.length} new)`);

    let processed = 0;
    let failed = 0;

    try {
      const embeddings = await this.embeddingService.embedBatch(
        allTags.map(t => t.searchText)
      );

      await Promise.all(
        allTags.map((tag, i) =>
          this.tagVectorRepo.updateTagEmbedding(
            tag.id,
            embeddings[i].embedding,
            embeddings[i].model
          )
        )
      );

      processed = allTags.length;
    } catch (error) {
      failed = allTags.length;
      console.error(`[EmbeddingRefresh] Failed for office ${officeId}:`, error);
    }

    const durationMs = Date.now() - startTime;
    console.log(`[EmbeddingRefresh] Complete for office ${officeId}: ${processed} processed, ${failed} failed in ${durationMs}ms`);

    return {
      success: failed === 0,
      processedCount: processed,
      failedCount: failed,
      durationMs,
    };
  }

  /**
   * Scheduled job that runs periodically for all offices
   */
  private async handleScheduledRefresh(
    job: PgBoss.Job<ScheduledEmbeddingRefreshJobData>
  ): Promise<EmbeddingJobResult> {
    const startTime = Date.now();

    console.log('[ScheduledEmbeddingRefresh] Starting for all offices');

    // Get all active offices
    const { data: offices, error } = await this.supabase
      .from('offices')
      .select('id, name');

    if (error) {
      console.error('[ScheduledEmbeddingRefresh] Failed to fetch offices:', error);
      return {
        success: false,
        processedCount: 0,
        failedCount: 0,
        durationMs: Date.now() - startTime,
        error: `Failed to fetch offices: ${error.message}`,
      };
    }

    if (!offices || offices.length === 0) {
      console.log('[ScheduledEmbeddingRefresh] No offices found');
      return {
        success: true,
        processedCount: 0,
        failedCount: 0,
        durationMs: Date.now() - startTime,
      };
    }

    let totalProcessed = 0;
    let totalFailed = 0;

    for (const office of offices) {
      try {
        const result = await this.handleRefresh({
          ...job,
          data: {
            type: JobNames.EMBEDDING_REFRESH,
            officeId: office.id,
          },
        } as PgBoss.Job<EmbeddingRefreshJobData>);

        totalProcessed += result.processedCount;
        totalFailed += result.failedCount;
      } catch (error) {
        console.error(`[ScheduledEmbeddingRefresh] Failed for office ${office.id}:`, error);
        totalFailed++;
      }
    }

    const durationMs = Date.now() - startTime;
    console.log(`[ScheduledEmbeddingRefresh] Complete: ${totalProcessed} processed, ${totalFailed} failed across ${offices.length} offices in ${durationMs}ms`);

    return {
      success: totalFailed === 0,
      processedCount: totalProcessed,
      failedCount: totalFailed,
      durationMs,
    };
  }
}
