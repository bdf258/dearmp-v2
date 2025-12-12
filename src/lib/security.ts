/**
 * Security Utilities for DearMP v2
 *
 * This module provides security functions for:
 * - HTML sanitization (XSS prevention)
 * - Input validation
 * - Authorization checks
 */

import DOMPurify from 'dompurify';

// ============================================================================
// HTML SANITIZATION
// ============================================================================

/**
 * DOMPurify configuration for sanitizing user-generated HTML content.
 * This is used for notes, replies, and any other rich text content.
 */
const SANITIZE_CONFIG: DOMPurify.Config = {
  // Allow safe formatting tags
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',
    'ul', 'ol', 'li',
    'blockquote', 'pre', 'code',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'a', 'span', 'div',
  ],
  // Allow safe attributes
  ALLOWED_ATTR: [
    'href', 'title', 'target', 'rel',
    'class', 'id',
  ],
  // Force safe link handling
  ALLOW_DATA_ATTR: false,
  // Remove any dangerous URI schemes
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  // Force target="_blank" links to have rel="noopener noreferrer"
  ADD_ATTR: ['target'],
};

/**
 * Sanitize HTML content to prevent XSS attacks.
 * Use this for ANY user-generated HTML before rendering with dangerouslySetInnerHTML.
 *
 * @param dirty - The untrusted HTML string
 * @returns Sanitized HTML safe for rendering
 *
 * @example
 * // In a React component:
 * <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(note.body) }} />
 */
export function sanitizeHtml(dirty: string): string {
  if (!dirty) return '';

  // Sanitize the HTML
  const clean = DOMPurify.sanitize(dirty, SANITIZE_CONFIG);

  return clean;
}

/**
 * Sanitize HTML and also add rel="noopener noreferrer" to all links.
 * This version is more aggressive and should be used for email content.
 */
export function sanitizeEmailHtml(dirty: string): string {
  if (!dirty) return '';

  const clean = DOMPurify.sanitize(dirty, {
    ...SANITIZE_CONFIG,
    // More restrictive for emails
    ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'ul', 'ol', 'li', 'blockquote', 'a'],
    // Add noopener to all links
    ADD_ATTR: ['rel'],
    FORCE_BODY: true,
  });

  // Ensure all links have proper rel attribute
  return clean.replace(/<a /g, '<a rel="noopener noreferrer" ');
}

// ============================================================================
// INPUT VALIDATION
// ============================================================================

/**
 * UUID v4 regex pattern
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validate a UUID string
 *
 * @param value - The string to validate
 * @returns true if valid UUID v4
 */
export function isValidUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

/**
 * Validate and sanitize a UUID, throwing if invalid
 *
 * @param value - The string to validate
 * @param fieldName - Name of the field for error message
 * @returns The validated UUID
 * @throws Error if not a valid UUID
 */
export function validateUuid(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string`);
  }
  if (!isValidUuid(value)) {
    throw new Error(`${fieldName} must be a valid UUID`);
  }
  return value;
}

/**
 * Email regex pattern (basic validation)
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate an email address
 *
 * @param value - The string to validate
 * @returns true if valid email format
 */
export function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value) && value.length <= 254;
}

/**
 * Validate string length
 *
 * @param value - The string to validate
 * @param maxLength - Maximum allowed length
 * @param fieldName - Name of the field for error message
 * @returns The validated string
 * @throws Error if string is too long
 */
export function validateLength(value: string, maxLength: number, fieldName: string): string {
  if (value.length > maxLength) {
    throw new Error(`${fieldName} must be ${maxLength} characters or less`);
  }
  return value;
}

// ============================================================================
// AUTHORIZATION HELPERS
// ============================================================================

import type { Profile, UserRole } from './database.types';

/**
 * Check if a profile has admin privileges
 *
 * @param profile - The user's profile
 * @returns true if user is an admin
 */
export function isAdmin(profile: Profile | null): boolean {
  return profile?.role === 'admin';
}

/**
 * Check if a profile can manage other users
 *
 * @param profile - The user's profile
 * @returns true if user can manage users
 */
export function canManageUsers(profile: Profile | null): boolean {
  return isAdmin(profile);
}

/**
 * Check if a profile can delete resources
 *
 * @param profile - The user's profile
 * @returns true if user can delete
 */
export function canDelete(profile: Profile | null): boolean {
  return isAdmin(profile);
}

/**
 * Check if user can modify another user's role
 *
 * @param currentProfile - The current user's profile
 * @param targetProfile - The profile being modified
 * @returns true if modification is allowed
 */
export function canModifyRole(
  currentProfile: Profile | null,
  targetProfile: Profile
): boolean {
  // Must be admin
  if (!isAdmin(currentProfile)) return false;

  // Cannot modify own role (prevent lock-out)
  if (currentProfile?.id === targetProfile.id) return false;

  // Must be in same office
  if (currentProfile?.office_id !== targetProfile.office_id) return false;

  return true;
}

/**
 * Check if user can access a resource in an office
 *
 * @param profile - The user's profile
 * @param resourceOfficeId - The office_id of the resource
 * @returns true if user can access the resource
 */
export function canAccessOffice(
  profile: Profile | null,
  resourceOfficeId: string
): boolean {
  if (!profile) return false;
  return profile.office_id === resourceOfficeId;
}

// ============================================================================
// SAFE ERROR MESSAGES
// ============================================================================

/**
 * Sanitize an error for display to users.
 * Removes potentially sensitive information from error messages.
 *
 * @param error - The error to sanitize
 * @returns A safe error message string
 */
export function getSafeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Remove any potential path or system information
    const message = error.message
      .replace(/\/[^\s]+/g, '[path]')
      .replace(/\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/gi, '[id]');

    // Check for known safe error types
    if (message.includes('Invalid login credentials')) {
      return 'Invalid email or password';
    }
    if (message.includes('Email not confirmed')) {
      return 'Please verify your email address';
    }
    if (message.includes('User already registered')) {
      return 'An account with this email already exists';
    }

    // For unknown errors, return generic message
    if (message.length > 100 || message.includes('PGRST') || message.includes('JWT')) {
      return 'An error occurred. Please try again.';
    }

    return message;
  }

  return 'An unexpected error occurred';
}

// ============================================================================
// RATE LIMITING (Client-side helper)
// ============================================================================

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

/**
 * Client-side rate limiting helper.
 * Note: This is not a replacement for server-side rate limiting,
 * but helps prevent accidental rapid requests.
 *
 * @param key - Unique key for the rate limit (e.g., 'login', 'api-call')
 * @param maxRequests - Maximum requests allowed in the window
 * @param windowMs - Time window in milliseconds
 * @returns true if request is allowed, false if rate limited
 */
export function checkRateLimit(
  key: string,
  maxRequests: number = 10,
  windowMs: number = 60000
): boolean {
  const now = Date.now();
  const existing = rateLimitMap.get(key);

  if (!existing || now > existing.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (existing.count >= maxRequests) {
    return false;
  }

  existing.count++;
  return true;
}
