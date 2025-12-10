import { useState } from 'react';
import { useSupabase } from '@/lib/SupabaseContext';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MoreHorizontal, Mail, Tag, UserPlus, Flag, FolderInput, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function TriagePage() {
  const { messages, profiles, campaigns, messageRecipients, updateMessage } = useSupabase();
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null);
  const [processingMessageId, setProcessingMessageId] = useState<string | null>(null);

  // Filter for messages that need triage (have campaign but not yet processed)
  const triageMessages = messages.filter(
    (msg) => msg.campaign_id && msg.direction === 'inbound'
  );

  // Get sender info helper
  const getSenderInfo = (messageId: string) => {
    const sender = messageRecipients.find(
      r => r.message_id === messageId && r.recipient_type === 'from'
    );
    return {
      name: sender?.name || 'Unknown',
      email: sender?.email_address || '',
    };
  };

  const handleAssignToUser = (_messageId: string, userId: string) => {
    // In policy context, assigning to a user is informational only
    // Messages stay in their campaign but can be noted as assigned
    const assignedUser = profiles.find(p => p.id === userId);
    toast.info(`Note: ${assignedUser?.full_name || 'User'} will handle this message`);
  };

  const handleAssignToCampaign = async (messageId: string, campaignId: string) => {
    setProcessingMessageId(messageId);
    try {
      const updatedMessage = await updateMessage(messageId, { campaign_id: campaignId });
      if (!updatedMessage) {
        toast.error('Failed to assign message to campaign');
        return;
      }

      const campaign = campaigns.find(c => c.id === campaignId);
      toast.success(`Message assigned to "${campaign?.name || 'campaign'}"`);
    } catch (error) {
      console.error('Error assigning to campaign:', error);
      toast.error('Failed to assign message to campaign');
    } finally {
      setProcessingMessageId(null);
    }
  };

  const handleMarkAsCasework = async (messageId: string) => {
    setProcessingMessageId(messageId);
    try {
      // Remove campaign_id so it appears in casework triage
      const updatedMessage = await updateMessage(messageId, { campaign_id: null });
      if (!updatedMessage) {
        toast.error('Failed to reclassify message');
        return;
      }

      toast.success('Message moved to casework triage');
    } catch (error) {
      console.error('Error marking as casework:', error);
      toast.error('Failed to reclassify message');
    } finally {
      setProcessingMessageId(null);
    }
  };

  const handleAddTag = (_messageId: string) => {
    // TODO: Implement tag selector dialog (Priority 2)
    toast.info('Tag management coming soon');
  };

  const selectedMessageData = messages.find((m) => m.id === selectedMessage);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Policy Triage</h1>
        <p className="text-muted-foreground">
          Review and categorize incoming policy emails
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Policy Emails Requiring Triage</CardTitle>
          <CardDescription>
            {triageMessages.length} email{triageMessages.length !== 1 ? 's' : ''}{' '}
            awaiting review
          </CardDescription>
        </CardHeader>
        <CardContent>
          {triageMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Mail className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-lg font-medium">All caught up!</p>
              <p className="text-sm text-muted-foreground">
                No policy emails require triage at this time.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>From</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead>Campaign Match</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {triageMessages.map((message) => {
                  const matchedCampaign = campaigns.find(
                    (c) => c.id === message.campaign_id
                  );
                  const sender = getSenderInfo(message.id);

                  return (
                    <TableRow key={message.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{sender.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {sender.email}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => setSelectedMessage(message.id)}
                          className="text-left hover:underline"
                        >
                          {message.subject || '(No subject)'}
                        </button>
                      </TableCell>
                      <TableCell>
                        {new Date(message.received_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {matchedCampaign ? (
                          <Badge variant="secondary">
                            {matchedCampaign.name}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            No match
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={processingMessageId === message.id}
                            >
                              {processingMessageId === message.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <MoreHorizontal className="h-4 w-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setSelectedMessage(message.id)}
                            >
                              <Mail className="mr-2 h-4 w-4" />
                              View Message
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel>Assign To User</DropdownMenuLabel>
                            {profiles.map((profile) => (
                              <DropdownMenuItem
                                key={profile.id}
                                onClick={() =>
                                  handleAssignToUser(message.id, profile.id)
                                }
                              >
                                <UserPlus className="mr-2 h-4 w-4" />
                                {profile.full_name || 'Unknown'}
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger>
                                <Flag className="mr-2 h-4 w-4" />
                                Assign to Campaign
                              </DropdownMenuSubTrigger>
                              <DropdownMenuPortal>
                                <DropdownMenuSubContent>
                                  {campaigns
                                    .filter(c => c.status === 'active')
                                    .map((campaign) => (
                                      <DropdownMenuItem
                                        key={campaign.id}
                                        onClick={() =>
                                          handleAssignToCampaign(message.id, campaign.id)
                                        }
                                      >
                                        {campaign.id === message.campaign_id && '✓ '}
                                        {campaign.name}
                                      </DropdownMenuItem>
                                    ))}
                                  {campaigns.filter(c => c.status === 'active').length === 0 && (
                                    <DropdownMenuItem disabled>
                                      No active campaigns
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuSubContent>
                              </DropdownMenuPortal>
                            </DropdownMenuSub>
                            <DropdownMenuItem
                              onClick={() => handleAddTag(message.id)}
                            >
                              <Tag className="mr-2 h-4 w-4" />
                              Add Tag
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleMarkAsCasework(message.id)}
                            >
                              <FolderInput className="mr-2 h-4 w-4" />
                              Mark as Casework Email
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Message View Dialog */}
      <Dialog
        open={selectedMessage !== null}
        onOpenChange={(open) => !open && setSelectedMessage(null)}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedMessageData?.subject || '(No subject)'}</DialogTitle>
            <DialogDescription>
              {selectedMessageData && (() => {
                const sender = getSenderInfo(selectedMessageData.id);
                return `From: ${sender.name} (${sender.email})`;
              })()}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="whitespace-pre-wrap text-sm">
                {selectedMessageData?.snippet || selectedMessageData?.body_search_text || '(No content available)'}
              </p>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setSelectedMessage(null)}>
                Close
              </Button>
              <Button>Take Action</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
