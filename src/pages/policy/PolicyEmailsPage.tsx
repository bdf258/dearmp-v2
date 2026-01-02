import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabase } from '@/lib/SupabaseContext';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Mail, ArrowRight, Inbox, Tag as TagIcon } from 'lucide-react';

interface EmailGroup {
  campaign_id: string | null;
  count: number;
  subject: string;
  theme: string;
  campaign_name?: string;
  latest_date: string;
}

export default function PolicyEmailsPage() {
  const { messages, campaigns } = useSupabase();
  const navigate = useNavigate();

  // Group policy emails by campaign_id
  const emailGroups = useMemo(() => {
    const groups = new Map<string, EmailGroup>();

    messages
      .filter((msg) => msg.campaign_id)
      .forEach((msg) => {
        const campaignId = msg.campaign_id!;
        const existing = groups.get(campaignId);

        if (existing) {
          existing.count += 1;
          if (msg.received_at && new Date(msg.received_at) > new Date(existing.latest_date)) {
            existing.latest_date = msg.received_at;
          }
        } else {
          const campaign = campaigns.find((c) => c.id === campaignId);

          // Determine theme from subject
          let theme = 'General Policy';
          const subject = msg.subject?.toLowerCase() || '';
          if (subject.includes('climate')) {
            theme = 'Climate & Environment';
          } else if (subject.includes('nhs') || subject.includes('healthcare')) {
            theme = 'Healthcare';
          } else if (subject.includes('education') || subject.includes('school')) {
            theme = 'Education';
          } else if (subject.includes('transport')) {
            theme = 'Transport';
          } else if (subject.includes('housing')) {
            theme = 'Housing';
          }

          groups.set(campaignId, {
            campaign_id: campaignId,
            count: 1,
            subject: msg.subject || '(No subject)',
            theme,
            campaign_name: campaign?.name,
            latest_date: msg.received_at ?? new Date().toISOString(),
          });
        }
      });

    return Array.from(groups.values()).sort((a, b) => b.count - a.count);
  }, [messages, campaigns]);

  const handleViewGroup = (campaignId: string) => {
    navigate(`/policy/campaign/${encodeURIComponent(campaignId)}`);
  };

  const totalPolicyEmails = messages.filter((msg) => msg.campaign_id).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Policy Emails</h1>
        <p className="text-muted-foreground">
          View and manage policy emails grouped by campaign
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Policy Emails</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPolicyEmails}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Email Groups</CardTitle>
            <Inbox className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{emailGroups.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
            <TagIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {campaigns.filter((c) => c.status === 'active').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Email Groups */}
      <Card>
        <CardHeader>
          <CardTitle>Email Groups</CardTitle>
          <CardDescription>
            Policy emails grouped by campaign
          </CardDescription>
        </CardHeader>
        <CardContent>
          {emailGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Inbox className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-lg font-medium">No policy emails yet</p>
              <p className="text-sm text-muted-foreground">
                Policy emails will appear here when they arrive.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Representative Subject</TableHead>
                  <TableHead>Theme</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                  <TableHead>Latest</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {emailGroups.map((group) => (
                  <TableRow key={group.campaign_id}>
                    <TableCell className="max-w-md">
                      <button
                        onClick={() => group.campaign_id && handleViewGroup(group.campaign_id)}
                        className="text-left font-medium hover:underline"
                      >
                        {group.subject}
                      </button>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{group.theme}</Badge>
                    </TableCell>
                    <TableCell>
                      {group.campaign_name ? (
                        <Badge variant="secondary">{group.campaign_name}</Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          No campaign
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="default">{group.count}</Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(group.latest_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => group.campaign_id && handleViewGroup(group.campaign_id)}
                      >
                        View Group
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
