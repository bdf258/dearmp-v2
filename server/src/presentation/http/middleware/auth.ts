/**
 * Authentication Middleware
 *
 * Validates Supabase JWTs and extracts user/office context.
 */

import { Response, NextFunction } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import { AuthenticatedRequest, AuthenticatedUser, ApiError } from '../types';

/**
 * Create authentication middleware
 */
export function createAuthMiddleware(supabase: SupabaseClient) {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader?.startsWith('Bearer ')) {
        throw ApiError.unauthorized('Missing or invalid authorization header');
      }

      const token = authHeader.substring(7);

      // Verify JWT with Supabase
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser(token);

      if (authError || !user) {
        throw ApiError.unauthorized('Invalid or expired token');
      }

      // Get user's profile which contains office membership
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('office_id, role')
        .eq('id', user.id)
        .single();

      if (profileError || !profile || !profile.office_id) {
        throw ApiError.forbidden('User is not a member of any office');
      }

      // Attach user context to request
      const authenticatedUser: AuthenticatedUser = {
        id: user.id,
        email: user.email ?? '',
        officeId: profile.office_id,
        role: profile.role,
      };

      req.user = authenticatedUser;
      req.officeId = profile.office_id;

      next();
    } catch (error) {
      if (error instanceof ApiError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        });
      } else {
        res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Authentication failed',
          },
        });
      }
    }
  };
}

/**
 * Middleware to require admin role
 */
export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (req.user?.role !== 'admin') {
    res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Admin access required',
      },
    });
    return;
  }
  next();
}

/**
 * Middleware to require caseworker or higher role
 */
export function requireCaseworker(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'caseworker')) {
    res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Caseworker access required',
      },
    });
    return;
  }
  next();
}
