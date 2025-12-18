/**
 * Dashboard Prototype: Campaign Dashboard with Menubar
 *
 * Concept: Main dashboard view with greeting, tabs for Campaigns/Communications,
 * and campaign cards showing email counts and constituent breakdown.
 */

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CheckCircle2,
  Flag,
  MapPin,
  HelpCircle,
  AtSign,
  Link2,
  User,
  Check,
  X,
  ChevronDown,
} from 'lucide-react';

// ============= TYPES =============

interface Campaign {
  id: string;
  name: string;
  totalEmails: number;
  knownConstituents: number;
  hasAddress: number;
  noAddress: number;
}

type PillState = 'unset' | 'set' | 'linked' | 'editing';

interface EmailResponse {
  id: string;
  subject: string;
  preview: string;
  senderEmail: string;
  receivedAt: string;
  constituentPill: {
    state: PillState;
    value: string | null;
  };
  casePill: {
    state: PillState;
    value: string | null;
  };
  caseworkerPill: {
    state: PillState;
    value: string | null;
  };
}

// ============= MOCK DATA =============

const mockCampaigns: Campaign[] = [
  {
    id: '1',
    name: 'Save our local Library',
    totalEmails: 12,
    knownConstituents: 3,
    hasAddress: 9,
    noAddress: 1,
  },
  {
    id: '2',
    name: 'Protect Green Belt',
    totalEmails: 8,
    knownConstituents: 2,
    hasAddress: 4,
    noAddress: 2,
  },
  {
    id: '3',
    name: 'Stop NHS Cuts',
    totalEmails: 8,
    knownConstituents: 1,
    hasAddress: 3,
    noAddress: 4,
  },
];

const mockEmailResponses: EmailResponse[] = [
  {
    id: '1',
    subject: 'URGENT - Eviction notice received',
    preview: 'Dear MP, I am writing to you because I have just received an eviction notice from my landlord...',
    senderEmail: 'maria.santos@gmail.com',
    receivedAt: '2 hours ago',
    constituentPill: { state: 'linked', value: 'Maria Santos' },
    casePill: { state: 'linked', value: 'CW-2014-0123' },
    caseworkerPill: { state: 'set', value: 'Mark' },
  },
  {
    id: '2',
    subject: 'Re: Council tax rebate enquiry',
    preview: 'Thank you for your response. I wanted to follow up on my previous query about the council tax...',
    senderEmail: 'j.thompson42@outlook.com',
    receivedAt: '4 hours ago',
    constituentPill: { state: 'set', value: 'James Thompson' },
    casePill: { state: 'unset', value: null },
    caseworkerPill: { state: 'unset', value: null },
  },
  {
    id: '3',
    subject: 'Pothole on High Street - still not fixed',
    preview: 'I wrote to you three months ago about the dangerous pothole outside number 45 High Street...',
    senderEmail: 'concerned.resident@yahoo.co.uk',
    receivedAt: 'Yesterday',
    constituentPill: { state: 'unset', value: null },
    casePill: { state: 'unset', value: null },
    caseworkerPill: { state: 'unset', value: null },
  },
];

// ============= HELPER COMPONENTS =============

function CampaignCard({
  campaign,
  onReview,
}: {
  campaign: Campaign;
  onReview: (campaignId: string) => void;
}) {
  return (
    <Card className="hover:shadow-md transition-all border bg-white">
      <CardContent className="p-3 flex items-center gap-3">
        <Flag className="h-4 w-4 text-muted-foreground shrink-0" />
        <h3 className="text-sm font-medium truncate flex-1">{campaign.name}</h3>

        {/* Email count badge */}
        <Badge
          variant="outline"
          className="rounded-full h-6 w-6 p-0 flex items-center justify-center text-xs font-semibold"
        >
          {campaign.totalEmails}
        </Badge>

        {/* Stats */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-green-600" />
            <span>{campaign.knownConstituents.toString().padStart(2, '0')}</span>
          </span>
          <span className="text-muted-foreground/50">|</span>
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3 text-blue-600" />
            <span>{campaign.hasAddress.toString().padStart(2, '0')}</span>
          </span>
          <span className="text-muted-foreground/50">|</span>
          <span className="flex items-center gap-1">
            <HelpCircle className="h-3 w-3 text-gray-500" />
            <span>{campaign.noAddress.toString().padStart(2, '0')}</span>
          </span>
        </div>

        {/* Review button */}
        <Button
          size="sm"
          className="h-7 px-3 text-xs shrink-0"
          onClick={() => onReview(campaign.id)}
        >
          Review
        </Button>
      </CardContent>
    </Card>
  );
}

// Pill variant styles based on state
function getPillStyles(state: PillState, type: 'constituent' | 'case' | 'caseworker') {
  const baseStyles = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer border';

  if (state === 'unset') {
    return `${baseStyles} bg-gray-50 text-gray-500 border-dashed border-gray-300 hover:bg-gray-100 hover:border-gray-400`;
  }

  if (state === 'set') {
    const colors = {
      constituent: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
      case: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
      caseworker: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100',
    };
    return `${baseStyles} ${colors[type]}`;
  }

  if (state === 'linked') {
    const colors = {
      constituent: 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200',
      case: 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200',
      caseworker: 'bg-purple-100 text-purple-800 border-purple-300 hover:bg-purple-200',
    };
    return `${baseStyles} ${colors[type]}`;
  }

  if (state === 'editing') {
    return `${baseStyles} bg-white border-blue-500 ring-2 ring-blue-200`;
  }

  return baseStyles;
}

function Pill({
  type,
  state,
  value,
  onClick,
}: {
  type: 'constituent' | 'case' | 'caseworker';
  state: PillState;
  value: string | null;
  onClick?: () => void;
}) {
  const icons = {
    constituent: AtSign,
    case: Link2,
    caseworker: User,
  };

  const placeholders = {
    constituent: 'Link constituent',
    case: 'Link case',
    caseworker: 'Assign',
  };

  const Icon = icons[type];
  const displayValue = value || placeholders[type];

  return (
    <button
      type="button"
      className={getPillStyles(state, type)}
      onClick={onClick}
    >
      <Icon className="h-3 w-3" />
      <span>{displayValue}</span>
      {state === 'linked' && (
        <Check className="h-3 w-3 ml-0.5" />
      )}
      {state === 'unset' && (
        <ChevronDown className="h-3 w-3 ml-0.5 opacity-50" />
      )}
    </button>
  );
}

function EmailResponseCard({
  email,
  onPillClick,
}: {
  email: EmailResponse;
  onPillClick?: (emailId: string, pillType: 'constituent' | 'case' | 'caseworker') => void;
}) {
  return (
    <Card className="hover:shadow-md transition-all border bg-white">
      <CardContent className="p-4">
        {/* Subject and Preview */}
        <div className="flex items-start gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-semibold text-gray-900 truncate">
                {email.subject}
              </h3>
              <span className="text-xs text-muted-foreground shrink-0">
                {email.receivedAt}
              </span>
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {email.preview}
            </p>
          </div>
        </div>

        {/* Email and Pills Row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">
            {email.senderEmail}
          </span>

          <div className="flex-1" />

          <div className="flex items-center gap-2 flex-wrap">
            <Pill
              type="constituent"
              state={email.constituentPill.state}
              value={email.constituentPill.value}
              onClick={() => onPillClick?.(email.id, 'constituent')}
            />
            <Pill
              type="case"
              state={email.casePill.state}
              value={email.casePill.value}
              onClick={() => onPillClick?.(email.id, 'case')}
            />
            <Pill
              type="caseworker"
              state={email.caseworkerPill.state}
              value={email.caseworkerPill.value}
              onClick={() => onPillClick?.(email.id, 'caseworker')}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============= MAIN COMPONENT =============

export default function DashboardPrototype() {
  const [activeTab, setActiveTab] = useState<'campaigns' | 'communications'>('campaigns');
  const [campaigns] = useState<Campaign[]>(mockCampaigns);
  const [emailResponses] = useState<EmailResponse[]>(mockEmailResponses);

  const totalPendingEmails = campaigns.reduce((sum, c) => sum + c.totalEmails, 0);
  const userName = 'Stewart';

  const handleReview = (campaignId: string) => {
    console.log('Review campaign:', campaignId);
    // In a real app, this would navigate to the campaign review page
  };

  const handlePillClick = (emailId: string, pillType: 'constituent' | 'case' | 'caseworker') => {
    console.log('Pill clicked:', { emailId, pillType });
    // In a real app, this would open a dropdown/modal to select or link the entity
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Greeting Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Good morning {userName}
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
        <TabsList className="grid w-fit grid-cols-2 mb-4">
          <TabsTrigger value="campaigns" className="px-6">
            Campaigns
          </TabsTrigger>
          <TabsTrigger value="communications" className="px-6">
            Communications
          </TabsTrigger>
        </TabsList>

        {/* Campaigns Tab Content */}
        <TabsContent value="campaigns" className="mt-0">
          <div className="flex flex-col gap-3">
            {campaigns.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                onReview={handleReview}
              />
            ))}
          </div>
        </TabsContent>

        {/* Communications Tab Content */}
        <TabsContent value="communications" className="mt-0">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-muted-foreground">
                Responses ({emailResponses.length})
              </h2>
            </div>
            <div className="flex flex-col gap-3">
              {emailResponses.map((email) => (
                <EmailResponseCard
                  key={email.id}
                  email={email}
                  onPillClick={handlePillClick}
                />
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
