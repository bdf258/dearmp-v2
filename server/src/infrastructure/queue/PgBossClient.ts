/**
 * PgBoss Client
 *
 * Manages the pg-boss connection and provides a typed interface
 * for job queue operations.
 */

import PgBoss from 'pg-boss';
import { Config } from '../../config';
import {
  JobName,
  JobNames,
  AllJobData,
  JobOptions,
  DefaultJobOptions,
} from './types';

export interface PgBossClientOptions {
  config: Config;
  onError?: (error: Error) => void;
  onMonitor?: (state: PgBoss.MonitorStates) => void;
}

/**
 * Wrapper around pg-boss that provides typed job operations
 * and handles connection lifecycle.
 */
export class PgBossClient {
  private boss: PgBoss | null = null;
  private readonly config: Config;
  private readonly onError?: (error: Error) => void;
  private readonly onMonitor?: (state: PgBoss.MonitorStates) => void;
  private isStarted = false;

  constructor(options: PgBossClientOptions) {
    this.config = options.config;
    this.onError = options.onError;
    this.onMonitor = options.onMonitor;
  }

  /**
   * Get the pg-boss instance, throwing if not started
   */
  private getBoss(): PgBoss {
    if (!this.boss || !this.isStarted) {
      throw new Error('PgBoss client not started. Call start() first.');
    }
    return this.boss;
  }

  /**
   * Start the pg-boss client
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      return;
    }

    this.boss = new PgBoss({
      connectionString: this.config.databaseUrl,
      schema: this.config.queueSchema,
      monitorStateIntervalSeconds: this.config.queueMonitorStateIntervalSeconds,
      deleteAfterDays: this.config.queueDeleteAfterDays,
      retentionDays: this.config.queueRetentionDays,
      // Use application_name for debugging
      application_name: 'dearmp-legacy-integration',
      // Connection pool settings
      max: 5,
      // Archive completed jobs for analysis
      archiveCompletedAfterSeconds: 60 * 60, // 1 hour
    });

    // Set up event handlers
    this.boss.on('error', (error) => {
      console.error('[PgBoss] Error:', error);
      this.onError?.(error);
    });

    this.boss.on('monitor-states', (state) => {
      this.onMonitor?.(state);
    });

    await this.boss.start();
    this.isStarted = true;
    console.log('[PgBoss] Started successfully');

    // pg-boss v10+ requires queues to be created before sending jobs
    await this.ensureQueuesExist();
  }

  /**
   * Ensure all required queues exist (pg-boss v10+ requirement)
   */
  private async ensureQueuesExist(): Promise<void> {
    const boss = this.getBoss();
    const queueNames = Object.values(JobNames);

    console.log(`[PgBoss] Ensuring ${queueNames.length} queues exist...`);

    for (const queueName of queueNames) {
      try {
        await boss.createQueue(queueName);
        console.log(`[PgBoss] Queue '${queueName}' ready`);
      } catch (error) {
        // Queue might already exist, which is fine
        if (error instanceof Error && error.message.includes('already exists')) {
          console.log(`[PgBoss] Queue '${queueName}' already exists`);
        } else {
          console.error(`[PgBoss] Failed to create queue '${queueName}':`, error);
        }
      }
    }

    console.log('[PgBoss] All queues initialized');
  }

  /**
   * Stop the pg-boss client gracefully
   */
  async stop(): Promise<void> {
    if (!this.boss || !this.isStarted) {
      return;
    }

    await this.boss.stop({ graceful: true });
    this.isStarted = false;
    this.boss = null;
    console.log('[PgBoss] Stopped');
  }

  /**
   * Check if the client is running
   */
  isRunning(): boolean {
    return this.isStarted;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // JOB PUBLISHING
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Send a job to the queue
   */
  async send<T extends AllJobData>(
    name: JobName,
    data: T,
    options?: JobOptions
  ): Promise<string | null> {
    const boss = this.getBoss();
    const mergedOptions = {
      ...DefaultJobOptions[name],
      ...options,
    };

    try {
      console.log(`[PgBoss] Sending job to queue '${name}' with options:`, JSON.stringify(mergedOptions));
      const jobId = await boss.send(name, data, mergedOptions);
      if (!jobId) {
        console.error(`[PgBoss] boss.send returned null for queue '${name}'. This usually means a singleton key conflict.`);
      }
      return jobId;
    } catch (error) {
      console.error(`[PgBoss] Error sending job to queue '${name}':`, error);
      throw error;
    }
  }

  /**
   * Send multiple jobs as a batch
   */
  async sendBatch<T extends AllJobData>(
    jobs: Array<{ name: JobName; data: T; options?: JobOptions }>
  ): Promise<Array<string | null>> {
    const boss = this.getBoss();

    // Send jobs individually and collect results
    const results: Array<string | null> = [];
    for (const job of jobs) {
      const mergedOptions = {
        ...DefaultJobOptions[job.name],
        ...job.options,
      };
      const jobId = await boss.send(job.name, job.data, mergedOptions);
      results.push(jobId);
    }
    return results;
  }

  /**
   * Schedule a recurring job
   */
  async schedule(
    name: JobName,
    cron: string,
    data: AllJobData,
    options?: { tz?: string }
  ): Promise<void> {
    const boss = this.getBoss();
    await boss.schedule(name, cron, data, options);
    console.log(`[PgBoss] Scheduled job ${name} with cron: ${cron}`);
  }

  /**
   * Unschedule a recurring job
   */
  async unschedule(name: JobName): Promise<void> {
    const boss = this.getBoss();
    await boss.unschedule(name);
    console.log(`[PgBoss] Unscheduled job ${name}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // JOB CONSUMING
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Register a worker for a job type
   */
  async work<T extends AllJobData>(
    name: JobName,
    handler: (job: PgBoss.Job<T>) => Promise<void>,
    options?: { batchSize?: number; pollingIntervalSeconds?: number }
  ): Promise<string> {
    const boss = this.getBoss();
    // Wrap handler to handle batch mode (pg-boss now passes arrays)
    const batchHandler = async (jobs: PgBoss.Job<T>[]) => {
      for (const job of jobs) {
        await handler(job);
      }
    };
    const workOptions: PgBoss.WorkOptions = options ? {
      batchSize: options.batchSize ?? 1,
      pollingIntervalSeconds: options.pollingIntervalSeconds,
    } : { batchSize: 1 };
    return boss.work(name, workOptions, batchHandler as any);
  }

  /**
   * Stop a worker
   */
  async offWork(workerId: string): Promise<void> {
    const boss = this.getBoss();
    await boss.offWork(workerId);
  }

  /**
   * Fetch a single job without processing
   */
  async fetch<T extends AllJobData>(name: JobName): Promise<PgBoss.Job<T> | null> {
    const boss = this.getBoss();
    const jobs = await boss.fetch(name) as PgBoss.Job<T>[] | null;
    return jobs && jobs.length > 0 ? jobs[0] : null;
  }

  /**
   * Complete a job successfully
   */
  async complete(name: JobName, jobId: string, result?: object): Promise<void> {
    const boss = this.getBoss();
    await boss.complete(name, jobId, result);
  }

  /**
   * Fail a job
   */
  async fail(name: JobName, jobId: string, error?: Error | string): Promise<void> {
    const boss = this.getBoss();
    const errorData = error instanceof Error ? error : new Error(error ?? 'Unknown error');
    await boss.fail(name, jobId, errorData);
  }

  /**
   * Cancel a job
   */
  async cancel(name: JobName, jobId: string): Promise<void> {
    const boss = this.getBoss();
    await boss.cancel(name, jobId);
  }

  /**
   * Resume a paused job
   */
  async resume(name: JobName, jobId: string): Promise<void> {
    const boss = this.getBoss();
    await boss.resume(name, jobId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // JOB QUERIES
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get a job by ID
   */
  async getJobById(name: JobName, jobId: string): Promise<PgBoss.Job<AllJobData> | null> {
    const boss = this.getBoss();
    return boss.getJobById(name, jobId);
  }

  /**
   * Get queue size
   */
  async getQueueSize(name: JobName): Promise<number> {
    const boss = this.getBoss();
    return boss.getQueueSize(name);
  }

  /**
   * Delete a queue and all its jobs
   */
  async deleteQueue(name: JobName): Promise<void> {
    const boss = this.getBoss();
    await boss.deleteQueue(name);
  }

  /**
   * Purge completed jobs from a queue
   */
  async purgeQueue(name: JobName): Promise<void> {
    const boss = this.getBoss();
    await boss.purgeQueue(name);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CONVENIENCE METHODS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create an office-scoped singleton key
   */
  static createSingletonKey(officeId: string, jobType: string): string {
    return `${officeId}:${jobType}`;
  }

  /**
   * Send a sync job with office singleton protection
   */
  async sendSyncJob<T extends AllJobData>(
    name: JobName,
    data: T & { officeId: string },
    options?: JobOptions
  ): Promise<string | null> {
    return this.send(name, data, {
      ...options,
      singletonKey: PgBossClient.createSingletonKey(data.officeId, name),
      singletonSeconds: options?.singletonSeconds ?? 300, // 5 minute default
    });
  }

  /**
   * Get all registered job names
   */
  getJobNames(): typeof JobNames {
    return JobNames;
  }
}

/**
 * Create and start a PgBoss client
 */
export async function createPgBossClient(options: PgBossClientOptions): Promise<PgBossClient> {
  const client = new PgBossClient(options);
  await client.start();
  return client;
}
