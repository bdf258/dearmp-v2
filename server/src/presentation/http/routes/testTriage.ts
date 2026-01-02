/**
 * Test Triage Routes
 *
 * HTTP endpoints for testing the email triage pipeline with uploaded .eml files.
 * These routes use the EXACT same processing pipeline as real emails coming from
 * the Caseworker API, allowing developers to test the full triage flow.
 *
 * Endpoints:
 * - POST /test-triage/upload - Upload an .eml file and process it through triage
 * - GET /test-triage/status/:id - Get the status of a test triage job
 * - DELETE /test-triage/:id - Clean up a test email
 */

import { Router, RequestHandler } from 'express';
import { z } from 'zod';
import { SupabaseClient } from '@supabase/supabase-js';
import { AuthenticatedRequest, ApiResponse, ApiError } from '../types';
import { requireCaseworker } from '../middleware';
import { QueueService, JobNames } from '../../../infrastructure/queue';
import { parseEmlContent, ParsedEmail } from '../../../infrastructure/utils/emlParser';
import { sanitizeEmailHtml } from '../utils';

// Validation schemas
const ProcessEmlSchema = z.object({
  emlContent: z.string().min(1, 'EML content is required'),
  skipDatabase: z.boolean().optional().default(false),
});

export interface TestTriageRoutesDependencies {
  supabase: SupabaseClient;
  queueService: QueueService;
}

// Test email record interface
interface TestEmailRecord {
  id: string;
  office_id: string;
  external_id: number;
  subject: string | null;
  html_body: string | null;
  from_address: string | null;
  to_addresses: string[] | null;
  cc_addresses: string[] | null;
  bcc_addresses: string[] | null;
  type: string;
  actioned: boolean;
  received_at: string | null;
  created_at: string;
  is_test_email: boolean;
}

/**
 * Create test triage routes
 */
export function createTestTriageRoutes({
  supabase,
  queueService,
}: TestTriageRoutesDependencies): Router {
  const router = Router();

  /**
   * POST /test-triage/upload
   *
   * Upload and process an .eml file through the complete triage pipeline.
   * This endpoint:
   * 1. Parses the .eml file content
   * 2. Creates a test email record in the database
   * 3. Queues the email for triage processing (same as real emails)
   * 4. Returns the email ID and job ID for tracking
   */
  const uploadHandler: RequestHandler = async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const body = ProcessEmlSchema.parse(authReq.body);
      const officeId = authReq.officeId;

      // Parse the EML content
      let parsed: ParsedEmail;
      try {
        parsed = parseEmlContent(body.emlContent);
      } catch (parseError) {
        throw ApiError.validation(
          'Failed to parse EML content',
          { error: parseError instanceof Error ? parseError.message : 'Unknown parse error' }
        );
      }

      // Validate parsed email has required fields
      if (!parsed.fromAddress) {
        throw ApiError.validation('EML file must contain a From address');
      }

      // Generate a unique external ID for this test email
      // Use negative numbers to distinguish from real emails and avoid conflicts
      const testExternalId = -Math.floor(Date.now() / 1000);

      // Prepare email data for database
      const emailData = {
        office_id: officeId,
        external_id: testExternalId,
        subject: parsed.subject || null,
        html_body: parsed.htmlBody || null,
        from_address: parsed.fromAddress,
        to_addresses: parsed.toAddresses.length > 0 ? parsed.toAddresses : null,
        cc_addresses: parsed.ccAddresses.length > 0 ? parsed.ccAddresses : null,
        bcc_addresses: parsed.bccAddresses.length > 0 ? parsed.bccAddresses : null,
        type: 'received' as const,
        actioned: false,
        received_at: parsed.receivedAt.toISOString(),
        is_test_email: true,
        last_synced_at: new Date().toISOString(),
      };

      let emailId: string;
      let emailRecord: TestEmailRecord;

      if (!body.skipDatabase) {
        // Insert test email using RPC function (since legacy schema isn't exposed via REST API)
        // NOTE: We pass office_id explicitly because the server uses service role key,
        // and auth.uid() returns NULL in that context. The authMiddleware has already
        // validated that the user belongs to this office.
        const { data: insertedEmails, error: insertError } = await supabase
          .rpc('insert_legacy_test_email', {
            p_office_id: officeId,
            p_external_id: testExternalId,
            p_subject: parsed.subject || null,
            p_html_body: parsed.htmlBody || null,
            p_from_address: parsed.fromAddress,
            p_to_addresses: parsed.toAddresses.length > 0 ? parsed.toAddresses : null,
            p_cc_addresses: parsed.ccAddresses.length > 0 ? parsed.ccAddresses : null,
            p_bcc_addresses: parsed.bccAddresses.length > 0 ? parsed.bccAddresses : null,
            p_received_at: parsed.receivedAt.toISOString(),
          });

        if (insertError) {
          console.error('[TestTriage] Failed to insert test email:', insertError);
          throw ApiError.internal(`Failed to create test email record: ${insertError.message}`);
        }

        const insertedEmail = Array.isArray(insertedEmails) ? insertedEmails[0] : insertedEmails;
        emailRecord = insertedEmail as TestEmailRecord;
        emailId = emailRecord.id;

        console.log(`[TestTriage] Created test email ${emailId} with external_id ${testExternalId}`);
      } else {
        // Generate a UUID for tracking without database insertion
        emailId = crypto.randomUUID();
        emailRecord = {
          id: emailId,
          office_id: officeId,
          external_id: testExternalId,
          subject: emailData.subject,
          html_body: emailData.html_body,
          from_address: emailData.from_address,
          to_addresses: emailData.to_addresses,
          cc_addresses: emailData.cc_addresses,
          bcc_addresses: emailData.bcc_addresses,
          type: 'received',
          actioned: false,
          received_at: emailData.received_at,
          created_at: new Date().toISOString(),
          is_test_email: true,
        };
      }

      // Queue the email for triage processing using the SAME pipeline as real emails
      // (but skip legacy API calls for test emails)
      const jobId = await queueService.scheduleEmailProcessing(officeId, {
        emailId,
        emailExternalId: testExternalId,
        fromAddress: parsed.fromAddress,
        subject: parsed.subject,
        isTestEmail: true,
      });

      console.log(`[TestTriage] Queued triage job ${jobId} for test email ${emailId}`);

      // Note: Audit logging skipped for test emails (legacy schema not exposed via REST API)

      const response: ApiResponse = {
        success: true,
        data: {
          emailId,
          jobId,
          email: {
            id: emailRecord.id,
            officeId: emailRecord.office_id,
            externalId: emailRecord.external_id,
            subject: emailRecord.subject,
            htmlBody: sanitizeEmailHtml(emailRecord.html_body),
            fromAddress: emailRecord.from_address,
            toAddresses: emailRecord.to_addresses,
            ccAddresses: emailRecord.cc_addresses,
            receivedAt: emailRecord.received_at,
            type: emailRecord.type,
            actioned: emailRecord.actioned,
            isTestEmail: true,
          },
          parsed: {
            subject: parsed.subject,
            fromAddress: parsed.fromAddress,
            fromName: parsed.fromName,
            toAddresses: parsed.toAddresses,
            receivedAt: parsed.receivedAt.toISOString(),
            textBody: parsed.textBody.substring(0, 500) + (parsed.textBody.length > 500 ? '...' : ''),
          },
          message: 'Test email uploaded and queued for triage processing',
        },
      };

      res.status(202).json(response);
    } catch (error) {
      next(error);
    }
  };

  router.post('/upload', requireCaseworker as RequestHandler, uploadHandler);

  /**
   * GET /test-triage/status/:jobId
   *
   * Check the status of a triage processing job.
   * Returns job state and any results or errors.
   */
  const statusHandler: RequestHandler = async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { jobId } = req.params;

      if (!jobId) {
        throw ApiError.validation('Job ID is required');
      }

      // Get job status from queue service
      const job = await queueService.getJob(JobNames.TRIAGE_PROCESS_EMAIL, jobId);

      if (!job) {
        throw ApiError.notFound('Job not found');
      }

      // pg-boss JobWithMetadata uses camelCase properties
      const jobWithMeta = job as unknown as {
        state: string;
        createdOn: Date;
        startedOn: Date | null;
        completedOn: Date | null;
        retryCount: number;
        output: unknown;
      };

      const response: ApiResponse = {
        success: true,
        data: {
          jobId,
          state: jobWithMeta.state,
          createdAt: jobWithMeta.createdOn?.toISOString?.() ?? null,
          startedAt: jobWithMeta.startedOn?.toISOString?.() ?? null,
          completedAt: jobWithMeta.completedOn?.toISOString?.() ?? null,
          retryCount: jobWithMeta.retryCount ?? 0,
          output: jobWithMeta.output,
        },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  router.get('/status/:jobId', requireCaseworker as RequestHandler, statusHandler);

  /**
   * GET /test-triage/email/:emailId
   *
   * Get details of a test email including its triage status.
   */
  const getEmailHandler: RequestHandler = async (req, res, next) => {
    try {
      const { emailId } = req.params;

      if (!emailId) {
        throw ApiError.validation('Email ID is required');
      }

      // Use existing RPC function since legacy schema isn't exposed via REST API
      // NOTE: We pass office_id explicitly because the server uses service role key
      const authReq = req as AuthenticatedRequest;
      const officeId = authReq.officeId;
      const { data: emails, error } = await supabase
        .rpc('get_legacy_email_details', { p_office_id: officeId, p_email_id: emailId });

      if (error) throw error;

      const email = Array.isArray(emails) ? emails[0] : emails;
      if (!email) {
        throw ApiError.notFound('Test email not found');
      }

      const response: ApiResponse = {
        success: true,
        data: {
          id: email.id,
          officeId: email.office_id,
          externalId: email.external_id,
          subject: email.subject,
          htmlBody: sanitizeEmailHtml(email.html_body),
          fromAddress: email.from_address,
          toAddresses: email.to_addresses,
          ccAddresses: email.cc_addresses,
          type: email.type,
          actioned: email.actioned,
          receivedAt: email.received_at,
          createdAt: email.created_at,
          isTestEmail: true,
        },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  router.get('/email/:emailId', requireCaseworker as RequestHandler, getEmailHandler);

  /**
   * DELETE /test-triage/:emailId
   *
   * Clean up a test email from the database.
   * Only allows deletion of test emails (is_test_email = true).
   */
  const deleteHandler: RequestHandler = async (req, res, next) => {
    try {
      const { emailId } = req.params;

      if (!emailId) {
        throw ApiError.validation('Email ID is required');
      }

      // Use RPC function since legacy schema isn't exposed via REST API
      // NOTE: We pass office_id explicitly because the server uses service role key
      const authReq = req as AuthenticatedRequest;
      const officeId = authReq.officeId;
      const { data: results, error } = await supabase
        .rpc('delete_legacy_test_email', { p_office_id: officeId, p_email_id: emailId });

      if (error) throw error;

      const result = Array.isArray(results) ? results[0] : results;

      if (!result?.success) {
        if (result?.error === 'Email not found') {
          throw ApiError.notFound('Email not found');
        } else if (result?.error?.includes('non-test')) {
          throw ApiError.forbidden('Cannot delete non-test emails through this endpoint');
        }
        throw ApiError.internal(result?.error || 'Failed to delete email');
      }

      console.log(`[TestTriage] Deleted test email ${emailId}`);

      const response: ApiResponse = {
        success: true,
        data: {
          deleted: true,
          emailId,
        },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  router.delete('/:emailId', requireCaseworker as RequestHandler, deleteHandler);

  /**
   * GET /test-triage/list
   *
   * List all test emails for the current office.
   */
  const listHandler: RequestHandler = async (req, res, next) => {
    try {
      // Use RPC function since legacy schema isn't exposed via REST API
      // NOTE: We pass office_id explicitly because the server uses service role key
      const authReq = req as AuthenticatedRequest;
      const officeId = authReq.officeId;
      const { data: emails, error } = await supabase
        .rpc('get_legacy_test_emails', { p_office_id: officeId, p_limit: 50 });

      if (error) throw error;

      const response: ApiResponse = {
        success: true,
        data: (emails || []).map((email: { id: string; office_id: string; external_id: number; subject: string | null; from_address: string | null; actioned: boolean; received_at: string | null; created_at: string }) => ({
          id: email.id,
          officeId: email.office_id,
          externalId: email.external_id,
          subject: email.subject,
          fromAddress: email.from_address,
          actioned: email.actioned,
          receivedAt: email.received_at,
          createdAt: email.created_at,
        })),
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  router.get('/list', requireCaseworker as RequestHandler, listHandler);

  /**
   * POST /test-triage/process/:emailId
   *
   * Re-process an existing test email through the triage pipeline.
   * Useful for testing changes to the triage logic.
   */
  const reprocessHandler: RequestHandler = async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { emailId } = req.params;
      const officeId = authReq.officeId;

      if (!emailId) {
        throw ApiError.validation('Email ID is required');
      }

      // Get the email using RPC function
      // NOTE: We pass office_id explicitly because the server uses service role key
      const { data: emails, error } = await supabase
        .rpc('get_legacy_email_details', { p_office_id: officeId, p_email_id: emailId });

      if (error) throw error;

      const email = Array.isArray(emails) ? emails[0] : emails;
      if (!email) {
        throw ApiError.notFound('Email not found');
      }

      const emailRecord = email as { external_id: number; from_address: string | null; subject: string | null };

      // Queue for reprocessing (skip legacy API calls for test emails)
      const jobId = await queueService.scheduleEmailProcessing(officeId, {
        emailId,
        emailExternalId: emailRecord.external_id,
        fromAddress: emailRecord.from_address || '',
        subject: emailRecord.subject || undefined,
        isTestEmail: true,
      });

      console.log(`[TestTriage] Re-queued triage job ${jobId} for email ${emailId}`);

      const response: ApiResponse = {
        success: true,
        data: {
          emailId,
          jobId,
          message: 'Email queued for reprocessing',
        },
      };

      res.status(202).json(response);
    } catch (error) {
      next(error);
    }
  };

  router.post('/process/:emailId', requireCaseworker as RequestHandler, reprocessHandler);

  /**
   * GET /test-triage/queue-status
   *
   * Get the current status of the job queue to help diagnose processing issues.
   * Returns queue health, pending job counts, and worker status.
   */
  const queueStatusHandler: RequestHandler = async (_req, res, next) => {
    try {
      // Check queue health
      const healthCheck = await queueService.healthCheck();

      // Get queue sizes for relevant queues
      const queues: Record<string, number> = {};
      try {
        queues['triage:process-email'] = await queueService.getQueueSize('TRIAGE_PROCESS_EMAIL');
        queues['triage:submit-decision'] = await queueService.getQueueSize('TRIAGE_SUBMIT_DECISION');
      } catch {
        // Queue size fetch failed - worker might not be connected
      }

      // Determine if worker is likely connected based on queue behavior
      // If we can get queue sizes, the pg-boss system is working
      const workerConnected = healthCheck.healthy && !healthCheck.error;

      const response: ApiResponse = {
        success: true,
        data: {
          healthy: healthCheck.healthy,
          workerConnected,
          queues,
          error: healthCheck.error,
        },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  router.get('/queue-status', requireCaseworker as RequestHandler, queueStatusHandler);

  return router;
}
