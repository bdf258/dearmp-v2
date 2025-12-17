/**
 * PROTOTYPE 2: Kanban Dashboard Style
 *
 * Concept: Visual card-based interface organized by status columns.
 * Columns: Inbox | Campaigns | Ready to Approve | Needs Review | Done
 *
 * Strengths: Visual, intuitive mental model, good for monitoring workflow
 * Weaknesses: Takes more screen space, may not scale to 100+ items efficiently
 */

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Mail,
  Inbox,
  Flag,
  CheckCircle,
  AlertCircle,
  CheckCircle2,
  User,
  Tag,
  Clock,
  ArrowRight,
  Eye,
  Edit2,
  Users,
  FileText,
  Sparkles,
  ExternalLink,
  X,
} from 'lucide-react';

// ============= TYPES =============

interface SuggestedTag {
  id: string;
  name: string;
  color: string;
  confidence: number;
}

interface TriageEmail {
  id: string;
  subject: string;
  snippet: string;
  fromEmail: string;
  fromName: string;
  receivedAt: string;
  emailType: 'policy' | 'casework' | 'campaign' | 'spam';
  classificationConfidence: number;
  classificationReasoning: string;
  campaignName?: string;
  suggestedTags: SuggestedTag[];
  suggestedAssignee: string;
  assigneeReason: string;
  constituentStatus: 'matched' | 'fuzzy' | 'new';
  constituentName?: string;
  existingCaseRef?: string;
  status: 'inbox' | 'campaign' | 'ready' | 'review' | 'done';
}

// ============= MOCK DATA =============

const initialEmails: TriageEmail[] = [
  // Inbox (unprocessed)
  {
    id: 'i1',
    subject: 'Question about bin collection',
    snippet: 'My bins weren\'t collected last week and I\'m wondering if there was a schedule change...',
    fromEmail: 'peter.williams@gmail.com',
    fromName: 'Peter Williams',
    receivedAt: '2024-01-15T08:00:00Z',
    emailType: 'casework',
    classificationConfidence: 0.82,
    classificationReasoning: 'Council services query, likely needs intervention',
    suggestedTags: [
      { id: 't1', name: 'Council', color: '#3b82f6', confidence: 0.92 },
      { id: 't2', name: 'Waste', color: '#84cc16', confidence: 0.88 },
    ],
    suggestedAssignee: 'Mike Chen',
    assigneeReason: 'Handles council liaison',
    constituentStatus: 'matched',
    constituentName: 'Peter Williams',
    status: 'inbox',
  },
  {
    id: 'i2',
    subject: 'Pothole on Main Street',
    snippet: 'There is a dangerous pothole that has been there for 3 months. I\'ve reported it...',
    fromEmail: 'sarah.miller@outlook.com',
    fromName: 'Sarah Miller',
    receivedAt: '2024-01-15T08:30:00Z',
    emailType: 'casework',
    classificationConfidence: 0.91,
    classificationReasoning: 'Clear highways casework issue',
    suggestedTags: [
      { id: 't3', name: 'Highways', color: '#f59e0b', confidence: 0.95 },
      { id: 't1', name: 'Council', color: '#3b82f6', confidence: 0.78 },
    ],
    suggestedAssignee: 'Mike Chen',
    assigneeReason: 'Council casework specialist',
    constituentStatus: 'new',
    status: 'inbox',
  },

  // Campaigns
  {
    id: 'c1',
    subject: 'Save Our Library',
    snippet: 'I am deeply concerned about the proposed closure of our local library...',
    fromEmail: 'john.smith@gmail.com',
    fromName: 'John Smith',
    receivedAt: '2024-01-15T09:00:00Z',
    emailType: 'campaign',
    classificationConfidence: 0.97,
    classificationReasoning: 'Matches "Save Our Library" campaign fingerprint',
    campaignName: 'Save Our Library',
    suggestedTags: [
      { id: 't4', name: 'Libraries', color: '#8b5cf6', confidence: 0.96 },
    ],
    suggestedAssignee: 'Sarah Jones',
    assigneeReason: 'Default policy handler',
    constituentStatus: 'matched',
    constituentName: 'John Smith',
    status: 'campaign',
  },
  {
    id: 'c2',
    subject: 'Save Our Library',
    snippet: 'Please do not close our library. It is vital for our community...',
    fromEmail: 'mary.jones@yahoo.com',
    fromName: 'Mary Jones',
    receivedAt: '2024-01-15T09:15:00Z',
    emailType: 'campaign',
    classificationConfidence: 0.95,
    classificationReasoning: 'Matches "Save Our Library" campaign fingerprint',
    campaignName: 'Save Our Library',
    suggestedTags: [
      { id: 't4', name: 'Libraries', color: '#8b5cf6', confidence: 0.96 },
    ],
    suggestedAssignee: 'Sarah Jones',
    assigneeReason: 'Default policy handler',
    constituentStatus: 'fuzzy',
    constituentName: 'M. Jones',
    status: 'campaign',
  },
  {
    id: 'c3',
    subject: 'Save Our Library',
    snippet: 'As a parent, the library is essential for my children\'s education...',
    fromEmail: 'emma.wilson@btinternet.com',
    fromName: 'Emma Wilson',
    receivedAt: '2024-01-15T09:30:00Z',
    emailType: 'campaign',
    classificationConfidence: 0.94,
    classificationReasoning: 'Matches "Save Our Library" campaign fingerprint',
    campaignName: 'Save Our Library',
    suggestedTags: [
      { id: 't4', name: 'Libraries', color: '#8b5cf6', confidence: 0.96 },
    ],
    suggestedAssignee: 'Sarah Jones',
    assigneeReason: 'Default policy handler',
    constituentStatus: 'new',
    status: 'campaign',
  },
  {
    id: 'c4',
    subject: 'Stop Green Belt Development',
    snippet: 'I urge you to oppose the housing development on our green belt land...',
    fromEmail: 'robert.brown@gmail.com',
    fromName: 'Robert Brown',
    receivedAt: '2024-01-15T10:00:00Z',
    emailType: 'campaign',
    classificationConfidence: 0.93,
    classificationReasoning: 'Matches "Protect Green Belt" campaign',
    campaignName: 'Protect Green Belt',
    suggestedTags: [
      { id: 't5', name: 'Planning', color: '#10b981', confidence: 0.94 },
      { id: 't6', name: 'Environment', color: '#22c55e', confidence: 0.88 },
    ],
    suggestedAssignee: 'Sarah Jones',
    assigneeReason: 'Default policy handler',
    constituentStatus: 'matched',
    constituentName: 'Robert Brown',
    status: 'campaign',
  },

  // Ready to Approve (high confidence)
  {
    id: 'r1',
    subject: 'Thank you for your support',
    snippet: 'I wanted to write to thank you for your recent support on the NHS bill...',
    fromEmail: 'patricia.green@gmail.com',
    fromName: 'Patricia Green',
    receivedAt: '2024-01-15T10:30:00Z',
    emailType: 'policy',
    classificationConfidence: 0.89,
    classificationReasoning: 'Positive correspondence, no action required',
    suggestedTags: [
      { id: 't7', name: 'NHS', color: '#0ea5e9', confidence: 0.92 },
      { id: 't8', name: 'Positive', color: '#22c55e', confidence: 0.95 },
    ],
    suggestedAssignee: 'Sarah Jones',
    assigneeReason: 'Policy acknowledgments',
    constituentStatus: 'matched',
    constituentName: 'Patricia Green',
    status: 'ready',
  },
  {
    id: 'r2',
    subject: 'Climate change policy question',
    snippet: 'Could you tell me what the government\'s current position is on net zero targets...',
    fromEmail: 'james.white@outlook.com',
    fromName: 'James White',
    receivedAt: '2024-01-15T11:00:00Z',
    emailType: 'policy',
    classificationConfidence: 0.87,
    classificationReasoning: 'Policy information request, no casework elements',
    suggestedTags: [
      { id: 't9', name: 'Environment', color: '#22c55e', confidence: 0.93 },
      { id: 't10', name: 'Climate', color: '#06b6d4', confidence: 0.91 },
    ],
    suggestedAssignee: 'Sarah Jones',
    assigneeReason: 'Default policy handler',
    constituentStatus: 'new',
    status: 'ready',
  },

  // Needs Review (medium/low confidence)
  {
    id: 'n1',
    subject: 'Housing benefit problem',
    snippet: 'I have been waiting 3 months for my housing benefit claim and the council won\'t help...',
    fromEmail: 'michael.harris@gmail.com',
    fromName: 'Michael Harris',
    receivedAt: '2024-01-15T11:30:00Z',
    emailType: 'casework',
    classificationConfidence: 0.68,
    classificationReasoning: 'Likely casework but may relate to existing case',
    suggestedTags: [
      { id: 't11', name: 'Benefits', color: '#f97316', confidence: 0.88 },
      { id: 't12', name: 'Housing', color: '#a855f7', confidence: 0.82 },
    ],
    suggestedAssignee: 'Mike Chen',
    assigneeReason: 'Benefits specialist',
    constituentStatus: 'fuzzy',
    constituentName: 'M. Harris',
    existingCaseRef: 'CW-2024-0042',
    status: 'review',
  },
  {
    id: 'n2',
    subject: 'Re: Fwd: Council response',
    snippet: '---------- Forwarded message ---------- Dear constituent, We have received your...',
    fromEmail: 'helen.jackson@btinternet.com',
    fromName: 'Helen Jackson',
    receivedAt: '2024-01-15T12:00:00Z',
    emailType: 'casework',
    classificationConfidence: 0.45,
    classificationReasoning: 'Forwarded thread, context unclear',
    suggestedTags: [],
    suggestedAssignee: 'Mike Chen',
    assigneeReason: 'Needs investigation',
    constituentStatus: 'fuzzy',
    constituentName: 'H. Jackson',
    existingCaseRef: 'CW-2023-0891',
    status: 'review',
  },
  {
    id: 'n3',
    subject: 'Multiple issues in my area',
    snippet: 'I want to raise several things: the library, potholes, and also ask about benefits...',
    fromEmail: 'george.thompson@gmail.com',
    fromName: 'George Thompson',
    receivedAt: '2024-01-15T12:30:00Z',
    emailType: 'casework',
    classificationConfidence: 0.42,
    classificationReasoning: 'Multiple topics - may need splitting into separate cases',
    suggestedTags: [
      { id: 't4', name: 'Libraries', color: '#8b5cf6', confidence: 0.55 },
      { id: 't3', name: 'Highways', color: '#f59e0b', confidence: 0.52 },
    ],
    suggestedAssignee: 'Mike Chen',
    assigneeReason: 'Complex casework',
    constituentStatus: 'new',
    status: 'review',
  },
];

// ============= HELPER COMPONENTS =============

function DesignTooltip({ children, comment }: { children: React.ReactNode; comment: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {children}
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs bg-slate-900 text-slate-100 border-slate-700">
        <p className="text-xs"><strong>Design Note:</strong> {comment}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function ConfidenceIndicator({ confidence }: { confidence: number }) {
  if (confidence >= 0.85) {
    return <div className="w-2 h-2 rounded-full bg-green-500" title={`${Math.round(confidence * 100)}% confidence`} />;
  } else if (confidence >= 0.6) {
    return <div className="w-2 h-2 rounded-full bg-yellow-500" title={`${Math.round(confidence * 100)}% confidence`} />;
  }
  return <div className="w-2 h-2 rounded-full bg-red-500" title={`${Math.round(confidence * 100)}% confidence`} />;
}

function EmailCard({
  email,
  onMove,
  onViewDetails,
  compact = false,
}: {
  email: TriageEmail;
  onMove: (id: string, status: TriageEmail['status']) => void;
  onViewDetails: (email: TriageEmail) => void;
  compact?: boolean;
}) {
  return (
    <DesignTooltip comment={`Email card showing key info at a glance. Confidence dot indicates AI certainty. ${compact ? 'Compact mode for campaign grouping.' : 'Full card shows all relevant details.'}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onViewDetails(email)}>
        <CardContent className={compact ? 'p-3' : 'p-4'}>
          <div className="space-y-2">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <ConfidenceIndicator confidence={email.classificationConfidence} />
                <span className={`font-medium truncate ${compact ? 'text-sm' : ''}`}>
                  {email.fromName}
                </span>
              </div>
              <Badge variant="outline" className="text-xs shrink-0 capitalize">
                {email.emailType}
              </Badge>
            </div>

            {/* Subject */}
            {!compact && (
              <div className="font-medium text-sm truncate">{email.subject}</div>
            )}

            {/* Snippet */}
            <div className={`text-muted-foreground truncate ${compact ? 'text-xs' : 'text-sm'}`}>
              {email.snippet}
            </div>

            {/* Tags */}
            {!compact && email.suggestedTags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {email.suggestedTags.slice(0, 3).map(tag => (
                  <Badge
                    key={tag.id}
                    variant="outline"
                    className="text-xs"
                    style={{ borderColor: tag.color, backgroundColor: `${tag.color}15`, color: tag.color }}
                  >
                    {tag.name}
                  </Badge>
                ))}
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
              <div className="flex items-center gap-1">
                {email.constituentStatus === 'matched' && (
                  <Badge variant="secondary" className="text-xs">
                    <User className="mr-1 h-3 w-3" />
                    {email.constituentName}
                  </Badge>
                )}
                {email.constituentStatus === 'fuzzy' && (
                  <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700">
                    <AlertCircle className="mr-1 h-3 w-3" />
                    Check: {email.constituentName}
                  </Badge>
                )}
                {email.constituentStatus === 'new' && (
                  <Badge variant="outline" className="text-xs">
                    <User className="mr-1 h-3 w-3" />
                    New
                  </Badge>
                )}
              </div>
              <span>{new Date(email.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>

            {/* Quick Actions */}
            {!compact && (
              <div className="flex gap-1 pt-2 border-t">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 h-7 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewDetails(email);
                  }}
                >
                  <Eye className="mr-1 h-3 w-3" />
                  View
                </Button>
                {email.status !== 'done' && (
                  <Button
                    size="sm"
                    className="flex-1 h-7 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMove(email.id, 'done');
                    }}
                  >
                    <CheckCircle className="mr-1 h-3 w-3" />
                    Approve
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </DesignTooltip>
  );
}

interface KanbanColumnProps {
  title: string;
  icon: React.ReactNode;
  count: number;
  color: string;
  children: React.ReactNode;
  onBulkAction?: () => void;
  bulkActionLabel?: string;
  tooltip: string;
}

function KanbanColumn({ title, icon, count, color, children, onBulkAction, bulkActionLabel, tooltip }: KanbanColumnProps) {
  return (
    <DesignTooltip comment={tooltip}>
      <div className="flex flex-col h-full min-w-[280px] max-w-[320px]">
        <div className={`flex items-center justify-between p-3 rounded-t-lg ${color}`}>
          <div className="flex items-center gap-2">
            {icon}
            <span className="font-semibold">{title}</span>
            <Badge variant="secondary" className="ml-1">{count}</Badge>
          </div>
          {onBulkAction && count > 0 && (
            <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={onBulkAction}>
              {bulkActionLabel}
            </Button>
          )}
        </div>
        <ScrollArea className="flex-1 bg-muted/30 rounded-b-lg border border-t-0">
          <div className="p-2 space-y-2">
            {children}
          </div>
        </ScrollArea>
      </div>
    </DesignTooltip>
  );
}

// ============= MAIN COMPONENT =============

export default function TriagePrototype2() {
  const [emails, setEmails] = useState<TriageEmail[]>(initialEmails);
  const [selectedEmail, setSelectedEmail] = useState<TriageEmail | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const moveEmail = (id: string, status: TriageEmail['status']) => {
    setEmails(prev => prev.map(e => e.id === id ? { ...e, status } : e));
  };

  const viewDetails = (email: TriageEmail) => {
    setSelectedEmail(email);
    setDetailsOpen(true);
  };

  const approveAll = (status: TriageEmail['status']) => {
    setEmails(prev => prev.map(e => e.status === status ? { ...e, status: 'done' } : e));
  };

  // Group emails by status
  const inboxEmails = emails.filter(e => e.status === 'inbox');
  const campaignEmails = emails.filter(e => e.status === 'campaign');
  const readyEmails = emails.filter(e => e.status === 'ready');
  const reviewEmails = emails.filter(e => e.status === 'review');
  const doneEmails = emails.filter(e => e.status === 'done');

  // Group campaign emails by campaign name
  const campaignGroups = campaignEmails.reduce((acc, email) => {
    const campaign = email.campaignName || 'Unknown';
    if (!acc[campaign]) acc[campaign] = [];
    acc[campaign].push(email);
    return acc;
  }, {} as Record<string, TriageEmail[]>);

  const totalEmails = emails.length;
  const processedCount = doneEmails.length;

  return (
    <TooltipProvider>
      <div className="h-[calc(100vh-8rem)] flex flex-col">
        {/* Header */}
        <DesignTooltip comment="Dashboard header shows overall stats. The kanban view gives immediate visual feedback on workload distribution.">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Email Triage Dashboard</h1>
              <p className="text-muted-foreground">
                Drag and drop or click to process emails
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-2xl font-bold text-green-600">{processedCount}/{totalEmails}</div>
                <div className="text-sm text-muted-foreground">completed</div>
              </div>
              <DesignTooltip comment="Quick stats showing breakdown by type. Helps manager prioritize.">
                <div className="flex gap-2">
                  <Badge variant="outline" className="py-1">
                    <Flag className="mr-1 h-3 w-3 text-blue-500" />
                    {campaignEmails.length} campaigns
                  </Badge>
                  <Badge variant="outline" className="py-1">
                    <FileText className="mr-1 h-3 w-3 text-purple-500" />
                    {inboxEmails.length + reviewEmails.length} casework
                  </Badge>
                </div>
              </DesignTooltip>
            </div>
          </div>
        </DesignTooltip>

        {/* Kanban Board */}
        <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
          {/* Inbox Column */}
          <KanbanColumn
            title="Inbox"
            icon={<Inbox className="h-4 w-4" />}
            count={inboxEmails.length}
            color="bg-slate-100"
            tooltip="Inbox column shows newly arrived emails that AI has processed but not yet categorized into campaigns or ready queues. These need initial review."
          >
            {inboxEmails.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
                No new emails
              </div>
            ) : (
              inboxEmails.map(email => (
                <EmailCard
                  key={email.id}
                  email={email}
                  onMove={moveEmail}
                  onViewDetails={viewDetails}
                />
              ))
            )}
          </KanbanColumn>

          {/* Campaigns Column */}
          <KanbanColumn
            title="Campaigns"
            icon={<Flag className="h-4 w-4" />}
            count={campaignEmails.length}
            color="bg-blue-100"
            onBulkAction={() => approveAll('campaign')}
            bulkActionLabel="Approve All"
            tooltip="Campaigns column groups emails by detected campaign. One-click 'Approve All' handles all campaign emails at once. Grouped view shows campaign name and count."
          >
            {Object.keys(campaignGroups).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                No campaign emails
              </div>
            ) : (
              Object.entries(campaignGroups).map(([campaignName, groupEmails]) => (
                <DesignTooltip key={campaignName} comment="Campaign group card - shows campaign name, email count, and can be expanded to see individual emails.">
                  <Card className="border-blue-200 bg-blue-50/50">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Flag className="h-4 w-4 text-blue-600" />
                          <span className="font-medium text-sm">{campaignName}</span>
                        </div>
                        <Badge className="bg-blue-600">{groupEmails.length}</Badge>
                      </div>
                      <div className="space-y-1">
                        {groupEmails.slice(0, 3).map(email => (
                          <div
                            key={email.id}
                            className="flex items-center gap-2 p-2 rounded bg-white text-xs cursor-pointer hover:bg-blue-50"
                            onClick={() => viewDetails(email)}
                          >
                            <ConfidenceIndicator confidence={email.classificationConfidence} />
                            <span className="truncate flex-1">{email.fromName}</span>
                            {email.constituentStatus === 'matched' && (
                              <CheckCircle className="h-3 w-3 text-green-500" />
                            )}
                          </div>
                        ))}
                        {groupEmails.length > 3 && (
                          <div className="text-xs text-center text-muted-foreground pt-1">
                            +{groupEmails.length - 3} more
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        className="w-full mt-2 h-7 text-xs"
                        onClick={() => groupEmails.forEach(e => moveEmail(e.id, 'done'))}
                      >
                        <CheckCircle className="mr-1 h-3 w-3" />
                        Approve {groupEmails.length} emails
                      </Button>
                    </CardContent>
                  </Card>
                </DesignTooltip>
              ))
            )}
          </KanbanColumn>

          {/* Ready to Approve Column */}
          <KanbanColumn
            title="Ready to Approve"
            icon={<CheckCircle className="h-4 w-4" />}
            count={readyEmails.length}
            color="bg-green-100"
            onBulkAction={() => approveAll('ready')}
            bulkActionLabel="Approve All"
            tooltip="Ready column shows high-confidence items that AI is confident about. Quick one-click approval for these. Manager can spot-check but usually just approves."
          >
            {readyEmails.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                Nothing ready yet
              </div>
            ) : (
              readyEmails.map(email => (
                <EmailCard
                  key={email.id}
                  email={email}
                  onMove={moveEmail}
                  onViewDetails={viewDetails}
                />
              ))
            )}
          </KanbanColumn>

          {/* Needs Review Column */}
          <KanbanColumn
            title="Needs Review"
            icon={<AlertCircle className="h-4 w-4" />}
            count={reviewEmails.length}
            color="bg-yellow-100"
            tooltip="Review column shows items requiring human judgment. Lower confidence scores, unclear classification, or potential case matches. These need individual attention."
          >
            {reviewEmails.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                Nothing needs review
              </div>
            ) : (
              reviewEmails.map(email => (
                <DesignTooltip key={email.id} comment="Review cards show extra warning indicators - existing case match, fuzzy constituent, low confidence. Yellow border draws attention.">
                  <Card className="border-yellow-300 hover:shadow-md transition-shadow cursor-pointer" onClick={() => viewDetails(email)}>
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <ConfidenceIndicator confidence={email.classificationConfidence} />
                            <span className="font-medium text-sm">{email.fromName}</span>
                          </div>
                          <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700">
                            {Math.round(email.classificationConfidence * 100)}%
                          </Badge>
                        </div>

                        <div className="font-medium text-sm truncate">{email.subject}</div>

                        {/* Warning Indicators */}
                        <div className="space-y-1">
                          {email.existingCaseRef && (
                            <div className="flex items-center gap-1 text-xs text-yellow-700 bg-yellow-50 rounded px-2 py-1">
                              <FileText className="h-3 w-3" />
                              May relate to: {email.existingCaseRef}
                            </div>
                          )}
                          {email.constituentStatus === 'fuzzy' && (
                            <div className="flex items-center gap-1 text-xs text-yellow-700 bg-yellow-50 rounded px-2 py-1">
                              <User className="h-3 w-3" />
                              Check constituent: {email.constituentName}
                            </div>
                          )}
                        </div>

                        <div className="text-xs text-muted-foreground truncate">
                          {email.classificationReasoning}
                        </div>

                        <div className="flex gap-1 pt-2 border-t">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 h-7 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              viewDetails(email);
                            }}
                          >
                            <Edit2 className="mr-1 h-3 w-3" />
                            Review
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1 h-7 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              moveEmail(email.id, 'done');
                            }}
                          >
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Approve
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </DesignTooltip>
              ))
            )}
          </KanbanColumn>

          {/* Done Column */}
          <KanbanColumn
            title="Done"
            icon={<CheckCircle2 className="h-4 w-4" />}
            count={doneEmails.length}
            color="bg-emerald-100"
            tooltip="Done column shows completed items. Provides visual feedback and allows undo if needed. Could auto-collapse or hide after session ends."
          >
            {doneEmails.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                Processed emails appear here
              </div>
            ) : (
              doneEmails.map(email => (
                <Card key={email.id} className="bg-emerald-50/50 border-emerald-200">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{email.fromName}</div>
                        <div className="text-xs text-muted-foreground truncate">{email.subject}</div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={() => moveEmail(email.id, 'inbox')}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </KanbanColumn>
        </div>

        {/* Detail Dialog */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-2xl">
            {selectedEmail && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <ConfidenceIndicator confidence={selectedEmail.classificationConfidence} />
                    {selectedEmail.subject}
                  </DialogTitle>
                  <DialogDescription>
                    From: {selectedEmail.fromName} ({selectedEmail.fromEmail})
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  {/* Classification Info */}
                  <DesignTooltip comment="AI analysis section explains why email was classified this way. Builds trust and helps spot errors.">
                    <div className="rounded-lg bg-muted/50 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="h-4 w-4 text-purple-500" />
                        <span className="font-medium text-sm">AI Analysis</span>
                        <Badge variant="outline" className="ml-auto">
                          {Math.round(selectedEmail.classificationConfidence * 100)}% confident
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{selectedEmail.classificationReasoning}</p>
                    </div>
                  </DesignTooltip>

                  {/* Email Content */}
                  <div className="rounded-lg border p-4">
                    <p className="text-sm">{selectedEmail.snippet}</p>
                  </div>

                  {/* Edit Options */}
                  <div className="grid grid-cols-2 gap-4">
                    <DesignTooltip comment="Editable fields allow overriding AI suggestions. Changes are applied on approval.">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Email Type</label>
                        <Select defaultValue={selectedEmail.emailType}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="casework">Casework</SelectItem>
                            <SelectItem value="policy">Policy</SelectItem>
                            <SelectItem value="campaign">Campaign</SelectItem>
                            <SelectItem value="spam">Spam</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </DesignTooltip>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Assign To</label>
                      <Select defaultValue={selectedEmail.suggestedAssignee}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Sarah Jones">Sarah Jones (Policy)</SelectItem>
                          <SelectItem value="Mike Chen">Mike Chen (Casework)</SelectItem>
                          <SelectItem value="Lisa Park">Lisa Park (Immigration)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Constituent</label>
                      {selectedEmail.constituentStatus === 'matched' ? (
                        <div className="flex items-center gap-2 p-2 rounded border bg-green-50">
                          <User className="h-4 w-4 text-green-600" />
                          <span className="text-sm">{selectedEmail.constituentName}</span>
                          <ExternalLink className="h-3 w-3 ml-auto" />
                        </div>
                      ) : (
                        <Select>
                          <SelectTrigger>
                            <SelectValue placeholder="Select or create..." />
                          </SelectTrigger>
                          <SelectContent>
                            {selectedEmail.constituentName && (
                              <SelectItem value="existing">{selectedEmail.constituentName} (possible match)</SelectItem>
                            )}
                            <SelectItem value="new">+ Create new constituent</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    {selectedEmail.existingCaseRef && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Link to Case</label>
                        <Select defaultValue={selectedEmail.existingCaseRef}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={selectedEmail.existingCaseRef}>
                              {selectedEmail.existingCaseRef} (suggested)
                            </SelectItem>
                            <SelectItem value="new">+ Create new case</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  {/* Tags */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tags</label>
                    <div className="flex flex-wrap gap-2">
                      {selectedEmail.suggestedTags.map(tag => (
                        <Badge
                          key={tag.id}
                          variant="outline"
                          className="cursor-pointer"
                          style={{ borderColor: tag.color, backgroundColor: `${tag.color}15`, color: tag.color }}
                        >
                          {tag.name}
                          <X className="ml-1 h-3 w-3" />
                        </Badge>
                      ))}
                      <Button variant="outline" size="sm">
                        <Tag className="mr-1 h-3 w-3" />
                        Add Tag
                      </Button>
                    </div>
                  </div>
                </div>

                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => setDetailsOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      moveEmail(selectedEmail.id, 'review');
                      setDetailsOpen(false);
                    }}
                  >
                    <ArrowRight className="mr-2 h-4 w-4" />
                    Move to Review
                  </Button>
                  <Button
                    onClick={() => {
                      moveEmail(selectedEmail.id, 'done');
                      setDetailsOpen(false);
                    }}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Approve & Process
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
