# Outlook Worker Bot Integration - Implementation Summary

## Overview
The Outlook Worker Bot has been successfully integrated into the DearMP v2 frontend application. This integration enables automated email sending through Outlook Web Access using a hybrid browser automation approach.

## What Was Implemented

### 1. Configuration Setup
**File:** `/home/user/dearmp-v2/.env`

Added the Outlook Worker Bot URL configuration:
```env
VITE_OUTLOOK_WORKER_URL=https://sender.dearmp.uk
```

This environment variable tells the frontend where to find the Outlook Worker API.

---

### 2. Database Type Definitions
**File:** `/home/user/dearmp-v2/src/lib/database.types.ts`

Added TypeScript types for three new database tables:

#### `integration_outlook_sessions`
Stores authenticated Outlook session cookies for each office:
- `id`: Unique identifier
- `office_id`: Links to the office using this session
- `cookies`: Array of cookie objects captured from browser
- `is_connected`: Boolean flag indicating if session is active
- `last_used_at`: Timestamp of last email sent
- `created_at`, `updated_at`: Audit timestamps

#### `email_outbox_queue`
Queue table for outgoing emails processed by the worker:
- `id`: Unique identifier
- `office_id`: Office sending the email
- `to_email`, `cc_email`, `bcc_email`: Recipients
- `subject`: Email subject line
- `body_html`: HTML email body
- `status`: Enum ('pending' | 'processing' | 'sent' | 'failed')
- `error_log`: Error details if sending failed
- `case_id`, `campaign_id`: Optional links to cases/campaigns
- `created_at`, `processed_at`: Timestamps

#### `browser_automation_lock`
Singleton lock table to ensure only one authentication session at a time:
- `id`: Always 1 (singleton)
- `is_locked`: Boolean lock status
- `locked_by_office_id`: Which office currently holds the lock
- `locked_at`: When the lock was acquired

---

### 3. Outlook Connection Component
**File:** `/home/user/dearmp-v2/src/components/settings/OutlookConnect.tsx`

A sophisticated state machine component that manages the Outlook authentication flow:

#### State Machine
The component implements a 5-state FSM:

1. **Idle** - Initial state, shows "Connect Outlook Account" button
2. **Starting** - Calling worker API to launch remote browser
3. **Interactive** - Shows VNC iframe where user logs into Outlook
4. **Capturing** - Saving cookies from successful login
5. **Connected** - Session saved, ready to send emails
6. **Error** - Error handling state

#### Key Features
- **VNC Iframe Integration**: Embeds the remote browser session directly in the UI
- **Real-time Status**: Checks Supabase for existing sessions on mount
- **User Guidance**: Clear instructions for completing 2FA during login
- **Session Management**: Connect, disconnect, and status checking
- **Error Handling**: Graceful error messages with retry options

#### API Endpoints Used
- `POST /api/session/start` - Launches remote browser
- `POST /api/session/capture` - Saves authentication cookies
- `POST /api/session/cancel` - Cancels active session

---

### 4. Settings Page Integration
**File:** `/home/user/dearmp-v2/src/pages/SettingsPage.tsx`

Modified the Settings page to include the OutlookConnect component:

```tsx
{/* Outlook Integration */}
{currentOffice?.id && <OutlookConnect officeId={currentOffice.id} />}
```

The component is conditionally rendered when the user has an active office, ensuring the office_id is always available.

---

### 5. Email Sending via Queue
**File:** `/home/user/dearmp-v2/src/components/mail/ResponseComposer.tsx`

Completely replaced mock email sending with real database queue integration:

#### Changes Made

**Casework Mode (Individual Emails)**:
```typescript
const { data: queueData, error } = await supabase
  .from('email_outbox_queue')
  .insert({
    office_id: currentOffice.id,
    to_email: lastMessage.from_email,
    subject: `Re: ${originalSubject}`,
    body_html: html,
    case_id: caseId,
    status: 'pending',
  })
  .select()
  .single();
```

**Campaign Mode (Bulk Responses)**:
```typescript
await supabase
  .from('bulk_responses')
  .insert({
    office_id: currentOffice.id,
    campaign_id: campaignId,
    subject: 'Campaign Response',
    body_markdown: plainText,
    status: 'draft',
  });
```

#### How It Works
1. User composes email in the rich text editor
2. Clicks "Send"
3. Email is inserted into `email_outbox_queue` with status `pending`
4. Supabase Realtime notifies the Outlook Worker
5. Worker picks up the job, sends via Playwright
6. Worker updates status to `processing` → `sent` or `failed`

---

### 6. Real-time Status Updates
**File:** `/home/user/dearmp-v2/src/components/mail/ResponseComposer.tsx`

Added Supabase Realtime subscription to track email sending progress:

```typescript
useEffect(() => {
  if (!queuedEmailId) return;

  const channel = supabase
    .channel(`email-queue-${queuedEmailId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'email_outbox_queue',
      filter: `id=eq.${queuedEmailId}`,
    }, (payload) => {
      const newStatus = payload.new.status;
      setSendingStatus(newStatus);

      if (newStatus === 'sent') {
        setSuccess(true);
      } else if (newStatus === 'failed') {
        setError(payload.new.error_log);
      }
    })
    .subscribe();

  return () => supabase.removeChannel(channel);
}, [queuedEmailId]);
```

#### User Experience
Users now see real-time feedback as emails progress:
- ✅ **Queued**: "Email queued. The Outlook Worker will send it shortly..."
- ⏳ **Processing**: "Email is being sent through Outlook..."
- ✅ **Sent**: "Email sent successfully!"
- ❌ **Failed**: Shows error log from worker

---

## Architecture Flow

### Authentication Flow
```
User → Settings Page → OutlookConnect Component
                         ↓
                    POST /api/session/start
                         ↓
              Outlook Worker launches browser
                         ↓
                    Returns VNC URL
                         ↓
              User logs in via VNC iframe
                         ↓
                    POST /api/session/capture
                         ↓
         Worker scrapes cookies → Supabase
                         ↓
              Session ready for sending
```

### Email Sending Flow
```
User → Response Composer → Compose Email
                              ↓
                         Click "Send"
                              ↓
              Insert into email_outbox_queue
                              ↓
              Supabase Realtime notifies Worker
                              ↓
         Worker loads session cookies
                              ↓
         Playwright opens Outlook → Sends email
                              ↓
         Worker updates status to 'sent'
                              ↓
         Frontend receives realtime update
                              ↓
         UI shows "Email sent successfully!"
```

---

## Database Schema Required

For this integration to work, you need to create these tables in Supabase:

### SQL Migration
```sql
-- Browser automation lock (singleton)
CREATE TABLE browser_automation_lock (
  id INTEGER PRIMARY KEY DEFAULT 1,
  is_locked BOOLEAN DEFAULT FALSE,
  locked_by_office_id UUID REFERENCES offices(id),
  locked_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT single_row CHECK (id = 1)
);

-- Outlook session storage
CREATE TABLE integration_outlook_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES offices(id),
  cookies JSONB[] NOT NULL,
  is_connected BOOLEAN DEFAULT TRUE,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(office_id)
);

-- Email outbox queue
CREATE TABLE email_outbox_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES offices(id),
  to_email TEXT NOT NULL,
  cc_email TEXT,
  bcc_email TEXT,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  error_log TEXT,
  case_id UUID REFERENCES cases(id),
  campaign_id UUID REFERENCES campaigns(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE email_outbox_queue;

-- Create index for worker queries
CREATE INDEX idx_email_queue_status_office ON email_outbox_queue(status, office_id);
CREATE INDEX idx_email_queue_created ON email_outbox_queue(created_at);
```

---

## Testing Checklist

### Prerequisites
- [ ] Outlook Worker Bot running at `https://sender.dearmp.uk`
- [ ] Selenium Grid with VNC access at `https://login.dearmp.uk`
- [ ] Supabase tables created (see SQL above)
- [ ] Realtime enabled on `email_outbox_queue` table
- [ ] Frontend environment variable set: `VITE_OUTLOOK_WORKER_URL=https://sender.dearmp.uk`

### Feature A: Authentication
- [ ] Navigate to Settings page
- [ ] Click "Connect Outlook Account"
- [ ] Verify VNC iframe appears
- [ ] Complete Outlook login (including 2FA)
- [ ] Click "I have finished logging in"
- [ ] Verify success message and "Connected" status
- [ ] Refresh page - connection status persists
- [ ] Click "Disconnect Outlook" - status updates correctly

### Feature B: Email Sending
- [ ] Navigate to a case with messages
- [ ] Open Response Composer
- [ ] Compose a reply
- [ ] Click "Send"
- [ ] Verify "Email queued" message appears
- [ ] Watch for "Email is being sent..." status
- [ ] Verify "Email sent successfully!" final status
- [ ] Check recipient's inbox for received email

### Feature C: Error Handling
- [ ] Disconnect Outlook in Settings
- [ ] Try to send an email
- [ ] Verify graceful error message
- [ ] Reconnect Outlook
- [ ] Try sending again - should succeed
- [ ] Simulate worker failure (stop worker service)
- [ ] Send email - should timeout gracefully
- [ ] Check error_log in email_outbox_queue table

---

## Security Considerations

### Implemented
✅ Office-level isolation (emails only queue for current office)
✅ Supabase RLS should restrict queue access by office_id
✅ VNC iframe uses sandbox attribute for isolation
✅ Error messages don't expose sensitive details

### Recommended Additions
⚠️ Add RLS policies to all three new tables
⚠️ Implement rate limiting on email queue insertions
⚠️ Add audit logging for email send operations
⚠️ Encrypt session cookies at rest in database
⚠️ Add session expiry/refresh logic
⚠️ Validate email addresses before queueing

---

## Future Enhancements

### Phase 2 Features
- **CC/BCC Support**: Add recipient fields to composer UI
- **Attachments**: Support file uploads in queue
- **Templates**: Pre-built email templates with variables
- **Scheduling**: Queue emails for future sending
- **Retry Logic**: Automatic retry for failed sends
- **Batch Processing**: Send multiple emails in one worker cycle
- **Analytics**: Track open rates, reply rates, etc.

### Phase 3 Features
- **Multiple Accounts**: Support per-user Outlook accounts
- **Gmail Support**: Extend to other email providers
- **Email Threading**: Proper In-Reply-To headers
- **Draft Saving**: Auto-save drafts to queue
- **Send Later**: Schedule send times
- **Undo Send**: Cancel queued emails before processing

---

## Troubleshooting

### Email stuck in "queued" status
**Cause**: Worker not receiving Realtime notifications
**Fix**:
1. Check worker is running: `curl https://sender.dearmp.uk/health`
2. Verify Realtime is enabled on table
3. Check worker logs for errors
4. Restart worker service

### "No Outlook session found" error
**Cause**: Session not connected or expired
**Fix**:
1. Go to Settings → Outlook Integration
2. Click "Connect Outlook Account"
3. Complete login flow
4. Verify "Connected" status appears

### VNC iframe not loading
**Cause**: CORS or network issues
**Fix**:
1. Check VNC_URL in worker .env
2. Verify `https://login.dearmp.uk` is accessible
3. Check browser console for CORS errors
4. Ensure iframe sandbox allows necessary permissions

### Realtime updates not working
**Cause**: Supabase Realtime not configured
**Fix**:
1. Run: `ALTER PUBLICATION supabase_realtime ADD TABLE email_outbox_queue;`
2. Check Supabase dashboard → Database → Replication
3. Ensure table is listed under published tables
4. Restart frontend to reconnect WebSocket