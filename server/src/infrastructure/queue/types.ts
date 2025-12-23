/**
 * Job Type Definitions for pg-boss Queue
 *
 * Defines all job types used for syncing between the new DearMP v2
 * system and the legacy Caseworker database.
 */

// ============================================================================
// JOB NAMES
// ============================================================================

export const JobNames = {
  // Sync jobs - pull data from legacy to shadow DB
  SYNC_CONSTITUENTS: 'sync:constituents',
  SYNC_CASES: 'sync:cases',
  SYNC_EMAILS: 'sync:emails',
  SYNC_REFERENCE_DATA: 'sync:reference-data',
  SYNC_CASENOTES: 'sync:casenotes',
  SYNC_ALL: 'sync:all',

  // Push jobs - push data from shadow DB to legacy
  PUSH_CONSTITUENT: 'push:constituent',
  PUSH_CASE: 'push:case',
  PUSH_EMAIL: 'push:email',
  PUSH_CASENOTE: 'push:casenote',

  // Triage jobs
  TRIAGE_PROCESS_EMAIL: 'triage:process-email',
  TRIAGE_SUBMIT_DECISION: 'triage:submit-decision',
  TRIAGE_BATCH_PREFETCH: 'triage:batch-prefetch',

  // Scheduled jobs
  SCHEDULED_POLL_LEGACY: 'scheduled:poll-legacy',
  SCHEDULED_SYNC_OFFICE: 'scheduled:sync-office',
  SCHEDULED_CLEANUP: 'scheduled:cleanup',

  // Maintenance jobs
  MAINTENANCE_RECONCILE: 'maintenance:reconcile',
  MAINTENANCE_HEALTH_CHECK: 'maintenance:health-check',
} as const;

export type JobName = (typeof JobNames)[keyof typeof JobNames];

// ============================================================================
// BASE JOB DATA
// ============================================================================

export interface BaseJobData {
  officeId: string;
  correlationId?: string;
  initiatedBy?: string;
  priority?: number;
}

// ============================================================================
// SYNC JOB DATA
// ============================================================================

export interface SyncJobData extends BaseJobData {
  mode: 'full' | 'incremental';
  cursor?: string;
  modifiedSince?: string; // ISO date string
  batchSize?: number;
}

export interface SyncConstituentsJobData extends SyncJobData {
  type: typeof JobNames.SYNC_CONSTITUENTS;
}

export interface SyncCasesJobData extends SyncJobData {
  type: typeof JobNames.SYNC_CASES;
}

export interface SyncEmailsJobData extends SyncJobData {
  type: typeof JobNames.SYNC_EMAILS;
  emailType?: 'received' | 'sent' | 'draft';
  actionedOnly?: boolean;
}

export interface SyncReferenceDataJobData extends BaseJobData {
  type: typeof JobNames.SYNC_REFERENCE_DATA;
  entities?: Array<'caseTypes' | 'statusTypes' | 'categoryTypes' | 'contactTypes' | 'caseworkers'>;
}

export interface SyncCasenotesJobData extends SyncJobData {
  type: typeof JobNames.SYNC_CASENOTES;
  caseExternalId?: number;
}

export interface SyncAllJobData extends BaseJobData {
  type: typeof JobNames.SYNC_ALL;
  mode: 'full' | 'incremental';
  includeReferenceData?: boolean;
}

// ============================================================================
// PUSH JOB DATA
// ============================================================================

export interface PushConstituentJobData extends BaseJobData {
  type: typeof JobNames.PUSH_CONSTITUENT;
  constituentId: string; // UUID from shadow DB
  operation: 'create' | 'update';
  data: {
    firstName: string;
    lastName: string;
    title?: string;
    organisationType?: string;
  };
}

export interface PushCaseJobData extends BaseJobData {
  type: typeof JobNames.PUSH_CASE;
  caseId: string; // UUID from shadow DB
  operation: 'create' | 'update';
  data: {
    constituentId: string;
    caseTypeId?: number;
    statusId?: number;
    categoryTypeId?: number;
    contactTypeId?: number;
    assignedToId?: number;
    summary?: string;
    reviewDate?: string;
  };
}

export interface PushEmailJobData extends BaseJobData {
  type: typeof JobNames.PUSH_EMAIL;
  emailId: string; // UUID from shadow DB
  operation: 'create' | 'update' | 'send';
  data: {
    subject?: string;
    htmlBody?: string;
    to?: string[];
    cc?: string[];
    bcc?: string[];
    caseId?: number;
    actioned?: boolean;
  };
}

export interface PushCasenoteJobData extends BaseJobData {
  type: typeof JobNames.PUSH_CASENOTE;
  casenoteId: string;
  caseExternalId: number;
  operation: 'create' | 'update' | 'delete';
  data: {
    type: string;
    content?: string;
  };
}

// ============================================================================
// TRIAGE JOB DATA
// ============================================================================

export interface TriageProcessEmailJobData extends BaseJobData {
  type: typeof JobNames.TRIAGE_PROCESS_EMAIL;
  emailExternalId: number;
  emailId: string;
  fromAddress: string;
  subject?: string;
}

export interface TriageSubmitDecisionJobData extends BaseJobData {
  type: typeof JobNames.TRIAGE_SUBMIT_DECISION;
  emailId: string;
  emailExternalId: number;
  decision: {
    action: 'create_new' | 'add_to_case' | 'ignore';
    constituentId?: string;
    newConstituent?: {
      firstName: string;
      lastName: string;
      email: string;
    };
    caseId?: string;
    newCase?: {
      caseTypeId: number;
      statusId: number;
      summary?: string;
    };
    markActioned: boolean;
  };
}

export interface TriageBatchPrefetchJobData extends BaseJobData {
  type: typeof JobNames.TRIAGE_BATCH_PREFETCH;
  emailIds: string[];
  prefetchAhead: number;
}

// ============================================================================
// SCHEDULED JOB DATA
// ============================================================================

export interface ScheduledPollLegacyJobData extends BaseJobData {
  type: typeof JobNames.SCHEDULED_POLL_LEGACY;
  pollType: 'emails' | 'cases' | 'constituents' | 'all';
  lastPollAt?: string;
}

export interface ScheduledSyncOfficeJobData extends BaseJobData {
  type: typeof JobNames.SCHEDULED_SYNC_OFFICE;
  syncEntities: Array<'constituents' | 'cases' | 'emails' | 'referenceData'>;
}

export interface ScheduledCleanupJobData extends BaseJobData {
  type: typeof JobNames.SCHEDULED_CLEANUP;
  cleanupType: 'old_jobs' | 'stale_syncs' | 'orphaned_records';
  olderThanDays?: number;
}

// ============================================================================
// MAINTENANCE JOB DATA
// ============================================================================

export interface MaintenanceReconcileJobData extends BaseJobData {
  type: typeof JobNames.MAINTENANCE_RECONCILE;
  entityType: 'constituents' | 'cases' | 'emails';
  dryRun?: boolean;
}

export interface MaintenanceHealthCheckJobData extends BaseJobData {
  type: typeof JobNames.MAINTENANCE_HEALTH_CHECK;
  checkType: 'api_connectivity' | 'data_integrity' | 'sync_status';
}

// ============================================================================
// UNION TYPES
// ============================================================================

export type SyncJobDataUnion =
  | SyncConstituentsJobData
  | SyncCasesJobData
  | SyncEmailsJobData
  | SyncReferenceDataJobData
  | SyncCasenotesJobData
  | SyncAllJobData;

export type PushJobDataUnion =
  | PushConstituentJobData
  | PushCaseJobData
  | PushEmailJobData
  | PushCasenoteJobData;

export type TriageJobDataUnion =
  | TriageProcessEmailJobData
  | TriageSubmitDecisionJobData
  | TriageBatchPrefetchJobData;

export type ScheduledJobDataUnion =
  | ScheduledPollLegacyJobData
  | ScheduledSyncOfficeJobData
  | ScheduledCleanupJobData;

export type MaintenanceJobDataUnion =
  | MaintenanceReconcileJobData
  | MaintenanceHealthCheckJobData;

export type AllJobData =
  | SyncJobDataUnion
  | PushJobDataUnion
  | TriageJobDataUnion
  | ScheduledJobDataUnion
  | MaintenanceJobDataUnion;

// ============================================================================
// JOB RESULT TYPES
// ============================================================================

export interface SyncJobResult {
  success: boolean;
  entityType: string;
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsFailed: number;
  cursor?: string;
  hasMore: boolean;
  errors?: Array<{ externalId: number; error: string }>;
  durationMs: number;
}

export interface PushJobResult {
  success: boolean;
  entityType: string;
  internalId: string;
  externalId?: number;
  operation: string;
  error?: string;
  durationMs: number;
}

export interface TriageJobResult {
  success: boolean;
  emailId: string;
  matchedConstituent?: { id: string; externalId: number; name: string };
  matchedCase?: { id: string; externalId: number; summary: string };
  suggestion?: {
    action: string;
    confidence: number;
    reasoning: string;
  };
  error?: string;
  durationMs: number;
}

export interface ScheduledJobResult {
  success: boolean;
  jobType: string;
  itemsProcessed: number;
  nextRunAt?: string;
  error?: string;
  durationMs: number;
}

// ============================================================================
// JOB OPTIONS
// ============================================================================

export interface JobOptions {
  priority?: number;
  retryLimit?: number;
  retryDelay?: number;
  retryBackoff?: boolean;
  expireInSeconds?: number;
  startAfter?: Date | string;
  singletonKey?: string;
  singletonSeconds?: number;
  deadLetter?: string;
}

export const DefaultJobOptions: Record<string, JobOptions> = {
  [JobNames.SYNC_CONSTITUENTS]: {
    retryLimit: 3,
    retryDelay: 60,
    retryBackoff: true,
    expireInSeconds: 3600, // 1 hour
  },
  [JobNames.SYNC_CASES]: {
    retryLimit: 3,
    retryDelay: 60,
    retryBackoff: true,
    expireInSeconds: 3600,
  },
  [JobNames.SYNC_EMAILS]: {
    retryLimit: 3,
    retryDelay: 60,
    retryBackoff: true,
    expireInSeconds: 3600,
  },
  [JobNames.SYNC_REFERENCE_DATA]: {
    retryLimit: 3,
    retryDelay: 30,
    expireInSeconds: 600, // 10 minutes
  },
  [JobNames.PUSH_CONSTITUENT]: {
    retryLimit: 5,
    retryDelay: 30,
    retryBackoff: true,
    expireInSeconds: 300,
    deadLetter: 'dead-letter:push',
  },
  [JobNames.PUSH_CASE]: {
    retryLimit: 5,
    retryDelay: 30,
    retryBackoff: true,
    expireInSeconds: 300,
    deadLetter: 'dead-letter:push',
  },
  [JobNames.PUSH_EMAIL]: {
    retryLimit: 5,
    retryDelay: 30,
    retryBackoff: true,
    expireInSeconds: 300,
    deadLetter: 'dead-letter:push',
  },
  [JobNames.TRIAGE_PROCESS_EMAIL]: {
    retryLimit: 2,
    retryDelay: 10,
    expireInSeconds: 120,
  },
  [JobNames.TRIAGE_SUBMIT_DECISION]: {
    retryLimit: 3,
    retryDelay: 30,
    retryBackoff: true,
    expireInSeconds: 300,
    deadLetter: 'dead-letter:triage',
  },
  [JobNames.SCHEDULED_POLL_LEGACY]: {
    retryLimit: 1,
    expireInSeconds: 300,
    singletonSeconds: 240, // Prevent overlapping polls
  },
  [JobNames.SCHEDULED_SYNC_OFFICE]: {
    retryLimit: 1,
    expireInSeconds: 7200, // 2 hours
    singletonSeconds: 7000,
  },
};
