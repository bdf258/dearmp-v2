/**
 * RequestAddressDialog
 *
 * Modal for requesting a postal address from a constituent.
 * Shows an email template that can be customized before sending.
 */

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Mail, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface RequestAddressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipientName: string;
  recipientEmail: string;
  originalSubject?: string;
  mpName?: string;
  constituency?: string;
  onSend?: (data: { to: string; subject: string; body: string }) => Promise<{ success: boolean; error?: string }>;
}

const DEFAULT_TEMPLATE = (recipientName: string, mpName: string, constituency: string) => `Dear ${recipientName},

Thank you for contacting me regarding your concerns.

To help me assist you more effectively, I need to verify that you are a constituent in my constituency. Could you please reply to this email with your full postal address?

This information is required so that I can confirm you reside within my constituency and take appropriate action on your behalf.

Thank you for your understanding.

Kind regards,
${mpName}
Member of Parliament for ${constituency}`;

export function RequestAddressDialog({
  open,
  onOpenChange,
  recipientName,
  recipientEmail,
  originalSubject = '',
  mpName = '[MP Name]',
  constituency = '[Constituency]',
  onSend,
}: RequestAddressDialogProps) {
  const [subject, setSubject] = useState(`Re: ${originalSubject}`);
  const [body, setBody] = useState(DEFAULT_TEMPLATE(recipientName, mpName, constituency));
  const [isSending, setIsSending] = useState(false);

  // Reset form when dialog opens
  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (isOpen) {
      setSubject(`Re: ${originalSubject}`);
      setBody(DEFAULT_TEMPLATE(recipientName, mpName, constituency));
    }
    onOpenChange(isOpen);
  }, [originalSubject, recipientName, mpName, constituency, onOpenChange]);

  const handleSend = useCallback(async () => {
    if (!onSend) {
      toast.info('Send functionality not connected');
      onOpenChange(false);
      return;
    }

    setIsSending(true);
    try {
      const result = await onSend({
        to: recipientEmail,
        subject,
        body,
      });

      if (result.success) {
        toast.success('Address request sent');
        onOpenChange(false);
      } else {
        toast.error(result.error || 'Failed to send request');
      }
    } catch (error) {
      toast.error('Failed to send request');
    } finally {
      setIsSending(false);
    }
  }, [onSend, recipientEmail, subject, body, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Request Postal Address</DialogTitle>
          <DialogDescription>
            Send an email requesting the constituent&apos;s postal address for verification.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Recipient */}
          <div className="space-y-2">
            <Label>To</Label>
            <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                {recipientName} &lt;{recipientEmail}&gt;
              </span>
            </div>
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          {/* Message body */}
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="min-h-[250px] font-mono text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isSending || !body.trim()}>
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Request
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
