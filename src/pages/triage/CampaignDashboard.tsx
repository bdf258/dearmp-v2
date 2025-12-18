/**
 * Campaign Dashboard
 *
 * Campaign list with per-campaign inbox showing:
 * - Buckets: known constituents, has address, no address
 * - Bulk selection with confirm/reject actions
 * - Navigate to single-email triage for detailed review
 */

import { useState, useMemo, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useSupabase } from '@/lib/SupabaseContext';
import {
  useCampaignsWithTriageCounts,
  useTriageQueue,
  useTriageActions,
  type ConstituentStatus,
  type TriageMessage,
} from '@/hooks/triage/useTriage';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  CompactMessageCard,
  MessageDetailHeader,
  TriageSkeletons,
  ConstituentSelector,
  CaseSelector,
  CaseworkerSelector,
  TagPicker,
  PrioritySelector,
  CreateConstituentDialog,
  CreateCaseDialog,
} from '@/components/triage';
import {
  Mail,
  CheckCircle2,
  HelpCircle,
  AlertCircle,
  ChevronRight,
  CheckCheck,
  X,
  Loader2,
  ArrowLeft,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { CasePriority } from '@/lib/database.types';

// Bucket tab configuration
const bucketTabs: { id: ConstituentStatus; label: string; icon: React.ReactNode }[] = [
  { id: 'known', label: 'Known', icon: <CheckCircle2 className="h-4 w-4" /> },
  { id: 'has_address', label: 'Has Address', icon: <HelpCircle className="h-4 w-4" /> },
  { id: 'no_address', label: 'No Address', icon: <AlertCircle className="h-4 w-4" /> },
];

export function CampaignDashboard() {
  const navigate = useNavigate();
  const { campaignId } = useParams<{ campaignId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  // Get bucket from URL or default to 'known'
  const currentBucket = (searchParams.get('bucket') || 'known') as ConstituentStatus;

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

  // Handle bucket change
  const handleBucketChange = useCallback((bucket: string) => {
    setSearchParams({ bucket });
  }, [setSearchParams]);

  if (loading) {
    return (
      <div className="flex h-full">
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
        <div className="flex gap-3 text-xs">
          <span className="flex items-center gap-1 text-green-600">
            <CheckCircle2 className="h-3 w-3" />
            {campaign.knownCount}
          </span>
          <span className="flex items-center gap-1 text-yellow-600">
            <HelpCircle className="h-3 w-3" />
            {campaign.hasAddressCount}
          </span>
          <span className="flex items-center gap-1 text-red-600">
            <AlertCircle className="h-3 w-3" />
            {campaign.noAddressCount}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// Campaign inbox with buckets
function CampaignInbox({
  campaign,
  currentBucket,
  onBucketChange,
}: {
  campaign: ReturnType<typeof useCampaignsWithTriageCounts>['campaigns'][0];
  currentBucket: ConstituentStatus;
  onBucketChange: (bucket: string) => void;
}) {
  const navigate = useNavigate();
  const { messages } = useTriageQueue({ campaignId: campaign.id, constituentStatus: currentBucket });
  const { approveTriage, isProcessing } = useTriageActions();

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailMessageId, setDetailMessageId] = useState<string | null>(null);

  // Get counts for tabs
  const { allMessages } = useTriageQueue({ campaignId: campaign.id });
  const counts = useMemo(() => ({
    known: allMessages.filter(m => m.constituentStatus === 'known').length,
    has_address: allMessages.filter(m => m.constituentStatus === 'has_address').length,
    no_address: allMessages.filter(m => m.constituentStatus === 'no_address').length,
  }), [allMessages]);

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

  // Select all
  const selectAll = useCallback(() => {
    setSelectedIds(new Set(messages.map(m => m.id)));
  }, [messages]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Bulk approve (for known constituents)
  const handleBulkApprove = useCallback(async () => {
    if (selectedIds.size === 0) return;

    const selectedMessages = messages.filter(m => selectedIds.has(m.id));
    let successCount = 0;

    for (const message of selectedMessages) {
      // For known constituents, auto-approve with suggested case
      if (message.senderConstituent) {
        const result = await approveTriage(message.id, {
          constituentId: message.senderConstituent.id,
          // Could add more logic here for suggested case
        });
        if (result.success) successCount++;
      }
    }

    toast.success(`Approved ${successCount} messages`);
    clearSelection();
  }, [selectedIds, messages, approveTriage, clearSelection]);

  // Navigate to single triage
  const handleOpenTriage = useCallback((messageId: string) => {
    navigate(`/triage/messages/${messageId}`);
  }, [navigate]);

  // Detail message
  const detailMessage = detailMessageId
    ? messages.find(m => m.id === detailMessageId)
    : null;

  return (
    <>
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{campaign.name}</h2>
            <p className="text-sm text-muted-foreground">
              {campaign.totalCount} messages to triage
            </p>
          </div>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {selectedIds.size} selected
              </span>
              {currentBucket === 'known' && (
                <Button size="sm" onClick={handleBulkApprove} disabled={isProcessing}>
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <CheckCheck className="h-4 w-4 mr-1" />
                  )}
                  Approve All
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={clearSelection}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Bucket tabs */}
      <Tabs value={currentBucket} onValueChange={onBucketChange} className="flex-1 flex flex-col">
        <div className="border-b px-4">
          <TabsList className="bg-transparent h-12 p-0 gap-4">
            {bucketTabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 px-1"
              >
                <span className="flex items-center gap-2">
                  {tab.icon}
                  {tab.label}
                  <Badge variant="secondary" className="ml-1">
                    {counts[tab.id]}
                  </Badge>
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="flex-1 flex min-h-0">
          {/* Message list */}
          <div className="w-96 border-r flex flex-col">
            {/* Select all bar */}
            <div className="px-3 py-2 border-b flex items-center gap-2">
              <Checkbox
                checked={selectedIds.size === messages.length && messages.length > 0}
                onCheckedChange={(checked) => {
                  if (checked) selectAll();
                  else clearSelection();
                }}
              />
              <span className="text-sm text-muted-foreground">
                {messages.length} messages
              </span>
            </div>

            <ScrollArea className="flex-1">
              {messages.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm text-muted-foreground">No messages in this bucket</p>
                </div>
              ) : (
                messages.map((message) => (
                  <CompactMessageCard
                    key={message.id}
                    message={message}
                    isSelected={selectedIds.has(message.id)}
                    onSelect={() => toggleSelection(message.id)}
                    onClick={() => setDetailMessageId(message.id)}
                    isActive={message.id === detailMessageId}
                  />
                ))
              )}
            </ScrollArea>
          </div>

          {/* Detail/preview pane */}
          <div className="flex-1 min-w-0">
            {detailMessage ? (
              <MessagePreview
                message={detailMessage}
                onOpenTriage={() => handleOpenTriage(detailMessage.id)}
              />
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <Mail className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Select a message to preview
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </Tabs>
    </>
  );
}

// Message preview in campaign dashboard
function MessagePreview({
  message,
  onOpenTriage,
}: {
  message: TriageMessage;
  onOpenTriage: () => void;
}) {
  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <MessageDetailHeader message={message} />
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4">
          <div className="prose prose-sm max-w-none">
            <pre className="whitespace-pre-wrap font-sans text-sm">
              {message.snippet || 'No preview available'}
            </pre>
          </div>
        </div>
      </ScrollArea>

      <div className="p-4 border-t">
        <Button onClick={onOpenTriage}>
          Open in Triage
          <ExternalLink className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

export default CampaignDashboard;
