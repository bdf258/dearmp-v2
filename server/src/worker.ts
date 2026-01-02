/**
 * Worker Entry Point
 *
 * Starts the pg-boss worker that processes queue jobs for
 * synchronizing data between the new and legacy databases.
 *
 * Run with: npm run worker
 * Development: npm run worker:dev
 */

import { createClient } from '@supabase/supabase-js';
import { loadConfig, validateConfig } from './config';
import {
  createPgBossClient,
  QueueService,
  SyncJobHandler,
  PushJobHandler,
  TriageJobHandler,
  ScheduledJobHandler,
} from './infrastructure/queue';
import { LegacyApiClient, ICredentialsRepository } from './infrastructure/api/LegacyApiClient';
import {
  SupabaseConstituentRepository,
  SupabaseCaseRepository,
  SupabaseEmailRepository,
  SupabaseReferenceDataRepository,
} from './infrastructure/repositories';
import { GeminiLLMService } from './infrastructure/llm';
import { ILLMAnalysisService } from './application/services';
import { OfficeId } from './domain/value-objects';

// ============================================================================
// CONFIGURATION
// ============================================================================

const config = loadConfig();
validateConfig(config);

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║           DearMP Legacy Integration Worker                     ║');
console.log('╚════════════════════════════════════════════════════════════════╝');
console.log(`Environment: ${config.nodeEnv}`);
console.log(`Database: ${config.databaseUrl.replace(/:[^:@]+@/, ':****@')}`);
console.log(`Legacy API: ${config.legacyApiDisabled ? 'DISABLED (safe mode)' : 'Enabled'}`);
console.log(`LLM: ${config.geminiApiKey ? `Gemini (${config.geminiModel})` : 'Disabled (no API key)'}`);

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
// REPOSITORY IMPLEMENTATIONS
// ============================================================================

// Credentials repository for legacy API authentication
// Uses RPC functions to handle encryption/decryption in the database
class SupabaseCredentialsRepository implements ICredentialsRepository {
  async getCredentials(officeId: OfficeId) {
    // Use RPC function to get decrypted credentials
    const { data, error } = await supabase.rpc('get_api_credentials', {
      p_office_id: officeId.toString(),
    });

    if (error) {
      console.error('Failed to get API credentials:', error.message);
      return null;
    }

    // RPC returns an array, get the first row
    const credentials = Array.isArray(data) ? data[0] : data;
    if (!credentials) return null;

    return {
      apiBaseUrl: credentials.api_base_url,
      token: credentials.token,
      tokenExpiresAt: credentials.token_expires_at
        ? new Date(credentials.token_expires_at)
        : undefined,
      email: credentials.email,
      password: credentials.password,
    };
  }

  async updateToken(officeId: OfficeId, token: string, expiresAt: Date) {
    // Use RPC function to encrypt and store the token
    const { error } = await supabase.rpc('update_api_token', {
      p_office_id: officeId.toString(),
      p_token: token,
      p_expires_at: expiresAt.toISOString(),
    });

    if (error) {
      console.error('Failed to update API token:', error.message);
      throw new Error(`Failed to update API token: ${error.message}`);
    }
  }
}

// Sync status repository
class SupabaseSyncStatusRepository {
  async getLastSyncTime(officeId: OfficeId, entityType: string): Promise<Date | null> {
    const { data } = await supabase
      .from('sync_status')
      .select('last_sync_completed_at')
      .eq('office_id', officeId.toString())
      .eq('entity_type', entityType)
      .single();

    return data?.last_sync_completed_at ? new Date(data.last_sync_completed_at) : null;
  }

  async updateSyncStatus(
    officeId: OfficeId,
    entityType: string,
    status: {
      startedAt?: Date;
      completedAt?: Date;
      success?: boolean;
      error?: string;
      cursor?: string;
      recordsSynced?: number;
      recordsFailed?: number;
    }
  ): Promise<void> {
    await supabase
      .from('sync_status')
      .upsert(
        {
          office_id: officeId.toString(),
          entity_type: entityType,
          last_sync_started_at: status.startedAt?.toISOString(),
          last_sync_completed_at: status.completedAt?.toISOString(),
          last_sync_success: status.success,
          last_sync_error: status.error,
          last_sync_cursor: status.cursor,
          records_synced: status.recordsSynced,
          records_failed: status.recordsFailed,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'office_id,entity_type' }
      );
  }

  async getAllStatuses(officeId: OfficeId) {
    const { data } = await supabase
      .from('sync_status')
      .select('*')
      .eq('office_id', officeId.toString());

    return data ?? [];
  }

  async deleteOldSyncStatuses(officeId: OfficeId, olderThan: Date): Promise<number> {
    // First count, then delete
    const { count } = await supabase
      .from('sync_status')
      .select('*', { count: 'exact', head: true })
      .eq('office_id', officeId.toString())
      .lt('updated_at', olderThan.toISOString());

    // Now delete
    await supabase
      .from('sync_status')
      .delete()
      .eq('office_id', officeId.toString())
      .lt('updated_at', olderThan.toISOString());

    return count ?? 0;
  }

  async getActiveOffices(): Promise<OfficeId[]> {
    const { data } = await supabase
      .from('sync_status')
      .select('office_id')
      .gte('updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if (!data) return [];
    const uniqueOfficeIds = [...new Set(data.map((d: { office_id: string }) => d.office_id))];
    return uniqueOfficeIds.map(id => OfficeId.create(id));
  }
}

// Audit log repository
class SupabaseAuditLogRepository {
  async log(entry: {
    officeId: string;
    entityType: string;
    operation: string;
    externalId?: number;
    internalId?: string;
    oldData?: object;
    newData?: object;
    error?: string;
  }): Promise<void> {
    await supabase.from('sync_audit_log').insert({
      office_id: entry.officeId,
      entity_type: entry.entityType,
      operation: entry.operation,
      external_id: entry.externalId,
      internal_id: entry.internalId,
      old_data: entry.oldData,
      new_data: entry.newData,
      error_message: entry.error,
    });
  }
}

// Poll status repository
class SupabasePollStatusRepository {
  async getLastPollTime(officeId: OfficeId, pollType: string): Promise<Date | null> {
    const { data } = await supabase
      .from('sync_status')
      .select('last_sync_completed_at')
      .eq('office_id', officeId.toString())
      .eq('entity_type', `poll_${pollType}`)
      .single();

    return data?.last_sync_completed_at ? new Date(data.last_sync_completed_at) : null;
  }

  async updateLastPollTime(officeId: OfficeId, pollType: string, pollTime: Date): Promise<void> {
    await supabase
      .from('sync_status')
      .upsert(
        {
          office_id: officeId.toString(),
          entity_type: `poll_${pollType}`,
          last_sync_completed_at: pollTime.toISOString(),
          last_sync_success: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'office_id,entity_type' }
      );
  }
}

// Triage cache repository (using Supabase as a simple cache)
class SupabaseTriageCacheRepository {
  async set(
    emailId: string,
    data: {
      matchedConstituent?: { id: string; externalId: number; name: string };
      matchedCases?: Array<{ id: string; externalId: number; summary: string }>;
      suggestion?: { action: string; confidence: number; reasoning: string };
      processedAt: Date;
    }
  ): Promise<void> {
    // In production, consider using Redis for caching
    // This is a simple implementation using a table
    console.log(`[TriageCache] Caching result for email ${emailId}`);
  }

  async get(emailId: string) {
    console.log(`[TriageCache] Getting cached result for email ${emailId}`);
    return null; // Would fetch from cache table
  }

  async delete(emailId: string): Promise<void> {
    console.log(`[TriageCache] Deleting cached result for email ${emailId}`);
  }
}

// ============================================================================
// MAIN WORKER STARTUP
// ============================================================================

async function main() {
  console.log('\nStarting worker...\n');

  // Create repositories
  const credentialsRepo = new SupabaseCredentialsRepository();
  const syncStatusRepo = new SupabaseSyncStatusRepository();
  const auditLogRepo = new SupabaseAuditLogRepository();
  const pollStatusRepo = new SupabasePollStatusRepository();
  const triageCacheRepo = new SupabaseTriageCacheRepository();

  // Cast to ISupabaseClient for type compatibility
  const constituentRepo = new SupabaseConstituentRepository(supabase as any);
  const caseRepo = new SupabaseCaseRepository(supabase as any);
  const emailRepo = new SupabaseEmailRepository(supabase as any);
  const referenceDataRepo = new SupabaseReferenceDataRepository(supabase as any);

  // Create legacy API client
  const legacyApiClient = new LegacyApiClient(credentialsRepo);

  // Create pg-boss client
  const pgBossClient = await createPgBossClient({
    config,
    onError: (error) => {
      console.error('[Worker] PgBoss error:', error);
    },
    onMonitor: (state) => {
      const queues = Object.entries(state.queues).map(([name, info]) => ({
        name,
        ...info,
      }));
      console.log('[Worker] Queue stats:', JSON.stringify(queues, null, 2));
    },
  });

  // Create queue service
  const queueService = new QueueService({ pgBossClient });

  // Create and register handlers
  const syncHandler = new SyncJobHandler({
    pgBossClient,
    legacyApiClient,
    constituentRepository: constituentRepo,
    caseRepository: caseRepo,
    emailRepository: emailRepo,
    referenceDataRepository: referenceDataRepo,
    syncStatusRepository: syncStatusRepo,
  });

  const pushHandler = new PushJobHandler({
    pgBossClient,
    legacyApiClient,
    constituentRepository: constituentRepo,
    caseRepository: caseRepo,
    emailRepository: emailRepo,
    auditLogRepository: auditLogRepo,
  });

  // Create LLM service if API key is configured
  let llmService: ILLMAnalysisService | undefined;
  if (config.geminiApiKey) {
    llmService = new GeminiLLMService({
      apiKey: config.geminiApiKey,
      model: config.geminiModel,
      maxRetries: config.geminiMaxRetries,
      timeoutMs: config.geminiTimeoutMs,
    });
    console.log('[Worker] Gemini LLM service initialized');
  }

  const triageHandler = new TriageJobHandler({
    pgBossClient,
    legacyApiClient,
    constituentRepository: constituentRepo,
    caseRepository: caseRepo,
    emailRepository: emailRepo,
    triageCacheRepository: triageCacheRepo,
    llmAnalysisService: llmService,
  });

  const scheduledHandler = new ScheduledJobHandler({
    pgBossClient,
    queueService,
    legacyApiClient,
    emailRepository: emailRepo,
    constituentRepository: constituentRepo,
    caseRepository: caseRepo,
    referenceDataRepository: referenceDataRepo,
    pollStatusRepository: pollStatusRepo,
    syncStatusRepository: syncStatusRepo,
  });

  // Register all handlers
  await syncHandler.register();
  await pushHandler.register();
  await triageHandler.register();
  await scheduledHandler.register();

  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                    Worker Ready                                 ║');
  console.log('╠════════════════════════════════════════════════════════════════╣');
  console.log('║  Registered handlers:                                          ║');
  console.log('║  - SyncJobHandler      (constituents, cases, emails, refs)     ║');
  console.log('║  - PushJobHandler      (constituent, case, email, casenote)    ║');
  console.log('║  - TriageJobHandler    (process-email, submit-decision, batch) ║');
  console.log('║  - ScheduledJobHandler (poll-legacy, sync-office, cleanup)     ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('\nWaiting for jobs...\n');

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\nReceived ${signal}. Shutting down gracefully...`);
    await pgBossClient.stop();
    console.log('Worker stopped.');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Keep the process running
  await new Promise(() => {});
}

main().catch((error) => {
  console.error('Worker failed to start:', error);
  process.exit(1);
});
