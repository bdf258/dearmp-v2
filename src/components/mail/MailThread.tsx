import { EmailDisplay } from './EmailDisplay';
import { ResponseComposer } from './ResponseComposer';
import { ScrollArea } from '@/components/ui/scroll-area';

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
  // Sort messages by date (oldest first)
  const sortedMessages = [...messages].sort(
    (a, b) => {
      const dateA = new Date(a.created_at || a.received_at || 0).getTime();
      const dateB = new Date(b.created_at || b.received_at || 0).getTime();
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
          {sortedMessages.map((message) => (
            <EmailDisplay
              key={message.id}
              html={message.body || message.snippet || message.body_search_text || ''}
              from={message.from_name && message.from_email
                ? `${message.from_name} <${message.from_email}>`
                : message.from_email || 'Unknown'
              }
              date={formatDate(message.created_at || message.received_at)}
              subject={message.subject || '(No subject)'}
            />
          ))}
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
