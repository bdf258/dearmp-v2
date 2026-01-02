import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generate a content fingerprint for campaign detection.
 * This must match the server-side implementation in supabase/functions/_shared/gemini.ts
 */
export function generateFingerprint(subject: string, body: string): string {
  // Normalize content
  const normalized = `${subject} ${body}`
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Simple hash function (matches server-side implementation)
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  return Math.abs(hash).toString(16).padStart(8, '0');
}
