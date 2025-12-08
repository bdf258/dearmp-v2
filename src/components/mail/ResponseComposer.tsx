import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ReplyEditor } from './ReplyEditor';
import { AlertCircle } from 'lucide-react';

interface Message {
  id: string;
  from_email: string;
  from_name: string;
  to_email: string;
  to_name: string;
  subject: string;
  body: string;
  direction: 'inbound' | 'outbound';
  created_at: string;
}

interface ResponseComposerProps {
  originalMessages: Message[];
  mode: 'casework' | 'campaign';
  campaignId?: string;
  caseId?: string;
  recipientCount?: number; // For campaign mode warning
}

// Mock service functions
const sendEmail = async (
  caseId: string,
  html: string,
  plainText: string,
  replyToMessageId: string
): Promise<void> => {
  console.log('Sending email:', { caseId, html, plainText, replyToMessageId });
  // TODO: Implement actual email sending via API
  await new Promise((resolve) => setTimeout(resolve, 1000));
};

const createBulkResponse = async (
  campaignId: string,
  html: string,
  plainText: string
): Promise<void> => {
  console.log('Creating bulk response:', { campaignId, html, plainText });
  // TODO: Implement actual bulk response creation via API
  // This should insert into bulk_responses table
  await new Promise((resolve) => setTimeout(resolve, 1000));
};

export function ResponseComposer({
  originalMessages,
  mode,
  campaignId,
  caseId,
  recipientCount = 0,
}: ResponseComposerProps) {
  const [initialContent, setInitialContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Only add quote block for casework mode
    if (mode === 'casework' && originalMessages.length > 0) {
      const mostRecentMessage = originalMessages[originalMessages.length - 1];

      // Generate quote block
      const quoteBlock = generateQuoteBlock(mostRecentMessage);
      setInitialContent(quoteBlock);
    } else {
      setInitialContent('');
    }
  }, [originalMessages, mode]);

  const generateQuoteBlock = (message: Message): string => {
    // Simple quote block generation
    // Take the first 500 characters or first few lines of the message
    let bodyText = message.body;

    // Remove HTML tags if present
    bodyText = bodyText.replace(/<[^>]*>/g, '');

    // Limit to first 500 characters or 5 lines
    const lines = bodyText.split('\n').slice(0, 5);
    const truncatedText = lines.join('\n').substring(0, 500);

    // Create a formatted quote block
    const date = new Date(message.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const quoteHtml = `
<p><br></p>
<blockquote>
  <p><strong>On ${date}, ${message.from_name} wrote:</strong></p>
  <p>${truncatedText.replace(/\n/g, '<br>')}</p>
</blockquote>
    `.trim();

    return quoteHtml;
  };

  const handleSend = async (html: string, plainText: string) => {
    setError(null);
    setSuccess(false);

    try {
      if (mode === 'casework') {
        if (!caseId) {
          throw new Error('Case ID is required for casework mode');
        }
        const replyToMessage = originalMessages[originalMessages.length - 1];
        await sendEmail(caseId, html, plainText, replyToMessage.id);
        setSuccess(true);
      } else if (mode === 'campaign') {
        if (!campaignId) {
          throw new Error('Campaign ID is required for campaign mode');
        }
        await createBulkResponse(campaignId, html, plainText);
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
                ? 'Email sent successfully!'
                : 'Bulk response queued successfully!'}
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
