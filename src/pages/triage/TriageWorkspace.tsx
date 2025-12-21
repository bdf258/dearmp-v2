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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import {
  MessageDetailHeader,
  TriageSkeletons,
  ConstituentSelector,
  CaseSelector,
  CaseworkerSelector,
  TagPicker,
  PrioritySelector,
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
  X,
  User,
  Mail,
  Type,
  AlignLeft,
  Calendar,
  ListChecks,
  Tag,
  Layers,
} from 'lucide-react';
import { toast } from 'sonner';
import type { CasePriority, CaseStatus, CaseType } from '@/lib/database.types';

export function TriageWorkspace() {
  const navigate = useNavigate();
  const { messageId } = useParams<{ messageId: string }>();
  const [searchParams] = useSearchParams();

  const { messages: allMessages, isLoading: dataLoading } = useTriageQueue();
  const { approveTriage, createConstituentWithContacts, createCaseForMessage, isProcessing } = useTriageActions();
  const { campaigns, getTagsForEntity, updateMessage, constituents, constituentContacts, cases } = useSupabase();

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

  // Constituent details state (editable fields below selector)
  const [constituentDetails, setConstituentDetails] = useState<{
    title: string;
    name: string;
    address: string;
    email: string;
  }>({
    title: '',
    name: '',
    address: '',
    email: '',
  });

  // Dialog states
  const [showRequestAddress, setShowRequestAddress] = useState(false);

  // Creating new constituent mode
  const [isCreatingConstituent, setIsCreatingConstituent] = useState(false);

  // Creating new case mode
  const [isCreatingCase, setIsCreatingCase] = useState(false);

  // Case details state (editable fields below selector)
  const [caseDetails, setCaseDetails] = useState<{
    title: string;
    description: string;
    priority: CasePriority;
    assignedTo: string | null;
    status: CaseStatus;
    caseType: CaseType | null;
    reviewDate: string;
  }>({
    title: '',
    description: '',
    priority: 'medium',
    assignedTo: null,
    status: 'open',
    caseType: null,
    reviewDate: '',
  });

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

  // Update constituent details when constituent changes
  useEffect(() => {
    if (triageState.constituentId) {
      const constituent = constituents.find(c => c.id === triageState.constituentId);
      if (constituent) {
        const contacts = constituentContacts.filter(cc => cc.constituent_id === constituent.id);
        const email = contacts.find(cc => cc.type === 'email' && cc.is_primary)?.value
          || contacts.find(cc => cc.type === 'email')?.value || '';
        const address = contacts.find(cc => cc.type === 'address')?.value || '';

        setConstituentDetails({
          title: constituent.salutation || '',
          name: constituent.full_name || '',
          address,
          email,
        });
        setIsCreatingConstituent(false);
      }
    } else if (!isCreatingConstituent) {
      // Clear fields when no constituent selected and not in creating mode
      setConstituentDetails({
        title: '',
        name: '',
        address: '',
        email: '',
      });
    }
  }, [triageState.constituentId, constituents, constituentContacts, isCreatingConstituent]);

  // Update case details when case changes
  useEffect(() => {
    if (triageState.caseId) {
      const caseData = cases.find(c => c.id === triageState.caseId);
      if (caseData) {
        setCaseDetails({
          title: caseData.title || '',
          description: caseData.description || '',
          priority: caseData.priority || 'medium',
          assignedTo: caseData.assigned_to || null,
          status: caseData.status || 'open',
          caseType: caseData.case_type || null,
          reviewDate: caseData.review_date || '',
        });
        setIsCreatingCase(false);
      }
    } else if (!isCreatingCase) {
      // Clear fields when no case selected and not in creating mode
      setCaseDetails({
        title: '',
        description: '',
        priority: 'medium',
        assignedTo: null,
        status: 'open',
        caseType: null,
        reviewDate: '',
      });
    }
  }, [triageState.caseId, cases, isCreatingCase]);

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

    let constituentId = triageState.constituentId;
    let caseId = triageState.caseId;

    // Create constituent if in creating mode
    if (isCreatingConstituent && constituentDetails.name.trim()) {
      // Build full name with title if provided
      const fullName = constituentDetails.title
        ? `${constituentDetails.title} ${constituentDetails.name.trim()}`
        : constituentDetails.name.trim();

      const createResult = await createConstituentWithContacts({
        full_name: fullName,
        email: constituentDetails.email.trim() || undefined,
        address: constituentDetails.address.trim() || undefined,
      });

      if (createResult.success && createResult.constituentId) {
        constituentId = createResult.constituentId;
        toast.success(`Constituent "${constituentDetails.name}" created`);
      } else {
        toast.error(createResult.error || 'Failed to create constituent');
        return;
      }
    }

    // Create case if in creating mode
    if (isCreatingCase && caseDetails.title.trim()) {
      const createResult = await createCaseForMessage(message.id, {
        title: caseDetails.title.trim(),
        description: caseDetails.description.trim() || undefined,
        priority: caseDetails.priority,
        assigned_to: caseDetails.assignedTo || undefined,
        status: caseDetails.status,
        case_type: caseDetails.caseType || undefined,
        review_date: caseDetails.reviewDate || undefined,
      });

      if (createResult.success && createResult.caseId) {
        caseId = createResult.caseId;
        toast.success(`Case "${caseDetails.title}" created`);
      } else {
        toast.error(createResult.error || 'Failed to create case');
        return;
      }
    }

    const result = await approveTriage(message.id, {
      caseId: caseId || undefined,
      constituentId: constituentId || undefined,
      assigneeId: triageState.assigneeId || undefined,
      priority: triageState.priority,
      tagIds: triageState.tagIds,
    });

    if (result.success) {
      toast.success('Message triaged successfully');
      // Reset creating state for next message
      setIsCreatingConstituent(false);
      setIsCreatingCase(false);
      // Move to next message or go back
      if (messageIndex < allMessages.length - 1) {
        goToNext();
      } else {
        goBack();
      }
    } else {
      toast.error(result.error || 'Failed to triage message');
    }
  }, [message, triageState, isCreatingConstituent, constituentDetails, createConstituentWithContacts, isCreatingCase, caseDetails, createCaseForMessage, approveTriage, messageIndex, allMessages.length, goToNext, goBack]);

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
        {/* Assign to Campaign button */}
        <ScrollArea className="flex-1">
          <div className="p-4">
            {/* Constituent section */}
            <div className="space-y-3">
              <ConstituentSelector
                selectedId={triageState.constituentId}
                onSelect={(id) => {
                  setTriageState(prev => ({ ...prev, constituentId: id }));
                  setIsCreatingConstituent(false);
                }}
                onCreateNew={() => {
                  setTriageState(prev => ({ ...prev, constituentId: null }));
                  setIsCreatingConstituent(true);
                  // Pre-fill with message sender info
                  setConstituentDetails({
                    title: '',
                    name: message.senderName || '',
                    address: message.addressFromEmail || '',
                    email: message.senderEmail || '',
                  });
                }}
                recognitionStatus={
                  triageState.constituentId
                    ? message.triage_status === 'confirmed'
                      ? 'confirmed'
                      : 'ai_matched'
                    : 'none'
                }
                borderless
                hideSecondary
                placeholder={
                  isCreatingConstituent
                    ? constituentDetails.name.trim() || 'Creating constituent...'
                    : 'Select constituent'
                }
                labelClassName="text-lg"
              />

              {/* Ghost inputs for constituent details */}
              <div className="space-y-1">
                {/* Title and Name on same row */}
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:border hover:border-border border border-transparent transition-colors">
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Select
                    value={constituentDetails.title}
                    onValueChange={(value) => setConstituentDetails(prev => ({ ...prev, title: value }))}
                  >
                    <SelectTrigger className="w-16 border-0 bg-transparent h-7 px-0 text-sm focus:ring-0 focus:ring-offset-0">
                      <SelectValue placeholder="Title" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Mr">Mr</SelectItem>
                      <SelectItem value="Mrs">Mrs</SelectItem>
                      <SelectItem value="Ms">Ms</SelectItem>
                      <SelectItem value="Miss">Miss</SelectItem>
                      <SelectItem value="Dr">Dr</SelectItem>
                      <SelectItem value="Prof">Prof</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={constituentDetails.name}
                    onChange={(e) => setConstituentDetails(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Name"
                    className="border-0 bg-transparent h-7 px-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
                {/* Address */}
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:border hover:border-border border border-transparent transition-colors">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Input
                    value={constituentDetails.address}
                    onChange={(e) => setConstituentDetails(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Residential address"
                    className="border-0 bg-transparent h-7 px-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
                {/* Email */}
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:border hover:border-border border border-transparent transition-colors">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Input
                    value={constituentDetails.email}
                    onChange={(e) => setConstituentDetails(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Email"
                    className="border-0 bg-transparent h-7 px-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
              </div>
            </div>

            <Separator className="my-6"/>
            <div className="flex items-center gap-2">
              <TooltipProvider delayDuration={300}>
                <div className="flex border rounded-md overflow-hidden">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={campaign ? 'default' : 'ghost'}
                        size="sm"
                        className="rounded-none border-0 text-lg px-3"
                        onClick={() => setShowAssignCampaign(true)}
                        disabled={isUnlinkingCampaign}
                      >
                        📢
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{campaign ? campaign.name : 'Assign to campaign'}</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={message.is_policy_email && !campaign ? 'default' : 'ghost'}
                        size="sm"
                        className="rounded-none border-0 border-l text-lg px-3"
                        onClick={async () => {
                          if (campaign) {
                            await handleUnlinkCampaign();
                          }
                          await updateMessage(message.id, { is_policy_email: true });
                        }}
                        disabled={isUnlinkingCampaign}
                      >
                        📄
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Policy correspondence</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={!message.is_policy_email && !campaign ? 'default' : 'ghost'}
                        size="sm"
                        className="rounded-none border-0 border-l text-lg px-3"
                        onClick={async () => {
                          if (campaign) {
                            await handleUnlinkCampaign();
                          }
                          await updateMessage(message.id, { is_policy_email: false });
                        }}
                        disabled={isUnlinkingCampaign}
                      >
                        🤝
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Casework</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
              {campaign && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
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

            {/* Case fields */}
            <div className="space-y-6 -mx-4 px-4 py-4 rounded-lg overflow-hidden">
              {/* Case section */}
              <div className="space-y-3 min-w-0">
                <CaseSelector
                  selectedId={triageState.caseId}
                  onSelect={(id) => {
                    setTriageState(prev => ({ ...prev, caseId: id }));
                    setIsCreatingCase(false);
                  }}
                  onCreateNew={() => {
                    setTriageState(prev => ({ ...prev, caseId: null }));
                    setIsCreatingCase(true);
                    // Pre-fill with message subject
                    setCaseDetails({
                      title: message.subject || '',
                      description: '',
                      priority: 'medium',
                      assignedTo: null,
                      status: 'open',
                      caseType: null,
                      reviewDate: '',
                    });
                  }}
                  constituentId={triageState.constituentId}
                  borderless
                  hideSecondary
                  placeholder={
                    isCreatingCase
                      ? caseDetails.title.trim() || 'Creating case...'
                      : 'Select or create case'
                  }
                  labelClassName="text-lg"
                />

                {/* Ghost inputs for case details */}
                <div className="space-y-1">
                  {/* Title */}
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-transparent transition-colors hover:border-border">
                    <Type className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Input
                      value={caseDetails.title}
                      onChange={(e) => setCaseDetails(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Case title"
                      className="border-0 bg-transparent h-7 px-0 text-sm font-medium focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </div>
                  {/* Description */}
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-transparent transition-colors hover:border-border">
                    <AlignLeft className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Input
                      value={caseDetails.description}
                      onChange={(e) => setCaseDetails(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Description"
                      className="border-0 bg-transparent h-7 px-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </div>
                  {/* Status */}
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-transparent transition-colors hover:border-border">
                    <ListChecks className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Select
                      value={caseDetails.status}
                      onValueChange={(value) => setCaseDetails(prev => ({ ...prev, status: value as CaseStatus }))}
                    >
                      <SelectTrigger className="w-full border-0 bg-transparent h-7 px-0 text-sm focus:ring-0 focus:ring-offset-0">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Case Type */}
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-transparent transition-colors hover:border-border">
                    <Layers className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Select
                      value={caseDetails.caseType || ''}
                      onValueChange={(value) => setCaseDetails(prev => ({ ...prev, caseType: value as CaseType }))}
                    >
                      <SelectTrigger className="w-full border-0 bg-transparent h-7 px-0 text-sm focus:ring-0 focus:ring-offset-0">
                        <SelectValue placeholder="Case type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="type_1">Type 1</SelectItem>
                        <SelectItem value="type_2">Type 2</SelectItem>
                        <SelectItem value="type_3">Type 3</SelectItem>
                        <SelectItem value="type_4">Type 4</SelectItem>
                        <SelectItem value="type_5">Type 5</SelectItem>
                        <SelectItem value="type_6">Type 6</SelectItem>
                        <SelectItem value="type_7">Type 7</SelectItem>
                        <SelectItem value="type_8">Type 8</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Review Date */}
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-transparent transition-colors hover:border-border">
                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm text-muted-foreground shrink-0">Revise on:</span>
                    <Input
                      type="date"
                      value={caseDetails.reviewDate}
                      onChange={(e) => setCaseDetails(prev => ({ ...prev, reviewDate: e.target.value }))}
                      className="border-0 bg-transparent h-7 px-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </div>
                  {/* Assignee - CaseworkerSelector already has its own icon */}
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-transparent transition-colors hover:border-border">
                    <div className="flex-1 min-w-0">
                      <CaseworkerSelector
                        selectedId={caseDetails.assignedTo}
                        onSelect={(id) => setCaseDetails(prev => ({ ...prev, assignedTo: id }))}
                        showUnassignedOption
                        borderless
                        hideSecondary
                        label=""
                        placeholder="Assignee"
                      />
                    </div>
                  </div>
                  {/* Priority */}
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-transparent transition-colors hover:border-border">
                    <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <PrioritySelector
                        value={caseDetails.priority}
                        onChange={(priority) => setCaseDetails(prev => ({ ...prev, priority }))}
                        label=""
                        borderless
                        size="sm"
                      />
                    </div>
                  </div>
                  {/* Tags */}
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-transparent transition-colors hover:border-border">
                    <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <TagPicker
                        selectedTagIds={triageState.tagIds}
                        onChange={(tagIds) => setTriageState(prev => ({ ...prev, tagIds }))}
                        label=""
                        borderless
                        placeholder="Tags"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Action buttons */}
        <div className="p-4 border-t bg-background space-y-2">
          <Button
            className="w-full"
            onClick={handleApprove}
            disabled={isProcessing || (!campaign && !message.is_policy_email && !triageState.caseId && !(isCreatingCase && caseDetails.title.trim()))}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                {campaign ? 'Approve' : message.is_policy_email ? 'Approve as Policy' : 'Approve & Link to Case'}
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
