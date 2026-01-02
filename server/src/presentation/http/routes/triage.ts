/**
 * Triage Routes
 *
 * HTTP endpoints for email triage operations:
 * - GET /triage/queue - Get emails pending triage
 * - GET /triage/email/:id - Get details for a specific email
 * - POST /triage/confirm - Confirm triage decision
 * - POST /triage/dismiss - Dismiss emails from triage
 * - GET /triage/stats - Get triage statistics
 * - POST /triage/process - Queue email for LLM processing
 */

import { Router, RequestHandler } from 'express';
import { z } from 'zod';
import { SupabaseClient } from '@supabase/supabase-js';
import { AuthenticatedRequest, ApiResponse, ApiError } from '../types';
import { requireCaseworker } from '../middleware';
import { QueueService } from '../../../infrastructure/queue';
import { sanitizeEmailHtml } from '../utils';

// Request validation schemas
const GetTriageQueueSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
  orderBy: z.enum(['received_at', 'created_at']).default('received_at'),
  orderDir: z.enum(['asc', 'desc']).default('desc'),
});

const ConfirmTriageSchema = z.object({
  messageIds: z.array(z.string().uuid()).min(1).max(100),
  caseId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional(),
  tagIds: z.array(z.string().uuid()).max(50).optional(),
  createCase: z.boolean().optional(),
  newCase: z
    .object({
      caseTypeId: z.string().uuid().optional(),
      caseTypeExternalId: z.number().optional(),
      statusId: z.string().uuid().optional(),
      statusExternalId: z.number().optional(),
      summary: z.string().max(5000).optional(),
      constituentId: z.string().uuid().optional(),
      newConstituent: z
        .object({
          firstName: z.string().max(200).optional(),
          lastName: z.string().max(200).optional(),
          email: z.string().email().max(500).optional(),
        })
        .optional(),
    })
    .optional(),
});

const DismissTriageSchema = z.object({
  messageIds: z.array(z.string().uuid()).min(1).max(100),
  reason: z.string().max(1000).optional(),
});

const ProcessEmailSchema = z.object({
  emailId: z.string().uuid(),
  emailExternalId: z.number(),
  fromAddress: z.string().email().max(500),
  subject: z.string().max(1000).optional(),
});

export interface TriageRoutesDependencies {
  supabase: SupabaseClient;
  queueService: QueueService;
}

// Email record type from the database
interface EmailRecord {
  id: string;
  office_id: string;
  external_id: number;
  subject: string | null;
  html_body: string | null;
  from_address: string | null;
  to_addresses: string[] | null;
  cc_addresses: string[] | null;
  bcc_addresses: string[] | null;
  type: string | null;
  actioned: boolean;
  received_at: string | null;
  sent_at: string | null;
  created_at: string;
  constituent_id: string | null;
  case_id: string | null;
}

/**
 * Create triage routes
 */
export function createTriageRoutes({ supabase, queueService }: TriageRoutesDependencies): Router {
  const router = Router();

  /**
   * GET /triage/queue
   * Get emails pending triage with filtering and pagination
   */
  const getQueueHandler: RequestHandler = async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const query = GetTriageQueueSchema.parse(authReq.query);
      const officeId = authReq.officeId;

      // Query emails from legacy schema using RPC to avoid type issues
      const { data, error, count } = await supabase
        .rpc('get_legacy_triage_queue', {
          p_limit: query.limit,
          p_offset: query.offset,
          p_order_by: query.orderBy,
          p_order_dir: query.orderDir,
        })
        .eq('office_id', officeId);

      if (error) {
        // Fallback to direct query if RPC doesn't exist
        const directQuery = await supabase
          .from('emails')
          .select('*', { count: 'exact' })
          .eq('office_id', officeId)
          .eq('actioned', false)
          .eq('type', 'received')
          .order(query.orderBy, { ascending: query.orderDir === 'asc' })
          .range(query.offset, query.offset + query.limit - 1);

        if (directQuery.error) throw directQuery.error;

        const emails = (directQuery.data || []) as EmailRecord[];
        const response: ApiResponse = {
          success: true,
          data: emails.map((email) => ({
            id: email.id,
            officeId: email.office_id,
            externalId: email.external_id,
            subject: email.subject,
            snippet: email.html_body?.substring(0, 200) ?? null,
            fromAddress: email.from_address,
            toAddresses: email.to_addresses,
            receivedAt: email.received_at,
            createdAt: email.created_at,
            actioned: email.actioned,
            caseId: email.case_id,
            constituentId: email.constituent_id,
          })),
          meta: {
            offset: query.offset,
            limit: query.limit,
            total: directQuery.count ?? 0,
            hasMore: (directQuery.count ?? 0) > query.offset + query.limit,
          },
        };
        res.json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: data || [],
        meta: {
          offset: query.offset,
          limit: query.limit,
          total: count ?? data?.length ?? 0,
          hasMore: (count ?? data?.length ?? 0) > query.offset + query.limit,
        },
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  router.get('/queue', requireCaseworker as RequestHandler, getQueueHandler);

  /**
   * GET /triage/email/:id
   * Get details for a specific email
   */
  const getEmailHandler: RequestHandler = async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { id } = authReq.params;
      const officeId = authReq.officeId;

      const { data, error } = await supabase
        .from('emails')
        .select('*')
        .eq('id', id)
        .eq('office_id', officeId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (!data) {
        throw ApiError.notFound('Email not found');
      }

      const email = data as EmailRecord;
      const response: ApiResponse = {
        success: true,
        data: {
          id: email.id,
          officeId: email.office_id,
          externalId: email.external_id,
          subject: email.subject,
          // Sanitize HTML to prevent XSS (defense-in-depth with frontend DOMPurify)
          htmlBody: sanitizeEmailHtml(email.html_body),
          fromAddress: email.from_address,
          toAddresses: email.to_addresses,
          ccAddresses: email.cc_addresses,
          bccAddresses: email.bcc_addresses,
          type: email.type,
          actioned: email.actioned,
          receivedAt: email.received_at,
          sentAt: email.sent_at,
          createdAt: email.created_at,
          constituentId: email.constituent_id,
          caseId: email.case_id,
        },
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  router.get('/email/:id', requireCaseworker as RequestHandler, getEmailHandler);

  /**
   * POST /triage/confirm
   * Confirm triage decision (link to case, assign, tag)
   */
  const confirmHandler: RequestHandler = async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const body = ConfirmTriageSchema.parse(authReq.body);
      const officeId = authReq.officeId;

      // Update emails to mark as actioned
      const updateData: Record<string, unknown> = {
        actioned: true,
        updated_at: new Date().toISOString(),
      };
      if (body.caseId) {
        updateData.case_id = body.caseId;
      }

      const { error: updateError } = await supabase
        .from('emails')
        .update(updateData)
        .eq('office_id', officeId)
        .in('id', body.messageIds);

      if (updateError) throw updateError;

      // If creating a new case, queue a job
      if (body.createCase && body.newCase) {
        for (const messageId of body.messageIds) {
          // Get email details
          const { data: email } = await supabase
            .from('emails')
            .select('external_id, from_address, subject')
            .eq('id', messageId)
            .single();

          if (email) {
            const emailData = email as { external_id: number; from_address: string | null; subject: string | null };
            type TriageDecisionPayload = {
              action: 'add_to_case' | 'ignore' | 'create_new';
              constituentId?: string;
              newConstituent?: { firstName: string; lastName: string; email: string };
              caseId?: string;
              newCase?: { caseTypeId: number; statusId: number; summary?: string };
              markActioned: boolean;
            };
            const decision: TriageDecisionPayload = {
              action: 'create_new',
              newCase: {
                caseTypeId: body.newCase.caseTypeExternalId ?? 1,
                statusId: body.newCase.statusExternalId ?? 1,
                summary: body.newCase.summary ?? emailData.subject ?? 'New case from email',
              },
              markActioned: true,
            };
            if (body.newCase.newConstituent) {
              decision.newConstituent = {
                firstName: body.newCase.newConstituent.firstName ?? '',
                lastName: body.newCase.newConstituent.lastName ?? '',
                email: body.newCase.newConstituent.email ?? '',
              };
            }
            await queueService.submitTriageDecision(officeId, messageId, emailData.external_id, decision);
          }
        }
      }

      // Log the audit entry
      await supabase.from('sync_audit_log').insert({
        office_id: officeId,
        entity_type: 'email_triage',
        operation: 'update',
        new_data: {
          messageIds: body.messageIds,
          caseId: body.caseId,
          assigneeId: body.assigneeId,
          confirmedBy: authReq.user.id,
        },
      });

      const response: ApiResponse = {
        success: true,
        data: {
          confirmedCount: body.messageIds.length,
          caseId: body.caseId,
        },
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  router.post('/confirm', requireCaseworker as RequestHandler, confirmHandler);

  /**
   * POST /triage/dismiss
   * Dismiss emails from triage queue
   */
  const dismissHandler: RequestHandler = async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const body = DismissTriageSchema.parse(authReq.body);
      const officeId = authReq.officeId;

      // Mark emails as actioned (dismissed)
      const { error } = await supabase
        .from('emails')
        .update({
          actioned: true,
          updated_at: new Date().toISOString(),
        })
        .eq('office_id', officeId)
        .in('id', body.messageIds);

      if (error) throw error;

      // Log the audit entry
      await supabase.from('sync_audit_log').insert({
        office_id: officeId,
        entity_type: 'email_triage',
        operation: 'delete',
        new_data: {
          messageIds: body.messageIds,
          reason: body.reason,
          dismissedBy: authReq.user.id,
        },
      });

      const response: ApiResponse = {
        success: true,
        data: {
          dismissedCount: body.messageIds.length,
        },
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  router.post('/dismiss', requireCaseworker as RequestHandler, dismissHandler);

  /**
   * GET /triage/stats
   * Get triage queue statistics
   */
  const statsHandler: RequestHandler = async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const officeId = authReq.officeId;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get pending count
      const { count: pendingCount } = await supabase
        .from('emails')
        .select('*', { count: 'exact', head: true })
        .eq('office_id', officeId)
        .eq('actioned', false)
        .eq('type', 'received');

      // Get actioned today count
      const { count: actionedTodayCount } = await supabase
        .from('emails')
        .select('*', { count: 'exact', head: true })
        .eq('office_id', officeId)
        .eq('actioned', true)
        .eq('type', 'received')
        .gte('updated_at', today.toISOString());

      // Get emails by date range for the last 7 days
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const { data: weekData } = await supabase
        .from('emails')
        .select('received_at, actioned')
        .eq('office_id', officeId)
        .eq('type', 'received')
        .gte('received_at', weekAgo.toISOString());

      const weekEmails = (weekData || []) as Array<{ received_at: string | null; actioned: boolean }>;

      const response: ApiResponse = {
        success: true,
        data: {
          pendingCount: pendingCount ?? 0,
          actionedTodayCount: actionedTodayCount ?? 0,
          totalThisWeek: weekEmails.length,
          actionedThisWeek: weekEmails.filter((e) => e.actioned).length,
        },
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  router.get('/stats', requireCaseworker as RequestHandler, statsHandler);

  /**
   * POST /triage/process
   * Queue an email for LLM processing
   */
  const processHandler: RequestHandler = async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const body = ProcessEmailSchema.parse(authReq.body);
      const officeId = authReq.officeId;

      const emailInfo: {
        emailId: string;
        emailExternalId: number;
        fromAddress: string;
        subject?: string;
      } = {
        emailId: body.emailId,
        emailExternalId: body.emailExternalId,
        fromAddress: body.fromAddress,
      };
      if (body.subject) {
        emailInfo.subject = body.subject;
      }
      const jobId = await queueService.scheduleEmailProcessing(officeId, emailInfo);

      const response: ApiResponse = {
        success: true,
        data: {
          jobId,
          message: 'Email queued for processing',
        },
      };
      res.status(202).json(response);
    } catch (error) {
      next(error);
    }
  };

  router.post('/process', requireCaseworker as RequestHandler, processHandler);

  /**
   * POST /triage/batch-prefetch
   * Queue batch of emails for prefetching
   */
  const batchPrefetchHandler: RequestHandler = async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const body = z
        .object({
          emailIds: z.array(z.string().uuid()).min(1).max(10),
          prefetchAhead: z.number().min(1).max(10).default(3),
        })
        .parse(authReq.body);

      const officeId = authReq.officeId;

      const jobId = await queueService.scheduleBatchPrefetch(officeId, body.emailIds, body.prefetchAhead);

      const response: ApiResponse = {
        success: true,
        data: {
          jobId,
          message: `${body.emailIds.length} emails queued for prefetching`,
        },
      };
      res.status(202).json(response);
    } catch (error) {
      next(error);
    }
  };

  router.post('/batch-prefetch', requireCaseworker as RequestHandler, batchPrefetchHandler);

  return router;
}
