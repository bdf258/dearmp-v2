# Technical Debt Analysis: Dummy Data & Prototype Logic

This document identifies all instances of dummy data usage and prototype/sample logic in the codebase that need to be properly implemented.

## Table of Contents
1. [Dummy Data Usage](#dummy-data-usage)
2. [Prototype Logic & Placeholders](#prototype-logic--placeholders)
3. [Implementation Priority](#implementation-priority)

---

## Dummy Data Usage

### Overview
The codebase currently has two parallel data systems:
- `useDummyData()` - For dummy/development data
- `useSupabaseData()` - For production/real data (currently the primary system)

### Files Using Dummy Data

| File Path | Usage Type | Current Functionality | Migration Required |
|-----------|------------|----------------------|-------------------|
| `/src/data/dummyData.json` | Data Source | 840 lines of sample data including offices, users, constituents, organizations, cases, campaigns, messages, tags, approval queue items, notes | Can be archived/removed once all components migrated |
| `/src/lib/useDummyData.ts` | Hook/Utility | React hook that loads and exposes dummy data with TypeScript interfaces, office filtering, and helper functions | Replace all imports with `useSupabaseData` |
| `/src/components/notes/NotesSection.tsx` | Active Consumer | Line 310: Uses `useDummyData()` for notes, users, and ID helpers. Manages notes display, creation, and replies | **Replace with Supabase queries** |

### Detailed Migration Tasks

#### 1. NotesSection Component (High Priority)

**File:** `/src/components/notes/NotesSection.tsx:310`

**Current Implementation:**
```typescript
const { notes, users, getCurrentUserId, getMyOfficeId } = useDummyData();
```

**Required Changes:**
- Replace `useDummyData()` with Supabase queries for notes
- Query notes by context (caseId, campaignId, or threadId)
- Fetch user information from Supabase users table
- Implement proper note creation with database inserts
- Implement reply creation with database inserts
- Use Supabase auth for `getCurrentUserId()`
- Use user's office relationship for `getMyOfficeId()`
- Add real-time subscriptions for collaborative note updates
- Handle optimistic updates for better UX

**Database Schema Requirements:**
- `notes` table with columns: id, content, created_at, created_by, office_id, case_id, campaign_id, thread_id
- `note_replies` table with columns: id, note_id, content, created_at, created_by
- Foreign key relationships to users, cases, campaigns, messages tables

---

#### 2. useDummyData Hook (Medium Priority - Remove after migration)

**File:** `/src/lib/useDummyData.ts`

**Action Required:**
- Once NotesSection is migrated, this entire file can be removed
- Ensure no other imports exist in the codebase
- Archive `dummyData.json` or move to `/tests/fixtures/` for testing purposes only

---

## Prototype Logic & Placeholders

### Alert() Calls

| File Path | Line | Context | Type | Proper Implementation Required |
|-----------|------|---------|------|-------------------------------|
| `/src/pages/mp/MPApprovalPage.tsx` | 123 | Error handling for approval process failure | ✅ **Legitimate** | None - this is proper error notification |

### Console.log Placeholder Functions (CRITICAL MISSING FUNCTIONALITY)

| File Path | Line | Function Name | Triggered By | Current Behavior | Proper Implementation Required |
|-----------|------|---------------|--------------|------------------|-------------------------------|
| `/src/pages/casework/TriagePage.tsx` | 53 | `handleAssignToUser` | Dropdown: "Assign to [User]" | Logs message ID and user ID | Update `messages` table in Supabase, set `assigned_to` field, remove from triage queue, show success feedback |
| `/src/pages/casework/TriagePage.tsx` | 57 | `handleAddTag` | Dropdown: "Add Tag" | Logs message ID | Open tag selection dialog, create message-tag relationship in DB, update UI to show tag |
| `/src/pages/casework/TriagePage.tsx` | 61 | `handleCreateCase` | Dropdown: "Create Case" | Logs message ID | Create case record in DB, link message to case, navigate to case detail page, remove from triage |
| `/src/pages/casework/TriagePage.tsx` | 66 | `handleViewMessage` | Dropdown: "View Message" | Sets state + logs | **Partial** - Fetch full message content from DB, display email body, attachments, thread history |
| `/src/pages/policy/TriagePage.tsx` | 58 | `handleAssignToUser` | Dropdown: "Assign to [User]" | Logs message ID and user ID | Update message assignment in DB, refresh triage queue, show confirmation |
| `/src/pages/policy/TriagePage.tsx` | 62 | `handleAssignToCampaign` | Dropdown: "Assign to Campaign" | Logs message ID and campaign ID | Update `campaign_id` in messages table, link to campaign, refresh both triage and campaign views |
| `/src/pages/policy/TriagePage.tsx` | 66 | `handleMarkAsCasework` | Dropdown: "Mark as Casework" | Logs message ID | Reclassify message, move to casework queue, remove from policy triage, optionally notify casework team |
| `/src/pages/policy/TriagePage.tsx` | 70 | `handleAddTag` | Dropdown: "Add Tag" | Logs message ID | Open tag selector, create message-tag relationship, update UI |
| `/src/pages/policy/PolicyEmailGroupDetailPage.tsx` | 99 | `handleGenerateResearch` | Button: "Regenerate Research" | Logs intent to generate research | Call Supabase Edge Function to invoke LLM (Gemini/Claude), analyze campaign emails, fetch Hansard records, display research results, handle loading/errors |

---

## Implementation Priority

### Priority 1 - CRITICAL (Core Workflow Blockers)

These functions block essential user workflows and should be implemented immediately:

1. **Message Assignment** (Casework & Policy Triage)
   - Files: `/src/pages/casework/TriagePage.tsx:53`, `/src/pages/policy/TriagePage.tsx:58`
   - Impact: Users cannot assign messages to team members
   - Estimated Complexity: Medium

2. **Create Case from Message** (Casework Triage)
   - File: `/src/pages/casework/TriagePage.tsx:61`
   - Impact: Cannot convert triage emails into cases (core casework function)
   - Estimated Complexity: High

3. **Assign to Campaign** (Policy Triage)
   - File: `/src/pages/policy/TriagePage.tsx:62`
   - Impact: Cannot organize policy emails by campaign
   - Estimated Complexity: Medium

### Priority 2 - HIGH (Important Features)

4. **Notes System Migration** (NotesSection)
   - File: `/src/components/notes/NotesSection.tsx:310`
   - Impact: Notes currently use dummy data, not persisted to real database
   - Estimated Complexity: High

5. **Tag Management** (Casework & Policy Triage)
   - Files: `/src/pages/casework/TriagePage.tsx:57`, `/src/pages/policy/TriagePage.tsx:70`
   - Impact: Cannot categorize or search messages by tags
   - Estimated Complexity: Medium

6. **Mark as Casework** (Policy Triage)
   - File: `/src/pages/policy/TriagePage.tsx:66`
   - Impact: Cannot reclassify misrouted emails
   - Estimated Complexity: Medium

### Priority 3 - MEDIUM (Enhanced Features)

7. **AI Research Generation** (Policy Email Groups)
   - File: `/src/pages/policy/PolicyEmailGroupDetailPage.tsx:99`
   - Impact: No AI-powered policy analysis or Hansard integration
   - Estimated Complexity: Very High

8. **View Message Enhancement** (Casework Triage)
   - File: `/src/pages/casework/TriagePage.tsx:66`
   - Impact: Message viewing is partially implemented
   - Estimated Complexity: Low

---

## Summary Statistics

| Category | Count | Status |
|----------|-------|--------|
| Dummy Data Files | 2 | ⚠️ Migration Required |
| Components Using Dummy Data | 1 | ⚠️ NotesSection needs migration |
| Prototype Console.log Functions | 8 | ❌ Not Implemented |
| Partial Implementations | 1 | ⚠️ Needs Completion |
| Legitimate Alert Calls | 1 | ✅ No Action Needed |

---

## Next Steps

1. **Phase 1:** Implement Priority 1 functions (message assignment, case creation, campaign assignment)
2. **Phase 2:** Migrate NotesSection to Supabase and implement tag management
3. **Phase 3:** Complete message viewing and reclassification features
4. **Phase 4:** Implement AI research generation with LLM integration
5. **Phase 5:** Remove `useDummyData` hook and archive dummy data files

---

**Document Created:** 2025-12-09
**Last Updated:** 2025-12-09