import { useState, useMemo, useCallback } from 'react';
import { useSupabase } from '@/lib/SupabaseContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Mail,
  UserPlus,
  Flag,
  FolderInput,
  Loader2,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Users,
  FileText,
  X,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Message } from '@/lib/database.types';

interface EmailGroup {
  subject: string;
  normalizedSubject: string;
  messages: Message[];
  campaignId: string | null;
}

// Normalize subject for grouping (remove Re:, Fwd:, extra whitespace, etc.)
function normalizeSubject(subject: string | null): string {
  if (!subject) return '(no subject)';
  return subject
    .replace(/^(re|fw|fwd|re:|fw:|fwd:)\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export default function BatchTriagePage() {
  const {
    messages,
    messageRecipients,
    profiles,
    campaigns,
    createCase,
    updateMessage,
    getCurrentUserId,
  } = useSupabase();

  // Selection state
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Processing state
  const [processingMessageIds, setProcessingMessageIds] = useState<Set<string>>(new Set());
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);

  // Dialog state
  const [previewMessage, setPreviewMessage] = useState<Message | null>(null);

  // Filter messages that need triage (no case and no campaign, or have campaign for policy triage)
  const triageMessages = useMemo(() => {
    return messages.filter((msg) => !msg.case_id && msg.direction === 'inbound');
  }, [messages]);

  // Group messages by normalized subject
  const emailGroups = useMemo(() => {
    const groupMap = new Map<string, EmailGroup>();

    triageMessages.forEach((msg) => {
      const normalized = normalizeSubject(msg.subject);
      const existing = groupMap.get(normalized);

      if (existing) {
        existing.messages.push(msg);
        // Use the most common campaign_id in the group
        if (msg.campaign_id && !existing.campaignId) {
          existing.campaignId = msg.campaign_id;
        }
      } else {
        groupMap.set(normalized, {
          subject: msg.subject || '(No subject)',
          normalizedSubject: normalized,
          messages: [msg],
          campaignId: msg.campaign_id,
        });
      }
    });

    // Sort groups by message count (largest first) then by most recent
    return Array.from(groupMap.values()).sort((a, b) => {
      // Prioritize groups with more messages
      if (b.messages.length !== a.messages.length) {
        return b.messages.length - a.messages.length;
      }
      // Then by most recent message
      const aLatest = Math.max(...a.messages.map(m => new Date(m.received_at).getTime()));
      const bLatest = Math.max(...b.messages.map(m => new Date(m.received_at).getTime()));
      return bLatest - aLatest;
    });
  }, [triageMessages]);

  // Get sender info from message recipients
  const getSenderInfo = useCallback((messageId: string) => {
    const sender = messageRecipients.find(
      r => r.message_id === messageId && r.recipient_type === 'from'
    );
    return {
      name: sender?.name || 'Unknown',
      email: sender?.email_address || '',
    };
  }, [messageRecipients]);

  // Selection handlers
  const toggleGroupSelection = useCallback((group: EmailGroup) => {
    setSelectedMessageIds(prev => {
      const next = new Set(prev);
      const groupIds = group.messages.map(m => m.id);
      const allSelected = groupIds.every(id => next.has(id));

      if (allSelected) {
        // Deselect all in group
        groupIds.forEach(id => next.delete(id));
      } else {
        // Select all in group
        groupIds.forEach(id => next.add(id));
      }

      return next;
    });
  }, []);

  const toggleMessageSelection = useCallback((messageId: string) => {
    setSelectedMessageIds(prev => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedMessageIds(new Set(triageMessages.map(m => m.id)));
  }, [triageMessages]);

  const deselectAll = useCallback(() => {
    setSelectedMessageIds(new Set());
  }, []);

  const toggleGroupExpansion = useCallback((normalizedSubject: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(normalizedSubject)) {
        next.delete(normalizedSubject);
      } else {
        next.add(normalizedSubject);
      }
      return next;
    });
  }, []);

  // Check if group is fully, partially, or not selected
  const getGroupSelectionState = useCallback((group: EmailGroup): 'none' | 'some' | 'all' => {
    const groupIds = group.messages.map(m => m.id);
    const selectedCount = groupIds.filter(id => selectedMessageIds.has(id)).length;

    if (selectedCount === 0) return 'none';
    if (selectedCount === groupIds.length) return 'all';
    return 'some';
  }, [selectedMessageIds]);

  // Batch action handlers
  const handleBatchAssignToCampaign = async (campaignId: string) => {
    const selectedIds = Array.from(selectedMessageIds);
    if (selectedIds.length === 0) {
      toast.error('No messages selected');
      return;
    }

    setIsProcessingBatch(true);
    setProcessingMessageIds(new Set(selectedIds));

    try {
      let successCount = 0;
      for (const messageId of selectedIds) {
        const result = await updateMessage(messageId, { campaign_id: campaignId });
        if (result) successCount++;
      }

      const campaign = campaigns.find(c => c.id === campaignId);
      toast.success(`Assigned ${successCount} message${successCount !== 1 ? 's' : ''} to "${campaign?.name || 'campaign'}"`);
      setSelectedMessageIds(new Set());
    } catch (error) {
      console.error('Batch assign error:', error);
      toast.error('Failed to assign some messages');
    } finally {
      setIsProcessingBatch(false);
      setProcessingMessageIds(new Set());
    }
  };

  const handleBatchMarkAsCasework = async () => {
    const selectedIds = Array.from(selectedMessageIds);
    if (selectedIds.length === 0) {
      toast.error('No messages selected');
      return;
    }

    setIsProcessingBatch(true);
    setProcessingMessageIds(new Set(selectedIds));

    try {
      let successCount = 0;
      for (const messageId of selectedIds) {
        const result = await updateMessage(messageId, { campaign_id: null });
        if (result) successCount++;
      }

      toast.success(`Moved ${successCount} message${successCount !== 1 ? 's' : ''} to casework triage`);
      setSelectedMessageIds(new Set());
    } catch (error) {
      console.error('Batch casework error:', error);
      toast.error('Failed to process some messages');
    } finally {
      setIsProcessingBatch(false);
      setProcessingMessageIds(new Set());
    }
  };

  const handleBatchCreateCases = async (assigneeId?: string) => {
    const selectedIds = Array.from(selectedMessageIds);
    if (selectedIds.length === 0) {
      toast.error('No messages selected');
      return;
    }

    setIsProcessingBatch(true);
    setProcessingMessageIds(new Set(selectedIds));

    try {
      let successCount = 0;
      for (const messageId of selectedIds) {
        const message = messages.find(m => m.id === messageId);
        if (!message) continue;

        const sender = getSenderInfo(messageId);
        const newCase = await createCase({
          title: message.subject || `Message from ${sender.name}`,
          description: message.snippet || message.body_search_text || undefined,
          status: 'open',
          priority: 'medium',
          assigned_to: assigneeId,
          created_by: getCurrentUserId() || undefined,
        });

        if (newCase) {
          const updated = await updateMessage(messageId, { case_id: newCase.id });
          if (updated) successCount++;
        }
      }

      const assignee = assigneeId ? profiles.find(p => p.id === assigneeId) : null;
      const assigneeText = assignee ? ` and assigned to ${assignee.full_name}` : '';
      toast.success(`Created ${successCount} case${successCount !== 1 ? 's' : ''}${assigneeText}`);
      setSelectedMessageIds(new Set());
    } catch (error) {
      console.error('Batch create cases error:', error);
      toast.error('Failed to create some cases');
    } finally {
      setIsProcessingBatch(false);
      setProcessingMessageIds(new Set());
    }
  };

  const handleApproveGroup = async (group: EmailGroup) => {
    if (!group.campaignId) {
      toast.error('Please assign this group to a campaign first');
      return;
    }

    // Select all messages in group if not selected
    const groupIds = group.messages.map(m => m.id);
    setSelectedMessageIds(new Set(groupIds));

    toast.success(`Group approved: ${groupIds.length} messages assigned to campaign`);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const selectedCount = selectedMessageIds.size;
  const activeCampaigns = campaigns.filter(c => c.status === 'active');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Batch Email Triage</h1>
          <p className="text-muted-foreground">
            Rapidly process similar emails grouped by subject
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Mail className="h-4 w-4" />
          <span>{triageMessages.length} emails in {emailGroups.length} groups</span>
        </div>
      </div>

      {/* Batch Action Bar */}
      {selectedCount > 0 && (
        <Card className="border-primary bg-primary/5">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Badge variant="default" className="text-sm">
                  {selectedCount} selected
                </Badge>
                <Button variant="ghost" size="sm" onClick={deselectAll}>
                  <X className="mr-1 h-3 w-3" />
                  Clear
                </Button>
              </div>
              <div className="flex items-center gap-2">
                {/* Assign to Campaign */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" disabled={isProcessingBatch}>
                      {isProcessingBatch ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Flag className="mr-2 h-4 w-4" />
                      )}
                      Assign to Campaign
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Select Campaign</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {activeCampaigns.map((campaign) => (
                      <DropdownMenuItem
                        key={campaign.id}
                        onClick={() => handleBatchAssignToCampaign(campaign.id)}
                      >
                        {campaign.name}
                      </DropdownMenuItem>
                    ))}
                    {activeCampaigns.length === 0 && (
                      <DropdownMenuItem disabled>No active campaigns</DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Create Cases */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" disabled={isProcessingBatch}>
                      {isProcessingBatch ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <FileText className="mr-2 h-4 w-4" />
                      )}
                      Create Cases
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleBatchCreateCases()}>
                      <FileText className="mr-2 h-4 w-4" />
                      Create Cases (Unassigned)
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Create & Assign to</DropdownMenuLabel>
                    {profiles.map((profile) => (
                      <DropdownMenuItem
                        key={profile.id}
                        onClick={() => handleBatchCreateCases(profile.id)}
                      >
                        <UserPlus className="mr-2 h-4 w-4" />
                        {profile.full_name || 'Unknown'}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Mark as Casework */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBatchMarkAsCasework}
                  disabled={isProcessingBatch}
                >
                  {isProcessingBatch ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FolderInput className="mr-2 h-4 w-4" />
                  )}
                  Mark as Casework
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Email Groups */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Email Groups</CardTitle>
              <CardDescription>
                Campaign emails with identical subjects are grouped for batch processing
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={selectAll}>
                Select All
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {emailGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500/50 mb-4" />
              <p className="text-lg font-medium">All caught up!</p>
              <p className="text-sm text-muted-foreground">
                No emails require triage at this time.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {emailGroups.map((group) => {
                const selectionState = getGroupSelectionState(group);
                const isExpanded = expandedGroups.has(group.normalizedSubject);
                const matchedCampaign = group.campaignId
                  ? campaigns.find(c => c.id === group.campaignId)
                  : null;
                const isProcessing = group.messages.some(m => processingMessageIds.has(m.id));

                return (
                  <Collapsible
                    key={group.normalizedSubject}
                    open={isExpanded}
                    onOpenChange={() => toggleGroupExpansion(group.normalizedSubject)}
                  >
                    {/* Group Header */}
                    <div className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                      {/* Checkbox */}
                      <Checkbox
                        checked={selectionState === 'all'}
                        indeterminate={selectionState === 'some'}
                        onCheckedChange={() => toggleGroupSelection(group)}
                        disabled={isProcessing}
                        aria-label={`Select all ${group.messages.length} emails`}
                      />

                      {/* Expand/Collapse */}
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>

                      {/* Email count badge */}
                      <Badge variant="secondary" className="min-w-[3rem] justify-center">
                        <Users className="mr-1 h-3 w-3" />
                        {group.messages.length}
                      </Badge>

                      {/* Subject */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{group.subject}</div>
                        <div className="text-xs text-muted-foreground">
                          Latest: {formatDate(group.messages[0].received_at)}
                        </div>
                      </div>

                      {/* Campaign badge */}
                      {matchedCampaign ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          <Flag className="mr-1 h-3 w-3" />
                          {matchedCampaign.name}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          No campaign
                        </Badge>
                      )}

                      {/* Quick Actions */}
                      <div className="flex items-center gap-1">
                        {/* Quick approve for campaign emails */}
                        {matchedCampaign && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleApproveGroup(group);
                            }}
                          >
                            <Check className="mr-1 h-3 w-3" />
                            Approve All
                          </Button>
                        )}

                        {/* Campaign assignment dropdown */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="sm" className="h-7" disabled={isProcessing}>
                              {isProcessing ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Flag className="h-4 w-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Assign Group to Campaign</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {activeCampaigns.map((campaign) => (
                              <DropdownMenuItem
                                key={campaign.id}
                                onClick={() => {
                                  const groupIds = group.messages.map(m => m.id);
                                  setSelectedMessageIds(new Set(groupIds));
                                  handleBatchAssignToCampaign(campaign.id);
                                }}
                              >
                                {campaign.id === group.campaignId && '✓ '}
                                {campaign.name}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Expanded Message List */}
                    <CollapsibleContent>
                      <div className="ml-8 mt-1 space-y-1">
                        {group.messages.map((message) => {
                          const sender = getSenderInfo(message.id);
                          const isSelected = selectedMessageIds.has(message.id);
                          const isMsgProcessing = processingMessageIds.has(message.id);

                          return (
                            <div
                              key={message.id}
                              className={`flex items-center gap-3 rounded-md border p-2 text-sm transition-colors ${
                                isSelected ? 'bg-primary/5 border-primary/30' : 'hover:bg-muted/30'
                              }`}
                            >
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleMessageSelection(message.id)}
                                disabled={isMsgProcessing}
                              />

                              <div className="flex-1 min-w-0 grid grid-cols-3 gap-4">
                                <div className="truncate">
                                  <span className="font-medium">{sender.name}</span>
                                  <span className="text-muted-foreground ml-1 text-xs">
                                    {sender.email}
                                  </span>
                                </div>
                                <div className="truncate text-muted-foreground">
                                  {message.snippet}
                                </div>
                                <div className="text-right text-muted-foreground">
                                  {formatDate(message.received_at)}
                                </div>
                              </div>

                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2"
                                onClick={() => setPreviewMessage(message)}
                              >
                                <Mail className="h-3 w-3" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Message Preview Dialog */}
      <Dialog open={previewMessage !== null} onOpenChange={() => setPreviewMessage(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{previewMessage?.subject || '(No subject)'}</DialogTitle>
            <DialogDescription>
              {previewMessage && (() => {
                const sender = getSenderInfo(previewMessage.id);
                return `From: ${sender.name} (${sender.email})`;
              })()}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-96">
            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="whitespace-pre-wrap text-sm">
                {previewMessage?.snippet || previewMessage?.body_search_text || '(No content available)'}
              </p>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewMessage(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
