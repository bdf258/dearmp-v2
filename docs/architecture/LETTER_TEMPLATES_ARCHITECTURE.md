# Letter Templates Feature Architecture

> **Author:** Claude Code
> **Date:** 2025-12-17
> **Status:** Proposal

## Executive Summary

This document outlines the architecture for a letter-writing feature that enables staffers to create, design, and use template letters for responding to constituent cases and campaigns. The system supports multiple template types (ministerial letters, campaign responses, etc.) with WYSIWYG editing and secure document generation.

---

## Table of Contents

1. [Requirements Analysis](#requirements-analysis)
2. [WYSIWYG Editor Options](#wysiwyg-editor-options)
3. [Document Generation: Carbone vs Alternatives](#document-generation-carbone-vs-alternatives)
4. [Recommended Architecture](#recommended-architecture)
5. [Database Schema](#database-schema)
6. [Security Considerations](#security-considerations)
7. [Implementation Phases](#implementation-phases)

---

## Requirements Analysis

### Core Requirements

1. **Template Creation** - Staffers can create reusable letter templates
2. **Template Types** - Support for different letter categories:
   - Ministerial letters (formal government correspondence)
   - Campaign responses (bulk reply templates)
   - Acknowledgement letters
   - Referral letters (to other departments/agencies)
   - Follow-up letters
3. **WYSIWYG Design** - Visual editor for designing letter layouts
4. **Variable Substitution** - Dynamic placeholders for personalisation (constituent name, address, case reference, etc.)
5. **Document Output** - Generate PDF, DOCX for printing/sending
6. **Approval Workflow** - MP/senior staff approval before sending (leverage existing `bulk_responses` workflow)
7. **Audit Trail** - Track who created/modified/sent letters

### Existing Codebase Assets

| Component | Status | Location |
|-----------|--------|----------|
| TipTap Editor | ✅ Installed | `src/components/mail/ReplyEditor.tsx` |
| Variable Substitution | ✅ Working | `{{full_name}}`, `{{constituent_name}}` in RPC functions |
| Approval Workflow | ✅ Working | `bulk_responses` status workflow |
| react-letter | ✅ Installed | Package.json (unused) |
| Letters Page | 🔲 Placeholder | `src/pages/office/LettersPage.tsx` |
| Carbone Instance | ✅ Running | Separate Dokploy container |

---

## WYSIWYG Editor Options

### Option 1: TipTap (Recommended for Content)

**Already in use in this codebase.**

| Pros | Cons |
|------|------|
| Already integrated | Not designed for page layout |
| MIT licensed, free | No native DOCX/PDF export |
| Excellent React support | Limited drag-drop layout |
| Extensible plugin system | |
| Active development | |

**Best for:** Rich text content editing within a predefined layout structure.

**Sources:**
- [TipTap Official](https://tiptap.dev/product/editor)

---

### Option 2: GrapesJS (Best for Visual Layout Design)

Open-source web builder framework with drag-and-drop interface.

| Pros | Cons |
|------|------|
| True WYSIWYG layout design | Complex integration with React |
| Drag-drop blocks/components | Steeper learning curve |
| Newsletter preset available | Not purpose-built for formal letters |
| Export to HTML | Requires customisation for letter formats |
| Active community | |

**Best for:** If you need users to design page layouts visually (headers, footers, multi-column).

**Sources:**
- [GrapesJS Demo - Newsletter Editor](https://grapesjs.com/demo-newsletter-editor.html)
- [GrapesJS GitHub](https://github.com/GrapesJS/grapesjs)

---

### Option 3: Unlayer (Commercial Alternative)

Commercial embeddable email/document editor.

| Pros | Cons |
|------|------|
| Polished, production-ready | Paid service |
| React SDK available | External dependency |
| Drag-drop design | Data leaves your infrastructure |
| Template library | |

**Best for:** Teams wanting a ready-made solution and willing to pay.

**Sources:**
- [Unlayer vs GrapesJS Comparison](https://unlayer.com/blog/grapesjs-alternative-top-options)

---

### Option 4: Block-Based Approach with TipTap (Recommended)

Extend TipTap with custom nodes for letter-specific blocks.

```
┌─────────────────────────────────────┐
│  [Letterhead Block]                 │  ← Office logo, address
├─────────────────────────────────────┤
│  Date: {{date}}                     │
│  Reference: {{case_reference}}      │
├─────────────────────────────────────┤
│  {{constituent_address}}            │  ← Address block
├─────────────────────────────────────┤
│  Dear {{salutation}},               │
│                                     │
│  [Body Content - TipTap Editor]     │  ← Rich text
│                                     │
├─────────────────────────────────────┤
│  Yours sincerely,                   │
│  [Signature Block]                  │
│  {{mp_name}}                        │
│  Member of Parliament for {{cons}} │
└─────────────────────────────────────┘
```

| Pros | Cons |
|------|------|
| Uses existing TipTap | Requires custom development |
| Tailored for formal letters | Less flexible than GrapesJS |
| Consistent letter structure | |
| Easier template management | |

**This is the recommended approach for DearMP.**

---

## Document Generation: Carbone vs Alternatives

### Carbone (Recommended ✅)

You already have Carbone running in a separate Dokploy container. This is the optimal choice.

**How Carbone Works:**
1. Create template in LibreOffice/Word with placeholders: `{d.constituent.name}`
2. Send JSON data + template to Carbone API
3. Receive generated document (PDF, DOCX, ODT)

| Pros | Cons |
|------|------|
| ✅ Already deployed | Requires LibreOffice for PDF conversion |
| Fast (~10ms per document) | Community edition is 1 version behind |
| Supports DOCX, PDF, ODT, etc | Template syntax differs from your `{{var}}` |
| Template in Word = easy for staff | |
| Self-hosted = data stays internal | |
| Minimal dependencies | |

**Carbone Placeholder Syntax:**
```
{d.constituent.full_name}
{d.case.reference_number}
{d.mp.name}
{d.office.address}
{#d.items}{d.item_name}{/d.items}  ← loops
```

**Sources:**
- [Carbone.io](https://carbone.io)
- [Carbone GitHub](https://github.com/carboneio/carbone)
- [Carbone Documentation](https://carbone.io/documentation.html)

---

### Alternative: docx-templates (Node.js Library)

If you want to avoid the separate Carbone container.

```bash
npm install docx-templates
```

| Pros | Cons |
|------|------|
| Pure Node.js | DOCX only (no native PDF) |
| No external service | Need separate PDF conversion |
| Simple API | Less mature than Carbone |

**Verdict:** Stick with Carbone since it's already running.

---

### Alternative: PDFKit / React-PDF

For generating PDFs directly from React/Node.

| Pros | Cons |
|------|------|
| Pure JavaScript | Complex layouts are difficult |
| No external dependencies | Not WYSIWYG for staff |
| | Templates are code, not files |

**Verdict:** Not suitable for staff-designed templates.

---

## Recommended Architecture

### Hybrid Approach: TipTap + Carbone

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────┐ │
│  │ Template Editor │    │ Template Library│    │ Letter      │ │
│  │ (TipTap)        │───▶│ (List/Preview)  │◀───│ Generator   │ │
│  └─────────────────┘    └─────────────────┘    └─────────────┘ │
│         │                       │                     │        │
│         ▼                       ▼                     ▼        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Supabase Client (RLS Protected)             │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SUPABASE (Backend)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────┐ │
│  │ letter_templates│    │ generated_      │    │ audit_logs  │ │
│  │ (Table)         │    │ letters (Table) │    │ (Table)     │ │
│  └─────────────────┘    └─────────────────┘    └─────────────┘ │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Edge Function: generate-letter              │   │
│  │  - Validates input                                       │   │
│  │  - Substitutes variables                                 │   │
│  │  - Calls Carbone API                                     │   │
│  │  - Stores generated document                             │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CARBONE (Dokploy Container)                   │
├─────────────────────────────────────────────────────────────────┤
│  - Receives template + JSON data                                │
│  - Generates PDF/DOCX                                           │
│  - Returns binary document                                       │
└─────────────────────────────────────────────────────────────────┘
```

### Template Storage Strategy

**Option A: Store HTML in Database (Recommended for v1)**
- Template content stored as HTML in `letter_templates.body_html`
- Convert to DOCX template dynamically when generating
- Simpler for staff (TipTap WYSIWYG)

**Option B: Store DOCX Templates in Supabase Storage**
- Upload pre-designed DOCX templates
- More control over exact layout
- Requires staff to use Word/LibreOffice
- Better for complex ministerial layouts

**Recommendation:** Start with Option A for simplicity, add Option B later for advanced templates.

---

## Database Schema

### New Tables

```sql
-- ============================================================================
-- LETTER TEMPLATES
-- ============================================================================
CREATE TABLE IF NOT EXISTS letter_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,

  -- Template identification
  name VARCHAR(255) NOT NULL,
  description TEXT,
  template_type VARCHAR(50) NOT NULL DEFAULT 'general',
    -- 'ministerial', 'campaign_response', 'acknowledgement',
    -- 'referral', 'follow_up', 'general'

  -- Content
  body_html TEXT NOT NULL,           -- TipTap HTML content
  body_markdown TEXT,                -- Markdown version (optional)
  template_file_path TEXT,           -- Supabase Storage path for DOCX template (Option B)

  -- Metadata
  available_variables JSONB DEFAULT '[]'::jsonb,
    -- e.g., ["constituent_name", "case_reference", "mp_name"]
  default_subject VARCHAR(500),      -- For email variants

  -- Status
  status VARCHAR(20) DEFAULT 'draft',  -- 'draft', 'active', 'archived'
  is_default BOOLEAN DEFAULT FALSE,

  -- Audit
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_letter_templates_office ON letter_templates(office_id);
CREATE INDEX idx_letter_templates_type ON letter_templates(template_type);
CREATE INDEX idx_letter_templates_status ON letter_templates(status);

-- ============================================================================
-- GENERATED LETTERS (Audit Trail)
-- ============================================================================
CREATE TABLE IF NOT EXISTS generated_letters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,

  -- Source references
  template_id UUID REFERENCES letter_templates(id) ON DELETE SET NULL,
  case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  constituent_id UUID REFERENCES constituents(id) ON DELETE SET NULL,

  -- Generated content
  subject VARCHAR(500),
  body_html TEXT NOT NULL,           -- Final rendered HTML
  document_path TEXT,                -- Supabase Storage path for PDF/DOCX
  document_format VARCHAR(10) DEFAULT 'pdf',  -- 'pdf', 'docx'

  -- Variable data snapshot (for audit purposes)
  variable_data JSONB NOT NULL,

  -- Delivery tracking
  status VARCHAR(20) DEFAULT 'generated',
    -- 'generated', 'pending_approval', 'approved', 'sent', 'failed'
  sent_at TIMESTAMPTZ,
  sent_via VARCHAR(20),              -- 'email', 'print', 'download'

  -- Audit
  generated_by UUID REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_generated_letters_office ON generated_letters(office_id);
CREATE INDEX idx_generated_letters_case ON generated_letters(case_id);
CREATE INDEX idx_generated_letters_template ON generated_letters(template_id);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================
ALTER TABLE letter_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_letters ENABLE ROW LEVEL SECURITY;

-- Office-scoped access
CREATE POLICY "Users can view own office letter templates" ON letter_templates
  FOR SELECT USING (office_id = get_my_office_id());

CREATE POLICY "Staff can manage letter templates" ON letter_templates
  FOR ALL USING (
    office_id = get_my_office_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'staff')
    )
  );

CREATE POLICY "Users can view own office generated letters" ON generated_letters
  FOR SELECT USING (office_id = get_my_office_id());

CREATE POLICY "Staff can create generated letters" ON generated_letters
  FOR INSERT WITH CHECK (
    office_id = get_my_office_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'staff')
    )
  );
```

### Available Variables

Standard variables that can be used in templates:

| Variable | Description | Source |
|----------|-------------|--------|
| `{{constituent_name}}` | Full name | constituents.full_name |
| `{{constituent_title}}` | Title (Mr/Mrs/Ms/Dr) | constituents.title |
| `{{constituent_address}}` | Formatted address | constituent_contacts |
| `{{constituent_postcode}}` | Postcode | constituent_contacts |
| `{{case_reference}}` | Case reference number | cases.reference_number |
| `{{case_title}}` | Case title | cases.title |
| `{{mp_name}}` | MP's name | offices.mp_name |
| `{{mp_title}}` | MP's title | offices.mp_title |
| `{{constituency}}` | Constituency name | offices.constituency |
| `{{office_address}}` | Office address | offices.address |
| `{{date}}` | Current date | Generated |
| `{{date_formal}}` | Formal date (1st January 2025) | Generated |

---

## Security Considerations

### 1. Template Injection Prevention

**Risk:** Malicious users could inject code into templates.

**Mitigations:**

```typescript
// NEVER eval() or directly execute template content
// Use a safe template engine with sandboxing

// Safe: Allowlist-based variable substitution
const ALLOWED_VARIABLES = [
  'constituent_name', 'constituent_address', 'case_reference',
  'mp_name', 'date', 'office_address'
];

function substituteVariables(template: string, data: Record<string, string>): string {
  let result = template;

  for (const [key, value] of Object.entries(data)) {
    // Only substitute allowed variables
    if (!ALLOWED_VARIABLES.includes(key)) {
      console.warn(`Blocked unknown variable: ${key}`);
      continue;
    }

    // Escape HTML to prevent XSS
    const safeValue = escapeHtml(value);
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), safeValue);
  }

  return result;
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
```

**Carbone-Specific:**
- Carbone has built-in safe variable generation
- Uses dictionary-based value access to prevent injection
- Never pass raw user input as template syntax

### 2. Authorization (Prevent IDOR)

Follow the existing pattern from `security_fixes.sql`:

```sql
CREATE OR REPLACE FUNCTION public.generate_letter(
  p_template_id UUID,
  p_case_id UUID,
  p_office_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_caller_office_id UUID;
BEGIN
  -- SECURITY: Verify caller's office
  v_caller_office_id := get_my_office_id();

  IF v_caller_office_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: No office context';
  END IF;

  IF v_caller_office_id != p_office_id THEN
    RAISE EXCEPTION 'Unauthorized: Office mismatch';
  END IF;

  -- Verify template belongs to office
  IF NOT EXISTS (
    SELECT 1 FROM letter_templates
    WHERE id = p_template_id AND office_id = p_office_id
  ) THEN
    RAISE EXCEPTION 'Template not found or unauthorized';
  END IF;

  -- Verify case belongs to office
  IF p_case_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM cases
    WHERE id = p_case_id AND office_id = p_office_id
  ) THEN
    RAISE EXCEPTION 'Case not found or unauthorized';
  END IF;

  -- ... generation logic ...
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

### 3. Carbone API Security

**Network Security:**
```yaml
# docker-compose.yml - Carbone should NOT be publicly exposed
services:
  carbone:
    # No external port mapping
    networks:
      - internal
    # Only accessible from Supabase Edge Functions
```

**API Authentication (if exposed):**
```typescript
// Edge Function: generate-letter
const CARBONE_API_URL = Deno.env.get('CARBONE_API_URL');
const CARBONE_API_KEY = Deno.env.get('CARBONE_API_KEY');

const response = await fetch(`${CARBONE_API_URL}/render`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${CARBONE_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    template: templateBase64,
    data: variableData,
    convertTo: 'pdf'
  })
});
```

### 4. Input Validation

```typescript
// Validate all inputs before processing
import { z } from 'zod';

const GenerateLetterSchema = z.object({
  template_id: z.string().uuid(),
  case_id: z.string().uuid().optional(),
  constituent_id: z.string().uuid().optional(),
  output_format: z.enum(['pdf', 'docx']).default('pdf'),
  // Prevent arbitrary data injection
  custom_variables: z.record(z.string().max(1000)).optional()
});
```

### 5. Content Security

- **DOMPurify** (already installed) - Sanitize HTML content before storage
- **CSP Headers** - Prevent inline script execution in rendered letters
- **File Type Validation** - Only accept .docx, .odt for uploaded templates

```typescript
import DOMPurify from 'dompurify';

function sanitizeTemplateContent(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'blockquote', 'h1', 'h2', 'h3'],
    ALLOWED_ATTR: ['class', 'style'],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed'],
    FORBID_ATTR: ['onclick', 'onerror', 'onload']
  });
}
```

### 6. Audit Logging

Leverage existing `audit_logs` table:

```typescript
// Log all letter generation
await supabase.from('audit_logs').insert({
  action: 'GENERATE_LETTER',
  actor_id: user.id,
  entity_type: 'generated_letter',
  entity_id: letterId,
  metadata: {
    template_id: templateId,
    case_id: caseId,
    output_format: 'pdf'
  },
  ip_address: request.headers.get('x-forwarded-for')
});
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1)

1. Create database migration with new tables
2. Create basic `LetterTemplatesPage` with CRUD
3. Extend TipTap editor with variable insertion buttons
4. Create template preview component

**Files to Create/Modify:**
- `supabase/migrations/YYYYMMDD_letter_templates.sql`
- `src/pages/office/LetterTemplatesPage.tsx`
- `src/components/letters/TemplateEditor.tsx`
- `src/components/letters/TemplatePreview.tsx`

### Phase 2: Generation (Week 2)

1. Create Supabase Edge Function for letter generation
2. Integrate with Carbone API
3. Implement variable substitution
4. Store generated documents in Supabase Storage

**Files to Create:**
- `supabase/functions/generate-letter/index.ts`
- `src/lib/letterGeneration.ts`

### Phase 3: Integration (Week 3)

1. Add "Generate Letter" button to Case detail page
2. Add "Generate Bulk Response" to Campaign pages
3. Implement letter history/audit view
4. Add download/print functionality

**Files to Modify:**
- `src/pages/casework/CaseDetailPage.tsx`
- `src/pages/policy/PolicyEmailGroupDetailPage.tsx`

### Phase 4: Advanced Features (Week 4+)

1. DOCX template upload for complex layouts
2. Approval workflow for letters (like bulk_responses)
3. Email delivery integration
4. Template versioning

---

## Appendix: Carbone Integration Example

### Edge Function: generate-letter

```typescript
// supabase/functions/generate-letter/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CARBONE_URL = Deno.env.get('CARBONE_API_URL')!;

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { template_id, case_id, constituent_id, output_format } = await req.json();

  // 1. Fetch template
  const { data: template } = await supabase
    .from('letter_templates')
    .select('*')
    .eq('id', template_id)
    .single();

  // 2. Fetch variable data
  const variableData = await buildVariableData(supabase, case_id, constituent_id);

  // 3. Generate with Carbone
  const response = await fetch(`${CARBONE_URL}/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: variableData,
      template: template.body_html,
      convertTo: output_format
    })
  });

  const document = await response.arrayBuffer();

  // 4. Store in Supabase Storage
  const fileName = `letters/${crypto.randomUUID()}.${output_format}`;
  await supabase.storage.from('documents').upload(fileName, document);

  // 5. Create audit record
  await supabase.from('generated_letters').insert({
    template_id,
    case_id,
    constituent_id,
    document_path: fileName,
    document_format: output_format,
    variable_data: variableData,
    generated_by: (await supabase.auth.getUser()).data.user?.id
  });

  return new Response(JSON.stringify({ path: fileName }), {
    headers: { 'Content-Type': 'application/json' }
  });
});
```

---

## References

### WYSIWYG Editors
- [TipTap Official](https://tiptap.dev/product/editor)
- [GrapesJS GitHub](https://github.com/GrapesJS/grapesjs)
- [GrapesJS Newsletter Editor Demo](https://grapesjs.com/demo-newsletter-editor.html)
- [Top 5 GrapesJS Alternatives 2025](https://unlayer.com/blog/grapesjs-alternative-top-options)
- [10 Best Open Source WYSIWYG Editors 2025](https://www.tiny.cloud/blog/open-source-wysiwyg-html-editor/)

### Document Generation
- [Carbone.io](https://carbone.io)
- [Carbone GitHub](https://github.com/carboneio/carbone)
- [Carbone Documentation](https://carbone.io/documentation.html)
- [Carbone npm Package](https://www.npmjs.com/package/carbone)
- [Carbone Alternatives 2025](https://cx-reports.com/blog/carbone-io-alternatives)

### Security
- [Template Injection Vulnerabilities](https://www.paloaltonetworks.com/blog/cloud-security/template-injection-vulnerabilities/)
- [CWE-1336: Template Engine Injection](https://cwe.mitre.org/data/definitions/1336.html)
- [API Security Best Practices 2025](https://konghq.com/blog/engineering/api-security-best-practices)

---

## Decision Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Content Editor | TipTap (existing) | Already integrated, extensible |
| Layout Approach | Block-based TipTap | Better for formal letter structure |
| Document Generation | Carbone (existing) | Already deployed, fast, self-hosted |
| Template Storage | Database (HTML) | Simpler for v1, add DOCX upload later |
| Variable Syntax | `{{variable}}` | Consistent with existing system |
| Authorisation | RPC with office check | Follows existing security patterns |
