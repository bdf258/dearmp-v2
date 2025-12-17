import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
  Calendar,
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
  Eye,
  EyeOff,
  MessageSquare,
} from 'lucide-react';

// Hardcoded demo data (same as tabs prototype)
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

export default function CasePrototypeColumns() {
  const [isDetailedMode, setIsDetailedMode] = useState(true);
  const [expandedEmails, setExpandedEmails] = useState<Set<string>>(new Set(['email-003']));
  const [showResearch, setShowResearch] = useState(false);

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

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-4">
        {/* Compact Header with Mode Toggle */}
        <div className="flex items-center justify-between">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-4">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold">{DEMO_CASE.title}</h1>
                    <Badge variant="outline" className="font-mono text-xs">
                      #{DEMO_CASE.reference}
                    </Badge>
                  </div>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-md">
              <p className="font-semibold">Compact Header</p>
              <p className="text-xs mt-1">Smaller header than tabs prototype to maximise content space. Essential info only - title and reference number.</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5">
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="mode-toggle" className="text-sm cursor-pointer">
                    Simple
                  </Label>
                  <Switch
                    id="mode-toggle"
                    checked={isDetailedMode}
                    onCheckedChange={setIsDetailedMode}
                  />
                  <Label htmlFor="mode-toggle" className="text-sm cursor-pointer">
                    Detailed
                  </Label>
                  <Eye className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Open</Badge>
                  <Badge variant="destructive">High Priority</Badge>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-md">
              <p className="font-semibold">Simple/Detailed Mode Toggle</p>
              <p className="text-xs mt-1">Key feature of this prototype. Users can switch between a simplified view (essential info only) and a detailed view (all information). Helps less experienced users avoid overwhelm.</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Two Column Layout */}
        <div className="grid gap-4 lg:grid-cols-4">
          {/* Left Sidebar - Always visible info */}
          <div className="lg:col-span-1 space-y-4">
            {/* Constituent Quick Card - Always visible */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Constituent
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="font-semibold">{DEMO_CONSTITUENT.name}</p>
                      {DEMO_CONSTITUENT.isConfirmed && (
                        <Badge className="mt-1 bg-green-500 hover:bg-green-500 text-white text-[10px]">
                          Verified
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-2 text-sm">
                      <a href={`mailto:${DEMO_CONSTITUENT.email}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                        <Mail className="h-3.5 w-3.5" />
                        <span className="truncate">{DEMO_CONSTITUENT.email}</span>
                      </a>
                      <a href={`tel:${DEMO_CONSTITUENT.phone}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                        <Phone className="h-3.5 w-3.5" />
                        {DEMO_CONSTITUENT.phone}
                      </a>
                      {isDetailedMode && (
                        <div className="flex items-start gap-2 text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5 mt-0.5" />
                          <span className="text-xs">{DEMO_CONSTITUENT.address}</span>
                        </div>
                      )}
                    </div>
                    <Button size="sm" className="w-full">
                      <Mail className="h-3.5 w-3.5 mr-2" />
                      Email
                    </Button>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-md">
                <p className="font-semibold">Constituent Quick Card</p>
                <p className="text-xs mt-1">Always visible regardless of mode. Name, contact details, and quick email action. Address only shows in detailed mode. This is the most important reference info during phone calls.</p>
              </TooltipContent>
            </Tooltip>

            {/* Assignee & Status - Always visible */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Card>
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Assignee</span>
                      <span className="text-sm font-medium">{DEMO_CASE.assignee.name}</span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Days Open</span>
                      <span className="text-sm font-medium">{DEMO_STATS.daysOpen}</span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Last Contact</span>
                      <span className="text-sm font-medium">{DEMO_STATS.lastContact}</span>
                    </div>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-md">
                <p className="font-semibold">Quick Stats Panel</p>
                <p className="text-xs mt-1">Key metrics always visible in sidebar. Shows who owns the case and how long it's been open. Critical for prioritisation decisions.</p>
              </TooltipContent>
            </Tooltip>

            {/* Tags - Only in detailed mode */}
            {isDetailedMode && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Tag className="h-4 w-4" />
                        Tags
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-1.5">
                        {DEMO_CASE.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-md">
                  <p className="font-semibold">Tags (Detailed Mode Only)</p>
                  <p className="text-xs mt-1">Tags help categorise and search for cases. Hidden in simple mode as they're not essential for immediate case work.</p>
                </TooltipContent>
              </Tooltip>
            )}

            {/* Related Parties - Only in detailed mode */}
            {isDetailedMode && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Related Parties ({DEMO_PARTIES.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {DEMO_PARTIES.map((party) => (
                          <div key={party.id} className="text-sm p-2 rounded bg-muted/50">
                            <div className="flex items-center gap-2">
                              {party.type === 'organization' ? (
                                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                              ) : (
                                <User className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                              <span className="font-medium truncate">{party.name}</span>
                            </div>
                            <p className="text-xs text-muted-foreground pl-5">{party.relationship}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-md">
                  <p className="font-semibold">Related Parties (Detailed Mode Only)</p>
                  <p className="text-xs mt-1">Other people and organisations involved in the case. Hidden in simple mode to reduce sidebar length. Full details accessible in main area.</p>
                </TooltipContent>
              </Tooltip>
            )}

            {/* Activity Summary - Only in detailed mode */}
            {isDetailedMode && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        Recent Activity
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {DEMO_ACTIVITY.slice(0, 3).map((activity, index) => (
                          <div key={index} className="text-xs">
                            <p className="font-medium">{activity.action}</p>
                            <p className="text-muted-foreground">{formatDate(activity.date)}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-md">
                  <p className="font-semibold">Recent Activity (Detailed Mode Only)</p>
                  <p className="text-xs mt-1">Quick view of last 3 actions. Full activity log available elsewhere. Helps caseworker understand recent history without scrolling.</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3 space-y-4">
            {/* Case Description - Collapsible in simple mode */}
            {(isDetailedMode || !showResearch) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Case Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {DEMO_CASE.description}
                      </p>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-md">
                  <p className="font-semibold">Case Summary</p>
                  <p className="text-xs mt-1">Brief description of what this case is about. Visible in both modes as it provides essential context.</p>
                </TooltipContent>
              </Tooltip>
            )}

            {/* AI Research Insight - Toggle visibility */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Card className={showResearch ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900" : ""}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className={`text-base flex items-center gap-2 ${showResearch ? 'text-amber-700 dark:text-amber-400' : ''}`}>
                        <Lightbulb className="h-5 w-5" />
                        AI Research
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowResearch(!showResearch)}
                      >
                        {showResearch ? 'Hide Details' : 'Show Details'}
                        {showResearch ? <ChevronDown className="h-4 w-4 ml-1" /> : <ChevronRight className="h-4 w-4 ml-1" />}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {!showResearch ? (
                      <p className="text-sm text-muted-foreground">
                        <strong>Quick insight:</strong> This case has a 73% success rate based on similar appeals. Click "Show Details" for full research.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
                          {DEMO_RESEARCH.summary}
                        </p>
                        <Separator className="bg-amber-200 dark:bg-amber-900" />
                        <div>
                          <h4 className="font-medium text-sm mb-2 text-amber-800 dark:text-amber-300">Key Points</h4>
                          <ul className="space-y-2">
                            {DEMO_RESEARCH.keyPoints.map((point, index) => (
                              <li key={index} className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
                                <span className="font-semibold text-amber-600 dark:text-amber-500">{index + 1}.</span>
                                <span>{point}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <Separator className="bg-amber-200 dark:bg-amber-900" />
                        <div>
                          <h4 className="font-medium text-sm mb-2 text-amber-800 dark:text-amber-300">Suggested Actions</h4>
                          <ul className="space-y-2">
                            {DEMO_RESEARCH.suggestedActions.map((action, index) => (
                              <li key={index} className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
                                <input type="checkbox" className="h-4 w-4 rounded" />
                                <span>{action}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-md">
                <p className="font-semibold">Expandable AI Research</p>
                <p className="text-xs mt-1">Shows brief insight by default, expands to full research on demand. Reduces visual clutter while keeping valuable AI insights accessible. Warm colours indicate AI-generated content.</p>
              </TooltipContent>
            </Tooltip>

            {/* Email Thread */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Mail className="h-5 w-5" />
                        Communications ({DEMO_EMAILS.length})
                      </CardTitle>
                      <Button size="sm">
                        <Send className="h-4 w-4 mr-2" />
                        Reply
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className={isDetailedMode ? "h-[400px]" : "h-[500px]"}>
                      <div className="space-y-3 pr-4">
                        {DEMO_EMAILS.map((email) => (
                          <div
                            key={email.id}
                            className={`rounded-lg border p-3 ${email.direction === 'outbound' ? 'border-l-4 border-l-primary bg-primary/5' : ''}`}
                          >
                            <div
                              className="cursor-pointer"
                              onClick={() => toggleEmail(email.id)}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2">
                                  {expandedEmails.has(email.id) ? (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                  )}
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-sm">{email.fromName}</span>
                                      {email.direction === 'outbound' && (
                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">Sent</Badge>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground">{email.subject}</p>
                                  </div>
                                </div>
                                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                  {formatDateTime(email.date)}
                                </span>
                              </div>
                              {!expandedEmails.has(email.id) && (
                                <p className="text-xs text-muted-foreground line-clamp-1 mt-1 ml-6">
                                  {email.preview}
                                </p>
                              )}
                            </div>
                            {expandedEmails.has(email.id) && (
                              <div className="mt-3 ml-6">
                                <div className="text-[10px] text-muted-foreground mb-2">
                                  <span>From: {email.from}</span>
                                  <span className="mx-2">•</span>
                                  <span>To: {email.to}</span>
                                </div>
                                <Separator className="my-2" />
                                <pre className="whitespace-pre-wrap font-sans text-sm">
                                  {email.body}
                                </pre>
                                <div className="flex gap-2 mt-3">
                                  <Button size="sm" variant="outline">
                                    <Send className="h-3 w-3 mr-1" />
                                    Reply
                                  </Button>
                                  <Button size="sm" variant="ghost">
                                    <Paperclip className="h-3 w-3 mr-1" />
                                    Attachments
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-md">
                <p className="font-semibold">Email Thread</p>
                <p className="text-xs mt-1">The main communication view. Emails expand on click. Outbound emails highlighted with left border and subtle background. Scroll area adjusts based on mode.</p>
              </TooltipContent>
            </Tooltip>

            {/* Internal Notes - Only in detailed mode */}
            {isDetailedMode && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <MessageSquare className="h-5 w-5" />
                          Internal Notes
                        </CardTitle>
                        <Button variant="outline" size="sm">
                          Add Note
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="p-3 rounded-lg bg-muted">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">Sarah Mitchell</span>
                            <span className="text-xs text-muted-foreground">16 Dec 2024, 14:22</span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Received response from council. They're requiring OT assessment which isn't always necessary. Researching similar cases to build argument.
                          </p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">Sarah Mitchell</span>
                            <span className="text-xs text-muted-foreground">11 Dec 2024, 11:30</span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Initial review complete. Constituent appears genuine and has strong case. Priority raised to High.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-md">
                  <p className="font-semibold">Internal Notes (Detailed Mode Only)</p>
                  <p className="text-xs mt-1">Staff-only notes for case coordination. Hidden in simple mode to reduce visual complexity. Important for handoffs between team members.</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
