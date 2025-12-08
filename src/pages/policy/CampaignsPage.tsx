import { useNavigate } from 'react-router-dom';
import { useDummyData } from '@/lib/useDummyData';
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
import { Flag, ArrowRight, Mail } from 'lucide-react';

export default function CampaignsPage() {
  const { campaigns, messages } = useDummyData();
  const navigate = useNavigate();

  // Calculate email counts per campaign
  const getCampaignEmailCount = (campaignId: string) => {
    return messages.filter(
      (msg) => msg.campaign_id === campaignId ||
        campaigns.find(c => c.id === campaignId)?.fingerprint_hash === msg.fingerprint_hash
    ).length;
  };

  const handleViewCampaign = (campaignId: string) => {
    navigate(`/policy/campaign/${campaignId}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground">
            Manage coordinated email campaigns and bulk responses
          </p>
        </div>
        <Button>
          <Flag className="mr-2 h-4 w-4" />
          New Campaign
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {campaigns.map((campaign) => {
          const emailCount = getCampaignEmailCount(campaign.id);
          return (
            <Card key={campaign.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-xl">{campaign.name}</CardTitle>
                    <Badge
                      variant={campaign.status === 'active' ? 'default' : 'secondary'}
                    >
                      {campaign.status}
                    </Badge>
                  </div>
                  <Flag className="h-5 w-5 text-muted-foreground" />
                </div>
                <CardDescription className="line-clamp-2">
                  {campaign.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center text-muted-foreground">
                      <Mail className="mr-2 h-4 w-4" />
                      <span>Emails</span>
                    </div>
                    <span className="font-semibold">{emailCount}</span>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => handleViewCampaign(campaign.id)}
                  >
                    View Campaign
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {campaigns.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Flag className="h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-lg font-medium">No campaigns yet</p>
            <p className="text-sm text-muted-foreground">
              Create your first campaign to start organizing policy emails.
            </p>
            <Button className="mt-4">
              <Flag className="mr-2 h-4 w-4" />
              Create Campaign
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Detailed Table View */}
      {campaigns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>All Campaigns</CardTitle>
            <CardDescription>
              Detailed view of all active and inactive campaigns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Emails</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => {
                  const emailCount = getCampaignEmailCount(campaign.id);
                  return (
                    <TableRow key={campaign.id}>
                      <TableCell className="font-medium">
                        {campaign.name}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            campaign.status === 'active' ? 'default' : 'secondary'
                          }
                        >
                          {campaign.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-md truncate">
                        {campaign.description}
                      </TableCell>
                      <TableCell className="text-right">{emailCount}</TableCell>
                      <TableCell>
                        {new Date(campaign.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewCampaign(campaign.id)}
                        >
                          View
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
