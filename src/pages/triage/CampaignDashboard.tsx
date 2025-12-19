/**
 * Campaign Dashboard
 *
 * Campaign list with per-campaign inbox showing:
 * - Buckets: known constituents, has address, no address
 * - Bulk selection with confirm/reject actions
 * - Navigate to single-email triage for detailed review
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useSupabase } from '@/lib/SupabaseContext';
import {
  useCampaignsWithTriageCounts,
  useTriageQueue,
  useTriageActions,
  useMessageBody,
  type ConstituentStatus,
  type TriageMessage,
} from '@/hooks/triage/useTriage';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  TriageSkeletons,
  TagPicker,
  ConstituentSelector,
  ConstituentCard,
  type RecognitionStatus,
} from '@/components/triage';
import {
  Mail,
  CheckCheck,
  XCircle,
  X,
  Loader2,
  ExternalLink,
  User,
  MapPin,
  MapPinOff,
  Flag,
  ArrowLeft,
  Check,
  UserCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Bucket tab configuration - using icons matching DashboardPrototype
const bucketTabs: { id: ConstituentStatus; label: string; icon: React.ReactNode }[] = [
  { id: 'known', label: 'Known', icon: <User className="h-4 w-4" /> },
  { id: 'has_address', label: 'Address included', icon: <MapPin className="h-4 w-4" /> },
  { id: 'no_address', label: 'No address', icon: <MapPinOff className="h-4 w-4" /> },
];

export function CampaignDashboard() {
  const navigate = useNavigate();
  const { campaignId } = useParams<{ campaignId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  // Get bucket and messageId from URL
  const currentBucket = (searchParams.get('bucket') || 'known') as ConstituentStatus;
  const selectedMessageId = searchParams.get('message');

  const { campaigns } = useCampaignsWithTriageCounts();
  const { loading } = useSupabase();

  // Selected campaign
  const selectedCampaign = campaignId
    ? campaigns.find(c => c.id === campaignId)
    : null;

  // Handle campaign selection
  const handleCampaignSelect = useCallback((id: string) => {
    navigate(`/triage/campaigns/${id}?bucket=known`);
  }, [navigate]);

  // Handle back to campaign list
  const handleBackToCampaignList = useCallback(() => {
    navigate('/triage/campaigns');
  }, [navigate]);

  // Handle bucket change - preserve message selection if in same bucket
  const handleBucketChange = useCallback((bucket: string) => {
    setSearchParams({ bucket });
  }, [setSearchParams]);

  // Handle message selection for deep-linking
  const handleMessageSelect = useCallback((messageId: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (messageId) {
      params.set('message', messageId);
    } else {
      params.delete('message');
    }
    setSearchParams(params);
  }, [searchParams, setSearchParams]);

  if (loading) {
    return (
      <div className="flex h-full -m-6">
        <div className="w-80 border-r p-4">
          <TriageSkeletons.CampaignList count={4} />
        </div>
        <div className="flex-1 p-4">
          <TriageSkeletons.MessageList count={6} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Campaign list sidebar */}
      <div className="w-80 border-r flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-lg font-semibold">Campaign Triage</h1>
          <p className="text-sm text-muted-foreground">
            {campaigns.length} campaigns with messages to triage
          </p>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-2">
            {campaigns.length === 0 ? (
              <div className="text-center py-8">
                <Mail className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No campaigns to triage</p>
              </div>
            ) : (
              campaigns.map((campaign) => (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  isSelected={campaign.id === campaignId}
                  onClick={() => handleCampaignSelect(campaign.id)}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Campaign inbox */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedCampaign ? (
          <CampaignInbox
            campaign={selectedCampaign}
            currentBucket={currentBucket}
            onBucketChange={handleBucketChange}
            selectedMessageId={selectedMessageId}
            onMessageSelect={handleMessageSelect}
            onBack={handleBackToCampaignList}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <h2 className="text-lg font-medium">Select a campaign</h2>
              <p className="text-sm text-muted-foreground">
                Choose a campaign from the list to view messages
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Campaign card component
function CampaignCard({
  campaign,
  isSelected,
  onClick,
}: {
  campaign: ReturnType<typeof useCampaignsWithTriageCounts>['campaigns'][0];
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <Card
      className={cn(
        'cursor-pointer transition-colors',
        isSelected && 'border-primary bg-primary/5'
      )}
      onClick={onClick}
    >
      <CardHeader className="p-3 pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-medium line-clamp-1">
            {campaign.name}
          </CardTitle>
          <Badge variant="secondary" className="shrink-0">
            {campaign.totalCount}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        <div className="flex gap-3 text-xs text-gray-800">
          <span className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {campaign.knownCount}
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {campaign.hasAddressCount}
          </span>
          <span className="flex items-center gap-1">
            <MapPinOff className="h-3 w-3" />
            {campaign.noAddressCount}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// Campaign inbox with buckets - styled like DashboardPrototype
function CampaignInbox({
  campaign,
  currentBucket,
  onBucketChange,
  selectedMessageId,
  onMessageSelect,
  onBack,
}: {
  campaign: ReturnType<typeof useCampaignsWithTriageCounts>['campaigns'][0];
  currentBucket: ConstituentStatus;
  onBucketChange: (bucket: string) => void;
  selectedMessageId: string | null;
  onMessageSelect: (messageId: string | null) => void;
  onBack: () => void;
}) {
  const navigate = useNavigate();
  const { profiles } = useSupabase();
  const { messages } = useTriageQueue({ campaignId: campaign.id, constituentStatus: currentBucket });
  const { approveTriage, bulkDismissTriage, isProcessing } = useTriageActions();

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<'approve' | 'reject' | 'confirm' | 'not_campaign' | null>(null);

  // Track confirmed/rejected status for visual feedback (like DashboardPrototype)
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());
  const [rejectedIds, setRejectedIds] = useState<Set<string>>(new Set());

  // Menubar state - Assignee & Tags for bulk operations
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  // Get counts for tabs
  const { allMessages } = useTriageQueue({ campaignId: campaign.id });
  const counts = useMemo(() => ({
    known: allMessages.filter(m => m.constituentStatus === 'known').length,
    has_address: allMessages.filter(m => m.constituentStatus === 'has_address').length,
    no_address: allMessages.filter(m => m.constituentStatus === 'no_address').length,
  }), [allMessages]);

  const pendingCount = campaign.totalCount;

  // Detail message from URL or selection
  const detailMessage = useMemo(() => {
    if (selectedMessageId) {
      return messages.find(m => m.id === selectedMessageId) || null;
    }
    return null;
  }, [selectedMessageId, messages]);

  // Sync detail message on bucket change if current selection not in new bucket
  useEffect(() => {
    if (selectedMessageId && !messages.find(m => m.id === selectedMessageId)) {
      onMessageSelect(null);
    }
  }, [messages, selectedMessageId, onMessageSelect]);

  // Toggle selection
  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Bulk approve (for known constituents)
  const handleBulkApprove = useCallback(async () => {
    if (selectedIds.size === 0) return;

    setActionInProgress('approve');
    const selectedMessages = messages.filter(m => selectedIds.has(m.id));
    let successCount = 0;

    for (const message of selectedMessages) {
      // For known constituents, auto-approve with suggested case
      if (message.senderConstituent) {
        const result = await approveTriage(message.id, {
          constituentId: message.senderConstituent.id,
        });
        if (result.success) successCount++;
      }
    }

    if (successCount === selectedMessages.length) {
      toast.success(`Approved ${successCount} messages`);
    } else {
      toast.warning(`Approved ${successCount} of ${selectedMessages.length} messages`);
    }
    clearSelection();
    setActionInProgress(null);
  }, [selectedIds, messages, approveTriage, clearSelection]);

  // Bulk reject (dismiss messages)
  const handleBulkReject = useCallback(async () => {
    if (selectedIds.size === 0) return;

    setActionInProgress('reject');
    const result = await bulkDismissTriage(
      Array.from(selectedIds),
      'Not a valid constituent email'
    );

    if (result.success) {
      toast.success(`Dismissed ${result.successCount} messages`);
    } else if (result.successCount > 0) {
      toast.warning(`Dismissed ${result.successCount} of ${selectedIds.size} messages`);
    } else {
      toast.error('Failed to dismiss messages');
    }

    clearSelection();
    setShowRejectConfirm(false);
    setActionInProgress(null);
  }, [selectedIds, bulkDismissTriage, clearSelection]);

  // Handle single message confirm (campaign email confirmed)
  const handleConfirmMessage = useCallback(async (messageId: string) => {
    setActionInProgress('confirm');
    const message = messages.find(m => m.id === messageId);
    if (message?.senderConstituent) {
      const result = await approveTriage(messageId, {
        constituentId: message.senderConstituent.id,
      });
      if (result.success) {
        // Mark as confirmed for visual feedback
        setConfirmedIds(prev => new Set(prev).add(messageId));
        toast.success('Message confirmed');
        // Move to next message
        const currentIndex = messages.findIndex(m => m.id === messageId);
        const nextMessage = messages[currentIndex + 1] || messages[currentIndex - 1];
        if (nextMessage) {
          onMessageSelect(nextMessage.id);
        } else {
          onMessageSelect(null);
        }
      } else {
        toast.error('Failed to confirm message');
      }
    }
    setActionInProgress(null);
  }, [messages, approveTriage, onMessageSelect]);

  // Handle single message reject (not a campaign email)
  const handleRejectMessage = useCallback(async (messageId: string) => {
    setActionInProgress('not_campaign');
    const result = await bulkDismissTriage([messageId], 'Not a campaign email');
    if (result.success) {
      // Mark as rejected for visual feedback
      setRejectedIds(prev => new Set(prev).add(messageId));
      toast.success('Message marked as not a campaign email');
      // Move to next message
      const currentIndex = messages.findIndex(m => m.id === messageId);
      const nextMessage = messages[currentIndex + 1] || messages[currentIndex - 1];
      if (nextMessage) {
        onMessageSelect(nextMessage.id);
      } else {
        onMessageSelect(null);
      }
    } else {
      toast.error('Failed to update message');
    }
    setActionInProgress(null);
  }, [messages, bulkDismissTriage, onMessageSelect]);

  // Navigate to single triage
  const handleOpenTriage = useCallback((messageId: string) => {
    navigate(`/triage/messages/${messageId}?from=${encodeURIComponent(window.location.pathname + window.location.search)}`);
  }, [navigate]);

  const isActionInProgress = isProcessing || actionInProgress !== null;

  // Get caseworkers list
  const caseworkers = profiles.filter(p => p.role === 'staff' || p.role === 'admin');

  return (
    <div className="h-full flex flex-col">
      {/* Header - styled like DashboardPrototype */}
      <div className="shrink-0 flex items-center justify-between p-4 border-b gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" onClick={onBack} className="shrink-0">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div className="h-4 w-px bg-border shrink-0" />
          <Flag className="h-5 w-5 text-blue-600 shrink-0" />
          <h1 className="text-xl font-semibold truncate">{campaign.name}</h1>
          <Badge variant="secondary" className="shrink-0">
            <span>{pendingCount}</span>
            <span className="hidden sm:inline ml-1">pending</span>
          </Badge>
        </div>

        {/* Menubar: Assignee & Tags */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          {/* Bulk selection actions */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 mr-2 sm:mr-4">
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {selectedIds.size} selected
              </span>
              {currentBucket === 'known' && (
                <Button
                  size="sm"
                  onClick={handleBulkApprove}
                  disabled={isActionInProgress}
                >
                  {actionInProgress === 'approve' ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <CheckCheck className="h-4 w-4 mr-1" />
                  )}
                  Approve All
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowRejectConfirm(true)}
                disabled={isActionInProgress}
              >
                {actionInProgress === 'reject' ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <XCircle className="h-4 w-4 mr-1" />
                )}
                Reject
              </Button>
              <Button size="sm" variant="ghost" onClick={clearSelection}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Assignee Dropdown - icon on small screens, full on larger */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8 sm:hidden shrink-0">
                <UserCircle className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-2" align="end">
              <Label className="text-sm text-muted-foreground mb-2 block">Assignee</Label>
              <Select value={selectedAssigneeId} onValueChange={setSelectedAssigneeId}>
                <SelectTrigger className="w-full h-8">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {caseworkers.map((cw) => (
                    <SelectItem key={cw.id} value={cw.id}>
                      {cw.full_name || 'Unknown'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </PopoverContent>
          </Popover>
          <div className="hidden sm:flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">Assignee:</Label>
            <Select value={selectedAssigneeId} onValueChange={setSelectedAssigneeId}>
              <SelectTrigger className="w-[140px] h-8">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {caseworkers.map((cw) => (
                  <SelectItem key={cw.id} value={cw.id}>
                    {cw.full_name || 'Unknown'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tags Picker - shared component with change states */}
          <TagPicker
            variant="menubar"
            selectedTagIds={selectedTagIds}
            onChange={setSelectedTagIds}
          />
        </div>
      </div>

      {/* Tabs - styled like DashboardPrototype */}
      <Tabs
        value={currentBucket}
        onValueChange={(v) => {
          onBucketChange(v);
          onMessageSelect(null);
        }}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <TabsList className="grid w-full grid-cols-3 shrink-0">
          {bucketTabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="gap-2">
              {tab.icon}
              {tab.label}
              <Badge variant="outline" className="ml-1">{counts[tab.id]}</Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="flex-1 flex overflow-hidden mt-4 gap-0">
          {/* Left sidebar - email list (1/3 width like DashboardPrototype) */}
          <div className="w-1/3 flex flex-col overflow-hidden border-y border-l bg-muted/30">
            <ScrollArea className="flex-1">
              <div className="divide-y">
                {messages.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    No emails in this category
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        'px-3 py-2 cursor-pointer transition-colors flex items-center gap-2',
                        confirmedIds.has(message.id)
                          ? 'bg-green-100'
                          : rejectedIds.has(message.id)
                          ? 'bg-red-50 opacity-50'
                          : selectedMessageId === message.id
                          ? 'bg-blue-100'
                          : 'hover:bg-muted'
                      )}
                      onClick={() => onMessageSelect(message.id)}
                    >
                      <Checkbox
                        checked={selectedIds.has(message.id)}
                        onCheckedChange={() => toggleSelection(message.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{message.senderEmail}</div>
                        <div className="text-xs text-muted-foreground truncate">{message.senderName}</div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleConfirmMessage(message.id);
                          }}
                          disabled={isActionInProgress}
                        >
                          <Check className="h-3.5 w-3.5 text-green-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRejectMessage(message.id);
                          }}
                          disabled={isActionInProgress}
                        >
                          <X className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Right pane - email detail (2/3 width like DashboardPrototype) */}
          <div className="w-2/3 flex flex-col overflow-hidden border bg-background relative">
            {detailMessage ? (
              <MessagePreviewWithToolbar
                message={detailMessage}
                onConfirm={() => handleConfirmMessage(detailMessage.id)}
                onReject={() => handleRejectMessage(detailMessage.id)}
                onOpenTriage={() => handleOpenTriage(detailMessage.id)}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Mail className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Select an email to view</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </Tabs>

      {/* Reject confirmation dialog */}
      <AlertDialog open={showRejectConfirm} onOpenChange={setShowRejectConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dismiss selected messages?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark {selectedIds.size} message{selectedIds.size !== 1 ? 's' : ''} as
              &quot;not from constituent&quot; and remove them from the triage queue.
              This action can be undone from the message history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionInProgress === 'reject'}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkReject}
              disabled={actionInProgress === 'reject'}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionInProgress === 'reject' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Dismissing...
                </>
              ) : (
                'Dismiss Messages'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Message preview with floating toolbar - styled like DashboardPrototype
function MessagePreviewWithToolbar({
  message,
  onConfirm,
  onReject,
  onOpenTriage,
}: {
  message: TriageMessage;
  onConfirm: () => void;
  onReject: () => void;
  onOpenTriage: () => void;
}) {
  // Get message body
  const { body: messageBody, isLoading: bodyLoading } = useMessageBody(message.id);

  // Local constituent selection state (defaults to AI-matched constituent)
  const [selectedConstituentId, setSelectedConstituentId] = useState<string | null>(
    message.senderConstituent?.id || null
  );

  // Reset selection when message changes
  useEffect(() => {
    setSelectedConstituentId(message.senderConstituent?.id || null);
  }, [message.id, message.senderConstituent?.id]);

  // Compute recognition status for the constituent selector
  const recognitionStatus: RecognitionStatus = selectedConstituentId
    ? message.triage_status === 'confirmed'
      ? 'confirmed'
      : 'ai_matched'
    : 'none';

  return (
    <>
      {/* Floating toolbar */}
      <div className="absolute top-0 left-0 right-0 bg-background/95 backdrop-blur border-b z-10 px-4 py-2">
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={onOpenTriage}
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Open in Triage
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="h-7 text-xs"
              onClick={onReject}
            >
              Not a campaign email
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={onConfirm}
            >
              Confirmed campaign email
            </Button>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 pt-12">
        <div className="p-4 space-y-4">
          <div>
            <h3 className="font-semibold text-lg">{message.subject || '(No subject)'}</h3>
            <div className="text-sm text-muted-foreground mt-1">
              From: {message.senderName} &lt;{message.senderEmail}&gt;
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {new Date(message.received_at).toLocaleString()}
            </div>
          </div>

          {/* Constituent selector with recognition status icon */}
          <div className="space-y-3 border-t pt-4">
            <ConstituentSelector
              selectedId={selectedConstituentId}
              onSelect={setSelectedConstituentId}
              recognitionStatus={recognitionStatus}
              label="Constituent"
            />
            {selectedConstituentId && (
              <ConstituentCard constituentId={selectedConstituentId} />
            )}
            {message.constituentStatus === 'has_address' && (
              <Badge variant="outline" className="bg-gray-100 border-dashed border-gray-400 text-gray-700 gap-1">
                <MapPin className="h-3 w-3" />
                Create constituent from detected address
              </Badge>
            )}
            {message.constituentStatus === 'no_address' && (
              <Badge variant="outline" className="bg-gray-100 border-dashed border-gray-400 text-gray-700 gap-1">
                <MapPinOff className="h-3 w-3" />
                Request address
              </Badge>
            )}
          </div>

          {message.constituentStatus === 'has_address' && message.addressFromEmail && (
            <div className="text-sm text-gray-600 bg-gray-100 px-3 py-2 rounded border border-gray-200">
              <MapPin className="inline h-4 w-4 mr-1" />
              Address found: {message.addressFromEmail}
            </div>
          )}

          <div className="border-t pt-4">
            {bodyLoading ? (
              <div className="space-y-2">
                <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
                <div className="h-4 bg-muted animate-pulse rounded w-1/2" />
                <div className="h-4 bg-muted animate-pulse rounded w-2/3" />
              </div>
            ) : (
              <p className="text-sm whitespace-pre-wrap leading-relaxed">
                {messageBody || message.snippet || 'No content available'}
              </p>
            )}
          </div>
        </div>
      </ScrollArea>
    </>
  );
}

export default CampaignDashboard;
