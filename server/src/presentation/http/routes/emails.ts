/**
 * Emails Routes
 *
 * HTTP endpoints for email management:
 * - GET /emails - List emails with filtering and pagination
 * - GET /emails/:id - Get email details
 * - PATCH /emails/:id - Update an email (mark actioned, assign, link to case)
 * - POST /emails/:id/action - Mark email as actioned
 * - POST /emails/:id/assign - Assign email to a caseworker
 * - POST /emails/:id/link-case - Link email to a case
 * - GET /emails/unactioned - Get unactioned emails count
 */

import { Router, RequestHandler } from 'express';
import { z } from 'zod';
import { SupabaseClient } from '@supabase/supabase-js';
import { AuthenticatedRequest, ApiResponse, ApiError } from '../types';
import { requireCaseworker } from '../middleware';
import { QueueService } from '../../../infrastructure/queue';

// Request validation schemas
const ListEmailsQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
  type: z.enum(['received', 'sent', 'draft', 'scheduled']).optional(),
  actioned: z.coerce.boolean().optional(),
  caseId: z.string().uuid().optional(),
  constituentId: z.string().uuid().optional(),
  fromAddress: z.string().optional(),
  search: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  orderBy: z.enum(['received_at', 'sent_at', 'created_at', 'updated_at']).default('received_at'),
  orderDir: z.enum(['asc', 'desc']).default('desc'),
});

const UpdateEmailSchema = z.object({
  actioned: z.boolean().optional(),
  caseId: z.string().uuid().nullable().optional(),
  constituentId: z.string().uuid().nullable().optional(),
  assignedToId: z.string().uuid().nullable().optional(),
  assignedToExternalId: z.coerce.number().nullable().optional(),
});

const ActionEmailSchema = z.object({
  markActioned: z.boolean().default(true),
  reason: z.string().optional(),
});

const AssignEmailSchema = z.object({
  assignedToId: z.string().uuid().optional(),
  assignedToExternalId: z.coerce.number().optional(),
}).refine(
  (data) => data.assignedToId || data.assignedToExternalId,
  { message: 'Either assignedToId or assignedToExternalId is required' }
);

const LinkCaseSchema = z.object({
  caseId: z.string().uuid().optional(),
  caseExternalId: z.coerce.number().optional(),
  markActioned: z.boolean().default(true),
}).refine(
  (data) => data.caseId || data.caseExternalId,
  { message: 'Either caseId or caseExternalId is required' }
);

export interface EmailsRoutesDependencies {
  supabase: SupabaseClient;
  queueService: QueueService;
}

// Email record type from database
interface EmailRecord {
  id: string;
  office_id: string;
  external_id: number | null;
  case_id: string | null;
  case_external_id: number | null;
  constituent_id: string | null;
  constituent_external_id: number | null;
  type: string | null;
  subject: string | null;
  html_body: string | null;
  from_address: string | null;
  to_addresses: string[] | null;
  cc_addresses: string[] | null;
  bcc_addresses: string[] | null;
  actioned: boolean;
  assigned_to_id: string | null;
  assigned_to_external_id: number | null;
  scheduled_at: string | null;
  sent_at: string | null;
  received_at: string | null;
  created_at: string;
  updated_at: string;
  last_synced_at: string | null;
}

/**
 * Create emails routes
 */
export function createEmailsRoutes({ supabase, queueService }: EmailsRoutesDependencies): Router {
  const router = Router();

  /**
   * GET /emails
   * List emails with filtering and pagination
   */
  const listEmailsHandler: RequestHandler = async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const query = ListEmailsQuerySchema.parse(authReq.query);
      const officeId = authReq.officeId;

      let dbQuery = supabase
        .from('emails')
        .select('*', { count: 'exact' })
        .eq('office_id', officeId)
        .order(query.orderBy, { ascending: query.orderDir === 'asc' })
        .range(query.offset, query.offset + query.limit - 1);

      // Apply filters
      if (query.type) {
        dbQuery = dbQuery.eq('type', query.type);
      }
      if (query.actioned !== undefined) {
        dbQuery = dbQuery.eq('actioned', query.actioned);
      }
      if (query.caseId) {
        dbQuery = dbQuery.eq('case_id', query.caseId);
      }
      if (query.constituentId) {
        dbQuery = dbQuery.eq('constituent_id', query.constituentId);
      }
      if (query.fromAddress) {
        dbQuery = dbQuery.ilike('from_address', `%${query.fromAddress}%`);
      }
      if (query.search) {
        dbQuery = dbQuery.or(`subject.ilike.%${query.search}%,from_address.ilike.%${query.search}%`);
      }
      if (query.dateFrom) {
        dbQuery = dbQuery.gte('received_at', query.dateFrom);
      }
      if (query.dateTo) {
        dbQuery = dbQuery.lte('received_at', query.dateTo);
      }

      const { data, error, count } = await dbQuery;

      if (error) throw error;

      const emails = (data || []) as EmailRecord[];
      const response: ApiResponse = {
        success: true,
        data: emails.map((e) => ({
          id: e.id,
          officeId: e.office_id,
          externalId: e.external_id,
          caseId: e.case_id,
          caseExternalId: e.case_external_id,
          constituentId: e.constituent_id,
          constituentExternalId: e.constituent_external_id,
          type: e.type,
          subject: e.subject,
          snippet: e.html_body?.substring(0, 200) ?? null,
          fromAddress: e.from_address,
          toAddresses: e.to_addresses,
          actioned: e.actioned,
          assignedToId: e.assigned_to_id,
          assignedToExternalId: e.assigned_to_external_id,
          receivedAt: e.received_at,
          sentAt: e.sent_at,
          createdAt: e.created_at,
          updatedAt: e.updated_at,
          lastSyncedAt: e.last_synced_at,
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

  router.get('/', requireCaseworker as RequestHandler, listEmailsHandler);

  /**
   * GET /emails/unactioned
   * Get count of unactioned emails
   */
  const getUnactionedHandler: RequestHandler = async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const officeId = authReq.officeId;

      const { count, error } = await supabase
        .from('emails')
        .select('*', { count: 'exact', head: true })
        .eq('office_id', officeId)
        .eq('actioned', false)
        .eq('type', 'received');

      if (error) throw error;

      const response: ApiResponse = {
        success: true,
        data: {
          count: count ?? 0,
        },
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  router.get('/unactioned', requireCaseworker as RequestHandler, getUnactionedHandler);

  /**
   * GET /emails/:id
   * Get email details by ID
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

      const e = data as EmailRecord;
      const response: ApiResponse = {
        success: true,
        data: {
          id: e.id,
          officeId: e.office_id,
          externalId: e.external_id,
          caseId: e.case_id,
          caseExternalId: e.case_external_id,
          constituentId: e.constituent_id,
          constituentExternalId: e.constituent_external_id,
          type: e.type,
          subject: e.subject,
          htmlBody: e.html_body,
          fromAddress: e.from_address,
          toAddresses: e.to_addresses,
          ccAddresses: e.cc_addresses,
          bccAddresses: e.bcc_addresses,
          actioned: e.actioned,
          assignedToId: e.assigned_to_id,
          assignedToExternalId: e.assigned_to_external_id,
          scheduledAt: e.scheduled_at,
          sentAt: e.sent_at,
          receivedAt: e.received_at,
          createdAt: e.created_at,
          updatedAt: e.updated_at,
          lastSyncedAt: e.last_synced_at,
        },
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  router.get('/:id', requireCaseworker as RequestHandler, getEmailHandler);

  /**
   * PATCH /emails/:id
   * Update an email
   */
  const updateEmailHandler: RequestHandler = async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { id } = authReq.params;
      const body = UpdateEmailSchema.parse(authReq.body);
      const officeId = authReq.officeId;

      // First check the email exists
      const { data: existingEmail, error: findError } = await supabase
        .from('emails')
        .select('*')
        .eq('id', id)
        .eq('office_id', officeId)
        .single();

      if (findError && findError.code !== 'PGRST116') throw findError;
      if (!existingEmail) {
        throw ApiError.notFound('Email not found');
      }

      const existing = existingEmail as EmailRecord;

      // Build update object
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (body.actioned !== undefined) updateData.actioned = body.actioned;
      if (body.caseId !== undefined) updateData.case_id = body.caseId;
      if (body.constituentId !== undefined) updateData.constituent_id = body.constituentId;
      if (body.assignedToId !== undefined) updateData.assigned_to_id = body.assignedToId;
      if (body.assignedToExternalId !== undefined) updateData.assigned_to_external_id = body.assignedToExternalId;

      const { data, error } = await supabase
        .from('emails')
        .update(updateData)
        .eq('id', id)
        .eq('office_id', officeId)
        .select()
        .single();

      if (error) throw error;

      const e = data as EmailRecord;

      // Queue push to legacy system if email has external ID and was marked actioned
      if (existing.external_id && body.actioned === true) {
        await queueService.pushEmail(officeId, e.id, 'update', {
          actioned: true,
        });
      }

      // Log the audit entry
      await supabase.from('sync_audit_log').insert({
        office_id: officeId,
        entity_type: 'email',
        operation: 'update',
        internal_id: e.id,
        external_id: existing.external_id,
        old_data: { actioned: existing.actioned, caseId: existing.case_id },
        new_data: body,
      });

      const response: ApiResponse = {
        success: true,
        data: {
          id: e.id,
          officeId: e.office_id,
          externalId: e.external_id,
          actioned: e.actioned,
          caseId: e.case_id,
          assignedToId: e.assigned_to_id,
          updatedAt: e.updated_at,
        },
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  router.patch('/:id', requireCaseworker as RequestHandler, updateEmailHandler);

  /**
   * POST /emails/:id/action
   * Mark email as actioned
   */
  const actionEmailHandler: RequestHandler = async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { id } = authReq.params;
      const body = ActionEmailSchema.parse(authReq.body);
      const officeId = authReq.officeId;

      // Check the email exists
      const { data: existingEmail, error: findError } = await supabase
        .from('emails')
        .select('*')
        .eq('id', id)
        .eq('office_id', officeId)
        .single();

      if (findError && findError.code !== 'PGRST116') throw findError;
      if (!existingEmail) {
        throw ApiError.notFound('Email not found');
      }

      const existing = existingEmail as EmailRecord;

      const { data, error } = await supabase
        .from('emails')
        .update({
          actioned: body.markActioned,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('office_id', officeId)
        .select()
        .single();

      if (error) throw error;

      const e = data as EmailRecord;

      // Queue push to legacy system
      if (existing.external_id && body.markActioned) {
        await queueService.pushEmail(officeId, e.id, 'update', {
          actioned: true,
        });
      }

      // Log the audit entry
      await supabase.from('sync_audit_log').insert({
        office_id: officeId,
        entity_type: 'email',
        operation: 'update',
        internal_id: e.id,
        external_id: existing.external_id,
        new_data: { actioned: body.markActioned, reason: body.reason, actionedBy: authReq.user.id },
      });

      const response: ApiResponse = {
        success: true,
        data: {
          id: e.id,
          actioned: e.actioned,
          updatedAt: e.updated_at,
        },
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  router.post('/:id/action', requireCaseworker as RequestHandler, actionEmailHandler);

  /**
   * POST /emails/:id/assign
   * Assign email to a caseworker
   */
  const assignEmailHandler: RequestHandler = async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { id } = authReq.params;
      const body = AssignEmailSchema.parse(authReq.body);
      const officeId = authReq.officeId;

      // Check the email exists
      const { data: existingEmail, error: findError } = await supabase
        .from('emails')
        .select('*')
        .eq('id', id)
        .eq('office_id', officeId)
        .single();

      if (findError && findError.code !== 'PGRST116') throw findError;
      if (!existingEmail) {
        throw ApiError.notFound('Email not found');
      }

      const existing = existingEmail as EmailRecord;

      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (body.assignedToId) updateData.assigned_to_id = body.assignedToId;
      if (body.assignedToExternalId) updateData.assigned_to_external_id = body.assignedToExternalId;

      const { data, error } = await supabase
        .from('emails')
        .update(updateData)
        .eq('id', id)
        .eq('office_id', officeId)
        .select()
        .single();

      if (error) throw error;

      const e = data as EmailRecord;

      // Log the audit entry
      await supabase.from('sync_audit_log').insert({
        office_id: officeId,
        entity_type: 'email',
        operation: 'update',
        internal_id: e.id,
        external_id: existing.external_id,
        new_data: { assignedToId: body.assignedToId, assignedToExternalId: body.assignedToExternalId, assignedBy: authReq.user.id },
      });

      const response: ApiResponse = {
        success: true,
        data: {
          id: e.id,
          assignedToId: e.assigned_to_id,
          assignedToExternalId: e.assigned_to_external_id,
          updatedAt: e.updated_at,
        },
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  router.post('/:id/assign', requireCaseworker as RequestHandler, assignEmailHandler);

  /**
   * POST /emails/:id/link-case
   * Link email to a case
   */
  const linkCaseHandler: RequestHandler = async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { id } = authReq.params;
      const body = LinkCaseSchema.parse(authReq.body);
      const officeId = authReq.officeId;

      // Check the email exists
      const { data: existingEmail, error: findError } = await supabase
        .from('emails')
        .select('*')
        .eq('id', id)
        .eq('office_id', officeId)
        .single();

      if (findError && findError.code !== 'PGRST116') throw findError;
      if (!existingEmail) {
        throw ApiError.notFound('Email not found');
      }

      const existing = existingEmail as EmailRecord;

      // Verify case exists if caseId provided
      if (body.caseId) {
        const { data: caseData, error: caseError } = await supabase
          .from('cases')
          .select('id')
          .eq('id', body.caseId)
          .eq('office_id', officeId)
          .single();

        if (caseError && caseError.code !== 'PGRST116') throw caseError;
        if (!caseData) {
          throw ApiError.notFound('Case not found');
        }
      }

      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (body.caseId) updateData.case_id = body.caseId;
      if (body.caseExternalId) updateData.case_external_id = body.caseExternalId;
      if (body.markActioned) updateData.actioned = true;

      const { data, error } = await supabase
        .from('emails')
        .update(updateData)
        .eq('id', id)
        .eq('office_id', officeId)
        .select()
        .single();

      if (error) throw error;

      const e = data as EmailRecord;

      // Queue push to legacy system if actioned
      if (existing.external_id && body.markActioned) {
        await queueService.pushEmail(officeId, e.id, 'update', {
          actioned: true,
        });
      }

      // Log the audit entry
      await supabase.from('sync_audit_log').insert({
        office_id: officeId,
        entity_type: 'email',
        operation: 'update',
        internal_id: e.id,
        external_id: existing.external_id,
        old_data: { caseId: existing.case_id },
        new_data: { caseId: body.caseId, caseExternalId: body.caseExternalId, linkedBy: authReq.user.id },
      });

      const response: ApiResponse = {
        success: true,
        data: {
          id: e.id,
          caseId: e.case_id,
          caseExternalId: e.case_external_id,
          actioned: e.actioned,
          updatedAt: e.updated_at,
        },
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  router.post('/:id/link-case', requireCaseworker as RequestHandler, linkCaseHandler);

  /**
   * GET /emails/stats
   * Get email statistics for the office
   */
  const getStatsHandler: RequestHandler = async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const officeId = authReq.officeId;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Get total received
      const { count: totalReceived } = await supabase
        .from('emails')
        .select('*', { count: 'exact', head: true })
        .eq('office_id', officeId)
        .eq('type', 'received');

      // Get unactioned count
      const { count: unactionedCount } = await supabase
        .from('emails')
        .select('*', { count: 'exact', head: true })
        .eq('office_id', officeId)
        .eq('type', 'received')
        .eq('actioned', false);

      // Get received today
      const { count: receivedToday } = await supabase
        .from('emails')
        .select('*', { count: 'exact', head: true })
        .eq('office_id', officeId)
        .eq('type', 'received')
        .gte('received_at', today.toISOString());

      // Get actioned today
      const { count: actionedToday } = await supabase
        .from('emails')
        .select('*', { count: 'exact', head: true })
        .eq('office_id', officeId)
        .eq('type', 'received')
        .eq('actioned', true)
        .gte('updated_at', today.toISOString());

      // Get received this week
      const { count: receivedThisWeek } = await supabase
        .from('emails')
        .select('*', { count: 'exact', head: true })
        .eq('office_id', officeId)
        .eq('type', 'received')
        .gte('received_at', weekAgo.toISOString());

      const response: ApiResponse = {
        success: true,
        data: {
          totalReceived: totalReceived ?? 0,
          unactionedCount: unactionedCount ?? 0,
          receivedToday: receivedToday ?? 0,
          actionedToday: actionedToday ?? 0,
          receivedThisWeek: receivedThisWeek ?? 0,
        },
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  router.get('/stats', requireCaseworker as RequestHandler, getStatsHandler);

  return router;
}
