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

// ============= MAIN COMPONENT =============

export default function DashboardPrototype() {
  const [activeTab, setActiveTab] = useState<'campaigns' | 'communications'>('campaigns');
  const [campaigns] = useState<Campaign[]>(mockCampaigns);

  const totalPendingEmails = campaigns.reduce((sum, c) => sum + c.totalEmails, 0);
  const userName = 'Stewart';

  const handleReview = (campaignId: string) => {
    console.log('Review campaign:', campaignId);
    // In a real app, this would navigate to the campaign review page
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
          <Card className="bg-white">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                Communications view coming soon...
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
