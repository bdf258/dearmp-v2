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
import { QueueService } from '../../../infrastructure/queue';
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
        throw ApiError.badRequest(
          'Failed to parse EML content',
          { error: parseError instanceof Error ? parseError.message : 'Unknown parse error' }
        );
      }

      // Validate parsed email has required fields
      if (!parsed.fromAddress) {
        throw ApiError.badRequest('EML file must contain a From address');
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
        // Insert test email into database (legacy.emails table)
        const { data: insertedEmail, error: insertError } = await supabase
          .from('legacy.emails')
          .insert(emailData)
          .select('*')
          .single();

        if (insertError) {
          console.error('[TestTriage] Failed to insert test email:', insertError);
          throw ApiError.internal('Failed to create test email record', { error: insertError.message });
        }

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
      const jobId = await queueService.scheduleEmailProcessing(officeId, {
        emailId,
        emailExternalId: testExternalId,
        fromAddress: parsed.fromAddress,
        subject: parsed.subject,
      });

      console.log(`[TestTriage] Queued triage job ${jobId} for test email ${emailId}`);

      // Log the test email creation in audit log
      await supabase.from('legacy.sync_audit_log').insert({
        office_id: officeId,
        entity_type: 'test_email_triage',
        operation: 'create',
        new_data: {
          emailId,
          jobId,
          subject: parsed.subject,
          fromAddress: parsed.fromAddress,
          isTest: true,
          createdBy: authReq.user.id,
        },
      });

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
        throw ApiError.badRequest('Job ID is required');
      }

      // Get job status from queue service
      const job = await queueService.getJob(jobId);

      if (!job) {
        throw ApiError.notFound('Job not found');
      }

      const response: ApiResponse = {
        success: true,
        data: {
          jobId,
          state: job.state,
          createdAt: job.createdon,
          startedAt: job.startedon,
          completedAt: job.completedon,
          retryCount: job.retrycount,
          output: job.output,
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
      const authReq = req as AuthenticatedRequest;
      const { emailId } = req.params;
      const officeId = authReq.officeId;

      if (!emailId) {
        throw ApiError.badRequest('Email ID is required');
      }

      const { data: email, error } = await supabase
        .from('legacy.emails')
        .select('*')
        .eq('id', emailId)
        .eq('office_id', officeId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (!email) {
        throw ApiError.notFound('Test email not found');
      }

      const emailRecord = email as TestEmailRecord;

      const response: ApiResponse = {
        success: true,
        data: {
          id: emailRecord.id,
          officeId: emailRecord.office_id,
          externalId: emailRecord.external_id,
          subject: emailRecord.subject,
          htmlBody: sanitizeEmailHtml(emailRecord.html_body),
          fromAddress: emailRecord.from_address,
          toAddresses: emailRecord.to_addresses,
          ccAddresses: emailRecord.cc_addresses,
          type: emailRecord.type,
          actioned: emailRecord.actioned,
          receivedAt: emailRecord.received_at,
          createdAt: emailRecord.created_at,
          isTestEmail: emailRecord.is_test_email || false,
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
      const authReq = req as AuthenticatedRequest;
      const { emailId } = req.params;
      const officeId = authReq.officeId;

      if (!emailId) {
        throw ApiError.badRequest('Email ID is required');
      }

      // First verify this is a test email
      const { data: email, error: fetchError } = await supabase
        .from('legacy.emails')
        .select('id, is_test_email')
        .eq('id', emailId)
        .eq('office_id', officeId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

      if (!email) {
        throw ApiError.notFound('Email not found');
      }

      const emailRecord = email as { id: string; is_test_email: boolean };

      if (!emailRecord.is_test_email) {
        throw ApiError.forbidden('Cannot delete non-test emails through this endpoint');
      }

      // Delete the test email
      const { error: deleteError } = await supabase
        .from('legacy.emails')
        .delete()
        .eq('id', emailId)
        .eq('office_id', officeId);

      if (deleteError) throw deleteError;

      // Log the deletion
      await supabase.from('legacy.sync_audit_log').insert({
        office_id: officeId,
        entity_type: 'test_email_triage',
        operation: 'delete',
        new_data: {
          emailId,
          deletedBy: authReq.user.id,
        },
      });

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
      const authReq = req as AuthenticatedRequest;
      const officeId = authReq.officeId;

      const { data: emails, error } = await supabase
        .from('legacy.emails')
        .select('*')
        .eq('office_id', officeId)
        .eq('is_test_email', true)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const response: ApiResponse = {
        success: true,
        data: (emails || []).map((email: TestEmailRecord) => ({
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
        throw ApiError.badRequest('Email ID is required');
      }

      // Get the email
      const { data: email, error } = await supabase
        .from('legacy.emails')
        .select('*')
        .eq('id', emailId)
        .eq('office_id', officeId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (!email) {
        throw ApiError.notFound('Email not found');
      }

      const emailRecord = email as TestEmailRecord;

      // Queue for reprocessing
      const jobId = await queueService.scheduleEmailProcessing(officeId, {
        emailId,
        emailExternalId: emailRecord.external_id,
        fromAddress: emailRecord.from_address || '',
        subject: emailRecord.subject || undefined,
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

  return router;
}
