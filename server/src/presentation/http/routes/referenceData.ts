/**
 * Reference Data Routes
 *
 * HTTP endpoints for reference data (lookup tables):
 * - GET /reference/case-types - Get case types
 * - GET /reference/status-types - Get status types
 * - GET /reference/category-types - Get category types
 * - GET /reference/contact-types - Get contact types
 * - GET /reference/caseworkers - Get caseworkers
 * - GET /reference/all - Get all reference data in one request
 */

import { Router, RequestHandler } from 'express';
import { z } from 'zod';
import { SupabaseClient } from '@supabase/supabase-js';
import { AuthenticatedRequest, ApiResponse } from '../types';

// Query schema for filtering
const ReferenceDataQuerySchema = z.object({
  activeOnly: z.coerce.boolean().default(true),
});

export interface ReferenceDataRoutesDependencies {
  supabase: SupabaseClient;
}

// Type interfaces for reference data records
interface ReferenceRecord {
  id: string;
  external_id: number;
  name: string;
  is_active: boolean;
  last_synced_at: string | null;
}

interface ContactTypeRecord extends ReferenceRecord {
  type: string | null;
}

interface CaseworkerRecord extends ReferenceRecord {
  email: string | null;
}

interface TagRecord {
  id: string;
  external_id: number;
  tag: string;
  last_synced_at: string | null;
}

interface FlagRecord {
  id: string;
  external_id: number;
  flag: string;
  last_synced_at: string | null;
}

/**
 * Create reference data routes
 */
export function createReferenceDataRoutes({ supabase }: ReferenceDataRoutesDependencies): Router {
  const router = Router();

  /**
   * GET /reference/case-types
   * Get all case types for the office
   */
  const getCaseTypesHandler: RequestHandler = async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const query = ReferenceDataQuerySchema.parse(authReq.query);
      const officeId = authReq.officeId;

      let dbQuery = supabase
        .from('case_types')
        .select('*')
        .eq('office_id', officeId)
        .order('name');

      if (query.activeOnly) {
        dbQuery = dbQuery.eq('is_active', true);
      }

      const { data, error } = await dbQuery;

      if (error) throw error;

      const items = (data || []) as ReferenceRecord[];
      const response: ApiResponse = {
        success: true,
        data: items.map((item) => ({
          id: item.id,
          externalId: item.external_id,
          name: item.name,
          isActive: item.is_active,
          lastSyncedAt: item.last_synced_at,
        })),
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  router.get('/case-types', getCaseTypesHandler);

  /**
   * GET /reference/status-types
   * Get all status types for the office
   */
  const getStatusTypesHandler: RequestHandler = async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const query = ReferenceDataQuerySchema.parse(authReq.query);
      const officeId = authReq.officeId;

      let dbQuery = supabase
        .from('status_types')
        .select('*')
        .eq('office_id', officeId)
        .order('name');

      if (query.activeOnly) {
        dbQuery = dbQuery.eq('is_active', true);
      }

      const { data, error } = await dbQuery;

      if (error) throw error;

      const items = (data || []) as ReferenceRecord[];
      const response: ApiResponse = {
        success: true,
        data: items.map((item) => ({
          id: item.id,
          externalId: item.external_id,
          name: item.name,
          isActive: item.is_active,
          lastSyncedAt: item.last_synced_at,
        })),
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  router.get('/status-types', getStatusTypesHandler);

  /**
   * GET /reference/category-types
   * Get all category types for the office
   */
  const getCategoryTypesHandler: RequestHandler = async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const query = ReferenceDataQuerySchema.parse(authReq.query);
      const officeId = authReq.officeId;

      let dbQuery = supabase
        .from('category_types')
        .select('*')
        .eq('office_id', officeId)
        .order('name');

      if (query.activeOnly) {
        dbQuery = dbQuery.eq('is_active', true);
      }

      const { data, error } = await dbQuery;

      if (error) throw error;

      const items = (data || []) as ReferenceRecord[];
      const response: ApiResponse = {
        success: true,
        data: items.map((item) => ({
          id: item.id,
          externalId: item.external_id,
          name: item.name,
          isActive: item.is_active,
          lastSyncedAt: item.last_synced_at,
        })),
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  router.get('/category-types', getCategoryTypesHandler);

  /**
   * GET /reference/contact-types
   * Get all contact types for the office
   */
  const getContactTypesHandler: RequestHandler = async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const query = ReferenceDataQuerySchema.parse(authReq.query);
      const officeId = authReq.officeId;

      let dbQuery = supabase
        .from('contact_types')
        .select('*')
        .eq('office_id', officeId)
        .order('name');

      if (query.activeOnly) {
        dbQuery = dbQuery.eq('is_active', true);
      }

      const { data, error } = await dbQuery;

      if (error) throw error;

      const items = (data || []) as ContactTypeRecord[];
      const response: ApiResponse = {
        success: true,
        data: items.map((item) => ({
          id: item.id,
          externalId: item.external_id,
          name: item.name,
          type: item.type,
          isActive: item.is_active,
          lastSyncedAt: item.last_synced_at,
        })),
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  router.get('/contact-types', getContactTypesHandler);

  /**
   * GET /reference/caseworkers
   * Get all caseworkers for the office
   */
  const getCaseworkersHandler: RequestHandler = async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const query = ReferenceDataQuerySchema.parse(authReq.query);
      const officeId = authReq.officeId;

      let dbQuery = supabase
        .from('caseworkers')
        .select('*')
        .eq('office_id', officeId)
        .order('name');

      if (query.activeOnly) {
        dbQuery = dbQuery.eq('is_active', true);
      }

      const { data, error } = await dbQuery;

      if (error) throw error;

      const items = (data || []) as CaseworkerRecord[];
      const response: ApiResponse = {
        success: true,
        data: items.map((item) => ({
          id: item.id,
          externalId: item.external_id,
          name: item.name,
          email: item.email,
          isActive: item.is_active,
          lastSyncedAt: item.last_synced_at,
        })),
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  router.get('/caseworkers', getCaseworkersHandler);

  /**
   * GET /reference/all
   * Get all reference data in one request
   */
  const getAllHandler: RequestHandler = async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const query = ReferenceDataQuerySchema.parse(authReq.query);
      const officeId = authReq.officeId;

      // Build base queries
      let caseTypesQuery = supabase
        .from('case_types')
        .select('*')
        .eq('office_id', officeId)
        .order('name');

      let statusTypesQuery = supabase
        .from('status_types')
        .select('*')
        .eq('office_id', officeId)
        .order('name');

      let categoryTypesQuery = supabase
        .from('category_types')
        .select('*')
        .eq('office_id', officeId)
        .order('name');

      let contactTypesQuery = supabase
        .from('contact_types')
        .select('*')
        .eq('office_id', officeId)
        .order('name');

      let caseworkersQuery = supabase
        .from('caseworkers')
        .select('*')
        .eq('office_id', officeId)
        .order('name');

      // Apply active filter if needed
      if (query.activeOnly) {
        caseTypesQuery = caseTypesQuery.eq('is_active', true);
        statusTypesQuery = statusTypesQuery.eq('is_active', true);
        categoryTypesQuery = categoryTypesQuery.eq('is_active', true);
        contactTypesQuery = contactTypesQuery.eq('is_active', true);
        caseworkersQuery = caseworkersQuery.eq('is_active', true);
      }

      // Execute all queries in parallel
      const [
        { data: caseTypes, error: caseTypesError },
        { data: statusTypes, error: statusTypesError },
        { data: categoryTypes, error: categoryTypesError },
        { data: contactTypes, error: contactTypesError },
        { data: caseworkers, error: caseworkersError },
      ] = await Promise.all([
        caseTypesQuery,
        statusTypesQuery,
        categoryTypesQuery,
        contactTypesQuery,
        caseworkersQuery,
      ]);

      if (caseTypesError) throw caseTypesError;
      if (statusTypesError) throw statusTypesError;
      if (categoryTypesError) throw categoryTypesError;
      if (contactTypesError) throw contactTypesError;
      if (caseworkersError) throw caseworkersError;

      const response: ApiResponse = {
        success: true,
        data: {
          caseTypes: ((caseTypes || []) as ReferenceRecord[]).map((item) => ({
            id: item.id,
            externalId: item.external_id,
            name: item.name,
            isActive: item.is_active,
          })),
          statusTypes: ((statusTypes || []) as ReferenceRecord[]).map((item) => ({
            id: item.id,
            externalId: item.external_id,
            name: item.name,
            isActive: item.is_active,
          })),
          categoryTypes: ((categoryTypes || []) as ReferenceRecord[]).map((item) => ({
            id: item.id,
            externalId: item.external_id,
            name: item.name,
            isActive: item.is_active,
          })),
          contactTypes: ((contactTypes || []) as ContactTypeRecord[]).map((item) => ({
            id: item.id,
            externalId: item.external_id,
            name: item.name,
            type: item.type,
            isActive: item.is_active,
          })),
          caseworkers: ((caseworkers || []) as CaseworkerRecord[]).map((item) => ({
            id: item.id,
            externalId: item.external_id,
            name: item.name,
            email: item.email,
            isActive: item.is_active,
          })),
        },
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  router.get('/all', getAllHandler);

  /**
   * GET /reference/tags
   * Get all tags for the office
   */
  const getTagsHandler: RequestHandler = async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const officeId = authReq.officeId;

      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .eq('office_id', officeId)
        .order('tag');

      if (error) throw error;

      const items = (data || []) as TagRecord[];
      const response: ApiResponse = {
        success: true,
        data: items.map((item) => ({
          id: item.id,
          externalId: item.external_id,
          name: item.tag,
          lastSyncedAt: item.last_synced_at,
        })),
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  router.get('/tags', getTagsHandler);

  /**
   * GET /reference/flags
   * Get all flags for the office
   */
  const getFlagsHandler: RequestHandler = async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const officeId = authReq.officeId;

      const { data, error } = await supabase
        .from('flags')
        .select('*')
        .eq('office_id', officeId)
        .order('flag');

      if (error) throw error;

      const items = (data || []) as FlagRecord[];
      const response: ApiResponse = {
        success: true,
        data: items.map((item) => ({
          id: item.id,
          externalId: item.external_id,
          name: item.flag,
          lastSyncedAt: item.last_synced_at,
        })),
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  router.get('/flags', getFlagsHandler);

  return router;
}
