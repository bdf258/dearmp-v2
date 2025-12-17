# Constituent Segmentation Analysis

**Author**: Claude Code Analysis
**Date**: December 2024
**Branch**: `claude/constituent-segmentation-analysis-DSATy`

---

## Executive Summary

This document analyses the current state of constituent tracking in DearMP v2 and proposes a comprehensive segmentation feature that enables MPs to:

1. **Segment constituents** by interests, topics, campaign participation, or custom criteria
2. **Target communications** to specific segments for more relevant outreach
3. **Track engagement** across different constituent groups over time

The analysis recommends building upon the existing **polymorphic tag system** while introducing a dedicated **segments** abstraction for more powerful, saved-query-based grouping.

---

## Table of Contents

1. [Current State of Constituent Tracking](#1-current-state-of-constituent-tracking)
2. [Existing Segmentation Capabilities](#2-existing-segmentation-capabilities)
3. [Gap Analysis](#3-gap-analysis)
4. [Proposed Segmentation Feature Design](#4-proposed-segmentation-feature-design)
5. [Database Schema Recommendations](#5-database-schema-recommendations)
6. [UI/UX Considerations](#6-uiux-considerations)
7. [Implementation Approach](#7-implementation-approach)
8. [Alternative Approaches Considered](#8-alternative-approaches-considered)

---

## 1. Current State of Constituent Tracking

### 1.1 Core Data Model

The constituent tracking system is built around these core entities:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CONSTITUENTS                                  │
│  ─────────────────────────────────────────────────────────────────────  │
│  • id (UUID, PK)                                                        │
│  • office_id (FK → offices) - Multi-tenancy scoping                     │
│  • full_name (required)                                                 │
│  • salutation (optional - Mr., Dr., etc.)                               │
│  • notes (internal notes field)                                         │
│  • created_at, updated_at (timestamps)                                  │
└─────────────────────────────────────────────────────────────────────────┘
```

**Reference**: `src/lib/database.types.ts:557-594`

### 1.2 Contact Information

Constituents can have multiple contact records of different types:

| Type | Description | Example |
|------|-------------|---------|
| `email` | Email addresses | john@example.com |
| `phone` | Phone numbers | 020 1234 5678 |
| `address` | Physical addresses | 10 Downing St, London |
| `social` | Social media handles | @johnsmith |

- Each contact can be marked as `is_primary`
- Unique constraint prevents duplicate contacts per constituent

**Reference**: `src/lib/database.types.ts:463-507`

### 1.3 Key Relationships

```
CONSTITUENTS
    │
    ├──► constituent_contacts (1:N)
    │        Multi-type contact information
    │
    ├──► constituent_relationships (N:N self-referential)
    │        Models: family, business associates, etc.
    │
    ├──► case_parties (N:N with cases)
    │        Role-based: 'constituent', 'complainant', etc.
    │
    ├──► organization_memberships (N:N with organizations)
    │        Links to organizations with role_title
    │
    ├──► message_recipients (N:N with messages)
    │        Tracks all communications history
    │
    ├──► bulk_response_log (1:N)
    │        Records of campaign responses sent
    │
    └──► tag_assignments (1:N, polymorphic)
             Flexible tagging system
```

### 1.4 Current UI Implementation

The Constituents page (`src/pages/office/ConstituentsPage.tsx`) provides a basic directory view:

- Simple list display with name, email, phone, address
- No filtering or search capabilities currently
- No tag display or management integration
- No segment or grouping features

---

## 2. Existing Segmentation Capabilities

### 2.1 Tag System

The application has a **polymorphic tagging system** that can already tag constituents:

#### Tags Table
```sql
tags:
  - id (UUID, PK)
  - office_id (FK)
  - name (string)
  - color (hex color for UI)
  - created_at
  UNIQUE(office_id, name)
```

#### Tag Assignments Table
```sql
tag_assignments:
  - id (UUID, PK)
  - office_id (FK)
  - tag_id (FK → tags)
  - entity_type (string: 'constituent', 'message', 'case', 'campaign')
  - entity_id (UUID - polymorphic reference)
  - created_at
```

**Reference**: `src/lib/database.types.ts:1136-1209`

#### Tag Management UI
The `TagSelectorDialog` component (`src/components/tags/TagSelectorDialog.tsx`) provides:
- Visual tag selection with checkboxes
- Color-coded badges
- Create new tags inline
- Toggle tags on/off for any entity type

### 2.2 Campaign-Based Grouping

Campaigns provide implicit constituent grouping through the message flow:

```
Campaign ──► Messages ──► Message Recipients ──► Constituents
```

The `generate_campaign_outbox_messages` RPC function demonstrates this query pattern:

```sql
SELECT DISTINCT ON (c.id)
  c.id, c.full_name, cc.value as email
FROM messages m
JOIN message_recipients mr ON m.id = mr.message_id AND mr.recipient_type = 'from'
JOIN constituents c ON mr.constituent_id = c.id
JOIN constituent_contacts cc ON c.id = cc.constituent_id
WHERE
  m.campaign_id = :campaign_id
  AND m.direction = 'inbound'
  AND cc.type = 'email'
  AND cc.is_primary = true
```

**Reference**: `supabase/migrations/20241216000001_security_fixes.sql:93-126`

### 2.3 Case-Based Grouping

Cases group constituents through the `case_parties` junction table:
- Constituents can be linked to cases with specific roles
- Enables queries like "all constituents involved in housing cases"

### 2.4 Data Access Layer

The `useSupabaseData` hook (`src/lib/useSupabaseData.ts`) provides:

```typescript
// Tag operations
getTagsForEntity(entityType: string, entityId: string): TagAssignment[]
addTagToEntity(tagId: string, entityType: string, entityId: string): Promise<TagAssignment | null>
removeTagFromEntity(tagId: string, entityType: string, entityId: string): Promise<boolean>

// Bulk operations
processBulkResponse(bulkResponseId: string): Promise<{ queued_count: number } | null>
```

---

## 3. Gap Analysis

### 3.1 What's Missing

| Capability | Current State | Needed For Segmentation |
|------------|--------------|------------------------|
| **Tag-based filtering** | Tags exist but no filter UI | Filter constituents by tags |
| **Multi-criteria segments** | Not implemented | Combine tags + campaigns + cases |
| **Saved segments** | Not implemented | Reusable segment definitions |
| **Dynamic segments** | Not implemented | Auto-updating based on criteria |
| **Segment analytics** | Not implemented | Size, engagement metrics |
| **Targeted communications** | Only via campaigns | Send to custom segments |
| **Constituent search** | Not implemented | Find by name, email, criteria |
| **Interest tracking** | Via tags (indirect) | Explicit topic/interest fields |
| **Engagement scoring** | Not implemented | Track interaction frequency |

### 3.2 Infrastructure Gaps

1. **No constituent detail page** - Cannot view/edit individual constituent profiles
2. **No segment entity** - No way to save and name groupings
3. **No filtering API** - Backend doesn't support complex queries
4. **No bulk actions** - Cannot act on multiple constituents at once
5. **No export capability** - Cannot export segment data

---

## 4. Proposed Segmentation Feature Design

### 4.1 Core Concepts

#### Segment Types

| Type | Description | Example |
|------|-------------|---------|
| **Tag-based** | Constituents with specific tags | "Environment supporters" |
| **Campaign-based** | Participated in specific campaigns | "NHS funding campaign writers" |
| **Case-based** | Involved in certain case types | "Housing issue constituents" |
| **Behaviour-based** | Based on engagement patterns | "Frequent correspondents" |
| **Combined** | Multiple criteria with AND/OR | "Housing + sent 3+ messages" |

#### Segment Definition Model

```typescript
interface Segment {
  id: string;
  office_id: string;
  name: string;
  description?: string;

  // Query definition
  criteria: SegmentCriteria;

  // Cached stats
  member_count: number;
  last_calculated_at: string;

  // Metadata
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface SegmentCriteria {
  // Tag criteria
  include_tags?: string[];     // ANY of these tags
  require_tags?: string[];     // ALL of these tags
  exclude_tags?: string[];     // NONE of these tags

  // Campaign criteria
  campaigns?: {
    include?: string[];        // Participated in any
    exclude?: string[];        // Did not participate
  };

  // Case criteria
  case_involvement?: {
    categories?: string[];     // Case categories
    roles?: string[];          // Party roles
    statuses?: string[];       // Case statuses
  };

  // Engagement criteria
  engagement?: {
    min_messages?: number;     // Minimum message count
    max_messages?: number;
    since_date?: string;       // Within time period
    channels?: string[];       // Specific channels
  };

  // Contact criteria
  has_email?: boolean;
  has_phone?: boolean;
  has_address?: boolean;

  // Combination logic
  operator?: 'AND' | 'OR';     // How to combine criteria groups
}
```

### 4.2 Segment Management Features

1. **Segment Builder UI**
   - Visual criteria selection
   - Real-time member count preview
   - Save/name segments

2. **Segment List View**
   - Display all saved segments
   - Show member counts
   - Quick actions (view, edit, delete, send to)

3. **Segment Detail View**
   - Full member list with pagination
   - Export to CSV
   - "Send communication" action

4. **Quick Segments**
   - Pre-built common segments
   - "All constituents with email"
   - "Recent correspondents (30 days)"
   - "Campaign X participants"

### 4.3 Integration with Communications

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────────┐
│   Segment    │────►│  Bulk Message   │────►│  Email Outbox    │
│   Members    │     │    Composer     │     │     Queue        │
└──────────────┘     └─────────────────┘     └──────────────────┘
       │                     │
       │                     ▼
       │              ┌─────────────────┐
       │              │   Template      │
       │              │   Variables     │
       │              │  {{full_name}}  │
       │              │  {{salutation}} │
       └─────────────►└─────────────────┘
```

---

## 5. Database Schema Recommendations

### 5.1 New Tables

#### Segments Table

```sql
CREATE TABLE segments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,

  -- Segment identity
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6B7280',  -- For UI display

  -- Query definition (JSONB for flexibility)
  criteria JSONB NOT NULL DEFAULT '{}',

  -- Calculated stats (cached for performance)
  member_count INTEGER DEFAULT 0,
  last_calculated_at TIMESTAMPTZ,

  -- Lifecycle
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(office_id, name)
);

CREATE INDEX idx_segments_office ON segments(office_id);
CREATE INDEX idx_segments_active ON segments(office_id, is_active) WHERE is_active = true;
```

#### Segment Members Table (Optional - for static segments)

```sql
-- Only needed if supporting static/manual segment membership
CREATE TABLE segment_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  segment_id UUID NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
  constituent_id UUID NOT NULL REFERENCES constituents(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  added_by UUID REFERENCES profiles(id),

  UNIQUE(segment_id, constituent_id)
);

CREATE INDEX idx_segment_members_segment ON segment_members(segment_id);
CREATE INDEX idx_segment_members_constituent ON segment_members(constituent_id);
```

### 5.2 RPC Functions

#### Query Segment Members

```sql
CREATE OR REPLACE FUNCTION query_segment_members(
  p_segment_id UUID,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  constituent_id UUID,
  full_name TEXT,
  primary_email TEXT,
  primary_phone TEXT,
  tag_names TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_criteria JSONB;
  v_office_id UUID;
  v_base_query TEXT;
BEGIN
  -- Get segment criteria and validate access
  SELECT criteria, office_id INTO v_criteria, v_office_id
  FROM segments
  WHERE id = p_segment_id AND office_id = get_my_office_id();

  IF v_office_id IS NULL THEN
    RAISE EXCEPTION 'Segment not found or access denied';
  END IF;

  -- Build and execute dynamic query based on criteria
  -- This would be a complex function building SQL from JSON criteria
  -- Simplified example:

  RETURN QUERY
  SELECT
    c.id,
    c.full_name,
    (SELECT cc.value FROM constituent_contacts cc
     WHERE cc.constituent_id = c.id AND cc.type = 'email' AND cc.is_primary = true
     LIMIT 1),
    (SELECT cc.value FROM constituent_contacts cc
     WHERE cc.constituent_id = c.id AND cc.type = 'phone' AND cc.is_primary = true
     LIMIT 1),
    ARRAY(SELECT t.name FROM tag_assignments ta
          JOIN tags t ON ta.tag_id = t.id
          WHERE ta.entity_type = 'constituent' AND ta.entity_id = c.id)
  FROM constituents c
  WHERE c.office_id = v_office_id
  -- Apply criteria filters here...
  ORDER BY c.full_name
  LIMIT p_limit OFFSET p_offset;
END;
$$;
```

#### Calculate Segment Count

```sql
CREATE OR REPLACE FUNCTION calculate_segment_count(p_segment_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Build count query from criteria
  -- Update cached count
  UPDATE segments
  SET member_count = v_count, last_calculated_at = NOW()
  WHERE id = p_segment_id;

  RETURN v_count;
END;
$$;
```

### 5.3 Enhancing Existing Tables

#### Add Topic/Interest Support to Tags

```sql
-- Add tag categories for better organization
ALTER TABLE tags ADD COLUMN category TEXT DEFAULT 'general'
  CHECK (category IN ('general', 'topic', 'interest', 'status', 'campaign', 'demographic'));

-- Add tag description for semantic meaning
ALTER TABLE tags ADD COLUMN IF NOT EXISTS description TEXT;

-- Add keywords for auto-tagging
ALTER TABLE tags ADD COLUMN IF NOT EXISTS auto_assign_keywords TEXT[] DEFAULT '{}';
```

#### Add Engagement Metrics View

```sql
CREATE OR REPLACE VIEW constituent_engagement AS
SELECT
  c.id AS constituent_id,
  c.office_id,
  COUNT(DISTINCT mr.message_id) AS total_messages,
  COUNT(DISTINCT mr.message_id) FILTER (WHERE m.direction = 'inbound') AS inbound_messages,
  COUNT(DISTINCT mr.message_id) FILTER (WHERE m.direction = 'outbound') AS outbound_messages,
  COUNT(DISTINCT m.campaign_id) AS campaigns_participated,
  COUNT(DISTINCT cp.case_id) AS cases_involved,
  MAX(m.received_at) AS last_contact_date,
  MIN(m.received_at) AS first_contact_date
FROM constituents c
LEFT JOIN message_recipients mr ON c.id = mr.constituent_id
LEFT JOIN messages m ON mr.message_id = m.id
LEFT JOIN case_parties cp ON c.id = cp.constituent_id
GROUP BY c.id, c.office_id;
```

---

## 6. UI/UX Considerations

### 6.1 Segment Builder Interface

```
┌─────────────────────────────────────────────────────────────────────┐
│  Create New Segment                                          [Save] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Segment Name: [________________________]                           │
│  Description:  [________________________]                           │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  CRITERIA                                              [+ Add] ││
│  ├─────────────────────────────────────────────────────────────────┤│
│  │                                                                 ││
│  │  ┌─────────────────────────────────────────────────────────┐   ││
│  │  │  Tags: [Has any of]  [Environment ✕] [Climate ✕]  [+]   │   ││
│  │  └─────────────────────────────────────────────────────────┘   ││
│  │                                                                 ││
│  │  ┌─────────────────────────────────────────────────────────┐   ││
│  │  │  Campaigns: [Participated in]  [NHS Petition ✕]   [+]   │   ││
│  │  └─────────────────────────────────────────────────────────┘   ││
│  │                                                                 ││
│  │  ┌─────────────────────────────────────────────────────────┐   ││
│  │  │  Contact: [✓] Has email  [ ] Has phone  [ ] Has address │   ││
│  │  └─────────────────────────────────────────────────────────┘   ││
│  │                                                                 ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  PREVIEW                                       247 constituents ││
│  ├─────────────────────────────────────────────────────────────────┤│
│  │  • John Smith (john@example.com)                                ││
│  │  • Jane Doe (jane@example.com)                                  ││
│  │  • Robert Wilson (robert@example.com)                           ││
│  │  ... and 244 more                                               ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 Segments List Page

```
┌─────────────────────────────────────────────────────────────────────┐
│  Segments                                         [+ Create Segment]│
│  Target specific groups of constituents for communications         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ 🏷️ Environment Supporters                         342 members │ │
│  │    Tags: Environment, Climate Change                          │ │
│  │    Last updated: 2 hours ago                                  │ │
│  │                                    [View] [Send Message] [...]│ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ 📧 NHS Campaign Respondents                       1,247 members│ │
│  │    Campaign: NHS Funding Petition                             │ │
│  │    Last updated: 1 day ago                                    │ │
│  │                                    [View] [Send Message] [...]│ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ 🏠 Housing Cases                                    89 members │ │
│  │    Cases: Housing category                                    │ │
│  │    Last updated: 3 days ago                                   │ │
│  │                                    [View] [Send Message] [...]│ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.3 Quick Segment Access

Add segment filter dropdown to the Constituents page:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Constituents                                                       │
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │ Segment: [All ▼] │  │ Tags: [Any ▼]    │  │ Search: [____]   │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
│                                                                     │
│  Showing 342 of 2,451 constituents                                  │
├─────────────────────────────────────────────────────────────────────┤
```

### 6.4 Communication Workflow

When sending to a segment:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Send Message to Segment                                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  To: Environment Supporters (342 constituents with email)          │
│                                                                     │
│  Subject: [Update on Climate Bill Progress________________]        │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Dear {{salutation}} {{full_name}},                         │   │
│  │                                                             │   │
│  │  I wanted to update you on the progress of...              │   │
│  │                                                             │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Available variables: {{full_name}}, {{salutation}}, {{mp_name}}   │
│                                                                     │
│  [ ] Require MP approval before sending                             │
│                                                                     │
│                                [Preview] [Schedule] [Send Now]      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 7. Implementation Approach

### 7.1 Phased Rollout

#### Phase 1: Foundation (MVP)
1. Add `segments` table to database
2. Create basic segment CRUD API
3. Implement simple tag-based segmentation
4. Add segment list and detail pages
5. Integrate with existing bulk response workflow

#### Phase 2: Advanced Criteria
1. Add campaign-based criteria
2. Add case-based criteria
3. Add engagement-based criteria
4. Implement criteria builder UI
5. Add segment preview functionality

#### Phase 3: Communications
1. "Send to segment" workflow
2. Template variable expansion
3. Delivery tracking per segment
4. Segment performance analytics

#### Phase 4: Enhancement
1. Dynamic segment auto-refresh
2. Segment comparison/overlap analysis
3. Constituent journey tracking
4. Export and import capabilities

### 7.2 Key Implementation Files

| File | Purpose |
|------|---------|
| `supabase/migrations/YYYYMMDD_segments.sql` | Database schema |
| `src/lib/database.types.ts` | TypeScript types update |
| `src/lib/useSupabaseData.ts` | Data hooks for segments |
| `src/pages/office/SegmentsPage.tsx` | Segment list view |
| `src/pages/office/SegmentDetailPage.tsx` | Segment member view |
| `src/components/segments/SegmentBuilder.tsx` | Criteria builder |
| `src/components/segments/SegmentSelector.tsx` | Dropdown selector |

### 7.3 API Design

```typescript
// Segment CRUD
createSegment(data: SegmentInsert): Promise<Segment>
updateSegment(id: string, updates: SegmentUpdate): Promise<Segment>
deleteSegment(id: string): Promise<boolean>
getSegments(): Promise<Segment[]>
getSegment(id: string): Promise<Segment>

// Segment members
getSegmentMembers(id: string, options: PaginationOptions): Promise<{
  members: ConstituentWithContacts[];
  total: number;
}>

// Segment actions
refreshSegmentCount(id: string): Promise<number>
exportSegment(id: string, format: 'csv' | 'json'): Promise<Blob>
sendToSegment(segmentId: string, message: MessageTemplate): Promise<{
  queued: number;
  skipped: number;
}>
```

---

## 8. Alternative Approaches Considered

### 8.1 Tags Only (No Segments Entity)

**Approach**: Use tags exclusively for all segmentation needs.

**Pros**:
- Simpler - no new tables
- Already implemented
- Flexible

**Cons**:
- Cannot save complex multi-criteria queries
- No AND/OR logic between tags
- No engagement-based criteria
- Requires remembering which tags define which "segment"

**Verdict**: Tags are good for simple categorization but insufficient for complex segmentation needs.

### 8.2 Static Segment Membership

**Approach**: Store explicit constituent-segment relationships rather than query-based membership.

**Pros**:
- Fast queries (pre-computed membership)
- Supports manual member management
- Clear audit trail

**Cons**:
- Requires synchronization when data changes
- Storage overhead
- Membership can become stale
- Harder to implement dynamic criteria

**Verdict**: Could be offered as an option alongside dynamic segments for special cases.

### 8.3 Smart Lists (Saved Searches)

**Approach**: Store search queries that can be re-executed.

**Pros**:
- Always up-to-date
- No sync needed
- Flexible criteria

**Cons**:
- Slower queries for large datasets
- Complex query builder needed
- Harder to share/explain

**Verdict**: This is essentially what we're proposing, with the addition of cached counts and proper entity modeling.

---

## Appendix A: Current File References

| File | Purpose | Lines |
|------|---------|-------|
| `src/lib/database.types.ts` | Type definitions | 557-594 (constituents), 463-507 (contacts), 1136-1209 (tags) |
| `src/pages/office/ConstituentsPage.tsx` | Constituent list | Full file |
| `src/pages/policy/CampaignsPage.tsx` | Campaign management | Full file |
| `src/components/tags/TagSelectorDialog.tsx` | Tag management UI | Full file |
| `src/lib/useSupabaseData.ts` | Data access layer | 1-500+ |
| `supabase/migrations/20241216000001_security_fixes.sql` | Bulk response RPC | 58-137 |
| `supabase/migrations/20241208000001_initial_schema.sql` | Initial schema | Full file |

---

## Appendix B: Segment Criteria Schema (JSON)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "include_tags": {
      "type": "array",
      "items": { "type": "string", "format": "uuid" },
      "description": "Include constituents with ANY of these tags"
    },
    "require_tags": {
      "type": "array",
      "items": { "type": "string", "format": "uuid" },
      "description": "Include constituents with ALL of these tags"
    },
    "exclude_tags": {
      "type": "array",
      "items": { "type": "string", "format": "uuid" },
      "description": "Exclude constituents with ANY of these tags"
    },
    "campaigns": {
      "type": "object",
      "properties": {
        "include": { "type": "array", "items": { "type": "string", "format": "uuid" } },
        "exclude": { "type": "array", "items": { "type": "string", "format": "uuid" } }
      }
    },
    "engagement": {
      "type": "object",
      "properties": {
        "min_messages": { "type": "integer", "minimum": 0 },
        "max_messages": { "type": "integer", "minimum": 0 },
        "since_date": { "type": "string", "format": "date" },
        "channels": { "type": "array", "items": { "type": "string" } }
      }
    },
    "contact_requirements": {
      "type": "object",
      "properties": {
        "has_email": { "type": "boolean" },
        "has_phone": { "type": "boolean" },
        "has_address": { "type": "boolean" }
      }
    }
  }
}
```

---

## Conclusion

The DearMP v2 application has a solid foundation for constituent tracking with its polymorphic tag system, campaign integration, and case management. Introducing a dedicated **segments** feature would significantly enhance the MP's ability to:

1. **Understand** their constituent base through interest-based groupings
2. **Target** communications to relevant audiences
3. **Track** engagement patterns over time
4. **Act** efficiently with bulk operations on defined groups

The recommended approach builds on existing infrastructure (tags, campaigns, cases) while introducing a new `segments` entity that stores criteria-based queries. This provides the flexibility of dynamic membership with the convenience of saved, named groupings.

Implementation should proceed in phases, starting with tag-based segmentation and progressively adding more sophisticated criteria options.
