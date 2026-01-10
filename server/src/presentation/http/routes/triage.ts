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

// Email record type from the database (public.messages schema)
interface MessageRecord {
  id: string;
  office_id: string;
  subject: string | null;
  body_html: string | null;
  body: string | null;
  snippet: string | null;
  from_email: string | null;
  from_name: string | null;
  to_email: string | null;
  direction: string | null;
  is_triage_needed: boolean;
  received_at: string | null;
  created_at: string;
  case_id: string | null;
  campaign_id: string | null;
  metadata: Record<string, unknown> | null;
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

      // Query from public.messages (synced from legacy.emails via trigger)
      // This ensures UI and API use the same data source
      const { data, error, count } = await supabase
        .from('messages')
        .select('*', { count: 'exact' })
        .eq('office_id', officeId)
        .eq('is_triage_needed', true)
        .eq('direction', 'inbound')
        .is('case_id', null) // Not yet assigned to a case
        .order(query.orderBy, { ascending: query.orderDir === 'asc' })
        .range(query.offset, query.offset + query.limit - 1);

      if (error) throw error;

      const messages = (data || []) as MessageRecord[];
      const response: ApiResponse = {
        success: true,
        data: messages.map((msg) => ({
          id: msg.id,
          officeId: msg.office_id,
          externalId: msg.metadata?.legacy_external_id ?? null,
          subject: msg.subject,
          snippet: msg.snippet ?? msg.body?.substring(0, 200) ?? null,
          fromAddress: msg.from_email,
          fromName: msg.from_name,
          toAddress: msg.to_email,
          receivedAt: msg.received_at,
          createdAt: msg.created_at,
          isTriageNeeded: msg.is_triage_needed,
          caseId: msg.case_id,
          campaignId: msg.campaign_id,
        })),
        meta: {
          offset: query.offset,
          limit: query.limit,
          total: count ?? 0,
          hasMore: (count ?? 0) > query.offset + query.limit,
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
   * Get details for a specific email/message
   */
  const getEmailHandler: RequestHandler = async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { id } = authReq.params;
      const officeId = authReq.officeId;

      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('id', id)
        .eq('office_id', officeId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (!data) {
        throw ApiError.notFound('Message not found');
      }

      const msg = data as MessageRecord;
      const response: ApiResponse = {
        success: true,
        data: {
          id: msg.id,
          officeId: msg.office_id,
          externalId: msg.metadata?.legacy_external_id ?? null,
          subject: msg.subject,
          // Sanitize HTML to prevent XSS (defense-in-depth with frontend DOMPurify)
          htmlBody: sanitizeEmailHtml(msg.body_html),
          body: msg.body,
          fromAddress: msg.from_email,
          fromName: msg.from_name,
          toAddress: msg.to_email,
          direction: msg.direction,
          isTriageNeeded: msg.is_triage_needed,
          receivedAt: msg.received_at,
          createdAt: msg.created_at,
          caseId: msg.case_id,
          campaignId: msg.campaign_id,
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

      // Update messages to mark as triaged (this triggers sync back to legacy.emails)
      const updateData: Record<string, unknown> = {
        is_triage_needed: false,
        updated_at: new Date().toISOString(),
      };
      if (body.caseId) {
        updateData.case_id = body.caseId;
      }
      if (body.assigneeId) {
        updateData.assigned_to_user_id = body.assigneeId;
      }

      const { error: updateError } = await supabase
        .from('messages')
        .update(updateData)
        .eq('office_id', officeId)
        .in('id', body.messageIds);

      if (updateError) throw updateError;

      // If creating a new case, queue a job
      if (body.createCase && body.newCase) {
        for (const messageId of body.messageIds) {
          // Get message details (includes legacy external_id in metadata)
          const { data: message } = await supabase
            .from('messages')
            .select('metadata, from_email, subject')
            .eq('id', messageId)
            .single();

          if (message) {
            const msgData = message as { metadata: Record<string, unknown> | null; from_email: string | null; subject: string | null };
            const legacyExternalId = (msgData.metadata?.legacy_external_id as number) ?? 0;
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
                summary: body.newCase.summary ?? msgData.subject ?? 'New case from email',
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
            await queueService.submitTriageDecision(officeId, messageId, legacyExternalId, decision);
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
   * Dismiss messages from triage queue
   */
  const dismissHandler: RequestHandler = async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const body = DismissTriageSchema.parse(authReq.body);
      const officeId = authReq.officeId;

      // Mark messages as dismissed (this triggers sync back to legacy.emails)
      const { error } = await supabase
        .from('messages')
        .update({
          is_triage_needed: false,
          email_type: 'spam', // Mark as spam when dismissed
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

      // Get pending count (messages needing triage)
      const { count: pendingCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('office_id', officeId)
        .eq('is_triage_needed', true)
        .eq('direction', 'inbound');

      // Get triaged today count
      const { count: actionedTodayCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('office_id', officeId)
        .eq('is_triage_needed', false)
        .eq('direction', 'inbound')
        .gte('updated_at', today.toISOString());

      // Get messages by date range for the last 7 days
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const { data: weekData } = await supabase
        .from('messages')
        .select('received_at, is_triage_needed')
        .eq('office_id', officeId)
        .eq('direction', 'inbound')
        .gte('received_at', weekAgo.toISOString());

      const weekMessages = (weekData || []) as Array<{ received_at: string | null; is_triage_needed: boolean }>;

      const response: ApiResponse = {
        success: true,
        data: {
          pendingCount: pendingCount ?? 0,
          actionedTodayCount: actionedTodayCount ?? 0,
          totalThisWeek: weekMessages.length,
          actionedThisWeek: weekMessages.filter((m) => !m.is_triage_needed).length,
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
