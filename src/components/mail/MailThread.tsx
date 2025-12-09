import { EmailDisplay } from './EmailDisplay';
import { ResponseComposer } from './ResponseComposer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSupabase } from '@/lib/SupabaseContext';
import type { Message, MessageRecipient } from '@/lib/database.types';

interface MailThreadProps {
  messages: Message[];
  mode: 'casework' | 'campaign';
  campaignId?: string;
  caseId?: string;
  recipientCount?: number;
  showComposer?: boolean;
}

export function MailThread({
  messages,
  mode,
  campaignId,
  caseId,
  recipientCount,
  showComposer = true,
}: MailThreadProps) {
  const { messageRecipients } = useSupabase();

  // Helper to get sender info from message_recipients
  const getSenderInfo = (messageId: string) => {
    const sender = messageRecipients.find(
      (r: MessageRecipient) => r.message_id === messageId && r.recipient_type === 'from'
    );
    return {
      name: sender?.name || 'Unknown',
      email: sender?.email_address || '',
    };
  };

  // Sort messages by date (oldest first)
  const sortedMessages = [...messages].sort(
    (a, b) => {
      const dateA = new Date(a.received_at || 0).getTime();
      const dateB = new Date(b.received_at || 0).getTime();
      return dateA - dateB;
    }
  );

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-4">
      {/* Message Thread */}
      <ScrollArea className="h-[600px] pr-4">
        <div className="space-y-4">
          {sortedMessages.map((message) => {
            const sender = getSenderInfo(message.id);
            return (
              <EmailDisplay
                key={message.id}
                html={message.snippet || message.body_search_text || ''}
                from={sender.name && sender.email
                  ? `${sender.name} <${sender.email}>`
                  : sender.email || 'Unknown'
                }
                date={formatDate(message.received_at)}
                subject={message.subject || '(No subject)'}
              />
            );
          })}
        </div>
      </ScrollArea>

      {/* Reply Composer */}
      {showComposer && (
        <ResponseComposer
          originalMessages={sortedMessages}
          mode={mode}
          campaignId={campaignId}
          caseId={caseId}
          recipientCount={recipientCount}
        />
      )}
    </div>
  );
}
