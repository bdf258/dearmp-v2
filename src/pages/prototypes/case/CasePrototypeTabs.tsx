import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ArrowLeft,
  User,
  Building2,
  Mail,
  Phone,
  MapPin,
  Clock,
  Tag,
  FileText,
  Activity,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Send,
  Paperclip,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Lightbulb,
} from 'lucide-react';

// Hardcoded demo data
const DEMO_CASE = {
  id: 'case-001',
  reference: 'CW-2024-00847',
  title: 'Council Tax Rebate Issue - Disability Exemption',
  status: 'open',
  priority: 'high',
  createdAt: '2024-12-10T09:30:00Z',
  updatedAt: '2024-12-16T14:22:00Z',
  description: 'Constituent is disputing the council tax assessment for their property. They believe they should qualify for a disability exemption but their application was rejected.',
  assignee: {
    id: 'staff-001',
    name: 'Sarah Mitchell',
    role: 'Senior Caseworker',
  },
  tags: ['Council Tax', 'Disability', 'Appeal', 'Urgent'],
};

const DEMO_CONSTITUENT = {
  id: 'const-001',
  name: 'Margaret Thompson',
  email: 'margaret.thompson@email.com',
  phone: '07700 900123',
  address: '42 Oak Street, Westminster, London SW1A 1AA',
  isConfirmed: true,
  role: 'Primary Constituent',
};

const DEMO_PARTIES = [
  {
    id: 'party-001',
    name: 'John Thompson',
    email: 'john.thompson@email.com',
    relationship: 'Spouse',
    type: 'individual',
  },
  {
    id: 'party-002',
    name: 'Westminster City Council',
    email: 'council.tax@westminster.gov.uk',
    relationship: 'Responding Authority',
    type: 'organization',
  },
  {
    id: 'party-003',
    name: 'Citizens Advice Bureau',
    email: 'advice@cab.org.uk',
    relationship: 'Support Organisation',
    type: 'organization',
  },
];

const DEMO_EMAILS = [
  {
    id: 'email-001',
    subject: 'Council Tax Rebate - Application Rejected',
    from: 'margaret.thompson@email.com',
    fromName: 'Margaret Thompson',
    to: 'mp@parliament.uk',
    date: '2024-12-10T09:30:00Z',
    preview: 'Dear MP, I am writing to you regarding my council tax situation...',
    body: `Dear MP,

I am writing to you regarding my council tax situation. I have recently had my application for a disability exemption rejected by Westminster City Council.

I have been a resident at my current address for 15 years and was diagnosed with MS three years ago. My condition has significantly worsened over the past year, and I now require a wheelchair for mobility.

Despite providing all the requested medical documentation, my application was rejected without a clear explanation. The council has simply stated that I "do not meet the criteria" but has not explained which criteria I have failed to meet.

I am on a fixed pension income and the council tax bill is causing significant financial hardship. I would be most grateful if you could look into this matter on my behalf.

Kind regards,
Margaret Thompson`,
    direction: 'inbound',
    isRead: true,
  },
  {
    id: 'email-002',
    subject: 'RE: Council Tax Rebate - Application Rejected',
    from: 'mp@parliament.uk',
    fromName: 'Office of the MP',
    to: 'margaret.thompson@email.com',
    date: '2024-12-11T11:15:00Z',
    preview: 'Dear Mrs Thompson, Thank you for contacting me about your council tax...',
    body: `Dear Mrs Thompson,

Thank you for contacting me about your council tax situation. I am sorry to hear about the difficulties you have been experiencing.

I have asked my casework team to look into this matter urgently. We will be contacting Westminster City Council on your behalf to request a full explanation of why your application was rejected.

In the meantime, I would recommend that you do not make any further council tax payments until this matter is resolved, as you may be entitled to a refund if your appeal is successful.

My office will be in touch with an update within the next 7 days.

Best wishes,
[MP Name]
Member of Parliament`,
    direction: 'outbound',
    isRead: true,
  },
  {
    id: 'email-003',
    subject: 'RE: Council Tax Rebate - Update from Council',
    from: 'council.tax@westminster.gov.uk',
    fromName: 'Westminster City Council',
    to: 'mp@parliament.uk',
    date: '2024-12-14T16:45:00Z',
    preview: 'Dear Office of the MP, Thank you for your enquiry regarding Mrs Thompson...',
    body: `Dear Office of the MP,

Thank you for your enquiry regarding Mrs Margaret Thompson (Account Reference: CT-8847291).

We can confirm that Mrs Thompson's application for a disability exemption was reviewed on 5th December 2024. The application was rejected as the medical evidence provided did not include a formal assessment from an occupational therapist.

We would encourage Mrs Thompson to obtain this assessment and resubmit her application. We can also offer a payment plan to spread the current liability over the remaining months of the financial year.

Please let us know if you require any further information.

Yours sincerely,
Council Tax Department
Westminster City Council`,
    direction: 'inbound',
    isRead: true,
  },
];

const DEMO_RESEARCH = {
  summary: `Based on the case details, Margaret Thompson appears to have a strong case for the disability exemption under Class U of the Council Tax (Exempt Dwellings) Order 1992, as amended.`,
  keyPoints: [
    'The constituent has MS and uses a wheelchair - this typically qualifies under severe mental impairment criteria if certified by a GP',
    'The council has rejected the application citing lack of occupational therapist assessment - this is not always a mandatory requirement',
    'Similar cases in 2023 resulted in successful appeals in 73% of cases when the MP\'s office intervened',
    'Westminster Council has a dedicated appeals process that bypasses the standard rejection',
  ],
  suggestedActions: [
    'Request constituent obtains GP letter confirming severe disability',
    'Write to council requesting formal appeal hearing',
    'Consider referencing case law: R (on the application of Cornwall Council) v Sec of State 2015',
    'Contact Disability Rights UK for additional support documentation',
  ],
  relatedPolicies: [
    { name: 'Council Tax Reduction Scheme 2024', url: '#' },
    { name: 'Local Government Finance Act 1992', url: '#' },
    { name: 'Disability Exemption Guidelines', url: '#' },
  ],
};

const DEMO_STATS = {
  daysOpen: 7,
  totalEmails: 3,
  lastContact: '2 days ago',
  responseTime: '1.2 days avg',
  similar_cases: 12,
};

const DEMO_ACTIVITY = [
  { date: '2024-12-16T14:22:00Z', action: 'Case updated', user: 'Sarah Mitchell', detail: 'Added research notes' },
  { date: '2024-12-14T16:45:00Z', action: 'Email received', user: 'System', detail: 'From Westminster City Council' },
  { date: '2024-12-11T11:15:00Z', action: 'Email sent', user: 'Sarah Mitchell', detail: 'Initial response to constituent' },
  { date: '2024-12-10T10:00:00Z', action: 'Case assigned', user: 'Admin', detail: 'Assigned to Sarah Mitchell' },
  { date: '2024-12-10T09:30:00Z', action: 'Case created', user: 'System', detail: 'Created from inbound email' },
];

type TabType = 'overview' | 'communications' | 'people' | 'research' | 'activity';

export default function CasePrototypeTabs() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [expandedEmails, setExpandedEmails] = useState<Set<string>>(new Set(['email-003']));

  const toggleEmail = (emailId: string) => {
    const newExpanded = new Set(expandedEmails);
    if (newExpanded.has(emailId)) {
      newExpanded.delete(emailId);
    } else {
      newExpanded.add(emailId);
    }
    setExpandedEmails(newExpanded);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const tabs: { id: TabType; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'overview', label: 'Overview', icon: <FileText className="h-4 w-4" /> },
    { id: 'communications', label: 'Communications', icon: <Mail className="h-4 w-4" />, count: DEMO_EMAILS.length },
    { id: 'people', label: 'People & Orgs', icon: <User className="h-4 w-4" />, count: DEMO_PARTIES.length + 1 },
    { id: 'research', label: 'Research', icon: <Lightbulb className="h-4 w-4" /> },
    { id: 'activity', label: 'Activity', icon: <Activity className="h-4 w-4" /> },
  ];

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-6">
        {/* Header */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold tracking-tight">{DEMO_CASE.title}</h1>
                  <Badge variant="outline" className="font-mono text-xs">
                    #{DEMO_CASE.reference}
                  </Badge>
                </div>
                <p className="text-muted-foreground text-sm mt-1">
                  Opened {formatDate(DEMO_CASE.createdAt)} · Assigned to {DEMO_CASE.assignee.name}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">Open</Badge>
                <Badge variant="destructive">High Priority</Badge>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-md">
            <p className="font-semibold">Case Header</p>
            <p className="text-xs mt-1">Shows the most critical information at a glance: title, reference number, who it's assigned to, and status. Users can immediately understand the case context.</p>
          </TooltipContent>
        </Tooltip>

        {/* Tab Navigation */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="border-b">
              <nav className="flex gap-1 -mb-px">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                    {tab.count !== undefined && (
                      <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                        {tab.count}
                      </Badge>
                    )}
                  </button>
                ))}
              </nav>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-md">
            <p className="font-semibold">Tab Navigation</p>
            <p className="text-xs mt-1">Familiar pattern like browser tabs. Each tab focuses on one type of information, reducing cognitive load. Counts help users see at-a-glance how much content each section has.</p>
          </TooltipContent>
        </Tooltip>

        {/* Tab Content */}
        <div className="min-h-[600px]">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Left Column - Key Info */}
              <div className="lg:col-span-2 space-y-6">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Case Summary</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm leading-relaxed">{DEMO_CASE.description}</p>
                        <div className="flex flex-wrap gap-2 mt-4">
                          {DEMO_CASE.tags.map((tag) => (
                            <Badge key={tag} variant="secondary">
                              <Tag className="h-3 w-3 mr-1" />
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-md">
                    <p className="font-semibold">Case Summary Card</p>
                    <p className="text-xs mt-1">Brief description of the case with tags for quick categorisation. Tags help with searching and filtering cases later.</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <User className="h-5 w-5" />
                          Primary Constituent
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-start justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-lg">{DEMO_CONSTITUENT.name}</span>
                              {DEMO_CONSTITUENT.isConfirmed && (
                                <Badge className="bg-green-500 hover:bg-green-500 text-white text-xs">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Confirmed
                                </Badge>
                              )}
                            </div>
                            <div className="grid gap-2 text-sm">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Mail className="h-4 w-4" />
                                <a href={`mailto:${DEMO_CONSTITUENT.email}`} className="hover:underline">
                                  {DEMO_CONSTITUENT.email}
                                </a>
                              </div>
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Phone className="h-4 w-4" />
                                <a href={`tel:${DEMO_CONSTITUENT.phone}`} className="hover:underline">
                                  {DEMO_CONSTITUENT.phone}
                                </a>
                              </div>
                              <div className="flex items-start gap-2 text-muted-foreground">
                                <MapPin className="h-4 w-4 mt-0.5" />
                                <span>{DEMO_CONSTITUENT.address}</span>
                              </div>
                            </div>
                          </div>
                          <Button variant="outline" size="sm">
                            <Mail className="h-4 w-4 mr-2" />
                            Contact
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-md">
                    <p className="font-semibold">Primary Constituent Card</p>
                    <p className="text-xs mt-1">The main person raising the case. Prominent display of contact details so caseworkers can quickly reach out. 'Confirmed' badge shows this is a verified constituent (has address in constituency).</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Mail className="h-5 w-5" />
                          Latest Communication
                        </CardTitle>
                        <CardDescription>
                          Most recent email in the thread
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="rounded-lg border p-4 bg-muted/30">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-medium">{DEMO_EMAILS[2].subject}</p>
                              <p className="text-sm text-muted-foreground">
                                From: {DEMO_EMAILS[2].fromName}
                              </p>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {formatDateTime(DEMO_EMAILS[2].date)}
                            </span>
                          </div>
                          <p className="text-sm line-clamp-3">{DEMO_EMAILS[2].preview}</p>
                          <Button
                            variant="link"
                            className="p-0 h-auto mt-2"
                            onClick={() => setActiveTab('communications')}
                          >
                            View full thread →
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-md">
                    <p className="font-semibold">Latest Communication Preview</p>
                    <p className="text-xs mt-1">Shows the most recent email without leaving the overview. Users can quickly see what's happened recently and click through to read more.</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              {/* Right Column - Stats & Quick Info */}
              <div className="space-y-6">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <BarChart3 className="h-5 w-5" />
                          Case Statistics
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Days Open</span>
                          <span className="font-semibold">{DEMO_STATS.daysOpen}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Total Emails</span>
                          <span className="font-semibold">{DEMO_STATS.totalEmails}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Last Contact</span>
                          <span className="font-semibold">{DEMO_STATS.lastContact}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Avg Response Time</span>
                          <span className="font-semibold">{DEMO_STATS.responseTime}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Similar Cases</span>
                          <span className="font-semibold">{DEMO_STATS.similar_cases}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-md">
                    <p className="font-semibold">Case Statistics</p>
                    <p className="text-xs mt-1">Quick metrics help caseworkers understand case urgency. 'Similar Cases' links to precedents that might inform resolution strategy.</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Clock className="h-5 w-5" />
                          Timeline
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3 text-sm">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-green-500" />
                            <span className="text-muted-foreground">Created:</span>
                            <span>{formatDate(DEMO_CASE.createdAt)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-blue-500" />
                            <span className="text-muted-foreground">Last Activity:</span>
                            <span>{formatDate(DEMO_CASE.updatedAt)}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-md">
                    <p className="font-semibold">Timeline Summary</p>
                    <p className="text-xs mt-1">At-a-glance view of case timeline. Helps caseworkers understand case age and recency of activity without scrolling through full history.</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2 text-amber-700 dark:text-amber-400">
                          <Lightbulb className="h-5 w-5" />
                          AI Insight
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-amber-800 dark:text-amber-300">
                          This case has a <strong>73% success rate</strong> based on similar appeals. Consider requesting GP documentation.
                        </p>
                        <Button
                          variant="link"
                          className="p-0 h-auto mt-2 text-amber-700 dark:text-amber-400"
                          onClick={() => setActiveTab('research')}
                        >
                          View full research →
                        </Button>
                      </CardContent>
                    </Card>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-md">
                    <p className="font-semibold">AI Research Insight</p>
                    <p className="text-xs mt-1">Highlighted card draws attention to AI-generated recommendations. Warm colour distinguishes it from regular content. Quick summary with link to detailed research.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          )}

          {/* Communications Tab */}
          {activeTab === 'communications' && (
            <div className="space-y-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold">Email Thread</h2>
                      <p className="text-sm text-muted-foreground">
                        {DEMO_EMAILS.length} messages in this conversation
                      </p>
                    </div>
                    <Button>
                      <Send className="h-4 w-4 mr-2" />
                      Compose Reply
                    </Button>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-md">
                  <p className="font-semibold">Communications Header</p>
                  <p className="text-xs mt-1">Clear message count and prominent 'Compose Reply' button. Action-oriented design for quick responses.</p>
                </TooltipContent>
              </Tooltip>

              <ScrollArea className="h-[550px]">
                <div className="space-y-3 pr-4">
                  {DEMO_EMAILS.map((email) => (
                    <Tooltip key={email.id}>
                      <TooltipTrigger asChild>
                        <Card className={email.direction === 'outbound' ? 'border-l-4 border-l-primary' : ''}>
                          <CardHeader
                            className="cursor-pointer py-3"
                            onClick={() => toggleEmail(email.id)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3">
                                {expandedEmails.has(email.id) ? (
                                  <ChevronDown className="h-5 w-5 mt-0.5 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-5 w-5 mt-0.5 text-muted-foreground" />
                                )}
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold">{email.fromName}</span>
                                    {email.direction === 'outbound' && (
                                      <Badge variant="outline" className="text-xs">Sent</Badge>
                                    )}
                                  </div>
                                  <p className="text-sm font-medium text-muted-foreground">
                                    {email.subject}
                                  </p>
                                  {!expandedEmails.has(email.id) && (
                                    <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                                      {email.preview}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {formatDateTime(email.date)}
                              </span>
                            </div>
                          </CardHeader>
                          {expandedEmails.has(email.id) && (
                            <CardContent className="pt-0">
                              <div className="pl-8">
                                <div className="text-xs text-muted-foreground mb-3 space-y-1">
                                  <p>From: {email.from}</p>
                                  <p>To: {email.to}</p>
                                </div>
                                <Separator className="my-3" />
                                <div className="prose prose-sm dark:prose-invert max-w-none">
                                  <pre className="whitespace-pre-wrap font-sans text-sm">
                                    {email.body}
                                  </pre>
                                </div>
                                <div className="flex gap-2 mt-4">
                                  <Button size="sm" variant="outline">
                                    <Send className="h-3 w-3 mr-2" />
                                    Reply
                                  </Button>
                                  <Button size="sm" variant="ghost">
                                    <Paperclip className="h-3 w-3 mr-2" />
                                    Attachments (0)
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          )}
                        </Card>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-md">
                        <p className="font-semibold">Expandable Email</p>
                        <p className="text-xs mt-1">Click to expand/collapse. Outbound emails have a coloured left border to distinguish them from inbound. Preview text shows when collapsed.</p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* People & Organisations Tab */}
          {activeTab === 'people' && (
            <div className="grid gap-6 lg:grid-cols-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5" />
                        Primary Constituent
                      </CardTitle>
                      <CardDescription>The person who raised this case</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-center gap-4">
                          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-8 w-8 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">{DEMO_CONSTITUENT.name}</h3>
                            <p className="text-sm text-muted-foreground">{DEMO_CONSTITUENT.role}</p>
                            {DEMO_CONSTITUENT.isConfirmed && (
                              <Badge className="mt-1 bg-green-500 hover:bg-green-500 text-white text-xs">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Verified Constituent
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Separator />
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-xs text-muted-foreground">Email</p>
                              <a href={`mailto:${DEMO_CONSTITUENT.email}`} className="text-sm hover:underline">
                                {DEMO_CONSTITUENT.email}
                              </a>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-xs text-muted-foreground">Phone</p>
                              <a href={`tel:${DEMO_CONSTITUENT.phone}`} className="text-sm hover:underline">
                                {DEMO_CONSTITUENT.phone}
                              </a>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div>
                              <p className="text-xs text-muted-foreground">Address</p>
                              <p className="text-sm">{DEMO_CONSTITUENT.address}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-md">
                  <p className="font-semibold">Primary Constituent Detail</p>
                  <p className="text-xs mt-1">Full details of the main constituent. Avatar placeholder provides visual anchor. Contact details are clickable for quick actions. 'Verified' badge indicates confirmed constituency address.</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5" />
                        Related Parties
                      </CardTitle>
                      <CardDescription>Other people and organisations involved</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {DEMO_PARTIES.map((party) => (
                          <div key={party.id} className="flex items-start gap-4 p-3 rounded-lg border">
                            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                              {party.type === 'organization' ? (
                                <Building2 className="h-5 w-5 text-muted-foreground" />
                              ) : (
                                <User className="h-5 w-5 text-muted-foreground" />
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <h4 className="font-medium">{party.name}</h4>
                                <Badge variant="outline" className="text-xs">
                                  {party.relationship}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{party.email}</p>
                            </div>
                          </div>
                        ))}
                        <Button variant="outline" className="w-full">
                          <User className="h-4 w-4 mr-2" />
                          Add Related Party
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-md">
                  <p className="font-semibold">Related Parties List</p>
                  <p className="text-xs mt-1">Shows all other parties involved in the case. Relationship badge explains their role. Different icons distinguish individuals from organisations.</p>
                </TooltipContent>
              </Tooltip>
            </div>
          )}

          {/* Research Tab */}
          {activeTab === 'research' && (
            <div className="space-y-6">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                        <Lightbulb className="h-5 w-5" />
                        AI Research Summary
                      </CardTitle>
                      <CardDescription className="text-amber-600 dark:text-amber-500">
                        Automatically generated from case details and similar cases
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
                        {DEMO_RESEARCH.summary}
                      </p>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-md">
                  <p className="font-semibold">AI Summary Card</p>
                  <p className="text-xs mt-1">Prominent display of AI-generated insight. Warm colour scheme signals this is system-generated rather than user-entered content. Brief summary for quick understanding.</p>
                </TooltipContent>
              </Tooltip>

              <div className="grid gap-6 lg:grid-cols-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <AlertCircle className="h-5 w-5" />
                          Key Points
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-3">
                          {DEMO_RESEARCH.keyPoints.map((point, index) => (
                            <li key={index} className="flex items-start gap-3">
                              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="text-xs font-semibold text-primary">{index + 1}</span>
                              </div>
                              <p className="text-sm leading-relaxed">{point}</p>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-md">
                    <p className="font-semibold">Key Points List</p>
                    <p className="text-xs mt-1">Numbered list of important findings. Easy to scan and reference in conversations. Each point is substantive and actionable.</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <CheckCircle2 className="h-5 w-5" />
                          Suggested Actions
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-3">
                          {DEMO_RESEARCH.suggestedActions.map((action, index) => (
                            <li key={index} className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                className="mt-1 h-4 w-4 rounded border-gray-300"
                              />
                              <p className="text-sm leading-relaxed">{action}</p>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-md">
                    <p className="font-semibold">Suggested Actions</p>
                    <p className="text-xs mt-1">Actionable recommendations with checkboxes. Caseworkers can tick off completed actions. Turns research into a todo list.</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Related Policies & Legislation
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-3 sm:grid-cols-3">
                        {DEMO_RESEARCH.relatedPolicies.map((policy) => (
                          <a
                            key={policy.name}
                            href={policy.url}
                            className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted transition-colors"
                          >
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">{policy.name}</span>
                            <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto" />
                          </a>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-md">
                  <p className="font-semibold">Related Resources</p>
                  <p className="text-xs mt-1">Quick links to relevant policies and legislation. External link icon indicates these open in new tabs. Helps caseworkers find reference material.</p>
                </TooltipContent>
              </Tooltip>
            </div>
          )}

          {/* Activity Tab */}
          {activeTab === 'activity' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      Case Activity Log
                    </CardTitle>
                    <CardDescription>Complete history of actions on this case</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="relative">
                      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
                      <div className="space-y-6">
                        {DEMO_ACTIVITY.map((activity, index) => (
                          <div key={index} className="relative flex gap-4 pl-10">
                            <div className="absolute left-2.5 h-3 w-3 rounded-full bg-primary border-2 border-background" />
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <p className="font-medium text-sm">{activity.action}</p>
                                <span className="text-xs text-muted-foreground">
                                  {formatDateTime(activity.date)}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground">{activity.detail}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                by {activity.user}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-md">
                <p className="font-semibold">Activity Timeline</p>
                <p className="text-xs mt-1">Vertical timeline showing all case actions. Visual line connects events chronologically. Shows who did what and when for full audit trail.</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
