/**
 * Error Handler Middleware
 *
 * Global error handling for the API.
 */

import { Request, Response, NextFunction } from 'express';
import { ApiError, ApiResponse, ErrorCodes } from '../types';

/**
 * Global error handler middleware
 */
export function errorHandler(
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('[API Error]', error);

  if (error instanceof ApiError) {
    const errorObj: ApiResponse['error'] = {
      code: error.code,
      message: error.message,
    };
    if (error.details) {
      errorObj.details = error.details;
    }
    const response: ApiResponse = {
      success: false,
      error: errorObj,
    };
    res.status(error.statusCode).json(response);
    return;
  }

  // Handle Zod validation errors
  if (error.name === 'ZodError') {
    const response: ApiResponse = {
      success: false,
      error: {
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Validation failed',
        details: { errors: (error as unknown as { errors: unknown[] }).errors },
      },
    };
    res.status(400).json(response);
    return;
  }

  // Default to internal error
  const response: ApiResponse = {
    success: false,
    error: {
      code: ErrorCodes.INTERNAL_ERROR,
      message: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
    },
  };
  res.status(500).json(response);
}

/**
 * Not found handler middleware
 */
export function notFoundHandler(_req: Request, res: Response): void {
  const response: ApiResponse = {
    success: false,
    error: {
      code: ErrorCodes.NOT_FOUND,
      message: 'Endpoint not found',
    },
  };
  res.status(404).json(response);
}
