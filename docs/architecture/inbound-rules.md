# Inbound Rules Feature Architecture

> **Status**: Draft - Pending Review
> **Date**: 2024-12-17
> **Purpose**: Inbox triage automation - automatically proposing tags, assignees, and categorization for incoming emails

---

## Overview

The Inbound Rules feature adds a **deterministic rule layer** on top of the existing AI-powered email processing. This gives users explicit control over email processing with predictable, auditable behavior.

### Key Distinction

| Layer | Description | Example |
|-------|-------------|---------|
| **AI Automation** (existing) | Smart suggestions based on content analysis | "This looks like a housing complaint, suggesting Housing tag" |
| **Inbound Rules** (new) | "If X then always do Y" - user-controlled, predictable | "If subject contains 'housing', always assign to Sarah" |

---

## Feature Requirements

### 1. Rule Definition

Users create rules with three components:

- **Conditions** - When to trigger (sender, subject, body content, etc.)
- **Actions** - What to do (assign, tag, prioritize, categorize, etc.)
- **Priority/Order** - Rules execute in defined order

### 2. Rule Execution Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| **Before AI** | Rule fires first, AI processes after | Pre-filter known senders before AI analysis |
| **After AI** | AI processes first, rule overrides/supplements | Correct AI mistakes or add extra tags |
| **Instead of AI** | Rule bypasses AI entirely | High-volume known patterns (skip AI costs) |

### 3. Available Actions

| Action | Description | Value Type |
|--------|-------------|------------|
| `assign_to` | Auto-assign to specific team member | User ID |
| `apply_tag` | Add one or more tags | Tag ID(s) |
| `set_priority` | Set priority level | `low` / `medium` / `high` / `urgent` |
| `categorize` | Mark as policy or casework | `policy` / `casework` |
| `link_to_case` | Add to existing case by reference pattern | Case ID or pattern |
| `skip_triage` | Mark as not needing human review | Boolean |
| `mark_spam` | Flag as spam or auto-reject | Boolean |
| `skip_ai` | Don't run AI classification | Boolean |

### 4. Available Conditions

| Field | Operators | Example |
|-------|-----------|---------|
| `sender_email` | equals, contains, ends_with | `ends_with @parliament.uk` |
| `sender_name` | equals, contains | `contains "Council"` |
| `sender_domain` | equals | `equals gmail.com` |
| `subject` | contains, starts_with, regex | `contains "housing"` |
| `body` | contains, regex | `regex "reference:?\s*\d+"` |
| `has_attachment` | is_true, is_false | `is_true` |
| `attachment_type` | equals | `equals pdf` |
| `is_known_constituent` | is_true, is_false | `is_true` |
| `ai_classification` | equals | `equals policy` (after-AI rules only) |
| `ai_confidence` | less_than, greater_than | `less_than 0.7` (after-AI rules only) |

---

## User Interface Design

### Main Rules List View

```
┌─────────────────────────────────────────────────────────────┐
│ Inbound Rules                              [+ New Rule]     │
│ Configure automated rules for processing incoming messages  │
├─────────────────────────────────────────────────────────────┤
│ ☰ 1. Housing emails → Sarah                    [ON]  [⋮]   │
│    When: Subject contains "housing" OR "rent"              │
│    Then: Assign to Sarah, Add tag "Housing"                │
├─────────────────────────────────────────────────────────────┤
│ ☰ 2. Known MPs → Priority High                 [ON]  [⋮]   │
│    When: Sender domain ends with "parliament.uk"           │
│    Then: Set priority High, Add tag "Parliamentary"        │
├─────────────────────────────────────────────────────────────┤
│ ☰ 3. Benefits casework → John                  [OFF] [⋮]   │
│    When: Body contains "universal credit" OR "benefits"    │
│    Then: Assign to John, Categorize as Casework            │
└─────────────────────────────────────────────────────────────┘
│ ☰ = drag to reorder    [⋮] = edit/delete/duplicate         │
```

**UI Elements Required:**
- Drag-and-drop reordering (for rule priority)
- Enable/disable toggle per rule
- Overflow menu with Edit, Delete, Duplicate options
- Visual summary of conditions and actions
- Empty state with "Create Your First Rule" CTA

### Rule Editor (Dialog/Slide-over)

```
┌─────────────────────────────────────────────────────────────┐
│ Create Rule                                         [×]     │
├─────────────────────────────────────────────────────────────┤
│ Rule Name: [Housing emails to Sarah____________]            │
│                                                             │
│ ─── WHEN (Conditions) ───────────────────────────────────── │
│ Match: (•) ALL conditions  ( ) ANY condition                │
│                                                             │
│ ┌─────────────────────────────────────────────────────┐     │
│ │ [Subject ▼] [contains ▼] [housing        ] [×]     │     │
│ └─────────────────────────────────────────────────────┘     │
│ ┌─────────────────────────────────────────────────────┐     │
│ │ [Subject ▼] [contains ▼] [rent           ] [×]     │     │
│ └─────────────────────────────────────────────────────┘     │
│ [+ Add condition]                                           │
│                                                             │
│ ─── THEN (Actions) ─────────────────────────────────────── │
│ ┌─────────────────────────────────────────────────────┐     │
│ │ [Assign to ▼]     [Sarah Johnson ▼]         [×]    │     │
│ └─────────────────────────────────────────────────────┘     │
│ ┌─────────────────────────────────────────────────────┐     │
│ │ [Apply tag ▼]     [Housing ▼]               [×]    │     │
│ └─────────────────────────────────────────────────────┘     │
│ [+ Add action]                                              │
│                                                             │
│ ─── OPTIONS ──────────────────────────────────────────────  │
│ Run: ( ) Before AI  (•) After AI  ( ) Instead of AI         │
│ □ Stop processing more rules after this one matches         │
│                                                             │
│                            [Cancel]  [Save Rule]            │
└─────────────────────────────────────────────────────────────┘
```

**UI Elements Required:**
- Text input for rule name
- Radio group for match mode (ALL/ANY)
- Dynamic condition rows with field/operator/value selects
- Dynamic action rows with action type and value selects
- Radio group for execution mode
- Checkbox for "stop processing"
- Cancel and Save buttons

### Global Settings Section

```
┌─────────────────────────────────────────────────────────────┐
│ Rule Processing Settings                                    │
├─────────────────────────────────────────────────────────────┤
│ Default behavior when no rules match:                       │
│ (•) Continue with AI processing                             │
│ ( ) Mark for manual triage only                             │
│                                                             │
│ □ Log all rule matches to audit trail                       │
│ □ Notify admin when rules are modified                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### New Tables

```sql
-- Inbound rules table
CREATE TABLE inbound_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_enabled BOOLEAN DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,  -- Lower number = runs first
  match_mode TEXT NOT NULL DEFAULT 'all' CHECK (match_mode IN ('all', 'any')),
  execution_mode TEXT NOT NULL DEFAULT 'after_ai'
    CHECK (execution_mode IN ('before_ai', 'after_ai', 'instead_of_ai')),
  stop_processing BOOLEAN DEFAULT false,  -- Stop further rules if matched
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Rule conditions (one-to-many with inbound_rules)
CREATE TABLE inbound_rule_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES inbound_rules(id) ON DELETE CASCADE,
  field TEXT NOT NULL,  -- 'sender_email', 'sender_domain', 'subject', 'body', etc.
  operator TEXT NOT NULL,  -- 'equals', 'contains', 'starts_with', 'ends_with', 'regex', 'is_true'
  value TEXT,  -- The value to compare (null for boolean operators like is_true)
  is_case_sensitive BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Rule actions (one-to-many with inbound_rules)
CREATE TABLE inbound_rule_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES inbound_rules(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,  -- 'assign_to', 'apply_tag', 'set_priority', 'categorize', etc.
  action_value TEXT,  -- User ID, tag ID, priority value, etc.
  action_config JSONB,  -- Additional configuration if needed
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Rule execution log (for audit and debugging)
CREATE TABLE inbound_rule_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES inbound_rules(id) ON DELETE SET NULL,
  rule_name TEXT,  -- Denormalized for when rule is deleted
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  matched BOOLEAN NOT NULL,
  conditions_evaluated JSONB,  -- Which conditions were checked
  actions_taken JSONB,  -- What actions were executed
  execution_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_inbound_rules_office ON inbound_rules(office_id);
CREATE INDEX idx_inbound_rules_priority ON inbound_rules(office_id, priority) WHERE is_enabled = true;
CREATE INDEX idx_inbound_rule_conditions_rule ON inbound_rule_conditions(rule_id);
CREATE INDEX idx_inbound_rule_actions_rule ON inbound_rule_actions(rule_id);
CREATE INDEX idx_inbound_rule_log_message ON inbound_rule_log(message_id);
CREATE INDEX idx_inbound_rule_log_office ON inbound_rule_log(office_id, created_at DESC);
```

### Row Level Security (RLS)

```sql
-- Enable RLS
ALTER TABLE inbound_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_rule_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_rule_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_rule_log ENABLE ROW LEVEL SECURITY;

-- Policies for inbound_rules
CREATE POLICY "Users can view rules in their office"
  ON inbound_rules FOR SELECT
  USING (office_id = (SELECT office_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can insert rules"
  ON inbound_rules FOR INSERT
  WITH CHECK (
    office_id = (SELECT office_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Admins can update rules"
  ON inbound_rules FOR UPDATE
  USING (
    office_id = (SELECT office_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Admins can delete rules"
  ON inbound_rules FOR DELETE
  USING (
    office_id = (SELECT office_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- Similar policies for conditions and actions (cascade from rule access)
-- Similar policies for rule_log (read-only for all office users)
```

---

## Integration with Email Ingestion

### Modified Processing Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                    Email Received                           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Fetch "before_ai" rules                        │
│              Execute matching rules                         │
│              (May set skip_ai = true)                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              AI Processing (if not skipped)                 │
│              - Classification                               │
│              - Tag suggestions                              │
│              - Assignment suggestions                       │
│              - Draft response generation                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Fetch "after_ai" rules                         │
│              Execute matching rules                         │
│              (May override AI decisions)                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Fetch "instead_of_ai" rules                    │
│              (Only if AI was skipped)                       │
│              Execute matching rules                         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Apply final results to message                 │
│              Log rule executions                            │
│              Update message record                          │
└─────────────────────────────────────────────────────────────┘
```

### Rule Evaluation Function (Pseudocode)

```typescript
interface RuleEvaluationResult {
  matched: boolean;
  rule_id: string;
  actions_to_apply: Action[];
  stop_processing: boolean;
}

async function evaluateRules(
  message: Message,
  rules: InboundRule[],
  aiResults?: AIProcessingResult
): Promise<RuleEvaluationResult[]> {
  const results: RuleEvaluationResult[] = [];

  for (const rule of rules.sort((a, b) => a.priority - b.priority)) {
    if (!rule.is_enabled) continue;

    const matched = evaluateConditions(message, rule.conditions, rule.match_mode, aiResults);

    if (matched) {
      results.push({
        matched: true,
        rule_id: rule.id,
        actions_to_apply: rule.actions,
        stop_processing: rule.stop_processing
      });

      if (rule.stop_processing) break;
    }
  }

  return results;
}

function evaluateConditions(
  message: Message,
  conditions: Condition[],
  matchMode: 'all' | 'any',
  aiResults?: AIProcessingResult
): boolean {
  const evaluations = conditions.map(c => evaluateCondition(message, c, aiResults));

  return matchMode === 'all'
    ? evaluations.every(Boolean)
    : evaluations.some(Boolean);
}
```

---

## Open Questions for Product Decision

### 1. Rule Execution Timing
- **Option A**: Synchronous during email ingestion (blocking, immediate)
- **Option B**: Asynchronous after ingest (non-blocking, slight delay)
- **Recommendation**: Synchronous for rules, since they're typically fast pattern matches

### 2. Rule Priority vs "All Match"
- **Option A**: First matching rule wins (like email filters)
- **Option B**: All matching rules apply in sequence (actions stack)
- **Option C**: User chooses per-rule (the "stop processing" checkbox)
- **Recommendation**: Option C - most flexible

### 3. Conflict Resolution
When Rule 1 assigns to Sarah and Rule 2 assigns to John:
- **Option A**: Last rule wins
- **Option B**: First rule wins
- **Option C**: Error/warn user
- **Option D**: Don't allow conflicting actions
- **Recommendation**: Option A (last wins) - simple and predictable with rule ordering

### 4. AI Interaction
- Should rules override AI decisions? **Recommended: Yes**
- Should rules use AI outputs as conditions? **Recommended: Yes (for after_ai rules)**

### 5. Scope
- **Casework mode only?** No
- **Westminster mode only?** No
- **Both modes?** Yes - rules are office-scoped, work in both modes
- Mode-specific behavior can be achieved via conditions

### 6. Advanced Features (V2 Candidates)
- [ ] Rule templates - Pre-built rules for common scenarios
- [ ] Testing mode - Run rule against recent emails without applying
- [ ] Import/export - Share rules between offices
- [ ] Time-based rules - Only active during certain hours/dates
- [ ] Webhook actions - Trigger external integrations

### 7. Permissions
- **Who can create/edit rules?** Admin only (recommended for V1)
- **Approval workflow?** Not for V1, consider for V2

---

## Implementation Phases

### Phase 1: Core Infrastructure
1. Create database migration with new tables
2. Add RLS policies
3. Create TypeScript types in `database.types.ts`
4. Add CRUD functions to `useSupabaseData.ts`

### Phase 2: Rule Evaluation Engine
1. Create rule evaluation logic in edge function
2. Integrate with existing `email-ingestion` function
3. Add rule logging

### Phase 3: UI Implementation
1. Update `InboundRulesPage.tsx` with rule list
2. Create rule editor dialog component
3. Add drag-and-drop reordering
4. Add global settings section

### Phase 4: Testing & Polish
1. Add unit tests for rule evaluation
2. Add integration tests for email processing
3. Add UI tests for rule management
4. Performance optimization for rule matching

---

## File Locations

| Component | Path |
|-----------|------|
| Page | `src/pages/casework/InboundRulesPage.tsx` |
| Rule Editor Component | `src/components/rules/RuleEditor.tsx` (new) |
| Rule List Component | `src/components/rules/RuleList.tsx` (new) |
| Database Types | `src/lib/database.types.ts` |
| Data Hook | `src/lib/useSupabaseData.ts` |
| Edge Function | `supabase/functions/email-ingestion/index.ts` |
| Migration | `supabase/migrations/YYYYMMDD_inbound_rules.sql` |

---

## Related Documentation

- [Email Ingestion Edge Function](../supabase/functions/README.md)
- [Database Schema](../supabase/migrations/)
- [Settings Page](../src/pages/SettingsPage.tsx)
