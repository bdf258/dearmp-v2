/**
 * Embeddings Routes
 *
 * HTTP endpoints for managing tag embeddings:
 * - GET /embeddings/stats - Get embedding coverage statistics
 * - POST /embeddings/backfill - Trigger embedding backfill for an office
 * - POST /embeddings/refresh - Refresh stale embeddings
 * - POST /embeddings/tag/:tagId - Generate embedding for a single tag
 */

import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { z } from 'zod';
import { SupabaseClient } from '@supabase/supabase-js';
import { ApiResponse } from '../types';
import { QueueService, JobNames } from '../../../infrastructure/queue';
import {
  TagVectorRepository,
  EmbeddingStats,
} from '../../../infrastructure/repositories';

// ─────────────────────────────────────────────────────────────────────────────
// DEPENDENCIES
// ─────────────────────────────────────────────────────────────────────────────

export interface EmbeddingsRoutesDependencies {
  supabase: SupabaseClient;
  queueService: QueueService;
  /** Auth middleware to protect endpoints */
  authMiddleware: RequestHandler;
}

// ─────────────────────────────────────────────────────────────────────────────
// REQUEST SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

const OfficeIdParamSchema = z.object({
  officeId: z.string().uuid('Invalid office ID format'),
});

const TagIdParamSchema = z.object({
  tagId: z.string().uuid('Invalid tag ID format'),
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE FACTORY
// ─────────────────────────────────────────────────────────────────────────────

export function createEmbeddingsRoutes({
  supabase,
  queueService,
  authMiddleware,
}: EmbeddingsRoutesDependencies): Router {
  const router = Router();
  const tagVectorRepo = new TagVectorRepository(supabase);

  /**
   * GET /embeddings/stats/:officeId
   * Get embedding coverage statistics for an office
   */
  router.get(
    '/stats/:officeId',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { officeId } = OfficeIdParamSchema.parse(req.params);

        const stats = await tagVectorRepo.getEmbeddingStats(officeId);

        const response: ApiResponse<EmbeddingStats> = {
          success: true,
          data: stats,
        };

        res.json(response);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /embeddings/backfill/:officeId
   * Trigger embedding backfill for all tags without embeddings
   */
  router.post(
    '/backfill/:officeId',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { officeId } = OfficeIdParamSchema.parse(req.params);

        // Check current stats first
        const stats = await tagVectorRepo.getEmbeddingStats(officeId);

        if (stats.pending === 0) {
          const response: ApiResponse<{ message: string; stats: EmbeddingStats }> = {
            success: true,
            data: {
              message: 'All tags already have embeddings',
              stats,
            },
          };
          return res.json(response);
        }

        // Schedule the backfill job
        await queueService.send(JobNames.EMBEDDING_BACKFILL, {
          type: JobNames.EMBEDDING_BACKFILL,
          officeId,
        });

        const response: ApiResponse<{ message: string; pendingCount: number; jobId: string }> = {
          success: true,
          data: {
            message: `Backfill job scheduled for ${stats.pending} tags`,
            pendingCount: stats.pending,
            jobId: `embedding:backfill:${officeId}`,
          },
        };

        res.status(202).json(response);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /embeddings/refresh/:officeId
   * Refresh embeddings for tags that have been updated
   */
  router.post(
    '/refresh/:officeId',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { officeId } = OfficeIdParamSchema.parse(req.params);

        // Schedule the refresh job
        await queueService.send(JobNames.EMBEDDING_REFRESH, {
          type: JobNames.EMBEDDING_REFRESH,
          officeId,
        });

        const response: ApiResponse<{ message: string; jobId: string }> = {
          success: true,
          data: {
            message: 'Embedding refresh job scheduled',
            jobId: `embedding:refresh:${officeId}`,
          },
        };

        res.status(202).json(response);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /embeddings/tag/:tagId
   * Generate embedding for a specific tag
   */
  router.post(
    '/tag/:tagId',
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { tagId } = TagIdParamSchema.parse(req.params);

        // Get the tag to verify it exists and get the office ID
        const tag = await tagVectorRepo.getTagById(tagId);

        if (!tag) {
          return res.status(404).json({
            success: false,
            error: {
              code: 'TAG_NOT_FOUND',
              message: 'Tag not found',
            },
          });
        }

        // Get office ID from the tag
        const { data: tagData } = await supabase
          .from('legacy.tags')
          .select('office_id')
          .eq('id', tagId)
          .single();

        if (!tagData?.office_id) {
          return res.status(404).json({
            success: false,
            error: {
              code: 'TAG_NOT_FOUND',
              message: 'Tag office not found',
            },
          });
        }

        // Schedule the embedding job
        await queueService.send(JobNames.EMBEDDING_GENERATE_TAG, {
          type: JobNames.EMBEDDING_GENERATE_TAG,
          officeId: tagData.office_id,
          tagId,
        });

        const response: ApiResponse<{ message: string; tagId: string }> = {
          success: true,
          data: {
            message: 'Embedding generation scheduled',
            tagId,
          },
        };

        res.status(202).json(response);
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
