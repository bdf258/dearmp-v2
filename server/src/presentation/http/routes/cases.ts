/**
 * Cases Routes
 *
 * HTTP endpoints for case management:
 * - GET /cases - List cases with filtering and pagination
 * - GET /cases/:id - Get case details
 * - POST /cases - Create a new case
 * - PATCH /cases/:id - Update a case
 * - GET /cases/:id/emails - Get emails for a case
 * - GET /cases/:id/notes - Get case notes
 * - GET /cases/constituent/:constituentId - Get cases for a constituent
 */

import { Router, RequestHandler } from 'express';
import { z } from 'zod';
import { SupabaseClient } from '@supabase/supabase-js';
import { AuthenticatedRequest, ApiResponse, ApiError } from '../types';
import { requireCaseworker } from '../middleware';
import { QueueService } from '../../../infrastructure/queue';

// Request validation schemas
const ListCasesQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
  statusId: z.string().uuid().optional(),
  statusExternalId: z.coerce.number().optional(),
  caseTypeId: z.string().uuid().optional(),
  caseTypeExternalId: z.coerce.number().optional(),
  assignedToId: z.string().uuid().optional(),
  constituentId: z.string().uuid().optional(),
  search: z.string().optional(),
  orderBy: z.enum(['created_at', 'updated_at', 'review_date']).default('updated_at'),
  orderDir: z.enum(['asc', 'desc']).default('desc'),
  includeOverdue: z.coerce.boolean().optional(),
});

const CreateCaseSchema = z.object({
  constituentId: z.string().uuid().optional(),
  constituentExternalId: z.coerce.number().optional(),
  caseTypeId: z.string().uuid().optional(),
  caseTypeExternalId: z.coerce.number().optional(),
  statusId: z.string().uuid().optional(),
  statusExternalId: z.coerce.number().optional(),
  categoryTypeId: z.string().uuid().optional(),
  categoryTypeExternalId: z.coerce.number().optional(),
  contactTypeId: z.string().uuid().optional(),
  contactTypeExternalId: z.coerce.number().optional(),
  assignedToId: z.string().uuid().optional(),
  assignedToExternalId: z.coerce.number().optional(),
  summary: z.string().min(1).max(5000),
  reviewDate: z.string().datetime().optional(),
}).refine(
  (data) => data.constituentId || data.constituentExternalId,
  { message: 'Either constituentId or constituentExternalId is required' }
);

const UpdateCaseSchema = z.object({
  caseTypeId: z.string().uuid().optional(),
  caseTypeExternalId: z.coerce.number().optional(),
  statusId: z.string().uuid().optional(),
  statusExternalId: z.coerce.number().optional(),
  categoryTypeId: z.string().uuid().optional(),
  categoryTypeExternalId: z.coerce.number().optional(),
  contactTypeId: z.string().uuid().optional(),
  contactTypeExternalId: z.coerce.number().optional(),
  assignedToId: z.string().uuid().optional(),
  assignedToExternalId: z.coerce.number().optional(),
  summary: z.string().min(1).max(5000).optional(),
  reviewDate: z.string().datetime().optional(),
});

export interface CasesRoutesDependencies {
  supabase: SupabaseClient;
  queueService: QueueService;
}

// Case record type from database
interface CaseRecord {
  id: string;
  office_id: string;
  external_id: number | null;
  constituent_id: string | null;
  constituent_external_id: number | null;
  case_type_id: string | null;
  case_type_external_id: number | null;
  status_id: string | null;
  status_external_id: number | null;
  category_type_id: string | null;
  category_type_external_id: number | null;
  contact_type_id: string | null;
  contact_type_external_id: number | null;
  assigned_to_id: string | null;
  assigned_to_external_id: number | null;
  summary: string | null;
  review_date: string | null;
  created_at: string;
  updated_at: string;
  last_synced_at: string | null;
}

// Email record type for case emails
interface EmailRecord {
  id: string;
  external_id: number;
  subject: string | null;
  from_address: string | null;
  received_at: string | null;
  sent_at: string | null;
  type: string | null;
  actioned: boolean;
}

// Case note record type
interface CaseNoteRecord {
  id: string;
  external_id: number | null;
  case_id: string;
  type: string | null;
  content: string | null;
  created_by_id: string | null;
  created_at: string;
}

/**
 * Create cases routes
 */
export function createCasesRoutes({ supabase, queueService }: CasesRoutesDependencies): Router {
  const router = Router();

  /**
   * GET /cases
   * List cases with filtering and pagination
   */
  const listCasesHandler: RequestHandler = async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const query = ListCasesQuerySchema.parse(authReq.query);
      const officeId = authReq.officeId;

      let dbQuery = supabase
        .from('cases')
        .select('*', { count: 'exact' })
        .eq('office_id', officeId)
        .order(query.orderBy, { ascending: query.orderDir === 'asc' })
        .range(query.offset, query.offset + query.limit - 1);

      // Apply filters
      if (query.statusId) {
        dbQuery = dbQuery.eq('status_id', query.statusId);
      }
      if (query.statusExternalId) {
        dbQuery = dbQuery.eq('status_external_id', query.statusExternalId);
      }
      if (query.caseTypeId) {
        dbQuery = dbQuery.eq('case_type_id', query.caseTypeId);
      }
      if (query.caseTypeExternalId) {
        dbQuery = dbQuery.eq('case_type_external_id', query.caseTypeExternalId);
      }
      if (query.assignedToId) {
        dbQuery = dbQuery.eq('assigned_to_id', query.assignedToId);
      }
      if (query.constituentId) {
        dbQuery = dbQuery.eq('constituent_id', query.constituentId);
      }
      if (query.search) {
        dbQuery = dbQuery.ilike('summary', `%${query.search}%`);
      }
      if (query.includeOverdue) {
        const now = new Date().toISOString();
        dbQuery = dbQuery.lt('review_date', now);
      }

      const { data, error, count } = await dbQuery;

      if (error) throw error;

      const cases = (data || []) as CaseRecord[];
      const response: ApiResponse = {
        success: true,
        data: cases.map((c) => ({
          id: c.id,
          officeId: c.office_id,
          externalId: c.external_id,
          constituentId: c.constituent_id,
          constituentExternalId: c.constituent_external_id,
          caseTypeId: c.case_type_id,
          caseTypeExternalId: c.case_type_external_id,
          statusId: c.status_id,
          statusExternalId: c.status_external_id,
          categoryTypeId: c.category_type_id,
          categoryTypeExternalId: c.category_type_external_id,
          contactTypeId: c.contact_type_id,
          contactTypeExternalId: c.contact_type_external_id,
          assignedToId: c.assigned_to_id,
          assignedToExternalId: c.assigned_to_external_id,
          summary: c.summary,
          reviewDate: c.review_date,
          isOverdue: c.review_date ? new Date(c.review_date) < new Date() : false,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
          lastSyncedAt: c.last_synced_at,
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

  router.get('/', requireCaseworker as RequestHandler, listCasesHandler);

  /**
   * GET /cases/:id
   * Get case details by ID
   */
  const getCaseHandler: RequestHandler = async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { id } = authReq.params;
      const officeId = authReq.officeId;

      const { data, error } = await supabase
        .from('cases')
        .select('*')
        .eq('id', id)
        .eq('office_id', officeId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (!data) {
        throw ApiError.notFound('Case not found');
      }

      const c = data as CaseRecord;
      const response: ApiResponse = {
        success: true,
        data: {
          id: c.id,
          officeId: c.office_id,
          externalId: c.external_id,
          constituentId: c.constituent_id,
          constituentExternalId: c.constituent_external_id,
          caseTypeId: c.case_type_id,
          caseTypeExternalId: c.case_type_external_id,
          statusId: c.status_id,
          statusExternalId: c.status_external_id,
          categoryTypeId: c.category_type_id,
          categoryTypeExternalId: c.category_type_external_id,
          contactTypeId: c.contact_type_id,
          contactTypeExternalId: c.contact_type_external_id,
          assignedToId: c.assigned_to_id,
          assignedToExternalId: c.assigned_to_external_id,
          summary: c.summary,
          reviewDate: c.review_date,
          isOverdue: c.review_date ? new Date(c.review_date) < new Date() : false,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
          lastSyncedAt: c.last_synced_at,
        },
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  router.get('/:id', requireCaseworker as RequestHandler, getCaseHandler);

  /**
   * POST /cases
   * Create a new case
   */
  const createCaseHandler: RequestHandler = async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const body = CreateCaseSchema.parse(authReq.body);
      const officeId = authReq.officeId;

      // Insert the case into the shadow database
      const insertData: Record<string, unknown> = {
        office_id: officeId,
        constituent_id: body.constituentId,
        constituent_external_id: body.constituentExternalId,
        case_type_id: body.caseTypeId,
        case_type_external_id: body.caseTypeExternalId,
        status_id: body.statusId,
        status_external_id: body.statusExternalId,
        category_type_id: body.categoryTypeId,
        category_type_external_id: body.categoryTypeExternalId,
        contact_type_id: body.contactTypeId,
        contact_type_external_id: body.contactTypeExternalId,
        assigned_to_id: body.assignedToId,
        assigned_to_external_id: body.assignedToExternalId,
        summary: body.summary,
        review_date: body.reviewDate,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('cases')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      const c = data as CaseRecord;

      // Queue push to legacy system
      await queueService.pushCase(officeId, c.id, 'create', {
        constituentId: body.constituentId || '',
        caseTypeId: body.caseTypeExternalId,
        statusId: body.statusExternalId,
        categoryTypeId: body.categoryTypeExternalId,
        contactTypeId: body.contactTypeExternalId,
        assignedToId: body.assignedToExternalId,
        summary: body.summary,
        reviewDate: body.reviewDate,
      });

      // Log the audit entry
      await supabase.from('sync_audit_log').insert({
        office_id: officeId,
        entity_type: 'case',
        operation: 'create',
        internal_id: c.id,
        new_data: body,
      });

      const response: ApiResponse = {
        success: true,
        data: {
          id: c.id,
          officeId: c.office_id,
          externalId: c.external_id,
          constituentId: c.constituent_id,
          summary: c.summary,
          createdAt: c.created_at,
        },
      };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  router.post('/', requireCaseworker as RequestHandler, createCaseHandler);

  /**
   * PATCH /cases/:id
   * Update a case
   */
  const updateCaseHandler: RequestHandler = async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { id } = authReq.params;
      const body = UpdateCaseSchema.parse(authReq.body);
      const officeId = authReq.officeId;

      // First check the case exists
      const { data: existingCase, error: findError } = await supabase
        .from('cases')
        .select('*')
        .eq('id', id)
        .eq('office_id', officeId)
        .single();

      if (findError && findError.code !== 'PGRST116') throw findError;
      if (!existingCase) {
        throw ApiError.notFound('Case not found');
      }

      const existing = existingCase as CaseRecord;

      // Build update object
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (body.caseTypeId !== undefined) updateData.case_type_id = body.caseTypeId;
      if (body.caseTypeExternalId !== undefined) updateData.case_type_external_id = body.caseTypeExternalId;
      if (body.statusId !== undefined) updateData.status_id = body.statusId;
      if (body.statusExternalId !== undefined) updateData.status_external_id = body.statusExternalId;
      if (body.categoryTypeId !== undefined) updateData.category_type_id = body.categoryTypeId;
      if (body.categoryTypeExternalId !== undefined) updateData.category_type_external_id = body.categoryTypeExternalId;
      if (body.contactTypeId !== undefined) updateData.contact_type_id = body.contactTypeId;
      if (body.contactTypeExternalId !== undefined) updateData.contact_type_external_id = body.contactTypeExternalId;
      if (body.assignedToId !== undefined) updateData.assigned_to_id = body.assignedToId;
      if (body.assignedToExternalId !== undefined) updateData.assigned_to_external_id = body.assignedToExternalId;
      if (body.summary !== undefined) updateData.summary = body.summary;
      if (body.reviewDate !== undefined) updateData.review_date = body.reviewDate;

      const { data, error } = await supabase
        .from('cases')
        .update(updateData)
        .eq('id', id)
        .eq('office_id', officeId)
        .select()
        .single();

      if (error) throw error;

      const c = data as CaseRecord;

      // Queue push to legacy system if case has external ID
      if (existing.external_id) {
        await queueService.pushCase(officeId, c.id, 'update', {
          constituentId: existing.constituent_id || '',
          caseTypeId: body.caseTypeExternalId ?? existing.case_type_external_id ?? undefined,
          statusId: body.statusExternalId ?? existing.status_external_id ?? undefined,
          categoryTypeId: body.categoryTypeExternalId ?? existing.category_type_external_id ?? undefined,
          contactTypeId: body.contactTypeExternalId ?? existing.contact_type_external_id ?? undefined,
          assignedToId: body.assignedToExternalId ?? existing.assigned_to_external_id ?? undefined,
          summary: body.summary ?? existing.summary ?? undefined,
          reviewDate: body.reviewDate ?? existing.review_date ?? undefined,
        });
      }

      // Log the audit entry
      await supabase.from('sync_audit_log').insert({
        office_id: officeId,
        entity_type: 'case',
        operation: 'update',
        internal_id: c.id,
        external_id: existing.external_id,
        old_data: existingCase,
        new_data: body,
      });

      const response: ApiResponse = {
        success: true,
        data: {
          id: c.id,
          officeId: c.office_id,
          externalId: c.external_id,
          summary: c.summary,
          statusId: c.status_id,
          statusExternalId: c.status_external_id,
          updatedAt: c.updated_at,
        },
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  router.patch('/:id', requireCaseworker as RequestHandler, updateCaseHandler);

  /**
   * GET /cases/:id/emails
   * Get emails associated with a case
   */
  const getCaseEmailsHandler: RequestHandler = async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { id } = authReq.params;
      const officeId = authReq.officeId;

      // Verify case exists
      const { data: caseData, error: caseError } = await supabase
        .from('cases')
        .select('id')
        .eq('id', id)
        .eq('office_id', officeId)
        .single();

      if (caseError && caseError.code !== 'PGRST116') throw caseError;
      if (!caseData) {
        throw ApiError.notFound('Case not found');
      }

      // Get emails for this case
      const { data, error } = await supabase
        .from('emails')
        .select('*')
        .eq('case_id', id)
        .eq('office_id', officeId)
        .order('received_at', { ascending: false });

      if (error) throw error;

      const emails = (data || []) as EmailRecord[];
      const response: ApiResponse = {
        success: true,
        data: emails.map((e) => ({
          id: e.id,
          externalId: e.external_id,
          subject: e.subject,
          fromAddress: e.from_address,
          receivedAt: e.received_at,
          sentAt: e.sent_at,
          type: e.type,
          actioned: e.actioned,
        })),
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  router.get('/:id/emails', requireCaseworker as RequestHandler, getCaseEmailsHandler);

  /**
   * GET /cases/:id/notes
   * Get notes for a case
   */
  const getCaseNotesHandler: RequestHandler = async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { id } = authReq.params;
      const officeId = authReq.officeId;

      // Verify case exists
      const { data: caseData, error: caseError } = await supabase
        .from('cases')
        .select('id')
        .eq('id', id)
        .eq('office_id', officeId)
        .single();

      if (caseError && caseError.code !== 'PGRST116') throw caseError;
      if (!caseData) {
        throw ApiError.notFound('Case not found');
      }

      // Get notes for this case
      const { data, error } = await supabase
        .from('case_notes')
        .select('*')
        .eq('case_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const notes = (data || []) as CaseNoteRecord[];
      const response: ApiResponse = {
        success: true,
        data: notes.map((n) => ({
          id: n.id,
          externalId: n.external_id,
          caseId: n.case_id,
          type: n.type,
          content: n.content,
          createdById: n.created_by_id,
          createdAt: n.created_at,
        })),
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  router.get('/:id/notes', requireCaseworker as RequestHandler, getCaseNotesHandler);

  /**
   * GET /cases/constituent/:constituentId
   * Get all cases for a constituent
   */
  const getCasesByConstituentHandler: RequestHandler = async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { constituentId } = authReq.params;
      const officeId = authReq.officeId;

      const { data, error } = await supabase
        .from('cases')
        .select('*')
        .eq('constituent_id', constituentId)
        .eq('office_id', officeId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const cases = (data || []) as CaseRecord[];
      const response: ApiResponse = {
        success: true,
        data: cases.map((c) => ({
          id: c.id,
          officeId: c.office_id,
          externalId: c.external_id,
          caseTypeId: c.case_type_id,
          caseTypeExternalId: c.case_type_external_id,
          statusId: c.status_id,
          statusExternalId: c.status_external_id,
          summary: c.summary,
          reviewDate: c.review_date,
          isOverdue: c.review_date ? new Date(c.review_date) < new Date() : false,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
        })),
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  router.get('/constituent/:constituentId', requireCaseworker as RequestHandler, getCasesByConstituentHandler);

  /**
   * GET /cases/stats
   * Get case statistics for the office
   */
  const getStatsHandler: RequestHandler = async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const officeId = authReq.officeId;
      const now = new Date().toISOString();

      // Get total count
      const { count: totalCount } = await supabase
        .from('cases')
        .select('*', { count: 'exact', head: true })
        .eq('office_id', officeId);

      // Get overdue count
      const { count: overdueCount } = await supabase
        .from('cases')
        .select('*', { count: 'exact', head: true })
        .eq('office_id', officeId)
        .lt('review_date', now)
        .not('review_date', 'is', null);

      // Get counts by status (simplified)
      const { data: statusData } = await supabase
        .from('cases')
        .select('status_external_id')
        .eq('office_id', officeId);

      const statusCounts: Record<number, number> = {};
      ((statusData || []) as Array<{ status_external_id: number | null }>).forEach((c) => {
        if (c.status_external_id !== null) {
          statusCounts[c.status_external_id] = (statusCounts[c.status_external_id] || 0) + 1;
        }
      });

      const response: ApiResponse = {
        success: true,
        data: {
          totalCount: totalCount ?? 0,
          overdueCount: overdueCount ?? 0,
          byStatus: statusCounts,
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
