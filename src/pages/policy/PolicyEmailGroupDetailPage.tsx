import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
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
import { EmailDisplay, ResponseComposer } from '@/components/mail';
import { NotesSection } from '@/components/notes';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Mail,
  TrendingUp,
  BookOpen,
  Eye,
  ChevronDown,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function PolicyEmailGroupDetailPage() {
  const { groupId, campaignId } = useParams<{ groupId?: string; campaignId?: string }>();
  const { messages, campaigns, bulkResponses, messageRecipients } = useSupabase();

  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [researchExpanded, setResearchExpanded] = useState(true);

  const targetId = campaignId || (groupId ? decodeURIComponent(groupId) : '');

  // Get campaign info
  const campaign = useMemo(() => {
    return campaigns.find((c) => c.id === targetId);
  }, [campaigns, targetId]);

  // Get all messages in this campaign
  const groupMessages = useMemo(() => {
    return messages.filter((msg) => msg.campaign_id === targetId);
  }, [messages, targetId]);

  // Get existing bulk response
  const existingBulkResponse = useMemo(() => {
    return bulkResponses.find((br) => br.campaign_id === targetId);
  }, [bulkResponses, targetId]);

  // Get sender info helper
  const getSenderInfo = (messageId: string) => {
    const sender = messageRecipients.find(
      r => r.message_id === messageId && r.recipient_type === 'from'
    );
    return {
      name: sender?.name || 'Unknown',
      email: sender?.email_address || '',
    };
  };

  // Calculate stats
  const stats = useMemo(() => {
    const sentiments = ['positive', 'neutral', 'concerned'];
    const avgSentiment =
      sentiments[Math.floor(Math.random() * sentiments.length)];

    return {
      totalEmails: groupMessages.length,
      avgSentiment,
      keyTopics: campaign
        ? campaign.name.split(' ').slice(0, 2)
        : ['Policy', 'Legislation'],
    };
  }, [groupMessages, campaign]);

  const handleGenerateResearch = () => {
    console.log('Generating LLM research...');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleViewEmail = (message: any) => {
    setSelectedMessage(message);
    setShowEmailDialog(true);
  };

  if (groupMessages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Mail className="h-12 w-12 text-muted-foreground" />
        <p className="mt-4 text-lg font-medium">No messages found</p>
        <p className="text-sm text-muted-foreground">
          {campaign ? `Campaign "${campaign.name}" has no messages.` : 'This email group does not exist or has no messages.'}
        </p>
      </div>
    );
  }

  const representativeSubject = groupMessages[0].subject || '(No subject)';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {campaign?.name || representativeSubject}
        </h1>
        {campaign && (
          <Badge variant="secondary" className="mt-2">
            {campaign.status}
          </Badge>
        )}
      </div>

      {/* Summary Stats Bar */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Emails</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEmails}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Sentiment</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">
              {stats.avgSentiment}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Key Topics</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {stats.keyTopics.map((topic, idx) => (
                <Badge key={idx} variant="outline">
                  {topic}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* LLM & Hansard Research Section */}
      <Collapsible open={researchExpanded} onOpenChange={setResearchExpanded}>
        <Card>
          <CollapsibleTrigger className="w-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  LLM & Hansard Research
                </CardTitle>
                <CardDescription>
                  AI-generated research and parliamentary records
                </CardDescription>
              </div>
              <ChevronDown
                className={`h-5 w-5 transition-transform ${
                  researchExpanded ? 'rotate-180' : ''
                }`}
              />
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Simulated Research Results</AlertTitle>
                <AlertDescription>
                  This is placeholder text simulating LLM research results.
                </AlertDescription>
              </Alert>
              <div className="rounded-lg border bg-muted/50 p-4">
                <h4 className="font-semibold mb-2">Analysis Summary</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Public sentiment analysis suggests strong concern about{' '}
                  {campaign?.name.toLowerCase() || 'this policy area'}. Key themes
                  include urgency for action, impact on local communities, and
                  calls for parliamentary support.
                </p>
                <h4 className="font-semibold mb-2">Hansard Records</h4>
                <p className="text-sm text-muted-foreground">
                  Recent parliamentary debates show cross-party interest in this
                  topic. Notable mentions in Commons debates from the past month,
                  with several amendments proposed during committee stages.
                </p>
              </div>
              <Button onClick={handleGenerateResearch}>
                <Sparkles className="mr-2 h-4 w-4" />
                Regenerate Research
              </Button>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Drafting Section */}
      {existingBulkResponse?.status === 'sent' && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Response Already Sent</AlertTitle>
          <AlertDescription>
            A bulk response was sent to this group.
          </AlertDescription>
        </Alert>
      )}

      <ResponseComposer
        originalMessages={groupMessages}
        mode="campaign"
        campaignId={campaign?.id || targetId}
        recipientCount={stats.totalEmails}
      />

      {/* Team Notes */}
      <NotesSection campaignId={campaign?.id} maxHeight="300px" />

      {/* Individual Emails List */}
      <Card>
        <CardHeader>
          <CardTitle>Individual Emails</CardTitle>
          <CardDescription>
            All emails in this group ({groupMessages.length})
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>From</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupMessages.map((message) => {
                const sender = getSenderInfo(message.id);
                return (
                  <TableRow key={message.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{sender.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {sender.email}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-md truncate">
                      {message.subject || '(No subject)'}
                    </TableCell>
                    <TableCell>
                      {message.received_at ? new Date(message.received_at).toLocaleDateString() : 'Unknown'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{message.channel}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewEmail(message)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Email View Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Email Details</DialogTitle>
            <DialogDescription>
              View the full email content
            </DialogDescription>
          </DialogHeader>
          {selectedMessage && (
            <EmailDisplay
              html={selectedMessage.snippet || selectedMessage.body_search_text || ''}
              from={`${getSenderInfo(selectedMessage.id).name} <${getSenderInfo(selectedMessage.id).email}>`}
              date={formatDate(selectedMessage.received_at)}
              subject={selectedMessage.subject || '(No subject)'}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmailDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
