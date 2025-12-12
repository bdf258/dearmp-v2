# Security Audit Report - DearMP v2

**Date:** December 12, 2025
**Auditor:** Claude Code Security Review
**Classification:** CRITICAL - Enterprise Software

---

## Executive Summary

This security audit identified **17 critical and high-severity vulnerabilities** that must be addressed before production deployment. The most severe issues include:

1. **Completely permissive RLS policies** - All users can access all data
2. **Stored XSS vulnerabilities** - Unsanitized HTML rendering
3. **Missing edge function authentication** - Public API endpoints
4. **Privilege escalation** - Any user can change any profile's role

---

## Critical Vulnerabilities

### 1. Row Level Security (RLS) Policies - CRITICAL

**Location:** `supabase/migrations/20241208_001_initial_schema.sql:382-413`

**Issue:** All RLS policies are set to `FOR ALL USING (true)`, meaning any authenticated user can access ALL data across ALL offices. The comment says "for development" but this is a critical production vulnerability.

**Current Code:**
```sql
CREATE POLICY "Service role has full access to offices" ON offices
  FOR ALL USING (true);
-- ... same for all tables
```

**Impact:** Complete data breach - any authenticated user can read/modify any office's sensitive constituent data, cases, messages, etc.

**Fix:** Implement proper office-based RLS policies (see fix below).

---

### 2. Stored XSS Vulnerability - CRITICAL

**Location:** `src/components/notes/NotesSection.tsx:214,298`

**Issue:** User-generated HTML content is rendered with `dangerouslySetInnerHTML` without sanitization.

**Current Code:**
```tsx
dangerouslySetInnerHTML={{ __html: note.body }}
```

**Impact:** Attackers can inject malicious scripts that execute when other users view notes, enabling session hijacking, data theft, and account takeover.

**Fix:** Use DOMPurify to sanitize HTML before rendering.

---

### 3. Missing Edge Function Authentication - HIGH

**Location:** `supabase/functions/email-ingestion/index.ts`

**Issue:** The edge function accepts requests without verifying authentication. Anyone who knows the endpoint URL can trigger email processing.

**Current Code:**
```typescript
const body = await req.json();
const { message_id, office_id } = body;
// No auth verification
```

**Impact:** Unauthorized access to AI processing, potential DoS, data manipulation.

**Fix:** Verify JWT token or service role key in request headers.

---

### 4. Privilege Escalation - CRITICAL

**Location:** `src/lib/useSupabaseData.ts:457-473`

**Issue:** `updateProfileRole` allows ANY authenticated user to change ANY user's role to admin.

**Current Code:**
```typescript
const updateProfileRole = async (profileId: string, role: UserRole) => {
  // No verification that:
  // 1. Current user is an admin
  // 2. Target profile is in same office
  const { data, error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', profileId)
    // ...
```

**Impact:** Any user can escalate privileges to admin, gaining full system access.

**Fix:** Add admin role check and office verification.

---

### 5. Weak HTML Sanitization - HIGH

**Location:** `supabase/functions/_shared/utils.ts:113-120`

**Issue:** The `sanitizeHtml` function only removes `<script>` tags and `onX` event handlers, missing many XSS vectors.

**Current Code:**
```typescript
export function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '');
}
```

**Bypasses:**
- `<img src=x onerror=alert(1)>` (onX without quotes)
- `<a href="javascript:alert(1)">` (javascript: URLs)
- `<svg onload=alert(1)>` (SVG events)
- `<iframe src="data:text/html,<script>alert(1)</script>">` (data URIs)
- `<style>body{background:url('javascript:...')}</style>` (CSS injection)

**Fix:** Use a proper sanitization library (DOMPurify for frontend, sanitize-html for backend).

---

### 6. Overly Permissive CORS - MEDIUM

**Location:** `supabase/functions/_shared/utils.ts:6-10`

**Issue:** CORS headers allow all origins.

**Current Code:**
```typescript
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  // ...
};
```

**Impact:** Any website can make authenticated requests to the API if credentials are included.

**Fix:** Restrict to known application domains.

---

### 7. Missing Input Validation - HIGH

**Location:** Multiple edge functions

**Issue:** No validation of UUID format, input lengths, or data types.

**Impact:** SQL injection risk (though mitigated by Supabase), malformed data processing, potential crashes.

**Fix:** Add Zod or similar schema validation.

---

### 8. Insecure RPC Functions - HIGH

**Location:** `supabase/migrations/20241208_002_rpc_functions.sql`

**Issue:** RPC functions use `SECURITY DEFINER` without authorization checks.

**Current Code:**
```sql
CREATE OR REPLACE FUNCTION increment_campaign_count(campaign_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE campaigns SET email_count = email_count + 1 WHERE id = campaign_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Impact:** Any authenticated user can increment counters, manipulate queue status, or call privileged functions.

**Fix:** Add authorization checks within functions or use `SECURITY INVOKER` with proper RLS.

---

### 9. API Key in URL - MEDIUM

**Location:** `supabase/functions/_shared/gemini.ts:64`

**Issue:** Gemini API key is passed in URL query string.

```typescript
`${GEMINI_API_URL}/${MODEL_NAME}:generateContent?key=${apiKey}`
```

**Impact:** API key may be logged in server logs, browser history, referrer headers.

**Fix:** Google's API supports this format, but consider using x-goog-api-key header.

---

### 10. Weak Fingerprint Hash - LOW

**Location:** `supabase/functions/_shared/gemini.ts:398-415`

**Issue:** Uses a simple hash function for campaign fingerprinting that is prone to collisions.

```typescript
// Comment says: "for demo - in production use proper crypto"
let hash = 0;
for (let i = 0; i < normalized.length; i++) {
  hash = ((hash << 5) - hash) + char;
}
```

**Fix:** Use SHA-256 or similar cryptographic hash.

---

### 11. Missing Rate Limiting - HIGH

**Issue:** No rate limiting on:
- Login attempts (brute force vulnerability)
- Edge function calls (DoS vulnerability)
- API requests (resource exhaustion)

**Fix:** Implement rate limiting via Supabase/Cloudflare or edge function middleware.

---

### 12. Service Role Key in Database Settings - HIGH

**Location:** `supabase/migrations/20241208_002_rpc_functions.sql:49`

**Issue:** Service role key stored in database settings for webhook trigger.

```sql
service_role_key := current_setting('app.settings.service_role_key', true);
```

**Impact:** If database is compromised, service role key is exposed.

**Fix:** Use Supabase Vault for secrets or environment variables only accessible to edge functions.

---

### 13. Missing CSRF Protection - MEDIUM

**Issue:** While Supabase Auth handles CSRF for auth endpoints, custom API calls don't verify CSRF tokens.

**Fix:** Implement CSRF token verification for state-changing operations.

---

### 14. Missing Security Headers - MEDIUM

**Issue:** No security headers configured:
- Content-Security-Policy (CSP)
- X-Frame-Options
- X-Content-Type-Options
- Strict-Transport-Security

**Fix:** Configure headers in deployment (Netlify/Vercel) or via meta tags.

---

### 15. Sensitive Data Logging - LOW

**Location:** Multiple files with `console.error`

**Issue:** Full error objects logged which may contain sensitive data.

```typescript
console.error('Error creating case:', insertError);
```

**Fix:** Sanitize error messages before logging.

---

### 16. No Input Length Limits - MEDIUM

**Issue:** No maximum length validation on:
- Email body content
- Note content
- Message subjects

**Impact:** Potential DoS through storage exhaustion.

**Fix:** Add length constraints at database and application level.

---

### 17. IDOR in Update Functions - HIGH

**Location:** `src/lib/useSupabaseData.ts`

**Issue:** Update functions don't verify office ownership:
- `updateCase` (line 285)
- `updateTag` (line 495)
- `deleteTag` (line 513)

**Impact:** Users can modify resources belonging to other offices.

**Fix:** Add office_id verification to all mutations.

---

## Remediation Priority

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| P0 | RLS Policies | Medium | Critical |
| P0 | Privilege Escalation | Low | Critical |
| P0 | XSS Vulnerabilities | Low | Critical |
| P1 | Edge Function Auth | Medium | High |
| P1 | RPC Function Security | Medium | High |
| P1 | Input Validation | Medium | High |
| P1 | IDOR Vulnerabilities | Low | High |
| P2 | Rate Limiting | Medium | High |
| P2 | CORS Configuration | Low | Medium |
| P2 | HTML Sanitization | Low | Medium |
| P2 | Security Headers | Low | Medium |
| P3 | Weak Hash Function | Low | Low |
| P3 | API Key in URL | Low | Medium |
| P3 | Sensitive Logging | Low | Low |

---

## Recommended Immediate Actions

1. **URGENT:** Deploy proper RLS policies before any production use
2. **URGENT:** Add admin role verification to `updateProfileRole`
3. **URGENT:** Install and use DOMPurify for HTML rendering
4. **HIGH:** Add JWT verification to edge functions
5. **HIGH:** Add input validation with Zod schemas

---

## Files Modified in This Audit Fix

- `supabase/migrations/20241212_security_rls_policies.sql` - New proper RLS policies
- `src/lib/useSupabaseData.ts` - Added authorization checks
- `src/components/notes/NotesSection.tsx` - Added DOMPurify sanitization
- `supabase/functions/_shared/utils.ts` - Improved sanitization and validation
- `supabase/functions/email-ingestion/index.ts` - Added authentication
- `src/lib/security.ts` - New security utility functions

