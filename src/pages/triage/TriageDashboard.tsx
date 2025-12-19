/**
 * TriageDashboard
 *
 * Main triage landing page with three sections:
 * - Campaigns: Bulk campaign emails to review
 * - Responses: Emails responding to existing cases
 * - New Cases: Emails that need new cases created
 *
 * Uses production components from components/triage.
 */

import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabase } from '@/lib/SupabaseContext';
import {
  useCampaignsWithTriageCounts,
  useTriageQueue,
} from '@/hooks/triage/useTriage';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  CampaignCard,
  CaseEmailCard,
  type CampaignCardData,
  type CaseEmailData,
} from '@/components/triage';
import { TriageSkeletons } from '@/components/triage';
import { Flag, MessageSquare, FilePlus } from 'lucide-react';

// ============= TYPES =============

type DashboardTab = 'campaigns' | 'responses' | 'new-cases';

// ============= HOOKS =============

/**
 * Transforms triage messages into CaseEmailData format for the CaseEmailCard component.
 */
function useTriageEmailData() {
  const { messages: allMessages, isLoading } = useTriageQueue();
  const { cases, profiles, caseParties } = useSupabase();

  // Separate messages into responses (has constituent + case) and new cases
  const { responseEmails, newCaseEmails } = useMemo(() => {
    const responses: CaseEmailData[] = [];
    const newCases: CaseEmailData[] = [];

    allMessages.forEach((message) => {
      // Determine constituent pill status
      let constituentStatus: CaseEmailData['constituent']['status'];
      if (message.senderConstituent) {
        // Has a confirmed constituent
        constituentStatus = message.triage_status === 'confirmed' ? 'approved' : 'determined';
      } else if (message.constituentStatus === 'has_address') {
        constituentStatus = 'uncertain_with_address';
      } else {
        constituentStatus = 'uncertain_no_address';
      }

      // Find linked case info
      const linkedCase = message.case_id
        ? cases.find(c => c.id === message.case_id)
        : null;

      // Determine case pill status
      let caseStatus: CaseEmailData['case']['status'];
      let caseNumber: string | undefined;
      if (linkedCase) {
        caseStatus = message.triage_status === 'confirmed' ? 'approved' : 'determined';
        caseNumber = linkedCase.reference_number?.toString() || linkedCase.title.slice(0, 20);
      } else {
        caseStatus = 'uncertain';
        caseNumber = undefined;
      }

      // Find assigned caseworker
      const assignee = linkedCase?.assigned_to
        ? profiles.find(p => p.id === linkedCase.assigned_to)
        : null;

      // Determine caseworker pill status
      let caseworkerStatus: CaseEmailData['caseworker']['status'];
      let caseworkerName: string | undefined;
      if (assignee) {
        caseworkerStatus = message.triage_status === 'confirmed' ? 'approved' : 'determined';
        caseworkerName = assignee.full_name || 'Unknown';
      } else {
        caseworkerStatus = 'uncertain';
        caseworkerName = undefined;
      }

      const emailData: CaseEmailData = {
        id: message.id,
        subject: message.subject || '(No subject)',
        preview: message.snippet || '',
        fromEmail: message.senderEmail,
        fromName: message.senderName,
        receivedAt: message.received_at,
        isSelected: false,
        constituent: {
          status: constituentStatus,
          name: message.senderConstituent?.full_name,
          id: message.senderConstituent?.id,
        },
        case: {
          status: caseStatus,
          caseNumber,
          caseId: linkedCase?.id,
        },
        caseworker: {
          status: caseworkerStatus,
          name: caseworkerName,
          id: assignee?.id,
        },
      };

      // Categorize: responses have both constituent and case, new cases don't
      const hasConstituent = message.senderConstituent !== null;
      const hasCase = linkedCase !== null;

      if (hasConstituent && hasCase) {
        responses.push(emailData);
      } else {
        newCases.push(emailData);
      }
    });

    return { responseEmails: responses, newCaseEmails: newCases };
  }, [allMessages, cases, profiles, caseParties]);

  return {
    responseEmails,
    newCaseEmails,
    isLoading,
  };
}

// ============= COMPONENT =============

export function TriageDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<DashboardTab>('campaigns');
  const { loading, user } = useSupabase();

  // Campaign data
  const { campaigns: rawCampaigns } = useCampaignsWithTriageCounts();

  // Transform to CampaignCardData format
  const campaigns: CampaignCardData[] = useMemo(() => {
    return rawCampaigns.map(c => ({
      id: c.id,
      name: c.name,
      totalCount: c.totalCount,
      knownCount: c.knownCount,
      hasAddressCount: c.hasAddressCount,
      noAddressCount: c.noAddressCount,
    }));
  }, [rawCampaigns]);

  // Email data for responses and new cases tabs
  const { responseEmails, newCaseEmails, isLoading: emailsLoading } = useTriageEmailData();

  // Total pending count for greeting
  const totalPendingEmails = useMemo(() => {
    const campaignTotal = campaigns.reduce((sum, c) => sum + c.totalCount, 0);
    return campaignTotal + responseEmails.length + newCaseEmails.length;
  }, [campaigns, responseEmails, newCaseEmails]);

  // Get user's first name for greeting
  const userName = useMemo(() => {
    if (!user) return 'there';
    // Try to get first name from user metadata or email
    const fullName = (user.user_metadata?.full_name as string) || '';
    if (fullName) {
      return fullName.split(' ')[0];
    }
    return user.email?.split('@')[0] || 'there';
  }, [user]);

  // Get greeting based on time of day
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  // Navigation handlers
  const handleCampaignClick = useCallback((campaignId: string) => {
    navigate(`/triage/campaigns/${campaignId}`);
  }, [navigate]);

  const handleEmailClick = useCallback((emailId: string) => {
    navigate(`/triage/messages/${emailId}`);
  }, [navigate]);

  if (loading || emailsLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="h-8 w-64 bg-muted animate-pulse rounded" />
          <div className="h-5 w-48 bg-muted animate-pulse rounded" />
        </div>
        <TriageSkeletons.MessageList count={6} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Greeting Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {greeting}, {userName}
        </h1>
        <p className="text-muted-foreground">
          {totalPendingEmails > 0
            ? `There are ${totalPendingEmails} new emails to triage.`
            : 'All caught up! No emails to triage.'}
        </p>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as DashboardTab)}
        className="w-full"
      >
        <TabsList className="flex flex-row w-fit mb-4">
          <TabsTrigger value="campaigns" className="px-6 gap-2">
            <Flag className="h-4 w-4" />
            Campaigns
            {campaigns.length > 0 && (
              <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded-full">
                {campaigns.length}
              </span>
            )}
          </TabsTrigger>
          <Separator orientation="vertical" className="h-6 mx-2" />
          <TabsTrigger value="responses" className="px-6 gap-2">
            <MessageSquare className="h-4 w-4" />
            Responses
            {responseEmails.length > 0 && (
              <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded-full">
                {responseEmails.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="new-cases" className="px-6 gap-2">
            <FilePlus className="h-4 w-4" />
            New cases
            {newCaseEmails.length > 0 && (
              <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded-full">
                {newCaseEmails.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Campaigns Tab */}
        <TabsContent value="campaigns" className="mt-0">
          {campaigns.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Flag className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No campaign emails to review</p>
              <p className="text-sm">Campaign emails will appear here when they arrive.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {campaigns.map((campaign) => (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  onClick={() => handleCampaignClick(campaign.id)}
                  onReviewClick={() => handleCampaignClick(campaign.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Responses Tab */}
        <TabsContent value="responses" className="mt-0">
          {responseEmails.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No responses to triage</p>
              <p className="text-sm">Responses to existing cases will appear here.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {responseEmails.map((email) => (
                <CaseEmailCard
                  key={email.id}
                  email={email}
                  onClick={() => handleEmailClick(email.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* New Cases Tab */}
        <TabsContent value="new-cases" className="mt-0">
          {newCaseEmails.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FilePlus className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No new cases to create</p>
              <p className="text-sm">Emails that need new cases will appear here.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {newCaseEmails.map((email) => (
                <CaseEmailCard
                  key={email.id}
                  email={email}
                  onClick={() => handleEmailClick(email.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default TriageDashboard;
