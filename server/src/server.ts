/**
 * API Server Entry Point
 *
 * Starts the HTTP API server for the DearMP Legacy Integration.
 * This server provides REST endpoints for:
 * - Sync operations (trigger sync, get status, cancel)
 * - Triage operations (get queue, confirm, dismiss)
 * - Reference data (case types, status types, caseworkers, etc.)
 * - Health checks
 *
 * Run with: npm run server
 * Development: npm run server:dev
 */

import express from 'express';
import helmet from 'helmet';
import { createClient } from '@supabase/supabase-js';
import { loadConfig, validateConfig } from './config';
import {
  createPgBossClient,
  QueueService,
} from './infrastructure/queue';
import {
  createAuthMiddleware,
  errorHandler,
  notFoundHandler,
  createSyncRoutes,
  createTriageRoutes,
  createTestTriageRoutes,
  createReferenceDataRoutes,
  createHealthRoutes,
  apiRateLimiter,
} from './presentation/http';

// ============================================================================
// CONFIGURATION
// ============================================================================

const config = loadConfig();
validateConfig(config);
const startTime = new Date();

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║           DearMP Legacy Integration API Server                 ║');
console.log('╚════════════════════════════════════════════════════════════════╝');
console.log(`Environment: ${config.nodeEnv}`);
console.log(`Port: ${config.port}`);

// ============================================================================
// SUPABASE CLIENT
// ============================================================================

const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// ============================================================================
// EXPRESS APP SETUP
// ============================================================================

const app = express();

// Security headers (X-Content-Type-Options, X-Frame-Options, HSTS, CSP, etc.)
app.use(helmet());

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS headers - restricted to allowed origins only
const ALLOWED_ORIGINS = [
  // Production domains
  /^https:\/\/([a-z0-9-]+\.)?dearmp\.uk$/,
  /^https:\/\/([a-z0-9-]+\.)?kep\.la$/,
  /^https:\/\/([a-z0-9-]+\.)?farier\.com$/,
  // Development (only in dev mode)
  ...(config.nodeEnv === 'development' ? [
    /^http:\/\/localhost(:\d+)?$/,
    /^http:\/\/127\.0\.0\.1(:\d+)?$/,
    /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/, // Local network IPs for development
  ] : []),
];

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGINS.some(pattern => pattern.test(origin));
}

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Vary', 'Origin');
  }
  next();
});

app.options('*', (req, res) => {
  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.sendStatus(204);
  } else {
    res.sendStatus(403);
  }
});

// Request logging - redact sensitive path segments (UUIDs, IDs)
app.use((req, _res, next) => {
  // Redact UUIDs and numeric IDs from path for privacy
  const redactedPath = req.path
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[REDACTED-UUID]')
    .replace(/\/\d+(?=\/|$)/g, '/[REDACTED-ID]');
  console.log(`[${new Date().toISOString()}] ${req.method} ${redactedPath}`);
  next();
});

// Rate limiting (applied globally, 100 requests per minute per user/IP)
app.use(apiRateLimiter);

// ============================================================================
// MAIN STARTUP
// ============================================================================

async function main() {
  console.log('\nStarting API server...\n');

  // Create pg-boss client (optional - some endpoints don't need it)
  let queueService: QueueService | undefined;
  try {
    const pgBossClient = await createPgBossClient({
      config,
      onError: (error) => {
        console.error('[Server] PgBoss error:', error);
      },
    });
    queueService = new QueueService({ pgBossClient });
    console.log('[Server] Queue service initialized');
  } catch (error) {
    console.warn('[Server] Queue service not available:', error instanceof Error ? error.message : 'Unknown error');
    console.warn('[Server] Some endpoints will return 503');
  }

  // Create authentication middleware
  const authMiddleware = createAuthMiddleware(supabase);

  // ─────────────────────────────────────────────────────────────────────────
  // ROUTES
  // ─────────────────────────────────────────────────────────────────────────

  // Health routes (basic health/ready/live are public, /metrics requires admin auth)
  app.use(
    '/health',
    createHealthRoutes({
      supabase,
      queueService,
      startTime,
      // Cast to RequestHandler to satisfy TypeScript (authMiddleware uses AuthenticatedRequest)
      authMiddleware: authMiddleware as unknown as import('express').RequestHandler,
    })
  );

  // Protected routes (require authentication)
  // Cast authMiddleware to satisfy Express types (it mutates req to add user/officeId)
  const typedAuthMiddleware = authMiddleware as unknown as express.RequestHandler;

  if (queueService) {
    app.use(
      '/sync',
      typedAuthMiddleware,
      createSyncRoutes({ supabase, queueService })
    );

    app.use(
      '/triage',
      typedAuthMiddleware,
      createTriageRoutes({ supabase, queueService })
    );

    // Test triage routes (for uploading .eml files to test the triage pipeline)
    app.use(
      '/test-triage',
      typedAuthMiddleware,
      createTestTriageRoutes({ supabase, queueService })
    );
  } else {
    // Return 503 for sync/triage if queue not available
    app.use('/sync', (_req, res) => {
      res.status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Queue service not available',
        },
      });
    });

    app.use('/triage', (_req, res) => {
      res.status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Queue service not available',
        },
      });
    });

    app.use('/test-triage', (_req, res) => {
      res.status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Queue service not available',
        },
      });
    });
  }

  app.use(
    '/reference',
    typedAuthMiddleware,
    createReferenceDataRoutes({ supabase })
  );

  // Root endpoint
  app.get('/', (_req, res) => {
    res.json({
      name: 'DearMP Legacy Integration API',
      version: '0.1.0',
      endpoints: {
        health: '/health',
        sync: '/sync',
        triage: '/triage',
        testTriage: '/test-triage',
        reference: '/reference',
      },
    });
  });

  // Error handlers
  app.use(notFoundHandler);
  app.use(errorHandler);

  // ─────────────────────────────────────────────────────────────────────────
  // START SERVER
  // ─────────────────────────────────────────────────────────────────────────

  const server = app.listen(config.port, () => {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    API Server Ready                            ║');
    console.log('╠════════════════════════════════════════════════════════════════╣');
    console.log(`║  Listening on: http://localhost:${config.port}                        ║`);
    console.log('║                                                                ║');
    console.log('║  Endpoints:                                                    ║');
    console.log('║  - GET  /health           Health check                         ║');
    console.log('║  - GET  /health/ready     Readiness check                      ║');
    console.log('║  - GET  /health/metrics   Server metrics                       ║');
    console.log('║                                                                ║');
    console.log('║  - GET  /sync/status      Get sync status                      ║');
    console.log('║  - POST /sync/start       Start sync job                       ║');
    console.log('║  - POST /sync/cancel      Cancel sync                          ║');
    console.log('║  - GET  /sync/audit-log   Get audit log                        ║');
    console.log('║                                                                ║');
    console.log('║  - GET  /triage/queue     Get triage queue                     ║');
    console.log('║  - GET  /triage/email/:id Get email details                    ║');
    console.log('║  - POST /triage/confirm   Confirm triage                       ║');
    console.log('║  - POST /triage/dismiss   Dismiss emails                       ║');
    console.log('║  - GET  /triage/stats     Get triage stats                     ║');
    console.log('║                                                                ║');
    console.log('║  - POST /test-triage/upload  Upload .eml for testing           ║');
    console.log('║  - GET  /test-triage/status/:id  Get job status                ║');
    console.log('║  - GET  /test-triage/list  List test emails                    ║');
    console.log('║                                                                ║');
    console.log('║  - GET  /reference/all    Get all reference data               ║');
    console.log('║  - GET  /reference/*      Get specific reference types         ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('\nServer is ready to accept requests.\n');
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\nReceived ${signal}. Shutting down gracefully...`);

    server.close(() => {
      console.log('HTTP server closed.');
    });

    // Close queue service if available
    if (queueService) {
      // pg-boss client would be stopped here if we had a reference
    }

    console.log('Server stopped.');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
  console.error('Server failed to start:', error);
  process.exit(1);
});
