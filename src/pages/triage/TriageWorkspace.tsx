/**
 * Triage Workspace
 *
 * Single-email triage view with:
 * - Full message detail with thread history
 * - Constituent linking/creation
 * - Case assignment/creation
 * - Tag, priority, assignee selection
 * - Action buttons (approve, reply, request address)
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useSupabase } from '@/lib/SupabaseContext';
import {
  useTriageQueue,
  useTriageActions,
  useMessageBody,
} from '@/hooks/triage/useTriage';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import {
  MessageDetailHeader,
  TriageSkeletons,
  ConstituentSelector,
  ConstituentCard,
  CaseSelector,
  CaseCard,
  CaseworkerSelector,
  TagPicker,
  PrioritySelector,
  CreateConstituentDialog,
  CreateCaseDialog,
  RequestAddressDialog,
  AssignCampaignDialog,
} from '@/components/triage';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  MapPin,
  AlertCircle,
  HelpCircle,
  Loader2,
  MessageSquare,
  Sparkles,
  Flag,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { CasePriority } from '@/lib/database.types';

export function TriageWorkspace() {
  const navigate = useNavigate();
  const { messageId } = useParams<{ messageId: string }>();
  const [searchParams] = useSearchParams();

  const { messages: allMessages, isLoading: dataLoading } = useTriageQueue();
  const { approveTriage, isProcessing } = useTriageActions();
  const { campaigns, getTagsForEntity, updateMessage } = useSupabase();

  // Campaign assignment state
  const [showAssignCampaign, setShowAssignCampaign] = useState(false);
  const [isUnlinkingCampaign, setIsUnlinkingCampaign] = useState(false);

  // Find the message
  const message = useMemo(() => {
    return allMessages.find(m => m.id === messageId) || null;
  }, [allMessages, messageId]);

  // Get message index for navigation
  const messageIndex = useMemo(() => {
    return allMessages.findIndex(m => m.id === messageId);
  }, [allMessages, messageId]);

  // Get message body
  const { body: messageBody, isLoading: bodyLoading } = useMessageBody(messageId || null);

  // Triage state
  const [triageState, setTriageState] = useState<{
    constituentId: string | null;
    caseId: string | null;
    assigneeId: string | null;
    priority: CasePriority;
    tagIds: string[];
  }>({
    constituentId: null,
    caseId: null,
    assigneeId: null,
    priority: 'medium',
    tagIds: [],
  });

  // Dialog states
  const [showCreateConstituent, setShowCreateConstituent] = useState(false);
  const [showCreateCase, setShowCreateCase] = useState(false);
  const [showRequestAddress, setShowRequestAddress] = useState(false);

  // Initialize triage state from message
  useEffect(() => {
    if (message) {
      // Get existing tags for this message
      const messageTags = getTagsForEntity('message', message.id);

      setTriageState({
        constituentId: message.senderConstituent?.id || null,
        caseId: message.case_id || null,
        assigneeId: null,
        priority: 'medium',
        tagIds: messageTags.map(t => t.tag_id),
      });
    }
  }, [message?.id, message?.senderConstituent?.id, message?.case_id, getTagsForEntity]);

  // Navigation handlers
  const goToPrevious = useCallback(() => {
    if (messageIndex > 0) {
      navigate(`/triage/messages/${allMessages[messageIndex - 1].id}`);
    }
  }, [messageIndex, allMessages, navigate]);

  const goToNext = useCallback(() => {
    if (messageIndex < allMessages.length - 1) {
      navigate(`/triage/messages/${allMessages[messageIndex + 1].id}`);
    }
  }, [messageIndex, allMessages, navigate]);

  const goBack = useCallback(() => {
    const from = searchParams.get('from');
    if (from) {
      navigate(from);
    } else {
      navigate('/triage/campaigns');
    }
  }, [navigate, searchParams]);

  // Approve triage
  const handleApprove = useCallback(async () => {
    if (!message) return;

    const result = await approveTriage(message.id, {
      caseId: triageState.caseId || undefined,
      constituentId: triageState.constituentId || undefined,
      assigneeId: triageState.assigneeId || undefined,
      priority: triageState.priority,
      tagIds: triageState.tagIds,
    });

    if (result.success) {
      toast.success('Message triaged successfully');
      // Move to next message or go back
      if (messageIndex < allMessages.length - 1) {
        goToNext();
      } else {
        goBack();
      }
    } else {
      toast.error(result.error || 'Failed to triage message');
    }
  }, [message, triageState, approveTriage, messageIndex, allMessages.length, goToNext, goBack]);

  // Handle constituent created
  const handleConstituentCreated = useCallback((id: string) => {
    setTriageState(prev => ({ ...prev, constituentId: id }));
  }, []);

  // Handle case created
  const handleCaseCreated = useCallback((id: string) => {
    setTriageState(prev => ({ ...prev, caseId: id }));
  }, []);

  // Handle campaign unlink
  const handleUnlinkCampaign = useCallback(async () => {
    if (!message) return;

    setIsUnlinkingCampaign(true);
    try {
      const updated = await updateMessage(message.id, { campaign_id: null });
      if (updated) {
        toast.success('Message unlinked from campaign');
      } else {
        toast.error('Failed to unlink from campaign');
      }
    } catch (error) {
      console.error('Error unlinking campaign:', error);
      toast.error('Failed to unlink from campaign');
    } finally {
      setIsUnlinkingCampaign(false);
    }
  }, [message, updateMessage]);

  // Loading state
  if (dataLoading) {
    return (
      <div className="flex h-full">
        <div className="flex-1 p-4">
          <TriageSkeletons.MessageDetail />
        </div>
        <div className="w-96 border-l p-4">
          <TriageSkeletons.TriagePanel />
        </div>
      </div>
    );
  }

  // Not found
  if (!message) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h2 className="text-lg font-medium">Message not found</h2>
          <p className="text-sm text-muted-foreground mb-4">
            This message may have already been triaged.
          </p>
          <Button onClick={goBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const campaign = message.campaign_id
    ? campaigns.find(c => c.id === message.campaign_id)
    : null;

  return (
    <div className="flex h-full">
      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header with navigation */}
        <div className="p-4 border-b flex items-center justify-between gap-4">
          <Button variant="ghost" onClick={goBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {messageIndex + 1} of {allMessages.length}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={goToPrevious}
              disabled={messageIndex === 0}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={goToNext}
              disabled={messageIndex === allMessages.length - 1}
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Message content */}
        <ScrollArea className="flex-1">
          <div className="p-6 mx-auto">
            {/* Campaign badge */}
            {campaign && (
              <Badge variant="secondary" className="mb-4">
                <MessageSquare className="h-3 w-3 mr-1" />
                {campaign.name}
              </Badge>
            )}

            {/* Message header */}
            <MessageDetailHeader message={message} className="mb-6" />

            {/* Constituent status alert */}
            {message.constituentStatus !== 'known' && (
              <Alert className="mb-6" variant={message.constituentStatus === 'has_address' ? 'default' : 'destructive'}>
                {message.constituentStatus === 'has_address' ? (
                  <>
                    <HelpCircle className="h-4 w-4" />
                    <AlertTitle>Address found in message</AlertTitle>
                    <AlertDescription>
                      {message.addressFromEmail && (
                        <span className="font-medium">{message.addressFromEmail}</span>
                      )}
                      {' - '}You can create a new constituent record with this address.
                    </AlertDescription>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Unknown sender</AlertTitle>
                    <AlertDescription>
                      No constituent match found and no address detected. Consider requesting
                      address confirmation.
                    </AlertDescription>
                  </>
                )}
              </Alert>
            )}

            <Separator className="my-6" />

            {/* Message body */}
            <div className="prose prose-sm max-w-none">
              {bodyLoading ? (
                <div className="space-y-2">
                  <TriageSkeletons.Badge />
                  <div className="h-40 bg-muted animate-pulse rounded" />
                </div>
              ) : (
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                  {messageBody || message.snippet || 'No content available'}
                </pre>
              )}
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Triage panel */}
      <div className="w-96 border-l flex flex-col bg-muted/30">
        <div className="p-4 border-b bg-background">
          <h3 className="font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Triage Actions
          </h3>
        </div>

        {/* Assign to Campaign button */}
        <div className="p-4 border-b bg-background">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="flex-1 justify-start gap-2"
              onClick={() => setShowAssignCampaign(true)}
            >
              <Flag className="h-4 w-4" />
              {campaign ? (
                <span className="truncate">{campaign.name}</span>
              ) : (
                'Assign to Campaign'
              )}
            </Button>
            {campaign && (
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={handleUnlinkCampaign}
                disabled={isUnlinkingCampaign}
                title="Remove from campaign"
              >
                {isUnlinkingCampaign ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <X className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-6">
            {/* Constituent section */}
            <div className="space-y-3">
              <ConstituentSelector
                selectedId={triageState.constituentId}
                onSelect={(id) => setTriageState(prev => ({ ...prev, constituentId: id }))}
                onCreateNew={() => setShowCreateConstituent(true)}
                recognitionStatus={
                  triageState.constituentId
                    ? message.triage_status === 'confirmed'
                      ? 'confirmed'
                      : 'ai_matched'
                    : 'none'
                }
                label="Constituent"
              />

              {triageState.constituentId && (
                <ConstituentCard constituentId={triageState.constituentId} />
              )}

              {!triageState.constituentId && message.constituentStatus === 'has_address' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setShowCreateConstituent(true)}
                >
                  <MapPin className="h-4 w-4 mr-2" />
                  Create from detected address
                </Button>
              )}
            </div>

            <Separator />

            {/* Campaign-controlled fields - greyed out when campaign is selected */}
            <div className={cn(
              'space-y-6 -mx-4 px-4 py-4 rounded-lg transition-colors',
              campaign && 'bg-gray-100'
            )}>
              {/* Case section */}
              <div className="space-y-3">
                <CaseSelector
                  selectedId={triageState.caseId}
                  onSelect={(id) => setTriageState(prev => ({
                    ...prev,
                    caseId: id,
                  }))}
                  onCreateNew={() => setShowCreateCase(true)}
                  constituentId={triageState.constituentId}
                  label="Case"
                  disabled={!!campaign}
                />

                {triageState.caseId && (
                  <CaseCard caseId={triageState.caseId} />
                )}
              </div>

              <Separator />

              {/* Assignee */}
              <CaseworkerSelector
                selectedId={triageState.assigneeId}
                onSelect={(id) => setTriageState(prev => ({ ...prev, assigneeId: id }))}
                showUnassignedOption
                label="Assign to"
                disabled={!!campaign}
              />

              {/* Priority */}
              <PrioritySelector
                value={triageState.priority}
                onChange={(priority) => setTriageState(prev => ({ ...prev, priority }))}
                disabled={!!campaign}
              />

              {/* Tags */}
              <TagPicker
                selectedTagIds={triageState.tagIds}
                onChange={(tagIds) => setTriageState(prev => ({ ...prev, tagIds }))}
                disabled={!!campaign}
              />

              {/* Campaign hint */}
              {campaign && (
                <p className="text-xs text-muted-foreground italic">
                  Case, assignee, priority, and tags are managed at the campaign level.
                </p>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Action buttons */}
        <div className="p-4 border-t bg-background space-y-2">
          <Button
            className="w-full"
            onClick={handleApprove}
            disabled={isProcessing || (!campaign && !triageState.caseId)}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                {campaign ? 'Approve' : 'Approve & Link to Case'}
              </>
            )}
          </Button>

          {message.constituentStatus === 'no_address' && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowRequestAddress(true)}
            >
              <MapPin className="h-4 w-4 mr-2" />
              Request Address
            </Button>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <CreateConstituentDialog
        open={showCreateConstituent}
        onOpenChange={setShowCreateConstituent}
        onCreated={handleConstituentCreated}
        defaultEmail={message.senderEmail}
        defaultName={message.senderName}
        defaultAddress={message.addressFromEmail}
      />

      <CreateCaseDialog
        open={showCreateCase}
        onOpenChange={setShowCreateCase}
        onCreated={handleCaseCreated}
        defaultTitle={message.subject || ''}
        messageId={message.id}
      />

      <RequestAddressDialog
        open={showRequestAddress}
        onOpenChange={setShowRequestAddress}
        recipientName={message.senderName}
        recipientEmail={message.senderEmail}
        originalSubject={message.subject || ''}
      />

      <AssignCampaignDialog
        open={showAssignCampaign}
        onOpenChange={setShowAssignCampaign}
        messageId={message.id}
        messageSubject={message.subject}
        currentCampaignId={message.campaign_id}
      />
    </div>
  );
}

export default TriageWorkspace;
