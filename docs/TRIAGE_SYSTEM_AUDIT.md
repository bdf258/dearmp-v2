# Comprehensive Triage System Audit Report

**Date:** 2026-01-03
**Branch:** `claude/audit-triage-process-ZIm0c`

## Executive Summary

The triage system is well-architected with a clean layered design (Domain → Application → Infrastructure → Presentation). However, there are several issues ranging from **critical bugs** to **missing features** that need attention.

---

## 🔴 CRITICAL ISSUES

### 1. Incomplete Batch Prefetch - Missing Email Lookup

**Location:** `server/src/infrastructure/queue/handlers/TriageJobHandler.ts:749-758`

```typescript
// Lines 755-756: Uses hardcoded dummy values
emailExternalId: 0, // Would be looked up
fromAddress: '', // Would be looked up
```

**Impact:** Prefetch jobs are scheduled with `emailExternalId: 0` and empty `fromAddress`, causing the `handleProcessEmail` job to fail silently or produce incorrect results since it can't fetch the email from the legacy API.

**Fix Required:** Implement email lookup before scheduling prefetch jobs.

---

### 2. Type Safety Issue - Unsafe Cast of LLM Response

**Location:** `server/src/infrastructure/queue/handlers/TriageJobHandler.ts:280`

```typescript
const parsedSuggestion = llmDebug?.parsedSuggestion as TriageSuggestionDto | undefined;
```

**Impact:** The `parsedSuggestion` field in `LLMDebugInfo` is typed as `unknown` (see `server/src/infrastructure/queue/types.ts`). Casting without validation could cause runtime errors if the LLM response structure changes.

**Fix Required:** Add type guard validation before casting.

---

### 3. TODO: ProcessEmail Use Case Has Stub LLM Analysis

**Location:** `server/src/application/use-cases/triage/ProcessEmail.ts:166`

```typescript
// TODO: Build full TriageContextDto when LLM service is ready
return {
  urgency: 'medium',
  summary: email.subject || 'No subject',
};
```

**Impact:** The `ProcessEmail` use case always returns a stub suggestion, never calling the LLM. While `TriageJobHandler` has proper LLM integration, this use case is incomplete.

**Status:** This appears to be dead code since triage goes through `TriageJobHandler`, but should be removed or completed.

---

## 🟠 IMPORTANT ISSUES

### 4. In-Memory Cache Lost on Restart

**Location:** `server/src/worker.ts:253-303`

```typescript
class SupabaseTriageCacheRepository {
  private cache: Map<string, TriageCacheData> = new Map();
  // ... in-memory only
}
```

**Impact:** When the worker restarts, all prefetched triage suggestions are lost and must be recomputed. This wastes LLM API calls and degrades user experience.

**Fix Required:** Use Redis or persist to the `triage_suggestions` table (which exists but isn't used for cache retrieval).

---

### 5. Naive FIFO Cache Eviction

**Location:** `server/src/worker.ts:260-265`

```typescript
if (this.cache.size >= this.MAX_CACHE_SIZE) {
  const oldestKey = this.cache.keys().next().value;
  if (oldestKey) {
    this.cache.delete(oldestKey);
  }
}
```

**Impact:** FIFO eviction removes the oldest entry, not the least-recently-used. Frequently accessed entries could be evicted while rarely-used entries remain.

**Fix Required:** Implement LRU eviction using a doubly-linked list or use a library like `lru-cache`.

---

### 6. No Timeout on Legacy API Calls

**Location:** `server/src/application/services/TriageService.ts`

All `legacyApiClient` calls lack timeout handling:

```typescript
const legacyMatches = await this.legacyApiClient.findConstituentMatches(officeId, { email: senderEmail });
```

**Impact:** If the legacy API becomes unresponsive, triage processing hangs indefinitely.

**Fix Required:** Add configurable timeout with fallback.

---

### 7. Missing Case Existence Validation

**Location:** `server/src/infrastructure/queue/handlers/TriageJobHandler.ts:675`

```typescript
private async handleAddToCase(office: OfficeId, emailId: string, emailExternalId: number, decision): Promise<void> {
  if (!decision.caseId) {
    throw new Error('Case ID required for add_to_case action');
  }
  // No validation that caseId exists before linking!
  const caseEntity = await this.caseRepo.findById(office, decision.caseId);
}
```

**Impact:** The code proceeds to link an email to a potentially non-existent case, which would fail with a confusing error.

**Fix Required:** Check case existence before attempting to link.

---

## 🟡 MODERATE ISSUES

### 8. Duplicate RPC Functions for Triage

There are two parallel sets of triage RPC functions:

| Public Schema (`20241218000003_triage_state.sql`) | Legacy Schema (`20241221000001_legacy_rpc_functions.sql`) |
|---------------------------------------------------|----------------------------------------------------------|
| `confirm_triage` | `confirm_legacy_triage` |
| `dismiss_triage` | `dismiss_legacy_triage` |
| `get_triage_queue` | `get_legacy_triage_queue` |
| `get_triage_stats` | `get_legacy_triage_stats` |

**Impact:** Confusion about which functions to use. The frontend hooks use the public schema functions while the API routes fall back to the legacy ones.

**Fix Required:** Consolidate to a single set or document the distinction clearly.

---

### 9. Simplistic Rule-Based Suggestion Algorithm

**Location:** `server/src/application/services/TriageService.ts:572-587`

```typescript
// Simple word overlap check
const subjectWords = new Set(subjectLower.split(/\s+/).filter(w => w.length > 3));
const summaryWords = summaryLower.split(/\s+/).filter(w => w.length > 3);
const overlap = summaryWords.filter(w => subjectWords.has(w)).length;
if (overlap >= 2) {
  suggestion.summary = `Related to: ${existingCase.summary}`;
}
```

**Impact:** False positives for case matching. Two-word overlap is a weak signal.

**Fix Required:** Use TF-IDF or semantic similarity when LLM is unavailable.

---

### 10. Frontend Hook Has Incorrect useState Usage

**Location:** `src/hooks/triage/useTriage.ts:748-750`

```typescript
// Auto-fetch when messageId changes
useState(() => {
  fetchBody();
});
```

**Impact:** `useState` with a function initializer is incorrect here - it should be `useEffect`. This means `fetchBody()` only runs once on mount, not when `messageId` changes.

**Fix Required:** Change to `useEffect(() => { fetchBody(); }, [messageId]);`

---

### 11. Missing user_decision_by in Frontend Update

**Location:** `src/hooks/triage/useTriage.ts:842-848`

```typescript
const { error: updateError } = await supabase.from('triage_suggestions')
  .update({
    user_decision: decision,
    user_decision_at: new Date().toISOString(),
    user_modifications: (modifications as Json) || null,
    // Missing: user_decision_by: auth.uid()
  })
```

**Impact:** User decision tracking is incomplete - we don't know who made the decision.

**Fix Required:** Add `user_decision_by` to the update.

---

### 12. Silent Error Swallowing in Campaign Emails

**Location:** `src/hooks/triage/useTriage.ts:1072-1076`

```typescript
} catch (err) {
  console.error('Failed to confirm email:', err);
  // Error not propagated to UI
}
```

**Impact:** Users don't see feedback when operations fail.

**Fix Required:** Return error state or throw for UI handling.

---

## 🔵 MINOR ISSUES / IMPROVEMENTS

### 13. Gemini Timeout Not Implemented

**Location:** `server/src/infrastructure/llm/GeminiLLMService.ts:211-213`

```typescript
// Note: config.timeoutMs is accepted but not currently used
// Future implementation could use AbortController for request timeout
```

**Impact:** LLM calls could hang indefinitely if Gemini is slow.

---

### 14. Address Pattern Regex is UK-Centric

**Location:** `src/hooks/triage/useTriage.ts:153-154`

```typescript
const addressPattern = /\b\d+\s+[\w\s]+(?:street|road|lane|avenue|drive|close|way|place)\b/i;
```

**Impact:** Won't match non-UK address formats.

---

### 15. Missing Campaign Matching in LLM Context

**Location:** `server/src/infrastructure/queue/handlers/TriageJobHandler.ts:435`

```typescript
matchedCampaigns: [], // Would need campaign matching
```

**Impact:** LLM doesn't receive campaign context for better suggestions.

---

### 16. Tags Always Empty in Reference Data

**Location:** `server/src/infrastructure/queue/handlers/TriageJobHandler.ts:416`

```typescript
tags: [], // Tags would come from Supabase
```

**Impact:** LLM can't suggest tags because it never receives them.

---

## 📊 DATABASE SCHEMA OBSERVATIONS

### Tables Present

1. `public.triage_suggestions` - ✅ Complete with full LLM debug storage
2. `public.messages` with triage columns - ✅ Has `triage_status`, `triaged_at`, `confirmed_at`, etc.
3. `legacy.emails` - ✅ Used for shadow data from legacy system

### RPC Functions Present

1. `confirm_triage` / `confirm_legacy_triage` - ✅ Working
2. `dismiss_triage` / `dismiss_legacy_triage` - ✅ Working
3. `get_triage_queue` / `get_legacy_triage_queue` - ✅ Working
4. `get_triage_stats` / `get_legacy_triage_stats` - ✅ Working
5. `mark_as_triaged` - ✅ For AI processing
6. `save_triage_suggestion` - ✅ For persisting LLM results
7. `get_triage_suggestion` - ✅ For retrieving suggestions
8. `mark_test_email_processed` - ✅ For test workflow

### Missing/Incomplete

1. **No RPC for recording user decision** - Frontend does direct table update instead of using an RPC
2. **No cleanup job for old suggestions** - `triage_suggestions` will grow unbounded

---

## 🎯 PRIORITIZED FIX RECOMMENDATIONS

| Priority | Issue | Effort | Description |
|----------|-------|--------|-------------|
| P0 | #1 | Medium | Fix batch prefetch email lookup |
| P0 | #2 | Low | Add type validation for LLM response |
| P1 | #4 | Medium | Implement persistent cache |
| P1 | #6 | Low | Add legacy API timeouts |
| P1 | #10 | Low | Fix useState → useEffect |
| P2 | #5 | Medium | Implement LRU cache eviction |
| P2 | #7 | Low | Add case existence validation |
| P2 | #11 | Low | Add user_decision_by |
| P3 | #3 | Low | Remove/complete ProcessEmail TODO |
| P3 | #8 | Medium | Consolidate duplicate RPCs |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                          │
├─────────────────────────────────────────────────────────────┤
│ useTriage.ts hooks ──> useTriageQueue, useTriageActions     │
│ TriageWorkspace.tsx ──> TriageMessage UI Components         │
│ CampaignDashboard.tsx ──> Campaign-specific triage          │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP/RPC
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   SUPABASE (Database + RPC)                 │
├─────────────────────────────────────────────────────────────┤
│ Tables: messages, triage_suggestions, constituents, cases   │
│ RPC Functions:                                               │
│   - confirm_triage() ──────────────┐                        │
│   - dismiss_triage() ──────────────┤ TRIAGE ACTIONS        │
│   - get_triage_queue() ────────────┤                        │
│   - get_triage_stats() ────────────┤                        │
│   - get_triage_suggestion() ───────┘                        │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP/REST
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              EXPRESS API SERVER (index.ts)                  │
├─────────────────────────────────────────────────────────────┤
│ Routes:                                                       │
│  GET /triage/queue                                           │
│  GET /triage/email/:id                                       │
│  POST /triage/confirm                                        │
│  POST /triage/dismiss                                        │
│  POST /triage/process                                        │
│  POST /triage/batch-prefetch                                 │
└──────────────────────┬──────────────────────────────────────┘
                       │ pg-boss Queue
                       ▼
┌─────────────────────────────────────────────────────────────┐
│            PG-BOSS QUEUE WORKER (worker.ts)                │
├─────────────────────────────────────────────────────────────┤
│ Jobs:                                                        │
│  1. TRIAGE_PROCESS_EMAIL                                    │
│     - Fetch, match constituent, find cases, call LLM        │
│  2. TRIAGE_SUBMIT_DECISION                                  │
│     - Create/link case, create constituent                  │
│  3. TRIAGE_BATCH_PREFETCH                                   │
│     - Schedule processing for multiple emails               │
│                                                             │
│ Cache: SupabaseTriageCacheRepository (in-memory, 1h TTL)   │
└──────────────────────┬──────────────────────────────────────┘
                       │ Calls
                       ▼
┌─────────────────────────────────────────────────────────────┐
│          SERVICE LAYER (TriageService)                      │
├─────────────────────────────────────────────────────────────┤
│ - enrichEmailForTriage()                                    │
│ - matchConstituent() ─► Legacy API or local DB             │
│ - matchCampaigns() ─► Fingerprint/subject match            │
│ - getOpenCasesForConstituent()                             │
│ - buildTriageContext() ─► For LLM                          │
│ - analyzeEmail() ─► LLM or rule-based suggestion           │
│ - submitTriageDecision() ─► Create/link entities           │
└────────────────────────────────────────────────────────────┘
```

---

## Files Analyzed

### Backend
- `server/src/infrastructure/queue/handlers/TriageJobHandler.ts`
- `server/src/application/services/TriageService.ts`
- `server/src/application/use-cases/triage/ProcessEmail.ts`
- `server/src/presentation/http/routes/triage.ts`
- `server/src/infrastructure/llm/GeminiLLMService.ts`
- `server/src/application/dtos/TriageContextDto.ts`
- `server/src/worker.ts`

### Frontend
- `src/hooks/triage/useTriage.ts`
- `src/lib/triage-api.types.ts`

### Database Migrations
- `supabase/migrations/20241218000003_triage_state.sql`
- `supabase/migrations/20250102000002_mark_test_email_processed_rpc.sql`
- `supabase/migrations/20250102000003_triage_suggestions_table.sql`
- `supabase/migrations/20241221000001_legacy_rpc_functions.sql`

---

## Conclusion

The triage system architecture is sound with proper separation of concerns. The critical issues (#1, #2) should be addressed immediately as they affect core functionality. The important issues (#4-#7) should be prioritized for the next sprint to improve reliability and user experience.
