/**
 * PROTOTYPE 4: Campaign Cards with Modal Detail View
 *
 * Concept: Grid of campaign cards that open a modal with tabbed email views.
 * Features: Campaign overview cards, modal with tabs for constituent status,
 *           email grid cards, batch actions per tab
 *
 * Tabs: Known (matched constituents), Address included (can create), No address (need to request)
 */

import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  CheckCircle2,
  Flag,
  Users,
  User,
  MapPin,
  HelpCircle,
  Check,
  Mail,
  Pencil,
  ArrowLeft,
  Search,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ============= TYPES =============

interface CampaignEmail {
  id: string;
  subject: string;
  body: string;
  fromEmail: string;
  fromName: string;
  receivedAt: string;
  campaignName: string;
  // Constituent status determines which tab the email appears in
  constituentStatus: 'known' | 'has_address' | 'no_address';
  constituentName?: string;
  constituentId?: string;
  // For has_address - we have address info from the email
  addressFromEmail?: string;
  processed: boolean;
}

interface Campaign {
  name: string;
  emails: CampaignEmail[];
}

// ============= MOCK DATA =============

const mockCampaignEmails: CampaignEmail[] = [
  // Save Our Library Campaign - Known constituents
  {
    id: '1',
    subject: 'Save Our Local Library - Please Act Now',
    body: 'Dear MP, I am deeply concerned about the proposed closure of our local library. As a parent of two young children, the library has been invaluable for their education and love of reading. I urge you to oppose these cuts and fight to keep our library open. The library is a cornerstone of our community and losing it would be devastating for families like mine.',
    fromEmail: 'john.smith@gmail.com',
    fromName: 'John Smith',
    receivedAt: '2024-01-15T09:30:00Z',
    campaignName: 'Save Our Library',
    constituentStatus: 'known',
    constituentName: 'John Smith',
    constituentId: 'con-1',
    processed: false,
  },
  {
    id: '2',
    subject: 'Save Our Local Library - Please Act Now',
    body: 'Dear MP, As a lifelong user of the library, I cannot stress enough how important it is to our community. Please do everything in your power to prevent its closure. I have used this library since I was a child, and now I bring my grandchildren there every Saturday.',
    fromEmail: 'mary.jones@yahoo.com',
    fromName: 'Mary Jones',
    receivedAt: '2024-01-15T09:45:00Z',
    campaignName: 'Save Our Library',
    constituentStatus: 'known',
    constituentName: 'Mary Jones',
    constituentId: 'con-2',
    processed: false,
  },
  {
    id: '3',
    subject: 'Save Our Local Library - Please Act Now',
    body: 'Dear MP, I use the library every week and it would be devastating if it closed. Please support our community. The library provides essential services including computer access for job seekers and reading groups for isolated elderly residents.',
    fromEmail: 'robert.brown@hotmail.com',
    fromName: 'Robert Brown',
    receivedAt: '2024-01-15T10:00:00Z',
    campaignName: 'Save Our Library',
    constituentStatus: 'known',
    constituentName: 'Robert Brown',
    constituentId: 'con-3',
    processed: false,
  },
  // Save Our Library - Has address in email
  {
    id: '4',
    subject: 'Save Our Local Library - Please Act Now',
    body: 'Dear MP, I am writing to express my concern about the library closure. I live at 45 Oak Street, Westbury and rely on the library for my studies. Please help save this vital community resource.',
    fromEmail: 'sarah.williams@gmail.com',
    fromName: 'Sarah Williams',
    receivedAt: '2024-01-15T10:15:00Z',
    campaignName: 'Save Our Library',
    constituentStatus: 'has_address',
    addressFromEmail: '45 Oak Street, Westbury',
    processed: false,
  },
  {
    id: '5',
    subject: 'Save Our Local Library - Please Act Now',
    body: 'Dear MP, As a resident of 12 High Street, I want to add my voice to those calling for the library to remain open. It is an essential service. My address is included so you can verify I am a constituent.',
    fromEmail: 'tom.wilson@outlook.com',
    fromName: 'Tom Wilson',
    receivedAt: '2024-01-15T10:30:00Z',
    campaignName: 'Save Our Library',
    constituentStatus: 'has_address',
    addressFromEmail: '12 High Street',
    processed: false,
  },
  // Save Our Library - No address
  {
    id: '6',
    subject: 'Save Our Local Library - Please Act Now',
    body: 'Dear MP, Please save our library! It means so much to the community. I hope you will fight for this important resource.',
    fromEmail: 'emma.davis@gmail.com',
    fromName: 'Emma Davis',
    receivedAt: '2024-01-15T10:45:00Z',
    campaignName: 'Save Our Library',
    constituentStatus: 'no_address',
    processed: false,
  },
  {
    id: '7',
    subject: 'Save Our Local Library - Please Act Now',
    body: 'Dear MP, The library closure would be a tragedy. Please stand with us to keep it open.',
    fromEmail: 'james.taylor@yahoo.com',
    fromName: 'James Taylor',
    receivedAt: '2024-01-15T11:00:00Z',
    campaignName: 'Save Our Library',
    constituentStatus: 'no_address',
    processed: false,
  },

  // Protect Green Belt Campaign - Known
  {
    id: '8',
    subject: 'Protect Our Green Belt Land',
    body: 'Dear MP, I am writing to urge you to oppose the proposed housing development on protected green belt land. This would destroy valuable wildlife habitat and increase flooding risk. Our family has enjoyed these green spaces for generations.',
    fromEmail: 'emma.wilson@gmail.com',
    fromName: 'Emma Wilson',
    receivedAt: '2024-01-15T10:15:00Z',
    campaignName: 'Protect Green Belt',
    constituentStatus: 'known',
    constituentName: 'Emma Wilson',
    constituentId: 'con-6',
    processed: false,
  },
  {
    id: '9',
    subject: 'Stop Green Belt Development',
    body: 'Dear MP, The proposed development on our green belt is unacceptable. We moved here for the countryside and this development would ruin everything we love about this area. Please oppose this planning application.',
    fromEmail: 'david.clark@btinternet.com',
    fromName: 'David Clark',
    receivedAt: '2024-01-15T10:30:00Z',
    campaignName: 'Protect Green Belt',
    constituentStatus: 'known',
    constituentName: 'David Clark',
    constituentId: 'con-7',
    processed: false,
  },
  // Protect Green Belt - Has address
  {
    id: '10',
    subject: 'Protect Our Green Belt Land',
    body: 'Dear MP, Writing from 78 Meadow Lane to oppose the green belt development. My property backs onto this land and the development would devastate local wildlife corridors.',
    fromEmail: 'peter.hall@gmail.com',
    fromName: 'Peter Hall',
    receivedAt: '2024-01-15T11:00:00Z',
    campaignName: 'Protect Green Belt',
    constituentStatus: 'has_address',
    addressFromEmail: '78 Meadow Lane',
    processed: false,
  },
  // Protect Green Belt - No address
  {
    id: '11',
    subject: 'Stop the Green Belt Development',
    body: 'Dear MP, Please protect our green belt from developers. This is vital for our environment.',
    fromEmail: 'lucy.white@hotmail.com',
    fromName: 'Lucy White',
    receivedAt: '2024-01-15T11:15:00Z',
    campaignName: 'Protect Green Belt',
    constituentStatus: 'no_address',
    processed: false,
  },
  {
    id: '12',
    subject: 'Green Belt Must Be Protected',
    body: 'Dear MP, I strongly oppose any development on our green belt. Future generations deserve green spaces too.',
    fromEmail: 'mark.green@gmail.com',
    fromName: 'Mark Green',
    receivedAt: '2024-01-15T11:30:00Z',
    campaignName: 'Protect Green Belt',
    constituentStatus: 'no_address',
    processed: false,
  },

  // Stop NHS Cuts Campaign
  {
    id: '13',
    subject: 'Stop NHS Cuts in Our Area',
    body: 'Dear MP, I am extremely worried about the proposed cuts to NHS services in our constituency. My elderly mother relies on the local clinic for her regular check-ups. Please fight to protect our healthcare.',
    fromEmail: 'helen.baker@gmail.com',
    fromName: 'Helen Baker',
    receivedAt: '2024-01-15T12:00:00Z',
    campaignName: 'Stop NHS Cuts',
    constituentStatus: 'known',
    constituentName: 'Helen Baker',
    constituentId: 'con-10',
    processed: false,
  },
  {
    id: '14',
    subject: 'Protect Our Local NHS Services',
    body: 'Dear MP, The NHS is our most precious institution. Please do not let these cuts go ahead. We need more investment, not less.',
    fromEmail: 'steven.morris@yahoo.com',
    fromName: 'Steven Morris',
    receivedAt: '2024-01-15T12:15:00Z',
    campaignName: 'Stop NHS Cuts',
    constituentStatus: 'has_address',
    addressFromEmail: '23 Church Road, Northfield',
    processed: false,
  },
  {
    id: '15',
    subject: 'Save Our NHS',
    body: 'Dear MP, Please oppose any cuts to NHS funding in our area. Healthcare should be a priority.',
    fromEmail: 'karen.wright@outlook.com',
    fromName: 'Karen Wright',
    receivedAt: '2024-01-15T12:30:00Z',
    campaignName: 'Stop NHS Cuts',
    constituentStatus: 'no_address',
    processed: false,
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

function EmailCard({ email }: { email: CampaignEmail }) {
  // For has_address, show yellow ? if address needs verification, green check if verified
  // (For demo purposes, we'll show yellow ? since addresses aren't verified yet)
  const addressVerified = false; // In real app, this would come from email data

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="h-3.5 w-3.5" />
            <span className="truncate">{email.fromEmail}</span>
          </div>
          {email.constituentStatus === 'known' && email.constituentName && (
            <Badge variant="secondary" className="bg-green-100 text-green-700 shrink-0">
              <User className="mr-1 h-3 w-3" />
              {email.constituentName}
            </Badge>
          )}
          {email.constituentStatus === 'has_address' && (
            <Badge
              variant="secondary"
              className={addressVerified
                ? "bg-green-100 text-green-700 shrink-0"
                : "bg-yellow-100 text-yellow-700 shrink-0"
              }
            >
              {addressVerified
                ? <CheckCircle2 className="mr-1 h-3 w-3" />
                : <HelpCircle className="mr-1 h-3 w-3" />
              }
              {email.fromName}
            </Badge>
          )}
        </div>
        <h4 className="font-semibold text-sm mb-2 line-clamp-2">{email.subject}</h4>
        <p className="text-sm text-muted-foreground line-clamp-3">{email.body}</p>
        {email.constituentStatus === 'has_address' && email.addressFromEmail && (
          <div className="mt-2 text-xs text-yellow-700 bg-yellow-50 rounded px-2 py-1">
            <MapPin className="inline h-3 w-3 mr-1" />
            {email.addressFromEmail}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CampaignModal({
  campaign,
  open,
  onOpenChange,
  onApprove,
}: {
  campaign: Campaign | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: (campaignName: string, status?: 'known' | 'has_address' | 'no_address') => void;
}) {
  const [activeTab, setActiveTab] = useState<'known' | 'has_address' | 'no_address'>('known');

  if (!campaign) return null;

  const knownEmails = campaign.emails.filter(e => e.constituentStatus === 'known' && !e.processed);
  const hasAddressEmails = campaign.emails.filter(e => e.constituentStatus === 'has_address' && !e.processed);
  const noAddressEmails = campaign.emails.filter(e => e.constituentStatus === 'no_address' && !e.processed);

  const totalPending = knownEmails.length + hasAddressEmails.length + noAddressEmails.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <div className="flex items-center justify-between pr-8">
            <div className="flex items-center gap-3">
              <Flag className="h-5 w-5 text-blue-600" />
              <DialogTitle className="text-xl">{campaign.name}</DialogTitle>
              <Badge variant="secondary">{totalPending} pending</Badge>
            </div>
            <Button onClick={() => onApprove(campaign.name)}>
              <Check className="mr-2 h-4 w-4" />
              Approve
            </Button>
          </div>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as typeof activeTab)}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <TabsList className="grid w-full grid-cols-3 shrink-0">
            <TabsTrigger value="known" className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Known
              <Badge variant="outline" className="ml-1">{knownEmails.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="has_address" className="gap-2">
              <MapPin className="h-4 w-4" />
              Address included
              <Badge variant="outline" className="ml-1">{hasAddressEmails.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="no_address" className="gap-2">
              <HelpCircle className="h-4 w-4" />
              No address
              <Badge variant="outline" className="ml-1">{noAddressEmails.length}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="known" className="flex-1 flex flex-col overflow-hidden mt-4 data-[state=inactive]:hidden">
            <ScrollArea className="flex-1">
              {knownEmails.length > 0 ? (
                <div className="grid grid-cols-2 gap-4 pr-4">
                  {knownEmails.map(email => (
                    <EmailCard key={email.id} email={email} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mb-2 text-green-500" />
                  <p>No emails from known constituents</p>
                </div>
              )}
            </ScrollArea>
            {knownEmails.length > 0 && (
              <div className="flex justify-end pt-4 border-t mt-4 shrink-0">
                <Button onClick={() => onApprove(campaign.name, 'known')}>
                  <Check className="mr-2 h-4 w-4" />
                  Approve emails and add to constituents
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="has_address" className="flex-1 flex flex-col overflow-hidden mt-4 data-[state=inactive]:hidden">
            <ScrollArea className="flex-1">
              {hasAddressEmails.length > 0 ? (
                <div className="grid grid-cols-2 gap-4 pr-4">
                  {hasAddressEmails.map(email => (
                    <EmailCard key={email.id} email={email} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                  <MapPin className="h-12 w-12 mb-2 text-blue-500" />
                  <p>No emails with addresses found</p>
                </div>
              )}
            </ScrollArea>
            {hasAddressEmails.length > 0 && (
              <div className="flex justify-end pt-4 border-t mt-4 shrink-0">
                <Button onClick={() => onApprove(campaign.name, 'has_address')}>
                  <Check className="mr-2 h-4 w-4" />
                  Approve emails and create constituents
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="no_address" className="flex-1 flex flex-col overflow-hidden mt-4 data-[state=inactive]:hidden">
            <ScrollArea className="flex-1">
              {noAddressEmails.length > 0 ? (
                <div className="grid grid-cols-2 gap-4 pr-4">
                  {noAddressEmails.map(email => (
                    <EmailCard key={email.id} email={email} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                  <HelpCircle className="h-12 w-12 mb-2 text-gray-400" />
                  <p>No emails missing addresses</p>
                </div>
              )}
            </ScrollArea>
            {noAddressEmails.length > 0 && (
              <div className="flex justify-end pt-4 border-t mt-4 shrink-0">
                <Button onClick={() => onApprove(campaign.name, 'no_address')}>
                  <Check className="mr-2 h-4 w-4" />
                  Approve emails and request address
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// Full Page List View - email list on left, detail pane on right
function CampaignFullPageView({
  campaign,
  onBack,
  onApproveEmail,
}: {
  campaign: Campaign;
  onBack: () => void;
  onApproveEmail: (emailId: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<'known' | 'has_address' | 'no_address'>('known');
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);

  const knownEmails = campaign.emails.filter(e => e.constituentStatus === 'known' && !e.processed);
  const hasAddressEmails = campaign.emails.filter(e => e.constituentStatus === 'has_address' && !e.processed);
  const noAddressEmails = campaign.emails.filter(e => e.constituentStatus === 'no_address' && !e.processed);

  const totalPending = knownEmails.length + hasAddressEmails.length + noAddressEmails.length;

  const getCurrentEmails = () => {
    switch (activeTab) {
      case 'known': return knownEmails;
      case 'has_address': return hasAddressEmails;
      case 'no_address': return noAddressEmails;
    }
  };

  const currentEmails = getCurrentEmails();
  const selectedEmail = currentEmails.find(e => e.id === selectedEmailId) || currentEmails[0] || null;

  // Mock constituent options for dropdowns
  const constituentOptions = [
    { value: 'con-1', label: 'John Smith' },
    { value: 'con-2', label: 'Mary Jones' },
    { value: 'con-3', label: 'Robert Brown' },
    { value: 'new', label: '+ Create new constituent' },
  ];

  const caseOptions = [
    { value: 'case-1', label: 'Library Funding Review' },
    { value: 'case-2', label: 'Community Services' },
    { value: 'new', label: '+ Create new case' },
  ];

  const topicOptions = [
    { value: 'libraries', label: 'Libraries' },
    { value: 'education', label: 'Education' },
    { value: 'community', label: 'Community Services' },
    { value: 'housing', label: 'Housing' },
  ];

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between pb-4 border-b mb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div className="h-4 w-px bg-border" />
          <Flag className="h-5 w-5 text-blue-600" />
          <h1 className="text-xl font-semibold">{campaign.name}</h1>
          <Badge variant="secondary">{totalPending} pending</Badge>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v as typeof activeTab);
          setSelectedEmailId(null);
        }}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <TabsList className="grid w-full grid-cols-3 shrink-0">
          <TabsTrigger value="known" className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Known
            <Badge variant="outline" className="ml-1">{knownEmails.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="has_address" className="gap-2">
            <MapPin className="h-4 w-4" />
            Address included
            <Badge variant="outline" className="ml-1">{hasAddressEmails.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="no_address" className="gap-2">
            <HelpCircle className="h-4 w-4" />
            No address
            <Badge variant="outline" className="ml-1">{noAddressEmails.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 flex overflow-hidden mt-4 gap-0">
          {/* Left sidebar - email list */}
          <div className="w-1/3 flex flex-col overflow-hidden border-y border-l bg-muted/30">
            <ScrollArea className="flex-1">
              <div className="divide-y">
                {currentEmails.length > 0 ? (
                  currentEmails.map(email => (
                    <div
                      key={email.id}
                      className={`px-3 py-2 cursor-pointer transition-colors flex items-center gap-2 ${
                        selectedEmail?.id === email.id
                          ? 'bg-blue-100'
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => setSelectedEmailId(email.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{email.fromEmail}</div>
                        <div className="text-xs text-muted-foreground truncate">{email.fromName}</div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            onApproveEmail(email.id);
                          }}
                        >
                          <Check className="h-3.5 w-3.5 text-green-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEmailId(email.id);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    No emails in this category
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Right pane - email detail */}
          <div className="w-2/3 flex flex-col overflow-hidden border bg-background relative">
            {selectedEmail ? (
              <>
                {/* Floating toolbar */}
                <div className="absolute top-0 left-0 right-0 bg-background/95 backdrop-blur border-b z-10 px-4 py-2">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 flex-1">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <Select defaultValue={selectedEmail.constituentId || ''}>
                          <SelectTrigger className="h-7 w-[160px] text-xs">
                            <SelectValue placeholder="Link constituent..." />
                          </SelectTrigger>
                          <SelectContent>
                            {constituentOptions.map(opt => (
                              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Flag className="h-3.5 w-3.5 text-muted-foreground" />
                        <Select>
                          <SelectTrigger className="h-7 w-[160px] text-xs">
                            <SelectValue placeholder="Link to case..." />
                          </SelectTrigger>
                          <SelectContent>
                            {caseOptions.map(opt => (
                              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Search className="h-3.5 w-3.5 text-muted-foreground" />
                        <Select>
                          <SelectTrigger className="h-7 w-[140px] text-xs">
                            <SelectValue placeholder="Topic..." />
                          </SelectTrigger>
                          <SelectContent>
                            {topicOptions.map(opt => (
                              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => onApproveEmail(selectedEmail.id)}
                    >
                      <Check className="h-3.5 w-3.5 mr-1" />
                      Approve
                    </Button>
                  </div>
                </div>

                <ScrollArea className="flex-1 pt-12">
                  <div className="p-4 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-lg">{selectedEmail.subject}</h3>
                        <div className="text-sm text-muted-foreground mt-1">
                          From: {selectedEmail.fromName} &lt;{selectedEmail.fromEmail}&gt;
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {new Date(selectedEmail.receivedAt).toLocaleString()}
                        </div>
                      </div>
                      {selectedEmail.constituentStatus === 'known' && selectedEmail.constituentName && (
                        <Badge variant="secondary" className="bg-green-100 text-green-700 shrink-0">
                          <User className="mr-1 h-3 w-3" />
                          {selectedEmail.constituentName}
                        </Badge>
                      )}
                      {selectedEmail.constituentStatus === 'has_address' && (
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 shrink-0">
                          <HelpCircle className="mr-1 h-3 w-3" />
                          {selectedEmail.fromName}
                        </Badge>
                      )}
                    </div>

                    {selectedEmail.constituentStatus === 'has_address' && selectedEmail.addressFromEmail && (
                      <div className="text-sm text-yellow-700 bg-yellow-50 px-3 py-2">
                        <MapPin className="inline h-4 w-4 mr-1" />
                        Address found: {selectedEmail.addressFromEmail}
                      </div>
                    )}

                    <div className="border-t pt-4">
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{selectedEmail.body}</p>
                    </div>
                  </div>
                </ScrollArea>
              </>
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
    </div>
  );
}

// ============= MAIN COMPONENT =============

export default function TriagePrototype4() {
  const [emails, setEmails] = useState<CampaignEmail[]>(mockCampaignEmails);
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [fullPageCampaign, setFullPageCampaign] = useState<string | null>(null);

  // Group emails by campaign
  const campaigns = useMemo(() => {
    const unprocessedEmails = emails.filter(e => !e.processed);
    const groups: Record<string, CampaignEmail[]> = {};
    unprocessedEmails.forEach(e => {
      if (!groups[e.campaignName]) groups[e.campaignName] = [];
      groups[e.campaignName].push(e);
    });
    return Object.entries(groups).map(([name, campaignEmails]) => ({
      name,
      emails: campaignEmails,
    }));
  }, [emails]);

  const selectedCampaignData = useMemo(() => {
    return campaigns.find(c => c.name === selectedCampaign) || null;
  }, [campaigns, selectedCampaign]);

  const fullPageCampaignData = useMemo(() => {
    return campaigns.find(c => c.name === fullPageCampaign) || null;
  }, [campaigns, fullPageCampaign]);

  const handleApprove = (campaignName: string, status?: 'known' | 'has_address' | 'no_address') => {
    setEmails(prev => prev.map(e => {
      if (e.campaignName !== campaignName) return e;
      if (status && e.constituentStatus !== status) return e;
      return { ...e, processed: true };
    }));

    // Close modal if all emails in campaign are processed
    if (!status) {
      setSelectedCampaign(null);
    }
  };

  const handleApproveEmail = (emailId: string) => {
    setEmails(prev => prev.map(e =>
      e.id === emailId ? { ...e, processed: true } : e
    ));
  };

  const totalPending = emails.filter(e => !e.processed).length;
  const totalProcessed = emails.filter(e => e.processed).length;

  // If full page view is active, render that instead
  if (fullPageCampaignData) {
    return (
      <TooltipProvider>
        <CampaignFullPageView
          campaign={fullPageCampaignData}
          onBack={() => setFullPageCampaign(null)}
          onApproveEmail={handleApproveEmail}
        />
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <DesignTooltip comment="Simple header with stats. Campaign-focused view for batch processing policy emails.">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Campaign Triage</h1>
              <p className="text-muted-foreground text-sm">
                Click a campaign card to review and approve emails • {totalPending} pending, {totalProcessed} done
              </p>
            </div>
          </div>
        </DesignTooltip>

        {/* Campaign Cards List */}
        {campaigns.length > 0 ? (
          <DesignTooltip comment="Campaign rows show at-a-glance stats. Clicking Review opens modal with full email list sorted by constituent status.">
            <div className="flex flex-col gap-3">
              {campaigns.map(campaign => {
                const knownCount = campaign.emails.filter(e => e.constituentStatus === 'known').length;
                const hasAddressCount = campaign.emails.filter(e => e.constituentStatus === 'has_address').length;
                const noAddressCount = campaign.emails.filter(e => e.constituentStatus === 'no_address').length;

                const subjectLine = campaign.emails[0]?.subject || campaign.name;

                return (
                  <Card
                    key={campaign.name}
                    className="hover:shadow-md transition-all hover:border-blue-300 border-blue-200 bg-blue-50/50 cursor-pointer"
                    onClick={() => setSelectedCampaign(campaign.name)}
                  >
                    <CardContent className="p-3 flex items-center gap-3">
                      <Flag className="h-4 w-4 text-blue-600 shrink-0" />
                      <h3 className="text-sm font-medium truncate flex-1">{subjectLine}</h3>

                      <div className="flex items-center gap-3 text-xs">
                        <span className="font-semibold text-foreground">{campaign.emails.length}</span>
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-green-600" />
                            <span className="text-muted-foreground">{knownCount}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-blue-600" />
                            <span className="text-muted-foreground">{hasAddressCount}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <HelpCircle className="h-3 w-3 text-gray-500" />
                            <span className="text-muted-foreground">{noAddressCount}</span>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApprove(campaign.name);
                          }}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCampaign(campaign.name);
                          }}
                        >
                          Review
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </DesignTooltip>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold">All caught up!</h3>
              <p className="text-muted-foreground">No campaign emails to process.</p>
            </CardContent>
          </Card>
        )}

        {/* Alternative Full Page View Card */}
        {campaigns.length > 0 && (
          <DesignTooltip comment="Alternative view: Full page layout with email sidebar and detail pane. Click to try.">
            <Card
              className="hover:shadow-md transition-all hover:border-purple-300 border-purple-200 bg-purple-50/50 cursor-pointer"
              onClick={() => setFullPageCampaign(campaigns[0]?.name || null)}
            >
              <CardContent className="p-3 flex items-center gap-3">
                <Mail className="h-4 w-4 text-purple-600 shrink-0" />
                <h3 className="text-sm font-medium flex-1">Try Full Page View (sidebar + detail pane)</h3>
                <Badge variant="outline" className="text-purple-600 border-purple-300">Alt Layout</Badge>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs border-purple-300 text-purple-600 hover:bg-purple-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFullPageCampaign(campaigns[0]?.name || null);
                  }}
                >
                  Open
                </Button>
              </CardContent>
            </Card>
          </DesignTooltip>
        )}

        {/* Campaign Modal */}
        <CampaignModal
          campaign={selectedCampaignData}
          open={!!selectedCampaign}
          onOpenChange={(open) => !open && setSelectedCampaign(null)}
          onApprove={handleApprove}
        />

        {/* Stats Summary */}
        {totalProcessed > 0 && (
          <DesignTooltip comment="Summary of processed emails. Shows progress through the campaign queue.">
            <Card className="bg-green-50/50 border-green-200">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="font-medium">
                      {totalProcessed} email{totalProcessed !== 1 ? 's' : ''} processed
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      Added to existing constituents
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="h-4 w-4" />
                      New constituents created
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </DesignTooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
