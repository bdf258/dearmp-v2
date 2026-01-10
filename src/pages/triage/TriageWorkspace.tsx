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
import { useTriageProgress } from '@/lib/TriageProgressContext';
import {
  useTriageQueue,
  useTriageActions,
  useMessageBody,
  useTriageSuggestion,
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
  TriageFieldRow,
  TriageFieldColumn,
} from '@/components/triage';
import {
  ArrowLeft,
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
  CalendarIcon,
  Tag,
  Layers,
  Megaphone,
  ScrollText,
  HeartHandshake,
  Pencil,
  Sparkles,
  Link2,
} from 'lucide-react';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { toast } from 'sonner';
import type { CasePriority, CaseStatus, CaseType } from '@/lib/database.types';

export function TriageWorkspace() {
  const navigate = useNavigate();
  const { messageId } = useParams<{ messageId: string }>();
  const [searchParams] = useSearchParams();

  const { messages: allMessages, isLoading: dataLoading } = useTriageQueue();
  const { approveTriage, createConstituentWithContacts, createCaseForMessage, isProcessing } = useTriageActions();
  const { campaigns, getTagsForEntity, updateMessage, constituents, constituentContacts, cases, profiles } = useSupabase();
  const { setProgress, setNavigation } = useTriageProgress();

  // Fetch AI triage suggestion for this email
  const { suggestion, isLoading: suggestionLoading, recordDecision } = useTriageSuggestion(messageId || null);

  // Track which fields were AI-prefilled (to detect user modifications)
  const [aiPrefilledFields, setAiPrefilledFields] = useState<Set<string>>(new Set());
  const [userModifiedFields, setUserModifiedFields] = useState<Set<string>>(new Set());

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

  // Email note state
  const [emailNote, setEmailNote] = useState('');
  const [isEditingNote, setIsEditingNote] = useState(false);

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

  // Helper to find profile by external ID (for legacy assignee IDs)
  const findProfileByExternalId = useCallback((externalId: number | null) => {
    if (!externalId) return null;
    // Look for profile matching the external ID (if stored in metadata or matching pattern)
    return profiles.find(p => p.id === String(externalId)) || null;
  }, [profiles]);

  // Helper to mark a field as user-modified
  const markFieldModified = useCallback((fieldName: string) => {
    if (aiPrefilledFields.has(fieldName)) {
      setUserModifiedFields(prev => new Set(prev).add(fieldName));
    }
  }, [aiPrefilledFields]);

  // Check if a field was AI-prefilled and not modified
  const isAiPrefilled = useCallback((fieldName: string) => {
    return aiPrefilledFields.has(fieldName) && !userModifiedFields.has(fieldName);
  }, [aiPrefilledFields, userModifiedFields]);

  // Initialize triage state from message and AI suggestion
  useEffect(() => {
    if (message) {
      // Get existing tags for this message
      const messageTags = getTagsForEntity('message', message.id);
      const prefilledFields = new Set<string>();

      // Start with message data as base
      let constituentId = message.senderConstituent?.id || null;
      let caseId = message.case_id || null;
      let assigneeId: string | null = null;
      let priority: CasePriority = 'medium';
      let tagIds = messageTags.map(t => t.tag_id);

      // If we have an AI suggestion, use it to prefill
      if (suggestion && !suggestionLoading) {
        // Constituent from AI
        if (suggestion.matched_constituent_id) {
          constituentId = suggestion.matched_constituent_id;
          prefilledFields.add('constituentId');
        }

        // Case from AI (for "add to existing" action)
        if (suggestion.recommended_action === 'add_to_existing' && suggestion.suggested_existing_case_id) {
          caseId = suggestion.suggested_existing_case_id;
          prefilledFields.add('caseId');
        }

        // Priority from AI
        if (suggestion.suggested_priority) {
          priority = suggestion.suggested_priority;
          prefilledFields.add('priority');
        }

        // Tags from AI
        if (suggestion.suggested_tags && suggestion.suggested_tags.length > 0) {
          tagIds = suggestion.suggested_tags;
          prefilledFields.add('tagIds');
        }

        // Assignee from AI (need to map external ID to profile ID)
        if (suggestion.suggested_assignee_id) {
          const profile = findProfileByExternalId(suggestion.suggested_assignee_id);
          if (profile) {
            assigneeId = profile.id;
            prefilledFields.add('assigneeId');
          }
        }
      }

      setTriageState({
        constituentId,
        caseId,
        assigneeId,
        priority,
        tagIds,
      });

      setAiPrefilledFields(prefilledFields);
      setUserModifiedFields(new Set());

      // Reset email note when message changes
      setEmailNote('');
      setIsEditingNote(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Only re-run on specific property changes, not full message object
  }, [message?.id, message?.senderConstituent?.id, message?.case_id, getTagsForEntity, suggestion, suggestionLoading, findProfileByExternalId]);

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

  // Prefill case details from AI suggestion when action is "create_case"
  useEffect(() => {
    if (suggestion && !suggestionLoading && message) {
      if (suggestion.recommended_action === 'create_case' && !triageState.caseId) {
        setIsCreatingCase(true);
        const prefilledFields = new Set(aiPrefilledFields);

        // Find profile for assignee
        let assignedTo: string | null = null;
        if (suggestion.suggested_assignee_id) {
          const profile = findProfileByExternalId(suggestion.suggested_assignee_id);
          if (profile) {
            assignedTo = profile.id;
            prefilledFields.add('caseAssignedTo');
          }
        }

        setCaseDetails({
          title: message.subject || '',
          description: '',
          priority: suggestion.suggested_priority || 'medium',
          assignedTo,
          status: 'open',
          caseType: null, // TODO: Map suggested_case_type_id to CaseType
          reviewDate: '',
        });

        if (suggestion.suggested_priority) {
          prefilledFields.add('casePriority');
        }

        setAiPrefilledFields(prefilledFields);
      }
    }
  }, [suggestion, suggestionLoading, message, triageState.caseId, aiPrefilledFields, findProfileByExternalId]);

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

  // Update header progress bar and navigation
  useEffect(() => {
    if (!dataLoading && allMessages.length > 0 && messageIndex >= 0) {
      setProgress({ current: messageIndex + 1, total: allMessages.length });
      setNavigation({
        canGoPrevious: messageIndex > 0,
        canGoNext: messageIndex < allMessages.length - 1,
        onPrevious: goToPrevious,
        onNext: goToNext,
        onBack: goBack,
      });
    }
    // Cleanup on unmount
    return () => {
      setProgress(null);
      setNavigation(null);
    };
  }, [messageIndex, allMessages.length, dataLoading, setProgress, setNavigation, goToPrevious, goToNext, goBack]);

  // Approve triage
  const handleApprove = useCallback(async () => {
    if (!message) return;

    // Capture the next message ID BEFORE approving, so we can navigate immediately
    // regardless of whether the data has refreshed yet
    const nextMessageId = messageIndex < allMessages.length - 1
      ? allMessages[messageIndex + 1].id
      : null;

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
      // Record user decision on AI suggestion if one exists
      if (suggestion) {
        const wasModified = userModifiedFields.size > 0;
        const decision = wasModified ? 'modified' : 'accepted';
        const modifications = wasModified ? {
          modifiedFields: Array.from(userModifiedFields),
          finalValues: {
            constituentId,
            caseId,
            priority: triageState.priority,
            tagIds: triageState.tagIds,
            assigneeId: triageState.assigneeId,
          },
        } : undefined;

        await recordDecision(decision, modifications);
      }

      toast.success('Message triaged successfully');
      // Reset creating state for next message
      setIsCreatingConstituent(false);
      setIsCreatingCase(false);

      // Immediately navigate to the next message (captured before approval)
      // This ensures smooth workflow even if data refresh is slow
      if (nextMessageId) {
        navigate(`/triage/messages/${nextMessageId}`);
      } else {
        goBack();
      }
    } else {
      toast.error(result.error || 'Failed to triage message');
    }
  }, [message, triageState, isCreatingConstituent, constituentDetails, createConstituentWithContacts, isCreatingCase, caseDetails, createCaseForMessage, approveTriage, messageIndex, allMessages, navigate, goBack, suggestion, userModifiedFields, recordDecision]);

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

            {/* Email note card */}
            <div className="mb-4 rounded-lg border bg-muted/50 p-3">
              <div className="flex items-start gap-2">
                {isEditingNote ? (
                  <input
                    type="text"
                    value={emailNote}
                    onChange={(e) => setEmailNote(e.target.value.slice(0, 150))}
                    onBlur={() => setIsEditingNote(false)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') setIsEditingNote(false);
                      if (e.key === 'Escape') setIsEditingNote(false);
                    }}
                    placeholder="Add a note (max 150 characters)..."
                    maxLength={150}
                    autoFocus
                    className="flex-1 bg-transparent text-sm focus:outline-none"
                  />
                ) : (
                  <p className="flex-1 text-sm text-muted-foreground">
                    {emailNote || 'No note added'}
                  </p>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => setIsEditingNote(true)}
                >
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
              <span className="text-xs text-gray-400 text-right">
                {150 - emailNote.length}
              </span>
            </div>

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
        {/* AI Suggestion Summary */}
        {suggestion && (
          <div className="p-4 border-b bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-violet-500" />
              <span className="text-sm font-medium text-violet-700 dark:text-violet-300">AI Suggestion</span>
              {suggestion.action_confidence && (
                <Badge variant="secondary" className="ml-auto text-xs">
                  {Math.round(suggestion.action_confidence * 100)}% confident
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {suggestion.email_type && (
                <Badge variant="outline" className="text-xs capitalize">
                  {suggestion.email_type.replace('_', ' ')}
                  {suggestion.email_type_confidence && (
                    <span className="ml-1 text-muted-foreground">
                      ({Math.round(suggestion.email_type_confidence * 100)}%)
                    </span>
                  )}
                </Badge>
              )}
              {suggestion.recommended_action && (
                <Badge
                  variant={suggestion.recommended_action === 'create_case' ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {suggestion.recommended_action === 'create_case' && 'Create new case'}
                  {suggestion.recommended_action === 'add_to_existing' && 'Add to existing case'}
                  {suggestion.recommended_action === 'assign_campaign' && 'Assign to campaign'}
                  {suggestion.recommended_action === 'mark_spam' && 'Mark as spam'}
                  {suggestion.recommended_action === 'ignore' && 'Ignore'}
                </Badge>
              )}
            </div>
          </div>
        )}

        <ScrollArea className="flex-1">
          <div className="p-4">
            {/* Constituent section */}
            <div className="space-y-3">
              <div className="relative">
                {isAiPrefilled('constituentId') && (
                  <div className="absolute -left-2 top-1/2 -translate-y-1/2">
                    <Sparkles className="h-3 w-3 text-violet-500" />
                  </div>
                )}
                <ConstituentSelector
                  selectedId={triageState.constituentId}
                  onSelect={(id) => {
                    setTriageState(prev => ({ ...prev, constituentId: id }));
                    setIsCreatingConstituent(false);
                    markFieldModified('constituentId');
                  }}
                  onCreateNew={() => {
                    setTriageState(prev => ({ ...prev, constituentId: null }));
                    setIsCreatingConstituent(true);
                    markFieldModified('constituentId');
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
                      ? isAiPrefilled('constituentId')
                        ? 'ai_matched'
                        : message.triage_status === 'confirmed'
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
                {isAiPrefilled('constituentId') && suggestion?.matched_constituent_confidence && (
                  <span className="text-xs text-violet-600 dark:text-violet-400 ml-1">
                    {Math.round(suggestion.matched_constituent_confidence * 100)}% match
                  </span>
                )}
              </div>

              {/* Ghost inputs for constituent details */}
              <div className="space-y-1">
                {/* Title and Name on same row */}
                <TriageFieldRow tooltip="Constituent's title and full name" icon={User}>
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
                </TriageFieldRow>
                {/* Address */}
                <TriageFieldRow tooltip="Residential address for constituency verification" icon={MapPin}>
                  <Input
                    value={constituentDetails.address}
                    onChange={(e) => setConstituentDetails(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Residential address"
                    className="border-0 bg-transparent h-7 px-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </TriageFieldRow>
                {/* Email */}
                <TriageFieldRow tooltip="Primary contact email" icon={Mail}>
                  <Input
                    value={constituentDetails.email}
                    onChange={(e) => setConstituentDetails(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Email"
                    className="border-0 bg-transparent h-7 px-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </TriageFieldRow>
              </div>
            </div>

            <Separator className="my-6"/>

            {/* Case fields */}
            <div className="space-y-6 -mx-4 px-4 py-4 rounded-lg overflow-hidden">
              {/* Case section */}
              <div className="space-y-3 min-w-0">
                <div className="relative">
                  {isAiPrefilled('caseId') && (
                    <div className="absolute -left-2 top-1/2 -translate-y-1/2">
                      <Sparkles className="h-3 w-3 text-violet-500" />
                    </div>
                  )}
                  <CaseSelector
                    selectedId={triageState.caseId}
                    onSelect={(id) => {
                      setTriageState(prev => ({ ...prev, caseId: id }));
                      setIsCreatingCase(false);
                      markFieldModified('caseId');
                    }}
                    onCreateNew={() => {
                      setTriageState(prev => ({ ...prev, caseId: null }));
                      setIsCreatingCase(true);
                      markFieldModified('caseId');
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
                </div>

                {/* AI Matched Cases - Quick select options */}
                {suggestion?.matched_cases && suggestion.matched_cases.length > 0 && !triageState.caseId && !isCreatingCase && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Link2 className="h-3 w-3" />
                      <span>Similar cases found:</span>
                    </div>
                    <div className="space-y-1">
                      {suggestion.matched_cases.slice(0, 3).map((matchedCase) => (
                        <Button
                          key={matchedCase.id}
                          variant="outline"
                          size="sm"
                          className="w-full justify-start text-left h-auto py-2 px-3"
                          onClick={() => {
                            setTriageState(prev => ({ ...prev, caseId: matchedCase.id }));
                            setIsCreatingCase(false);
                          }}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm">{matchedCase.summary}</span>
                              <Badge variant="secondary" className="text-xs shrink-0">
                                {Math.round(matchedCase.relevanceScore * 100)}%
                              </Badge>
                            </div>
                            {matchedCase.externalId && (
                              <span className="text-xs text-muted-foreground">
                                #{matchedCase.externalId}
                              </span>
                            )}
                          </div>
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Ghost inputs for case details */}
                <div className="space-y-1">
                  {/* Title */}
                  <TriageFieldRow tooltip="Case reference title" icon={Type}>
                    <Input
                      value={caseDetails.title}
                      onChange={(e) => setCaseDetails(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Case title"
                      className="border-0 bg-transparent h-7 px-0 text-sm font-medium focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </TriageFieldRow>
                  {/* Description */}
                  <TriageFieldColumn
                    tooltip="Brief case description (max 100 characters)"
                    icon={AlignLeft}
                    footer={
                      <span className="text-xs text-gray-400 text-right">
                        {100 - caseDetails.description.length}
                      </span>
                    }
                  >
                    <textarea
                      value={caseDetails.description}
                      onChange={(e) => {
                        const value = e.target.value.slice(0, 100);
                        setCaseDetails(prev => ({ ...prev, description: value }));
                        // Auto-resize
                        e.target.style.height = 'auto';
                        e.target.style.height = `${e.target.scrollHeight}px`;
                      }}
                      onFocus={(e) => {
                        // Ensure proper height on focus
                        e.target.style.height = 'auto';
                        e.target.style.height = `${e.target.scrollHeight}px`;
                      }}
                      placeholder="Description"
                      maxLength={100}
                      rows={1}
                      className="flex-1 border-0 bg-transparent px-0 text-sm focus-visible:outline-none resize-none leading-relaxed overflow-hidden"
                      style={{ minHeight: '1.25rem' }}
                    />
                  </TriageFieldColumn>
                  {/* Campaign/Policy/Casework switch + Status */}
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-transparent transition-colors hover:border-border">
                    <TooltipProvider delayDuration={300}>
                      <div className="flex border rounded-md overflow-hidden shrink-0">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant={campaign ? 'default' : 'ghost'}
                              size="sm"
                              className="rounded-none border-0 px-2 h-7"
                              onClick={() => setShowAssignCampaign(true)}
                              disabled={isUnlinkingCampaign}
                            >
                              <Megaphone className="h-3.5 w-3.5" />
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
                              className="rounded-none border-0 border-l px-2 h-7"
                              onClick={async () => {
                                if (campaign) {
                                  await handleUnlinkCampaign();
                                }
                                await updateMessage(message.id, { is_policy_email: true });
                              }}
                              disabled={isUnlinkingCampaign}
                            >
                              <ScrollText className="h-3.5 w-3.5" />
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
                              className="rounded-none border-0 border-l px-2 h-7"
                              onClick={async () => {
                                if (campaign) {
                                  await handleUnlinkCampaign();
                                }
                                await updateMessage(message.id, { is_policy_email: false });
                              }}
                              disabled={isUnlinkingCampaign}
                            >
                              <HeartHandshake className="h-3.5 w-3.5" />
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
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={handleUnlinkCampaign}
                        disabled={isUnlinkingCampaign}
                        title="Remove from campaign"
                      >
                        {isUnlinkingCampaign ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <X className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    )}
                    <Select
                      value={caseDetails.status}
                      onValueChange={(value) => setCaseDetails(prev => ({ ...prev, status: value as CaseStatus }))}
                    >
                      <SelectTrigger className="flex-1 border-0 bg-transparent h-7 px-0 text-sm focus:ring-0 focus:ring-offset-0">
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
                  <TriageFieldRow tooltip="Category of casework" icon={Layers}>
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
                  </TriageFieldRow>
                  {/* Tags */}
                  <TriageFieldRow
                    tooltip="Labels for filtering and organization"
                    icon={isAiPrefilled('tagIds') ? Sparkles : Tag}
                    iconClassName={isAiPrefilled('tagIds') ? 'text-violet-500' : undefined}
                  >
                    <div className="flex-1 min-w-0">
                      <TagPicker
                        selectedTagIds={triageState.tagIds}
                        onChange={(tagIds) => {
                          setTriageState(prev => ({ ...prev, tagIds }));
                          markFieldModified('tagIds');
                        }}
                        label=""
                        borderless
                        placeholder="Tags"
                      />
                    </div>
                  </TriageFieldRow>
                  {/* Review Date */}
                  <TriageFieldRow tooltip="Date to follow up on this case" icon={CalendarIcon}>
                    <span className="text-sm text-muted-foreground shrink-0">Revise on:</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          className="h-7 px-2 text-sm font-normal justify-start hover:bg-transparent"
                        >
                          {caseDetails.reviewDate ? (
                            format(new Date(caseDetails.reviewDate), 'PPP')
                          ) : (
                            <span className="text-muted-foreground">Pick a date</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={caseDetails.reviewDate ? new Date(caseDetails.reviewDate) : undefined}
                          onSelect={(date) => setCaseDetails(prev => ({
                            ...prev,
                            reviewDate: date ? format(date, 'yyyy-MM-dd') : ''
                          }))}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </TriageFieldRow>
                  {/* Assignee - CaseworkerSelector already has its own icon */}
                  <TriageFieldRow
                    tooltip="Staff member handling this case"
                    icon={isAiPrefilled('caseAssignedTo') ? Sparkles : User}
                    iconClassName={isAiPrefilled('caseAssignedTo') ? 'text-violet-500' : undefined}
                    showIcon={false}
                  >
                    <div className="flex-1 min-w-0">
                      <CaseworkerSelector
                        selectedId={caseDetails.assignedTo}
                        onSelect={(id) => {
                          setCaseDetails(prev => ({ ...prev, assignedTo: id }));
                          markFieldModified('caseAssignedTo');
                        }}
                        showUnassignedOption
                        borderless
                        hideSecondary
                        label=""
                        placeholder="Assignee"
                      />
                    </div>
                  </TriageFieldRow>
                  {/* Priority */}
                  <TriageFieldRow
                    tooltip="Case urgency level"
                    icon={isAiPrefilled('casePriority') ? Sparkles : AlertCircle}
                    iconClassName={isAiPrefilled('casePriority') ? 'text-violet-500' : undefined}
                  >
                    <div className="flex-1 min-w-0">
                      <PrioritySelector
                        value={caseDetails.priority}
                        onChange={(priority) => {
                          setCaseDetails(prev => ({ ...prev, priority }));
                          markFieldModified('casePriority');
                        }}
                        label=""
                        borderless
                        size="sm"
                      />
                    </div>
                  </TriageFieldRow>
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
