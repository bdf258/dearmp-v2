/**
 * Health Routes
 *
 * HTTP endpoints for health checks and system status:
 * - GET /health - Basic health check
 * - GET /health/ready - Readiness check (includes dependencies)
 * - GET /health/live - Liveness check (is the server running)
 */

import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import { ApiResponse } from '../types';
import { QueueService } from '../../../infrastructure/queue';
import { requireAdmin } from '../middleware';

export interface HealthRoutesDependencies {
  supabase: SupabaseClient;
  queueService?: QueueService;
  startTime: Date;
  /** Optional auth middleware to protect /metrics endpoint */
  authMiddleware?: RequestHandler;
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  timestamp: string;
  checks: {
    database: boolean;
    queue?: boolean;
  };
  version: string;
}

/**
 * Create health routes
 */
export function createHealthRoutes({ supabase, queueService, startTime, authMiddleware }: HealthRoutesDependencies): Router {
  const router = Router();

  /**
   * GET /health
   * Basic health check - returns healthy if server is running
   */
  router.get('/', (_req: Request, res: Response) => {
    const response: ApiResponse<{ status: string; uptime: number }> = {
      success: true,
      data: {
        status: 'healthy',
        uptime: Math.floor((Date.now() - startTime.getTime()) / 1000),
      },
    };
    res.json(response);
  });

  /**
   * GET /health/live
   * Liveness check - is the server process running
   * Used by Kubernetes/Docker for liveness probes
   */
  router.get('/live', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'alive' });
  });

  /**
   * GET /health/ready
   * Readiness check - includes dependency checks
   * Used by Kubernetes/Docker for readiness probes
   */
  router.get('/ready', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const checks: HealthStatus['checks'] = {
        database: false,
      };

      // Check database connectivity
      try {
        const { error } = await supabase.from('offices').select('id').limit(1);
        checks.database = !error;
      } catch {
        checks.database = false;
      }

      // Check queue service if available
      if (queueService) {
        try {
          const queueHealth = await queueService.healthCheck();
          checks.queue = queueHealth.healthy;
        } catch {
          checks.queue = false;
        }
      }

      const allHealthy = Object.values(checks).every((v) => v);
      const anyHealthy = Object.values(checks).some((v) => v);

      let status: HealthStatus['status'];
      if (allHealthy) {
        status = 'healthy';
      } else if (anyHealthy) {
        status = 'degraded';
      } else {
        status = 'unhealthy';
      }

      const healthStatus: HealthStatus = {
        status,
        uptime: Math.floor((Date.now() - startTime.getTime()) / 1000),
        timestamp: new Date().toISOString(),
        checks,
        version: process.env.npm_package_version ?? '0.1.0',
      };

      const response: ApiResponse<HealthStatus> = {
        success: status !== 'unhealthy',
        data: healthStatus,
      };

      res.status(status === 'unhealthy' ? 503 : 200).json(response);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /health/metrics
   * Returns basic metrics for monitoring
   * Protected: requires authentication (admin only) as it exposes internal details
   */
  const metricsHandler = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();

      const metrics = {
        uptime: Math.floor((Date.now() - startTime.getTime()) / 1000),
        memory: {
          rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
          external: Math.round(memoryUsage.external / 1024 / 1024), // MB
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system,
        },
        nodeVersion: process.version,
        platform: process.platform,
      };

      // Add queue metrics if available
      let queueMetrics: Record<string, number> | undefined;
      if (queueService) {
        try {
          queueMetrics = await queueService.getAllQueueSizes();
        } catch {
          // Ignore queue errors in metrics
        }
      }

      const response: ApiResponse = {
        success: true,
        data: {
          ...metrics,
          queues: queueMetrics,
        },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  // Register metrics endpoint with authentication if middleware provided
  if (authMiddleware) {
    router.get('/metrics', authMiddleware, requireAdmin as RequestHandler, metricsHandler);
  } else {
    // Fallback without auth (for backwards compatibility in development)
    router.get('/metrics', metricsHandler);
  }

  return router;
}
