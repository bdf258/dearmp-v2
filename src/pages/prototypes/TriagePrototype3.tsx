/**
 * PROTOTYPE 3: AI-First Smart List
 *
 * Concept: Single unified list with intelligent grouping and inline editing.
 * Features: Smart sort, inline editing, group actions, quick filters, keyboard nav
 *
 * Strengths: Most powerful for experienced users, handles high volume efficiently
 * Weaknesses: Steeper learning curve, requires more training
 */

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Mail,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  User,
  Tag,
  Search,
  Filter,
  SlidersHorizontal,
  ChevronDown,
  Check,
  X,
  ExternalLink,
  Keyboard,
  Zap,
  Eye,
  ArrowUpDown,
  MoreHorizontal,
  Users,
  FileText,
  Flag,
  Sparkles,
  Pencil,
  RefreshCw,
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
  body: string;
  fromEmail: string;
  fromName: string;
  receivedAt: string;
  emailType: 'policy' | 'casework' | 'campaign' | 'spam';
  classificationConfidence: number;
  classificationReasoning: string;
  campaignName?: string;
  suggestedTags: SuggestedTag[];
  suggestedAssignee: { id: string; name: string; reason: string };
  alternativeAssignees: Array<{ id: string; name: string; reason: string }>;
  constituentStatus: 'matched' | 'fuzzy' | 'multiple' | 'new';
  constituentName?: string;
  constituentId?: string;
  alternativeConstituents?: Array<{ id: string; name: string; reason: string }>;
  existingCaseRef?: string;
  existingCaseTitle?: string;
  alternativeCases?: Array<{ ref: string; title: string; confidence: number }>;
  processed: boolean;
  // Computed scores
  urgencyScore: number; // 0-100
  complexityScore: number; // 0-100
}

// ============= MOCK DATA =============

const mockEmails: TriageEmail[] = [
  // High urgency casework
  {
    id: '1',
    subject: 'URGENT: Eviction notice received',
    snippet: 'I have just received an eviction notice and I have nowhere to go. Please help urgently...',
    body: 'Dear MP, I am writing in desperation. I have just received an eviction notice effective in 14 days. I have two small children and nowhere to go. The council says they cannot help until I am actually homeless. I have been a good tenant for 5 years but my landlord wants to sell. Please can you intervene urgently?',
    fromEmail: 'desperate.tenant@gmail.com',
    fromName: 'Maria Santos',
    receivedAt: '2024-01-15T07:00:00Z',
    emailType: 'casework',
    classificationConfidence: 0.94,
    classificationReasoning: 'Clear urgent housing casework - eviction with vulnerable family',
    suggestedTags: [
      { id: 't1', name: 'Housing', color: '#a855f7', confidence: 0.98 },
      { id: 't2', name: 'Urgent', color: '#ef4444', confidence: 0.96 },
      { id: 't3', name: 'Family', color: '#ec4899', confidence: 0.82 },
    ],
    suggestedAssignee: { id: 'u2', name: 'Mike Chen', reason: 'Housing specialist' },
    alternativeAssignees: [{ id: 'u3', name: 'Lisa Park', reason: 'Available capacity' }],
    constituentStatus: 'new',
    processed: false,
    urgencyScore: 95,
    complexityScore: 75,
  },
  {
    id: '2',
    subject: 'Visa application delayed 12 months',
    snippet: 'My spouse visa has been pending for over a year. We are separated from our family...',
    body: 'Dear MP, My wife applied for a spouse visa to join me in the UK over 12 months ago. We have a 3 year old daughter who is a British citizen. The Home Office says the case is "under consideration" but will not give us any timeline. This separation is causing immense stress to our family. Can you please make enquiries on our behalf?',
    fromEmail: 'ahmed.rahman@outlook.com',
    fromName: 'Ahmed Rahman',
    receivedAt: '2024-01-15T08:30:00Z',
    emailType: 'casework',
    classificationConfidence: 0.91,
    classificationReasoning: 'Immigration casework - visa delay with family separation',
    suggestedTags: [
      { id: 't4', name: 'Immigration', color: '#8b5cf6', confidence: 0.97 },
      { id: 't5', name: 'Home Office', color: '#6366f1', confidence: 0.94 },
      { id: 't2', name: 'Urgent', color: '#ef4444', confidence: 0.78 },
    ],
    suggestedAssignee: { id: 'u3', name: 'Lisa Park', reason: 'Immigration specialist' },
    alternativeAssignees: [{ id: 'u2', name: 'Mike Chen', reason: 'Casework backup' }],
    constituentStatus: 'matched',
    constituentName: 'Ahmed Rahman',
    constituentId: 'con-1',
    existingCaseRef: 'CW-2023-0456',
    existingCaseTitle: 'Spouse Visa Application - Rahman',
    processed: false,
    urgencyScore: 88,
    complexityScore: 65,
  },

  // Medium priority
  {
    id: '3',
    subject: 'Benefits reassessment query',
    snippet: 'I have been asked to attend a PIP reassessment and I am worried about the process...',
    body: 'Dear MP, I currently receive PIP due to my chronic illness. I have received a letter asking me to attend a reassessment. I am very anxious about this as I have heard many people lose their benefits unfairly. Could you advise on what support is available and whether you can help if I face problems?',
    fromEmail: 'janet.wilson@btinternet.com',
    fromName: 'Janet Wilson',
    receivedAt: '2024-01-15T09:00:00Z',
    emailType: 'casework',
    classificationConfidence: 0.78,
    classificationReasoning: 'Benefits casework - PIP reassessment concern, may be policy query',
    suggestedTags: [
      { id: 't6', name: 'Benefits', color: '#f59e0b', confidence: 0.92 },
      { id: 't7', name: 'DWP', color: '#3b82f6', confidence: 0.88 },
      { id: 't8', name: 'Disability', color: '#14b8a6', confidence: 0.75 },
    ],
    suggestedAssignee: { id: 'u2', name: 'Mike Chen', reason: 'Benefits specialist' },
    alternativeAssignees: [{ id: 'u1', name: 'Sarah Jones', reason: 'If policy response needed' }],
    constituentStatus: 'fuzzy',
    constituentName: 'J. Wilson',
    alternativeConstituents: [
      { id: 'con-2', name: 'Janet Wilson', reason: 'Same postcode area' },
      { id: 'con-3', name: 'Jane Wilson', reason: 'Similar name' },
    ],
    processed: false,
    urgencyScore: 65,
    complexityScore: 55,
  },

  // Campaign emails (grouped)
  {
    id: '4',
    subject: 'Save Our Local Library - Please Act Now',
    snippet: 'I am writing to express my concern about the proposed closure of our beloved library...',
    body: 'Dear MP, I am deeply concerned about the proposed closure of our local library. As a parent of two young children, the library has been invaluable for their education and love of reading. I urge you to oppose these cuts and fight to keep our library open.',
    fromEmail: 'john.smith@gmail.com',
    fromName: 'John Smith',
    receivedAt: '2024-01-15T09:30:00Z',
    emailType: 'campaign',
    classificationConfidence: 0.97,
    classificationReasoning: 'Matches "Save Our Library" campaign (97% fingerprint match)',
    campaignName: 'Save Our Library',
    suggestedTags: [{ id: 't9', name: 'Libraries', color: '#10b981', confidence: 0.98 }],
    suggestedAssignee: { id: 'u1', name: 'Sarah Jones', reason: 'Default policy handler' },
    alternativeAssignees: [],
    constituentStatus: 'matched',
    constituentName: 'John Smith',
    constituentId: 'con-4',
    processed: false,
    urgencyScore: 30,
    complexityScore: 10,
  },
  {
    id: '5',
    subject: 'Save Our Local Library - Please Act Now',
    snippet: 'As a lifelong user of the library, I cannot stress enough how important it is...',
    body: 'Dear MP, As a lifelong user of the library, I cannot stress enough how important it is to our community. Please do everything in your power to prevent its closure.',
    fromEmail: 'mary.jones@yahoo.com',
    fromName: 'Mary Jones',
    receivedAt: '2024-01-15T09:45:00Z',
    emailType: 'campaign',
    classificationConfidence: 0.96,
    classificationReasoning: 'Matches "Save Our Library" campaign (96% fingerprint match)',
    campaignName: 'Save Our Library',
    suggestedTags: [{ id: 't9', name: 'Libraries', color: '#10b981', confidence: 0.98 }],
    suggestedAssignee: { id: 'u1', name: 'Sarah Jones', reason: 'Default policy handler' },
    alternativeAssignees: [],
    constituentStatus: 'new',
    processed: false,
    urgencyScore: 30,
    complexityScore: 10,
  },
  {
    id: '6',
    subject: 'Save Our Local Library - Please Act Now',
    snippet: 'I use the library every week and it would be devastating if it closed...',
    body: 'Dear MP, I use the library every week and it would be devastating if it closed. Please support our community.',
    fromEmail: 'robert.brown@hotmail.com',
    fromName: 'Robert Brown',
    receivedAt: '2024-01-15T10:00:00Z',
    emailType: 'campaign',
    classificationConfidence: 0.95,
    classificationReasoning: 'Matches "Save Our Library" campaign (95% fingerprint match)',
    campaignName: 'Save Our Library',
    suggestedTags: [{ id: 't9', name: 'Libraries', color: '#10b981', confidence: 0.98 }],
    suggestedAssignee: { id: 'u1', name: 'Sarah Jones', reason: 'Default policy handler' },
    alternativeAssignees: [],
    constituentStatus: 'matched',
    constituentName: 'Robert Brown',
    constituentId: 'con-5',
    processed: false,
    urgencyScore: 30,
    complexityScore: 10,
  },
  {
    id: '7',
    subject: 'Protect Our Green Belt Land',
    snippet: 'I am writing to urge you to oppose the proposed housing development...',
    body: 'Dear MP, I am writing to urge you to oppose the proposed housing development on protected green belt land. This would destroy valuable wildlife habitat and increase flooding risk.',
    fromEmail: 'emma.wilson@gmail.com',
    fromName: 'Emma Wilson',
    receivedAt: '2024-01-15T10:15:00Z',
    emailType: 'campaign',
    classificationConfidence: 0.93,
    classificationReasoning: 'Matches "Protect Green Belt" campaign',
    campaignName: 'Protect Green Belt',
    suggestedTags: [
      { id: 't10', name: 'Planning', color: '#0ea5e9', confidence: 0.95 },
      { id: 't11', name: 'Environment', color: '#22c55e', confidence: 0.88 },
    ],
    suggestedAssignee: { id: 'u1', name: 'Sarah Jones', reason: 'Default policy handler' },
    alternativeAssignees: [],
    constituentStatus: 'matched',
    constituentName: 'Emma Wilson',
    constituentId: 'con-6',
    processed: false,
    urgencyScore: 35,
    complexityScore: 15,
  },

  // Policy emails
  {
    id: '8',
    subject: 'Question about NHS dental access',
    snippet: 'I am struggling to find an NHS dentist taking new patients in our area...',
    body: 'Dear MP, I have been trying to register with an NHS dentist for over 6 months without success. None of the practices in our area are accepting new NHS patients. Could you tell me what is being done about this crisis?',
    fromEmail: 'david.taylor@outlook.com',
    fromName: 'David Taylor',
    receivedAt: '2024-01-15T10:30:00Z',
    emailType: 'policy',
    classificationConfidence: 0.85,
    classificationReasoning: 'NHS access policy question, no specific casework intervention needed',
    suggestedTags: [
      { id: 't12', name: 'NHS', color: '#0ea5e9', confidence: 0.94 },
      { id: 't13', name: 'Dentistry', color: '#06b6d4', confidence: 0.91 },
    ],
    suggestedAssignee: { id: 'u1', name: 'Sarah Jones', reason: 'Policy questions' },
    alternativeAssignees: [{ id: 'u2', name: 'Mike Chen', reason: 'If becomes casework' }],
    constituentStatus: 'new',
    processed: false,
    urgencyScore: 45,
    complexityScore: 25,
  },
  {
    id: '9',
    subject: 'Your vote on the Housing Bill',
    snippet: 'I wanted to share my views on the upcoming Housing Bill vote...',
    body: 'Dear MP, I am writing to ask how you intend to vote on the upcoming Housing Bill. As a private renter, I am concerned about the proposals around Section 21 notices.',
    fromEmail: 'susan.clark@gmail.com',
    fromName: 'Susan Clark',
    receivedAt: '2024-01-15T11:00:00Z',
    emailType: 'policy',
    classificationConfidence: 0.89,
    classificationReasoning: 'Policy views/question about upcoming vote',
    suggestedTags: [
      { id: 't1', name: 'Housing', color: '#a855f7', confidence: 0.92 },
      { id: 't14', name: 'Legislation', color: '#6366f1', confidence: 0.85 },
    ],
    suggestedAssignee: { id: 'u1', name: 'Sarah Jones', reason: 'Policy correspondence' },
    alternativeAssignees: [],
    constituentStatus: 'matched',
    constituentName: 'Susan Clark',
    constituentId: 'con-7',
    processed: false,
    urgencyScore: 40,
    complexityScore: 20,
  },

  // Low confidence / needs review
  {
    id: '10',
    subject: 'Fw: Re: Various matters',
    snippet: '---------- Forwarded message ---------- I wanted to follow up on several things...',
    body: '---------- Forwarded message ----------\nFrom: council@localauth.gov.uk\n\nDear Mr Thompson,\n\nThank you for your enquiry...\n\n[George Thompson]: I am forwarding this as I need your help understanding the council\'s response about my planning application AND also want to ask about the bin collection changes AND the library.',
    fromEmail: 'george.thompson@btinternet.com',
    fromName: 'George Thompson',
    receivedAt: '2024-01-15T11:30:00Z',
    emailType: 'casework',
    classificationConfidence: 0.42,
    classificationReasoning: 'Multiple topics in forwarded chain - may need splitting',
    suggestedTags: [
      { id: 't10', name: 'Planning', color: '#0ea5e9', confidence: 0.55 },
      { id: 't15', name: 'Council', color: '#64748b', confidence: 0.52 },
    ],
    suggestedAssignee: { id: 'u2', name: 'Mike Chen', reason: 'Complex casework' },
    alternativeAssignees: [{ id: 'u1', name: 'Sarah Jones', reason: 'If policy elements' }],
    constituentStatus: 'multiple',
    alternativeConstituents: [
      { id: 'con-8', name: 'George Thompson', reason: 'Exact name match' },
      { id: 'con-9', name: 'G. Thompson', reason: 'Same address' },
    ],
    existingCaseRef: 'CW-2024-0089',
    existingCaseTitle: 'Planning Application Query',
    alternativeCases: [
      { ref: 'CW-2024-0091', title: 'Bin Collection Complaint', confidence: 0.45 },
    ],
    processed: false,
    urgencyScore: 50,
    complexityScore: 85,
  },
];

// ============= HELPER COMPONENTS =============

function DesignTooltip({ children, comment }: { children: React.ReactNode; comment: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs bg-slate-900 text-slate-100 border-slate-700">
        <p className="text-xs"><strong>Design Note:</strong> {comment}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function ConfidencePill({ confidence }: { confidence: number }) {
  let bgColor = 'bg-red-100 text-red-700';
  if (confidence >= 0.85) bgColor = 'bg-green-100 text-green-700';
  else if (confidence >= 0.6) bgColor = 'bg-yellow-100 text-yellow-700';

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${bgColor}`}>
      {Math.round(confidence * 100)}%
    </span>
  );
}

function InlineSelect({
  value,
  options,
  onChange,
  placeholder,
}: {
  value: string;
  options: Array<{ value: string; label: string; sublabel?: string }>;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-7 text-xs border-dashed hover:border-solid w-auto min-w-[100px]">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map(opt => (
          <SelectItem key={opt.value} value={opt.value}>
            <div>
              <div>{opt.label}</div>
              {opt.sublabel && <div className="text-xs text-muted-foreground">{opt.sublabel}</div>}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ============= MAIN COMPONENT =============

export default function TriagePrototype3() {
  const [emails, setEmails] = useState<TriageEmail[]>(mockEmails);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'smart' | 'urgency' | 'date' | 'confidence'>('smart');
  const [filterType, setFilterType] = useState<'all' | 'casework' | 'policy' | 'campaign'>('all');
  const [filterConfidence, setFilterConfidence] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [showProcessed, setShowProcessed] = useState(false);
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);

  // Filter and sort emails
  const filteredEmails = useMemo(() => {
    let result = emails;

    // Filter by processed status
    if (!showProcessed) {
      result = result.filter(e => !e.processed);
    }

    // Filter by type
    if (filterType !== 'all') {
      result = result.filter(e => e.emailType === filterType);
    }

    // Filter by confidence
    if (filterConfidence !== 'all') {
      result = result.filter(e => {
        if (filterConfidence === 'high') return e.classificationConfidence >= 0.85;
        if (filterConfidence === 'medium') return e.classificationConfidence >= 0.6 && e.classificationConfidence < 0.85;
        return e.classificationConfidence < 0.6;
      });
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(e =>
        e.subject.toLowerCase().includes(query) ||
        e.fromName.toLowerCase().includes(query) ||
        e.fromEmail.toLowerCase().includes(query) ||
        e.snippet.toLowerCase().includes(query)
      );
    }

    // Sort
    if (sortBy === 'smart') {
      // Smart sort: urgent + low confidence first, then by urgency
      result = [...result].sort((a, b) => {
        // Prioritize unprocessed
        if (a.processed !== b.processed) return a.processed ? 1 : -1;
        // Then by combined score (urgency + complexity - confidence)
        const aScore = a.urgencyScore + a.complexityScore - (a.classificationConfidence * 50);
        const bScore = b.urgencyScore + b.complexityScore - (b.classificationConfidence * 50);
        return bScore - aScore;
      });
    } else if (sortBy === 'urgency') {
      result = [...result].sort((a, b) => b.urgencyScore - a.urgencyScore);
    } else if (sortBy === 'date') {
      result = [...result].sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
    } else if (sortBy === 'confidence') {
      result = [...result].sort((a, b) => a.classificationConfidence - b.classificationConfidence);
    }

    return result;
  }, [emails, searchQuery, sortBy, filterType, filterConfidence, showProcessed]);

  // Group by campaign for campaign emails
  const campaignGroups = useMemo(() => {
    const campaigns = filteredEmails.filter(e => e.emailType === 'campaign' && !e.processed);
    const groups: Record<string, TriageEmail[]> = {};
    campaigns.forEach(e => {
      const name = e.campaignName || 'Unknown';
      if (!groups[name]) groups[name] = [];
      groups[name].push(e);
    });
    return groups;
  }, [filteredEmails]);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(filteredEmails.filter(e => !e.processed).map(e => e.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const processSelected = () => {
    setEmails(prev => prev.map(e =>
      selectedIds.has(e.id) ? { ...e, processed: true } : e
    ));
    setSelectedIds(new Set());
  };

  const processEmail = (id: string) => {
    setEmails(prev => prev.map(e => e.id === id ? { ...e, processed: true } : e));
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const processCampaign = (campaignName: string) => {
    const ids = campaignGroups[campaignName]?.map(e => e.id) || [];
    setEmails(prev => prev.map(e =>
      ids.includes(e.id) ? { ...e, processed: true } : e
    ));
  };

  const updateEmailField = (id: string, field: string, value: string) => {
    // In real implementation, this would update the email
    console.log(`Update ${id}: ${field} = ${value}`);
  };

  const totalCount = emails.filter(e => !e.processed).length;
  const processedCount = emails.filter(e => e.processed).length;
  const campaignCount = Object.values(campaignGroups).reduce((acc, g) => acc + g.length, 0);

  // Available tags for selection
  const availableTags = [
    { id: 't1', name: 'Housing', color: '#a855f7' },
    { id: 't2', name: 'Urgent', color: '#ef4444' },
    { id: 't4', name: 'Immigration', color: '#8b5cf6' },
    { id: 't5', name: 'Home Office', color: '#6366f1' },
    { id: 't6', name: 'Benefits', color: '#f59e0b' },
    { id: 't7', name: 'DWP', color: '#3b82f6' },
    { id: 't9', name: 'Libraries', color: '#10b981' },
    { id: 't10', name: 'Planning', color: '#0ea5e9' },
    { id: 't12', name: 'NHS', color: '#0ea5e9' },
    { id: 't15', name: 'Council', color: '#64748b' },
  ];

  const assignees = [
    { value: 'u1', label: 'Sarah Jones', sublabel: 'Policy' },
    { value: 'u2', label: 'Mike Chen', sublabel: 'Casework' },
    { value: 'u3', label: 'Lisa Park', sublabel: 'Immigration' },
  ];

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Header */}
        <DesignTooltip comment="Header shows quick stats and keyboard shortcut hint. Power users can use keyboard to fly through triage.">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Smart Triage</h1>
              <p className="text-muted-foreground text-sm">
                AI-sorted list with inline editing • {totalCount} pending, {processedCount} done
              </p>
            </div>
            <div className="flex items-center gap-3">
              <DesignTooltip comment="Keyboard shortcuts panel for power users. j/k to navigate, a to approve, t for tags, etc.">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Keyboard className="mr-2 h-4 w-4" />
                      Shortcuts
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64" align="end">
                    <div className="space-y-2 text-sm">
                      <div className="font-medium">Keyboard Shortcuts</div>
                      <div className="grid grid-cols-2 gap-1 text-muted-foreground">
                        <span className="font-mono bg-muted px-1 rounded">j/k</span><span>Navigate up/down</span>
                        <span className="font-mono bg-muted px-1 rounded">a</span><span>Approve selected</span>
                        <span className="font-mono bg-muted px-1 rounded">t</span><span>Open tags</span>
                        <span className="font-mono bg-muted px-1 rounded">e</span><span>Expand email</span>
                        <span className="font-mono bg-muted px-1 rounded">space</span><span>Toggle select</span>
                        <span className="font-mono bg-muted px-1 rounded">?</span><span>Show help</span>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </DesignTooltip>

              {campaignCount > 0 && (
                <DesignTooltip comment="Quick action to approve all campaign emails at once. Biggest time saver.">
                  <Button onClick={() => Object.keys(campaignGroups).forEach(c => processCampaign(c))}>
                    <Zap className="mr-2 h-4 w-4" />
                    Approve {campaignCount} Campaign Emails
                  </Button>
                </DesignTooltip>
              )}
            </div>
          </div>
        </DesignTooltip>

        {/* Filters & Search */}
        <DesignTooltip comment="Filter bar allows quick filtering by type, confidence level, and search. Sort options prioritize different workflows.">
          <Card>
            <CardContent className="py-3">
              <div className="flex items-center gap-4">
                {/* Search */}
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search emails..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>

                <Separator orientation="vertical" className="h-6" />

                {/* Type Filter */}
                <DesignTooltip comment="Type filter focuses on one category at a time.">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <Select value={filterType} onValueChange={(v: typeof filterType) => setFilterType(v)}>
                      <SelectTrigger className="h-9 w-[130px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="casework">Casework</SelectItem>
                        <SelectItem value="policy">Policy</SelectItem>
                        <SelectItem value="campaign">Campaign</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </DesignTooltip>

                {/* Confidence Filter */}
                <DesignTooltip comment="Confidence filter helps focus on items needing attention. 'Low' shows items requiring manual review.">
                  <Select value={filterConfidence} onValueChange={(v: typeof filterConfidence) => setFilterConfidence(v)}>
                    <SelectTrigger className="h-9 w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Confidence</SelectItem>
                      <SelectItem value="high">High (85%+)</SelectItem>
                      <SelectItem value="medium">Medium (60-84%)</SelectItem>
                      <SelectItem value="low">Low (&lt;60%)</SelectItem>
                    </SelectContent>
                  </Select>
                </DesignTooltip>

                <Separator orientation="vertical" className="h-6" />

                {/* Sort */}
                <DesignTooltip comment="Sort options: Smart (recommended) balances urgency, complexity, and confidence. Confidence (lowest first) for review-focused workflow.">
                  <div className="flex items-center gap-2">
                    <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                    <Select value={sortBy} onValueChange={(v: typeof sortBy) => setSortBy(v)}>
                      <SelectTrigger className="h-9 w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="smart">Smart Sort</SelectItem>
                        <SelectItem value="urgency">Most Urgent</SelectItem>
                        <SelectItem value="date">Most Recent</SelectItem>
                        <SelectItem value="confidence">Lowest Confidence</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </DesignTooltip>

                {/* Show Processed Toggle */}
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="showProcessed"
                    checked={showProcessed}
                    onCheckedChange={(c) => setShowProcessed(c === true)}
                  />
                  <label htmlFor="showProcessed" className="text-sm cursor-pointer">
                    Show processed
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>
        </DesignTooltip>

        {/* Selection Actions */}
        {selectedIds.size > 0 && (
          <DesignTooltip comment="Bulk action bar appears when items are selected. Apply same action to multiple emails at once.">
            <Card className="border-primary bg-primary/5">
              <CardContent className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant="default">{selectedIds.size} selected</Badge>
                    <Button variant="ghost" size="sm" onClick={deselectAll}>
                      <X className="mr-1 h-3 w-3" />
                      Clear
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Bulk Tag */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Tag className="mr-2 h-4 w-4" />
                          Add Tag
                          <ChevronDown className="ml-1 h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {availableTags.map(tag => (
                          <DropdownMenuItem key={tag.id}>
                            <div
                              className="w-3 h-3 rounded-full mr-2"
                              style={{ backgroundColor: tag.color }}
                            />
                            {tag.name}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Bulk Assign */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <User className="mr-2 h-4 w-4" />
                          Assign
                          <ChevronDown className="ml-1 h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {assignees.map(a => (
                          <DropdownMenuItem key={a.value}>
                            {a.label} <span className="text-muted-foreground ml-1">({a.sublabel})</span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Bulk Approve */}
                    <Button size="sm" onClick={processSelected}>
                      <Check className="mr-2 h-4 w-4" />
                      Approve {selectedIds.size}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </DesignTooltip>
        )}

        {/* Campaign Quick Actions */}
        {Object.keys(campaignGroups).length > 0 && filterType !== 'casework' && filterType !== 'policy' && (
          <DesignTooltip comment="Campaign summary cards allow one-click approval of entire campaigns. Shows count and constituent breakdown.">
            <div className="flex gap-3 flex-wrap">
              {Object.entries(campaignGroups).map(([name, groupEmails]) => (
                <Card key={name} className="flex-1 min-w-[250px] max-w-[350px] border-blue-200 bg-blue-50/50">
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Flag className="h-4 w-4 text-blue-600" />
                        <span className="font-medium text-sm">{name}</span>
                        <Badge variant="secondary">{groupEmails.length}</Badge>
                      </div>
                      <Button size="sm" className="h-7" onClick={() => processCampaign(name)}>
                        <Check className="mr-1 h-3 w-3" />
                        Approve All
                      </Button>
                    </div>
                    <div className="flex gap-2 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {groupEmails.filter(e => e.constituentStatus === 'matched').length} matched
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {groupEmails.filter(e => e.constituentStatus === 'new').length} new
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </DesignTooltip>
        )}

        {/* Main Table */}
        <DesignTooltip comment="Main table with inline editing. Each row is a self-contained triage unit. Click fields to edit directly.">
          <Card>
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="w-[40px]">
                      <Checkbox
                        checked={selectedIds.size === filteredEmails.filter(e => !e.processed).length && selectedIds.size > 0}
                        onCheckedChange={(c) => c ? selectAll() : deselectAll()}
                      />
                    </TableHead>
                    <TableHead className="w-[60px]">AI</TableHead>
                    <TableHead className="w-[200px]">From</TableHead>
                    <TableHead>Subject / Preview</TableHead>
                    <TableHead className="w-[100px]">Type</TableHead>
                    <TableHead className="w-[140px]">Tags</TableHead>
                    <TableHead className="w-[130px]">Assignee</TableHead>
                    <TableHead className="w-[130px]">Constituent</TableHead>
                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmails.map((email) => {
                    const isExpanded = expandedEmail === email.id;
                    const isSelected = selectedIds.has(email.id);

                    return (
                      <>
                        <TableRow
                          key={email.id}
                          className={`${email.processed ? 'opacity-50 bg-muted/30' : ''} ${isSelected ? 'bg-primary/5' : ''} ${isExpanded ? 'border-b-0' : ''}`}
                        >
                          <TableCell>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelection(email.id)}
                              disabled={email.processed}
                            />
                          </TableCell>

                          {/* Confidence */}
                          <TableCell>
                            <DesignTooltip comment={`AI confidence: ${Math.round(email.classificationConfidence * 100)}% - ${email.classificationReasoning}`}>
                              <div className="flex items-center gap-1">
                                <ConfidencePill confidence={email.classificationConfidence} />
                              </div>
                            </DesignTooltip>
                          </TableCell>

                          {/* From */}
                          <TableCell>
                            <div className="font-medium text-sm truncate">{email.fromName}</div>
                            <div className="text-xs text-muted-foreground truncate">{email.fromEmail}</div>
                          </TableCell>

                          {/* Subject */}
                          <TableCell>
                            <div
                              className="cursor-pointer hover:text-primary"
                              onClick={() => setExpandedEmail(isExpanded ? null : email.id)}
                            >
                              <div className="font-medium text-sm truncate flex items-center gap-1">
                                {email.subject}
                                {email.existingCaseRef && (
                                  <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 ml-1">
                                    <FileText className="h-3 w-3 mr-1" />
                                    {email.existingCaseRef}
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground truncate max-w-[300px]">
                                {email.snippet}
                              </div>
                            </div>
                          </TableCell>

                          {/* Type */}
                          <TableCell>
                            <DesignTooltip comment="Click to change email type. Casework creates a case, policy goes to policy queue, campaign links to campaign.">
                              <InlineSelect
                                value={email.emailType}
                                options={[
                                  { value: 'casework', label: 'Casework' },
                                  { value: 'policy', label: 'Policy' },
                                  { value: 'campaign', label: 'Campaign' },
                                  { value: 'spam', label: 'Spam' },
                                ]}
                                onChange={(v) => updateEmailField(email.id, 'emailType', v)}
                              />
                            </DesignTooltip>
                          </TableCell>

                          {/* Tags */}
                          <TableCell>
                            <DesignTooltip comment="Tags with confidence indicators. Click to add/remove. AI-suggested tags shown with checkmarks.">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div className="flex flex-wrap gap-1 cursor-pointer hover:bg-muted/50 p-1 rounded">
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
                                    {email.suggestedTags.length > 2 && (
                                      <Badge variant="outline" className="text-xs">+{email.suggestedTags.length - 2}</Badge>
                                    )}
                                    {email.suggestedTags.length === 0 && (
                                      <span className="text-xs text-muted-foreground">+ Add</span>
                                    )}
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-48 p-2">
                                  <div className="space-y-1">
                                    {availableTags.map(tag => {
                                      const isSelected = email.suggestedTags.some(t => t.id === tag.id);
                                      return (
                                        <div
                                          key={tag.id}
                                          className={`flex items-center gap-2 p-1.5 rounded cursor-pointer hover:bg-muted ${isSelected ? 'bg-muted' : ''}`}
                                        >
                                          <div
                                            className="w-3 h-3 rounded-full"
                                            style={{ backgroundColor: tag.color }}
                                          />
                                          <span className="text-sm flex-1">{tag.name}</span>
                                          {isSelected && <Check className="h-3 w-3" />}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </DesignTooltip>
                          </TableCell>

                          {/* Assignee */}
                          <TableCell>
                            <DesignTooltip comment={`Suggested: ${email.suggestedAssignee.name} - ${email.suggestedAssignee.reason}`}>
                              <InlineSelect
                                value={email.suggestedAssignee.id}
                                options={[
                                  { value: email.suggestedAssignee.id, label: email.suggestedAssignee.name, sublabel: 'Suggested' },
                                  ...email.alternativeAssignees.map(a => ({ value: a.id, label: a.name, sublabel: a.reason })),
                                ]}
                                onChange={(v) => updateEmailField(email.id, 'assignee', v)}
                              />
                            </DesignTooltip>
                          </TableCell>

                          {/* Constituent */}
                          <TableCell>
                            <DesignTooltip comment="Constituent matching status. Green = exact match, yellow = needs verification, gray = will create new.">
                              {email.constituentStatus === 'matched' ? (
                                <Badge variant="secondary" className="bg-green-100 text-green-700 cursor-pointer">
                                  <User className="mr-1 h-3 w-3" />
                                  {email.constituentName}
                                </Badge>
                              ) : email.constituentStatus === 'fuzzy' || email.constituentStatus === 'multiple' ? (
                                <InlineSelect
                                  value=""
                                  options={[
                                    ...(email.alternativeConstituents || []).map(c => ({ value: c.id, label: c.name, sublabel: c.reason })),
                                    { value: 'new', label: '+ Create new' },
                                  ]}
                                  onChange={(v) => updateEmailField(email.id, 'constituent', v)}
                                  placeholder={email.constituentName || 'Select...'}
                                />
                              ) : (
                                <Button variant="outline" size="sm" className="h-7 text-xs">
                                  <User className="mr-1 h-3 w-3" />
                                  Create
                                </Button>
                              )}
                            </DesignTooltip>
                          </TableCell>

                          {/* Actions */}
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {email.processed ? (
                                <Badge className="bg-green-600">
                                  <CheckCircle2 className="mr-1 h-3 w-3" />
                                  Done
                                </Badge>
                              ) : (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={() => setExpandedEmail(isExpanded ? null : email.id)}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="h-7"
                                    onClick={() => processEmail(email.id)}
                                  >
                                    <Check className="mr-1 h-3 w-3" />
                                    OK
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* Expanded Row */}
                        {isExpanded && (
                          <TableRow key={`${email.id}-expanded`} className="bg-muted/30">
                            <TableCell colSpan={9}>
                              <DesignTooltip comment="Expanded view shows full email body, AI reasoning, and case linking options. For complex cases requiring more context.">
                                <div className="p-4 space-y-4">
                                  {/* AI Analysis */}
                                  <div className="flex items-start gap-3 p-3 rounded-lg bg-purple-50 border border-purple-200">
                                    <Sparkles className="h-5 w-5 text-purple-600 shrink-0 mt-0.5" />
                                    <div>
                                      <div className="font-medium text-sm text-purple-800">AI Analysis</div>
                                      <div className="text-sm text-purple-700">{email.classificationReasoning}</div>
                                      <div className="flex gap-4 mt-2 text-xs text-purple-600">
                                        <span>Urgency: {email.urgencyScore}/100</span>
                                        <span>Complexity: {email.complexityScore}/100</span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Email Body */}
                                  <div className="rounded-lg border p-4 bg-white">
                                    <div className="text-sm whitespace-pre-wrap">{email.body}</div>
                                  </div>

                                  {/* Case Linking */}
                                  {email.existingCaseRef && (
                                    <div className="flex items-center gap-4 p-3 rounded-lg bg-yellow-50 border border-yellow-200">
                                      <AlertTriangle className="h-5 w-5 text-yellow-600" />
                                      <div className="flex-1">
                                        <div className="font-medium text-sm">Possible existing case match</div>
                                        <div className="text-sm text-muted-foreground">
                                          {email.existingCaseRef}: {email.existingCaseTitle}
                                        </div>
                                      </div>
                                      <Select defaultValue={email.existingCaseRef}>
                                        <SelectTrigger className="w-[200px]">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value={email.existingCaseRef}>
                                            {email.existingCaseRef} (suggested)
                                          </SelectItem>
                                          {email.alternativeCases?.map(c => (
                                            <SelectItem key={c.ref} value={c.ref}>
                                              {c.ref} ({Math.round(c.confidence * 100)}%)
                                            </SelectItem>
                                          ))}
                                          <SelectItem value="new">+ Create new case</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  )}

                                  {/* Actions */}
                                  <div className="flex justify-end gap-2">
                                    <Button variant="outline" onClick={() => setExpandedEmail(null)}>
                                      Collapse
                                    </Button>
                                    <Button variant="outline">
                                      <RefreshCw className="mr-2 h-4 w-4" />
                                      Re-analyze
                                    </Button>
                                    {!email.processed && (
                                      <Button onClick={() => processEmail(email.id)}>
                                        <Check className="mr-2 h-4 w-4" />
                                        Approve & Process
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </DesignTooltip>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          </Card>
        </DesignTooltip>

        {/* Empty State */}
        {filteredEmails.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold">All caught up!</h3>
              <p className="text-muted-foreground">No emails match your current filters.</p>
              <Button variant="outline" className="mt-4" onClick={() => {
                setFilterType('all');
                setFilterConfidence('all');
                setSearchQuery('');
              }}>
                Clear Filters
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </TooltipProvider>
  );
}
