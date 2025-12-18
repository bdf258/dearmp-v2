/**
 * Dashboard Prototype: Campaign Dashboard with Menubar
 *
 * Concept: Main dashboard view with greeting, tabs for Campaigns/Communications,
 * and campaign cards showing email counts and constituent breakdown.
 */

import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  CheckCircle2,
  Flag,
  MapPin,
  ArrowLeft,
  Mail,
  Check,
  X,
  MapPinOff,
  User,
  HelpCircle
} from 'lucide-react';
import { Separator } from '@radix-ui/react-separator';

// ============= TYPES =============

interface CampaignEmail {
  id: string;
  subject: string;
  body: string;
  fromEmail: string;
  fromName: string;
  receivedAt: string;
  constituentStatus: 'known' | 'has_address' | 'no_address';
  constituentName?: string;
  constituentId?: string;
  addressFromEmail?: string;
  status: 'pending' | 'confirmed' | 'rejected';
}

interface Campaign {
  id: string;
  name: string;
  emails: CampaignEmail[];
}

// ============= MOCK DATA =============

const mockCampaigns: Campaign[] = [
  {
    id: '1',
    name: 'Save our local Library',
    emails: [
      {
        id: '1',
        subject: 'Save Our Local Library - Please Act Now',
        body: 'Dear MP, I am deeply concerned about the proposed closure of our local library. As a parent of two young children, the library has been invaluable for their education and love of reading. I urge you to oppose these cuts and fight to keep our library open. The library is a cornerstone of our community and losing it would be devastating for families like mine.',
        fromEmail: 'john.smith@gmail.com',
        fromName: 'John Smith',
        receivedAt: '2024-01-15T09:30:00Z',
        constituentStatus: 'known',
        constituentName: 'John Smith',
        constituentId: 'con-1',
        status: 'pending',
      },
      {
        id: '2',
        subject: 'Save Our Local Library - Please Act Now',
        body: 'Dear MP, As a lifelong user of the library, I cannot stress enough how important it is to our community. Please do everything in your power to prevent its closure. I have used this library since I was a child, and now I bring my grandchildren there every Saturday.',
        fromEmail: 'mary.jones@yahoo.com',
        fromName: 'Mary Jones',
        receivedAt: '2024-01-15T09:45:00Z',
        constituentStatus: 'known',
        constituentName: 'Mary Jones',
        constituentId: 'con-2',
        status: 'pending',
      },
      {
        id: '3',
        subject: 'Save Our Local Library - Please Act Now',
        body: 'Dear MP, I use the library every week and it would be devastating if it closed. Please support our community. The library provides essential services including computer access for job seekers and reading groups for isolated elderly residents.',
        fromEmail: 'robert.brown@hotmail.com',
        fromName: 'Robert Brown',
        receivedAt: '2024-01-15T10:00:00Z',
        constituentStatus: 'known',
        constituentName: 'Robert Brown',
        constituentId: 'con-3',
        status: 'pending',
      },
      {
        id: '4',
        subject: 'Save Our Local Library - Please Act Now',
        body: 'Dear MP, I am writing to express my concern about the library closure. I live at 45 Oak Street, Westbury and rely on the library for my studies. Please help save this vital community resource.',
        fromEmail: 'sarah.williams@gmail.com',
        fromName: 'Sarah Williams',
        receivedAt: '2024-01-15T10:15:00Z',
        constituentStatus: 'has_address',
        addressFromEmail: '45 Oak Street, Westbury',
        status: 'pending',
      },
      {
        id: '5',
        subject: 'Save Our Local Library - Please Act Now',
        body: 'Dear MP, As a resident of 12 High Street, I want to add my voice to those calling for the library to remain open. It is an essential service. My address is included so you can verify I am a constituent.',
        fromEmail: 'tom.wilson@outlook.com',
        fromName: 'Tom Wilson',
        receivedAt: '2024-01-15T10:30:00Z',
        constituentStatus: 'has_address',
        addressFromEmail: '12 High Street',
        status: 'pending',
      },
      {
        id: '6',
        subject: 'Save Our Local Library - Please Act Now',
        body: 'Dear MP, Please save our library! It means so much to the community. I hope you will fight for this important resource.',
        fromEmail: 'emma.davis@gmail.com',
        fromName: 'Emma Davis',
        receivedAt: '2024-01-15T10:45:00Z',
        constituentStatus: 'no_address',
        status: 'pending',
      },
      {
        id: '7',
        subject: 'Save Our Local Library - Please Act Now',
        body: 'Dear MP, The library closure would be a tragedy. Please stand with us to keep it open.',
        fromEmail: 'james.taylor@yahoo.com',
        fromName: 'James Taylor',
        receivedAt: '2024-01-15T11:00:00Z',
        constituentStatus: 'no_address',
        status: 'pending',
      },
      {
        id: '17',
        subject: 'Save Our Local Library - Please Act Now',
        body: 'Dear MP, Libraries are essential for education and community cohesion. Please protect ours.',
        fromEmail: 'lisa.chen@gmail.com',
        fromName: 'Lisa Chen',
        receivedAt: '2024-01-15T11:15:00Z',
        constituentStatus: 'has_address',
        addressFromEmail: '88 Park Avenue',
        status: 'pending',
      },
      {
        id: '18',
        subject: 'Save Our Local Library - Please Act Now',
        body: 'Dear MP, As a retired teacher, I know how vital libraries are. Please fight for ours.',
        fromEmail: 'michael.harris@btinternet.com',
        fromName: 'Michael Harris',
        receivedAt: '2024-01-15T11:30:00Z',
        constituentStatus: 'has_address',
        addressFromEmail: '5 Station Road',
        status: 'pending',
      },
      {
        id: '19',
        subject: 'Save Our Local Library - Please Act Now',
        body: 'Dear MP, Our library is a lifeline for so many. Please do not let it close.',
        fromEmail: 'susan.brown@outlook.com',
        fromName: 'Susan Brown',
        receivedAt: '2024-01-15T11:45:00Z',
        constituentStatus: 'has_address',
        addressFromEmail: '22 Mill Lane',
        status: 'pending',
      },
      {
        id: '20',
        subject: 'Save Our Local Library - Please Act Now',
        body: 'Dear MP, The library is where I learned to love reading. Please save it for future generations.',
        fromEmail: 'david.thompson@yahoo.com',
        fromName: 'David Thompson',
        receivedAt: '2024-01-15T12:00:00Z',
        constituentStatus: 'has_address',
        addressFromEmail: '14 Church Street',
        status: 'pending',
      },
    ],
  },
  {
    id: '2',
    name: 'Protect Green Belt',
    emails: [
      {
        id: '8',
        subject: 'Protect Our Green Belt Land',
        body: 'Dear MP, I am writing to urge you to oppose the proposed housing development on protected green belt land. This would destroy valuable wildlife habitat and increase flooding risk. Our family has enjoyed these green spaces for generations.',
        fromEmail: 'emma.wilson@gmail.com',
        fromName: 'Emma Wilson',
        receivedAt: '2024-01-15T10:15:00Z',
        constituentStatus: 'known',
        constituentName: 'Emma Wilson',
        constituentId: 'con-6',
        status: 'pending',
      },
      {
        id: '9',
        subject: 'Stop Green Belt Development',
        body: 'Dear MP, The proposed development on our green belt is unacceptable. We moved here for the countryside and this development would ruin everything we love about this area. Please oppose this planning application.',
        fromEmail: 'david.clark@btinternet.com',
        fromName: 'David Clark',
        receivedAt: '2024-01-15T10:30:00Z',
        constituentStatus: 'known',
        constituentName: 'David Clark',
        constituentId: 'con-7',
        status: 'pending',
      },
      {
        id: '10',
        subject: 'Protect Our Green Belt Land',
        body: 'Dear MP, Writing from 78 Meadow Lane to oppose the green belt development. My property backs onto this land and the development would devastate local wildlife corridors.',
        fromEmail: 'peter.hall@gmail.com',
        fromName: 'Peter Hall',
        receivedAt: '2024-01-15T11:00:00Z',
        constituentStatus: 'has_address',
        addressFromEmail: '78 Meadow Lane',
        status: 'pending',
      },
      {
        id: '11',
        subject: 'Stop the Green Belt Development',
        body: 'Dear MP, Please protect our green belt from developers. This is vital for our environment.',
        fromEmail: 'lucy.white@hotmail.com',
        fromName: 'Lucy White',
        receivedAt: '2024-01-15T11:15:00Z',
        constituentStatus: 'no_address',
        status: 'pending',
      },
      {
        id: '12',
        subject: 'Green Belt Must Be Protected',
        body: 'Dear MP, I strongly oppose any development on our green belt. Future generations deserve green spaces too.',
        fromEmail: 'mark.green@gmail.com',
        fromName: 'Mark Green',
        receivedAt: '2024-01-15T11:30:00Z',
        constituentStatus: 'no_address',
        status: 'pending',
      },
      {
        id: '21',
        subject: 'Protect Our Green Belt Land',
        body: 'Dear MP, Green spaces are essential for mental health and wellbeing. Please protect our green belt.',
        fromEmail: 'anna.jones@gmail.com',
        fromName: 'Anna Jones',
        receivedAt: '2024-01-15T11:45:00Z',
        constituentStatus: 'has_address',
        addressFromEmail: '33 Riverside Drive',
        status: 'pending',
      },
      {
        id: '22',
        subject: 'Protect Our Green Belt Land',
        body: 'Dear MP, Our children need these green spaces. Please stand against the development.',
        fromEmail: 'chris.martin@outlook.com',
        fromName: 'Chris Martin',
        receivedAt: '2024-01-15T12:00:00Z',
        constituentStatus: 'has_address',
        addressFromEmail: '7 Oak Close',
        status: 'pending',
      },
      {
        id: '23',
        subject: 'Protect Our Green Belt Land',
        body: 'Dear MP, Wildlife in this area is precious. Please protect our green belt from developers.',
        fromEmail: 'rachel.adams@yahoo.com',
        fromName: 'Rachel Adams',
        receivedAt: '2024-01-15T12:15:00Z',
        constituentStatus: 'no_address',
        status: 'pending',
      },
    ],
  },
  {
    id: '3',
    name: 'Stop NHS Cuts',
    emails: [
      {
        id: '13',
        subject: 'Stop NHS Cuts in Our Area',
        body: 'Dear MP, I am extremely worried about the proposed cuts to NHS services in our constituency. My elderly mother relies on the local clinic for her regular check-ups. Please fight to protect our healthcare.',
        fromEmail: 'helen.baker@gmail.com',
        fromName: 'Helen Baker',
        receivedAt: '2024-01-15T12:00:00Z',
        constituentStatus: 'known',
        constituentName: 'Helen Baker',
        constituentId: 'con-10',
        status: 'pending',
      },
      {
        id: '14',
        subject: 'Protect Our Local NHS Services',
        body: 'Dear MP, The NHS is our most precious institution. Please do not let these cuts go ahead. We need more investment, not less.',
        fromEmail: 'steven.morris@yahoo.com',
        fromName: 'Steven Morris',
        receivedAt: '2024-01-15T12:15:00Z',
        constituentStatus: 'has_address',
        addressFromEmail: '23 Church Road, Northfield',
        status: 'pending',
      },
      {
        id: '15',
        subject: 'Save Our NHS',
        body: 'Dear MP, Please oppose any cuts to NHS funding in our area. Healthcare should be a priority.',
        fromEmail: 'karen.wright@outlook.com',
        fromName: 'Karen Wright',
        receivedAt: '2024-01-15T12:30:00Z',
        constituentStatus: 'no_address',
        status: 'pending',
      },
      {
        id: '16',
        subject: 'Stop NHS Cuts in Our Area',
        body: 'Dear MP, As a nurse, I see daily how stretched our services are. Please fight against these cuts.',
        fromEmail: 'jane.smith@nhs.net',
        fromName: 'Jane Smith',
        receivedAt: '2024-01-15T12:45:00Z',
        constituentStatus: 'has_address',
        addressFromEmail: '56 Victoria Street',
        status: 'pending',
      },
      {
        id: '24',
        subject: 'Stop NHS Cuts in Our Area',
        body: 'Dear MP, My family depends on local NHS services. Please protect them.',
        fromEmail: 'paul.davies@gmail.com',
        fromName: 'Paul Davies',
        receivedAt: '2024-01-15T13:00:00Z',
        constituentStatus: 'no_address',
        status: 'pending',
      },
      {
        id: '25',
        subject: 'Stop NHS Cuts in Our Area',
        body: 'Dear MP, The NHS saved my life. Please do everything you can to protect it.',
        fromEmail: 'margaret.taylor@btinternet.com',
        fromName: 'Margaret Taylor',
        receivedAt: '2024-01-15T13:15:00Z',
        constituentStatus: 'no_address',
        status: 'pending',
      },
      {
        id: '26',
        subject: 'Stop NHS Cuts in Our Area',
        body: 'Dear MP, Healthcare is a right, not a privilege. Please stand up for our NHS.',
        fromEmail: 'george.wilson@yahoo.com',
        fromName: 'George Wilson',
        receivedAt: '2024-01-15T13:30:00Z',
        constituentStatus: 'no_address',
        status: 'pending',
      },
      {
        id: '27',
        subject: 'Stop NHS Cuts in Our Area',
        body: 'Dear MP, Our local hospital is already struggling. Please oppose any further cuts.',
        fromEmail: 'emily.johnson@outlook.com',
        fromName: 'Emily Johnson',
        receivedAt: '2024-01-15T13:45:00Z',
        constituentStatus: 'has_address',
        addressFromEmail: '99 Queens Road',
        status: 'pending',
      },
    ],
  },
];

// ============= HELPER COMPONENTS =============

function CampaignCard({
  campaign,
  onClick,
}: {
  campaign: Campaign;
  onClick: () => void;
}) {
  const knownCount = campaign.emails.filter(e => e.constituentStatus === 'known' && e.status === 'pending').length;
  const hasAddressCount = campaign.emails.filter(e => e.constituentStatus === 'has_address' && e.status === 'pending').length;
  const noAddressCount = campaign.emails.filter(e => e.constituentStatus === 'no_address' && e.status === 'pending').length;
  const totalEmails = campaign.emails.filter(e => e.status === 'pending').length;

  return (
    <Card
      className="hover:shadow-md transition-all border bg-white cursor-pointer"
      onClick={onClick}
    >
      <CardContent className="p-3 flex items-center gap-3">
        <Flag className="h-4 w-4 text-muted-foreground shrink-0" />
        <h3 className="text-sm font-medium truncate flex-1">{campaign.name}</h3>

        {/* Email count badge */}
        <Badge
          variant="outline"
          className="rounded-full h-6 w-6 p-0 flex items-center justify-center text-xs font-semibold"
        >
          {totalEmails}
        </Badge>

        {/* Stats */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-green-600" />
            <span>{knownCount.toString().padStart(2, '0')}</span>
          </span>
          <span className="text-muted-foreground/50">|</span>
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3 text-blue-600" />
            <span>{hasAddressCount.toString().padStart(2, '0')}</span>
          </span>
          <span className="text-muted-foreground/50">|</span>
          <span className="flex items-center gap-1">
            <MapPinOff className="h-3 w-3 text-gray-500" />
            <span>{noAddressCount.toString().padStart(2, '0')}</span>
          </span>
        </div>

        {/* Review button */}
        <Button
          size="sm"
          className="h-7 px-3 text-xs shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
        >
          Review
        </Button>
      </CardContent>
    </Card>
  );
}

// Full Page List View - email list on left, detail pane on right
function CampaignFullPageView({
  campaign,
  onBack,
  onConfirmEmail,
  onRejectEmail,
}: {
  campaign: Campaign;
  onBack: () => void;
  onConfirmEmail: (emailId: string) => void;
  onRejectEmail: (emailId: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<'known' | 'has_address' | 'no_address'>('known');
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);

  const knownEmails = campaign.emails.filter(e => e.constituentStatus === 'known');
  const hasAddressEmails = campaign.emails.filter(e => e.constituentStatus === 'has_address');
  const noAddressEmails = campaign.emails.filter(e => e.constituentStatus === 'no_address');

  const pendingCount = campaign.emails.filter(e => e.status === 'pending').length;

  const getCurrentEmails = () => {
    switch (activeTab) {
      case 'known': return knownEmails;
      case 'has_address': return hasAddressEmails;
      case 'no_address': return noAddressEmails;
    }
  };

  const currentEmails = getCurrentEmails();
  const selectedEmail = currentEmails.find(e => e.id === selectedEmailId) || currentEmails.find(e => e.status === 'pending') || currentEmails[0] || null;

  const handleAction = (emailId: string, action: 'confirm' | 'reject') => {
    // Find the next pending email in the current list
    const currentIndex = currentEmails.findIndex(e => e.id === emailId);
    const nextPendingEmail = currentEmails.slice(currentIndex + 1).find(e => e.status === 'pending')
      || currentEmails.slice(0, currentIndex).find(e => e.status === 'pending');

    // Perform the action
    if (action === 'confirm') {
      onConfirmEmail(emailId);
    } else {
      onRejectEmail(emailId);
    }

    // Move to next pending email
    if (nextPendingEmail) {
      setSelectedEmailId(nextPendingEmail.id);
    }
  };

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
          <Badge variant="secondary">{pendingCount} pending</Badge>
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
            <Badge variant="outline" className="ml-1">{knownEmails.filter(e => e.status === 'pending').length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="has_address" className="gap-2">
            <MapPin className="h-4 w-4" />
            Address included
            <Badge variant="outline" className="ml-1">{hasAddressEmails.filter(e => e.status === 'pending').length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="no_address" className="gap-2">
            <MapPinOff className="h-4 w-4" />
            No address
            <Badge variant="outline" className="ml-1">{noAddressEmails.filter(e => e.status === 'pending').length}</Badge>
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
                        email.status === 'confirmed'
                          ? 'bg-green-100'
                          : email.status === 'rejected'
                          ? 'bg-red-50 opacity-50'
                          : selectedEmail?.id === email.id
                          ? 'bg-blue-100'
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => setSelectedEmailId(email.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{email.fromEmail}</div>
                        <div className="text-xs text-muted-foreground truncate">{email.fromName}</div>
                      </div>
                      {email.status === 'pending' && (
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAction(email.id, 'confirm');
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
                              handleAction(email.id, 'reject');
                            }}
                          >
                            <X className="h-3.5 w-3.5 text-red-500" />
                          </Button>
                        </div>
                      )}
                      {email.status === 'confirmed' && (
                        <Check className="h-4 w-4 text-green-600 shrink-0" />
                      )}
                      {email.status === 'rejected' && (
                        <X className="h-4 w-4 text-red-500 shrink-0" />
                      )}
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
                  <div className="flex items-center justify-end gap-2">
                    {selectedEmail.status === 'pending' ? (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleAction(selectedEmail.id, 'reject')}
                        >
                          Not a campaign email
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleAction(selectedEmail.id, 'confirm')}
                        >
                          Confirmed campaign email
                        </Button>
                      </>
                    ) : (
                      <Badge variant={selectedEmail.status === 'confirmed' ? 'default' : 'secondary'} className={selectedEmail.status === 'confirmed' ? 'bg-green-600' : 'bg-red-100 text-red-700'}>
                        {selectedEmail.status === 'confirmed' ? 'Confirmed' : 'Not a campaign email'}
                      </Badge>
                    )}
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

export default function DashboardPrototype() {
  const [activeTab, setActiveTab] = useState<'campaigns' | 'responses' | 'new-cases'>('campaigns');
  const [campaigns, setCampaigns] = useState<Campaign[]>(mockCampaigns);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  const totalPendingEmails = useMemo(() =>
    campaigns.reduce((sum, c) => sum + c.emails.filter(e => e.status === 'pending').length, 0),
    [campaigns]
  );
  const userName = 'Stewart';

  const selectedCampaign = useMemo(() =>
    campaigns.find(c => c.id === selectedCampaignId) || null,
    [campaigns, selectedCampaignId]
  );

  const handleConfirmEmail = (emailId: string) => {
    setCampaigns(prev => prev.map(campaign => ({
      ...campaign,
      emails: campaign.emails.map(email =>
        email.id === emailId ? { ...email, status: 'confirmed' as const } : email
      )
    })));
  };

  const handleRejectEmail = (emailId: string) => {
    setCampaigns(prev => prev.map(campaign => ({
      ...campaign,
      emails: campaign.emails.map(email =>
        email.id === emailId ? { ...email, status: 'rejected' as const } : email
      )
    })));
  };

  // If a campaign is selected, show the full page view
  if (selectedCampaign) {
    return (
      <CampaignFullPageView
        campaign={selectedCampaign}
        onBack={() => setSelectedCampaignId(null)}
        onConfirmEmail={handleConfirmEmail}
        onRejectEmail={handleRejectEmail}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Greeting Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Good morning, {userName}
        </h1>
        <p className="text-muted-foreground">
          There are {totalPendingEmails} new emails to triage.
        </p>
      </div>

      {/* Tabs Menubar */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as typeof activeTab)}
        className="w-full"
      >
        <TabsList className="flex flex-row w-fit mb-4">
          <TabsTrigger value="campaigns" className="px-6">
            Campaigns
          </TabsTrigger>
          <Separator orientation='vertical' className="h-6 w-px bg-gray-600 border border-gray-400 mx-2"/>
          <TabsTrigger value="responses" className="px-6">
            Responses
          </TabsTrigger>
          <TabsTrigger value="new-cases" className="px-6">
            New cases
          </TabsTrigger>
        </TabsList>

        {/* Campaigns Tab Content */}
        <TabsContent value="campaigns" className="mt-0">
          <div className="flex flex-col gap-3">
            {campaigns.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                onClick={() => setSelectedCampaignId(campaign.id)}
              />
            ))}
          </div>
        </TabsContent>

        {/* Communications Tab Content */}
        <TabsContent value="responses" className="mt-0">
          <Card className="bg-white">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                Communications view coming soon...
              </p>
            </CardContent>
          </Card>
        </TabsContent>

              {/* Communications Tab Content */}
        <TabsContent value="new-cases" className="mt-0">
          <Card className="bg-white">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                Cases view coming soon...
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

    </div>
  );
}
