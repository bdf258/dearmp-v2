# Email Templates Feature Architecture

## Executive Summary

This document outlines the architecture for an Email Templates feature that allows MP office staff to create, manage, and reuse email templates. These templates are **separate from `bulk_responses`** (which are campaign-specific) but can be **used by bulk responses** as a starting point.

---

## 1. Current State Analysis

### Existing `bulk_responses` Table
```sql
bulk_responses (
  id, campaign_id, office_id, fingerprint_hash,
  subject, body_template,
  status (draft/pending_approval/approved/sending/sent/rejected),
  created_by_user_id, approved_by_user_id, ...
)
```

**Key Distinction:**
- `bulk_responses` = A **specific response** tied to a campaign, goes through approval workflow, gets sent
- `email_templates` (new) = **Reusable text blocks** that can be inserted into any response

### Existing Template Variables
The codebase already supports these variables in `bulk_responses`:
- `{{full_name}}` / `{{constituent_name}}` - Recipient's name
- `{{mp_name}}` - The MP's name
- `{{signature}}` - Office signature (from `offices.signature_template`)

---

## 2. Proposed Database Schema

### New Table: `email_templates`

```sql
CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,

  -- Template metadata
  name TEXT NOT NULL,                    -- "Thank you for contacting us"
  description TEXT,                      -- Optional internal description
  category TEXT,                         -- 'greeting', 'closing', 'acknowledgment', 'standard_response', 'custom'

  -- Template content (plain text with variables)
  subject_template TEXT,                 -- Optional: "Re: {{original_subject}}"
  body_template TEXT NOT NULL,           -- The actual template text

  -- Audit fields
  created_by_user_id UUID REFERENCES users(id),
  updated_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Soft delete for audit trail
  is_archived BOOLEAN DEFAULT FALSE,
  archived_at TIMESTAMPTZ,

  -- Ordering/organization
  sort_order INTEGER DEFAULT 0,
  is_default BOOLEAN DEFAULT FALSE,      -- Mark one as default for quick insert

  CONSTRAINT email_templates_office_name_unique UNIQUE (office_id, name)
);

-- Indexes for performance
CREATE INDEX idx_email_templates_office ON email_templates(office_id);
CREATE INDEX idx_email_templates_category ON email_templates(office_id, category);
CREATE INDEX idx_email_templates_archived ON email_templates(office_id, is_archived);
```

### RLS Policies

```sql
-- Enable RLS
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- Users can only see their own office's templates
CREATE POLICY "Users can view own office templates"
  ON email_templates FOR SELECT
  USING (office_id = get_my_office_id());

-- Only admin/staff can create templates
CREATE POLICY "Staff can create templates"
  ON email_templates FOR INSERT
  WITH CHECK (
    office_id = get_my_office_id()
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'staff')
  );

-- Only admin/staff can update templates
CREATE POLICY "Staff can update templates"
  ON email_templates FOR UPDATE
  USING (office_id = get_my_office_id())
  WITH CHECK (
    office_id = get_my_office_id()
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'staff')
  );

-- Only admin can delete templates
CREATE POLICY "Admin can delete templates"
  ON email_templates FOR DELETE
  USING (
    office_id = get_my_office_id()
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );
```

### Audit Log Table (Optional but Recommended)

```sql
CREATE TABLE email_template_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL REFERENCES email_templates(id) ON DELETE CASCADE,
  action TEXT NOT NULL,                  -- 'created', 'updated', 'archived', 'restored'
  changed_by_user_id UUID REFERENCES users(id),
  previous_body TEXT,                    -- Store previous content for rollback
  new_body TEXT,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 3. XSS Prevention Strategy

### Layer 1: Input Sanitization (Server-Side)

```sql
-- RPC function to safely create/update templates
CREATE OR REPLACE FUNCTION upsert_email_template(
  p_id UUID,
  p_name TEXT,
  p_description TEXT,
  p_category TEXT,
  p_subject_template TEXT,
  p_body_template TEXT
) RETURNS JSON AS $$
DECLARE
  v_office_id UUID;
  v_user_role TEXT;
  v_result JSON;
BEGIN
  -- Get caller's office
  v_office_id := get_my_office_id();

  -- Verify role
  SELECT role INTO v_user_role FROM profiles WHERE id = auth.uid();
  IF v_user_role NOT IN ('admin', 'staff') THEN
    RETURN json_build_object('error', 'Unauthorized: Insufficient permissions');
  END IF;

  -- Sanitize inputs: Strip any HTML tags from body_template
  -- (We're storing plain text only)
  p_body_template := regexp_replace(p_body_template, '<[^>]+>', '', 'g');
  p_subject_template := regexp_replace(p_subject_template, '<[^>]+>', '', 'g');

  -- Validate template variables (only allow approved variables)
  IF p_body_template ~ '\{\{[^}]+\}\}' THEN
    -- Check all variables match allowed list
    IF p_body_template ~ '\{\{(?!full_name|constituent_name|mp_name|signature|original_subject|office_name)[^}]+\}\}' THEN
      RETURN json_build_object('error', 'Invalid template variable detected');
    END IF;
  END IF;

  -- Upsert logic...
  -- (rest of function)

  RETURN json_build_object('success', true, 'template_id', v_result_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Layer 2: Output Encoding (Frontend)

```typescript
// src/lib/templateSanitizer.ts

import DOMPurify from 'dompurify';

// Allowed template variables (whitelist approach)
const ALLOWED_VARIABLES = [
  'full_name',
  'constituent_name',
  'mp_name',
  'signature',
  'original_subject',
  'office_name',
] as const;

type TemplateVariable = typeof ALLOWED_VARIABLES[number];

/**
 * Sanitizes template content for safe storage
 * Strips HTML but preserves template variables
 */
export function sanitizeTemplateInput(text: string): string {
  // First, strip all HTML tags
  const stripped = DOMPurify.sanitize(text, {
    ALLOWED_TAGS: [],  // No HTML allowed
    ALLOWED_ATTR: [],
  });

  // Validate template variables
  const variablePattern = /\{\{(\w+)\}\}/g;
  let match;
  while ((match = variablePattern.exec(stripped)) !== null) {
    const varName = match[1];
    if (!ALLOWED_VARIABLES.includes(varName as TemplateVariable)) {
      throw new Error(`Invalid template variable: {{${varName}}}`);
    }
  }

  return stripped;
}

/**
 * Renders a template by replacing variables with values
 * All values are HTML-escaped before insertion
 */
export function renderTemplate(
  template: string,
  variables: Record<string, string>
): string {
  let result = template;

  for (const [key, value] of Object.entries(variables)) {
    if (!ALLOWED_VARIABLES.includes(key as TemplateVariable)) {
      continue; // Skip unknown variables
    }

    // HTML-escape the value before insertion
    const safeValue = escapeHtml(value);
    result = result.replace(
      new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
      safeValue
    );
  }

  return result;
}

/**
 * Escapes HTML special characters
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Converts plain text template to safe HTML for display
 * (newlines → <br>, escapes everything else)
 */
export function templateToHtml(plainText: string): string {
  const escaped = escapeHtml(plainText);
  return escaped.replace(/\n/g, '<br>');
}
```

### Layer 3: Content Security Policy Headers

```typescript
// Add to your Supabase Edge Functions or hosting config
const CSP_HEADERS = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",  // For Tailwind
    "img-src 'self' data: https:",
    "connect-src 'self' https://*.supabase.co",
  ].join('; '),
};
```

---

## 4. TypeScript Types

```typescript
// src/lib/database.types.ts (additions)

export interface EmailTemplate {
  id: string;
  office_id: string;
  name: string;
  description: string | null;
  category: 'greeting' | 'closing' | 'acknowledgment' | 'standard_response' | 'custom';
  subject_template: string | null;
  body_template: string;
  created_by_user_id: string | null;
  updated_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  is_archived: boolean;
  archived_at: string | null;
  sort_order: number;
  is_default: boolean;
}

export interface EmailTemplateInsert {
  name: string;
  description?: string;
  category: EmailTemplate['category'];
  subject_template?: string;
  body_template: string;
  sort_order?: number;
  is_default?: boolean;
}

export interface EmailTemplateUpdate {
  name?: string;
  description?: string;
  category?: EmailTemplate['category'];
  subject_template?: string;
  body_template?: string;
  sort_order?: number;
  is_default?: boolean;
  is_archived?: boolean;
}
```

---

## 5. API Functions (useSupabaseData.ts additions)

```typescript
// Add to useSupabaseData.ts

// Fetch all templates for the office
const fetchEmailTemplates = useCallback(async (includeArchived = false) => {
  let query = supabase
    .from('email_templates')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (!includeArchived) {
    query = query.eq('is_archived', false);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as EmailTemplate[];
}, [supabase]);

// Create a new template
const createEmailTemplate = useCallback(async (template: EmailTemplateInsert) => {
  // Sanitize on client before sending
  const sanitizedBody = sanitizeTemplateInput(template.body_template);
  const sanitizedSubject = template.subject_template
    ? sanitizeTemplateInput(template.subject_template)
    : null;

  const { data, error } = await supabase
    .from('email_templates')
    .insert({
      ...template,
      body_template: sanitizedBody,
      subject_template: sanitizedSubject,
      office_id: officeId,
      created_by_user_id: userId,
    })
    .select()
    .single();

  if (error) throw error;
  return data as EmailTemplate;
}, [supabase, officeId, userId]);

// Update a template
const updateEmailTemplate = useCallback(async (
  id: string,
  updates: EmailTemplateUpdate
) => {
  const sanitizedUpdates = { ...updates };

  if (updates.body_template) {
    sanitizedUpdates.body_template = sanitizeTemplateInput(updates.body_template);
  }
  if (updates.subject_template) {
    sanitizedUpdates.subject_template = sanitizeTemplateInput(updates.subject_template);
  }

  const { data, error } = await supabase
    .from('email_templates')
    .update({
      ...sanitizedUpdates,
      updated_by_user_id: userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as EmailTemplate;
}, [supabase, userId]);

// Archive a template (soft delete)
const archiveEmailTemplate = useCallback(async (id: string) => {
  const { error } = await supabase
    .from('email_templates')
    .update({
      is_archived: true,
      archived_at: new Date().toISOString(),
      updated_by_user_id: userId,
    })
    .eq('id', id);

  if (error) throw error;
}, [supabase, userId]);

// Permanently delete (admin only)
const deleteEmailTemplate = useCallback(async (id: string) => {
  const { error } = await supabase
    .from('email_templates')
    .delete()
    .eq('id', id);

  if (error) throw error;
}, [supabase]);
```

---

## 6. Frontend Components

### Component Structure

```
src/components/templates/
├── EmailTemplatesPage.tsx        # Main management page
├── EmailTemplatesList.tsx        # List/grid of templates
├── EmailTemplateEditor.tsx       # Create/edit modal
├── EmailTemplatePreview.tsx      # Preview with sample data
├── TemplateInsertButton.tsx      # Button to insert template into editor
└── TemplatePicker.tsx            # Dialog to select a template
```

### Integration with ResponseComposer

```typescript
// In ResponseComposer.tsx, add template picker integration

import { TemplatePicker } from '@/components/templates/TemplatePicker';

function ResponseComposer({ ... }) {
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  const handleTemplateSelect = (template: EmailTemplate) => {
    // Insert template at cursor position or replace content
    if (template.subject_template && !subject) {
      setSubject(template.subject_template);
    }

    // Insert body template
    setBody(prev => prev ? `${prev}\n\n${template.body_template}` : template.body_template);
    setShowTemplatePicker(false);
  };

  return (
    <>
      <Button onClick={() => setShowTemplatePicker(true)}>
        Insert Template
      </Button>

      <TemplatePicker
        open={showTemplatePicker}
        onClose={() => setShowTemplatePicker(false)}
        onSelect={handleTemplateSelect}
      />

      {/* ... rest of composer */}
    </>
  );
}
```

### Integration with Bulk Responses

```typescript
// When creating a bulk_response, allow starting from a template

function PolicyEmailGroupDetailPage({ campaignId }) {
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);

  const handleCreateBulkResponse = () => {
    // Pre-populate ResponseComposer with template content
    return (
      <ResponseComposer
        mode="campaign"
        campaignId={campaignId}
        initialSubject={selectedTemplate?.subject_template}
        initialBody={selectedTemplate?.body_template}
      />
    );
  };
}
```

---

## 7. Migration Plan

### Step 1: Database Migration

```sql
-- migrations/20241218000001_email_templates.sql

-- 1. Create email_templates table
CREATE TABLE email_templates ( ... );

-- 2. Create RLS policies
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY ... ;

-- 3. Create audit log table
CREATE TABLE email_template_audit_log ( ... );

-- 4. Create trigger for updated_at
CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 5. Seed default templates (optional)
INSERT INTO email_templates (office_id, name, category, body_template)
SELECT
  id as office_id,
  'Acknowledgment' as name,
  'acknowledgment' as category,
  'Thank you for contacting {{mp_name}}''s office. We have received your message and will respond as soon as possible.

{{signature}}' as body_template
FROM offices;
```

### Step 2: Generate Types

```bash
npx supabase gen types typescript --local > database.types.ts
```

### Step 3: Frontend Implementation

1. Add sanitization utilities
2. Add API functions to `useSupabaseData.ts`
3. Create template management components
4. Integrate with ResponseComposer
5. Add settings page section for templates

---

## 8. Questions Before Implementation

### Critical Questions

1. **Template Sharing Scope**
   - Should templates be office-specific only (current assumption)?
   - Or should there be "global" templates available to all offices?
   - Should MPs be able to share templates between offices they manage?

2. **Approval Workflow**
   - Should templates require MP approval before use?
   - Or can staff create and use templates freely?
   - Should there be a "publish" step vs "draft" templates?

3. **Template Categories**
   - What categories make sense? Suggested:
     - `greeting` - Opening salutations
     - `closing` - Sign-offs
     - `acknowledgment` - "We received your email"
     - `standard_response` - Common policy responses
     - `custom` - User-defined
   - Are there other categories specific to MP offices?

4. **Variable Support**
   - Current variables: `{{full_name}}`, `{{mp_name}}`, `{{signature}}`
   - Should we add: `{{original_subject}}`, `{{office_name}}`, `{{reference_number}}`?
   - Should users be able to define custom variables?

### Implementation Questions

5. **Rich Text vs Plain Text**
   - You mentioned focusing on text rather than HTML
   - Should we support basic formatting (bold, italic, bullets)?
   - Or strictly plain text with line breaks only?

6. **Template Versioning**
   - Should we track edit history (audit log)?
   - Should users be able to "revert" to previous versions?

7. **Default Templates**
   - Should we seed default templates for new offices?
   - What should those defaults be?

8. **Import/Export**
   - Should users be able to export templates (for backup)?
   - Should admins be able to import templates from other offices?

9. **Template Usage Analytics**
   - Should we track how often each template is used?
   - Would this inform which templates are most valuable?

10. **Search & Filtering**
    - Just category filtering?
    - Full-text search on template content?
    - Tags on templates?

### Security Questions

11. **Rate Limiting**
    - Should we limit template creation (e.g., max 100 per office)?
    - This prevents potential abuse/spam

12. **Content Length Limits**
    - Max length for template body? (Suggested: 10,000 characters)
    - Max length for template name? (Suggested: 200 characters)

---

## 9. Alternative Approaches Considered

### Option A: Extend bulk_responses (Not Recommended)
Add a `is_template` flag to bulk_responses table.
- **Pros**: No new table, reuses existing code
- **Cons**: Conflates two different concepts, complicates queries, harder to maintain

### Option B: Simple Key-Value Store (Simpler but Limited)
```sql
CREATE TABLE office_snippets (
  id UUID PRIMARY KEY,
  office_id UUID,
  key TEXT,      -- 'greeting_formal', 'closing_casual'
  value TEXT
);
```
- **Pros**: Very simple
- **Cons**: No categorization, no metadata, no versioning

### Option C: Full Template Engine (Overkill)
Use a full templating engine like Handlebars with conditionals, loops, etc.
- **Pros**: Very powerful
- **Cons**: Complexity, learning curve, XSS risks increase

### Recommended: Option Proposed Above (Dedicated Table)
- Clean separation of concerns
- Proper metadata and categorization
- Audit trail capability
- Straightforward XSS prevention
- Easy integration with existing code patterns

---

## 10. Security Checklist

| Risk | Mitigation | Status |
|------|------------|--------|
| XSS via template body | Strip HTML tags, whitelist variables | ✅ Designed |
| XSS via variable values | HTML-escape all variable values at render time | ✅ Designed |
| SQL Injection | Parameterized queries via Supabase SDK | ✅ Built-in |
| Cross-tenant access | RLS policies with `get_my_office_id()` | ✅ Designed |
| Unauthorized template creation | RLS policy checks role | ✅ Designed |
| Unauthorized template deletion | Admin-only delete policy | ✅ Designed |
| Template variable injection | Whitelist allowed variables | ✅ Designed |
| Content-type confusion | Store as plain text, render with escaping | ✅ Designed |
| IDOR attacks | RLS + office_id validation | ✅ Designed |

---

## 11. Estimated Implementation Scope

| Component | Effort | Dependencies |
|-----------|--------|--------------|
| Database migration | 1-2 hours | None |
| Type generation | 15 min | Migration |
| Sanitization utilities | 1-2 hours | None |
| API functions | 2-3 hours | Migration, Types |
| Template management page | 3-4 hours | API functions |
| Template editor modal | 2-3 hours | Sanitization |
| Template picker dialog | 1-2 hours | API functions |
| ResponseComposer integration | 1-2 hours | Template picker |
| Bulk response integration | 1 hour | Template picker |
| Testing | 2-3 hours | All above |

**Total Estimated: 15-22 hours**

---

## 12. File Changes Summary

### New Files
- `supabase/migrations/20241218000001_email_templates.sql`
- `src/lib/templateSanitizer.ts`
- `src/components/templates/EmailTemplatesPage.tsx`
- `src/components/templates/EmailTemplatesList.tsx`
- `src/components/templates/EmailTemplateEditor.tsx`
- `src/components/templates/EmailTemplatePreview.tsx`
- `src/components/templates/TemplatePicker.tsx`

### Modified Files
- `src/lib/database.types.ts` (regenerated)
- `src/lib/useSupabaseData.ts` (add template functions)
- `src/components/mail/ResponseComposer.tsx` (add template button)
- `src/pages/policy/PolicyEmailGroupDetailPage.tsx` (add template selection)
- `src/pages/SettingsPage.tsx` (add templates section link)
- `src/App.tsx` (add route for templates page)

---

## Next Steps

1. **Answer the questions above** to finalize requirements
2. **Review and approve this architecture**
3. **Create the database migration**
4. **Implement frontend components**
5. **Write tests**
6. **Deploy and verify**
