/**
 * Triage Redirect
 *
 * Redirects to the oldest untriaged message in the queue.
 * If no messages are pending, shows an empty state.
 */

import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTriageQueue } from '@/hooks/triage/useTriage';
import { Button } from '@/components/ui/button';
import { Inbox, CheckCircle2, Loader2 } from 'lucide-react';

export function TriageRedirect() {
  const navigate = useNavigate();
  const { messages, isLoading } = useTriageQueue();

  // Find the oldest message (earliest received_at)
  const oldestMessage = useMemo(() => {
    if (messages.length === 0) return null;
    return [...messages].sort((a, b) => {
      const dateA = new Date(a.received_at || 0).getTime();
      const dateB = new Date(b.received_at || 0).getTime();
      return dateA - dateB;
    })[0];
  }, [messages]);

  // Redirect to oldest message when found
  useEffect(() => {
    if (!isLoading && oldestMessage) {
      navigate(`/triage/messages/${oldestMessage.id}`, { replace: true });
    }
  }, [isLoading, oldestMessage, navigate]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading triage queue...</p>
        </div>
      </div>
    );
  }

  // Empty queue state
  if (!oldestMessage) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center max-w-md">
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">All caught up!</h2>
          <p className="text-muted-foreground mb-6">
            There are no messages requiring triage at the moment.
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => navigate('/triage')}>
              <Inbox className="h-4 w-4 mr-2" />
              View Triage Dashboard
            </Button>
            <Button variant="outline" onClick={() => navigate('/triage/campaigns')}>
              View Campaigns
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Fallback while redirecting
  return (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

export default TriageRedirect;
