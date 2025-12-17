import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
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
  Tag,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Send,
  Paperclip,
  CheckCircle2,
  Lightbulb,
  Expand,
  Minimize2,
  MessageSquare,
  History,
  Users,
  Bookmark,
} from 'lucide-react';

// Hardcoded demo data (same as other prototypes)
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

const DEMO_NOTES = [
  {
    id: 'note-001',
    user: 'Sarah Mitchell',
    date: '2024-12-16T14:22:00Z',
    content: 'Received response from council. They\'re requiring OT assessment which isn\'t always necessary. Researching similar cases to build argument.',
  },
  {
    id: 'note-002',
    user: 'Sarah Mitchell',
    date: '2024-12-11T11:30:00Z',
    content: 'Initial review complete. Constituent appears genuine and has strong case. Priority raised to High.',
  },
];

export default function CasePrototypeCards() {
  const [expandedEmails, setExpandedEmails] = useState<Set<string>>(new Set(['email-003']));
  const [openSections, setOpenSections] = useState<string[]>(['constituent', 'communications']);

  const toggleEmail = (emailId: string) => {
    const newExpanded = new Set(expandedEmails);
    if (newExpanded.has(emailId)) {
      newExpanded.delete(emailId);
    } else {
      newExpanded.add(emailId);
    }
    setExpandedEmails(newExpanded);
  };

  const expandAll = () => {
    setOpenSections(['constituent', 'parties', 'communications', 'research', 'notes', 'activity', 'stats']);
  };

  const collapseAll = () => {
    setOpenSections([]);
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
      <div className="space-y-4 max-w-4xl mx-auto">
        {/* Sticky Header */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="sticky top-0 z-10 bg-background pb-4 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button variant="outline" size="sm">
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-xl font-bold">{DEMO_CASE.title}</h1>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="font-mono text-xs">
                        #{DEMO_CASE.reference}
                      </Badge>
                      <Badge variant="outline">Open</Badge>
                      <Badge variant="destructive">High Priority</Badge>
                      <span className="text-xs text-muted-foreground">
                        · {DEMO_CASE.assignee.name}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={expandAll}>
                    <Expand className="h-4 w-4 mr-1" />
                    Expand All
                  </Button>
                  <Button variant="outline" size="sm" onClick={collapseAll}>
                    <Minimize2 className="h-4 w-4 mr-1" />
                    Collapse All
                  </Button>
                  <Button size="sm">
                    <Send className="h-4 w-4 mr-2" />
                    Reply
                  </Button>
                </div>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-md">
            <p className="font-semibold">Sticky Header</p>
            <p className="text-xs mt-1">Header stays visible while scrolling. Shows case identity, status, and assignee. 'Expand All' and 'Collapse All' controls give users power over information density. Reply button always accessible.</p>
          </TooltipContent>
        </Tooltip>

        {/* Case Summary - Always visible */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {DEMO_CASE.description}
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {DEMO_CASE.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      <Tag className="h-3 w-3 mr-1" />
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-md">
            <p className="font-semibold">Case Summary (Always Visible)</p>
            <p className="text-xs mt-1">Brief description and tags always shown outside accordion. Provides context without expanding anything. Essential for understanding the case at a glance.</p>
          </TooltipContent>
        </Tooltip>

        {/* Accordion Sections */}
        <Accordion
          type="multiple"
          value={openSections}
          onValueChange={setOpenSections}
          className="space-y-3"
        >
          {/* Primary Constituent */}
          <Tooltip>
            <TooltipTrigger asChild>
              <AccordionItem value="constituent" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div className="text-left">
                      <span className="font-semibold">{DEMO_CONSTITUENT.name}</span>
                      <p className="text-xs text-muted-foreground font-normal">Primary Constituent</p>
                    </div>
                    {DEMO_CONSTITUENT.isConfirmed && (
                      <Badge className="bg-green-500 hover:bg-green-500 text-white text-[10px]">
                        Verified
                      </Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid gap-4 sm:grid-cols-2 pt-2">
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
                    </div>
                    <div>
                      <div className="flex items-start gap-3">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">Address</p>
                          <p className="text-sm">{DEMO_CONSTITUENT.address}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button size="sm">
                      <Mail className="h-4 w-4 mr-2" />
                      Email
                    </Button>
                    <Button size="sm" variant="outline">
                      <Phone className="h-4 w-4 mr-2" />
                      Call
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-md">
              <p className="font-semibold">Constituent Accordion Section</p>
              <p className="text-xs mt-1">Name and verification status visible when collapsed. Expands to show full contact details. Quick action buttons for email and call. Most frequently needed information.</p>
            </TooltipContent>
          </Tooltip>

          {/* Related Parties */}
          <Tooltip>
            <TooltipTrigger asChild>
              <AccordionItem value="parties" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="text-left">
                      <span className="font-semibold">Related Parties</span>
                      <p className="text-xs text-muted-foreground font-normal">{DEMO_PARTIES.length} people & organisations</p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 pt-2">
                    {DEMO_PARTIES.map((party) => (
                      <div key={party.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-background flex items-center justify-center">
                            {party.type === 'organization' ? (
                              <Building2 className="h-5 w-5 text-muted-foreground" />
                            ) : (
                              <User className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{party.name}</p>
                            <p className="text-xs text-muted-foreground">{party.email}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">{party.relationship}</Badge>
                      </div>
                    ))}
                    <Button variant="outline" className="w-full mt-2">
                      <User className="h-4 w-4 mr-2" />
                      Add Party
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-md">
              <p className="font-semibold">Related Parties Section</p>
              <p className="text-xs mt-1">Count shown when collapsed so users know how many parties are involved. Each party shows their relationship to the case. Can add new parties from here.</p>
            </TooltipContent>
          </Tooltip>

          {/* Communications */}
          <Tooltip>
            <TooltipTrigger asChild>
              <AccordionItem value="communications" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
                      <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="text-left">
                      <span className="font-semibold">Communications</span>
                      <p className="text-xs text-muted-foreground font-normal">{DEMO_EMAILS.length} emails · Last: {DEMO_STATS.lastContact}</p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 pt-2">
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
                              <span className="mx-2">·</span>
                              <span>To: {email.to}</span>
                            </div>
                            <Separator className="my-2" />
                            <pre className="whitespace-pre-wrap font-sans text-sm bg-muted/50 p-3 rounded">
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
                </AccordionContent>
              </AccordionItem>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-md">
              <p className="font-semibold">Communications Section</p>
              <p className="text-xs mt-1">Blue icon distinguishes from other sections. Shows email count and last contact when collapsed. Nested expand/collapse for individual emails. Double-level progressive disclosure.</p>
            </TooltipContent>
          </Tooltip>

          {/* AI Research */}
          <Tooltip>
            <TooltipTrigger asChild>
              <AccordionItem value="research" className="border rounded-lg px-4 border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
                      <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="text-left">
                      <span className="font-semibold text-amber-800 dark:text-amber-300">AI Research</span>
                      <p className="text-xs text-amber-600 dark:text-amber-500 font-normal">73% success rate · 4 suggestions</p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pt-2">
                    <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
                      {DEMO_RESEARCH.summary}
                    </p>
                    <div>
                      <h4 className="font-medium text-sm mb-2 text-amber-800 dark:text-amber-300">Key Points</h4>
                      <ul className="space-y-2">
                        {DEMO_RESEARCH.keyPoints.map((point, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
                            <span className="h-5 w-5 rounded-full bg-amber-200 dark:bg-amber-800 flex items-center justify-center flex-shrink-0 text-xs font-semibold text-amber-800 dark:text-amber-200">
                              {index + 1}
                            </span>
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <Separator className="bg-amber-200 dark:bg-amber-800" />
                    <div>
                      <h4 className="font-medium text-sm mb-2 text-amber-800 dark:text-amber-300">Suggested Actions</h4>
                      <ul className="space-y-2">
                        {DEMO_RESEARCH.suggestedActions.map((action, index) => (
                          <li key={index} className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
                            <input type="checkbox" className="h-4 w-4 rounded border-amber-300" />
                            <span>{action}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-md">
              <p className="font-semibold">AI Research Section</p>
              <p className="text-xs mt-1">Distinctive amber/gold colouring signals AI-generated content. Success rate and suggestion count visible when collapsed. Checkboxes turn suggestions into actionable tasks.</p>
            </TooltipContent>
          </Tooltip>

          {/* Internal Notes */}
          <Tooltip>
            <TooltipTrigger asChild>
              <AccordionItem value="notes" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="text-left">
                      <span className="font-semibold">Internal Notes</span>
                      <p className="text-xs text-muted-foreground font-normal">{DEMO_NOTES.length} notes · Staff only</p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 pt-2">
                    {DEMO_NOTES.map((note) => (
                      <div key={note.id} className="p-3 rounded-lg bg-muted">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">{note.user}</span>
                          <span className="text-xs text-muted-foreground">{formatDateTime(note.date)}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{note.content}</p>
                      </div>
                    ))}
                    <Button variant="outline" className="w-full">
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Add Note
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-md">
              <p className="font-semibold">Internal Notes Section</p>
              <p className="text-xs mt-1">'Staff only' label clarifies these aren't shared with constituent. Notes for case coordination and handoffs. Timestamped and attributed to authors.</p>
            </TooltipContent>
          </Tooltip>

          {/* Activity Log */}
          <Tooltip>
            <TooltipTrigger asChild>
              <AccordionItem value="activity" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                      <History className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="text-left">
                      <span className="font-semibold">Activity Log</span>
                      <p className="text-xs text-muted-foreground font-normal">{DEMO_ACTIVITY.length} events · Case history</p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="relative pt-2">
                    <div className="absolute left-4 top-2 bottom-0 w-0.5 bg-border" />
                    <div className="space-y-4">
                      {DEMO_ACTIVITY.map((activity, index) => (
                        <div key={index} className="relative flex gap-4 pl-8">
                          <div className="absolute left-2.5 h-3 w-3 rounded-full bg-primary border-2 border-background" />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-sm">{activity.action}</p>
                              <span className="text-xs text-muted-foreground">
                                {formatDateTime(activity.date)}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">{activity.detail}</p>
                            <p className="text-xs text-muted-foreground">by {activity.user}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-md">
              <p className="font-semibold">Activity Log Section</p>
              <p className="text-xs mt-1">Complete audit trail. Timeline visualisation makes chronology clear. Shows who did what and when. Useful for case reviews and handoffs.</p>
            </TooltipContent>
          </Tooltip>

          {/* Case Statistics */}
          <Tooltip>
            <TooltipTrigger asChild>
              <AccordionItem value="stats" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                      <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="text-left">
                      <span className="font-semibold">Statistics</span>
                      <p className="text-xs text-muted-foreground font-normal">Response times & metrics</p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="p-3 rounded-lg bg-muted text-center">
                      <p className="text-2xl font-bold">{DEMO_STATS.daysOpen}</p>
                      <p className="text-xs text-muted-foreground">Days Open</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted text-center">
                      <p className="text-2xl font-bold">{DEMO_STATS.totalEmails}</p>
                      <p className="text-xs text-muted-foreground">Total Emails</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted text-center">
                      <p className="text-2xl font-bold">{DEMO_STATS.responseTime}</p>
                      <p className="text-xs text-muted-foreground">Avg Response</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted text-center">
                      <p className="text-2xl font-bold">{DEMO_STATS.similar_cases}</p>
                      <p className="text-xs text-muted-foreground">Similar Cases</p>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-md">
              <p className="font-semibold">Statistics Section</p>
              <p className="text-xs mt-1">Performance metrics and case analytics. Grid layout for quick scanning. 'Similar Cases' links to precedents for research. Less frequently needed, so collapsed by default.</p>
            </TooltipContent>
          </Tooltip>
        </Accordion>

        {/* Quick Actions Footer */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="sticky bottom-0 bg-background pt-4 border-t flex justify-between items-center">
              <div className="text-sm text-muted-foreground">
                Case opened {formatDate(DEMO_CASE.createdAt)} · Last updated {formatDate(DEMO_CASE.updatedAt)}
              </div>
              <div className="flex gap-2">
                <Button variant="outline">
                  <Bookmark className="h-4 w-4 mr-2" />
                  Save Draft
                </Button>
                <Button>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Mark Resolved
                </Button>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-md">
            <p className="font-semibold">Sticky Footer Actions</p>
            <p className="text-xs mt-1">Key actions always visible at bottom. Date info for context. 'Save Draft' for work-in-progress, 'Mark Resolved' for completion. Clear call-to-action placement.</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
