/**
 * AssignCampaignDialog
 *
 * Modal dialog for assigning a message to a campaign.
 * - Select from existing campaigns or create a new one
 * - After selection, searches for other emails with matching subject
 * - Allows bulk assignment of matching emails
 */

import { useState, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Loader2,
  Flag,
  Plus,
  Check,
  ArrowLeft,
  Mail,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { useSupabase } from '@/lib/SupabaseContext';
import type { Campaign } from '@/lib/database.types';

type DialogStep = 'select' | 'create' | 'matches';

interface AssignCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messageId: string;
  messageSubject: string | null;
  currentCampaignId?: string | null;
  onAssigned?: (campaignId: string, assignedCount: number) => void;
}

export function AssignCampaignDialog({
  open,
  onOpenChange,
  messageId,
  messageSubject,
  currentCampaignId,
  onAssigned,
}: AssignCampaignDialogProps) {
  const { campaigns, messages, updateMessage, createCampaign } = useSupabase();

  // Dialog state
  const [step, setStep] = useState<DialogStep>('select');
  const [isProcessing, setIsProcessing] = useState(false);

  // Create campaign form
  const [newCampaignName, setNewCampaignName] = useState('');

  // Selected campaign for matching
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  // Matching emails state
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());

  // Get active campaigns
  const activeCampaigns = useMemo(() => {
    return campaigns.filter(c => c.status === 'active');
  }, [campaigns]);

  // Find messages with matching subject (excluding current message and already assigned)
  const matchingMessages = useMemo(() => {
    if (!messageSubject || !selectedCampaign) return [];

    // Normalize subject for comparison (remove Re:, Fwd:, etc.)
    const normalizeSubject = (subject: string | null) => {
      if (!subject) return '';
      return subject
        .replace(/^(re|fwd|fw):\s*/gi, '')
        .trim()
        .toLowerCase();
    };

    const normalizedSubject = normalizeSubject(messageSubject);
    if (!normalizedSubject) return [];

    return messages.filter(m => {
      // Exclude current message
      if (m.id === messageId) return false;
      // Exclude already assigned to this campaign
      if (m.campaign_id === selectedCampaign.id) return false;
      // Match by subject
      const normalized = normalizeSubject(m.subject);
      return normalized === normalizedSubject;
    });
  }, [messages, messageSubject, messageId, selectedCampaign]);

  // Reset dialog state when opened
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setStep('select');
      setNewCampaignName(messageSubject || '');
      setSelectedCampaign(null);
      setSelectedMessageIds(new Set());
    }
    onOpenChange(isOpen);
  };

  // Handle campaign selection
  const handleSelectCampaign = useCallback(async (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setIsProcessing(true);

    try {
      // Assign current message to campaign
      const updated = await updateMessage(messageId, { campaign_id: campaign.id });
      if (!updated) {
        toast.error('Failed to assign message to campaign');
        setIsProcessing(false);
        return;
      }

      // Check for matching messages
      const normalizeSubject = (subject: string | null) => {
        if (!subject) return '';
        return subject
          .replace(/^(re|fwd|fw):\s*/gi, '')
          .trim()
          .toLowerCase();
      };

      const normalizedSubject = normalizeSubject(messageSubject);
      const matches = messages.filter(m => {
        if (m.id === messageId) return false;
        if (m.campaign_id === campaign.id) return false;
        return normalizeSubject(m.subject) === normalizedSubject;
      });

      if (matches.length > 0) {
        // Pre-select all matches
        setSelectedMessageIds(new Set(matches.map(m => m.id)));
        setStep('matches');
      } else {
        // No matches, close dialog
        toast.success(`Message assigned to "${campaign.name}"`);
        onAssigned?.(campaign.id, 1);
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Error assigning to campaign:', error);
      toast.error('Failed to assign message to campaign');
    } finally {
      setIsProcessing(false);
    }
  }, [messageId, messageSubject, messages, updateMessage, onAssigned, onOpenChange]);

  // Handle create new campaign
  const handleCreateCampaign = useCallback(async () => {
    if (!newCampaignName.trim()) {
      toast.error('Campaign name is required');
      return;
    }

    setIsProcessing(true);
    try {
      // Get fingerprint from the current message
      const currentMessage = messages.find(m => m.id === messageId);
      const fingerprint = currentMessage?.fingerprint_hash || undefined;

      const campaign = await createCampaign({
        name: newCampaignName.trim(),
        subject_pattern: messageSubject || undefined,
        fingerprint_hash: fingerprint,
      });

      if (!campaign) {
        toast.error('Failed to create campaign');
        return;
      }

      // Select the new campaign (this will also assign the message)
      await handleSelectCampaign(campaign);
    } catch (error) {
      console.error('Error creating campaign:', error);
      toast.error('Failed to create campaign');
      setIsProcessing(false);
    }
  }, [newCampaignName, messageSubject, messageId, messages, createCampaign, handleSelectCampaign]);

  // Handle bulk assignment
  const handleBulkAssign = useCallback(async () => {
    if (!selectedCampaign || selectedMessageIds.size === 0) {
      // Just close, the current message is already assigned
      toast.success(`Message assigned to "${selectedCampaign?.name}"`);
      onAssigned?.(selectedCampaign?.id || '', 1);
      onOpenChange(false);
      return;
    }

    setIsProcessing(true);
    try {
      const messageIdsToUpdate = Array.from(selectedMessageIds);
      let successCount = 0;

      // Update each message
      for (const id of messageIdsToUpdate) {
        const updated = await updateMessage(id, { campaign_id: selectedCampaign.id });
        if (updated) {
          successCount++;
        }
      }

      // +1 for the original message
      const totalAssigned = successCount + 1;
      toast.success(`${totalAssigned} message${totalAssigned > 1 ? 's' : ''} assigned to "${selectedCampaign.name}"`);
      onAssigned?.(selectedCampaign.id, totalAssigned);
      onOpenChange(false);
    } catch (error) {
      console.error('Error bulk assigning to campaign:', error);
      toast.error('Failed to assign some messages');
    } finally {
      setIsProcessing(false);
    }
  }, [selectedCampaign, selectedMessageIds, updateMessage, onAssigned, onOpenChange]);

  // Toggle message selection
  const toggleMessage = (id: string) => {
    setSelectedMessageIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select/deselect all
  const toggleAll = () => {
    if (selectedMessageIds.size === matchingMessages.length) {
      setSelectedMessageIds(new Set());
    } else {
      setSelectedMessageIds(new Set(matchingMessages.map(m => m.id)));
    }
  };

  // Format date for display
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {step === 'select' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Flag className="h-5 w-5" />
                Assign to Campaign
              </DialogTitle>
              <DialogDescription>
                Select an existing campaign or create a new one.
              </DialogDescription>
            </DialogHeader>

            <Command className="rounded-lg border">
              <CommandInput placeholder="Search campaigns..." />
              <CommandList className="max-h-64">
                <CommandEmpty>No campaigns found.</CommandEmpty>
                <CommandGroup heading="Create New">
                  <CommandItem
                    onSelect={() => setStep('create')}
                    className="cursor-pointer"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create new campaign
                  </CommandItem>
                </CommandGroup>
                {activeCampaigns.length > 0 && (
                  <>
                    <CommandSeparator />
                    <CommandGroup heading="Existing Campaigns">
                      {activeCampaigns.map((campaign) => (
                        <CommandItem
                          key={campaign.id}
                          value={campaign.name}
                          onSelect={() => handleSelectCampaign(campaign)}
                          className="cursor-pointer"
                          disabled={isProcessing}
                        >
                          <Flag className="h-4 w-4 mr-2 text-muted-foreground" />
                          <span className="flex-1 truncate">{campaign.name}</span>
                          {campaign.id === currentCampaignId && (
                            <Check className="h-4 w-4 text-primary" />
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </>
                )}
              </CommandList>
            </Command>

            {isProcessing && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Assigning...</span>
              </div>
            )}
          </>
        )}

        {step === 'create' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Create New Campaign
              </DialogTitle>
              <DialogDescription>
                Create a new campaign to group related emails.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="campaign-name">Campaign Name</Label>
                <Input
                  id="campaign-name"
                  placeholder="Enter campaign name"
                  value={newCampaignName}
                  onChange={(e) => setNewCampaignName(e.target.value)}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  Pre-filled from the email subject. You can edit it.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('select')}
                disabled={isProcessing}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={handleCreateCampaign}
                disabled={isProcessing || !newCampaignName.trim()}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create & Assign'
                )}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'matches' && selectedCampaign && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Similar Emails Found
              </DialogTitle>
              <DialogDescription>
                We found {matchingMessages.length} other email{matchingMessages.length !== 1 ? 's' : ''} with the same subject.
                Would you like to add them to this campaign?
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              {/* Campaign selector - allows changing selection */}
              <div className="mb-4">
                <Label className="text-sm font-medium mb-2 block">Campaign</Label>
                <Command className="rounded-lg border">
                  <CommandInput placeholder="Search campaigns..." />
                  <CommandList className="max-h-32">
                    <CommandEmpty>No campaigns found.</CommandEmpty>
                    <CommandGroup>
                      {activeCampaigns.map((campaign) => (
                        <CommandItem
                          key={campaign.id}
                          value={campaign.name}
                          onSelect={() => handleSelectCampaign(campaign)}
                          className="cursor-pointer"
                          disabled={isProcessing}
                        >
                          <Flag className="h-4 w-4 mr-2 text-muted-foreground" />
                          <span className="flex-1 truncate">{campaign.name}</span>
                          {campaign.id === selectedCampaign.id && (
                            <Check className="h-4 w-4 text-primary" />
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </div>

              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="select-all"
                    checked={selectedMessageIds.size === matchingMessages.length}
                    onCheckedChange={toggleAll}
                  />
                  <Label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                    Select all ({matchingMessages.length})
                  </Label>
                </div>
                <Badge variant="secondary">
                  {selectedMessageIds.size} selected
                </Badge>
              </div>

              <ScrollArea className="h-64 rounded-md border">
                <div className="p-2 space-y-1">
                  {matchingMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                      onClick={() => toggleMessage(msg.id)}
                    >
                      <Checkbox
                        checked={selectedMessageIds.has(msg.id)}
                        onCheckedChange={() => toggleMessage(msg.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="text-sm truncate">
                            {msg.subject || '(No subject)'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">
                            {formatDate(msg.received_at)}
                          </span>
                          {msg.triage_status && (
                            <Badge variant="outline" className="text-xs py-0 h-4">
                              {msg.triage_status}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  toast.success(`Message assigned to "${selectedCampaign.name}"`);
                  onAssigned?.(selectedCampaign.id, 1);
                  onOpenChange(false);
                }}
                disabled={isProcessing}
              >
                Skip
              </Button>
              <Button
                onClick={handleBulkAssign}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Assigning...
                  </>
                ) : selectedMessageIds.size > 0 ? (
                  `Add ${selectedMessageIds.size} Email${selectedMessageIds.size !== 1 ? 's' : ''}`
                ) : (
                  'Done'
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
