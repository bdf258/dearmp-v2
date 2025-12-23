/**
 * HTTP Layer Types
 *
 * Types for HTTP request handling, authentication, and API responses.
 */

import { Request } from 'express';

/**
 * Authenticated user data from Supabase JWT
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  officeId: string;
  role: 'admin' | 'caseworker' | 'viewer';
}

/**
 * Authenticated request with user and office context
 */
export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
  officeId: string;
}

/**
 * Standard API response envelope
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    page?: number;
    limit?: number;
    offset?: number;
    total?: number;
    hasMore?: boolean;
  };
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

/**
 * Error codes for API responses
 */
export const ErrorCodes = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  SYNC_IN_PROGRESS: 'SYNC_IN_PROGRESS',
  OFFICE_NOT_CONFIGURED: 'OFFICE_NOT_CONFIGURED',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * API Error class for consistent error handling
 */
export class ApiError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static unauthorized(message = 'Authentication required'): ApiError {
    return new ApiError(ErrorCodes.UNAUTHORIZED, message, 401);
  }

  static forbidden(message = 'Permission denied'): ApiError {
    return new ApiError(ErrorCodes.FORBIDDEN, message, 403);
  }

  static notFound(message = 'Resource not found'): ApiError {
    return new ApiError(ErrorCodes.NOT_FOUND, message, 404);
  }

  static validation(message: string, details?: Record<string, unknown>): ApiError {
    return new ApiError(ErrorCodes.VALIDATION_ERROR, message, 400, details);
  }

  static internal(message = 'Internal server error'): ApiError {
    return new ApiError(ErrorCodes.INTERNAL_ERROR, message, 500);
  }
}
