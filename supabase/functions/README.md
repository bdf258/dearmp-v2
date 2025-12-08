# DearMP Email Ingestion Edge Functions

This directory contains Supabase Edge Functions for AI-powered email classification and response generation.

## Overview

The email ingestion system automatically processes incoming emails when they are inserted into the `messages` table:

1. **Classification** - Uses Gemini Flash Lite to classify emails as:
   - `policy` - Emails about political issues, legislation, or campaigns
   - `casework` - Personal assistance requests (housing, benefits, etc.)
   - `campaign` - Coordinated campaign emails (similar content from multiple senders)
   - `spam` - Unsolicited/irrelevant content
   - `personal` - Non-constituent correspondence

2. **Tagging** - Suggests and applies tags from the office's tag list based on email content

3. **Assignment** - Suggests a staff member to handle the email based on:
   - Office settings (default assignees)
   - User specialties and workload
   - Email type (policy vs casework)

4. **Draft Response Generation**:
   - **Policy emails**: Generates individual draft responses for MP review
   - **Campaign emails**: Generates a bulk response template for the first email; subsequent campaign emails use the same template
   - **Casework emails**: No automatic draft (requires case-specific handling)

## Setup

### 1. Prerequisites

- Supabase project with Edge Functions enabled
- Google Gemini API key ([Get one here](https://aistudio.google.com/apikey))

### 2. Environment Variables

Set these in your Supabase project dashboard under Settings > Edge Functions:

```bash
GEMINI_API_KEY=your-gemini-api-key
```

The `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are automatically provided.

### 3. Deploy the Functions

```bash
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Deploy the email-ingestion function
supabase functions deploy email-ingestion
```

### 4. Run Database Migrations

```bash
# Apply all migrations
supabase db push
```

## How It Works

### Trigger Flow

1. New row inserted into `messages` table
2. Database trigger `trigger_email_ingestion` fires
3. Message is added to `ai_processing_queue`
4. Webhook calls the `email-ingestion` edge function
5. Edge function processes the email:
   - Classifies with Gemini
   - Generates fingerprint for campaign detection
   - Suggests tags and assignment
   - Creates draft response if applicable
6. Results are written back to the database

### Campaign Detection

Emails are identified as campaign emails through:

1. **Content Fingerprinting** - A hash of normalized email content
2. **Subject Pattern Matching** - Regex patterns defined in campaigns
3. **AI Classification** - Gemini detects coordinated campaign language

When a campaign email is detected:
- First email: Generate a new bulk response template
- Subsequent emails: Link to the existing bulk response

### Response Handling

| Email Type | Draft Created? | Notes |
|------------|---------------|-------|
| Policy (individual) | Yes | Individual draft for MP review |
| Policy (campaign) | First only | Bulk template created, others linked |
| Casework | No | Requires case-specific handling |
| Spam | No | - |
| Personal | No | - |

## API

### POST /email-ingestion

Process a single message.

**Request:**
```json
{
  "message_id": "uuid",
  "office_id": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "classification": {
      "email_type": "policy",
      "is_policy_email": true,
      "confidence": 0.95,
      "reasoning": "Email discusses climate legislation..."
    },
    "tags": ["Environment", "Legislation"],
    "assigned_to": "John Smith",
    "draft_response_created": true,
    "existing_bulk_response": false
  }
}
```

## Database Schema

### Key Tables

- `messages` - Email storage with classification fields
- `message_tags` - Junction table for tags
- `draft_responses` - AI-generated individual drafts
- `bulk_responses` - Templates for campaign emails
- `ai_processing_queue` - Queue for pending processing
- `office_settings` - Per-office AI configuration

### Important Fields in `messages`

- `is_policy_email` - Boolean classification result
- `email_type` - Detailed type (policy/casework/campaign/etc.)
- `classification_confidence` - AI confidence score (0-1)
- `fingerprint_hash` - Content hash for campaign matching
- `is_campaign_email` - Whether part of organized campaign
- `ai_processed_at` - Timestamp of AI processing

## Configuration

### Office Settings

Configure per-office AI behavior in `office_settings`:

```sql
INSERT INTO office_settings (office_id, ...)
VALUES (
  'your-office-id',
  ai_classification_enabled := true,
  ai_draft_response_enabled := true,
  ai_tagging_enabled := true,
  auto_assign_enabled := true,
  policy_response_style := 'formal' -- or 'friendly', 'brief'
);
```

### Tags

Add tags with descriptions and keywords for better AI matching:

```sql
INSERT INTO tags (office_id, name, description, auto_assign_keywords)
VALUES (
  'your-office-id',
  'Environment',
  'Climate change, pollution, environmental policy',
  ARRAY['climate', 'environment', 'green', 'carbon']
);
```

## Monitoring

### Check Processing Queue

```sql
SELECT * FROM ai_processing_queue
WHERE status IN ('pending', 'processing', 'failed')
ORDER BY created_at DESC;
```

### View Classification Stats

```sql
SELECT * FROM get_classification_stats('your-office-id', 30);
```

### View Pending Triage

```sql
SELECT * FROM messages_pending_triage
WHERE office_id = 'your-office-id';
```

## Troubleshooting

### Messages Not Processing

1. Check the `ai_processing_queue` for failed items
2. Verify `GEMINI_API_KEY` is set correctly
3. Check Edge Function logs in Supabase Dashboard

### Wrong Classifications

1. Add more descriptive `description` to tags
2. Update `auto_assign_keywords` for tags
3. Review `classification_reasoning` field for insights

### Missing Draft Responses

1. Verify `ai_draft_response_enabled` is true in office settings
2. Check that email was classified as policy (not casework)
3. For campaigns, check `bulk_responses` table
