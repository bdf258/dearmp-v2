/**
 * PROTOTYPE 1: Tiered Waterfall Triage
 *
 * Concept: Process emails in phases based on complexity.
 * Phase 1: Campaign Batch - All detected campaigns, one-click approve all
 * Phase 2: Quick Wins - High-confidence policy emails, rapid approval
 * Phase 3: Review Required - Medium confidence items, show alternatives
 * Phase 4: Manual Triage - Low confidence, needs human decision
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Users,
  Zap,
  Clock,
  AlertTriangle,
  User,
  Tag,
  Building2,
  ArrowRight,
  Check,
  X,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';

// ============= HARDCODED MOCK DATA =============

interface SuggestedTag {
  id: string;
  name: string;
  color: string;
  confidence: number;
}

interface ConstituentMatch {
  status: 'exact' | 'fuzzy' | 'multiple' | 'none';
  matched?: {
    id: string;
    name: string;
    address?: string;
    previousCases?: number;
  };
  alternatives?: Array<{
    id: string;
    name: string;
    matchReason: string;
  }>;
  extracted?: {
    name?: string;
    address?: string;
  };
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
  isCampaignEmail: boolean;
  detectedCampaignId?: string;
  detectedCampaignName?: string;
  suggestedTags: SuggestedTag[];
  suggestedAssignee: {
    userId: string;
    userName: string;
    reason: string;
  };
  alternativeAssignees: Array<{
    userId: string;
    userName: string;
    reason: string;
  }>;
  constituentMatch: ConstituentMatch;
  suggestedCase?: {
    caseId: string;
    reference: string;
    title: string;
    confidence: number;
  };
  alternativeCases?: Array<{
    caseId: string;
    reference: string;
    title: string;
    confidence: number;
  }>;
}

// Campaign emails (high volume, low complexity)
const campaignEmails: TriageEmail[] = [
  {
    id: 'c1',
    subject: 'Save Our Local Library - Sign the Petition!',
    snippet: 'Dear MP, I am writing to express my concern about the proposed library closures...',
    fromEmail: 'john.smith@gmail.com',
    fromName: 'John Smith',
    receivedAt: '2024-01-15T09:30:00Z',
    emailType: 'campaign',
    classificationConfidence: 0.98,
    classificationReasoning: 'Matches fingerprint of "Save Our Library" campaign (98% text similarity)',
    isCampaignEmail: true,
    detectedCampaignId: 'camp-1',
    detectedCampaignName: 'Save Our Library Campaign',
    suggestedTags: [
      { id: 't1', name: 'Libraries', color: '#3b82f6', confidence: 0.95 },
      { id: 't2', name: 'Local Services', color: '#8b5cf6', confidence: 0.85 },
    ],
    suggestedAssignee: { userId: 'u1', userName: 'Sarah Jones', reason: 'Default policy handler' },
    alternativeAssignees: [],
    constituentMatch: { status: 'exact', matched: { id: 'con-1', name: 'John Smith', address: '14 Oak Lane', previousCases: 0 } },
  },
  {
    id: 'c2',
    subject: 'Save Our Local Library - Sign the Petition!',
    snippet: 'As a concerned resident, I strongly oppose the closure of our community library...',
    fromEmail: 'mary.jones@outlook.com',
    fromName: 'Mary Jones',
    receivedAt: '2024-01-15T09:45:00Z',
    emailType: 'campaign',
    classificationConfidence: 0.97,
    classificationReasoning: 'Matches fingerprint of "Save Our Library" campaign (97% text similarity)',
    isCampaignEmail: true,
    detectedCampaignId: 'camp-1',
    detectedCampaignName: 'Save Our Library Campaign',
    suggestedTags: [
      { id: 't1', name: 'Libraries', color: '#3b82f6', confidence: 0.95 },
    ],
    suggestedAssignee: { userId: 'u1', userName: 'Sarah Jones', reason: 'Default policy handler' },
    alternativeAssignees: [],
    constituentMatch: { status: 'none', extracted: { name: 'Mary Jones' } },
  },
  // More campaign emails...
  {
    id: 'c3',
    subject: 'Save Our Local Library - Sign the Petition!',
    snippet: 'I have used the local library for over 30 years and closing it would devastate our community...',
    fromEmail: 'robert.brown@yahoo.com',
    fromName: 'Robert Brown',
    receivedAt: '2024-01-15T10:00:00Z',
    emailType: 'campaign',
    classificationConfidence: 0.96,
    classificationReasoning: 'Matches fingerprint of "Save Our Library" campaign',
    isCampaignEmail: true,
    detectedCampaignId: 'camp-1',
    detectedCampaignName: 'Save Our Library Campaign',
    suggestedTags: [
      { id: 't1', name: 'Libraries', color: '#3b82f6', confidence: 0.95 },
    ],
    suggestedAssignee: { userId: 'u1', userName: 'Sarah Jones', reason: 'Default policy handler' },
    alternativeAssignees: [],
    constituentMatch: { status: 'fuzzy', matched: { id: 'con-2', name: 'Bob Brown', address: '22 Elm Street' }, alternatives: [{ id: 'con-3', name: 'Robert Brown Jr', matchReason: 'Similar name' }] },
  },
  {
    id: 'c4',
    subject: 'Stop the Housing Development on Green Belt Land',
    snippet: 'I am writing to urge you to oppose the proposed housing development on protected green belt...',
    fromEmail: 'emma.wilson@gmail.com',
    fromName: 'Emma Wilson',
    receivedAt: '2024-01-15T10:15:00Z',
    emailType: 'campaign',
    classificationConfidence: 0.94,
    classificationReasoning: 'Matches fingerprint of "Protect Green Belt" campaign',
    isCampaignEmail: true,
    detectedCampaignId: 'camp-2',
    detectedCampaignName: 'Protect Green Belt Campaign',
    suggestedTags: [
      { id: 't3', name: 'Planning', color: '#10b981', confidence: 0.92 },
      { id: 't4', name: 'Environment', color: '#22c55e', confidence: 0.88 },
    ],
    suggestedAssignee: { userId: 'u1', userName: 'Sarah Jones', reason: 'Default policy handler' },
    alternativeAssignees: [],
    constituentMatch: { status: 'exact', matched: { id: 'con-4', name: 'Emma Wilson', address: '8 Park Road', previousCases: 1 } },
  },
  {
    id: 'c5',
    subject: 'Stop the Housing Development on Green Belt Land',
    snippet: 'Please protect our green spaces for future generations. The proposed development...',
    fromEmail: 'david.taylor@hotmail.com',
    fromName: 'David Taylor',
    receivedAt: '2024-01-15T10:30:00Z',
    emailType: 'campaign',
    classificationConfidence: 0.93,
    classificationReasoning: 'Matches fingerprint of "Protect Green Belt" campaign',
    isCampaignEmail: true,
    detectedCampaignId: 'camp-2',
    detectedCampaignName: 'Protect Green Belt Campaign',
    suggestedTags: [
      { id: 't3', name: 'Planning', color: '#10b981', confidence: 0.92 },
    ],
    suggestedAssignee: { userId: 'u1', userName: 'Sarah Jones', reason: 'Default policy handler' },
    alternativeAssignees: [],
    constituentMatch: { status: 'none', extracted: { name: 'David Taylor', address: 'Somewhere in constituency' } },
  },
];

// Quick wins - high confidence policy/casework
const quickWinEmails: TriageEmail[] = [
  {
    id: 'q1',
    subject: 'Query about state pension age',
    snippet: 'I am writing to ask about the current state pension age and whether there are any planned changes...',
    fromEmail: 'patricia.green@btinternet.com',
    fromName: 'Patricia Green',
    receivedAt: '2024-01-15T11:00:00Z',
    emailType: 'policy',
    classificationConfidence: 0.92,
    classificationReasoning: 'Clear policy query about pensions, no casework elements detected',
    isCampaignEmail: false,
    suggestedTags: [
      { id: 't5', name: 'Pensions', color: '#f59e0b', confidence: 0.94 },
      { id: 't6', name: 'DWP', color: '#6366f1', confidence: 0.78 },
    ],
    suggestedAssignee: { userId: 'u1', userName: 'Sarah Jones', reason: 'Default policy handler' },
    alternativeAssignees: [
      { userId: 'u2', userName: 'Mike Chen', reason: 'Handles DWP queries' },
    ],
    constituentMatch: { status: 'exact', matched: { id: 'con-5', name: 'Patricia Green', address: '45 High Street', previousCases: 0 } },
  },
  {
    id: 'q2',
    subject: 'NHS waiting times concern',
    snippet: 'I wanted to share my concerns about the increasing NHS waiting times in our area...',
    fromEmail: 'james.white@gmail.com',
    fromName: 'James White',
    receivedAt: '2024-01-15T11:30:00Z',
    emailType: 'policy',
    classificationConfidence: 0.89,
    classificationReasoning: 'General NHS policy concern, no specific case requiring intervention',
    isCampaignEmail: false,
    suggestedTags: [
      { id: 't7', name: 'NHS', color: '#0ea5e9', confidence: 0.96 },
      { id: 't8', name: 'Health', color: '#14b8a6', confidence: 0.82 },
    ],
    suggestedAssignee: { userId: 'u1', userName: 'Sarah Jones', reason: 'Default policy handler' },
    alternativeAssignees: [],
    constituentMatch: { status: 'none', extracted: { name: 'James White' } },
  },
  {
    id: 'q3',
    subject: 'Support for small businesses',
    snippet: 'As a local small business owner, I wanted to express my views on the recent business rates...',
    fromEmail: 'susan.clark@mybusiness.co.uk',
    fromName: 'Susan Clark',
    receivedAt: '2024-01-15T12:00:00Z',
    emailType: 'policy',
    classificationConfidence: 0.87,
    classificationReasoning: 'Policy views on business rates, not requesting specific intervention',
    isCampaignEmail: false,
    suggestedTags: [
      { id: 't9', name: 'Business', color: '#84cc16', confidence: 0.91 },
      { id: 't10', name: 'Economy', color: '#eab308', confidence: 0.75 },
    ],
    suggestedAssignee: { userId: 'u1', userName: 'Sarah Jones', reason: 'Default policy handler' },
    alternativeAssignees: [],
    constituentMatch: { status: 'exact', matched: { id: 'con-6', name: 'Susan Clark', address: 'Clark\'s Bakery, 12 Main St', previousCases: 2 } },
  },
];

// Review required - medium confidence
const reviewRequiredEmails: TriageEmail[] = [
  {
    id: 'r1',
    subject: 'Help needed with housing benefit',
    snippet: 'I am having problems with my housing benefit claim and the council is not responding to my calls...',
    fromEmail: 'michael.harris@gmail.com',
    fromName: 'Michael Harris',
    receivedAt: '2024-01-15T13:00:00Z',
    emailType: 'casework',
    classificationConfidence: 0.72,
    classificationReasoning: 'Likely casework (housing benefit issue) but could be general policy complaint',
    isCampaignEmail: false,
    suggestedTags: [
      { id: 't11', name: 'Benefits', color: '#f97316', confidence: 0.85 },
      { id: 't12', name: 'Housing', color: '#a855f7', confidence: 0.78 },
    ],
    suggestedAssignee: { userId: 'u2', userName: 'Mike Chen', reason: 'Handles benefits casework' },
    alternativeAssignees: [
      { userId: 'u3', userName: 'Lisa Park', reason: 'Housing specialist' },
    ],
    constituentMatch: {
      status: 'multiple',
      alternatives: [
        { id: 'con-7', name: 'Michael Harris', matchReason: 'Exact name match' },
        { id: 'con-8', name: 'Mike Harris', matchReason: 'Similar name, same postcode area' },
      ]
    },
    suggestedCase: {
      caseId: 'case-1',
      reference: 'CW-2024-0042',
      title: 'Housing Benefit Appeal - M. Harris',
      confidence: 0.68,
    },
    alternativeCases: [
      {
        caseId: 'case-2',
        reference: 'CW-2024-0089',
        title: 'Council Tax Query - Harris Family',
        confidence: 0.45,
      },
    ],
  },
  {
    id: 'r2',
    subject: 'Urgent: Visa application delay',
    snippet: 'My wife\'s visa application has been pending for 8 months and we are desperate for help...',
    fromEmail: 'ahmed.rahman@outlook.com',
    fromName: 'Ahmed Rahman',
    receivedAt: '2024-01-15T13:30:00Z',
    emailType: 'casework',
    classificationConfidence: 0.78,
    classificationReasoning: 'Clear casework request for intervention on visa delay',
    isCampaignEmail: false,
    suggestedTags: [
      { id: 't13', name: 'Immigration', color: '#ec4899', confidence: 0.95 },
      { id: 't14', name: 'Home Office', color: '#8b5cf6', confidence: 0.92 },
      { id: 't15', name: 'Urgent', color: '#ef4444', confidence: 0.88 },
    ],
    suggestedAssignee: { userId: 'u3', userName: 'Lisa Park', reason: 'Immigration specialist' },
    alternativeAssignees: [
      { userId: 'u2', userName: 'Mike Chen', reason: 'Casework backup' },
    ],
    constituentMatch: {
      status: 'exact',
      matched: { id: 'con-9', name: 'Ahmed Rahman', address: '67 Victoria Road', previousCases: 1 }
    },
  },
  {
    id: 'r3',
    subject: 'Road safety concerns on A123',
    snippet: 'There have been several accidents on this road and I believe speed limits need to be reviewed...',
    fromEmail: 'carol.davies@yahoo.com',
    fromName: 'Carol Davies',
    receivedAt: '2024-01-15T14:00:00Z',
    emailType: 'policy',
    classificationConfidence: 0.65,
    classificationReasoning: 'Could be policy (road safety views) or casework (requesting specific intervention)',
    isCampaignEmail: false,
    suggestedTags: [
      { id: 't16', name: 'Transport', color: '#06b6d4', confidence: 0.88 },
      { id: 't17', name: 'Road Safety', color: '#f43f5e', confidence: 0.92 },
    ],
    suggestedAssignee: { userId: 'u1', userName: 'Sarah Jones', reason: 'Default policy handler' },
    alternativeAssignees: [
      { userId: 'u2', userName: 'Mike Chen', reason: 'If requires council liaison' },
    ],
    constituentMatch: { status: 'fuzzy', matched: { id: 'con-10', name: 'C. Davies', address: 'Near A123' } },
  },
];

// Manual triage - low confidence or complex
const manualTriageEmails: TriageEmail[] = [
  {
    id: 'm1',
    subject: 'Various issues affecting our community',
    snippet: 'I wanted to raise several issues: the library closure, pot holes on my street, and also ask about...',
    fromEmail: 'george.thompson@gmail.com',
    fromName: 'George Thompson',
    receivedAt: '2024-01-15T14:30:00Z',
    emailType: 'casework',
    classificationConfidence: 0.45,
    classificationReasoning: 'Multiple topics detected - may need to be split into separate cases',
    isCampaignEmail: false,
    suggestedTags: [
      { id: 't1', name: 'Libraries', color: '#3b82f6', confidence: 0.60 },
      { id: 't16', name: 'Transport', color: '#06b6d4', confidence: 0.55 },
    ],
    suggestedAssignee: { userId: 'u2', userName: 'Mike Chen', reason: 'General casework' },
    alternativeAssignees: [
      { userId: 'u1', userName: 'Sarah Jones', reason: 'Policy elements present' },
      { userId: 'u3', userName: 'Lisa Park', reason: 'Available capacity' },
    ],
    constituentMatch: { status: 'none', extracted: { name: 'George Thompson' } },
  },
  {
    id: 'm2',
    subject: 'Fwd: Re: Council response',
    snippet: '---------- Forwarded message ---------- From: council@localauth.gov.uk... I am forwarding this...',
    fromEmail: 'helen.jackson@btinternet.com',
    fromName: 'Helen Jackson',
    receivedAt: '2024-01-15T15:00:00Z',
    emailType: 'casework',
    classificationConfidence: 0.38,
    classificationReasoning: 'Forwarded message chain - context unclear, may relate to existing case',
    isCampaignEmail: false,
    suggestedTags: [],
    suggestedAssignee: { userId: 'u2', userName: 'Mike Chen', reason: 'Needs investigation' },
    alternativeAssignees: [],
    constituentMatch: {
      status: 'multiple',
      alternatives: [
        { id: 'con-11', name: 'Helen Jackson', matchReason: 'Name match' },
        { id: 'con-12', name: 'Helen Jackson-Smith', matchReason: 'Similar name' },
      ]
    },
    suggestedCase: {
      caseId: 'case-3',
      reference: 'CW-2023-0891',
      title: 'Planning Objection - Jackson',
      confidence: 0.52,
    },
    alternativeCases: [
      {
        caseId: 'case-4',
        reference: 'CW-2024-0012',
        title: 'Noise Complaint - H. Jackson',
        confidence: 0.48,
      },
    ],
  },
];

// Group campaign emails by campaign
interface CampaignGroup {
  campaignId: string;
  campaignName: string;
  emails: TriageEmail[];
  totalConstituentsMatched: number;
  newConstituents: number;
}

function groupByCampaign(emails: TriageEmail[]): CampaignGroup[] {
  const groups = new Map<string, CampaignGroup>();

  emails.forEach(email => {
    const id = email.detectedCampaignId || 'unknown';
    const existing = groups.get(id);

    if (existing) {
      existing.emails.push(email);
      if (email.constituentMatch.status === 'exact') existing.totalConstituentsMatched++;
      if (email.constituentMatch.status === 'none') existing.newConstituents++;
    } else {
      groups.set(id, {
        campaignId: id,
        campaignName: email.detectedCampaignName || 'Unknown Campaign',
        emails: [email],
        totalConstituentsMatched: email.constituentMatch.status === 'exact' ? 1 : 0,
        newConstituents: email.constituentMatch.status === 'none' ? 1 : 0,
      });
    }
  });

  return Array.from(groups.values());
}

// ============= COMPONENT HELPERS =============

function ConfidenceBadge({ confidence, showLabel = false }: { confidence: number; showLabel?: boolean }) {
  let color = 'bg-red-100 text-red-700 border-red-200';
  let label = 'Low';

  if (confidence >= 0.85) {
    color = 'bg-green-100 text-green-700 border-green-200';
    label = 'High';
  } else if (confidence >= 0.6) {
    color = 'bg-yellow-100 text-yellow-700 border-yellow-200';
    label = 'Medium';
  }

  return (
    <Badge variant="outline" className={`${color} text-xs`}>
      {Math.round(confidence * 100)}%{showLabel && ` (${label})`}
    </Badge>
  );
}

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

// ============= MAIN COMPONENT =============

export default function TriagePrototype1() {
  const [currentPhase, setCurrentPhase] = useState<1 | 2 | 3 | 4>(1);
  const [completedPhases, setCompletedPhases] = useState<Set<number>>(new Set());
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [processedEmails, setProcessedEmails] = useState<Set<string>>(new Set());

  const campaignGroups = groupByCampaign(campaignEmails);

  const totalEmails = campaignEmails.length + quickWinEmails.length + reviewRequiredEmails.length + manualTriageEmails.length;
  const processedCount = processedEmails.size;
  const progressPercent = (processedCount / totalEmails) * 100;

  const toggleCampaignExpand = (campaignId: string) => {
    setExpandedCampaigns(prev => {
      const next = new Set(prev);
      if (next.has(campaignId)) {
        next.delete(campaignId);
      } else {
        next.add(campaignId);
      }
      return next;
    });
  };

  const approveAllCampaign = (campaignId: string) => {
    const group = campaignGroups.find(g => g.campaignId === campaignId);
    if (group) {
      setProcessedEmails(prev => {
        const next = new Set(prev);
        group.emails.forEach(e => next.add(e.id));
        return next;
      });
    }
  };

  const completePhase = (phase: number) => {
    setCompletedPhases(prev => new Set([...prev, phase]));
    if (phase < 4) {
      setCurrentPhase((phase + 1) as 1 | 2 | 3 | 4);
    }
  };

  const approveEmail = (emailId: string) => {
    setProcessedEmails(prev => new Set([...prev, emailId]));
  };

  const phases = [
    { id: 1, name: 'Campaign Batch', icon: Users, count: campaignEmails.length, color: 'text-blue-600' },
    { id: 2, name: 'Quick Wins', icon: Zap, count: quickWinEmails.length, color: 'text-green-600' },
    { id: 3, name: 'Review Required', icon: Clock, count: reviewRequiredEmails.length, color: 'text-yellow-600' },
    { id: 4, name: 'Manual Triage', icon: AlertTriangle, count: manualTriageEmails.length, color: 'text-red-600' },
  ];

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <DesignTooltip comment="Header shows overall progress and estimated time savings. The goal is to give immediate positive feedback as emails are processed.">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Smart Email Triage</h1>
              <p className="text-muted-foreground">
                Process {totalEmails} emails in 4 phases - estimated time: 8 minutes
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-green-600">{processedCount}/{totalEmails}</div>
              <div className="text-sm text-muted-foreground">emails processed</div>
            </div>
          </div>
        </DesignTooltip>

        {/* Progress Bar */}
        <DesignTooltip comment="Visual progress bar with phase indicators. Shows how much work remains and encourages completion. Green phases are done, current is highlighted.">
          <Card>
            <CardContent className="py-4">
              <div className="space-y-3">
                <Progress value={progressPercent} className="h-3" />
                <div className="flex justify-between">
                  {phases.map((phase) => {
                    const Icon = phase.icon;
                    const isComplete = completedPhases.has(phase.id);
                    const isCurrent = currentPhase === phase.id;

                    return (
                      <button
                        key={phase.id}
                        onClick={() => setCurrentPhase(phase.id as 1 | 2 | 3 | 4)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors ${
                          isCurrent ? 'bg-primary/10 text-primary font-medium' :
                          isComplete ? 'text-green-600' : 'text-muted-foreground'
                        } hover:bg-muted`}
                      >
                        {isComplete ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <Icon className={`h-4 w-4 ${phase.color}`} />
                        )}
                        <span className="text-sm">{phase.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {phase.count}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </DesignTooltip>

        {/* Phase 1: Campaign Batch */}
        {currentPhase === 1 && (
          <DesignTooltip comment="Phase 1 groups campaign emails by campaign. One-click 'Approve All' handles 50+ emails instantly. Expandable to spot-check individual emails.">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-blue-600" />
                      Phase 1: Campaign Emails
                    </CardTitle>
                    <CardDescription>
                      {campaignGroups.length} campaigns detected with {campaignEmails.length} total emails
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <DesignTooltip comment="'Approve All Campaigns' is the power action - processes all campaign emails with one click. Most users will click this immediately.">
                      <Button
                        onClick={() => {
                          campaignGroups.forEach(g => approveAllCampaign(g.campaignId));
                          completePhase(1);
                        }}
                      >
                        <Check className="mr-2 h-4 w-4" />
                        Approve All Campaigns
                      </Button>
                    </DesignTooltip>
                    <Button variant="outline" onClick={() => completePhase(1)}>
                      Skip to Next Phase
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {campaignGroups.map((group) => {
                    const isExpanded = expandedCampaigns.has(group.campaignId);
                    const allProcessed = group.emails.every(e => processedEmails.has(e.id));

                    return (
                      <Collapsible key={group.campaignId} open={isExpanded}>
                        <div className={`rounded-lg border p-4 ${allProcessed ? 'bg-green-50 border-green-200' : ''}`}>
                          <div className="flex items-center justify-between">
                            <CollapsibleTrigger
                              onClick={() => toggleCampaignExpand(group.campaignId)}
                              className="flex items-center gap-3 hover:text-primary"
                            >
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              <div className="text-left">
                                <div className="font-medium">{group.campaignName}</div>
                                <div className="text-sm text-muted-foreground">
                                  {group.emails.length} emails • {group.totalConstituentsMatched} existing constituents • {group.newConstituents} new
                                </div>
                              </div>
                            </CollapsibleTrigger>

                            <div className="flex items-center gap-3">
                              <DesignTooltip comment="Shows tags that will be auto-applied. Clicking could allow modification before approval.">
                                <div className="flex gap-1">
                                  {group.emails[0].suggestedTags.slice(0, 2).map(tag => (
                                    <Badge
                                      key={tag.id}
                                      variant="outline"
                                      style={{ borderColor: tag.color, backgroundColor: `${tag.color}15`, color: tag.color }}
                                    >
                                      {tag.name}
                                    </Badge>
                                  ))}
                                </div>
                              </DesignTooltip>

                              <DesignTooltip comment="Shows who will be assigned. Could show dropdown to change if needed.">
                                <Badge variant="secondary">
                                  <User className="mr-1 h-3 w-3" />
                                  {group.emails[0].suggestedAssignee.userName}
                                </Badge>
                              </DesignTooltip>

                              {allProcessed ? (
                                <Badge className="bg-green-600">
                                  <CheckCircle2 className="mr-1 h-3 w-3" />
                                  Approved
                                </Badge>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={() => approveAllCampaign(group.campaignId)}
                                >
                                  <Check className="mr-1 h-3 w-3" />
                                  Approve {group.emails.length}
                                </Button>
                              )}
                            </div>
                          </div>

                          <CollapsibleContent>
                            <DesignTooltip comment="Expanded view shows individual emails for spot-checking. Only needed if manager wants to verify AI detection.">
                              <div className="mt-4 space-y-2 pl-7">
                                {group.emails.map((email) => (
                                  <div
                                    key={email.id}
                                    className={`flex items-center justify-between p-2 rounded border text-sm ${
                                      processedEmails.has(email.id) ? 'bg-green-50/50' : 'bg-muted/30'
                                    }`}
                                  >
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                      <div className="min-w-[140px]">
                                        <div className="font-medium truncate">{email.fromName}</div>
                                        <div className="text-xs text-muted-foreground truncate">{email.fromEmail}</div>
                                      </div>
                                      <div className="flex-1 truncate text-muted-foreground">
                                        {email.snippet}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <DesignTooltip comment="Constituent status: green check = matched, yellow = needs review, gray = will create new.">
                                        {email.constituentMatch.status === 'exact' ? (
                                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                            <User className="mr-1 h-3 w-3" />
                                            Matched
                                          </Badge>
                                        ) : email.constituentMatch.status === 'fuzzy' ? (
                                          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                                            <AlertCircle className="mr-1 h-3 w-3" />
                                            Review
                                          </Badge>
                                        ) : (
                                          <Badge variant="outline" className="text-muted-foreground">
                                            <User className="mr-1 h-3 w-3" />
                                            New
                                          </Badge>
                                        )}
                                      </DesignTooltip>
                                      <ConfidenceBadge confidence={email.classificationConfidence} />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </DesignTooltip>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </DesignTooltip>
        )}

        {/* Phase 2: Quick Wins */}
        {currentPhase === 2 && (
          <DesignTooltip comment="Phase 2 shows high-confidence policy emails. Each row has one-click approve. Keyboard shortcuts (j/k/a) would speed this up further.">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-green-600" />
                      Phase 2: Quick Wins
                    </CardTitle>
                    <CardDescription>
                      High-confidence policy emails - one click to approve
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        quickWinEmails.forEach(e => approveEmail(e.id));
                        completePhase(2);
                      }}
                    >
                      <Check className="mr-2 h-4 w-4" />
                      Approve All Quick Wins
                    </Button>
                    <Button variant="outline" onClick={() => completePhase(2)}>
                      Skip to Next Phase
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {quickWinEmails.map((email) => {
                      const isProcessed = processedEmails.has(email.id);

                      return (
                        <div
                          key={email.id}
                          className={`flex items-center gap-4 p-3 rounded-lg border ${
                            isProcessed ? 'bg-green-50 border-green-200' : 'hover:bg-muted/50'
                          }`}
                        >
                          <DesignTooltip comment="Confidence indicator uses color coding. Green = approve confidently, yellow = glance at, red = review carefully.">
                            <ConfidenceBadge confidence={email.classificationConfidence} showLabel />
                          </DesignTooltip>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">{email.subject}</span>
                              <Badge variant="outline" className="text-xs capitalize">
                                {email.emailType}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                              <span>{email.fromName}</span>
                              <span>•</span>
                              <span className="truncate">{email.snippet}</span>
                            </div>
                          </div>

                          <DesignTooltip comment="Pre-selected tags based on AI analysis. Click to modify if needed.">
                            <div className="flex gap-1">
                              {email.suggestedTags.slice(0, 2).map(tag => (
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
                          </DesignTooltip>

                          <DesignTooltip comment="Constituent match indicator. Links to constituent record if matched.">
                            {email.constituentMatch.status === 'exact' && email.constituentMatch.matched && (
                              <Button variant="ghost" size="sm" className="text-green-600">
                                <User className="mr-1 h-3 w-3" />
                                {email.constituentMatch.matched.name}
                                <ExternalLink className="ml-1 h-3 w-3" />
                              </Button>
                            )}
                          </DesignTooltip>

                          <DesignTooltip comment="Assignee shown with reasoning tooltip. Could be dropdown to change.">
                            <Badge variant="secondary">
                              <User className="mr-1 h-3 w-3" />
                              {email.suggestedAssignee.userName}
                            </Badge>
                          </DesignTooltip>

                          {isProcessed ? (
                            <Badge className="bg-green-600">
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              Done
                            </Badge>
                          ) : (
                            <Button size="sm" onClick={() => approveEmail(email.id)}>
                              <Check className="mr-1 h-3 w-3" />
                              Approve
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </DesignTooltip>
        )}

        {/* Phase 3: Review Required */}
        {currentPhase === 3 && (
          <DesignTooltip comment="Phase 3 requires more attention. Shows alternative options prominently. Expanded cards reveal AI reasoning and allow switching between options.">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-yellow-600" />
                      Phase 3: Review Required
                    </CardTitle>
                    <CardDescription>
                      Medium-confidence items - review AI suggestions before approving
                    </CardDescription>
                  </div>
                  <Button variant="outline" onClick={() => completePhase(3)}>
                    Skip to Next Phase
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {reviewRequiredEmails.map((email) => {
                    const isProcessed = processedEmails.has(email.id);

                    return (
                      <Card key={email.id} className={isProcessed ? 'bg-green-50 border-green-200' : ''}>
                        <CardContent className="pt-4">
                          <div className="space-y-4">
                            {/* Header row */}
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <ConfidenceBadge confidence={email.classificationConfidence} showLabel />
                                  <Badge variant="outline" className="capitalize">{email.emailType}</Badge>
                                  {email.suggestedTags.filter(t => t.confidence >= 0.8).map(tag => (
                                    <Badge
                                      key={tag.id}
                                      variant="outline"
                                      style={{ borderColor: tag.color, backgroundColor: `${tag.color}15`, color: tag.color }}
                                    >
                                      {tag.name}
                                    </Badge>
                                  ))}
                                </div>
                                <h4 className="font-semibold">{email.subject}</h4>
                                <p className="text-sm text-muted-foreground">
                                  From: {email.fromName} ({email.fromEmail})
                                </p>
                              </div>

                              {isProcessed ? (
                                <Badge className="bg-green-600">
                                  <CheckCircle2 className="mr-1 h-3 w-3" />
                                  Processed
                                </Badge>
                              ) : (
                                <Button onClick={() => approveEmail(email.id)}>
                                  <Check className="mr-2 h-4 w-4" />
                                  Approve with AI Suggestions
                                </Button>
                              )}
                            </div>

                            {/* AI Reasoning */}
                            <DesignTooltip comment="AI reasoning helps manager understand why classification was uncertain. Builds trust and helps spot errors.">
                              <div className="rounded bg-muted/50 p-3 text-sm">
                                <div className="font-medium text-muted-foreground mb-1">AI Analysis:</div>
                                {email.classificationReasoning}
                              </div>
                            </DesignTooltip>

                            {/* Decision Grid */}
                            <div className="grid grid-cols-3 gap-4">
                              {/* Constituent */}
                              <DesignTooltip comment="Constituent matching with alternatives. Multiple match shows both options to choose from.">
                                <div className="space-y-2">
                                  <div className="text-sm font-medium flex items-center gap-1">
                                    <User className="h-4 w-4" />
                                    Constituent
                                  </div>
                                  {email.constituentMatch.status === 'exact' && email.constituentMatch.matched && (
                                    <div className="p-2 rounded border bg-green-50 border-green-200">
                                      <div className="font-medium text-sm">{email.constituentMatch.matched.name}</div>
                                      <div className="text-xs text-muted-foreground">{email.constituentMatch.matched.address}</div>
                                      {email.constituentMatch.matched.previousCases! > 0 && (
                                        <Badge variant="secondary" className="mt-1 text-xs">
                                          {email.constituentMatch.matched.previousCases} previous cases
                                        </Badge>
                                      )}
                                    </div>
                                  )}
                                  {email.constituentMatch.status === 'multiple' && email.constituentMatch.alternatives && (
                                    <Select>
                                      <SelectTrigger className="h-auto p-2">
                                        <SelectValue placeholder="Select constituent..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {email.constituentMatch.alternatives.map(alt => (
                                          <SelectItem key={alt.id} value={alt.id}>
                                            <div>
                                              <div className="font-medium">{alt.name}</div>
                                              <div className="text-xs text-muted-foreground">{alt.matchReason}</div>
                                            </div>
                                          </SelectItem>
                                        ))}
                                        <SelectItem value="new">+ Create new constituent</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  )}
                                  {email.constituentMatch.status === 'fuzzy' && (
                                    <div className="space-y-1">
                                      <div className="p-2 rounded border bg-yellow-50 border-yellow-200">
                                        <div className="font-medium text-sm">{email.constituentMatch.matched?.name}</div>
                                        <div className="text-xs text-muted-foreground">Fuzzy match</div>
                                      </div>
                                      <Button variant="outline" size="sm" className="w-full text-xs">
                                        Create New Instead
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </DesignTooltip>

                              {/* Assignee */}
                              <DesignTooltip comment="Assignee selection with reasoning. Shows why each person is suggested.">
                                <div className="space-y-2">
                                  <div className="text-sm font-medium flex items-center gap-1">
                                    <Building2 className="h-4 w-4" />
                                    Assign To
                                  </div>
                                  <Select defaultValue={email.suggestedAssignee.userId}>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value={email.suggestedAssignee.userId}>
                                        <div className="flex items-center gap-2">
                                          <span>{email.suggestedAssignee.userName}</span>
                                          <Badge variant="outline" className="text-xs bg-green-50">Suggested</Badge>
                                        </div>
                                      </SelectItem>
                                      {email.alternativeAssignees.map(alt => (
                                        <SelectItem key={alt.userId} value={alt.userId}>
                                          <div>
                                            <div>{alt.userName}</div>
                                            <div className="text-xs text-muted-foreground">{alt.reason}</div>
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <div className="text-xs text-muted-foreground">
                                    {email.suggestedAssignee.reason}
                                  </div>
                                </div>
                              </DesignTooltip>

                              {/* Case Matching */}
                              <DesignTooltip comment="For casework, shows potential existing case matches. Prevents duplicate cases being created.">
                                <div className="space-y-2">
                                  <div className="text-sm font-medium flex items-center gap-1">
                                    <Tag className="h-4 w-4" />
                                    {email.emailType === 'casework' ? 'Link to Case' : 'Tags'}
                                  </div>
                                  {email.suggestedCase ? (
                                    <Select defaultValue={email.suggestedCase.caseId}>
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value={email.suggestedCase.caseId}>
                                          <div className="flex items-center gap-2">
                                            <span>{email.suggestedCase.reference}</span>
                                            <ConfidenceBadge confidence={email.suggestedCase.confidence} />
                                          </div>
                                        </SelectItem>
                                        {email.alternativeCases?.map(alt => (
                                          <SelectItem key={alt.caseId} value={alt.caseId}>
                                            <div className="flex items-center gap-2">
                                              <span>{alt.reference}</span>
                                              <ConfidenceBadge confidence={alt.confidence} />
                                            </div>
                                          </SelectItem>
                                        ))}
                                        <SelectItem value="new">+ Create new case</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <div className="flex flex-wrap gap-1">
                                      {email.suggestedTags.map(tag => (
                                        <Badge
                                          key={tag.id}
                                          variant="outline"
                                          className="cursor-pointer hover:bg-muted"
                                          style={{ borderColor: tag.color, backgroundColor: `${tag.color}15`, color: tag.color }}
                                        >
                                          {tag.name}
                                          <X className="ml-1 h-3 w-3" />
                                        </Badge>
                                      ))}
                                      <Button variant="outline" size="sm" className="h-6 text-xs">
                                        + Add Tag
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </DesignTooltip>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </DesignTooltip>
        )}

        {/* Phase 4: Manual Triage */}
        {currentPhase === 4 && (
          <DesignTooltip comment="Phase 4 is for complex cases requiring manual attention. Full email preview, all options editable, clear action buttons.">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  Phase 4: Manual Triage
                </CardTitle>
                <CardDescription>
                  These emails require human judgment - AI confidence is low
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {manualTriageEmails.map((email) => {
                    const isProcessed = processedEmails.has(email.id);

                    return (
                      <Card key={email.id} className={`border-2 ${isProcessed ? 'border-green-300 bg-green-50' : 'border-red-200'}`}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <AlertCircle className="h-5 w-5 text-red-500" />
                              <ConfidenceBadge confidence={email.classificationConfidence} showLabel />
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {new Date(email.receivedAt).toLocaleString()}
                            </div>
                          </div>
                          <CardTitle className="text-lg">{email.subject}</CardTitle>
                          <CardDescription>
                            From: {email.fromName} ({email.fromEmail})
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {/* Email Content Preview */}
                          <DesignTooltip comment="Full email preview for complex cases. Manager needs full context to make decisions.">
                            <div className="rounded-lg bg-muted/50 p-4">
                              <div className="text-sm whitespace-pre-wrap">{email.snippet}</div>
                            </div>
                          </DesignTooltip>

                          {/* AI Warning */}
                          <DesignTooltip comment="Warning explains why AI confidence is low. Helps manager understand what needs attention.">
                            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                              <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                              <div className="text-sm">
                                <div className="font-medium text-red-700">Manual review required</div>
                                <div className="text-red-600">{email.classificationReasoning}</div>
                              </div>
                            </div>
                          </DesignTooltip>

                          {/* Manual Selection Grid */}
                          <div className="grid grid-cols-2 gap-4">
                            {/* Email Type */}
                            <DesignTooltip comment="Type selection determines workflow. Casework creates a case, policy goes to policy queue.">
                              <div className="space-y-2">
                                <div className="text-sm font-medium">Email Type</div>
                                <Select defaultValue={email.emailType}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="casework">Casework (create case)</SelectItem>
                                    <SelectItem value="policy">Policy (no case needed)</SelectItem>
                                    <SelectItem value="campaign">Campaign (add to campaign)</SelectItem>
                                    <SelectItem value="spam">Spam (archive)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </DesignTooltip>

                            {/* Constituent */}
                            <DesignTooltip comment="Constituent selection for uncertain matches. Create new option always available.">
                              <div className="space-y-2">
                                <div className="text-sm font-medium">Constituent</div>
                                {email.constituentMatch.alternatives ? (
                                  <Select>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select or create..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {email.constituentMatch.alternatives.map(alt => (
                                        <SelectItem key={alt.id} value={alt.id}>
                                          {alt.name} - {alt.matchReason}
                                        </SelectItem>
                                      ))}
                                      <SelectItem value="new">+ Create new constituent</SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <Button variant="outline" className="w-full">
                                    <User className="mr-2 h-4 w-4" />
                                    Create Constituent
                                  </Button>
                                )}
                              </div>
                            </DesignTooltip>

                            {/* Assignee */}
                            <div className="space-y-2">
                              <div className="text-sm font-medium">Assign To</div>
                              <Select defaultValue={email.suggestedAssignee.userId}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={email.suggestedAssignee.userId}>
                                    {email.suggestedAssignee.userName}
                                  </SelectItem>
                                  {email.alternativeAssignees.map(alt => (
                                    <SelectItem key={alt.userId} value={alt.userId}>
                                      {alt.userName}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Case Linking */}
                            <div className="space-y-2">
                              <div className="text-sm font-medium">Link to Case</div>
                              {email.suggestedCase ? (
                                <Select>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select case..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value={email.suggestedCase.caseId}>
                                      {email.suggestedCase.reference} ({Math.round(email.suggestedCase.confidence * 100)}%)
                                    </SelectItem>
                                    {email.alternativeCases?.map(alt => (
                                      <SelectItem key={alt.caseId} value={alt.caseId}>
                                        {alt.reference} ({Math.round(alt.confidence * 100)}%)
                                      </SelectItem>
                                    ))}
                                    <SelectItem value="new">+ Create new case</SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Select>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Search or create..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="new">+ Create new case</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                          </div>

                          {/* Tags */}
                          <DesignTooltip comment="Tag selection is crucial for analytics. Pre-filled if AI has suggestions, otherwise empty for manual selection.">
                            <div className="space-y-2">
                              <div className="text-sm font-medium">Tags</div>
                              <div className="flex flex-wrap gap-2">
                                {email.suggestedTags.map(tag => (
                                  <Badge
                                    key={tag.id}
                                    variant="outline"
                                    className="cursor-pointer"
                                    style={{ borderColor: tag.color, backgroundColor: `${tag.color}15`, color: tag.color }}
                                  >
                                    {tag.name}
                                    <ConfidenceBadge confidence={tag.confidence} />
                                    <X className="ml-1 h-3 w-3" />
                                  </Badge>
                                ))}
                                <Button variant="outline" size="sm">
                                  <Tag className="mr-1 h-3 w-3" />
                                  Add Tag
                                </Button>
                              </div>
                            </div>
                          </DesignTooltip>

                          {/* Actions */}
                          <div className="flex justify-end gap-2 pt-2 border-t">
                            <Button variant="outline">
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Re-analyze with AI
                            </Button>
                            {isProcessed ? (
                              <Badge className="bg-green-600 py-2 px-4">
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                Processed
                              </Badge>
                            ) : (
                              <Button onClick={() => approveEmail(email.id)}>
                                <Check className="mr-2 h-4 w-4" />
                                Process Email
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </DesignTooltip>
        )}

        {/* Completion Summary */}
        {processedCount === totalEmails && (
          <DesignTooltip comment="Completion screen shows summary and time saved. Reinforces value of the system.">
            <Card className="border-green-200 bg-green-50">
              <CardContent className="py-8 text-center">
                <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-green-800">Triage Complete!</h2>
                <p className="text-green-700 mt-2">
                  Processed {totalEmails} emails in all 4 phases
                </p>
                <div className="mt-4 grid grid-cols-4 gap-4 max-w-md mx-auto">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{campaignEmails.length}</div>
                    <div className="text-xs text-muted-foreground">Campaign</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{quickWinEmails.length}</div>
                    <div className="text-xs text-muted-foreground">Quick Wins</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">{reviewRequiredEmails.length}</div>
                    <div className="text-xs text-muted-foreground">Reviewed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{manualTriageEmails.length}</div>
                    <div className="text-xs text-muted-foreground">Manual</div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-4">
                  Estimated time saved: ~3 hours 45 minutes
                </p>
              </CardContent>
            </Card>
          </DesignTooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
