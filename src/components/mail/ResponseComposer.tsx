import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ReplyEditor } from './ReplyEditor';
import { AlertCircle } from 'lucide-react';
import { useSupabase } from '@/lib/SupabaseContext';

interface Message {
  id: string;
  from_email?: string;
  from_name?: string;
  to_email?: string;
  to_name?: string;
  subject?: string | null;
  body?: string;
  snippet?: string | null;
  body_search_text?: string | null;
  direction: 'inbound' | 'outbound';
  created_at?: string;
  received_at?: string;
}

interface ResponseComposerProps {
  originalMessages: Message[];
  mode: 'casework' | 'campaign';
  campaignId?: string;
  caseId?: string;
  recipientCount?: number;
}

export function ResponseComposer({
  originalMessages,
  mode,
  campaignId,
  caseId,
  recipientCount = 0,
}: ResponseComposerProps) {
  const { supabase, currentOffice } = useSupabase();
  const [initialContent, setInitialContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [sendingStatus, setSendingStatus] = useState<'idle' | 'queued' | 'processing' | 'sent' | 'failed'>('idle');
  const [queuedEmailId, setQueuedEmailId] = useState<string | null>(null);

  useEffect(() => {
    if (mode === 'casework' && originalMessages.length > 0) {
      const mostRecentMessage = originalMessages[originalMessages.length - 1];
      const quoteBlock = generateQuoteBlock(mostRecentMessage);
      setInitialContent(quoteBlock);
    } else {
      setInitialContent('');
    }
  }, [originalMessages, mode]);

  // Subscribe to realtime updates for the queued email
  useEffect(() => {
    if (!queuedEmailId || !currentOffice?.id) return;

    const channel = supabase
      .channel(`email-queue-${queuedEmailId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'email_outbox_queue',
          filter: `id=eq.${queuedEmailId}`,
        },
        (payload: { new: { status: 'idle' | 'queued' | 'processing' | 'sent' | 'failed'; error_log?: string } }) => {
          const newStatus = payload.new.status;
          setSendingStatus(newStatus as 'idle' | 'queued' | 'processing' | 'sent' | 'failed');

          if (newStatus === 'sent') {
            setSuccess(true);
            setError(null);
          } else if (newStatus === 'failed') {
            setSuccess(false);
            setError(payload.new.error_log || 'Email sending failed');
          } else if (newStatus === 'processing') {
            setSendingStatus('processing');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queuedEmailId, currentOffice?.id, supabase]);

  const generateQuoteBlock = (message: Message): string => {
    let bodyText = message.body || message.snippet || message.body_search_text || '';
    bodyText = bodyText.replace(/<[^>]*>/g, '');
    const lines = bodyText.split('\n').slice(0, 5);
    const truncatedText = lines.join('\n').substring(0, 500);

    const dateStr = message.created_at || message.received_at;
    const date = dateStr
      ? new Date(dateStr).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'Unknown date';

    const fromName = message.from_name || 'Unknown';

    const quoteHtml = `
<p><br></p>
<blockquote>
  <p><strong>On ${date}, ${fromName} wrote:</strong></p>
  <p>${truncatedText.replace(/\n/g, '<br>')}</p>
</blockquote>
    `.trim();

    return quoteHtml;
  };

  const handleSend = async (html: string, plainText: string) => {
    setError(null);
    setSuccess(false);

    try {
      if (!currentOffice?.id) {
        throw new Error('Office ID is required');
      }

      if (mode === 'casework') {
        if (!caseId) {
          throw new Error('Case ID is required for casework mode');
        }

        const lastMessage = originalMessages[originalMessages.length - 1];
        const toEmail = lastMessage.from_email;

        if (!toEmail) {
          throw new Error('Recipient email address not found');
        }

        // Generate subject line (Re: original subject)
        const originalSubject = lastMessage.subject || 'Your message';
        const subject = originalSubject.startsWith('Re:')
          ? originalSubject
          : `Re: ${originalSubject}`;

        // Insert into email queue - the Outlook Worker will pick it up automatically
        const { data: queueData, error: insertError } = await supabase
          .from('email_outbox_queue')
          .insert({
            office_id: currentOffice.id,
            to_email: toEmail,
            subject: subject,
            body_html: html,
            case_id: caseId,
            status: 'pending',
          })
          .select()
          .single();

        if (insertError) {
          throw new Error(`Failed to queue email: ${insertError.message}`);
        }

        if (queueData) {
          setQueuedEmailId(queueData.id);
          setSendingStatus('queued');
        }

        setSuccess(true);
      } else if (mode === 'campaign') {
        if (!campaignId) {
          throw new Error('Campaign ID is required for campaign mode');
        }

        // For campaign mode, create a bulk response template
        // This is handled differently - the bulk_responses table stores templates
        // that are then processed for each recipient
        const { error: bulkError } = await supabase
          .from('bulk_responses')
          .insert({
            office_id: currentOffice.id,
            campaign_id: campaignId,
            subject: 'Campaign Response', // This should be configurable
            body_markdown: plainText, // Store markdown for template processing
            status: 'draft',
          });

        if (bulkError) {
          throw new Error(`Failed to create bulk response: ${bulkError.message}`);
        }

        setSuccess(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>
              {mode === 'casework' ? 'Reply to Email' : 'Compose Bulk Response'}
            </CardTitle>
            <CardDescription>
              {mode === 'casework'
                ? 'Reply will be sent immediately'
                : 'Response will be queued for bulk sending'}
            </CardDescription>
          </div>
          {mode === 'campaign' && recipientCount > 0 && (
            <Badge variant="secondary">
              {recipientCount} recipient{recipientCount !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {mode === 'campaign' && recipientCount > 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This will be queued for <strong>{recipientCount}</strong>{' '}
              recipient{recipientCount !== 1 ? 's' : ''}. Use{' '}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">
                {'{'}full_name{'}'}
              </code>{' '}
              for personalization.
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="bg-green-50 text-green-900 border-green-200">
            <AlertDescription>
              {mode === 'casework'
                ? sendingStatus === 'sent'
                  ? 'Email sent successfully!'
                  : sendingStatus === 'processing'
                  ? 'Email is being sent...'
                  : 'Email queued successfully!'
                : 'Bulk response queued successfully!'}
            </AlertDescription>
          </Alert>
        )}

        {sendingStatus === 'queued' && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Email queued. The Outlook Worker will send it shortly...
            </AlertDescription>
          </Alert>
        )}

        {sendingStatus === 'processing' && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Email is being sent through Outlook...
            </AlertDescription>
          </Alert>
        )}

        <ReplyEditor
          initialContent={initialContent}
          onSend={handleSend}
          mode={mode}
        />
      </CardContent>
    </Card>
  );
}
