# Email Triage System Design Document

## Problem Statement

Office managers currently spend **4 hours every Monday** and **1 hour every other day** triaging emails. The legacy workflow involves:

1. Forwarding emails to the casework system (solved via Cloudflare worker + inbox automation)
2. Assigning each email individually to a case (some bulk-assign tools exist)
3. Creating/assigning constituents and inputting their details (address, etc.)
4. Tagging the case (critical for analytics - misspellings cause segmentation issues)
5. Assigning to the right caseworker
6. Moving to the next case

**Goal**: Reduce this from several hours to **a few minutes** by leveraging AI pre-processing and smart UI.

---

## Current AI Capabilities (from edge functions)

Our `email-ingestion` function already provides:

| Capability | Description | Confidence Score |
|------------|-------------|------------------|
| **Classification** | 5 types: policy, casework, campaign, spam, personal | 0-1 |
| **Campaign Detection** | Fingerprint hashing + subject pattern matching | Boolean + match type |
| **Tag Suggestion** | Based on office tags with descriptions/keywords | 0-1 per tag |
| **Staff Assignment** | Based on type, tags, and user specialties | N/A |
| **Constituent Matching** | Email address lookup in existing database | Exact/fuzzy match |
| **Draft Response** | For policy emails and campaign bulk responses | N/A |

---

## Design Considerations

### 1. Confidence-Based UI Hierarchy

**Principle**: Surface confidence scores to help managers quickly identify what needs attention.

| Confidence Level | UI Treatment | User Action |
|------------------|--------------|-------------|
| **High (≥0.85)** | Green indicator, collapsed details | One-click approve |
| **Medium (0.6-0.84)** | Yellow indicator, show alternatives | Quick review, easy switch |
| **Low (<0.6)** | Red indicator, expanded details | Manual selection required |

**Design Decision**: Show the top 2-3 alternatives when confidence is medium, making it trivial to switch.

### 2. Email Type Segmentation

Different email types have different triage needs:

| Type | Volume | Complexity | Optimal Workflow |
|------|--------|------------|------------------|
| **Campaign** | High (50-100+) | Low | Batch approve, spot-check |
| **Policy (new constituent)** | Medium | Low | Verify constituent, approve assignment |
| **Policy (existing constituent)** | Medium | Medium | Review context, approve |
| **Casework (new)** | Low | High | Create case, detailed review |
| **Casework (existing case)** | Low | Medium | Match to case, review context |
| **Spam** | Variable | None | Batch dismiss |

**Design Decision**: Consider tiered/phased triage that processes high-volume, low-complexity items first.

### 3. Information Density vs. Cognitive Load

The manager needs to see:
- Email subject/snippet (what is this about?)
- Sender info (who sent it?)
- AI classification + confidence (what type?)
- Suggested tags + alternatives (how to categorize?)
- Suggested assignee + alternatives (who handles it?)
- Constituent match status (new or existing?)
- Suggested case (for casework)

**Challenge**: Showing all this without overwhelming the user.

**Solutions Explored**:
1. **Progressive disclosure**: Show summary, expand for details
2. **Inline editing**: Click to edit directly in the row
3. **Keyboard shortcuts**: Power users can fly through items
4. **Smart grouping**: Batch similar items together

### 4. Batch Operations

**Key Insight**: Many emails can be processed identically.

- Campaign emails from same campaign → same tags, same response
- Policy emails on same topic → same tags, similar routing
- Emails from same constituent → often same case

**Design Decision**: Always show counts and enable "apply to all similar" actions.

### 5. Error Prevention for Tags

Current pain point: Misspelled tags break analytics.

**Solutions**:
- **No free-text tags**: Only select from predefined list
- **AI suggestions first**: Pre-select most likely tags
- **Visual tag palette**: Colored badges prevent confusion
- **Quick-add from suggestions**: One click to add suggested tag

### 6. Constituent Matching UX

Scenarios:
1. **Exact match**: Email matches existing constituent → Show constituent card
2. **Fuzzy match**: Similar name/address found → Show "Did you mean...?"
3. **No match**: New constituent → Pre-fill form with extracted data
4. **Multiple matches**: Ambiguous → Show candidates to choose from

**Design Decision**: For campaigns, constituent creation can be deferred (just track email). For casework, constituent is required.

### 7. Assignee Logic Transparency

Managers want to understand WHY someone was assigned:
- "Assigned to Jane because she handles Benefits casework"
- "Assigned to Tom because he's the default policy handler"
- "Assigned to Sarah because this constituent is her existing case"

**Design Decision**: Show assignment reasoning in a tooltip or subtitle.

---

## Three Prototype Approaches

### Prototype 1: Tiered Waterfall (`/triage-prototype-1`)

**Concept**: Process emails in phases based on complexity.

**Phases**:
1. **Campaign Batch** - All detected campaigns, one-click approve all
2. **Quick Wins** - High-confidence policy emails, rapid approval
3. **Review Required** - Medium confidence items, show alternatives
4. **Manual Triage** - Low confidence, needs human decision

**Strengths**:
- Reduces cognitive load by batching similar decisions
- Most emails cleared in first two phases
- Clear progress indicator

**Weaknesses**:
- May feel rigid for some workflows
- Harder to spot-check individual items in batch mode

### Prototype 2: Kanban Dashboard (`/triage-prototype-2`)

**Concept**: Visual card-based interface organized by status.

**Columns**:
- **Inbox** - New emails awaiting triage
- **Campaigns** - Grouped by campaign
- **Ready to Approve** - AI-processed, high confidence
- **Needs Review** - Requires human decision
- **Done** - Approved items

**Strengths**:
- Visual, intuitive mental model
- Good for monitoring team workload
- Flexible - work on any column

**Weaknesses**:
- Takes more screen space
- May not scale to 100+ items efficiently

### Prototype 3: AI-First Smart List (`/triage-prototype-3`)

**Concept**: Single unified list with intelligent grouping and inline editing.

**Features**:
- **Smart Sort**: Confidence + urgency + volume
- **Inline Editing**: Click any field to change it
- **Group Actions**: Select multiple, apply changes
- **Quick Filters**: By type, confidence, assignee
- **Keyboard Navigation**: j/k to move, a to approve, t for tags

**Strengths**:
- Most powerful for experienced users
- Handles high volume efficiently
- Flexible filtering and sorting

**Weaknesses**:
- Steeper learning curve
- Requires more training

---

## Recommended Features (All Prototypes)

### Must Have
- [ ] Confidence indicators (color-coded)
- [ ] One-click approve for high-confidence items
- [ ] Alternative suggestions for medium-confidence
- [ ] Batch operations for campaigns
- [ ] Tag selection from predefined list only
- [ ] Constituent matching with preview
- [ ] Assignment reasoning shown

### Nice to Have
- [ ] Keyboard shortcuts
- [ ] Progress indicator (X of Y remaining)
- [ ] Undo last action
- [ ] "Skip" to defer item
- [ ] Email preview on hover/expand
- [ ] Link to existing case details

### Future Considerations
- [ ] Learning from corrections (improve AI over time)
- [ ] Custom rules builder (if X then Y)
- [ ] SLA warnings (emails waiting too long)
- [ ] Workload balancing suggestions

---

## Data Model Notes

The prototype assumes these AI-provided fields per email:

```typescript
interface TriageEmail {
  id: string;
  subject: string;
  snippet: string;
  from_email: string;
  from_name: string;
  received_at: string;

  // AI Classification
  email_type: 'policy' | 'casework' | 'campaign' | 'spam' | 'personal';
  classification_confidence: number;
  classification_reasoning: string;

  // Campaign Detection
  is_campaign_email: boolean;
  detected_campaign_id?: string;
  campaign_match_type?: 'fingerprint' | 'subject_pattern' | 'manual';

  // Tag Suggestions
  suggested_tags: Array<{
    tag_id: string;
    tag_name: string;
    tag_color: string;
    confidence: number;
  }>;

  // Assignee Suggestion
  suggested_assignee: {
    user_id: string;
    user_name: string;
    reason: string;
  };
  alternative_assignees: Array<{
    user_id: string;
    user_name: string;
    reason: string;
  }>;

  // Constituent Match
  constituent_match: {
    status: 'exact' | 'fuzzy' | 'multiple' | 'none';
    matched_constituent?: {
      id: string;
      name: string;
      address?: string;
      previous_cases?: number;
    };
    alternatives?: Array<{
      id: string;
      name: string;
      match_reason: string;
    }>;
    extracted_data?: {
      name?: string;
      address?: string;
      phone?: string;
    };
  };

  // Case Matching (for casework)
  suggested_case?: {
    case_id: string;
    reference: string;
    title: string;
    confidence: number;
  };
  alternative_cases?: Array<{
    case_id: string;
    reference: string;
    title: string;
    confidence: number;
  }>;
}
```

---

## Success Metrics

After implementation, measure:

1. **Time to clear inbox**: Target < 15 minutes for typical Monday volume
2. **Accuracy of AI suggestions**: % approved without modification
3. **Tag consistency**: Reduction in duplicate/misspelled tags
4. **User satisfaction**: Qualitative feedback from office managers
5. **Error rate**: Cases assigned to wrong person/category

---

## Next Steps

1. Review the three prototypes with office managers
2. Gather feedback on preferred workflow style
3. Combine best elements into final design
4. Build inbound rules configuration UI
5. Implement production triage page
