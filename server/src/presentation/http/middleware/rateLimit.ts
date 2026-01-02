/**
 * Rate Limiting Middleware
 *
 * Provides rate limiting to protect API endpoints from abuse.
 * Uses express-rate-limit with configurable limits for different endpoint types.
 */

import rateLimit, { type Options } from 'express-rate-limit';
import type { Request, Response } from 'express';
import { ErrorCodes } from '../types';

/**
 * Rate limit configuration options
 */
export interface RateLimitConfig {
  /** Requests per window (default: 100) */
  max?: number;
  /** Window size in milliseconds (default: 60000 = 1 minute) */
  windowMs?: number;
  /** Custom message for rate limit exceeded */
  message?: string;
  /** Skip rate limiting for certain requests */
  skip?: (req: Request) => boolean;
}

/**
 * Create a standardized rate limit response
 */
function createRateLimitResponse(_req: Request, res: Response): void {
  res.status(429).json({
    success: false,
    error: {
      code: ErrorCodes.RATE_LIMITED,
      message: 'Too many requests. Please try again later.',
    },
  });
}

/**
 * Create a rate limiter middleware with the given configuration
 */
export function createRateLimiter(config: RateLimitConfig = {}) {
  const options: Partial<Options> = {
    windowMs: config.windowMs ?? 60 * 1000, // 1 minute default
    max: config.max ?? 100, // 100 requests per window default
    standardHeaders: true, // Return rate limit info in headers
    legacyHeaders: false, // Disable X-RateLimit-* headers
    handler: createRateLimitResponse,
    skip: config.skip,
    // Don't use custom keyGenerator to avoid IPv6 issues
    // Let express-rate-limit use its default IP-based key generator
    validate: {
      trustProxy: false,
      xForwardedForHeader: false,
    },
  };

  return rateLimit(options);
}

/**
 * Default API rate limiter
 * 100 requests per minute per user/IP
 */
export const apiRateLimiter = createRateLimiter({
  max: 100,
  windowMs: 60 * 1000,
});

/**
 * Strict rate limiter for sensitive operations
 * 10 requests per minute per user/IP
 */
export const strictRateLimiter = createRateLimiter({
  max: 10,
  windowMs: 60 * 1000,
});

/**
 * Auth rate limiter for login/auth attempts
 * 5 requests per minute per IP (stricter to prevent brute force)
 */
export const authRateLimiter = createRateLimiter({
  max: 5,
  windowMs: 60 * 1000,
});
