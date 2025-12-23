/**
 * Server Configuration
 *
 * Centralizes all configuration with environment variable validation.
 */

export interface Config {
  // Supabase
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;

  // Database (for pg-boss)
  databaseUrl: string;

  // Server
  port: number;
  nodeEnv: 'development' | 'production' | 'test';

  // Sync
  syncPollIntervalMs: number;
  syncBatchSize: number;

  // Rate Limiting
  legacyApiRps: number;

  // Queue (pg-boss)
  queueSchema: string;
  queueMonitorStateIntervalSeconds: number;
  queueDeleteAfterDays: number;
  queueRetentionDays: number;
}

/**
 * Load configuration from environment variables
 */
export function loadConfig(): Config {
  const nodeEnv = (process.env.NODE_ENV ?? 'development') as Config['nodeEnv'];

  return {
    // Supabase
    supabaseUrl: requireEnv('SUPABASE_URL'),
    supabaseAnonKey: requireEnv('SUPABASE_ANON_KEY'),
    supabaseServiceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),

    // Database
    databaseUrl: requireEnv('DATABASE_URL'),

    // Server
    port: parseInt(process.env.PORT ?? '3001', 10),
    nodeEnv,

    // Sync
    syncPollIntervalMs: parseInt(process.env.SYNC_POLL_INTERVAL_MS ?? '300000', 10), // 5 minutes
    syncBatchSize: parseInt(process.env.SYNC_BATCH_SIZE ?? '100', 10),

    // Rate Limiting
    legacyApiRps: parseInt(process.env.LEGACY_API_RPS ?? '10', 10),

    // Queue (pg-boss)
    queueSchema: process.env.QUEUE_SCHEMA ?? 'pgboss',
    queueMonitorStateIntervalSeconds: parseInt(process.env.QUEUE_MONITOR_INTERVAL ?? '30', 10),
    queueDeleteAfterDays: parseInt(process.env.QUEUE_DELETE_AFTER_DAYS ?? '7', 10),
    queueRetentionDays: parseInt(process.env.QUEUE_RETENTION_DAYS ?? '30', 10),
  };
}

/**
 * Require an environment variable to be set
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Validate configuration at startup
 */
export function validateConfig(config: Config): void {
  const errors: string[] = [];

  if (!config.supabaseUrl.startsWith('https://')) {
    errors.push('SUPABASE_URL must start with https://');
  }

  if (!config.databaseUrl.startsWith('postgres://') && !config.databaseUrl.startsWith('postgresql://')) {
    errors.push('DATABASE_URL must start with postgres:// or postgresql://');
  }

  if (config.port < 1 || config.port > 65535) {
    errors.push('PORT must be between 1 and 65535');
  }

  if (config.syncPollIntervalMs < 60000) {
    errors.push('SYNC_POLL_INTERVAL_MS must be at least 60000 (1 minute)');
  }

  if (config.legacyApiRps < 1 || config.legacyApiRps > 50) {
    errors.push('LEGACY_API_RPS must be between 1 and 50');
  }

  if (config.queueDeleteAfterDays < 1) {
    errors.push('QUEUE_DELETE_AFTER_DAYS must be at least 1');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}
