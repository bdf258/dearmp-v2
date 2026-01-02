// Shared utility functions for Edge Functions

/**
 * Allowed origins for CORS
 */
const ALLOWED_ORIGINS = [
  // Production domains
  /^https:\/\/([a-z0-9-]+\.)?dearmp\.uk$/,
  /^https:\/\/([a-z0-9-]+\.)?kep\.la$/,
  /^https:\/\/([a-z0-9-]+\.)?farier\.com$/,
  // Development
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
];

/**
 * Check if an origin is allowed
 */
export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGINS.some(pattern => pattern.test(origin));
}

/**
 * Get CORS headers for a specific origin
 * Returns null if origin is not allowed, forcing the caller to handle rejection
 */
export function getCorsHeaders(origin: string | null): Record<string, string> | null {
  // Reject requests without a valid origin header to prevent CORS bypass attacks
  // where attackers omit the Origin header to get a default allowed origin
  if (!origin || !isAllowedOrigin(origin)) {
    return null;
  }
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
  };
}

/**
 * Get CORS headers with fallback for non-browser clients (e.g., server-to-server)
 * Use this only for endpoints that must support non-browser access
 */
export function getCorsHeadersWithFallback(origin: string | null): Record<string, string> {
  const headers = getCorsHeaders(origin);
  if (headers) return headers;
  // For non-browser clients, return restrictive CORS that doesn't expose credentials
  return {
    'Access-Control-Allow-Origin': 'https://dearmp.uk',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Credentials': 'false',  // No credentials for unknown origins
    'Vary': 'Origin',
  };
}

/**
 * Standard CORS headers for Edge Functions (legacy - use getCorsHeaders for dynamic origin)
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://dearmp.uk',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

/**
 * Create a JSON response with CORS headers
 * Returns 403 if origin is not allowed
 */
export function jsonResponse(data: unknown, status = 200, origin?: string | null): Response {
  const corsHeaders = getCorsHeaders(origin ?? null);
  if (!corsHeaders) {
    // Origin not allowed - return forbidden
    return new Response(JSON.stringify({ error: 'Origin not allowed', success: false }), {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
        'Vary': 'Origin',
      },
    });
  }
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
export function errorResponse(message: string, status = 400, origin?: string | null): Response {
  return jsonResponse({ error: message, success: false }, status, origin);
}

/**
 * Handle CORS preflight requests
 * Returns 403 for disallowed origins
 */
export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.get('Origin');
    const corsHeaders = getCorsHeaders(origin);
    if (!corsHeaders) {
      return new Response('Forbidden', {
        status: 403,
        headers: { 'Vary': 'Origin' },
      });
    }
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
 * Removes dangerous elements and attributes that could enable XSS attacks
 */
export function sanitizeHtml(html: string): string {
  // Remove script tags (including variations)
  let sanitized = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<script[^>]*>/gi, '')
    .replace(/<\/script>/gi, '');

  // Remove all event handlers (on* attributes)
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]+/gi, '');

  // Remove javascript: and data: URLs in href/src attributes
  sanitized = sanitized.replace(/href\s*=\s*["']?\s*javascript:[^"'>]*/gi, 'href="#"');
  sanitized = sanitized.replace(/src\s*=\s*["']?\s*javascript:[^"'>]*/gi, 'src=""');
  sanitized = sanitized.replace(/href\s*=\s*["']?\s*data:[^"'>]*/gi, 'href="#"');
  sanitized = sanitized.replace(/src\s*=\s*["']?\s*data:[^"'>]*/gi, 'src=""');
  sanitized = sanitized.replace(/href\s*=\s*["']?\s*vbscript:[^"'>]*/gi, 'href="#"');

  // Remove dangerous elements entirely
  sanitized = sanitized.replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '');
  sanitized = sanitized.replace(/<iframe[^>]*\/?>/gi, '');
  sanitized = sanitized.replace(/<object[^>]*>[\s\S]*?<\/object>/gi, '');
  sanitized = sanitized.replace(/<object[^>]*\/?>/gi, '');
  sanitized = sanitized.replace(/<embed[^>]*\/?>/gi, '');
  sanitized = sanitized.replace(/<form[^>]*>[\s\S]*?<\/form>/gi, '');
  sanitized = sanitized.replace(/<form[^>]*>/gi, '');
  sanitized = sanitized.replace(/<\/form>/gi, '');
  sanitized = sanitized.replace(/<input[^>]*\/?>/gi, '');
  sanitized = sanitized.replace(/<button[^>]*>[\s\S]*?<\/button>/gi, '');
  sanitized = sanitized.replace(/<button[^>]*\/?>/gi, '');
  sanitized = sanitized.replace(/<textarea[^>]*>[\s\S]*?<\/textarea>/gi, '');
  sanitized = sanitized.replace(/<select[^>]*>[\s\S]*?<\/select>/gi, '');
  sanitized = sanitized.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  sanitized = sanitized.replace(/<link[^>]*\/?>/gi, '');
  sanitized = sanitized.replace(/<meta[^>]*\/?>/gi, '');
  sanitized = sanitized.replace(/<base[^>]*\/?>/gi, '');

  // Remove SVG (can contain scripts)
  sanitized = sanitized.replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, '');

  // Remove math elements (can be abused)
  sanitized = sanitized.replace(/<math[^>]*>[\s\S]*?<\/math>/gi, '');

  // Remove expression() in style attributes (IE-specific XSS)
  sanitized = sanitized.replace(/expression\s*\([^)]*\)/gi, '');
  sanitized = sanitized.replace(/url\s*\(\s*["']?\s*javascript:[^)]*\)/gi, 'url()');

  return sanitized;
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
 */
export function log(level: 'info' | 'warn' | 'error', message: string, context?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  const logData = {
    timestamp,
    level,
    message,
    ...context,
  };

  if (level === 'error') {
    console.error(JSON.stringify(logData));
  } else if (level === 'warn') {
    console.warn(JSON.stringify(logData));
  } else {
    console.log(JSON.stringify(logData));
  }
}
