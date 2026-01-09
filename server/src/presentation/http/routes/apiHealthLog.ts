/**
 * API Health Log Routes
 *
 * Server-side routes for logging API health check requests and responses.
 * Stores logs to the file system and provides endpoints to retrieve them.
 *
 * Endpoints:
 * - POST /api/health-log/log - Log a request/response pair
 * - GET /api/health-log/logs - Get recent logs
 * - DELETE /api/health-log/logs - Clear all logs
 */

import { Router, Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types';
import fs from 'fs';
import path from 'path';

const LOGS_DIR = path.resolve(__dirname, '../../../../logs');
const API_HEALTH_LOG_FILE = path.join(LOGS_DIR, 'api-health-requests.json');

export interface ApiHealthLogEntry {
  id: string;
  timestamp: string;
  endpoint: string;
  method: string;
  requestUrl: string;
  requestHeaders: Record<string, string>;
  requestBody: unknown;
  responseStatus: number;
  responseStatusText: string;
  responseHeaders: Record<string, string>;
  responseBody: string;
  duration: number;
  error?: string;
}

/**
 * Read logs from file
 */
function readLogs(): ApiHealthLogEntry[] {
  try {
    if (!fs.existsSync(API_HEALTH_LOG_FILE)) {
      return [];
    }
    const content = fs.readFileSync(API_HEALTH_LOG_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('[ApiHealthLog] Error reading logs:', error);
    return [];
  }
}

/**
 * Write logs to file
 */
function writeLogs(logs: ApiHealthLogEntry[]): void {
  try {
    // Ensure logs directory exists
    if (!fs.existsSync(LOGS_DIR)) {
      fs.mkdirSync(LOGS_DIR, { recursive: true });
    }
    fs.writeFileSync(API_HEALTH_LOG_FILE, JSON.stringify(logs, null, 2));
  } catch (error) {
    console.error('[ApiHealthLog] Error writing logs:', error);
  }
}

/**
 * Create API health log routes
 */
export function createApiHealthLogRoutes(): Router {
  const router = Router();

  /**
   * POST /log
   * Log a request/response pair
   */
  router.post('/log', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const logEntry: ApiHealthLogEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        endpoint: req.body.endpoint || 'unknown',
        method: req.body.method || 'POST',
        requestUrl: req.body.requestUrl || '',
        requestHeaders: req.body.requestHeaders || {},
        requestBody: req.body.requestBody,
        responseStatus: req.body.responseStatus || 0,
        responseStatusText: req.body.responseStatusText || '',
        responseHeaders: req.body.responseHeaders || {},
        responseBody: req.body.responseBody || '',
        duration: req.body.duration || 0,
        error: req.body.error,
      };

      const logs = readLogs();
      logs.unshift(logEntry); // Add to beginning (newest first)

      // Keep only last 100 logs
      const trimmedLogs = logs.slice(0, 100);
      writeLogs(trimmedLogs);

      console.log(`[ApiHealthLog] Logged ${logEntry.method} ${logEntry.endpoint} - ${logEntry.responseStatus} (${logEntry.duration}ms)`);

      const response: ApiResponse<{ id: string }> = {
        success: true,
        data: { id: logEntry.id },
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /logs
   * Get recent logs
   */
  router.get('/logs', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const logs = readLogs();

      const response: ApiResponse<ApiHealthLogEntry[]> = {
        success: true,
        data: logs,
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  });

  /**
   * DELETE /logs
   * Clear all logs
   */
  router.delete('/logs', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      writeLogs([]);
      console.log('[ApiHealthLog] Cleared all logs');

      const response: ApiResponse<{ cleared: boolean }> = {
        success: true,
        data: { cleared: true },
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
