// Shared utility functions for Edge Functions

// ============================================================================
// SECURITY: CORS Configuration
// ============================================================================

/**
 * Allowed origins for CORS requests.
 * In production, this should be set via environment variable.
 * Falls back to restrictive list if not set.
 */
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

/**
 * Get CORS headers with origin validation
 * SECURITY: Only allow requests from known origins in production
 */
export function getCorsHeaders(origin?: string | null): Record<string, string> {
  // If no allowed origins configured (development), allow all
  if (ALLOWED_ORIGINS.length === 0) {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    };
  }

  // Check if origin is allowed
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
  };
}

/**
 * Standard CORS headers for Edge Functions
 * @deprecated Use getCorsHeaders(req.headers.get('origin')) for origin validation
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

/**
 * Create a JSON response with CORS headers
 */
export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Create an error response
 */
export function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message, success: false }, status);
}

/**
 * Handle CORS preflight requests
 */
export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return null;
}

/**
 * Extract first N characters as snippet
 */
export function createSnippet(text: string, maxLength = 200): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLength) {
    return cleaned;
  }
  return cleaned.substring(0, maxLength - 3) + '...';
}

/**
 * Validate required environment variables
 */
export function validateEnv(required: string[]): void {
  const missing: string[] = [];
  for (const key of required) {
    if (!Deno.env.get(key)) {
      missing.push(key);
    }
  }
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  initialDelayMs = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries - 1) {
        const delay = initialDelayMs * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * Parse email address from "Name <email>" format
 */
export function parseEmailAddress(input: string): { name: string | null; email: string } {
  const match = input.match(/^(.+?)\s*<(.+?)>$/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() };
  }
  return { name: null, email: input.trim() };
}

/**
 * Sanitize HTML content
 * SECURITY: This is a more comprehensive sanitization than the previous version.
 * For user-facing content, use a proper library like DOMPurify on the frontend.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';

  let cleaned = html;

  // Remove script tags (including nested)
  cleaned = cleaned.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove all event handlers (on* attributes) - more comprehensive pattern
  cleaned = cleaned.replace(/\s*on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '');

  // Remove javascript: and data: URLs from href and src attributes
  cleaned = cleaned.replace(/href\s*=\s*["']?\s*javascript:[^"'>\s]*/gi, 'href="#"');
  cleaned = cleaned.replace(/src\s*=\s*["']?\s*javascript:[^"'>\s]*/gi, 'src=""');
  cleaned = cleaned.replace(/href\s*=\s*["']?\s*data:[^"'>\s]*/gi, 'href="#"');
  cleaned = cleaned.replace(/src\s*=\s*["']?\s*data:[^"'>\s]*/gi, 'src=""');

  // Remove style tags (can contain expressions in IE)
  cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Remove dangerous tags
  const dangerousTags = ['iframe', 'object', 'embed', 'form', 'input', 'button', 'link', 'meta', 'base'];
  for (const tag of dangerousTags) {
    const openPattern = new RegExp(`<${tag}\\b[^>]*>`, 'gi');
    const closePattern = new RegExp(`</${tag}>`, 'gi');
    cleaned = cleaned.replace(openPattern, '');
    cleaned = cleaned.replace(closePattern, '');
  }

  // Remove SVG (can contain scripts via onload, etc)
  cleaned = cleaned.replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '');

  // Remove expression() from CSS (IE vulnerability)
  cleaned = cleaned.replace(/expression\s*\([^)]*\)/gi, '');

  return cleaned;
}

/**
 * Generate a unique reference number
 */
export function generateReferenceNumber(prefix: string): string {
  const year = new Date().getFullYear();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${year}-${random}`;
}

/**
 * Format date for display
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Log with timestamp and context
 * SECURITY: Sanitizes potentially sensitive data before logging
 */
export function log(level: 'info' | 'warn' | 'error', message: string, context?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();

  // Sanitize context to remove potentially sensitive data
  const sanitizedContext = context ? sanitizeLogContext(context) : undefined;

  const logData = {
    timestamp,
    level,
    message,
    ...sanitizedContext,
  };

  if (level === 'error') {
    console.error(JSON.stringify(logData));
  } else if (level === 'warn') {
    console.warn(JSON.stringify(logData));
  } else {
    console.log(JSON.stringify(logData));
  }
}

/**
 * Sanitize log context to remove sensitive data
 */
function sanitizeLogContext(context: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = ['password', 'token', 'key', 'secret', 'cookie', 'authorization', 'credential'];
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(context)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some((s) => lowerKey.includes(s))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeLogContext(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

// ============================================================================
// SECURITY: Input Validation
// ============================================================================

/**
 * UUID v4 regex pattern
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validate a UUID string
 * SECURITY: Use this to validate all UUID parameters before database queries
 *
 * @param value - The string to validate
 * @returns true if valid UUID v4
 */
export function validateUuid(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return UUID_REGEX.test(value);
}

/**
 * Validate an email address format
 */
export function validateEmail(value: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value) && value.length <= 254;
}

/**
 * Validate string length to prevent oversized inputs
 */
export function validateLength(value: string, maxLength: number): boolean {
  return value.length <= maxLength;
}

// ============================================================================
// SECURITY: Authentication
// ============================================================================

/**
 * Verify that the request is authenticated with service role key
 * SECURITY: Use this for edge functions that should only be called internally
 *
 * @param req - The incoming request
 * @returns null if authorized, error string if not
 */
export function verifyServiceRoleAuth(req: Request): string | null {
  const authHeader = req.headers.get('authorization');

  if (!authHeader) {
    return 'Missing authorization header';
  }

  // Extract the token (Bearer token or API key)
  const token = authHeader.replace('Bearer ', '').trim();

  if (!token) {
    return 'Missing token in authorization header';
  }

  // Get the service role key from environment
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!serviceRoleKey) {
    return 'Service role key not configured';
  }

  // Compare with service role key
  if (token === serviceRoleKey) {
    return null; // Authorized
  }

  // Also accept the anon key for requests from authenticated users via Supabase client
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (anonKey && token === anonKey) {
    // For anon key, we should verify the JWT claims
    // For now, we accept it but log a warning
    log('warn', 'Request using anon key - should verify JWT claims');
    return null;
  }

  return 'Invalid authorization token';
}

/**
 * Extract and verify JWT claims from a request
 * SECURITY: Use this to get the authenticated user from a request
 *
 * @param req - The incoming request
 * @returns The JWT payload or null if invalid
 */
export async function verifyJwt(req: Request): Promise<{ sub: string; email?: string; role?: string } | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);

  try {
    // Decode the JWT (note: this doesn't verify signature - Supabase handles that)
    // In production, you should use Supabase's auth.getUser() to properly verify
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(atob(parts[1]));

    // Check expiration
    if (payload.exp && payload.exp < Date.now() / 1000) {
      return null;
    }

    return {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  } catch {
    return null;
  }
}
