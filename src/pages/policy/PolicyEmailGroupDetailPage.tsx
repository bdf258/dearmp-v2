import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
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
import { Textarea } from '@/components/ui/textarea';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Mail,
  TrendingUp,
  BookOpen,
  Send,
  Eye,
  Save,
  ChevronDown,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function PolicyEmailGroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const { messages, campaigns, bulkResponses, currentUser } = useDummyData();

  const [draftSubject, setDraftSubject] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [researchExpanded, setResearchExpanded] = useState(true);

  const decodedGroupId = groupId ? decodeURIComponent(groupId) : '';

  // Get all messages in this group
  const groupMessages = useMemo(() => {
    return messages.filter((msg) => msg.fingerprint_hash === decodedGroupId);
  }, [messages, decodedGroupId]);

  // Get campaign info
  const campaign = useMemo(() => {
    return campaigns.find((c) => c.fingerprint_hash === decodedGroupId);
  }, [campaigns, decodedGroupId]);

  // Get existing bulk response
  const existingBulkResponse = useMemo(() => {
    return bulkResponses.find((br) => br.fingerprint_hash === decodedGroupId);
  }, [bulkResponses, decodedGroupId]);

  // Load existing draft if available
  useMemo(() => {
    if (existingBulkResponse && !draftSubject && !draftBody) {
      setDraftSubject(existingBulkResponse.subject);
      setDraftBody(existingBulkResponse.body_template);
    }
  }, [existingBulkResponse, draftSubject, draftBody]);

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

  const handleInsertToken = (token: string) => {
    setDraftBody((prev) => prev + `{{${token}}}`);
  };

  const handleGenerateResearch = () => {
    console.log('Generating LLM research...');
    // Placeholder for LLM research generation
  };

  const handlePreview = () => {
    setShowPreview(true);
  };

  const handleSaveDraft = () => {
    console.log('Saving draft...', { draftSubject, draftBody });
    // In a real app, this would save the draft
  };

  const handleSendToAll = () => {
    setShowSendDialog(true);
  };

  const confirmSend = () => {
    console.log('Sending to all recipients...', {
      subject: draftSubject,
      body: draftBody,
      recipients: groupMessages.length,
    });
    setShowSendDialog(false);
    // In a real app, this would trigger the bulk send
  };

  // Render preview with token replacement
  const renderPreview = () => {
    const sampleMessage = groupMessages[0];
    if (!sampleMessage) return draftBody;

    return draftBody
      .replace(/\{\{constituent_name\}\}/g, sampleMessage.from_name)
      .replace(/\{\{mp_name\}\}/g, currentUser?.name || 'MP Name');
  };

  if (groupMessages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Mail className="h-12 w-12 text-muted-foreground" />
        <p className="mt-4 text-lg font-medium">Group not found</p>
        <p className="text-sm text-muted-foreground">
          This email group does not exist or has no messages.
        </p>
      </div>
    );
  }

  const representativeSubject = groupMessages[0].subject;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {representativeSubject}
        </h1>
        {campaign && (
          <Badge variant="secondary" className="mt-2">
            {campaign.name}
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
                  This is dummy text simulating LLM research results.
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
      <Card>
        <CardHeader>
          <CardTitle>Draft Bulk Response</CardTitle>
          <CardDescription>
            Compose a response to send to all constituents in this group
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Subject */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Subject</label>
            <input
              type="text"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Re: Your message about..."
              value={draftSubject}
              onChange={(e) => setDraftSubject(e.target.value)}
            />
          </div>

          {/* Body */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Message Body</label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Insert Token
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>Personalization Tokens</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleInsertToken('constituent_name')}
                  >
                    Constituent Name
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleInsertToken('mp_name')}
                  >
                    MP Name
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Textarea
              placeholder="Dear {{constituent_name}},&#10;&#10;Thank you for contacting me about...&#10;&#10;Best regards,&#10;{{mp_name}}"
              className="min-h-[200px]"
              value={draftBody}
              onChange={(e) => setDraftBody(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-between">
            <div className="flex gap-2">
              <Button variant="outline" onClick={handlePreview}>
                <Eye className="mr-2 h-4 w-4" />
                Preview
              </Button>
              <Button variant="outline" onClick={handleSaveDraft}>
                <Save className="mr-2 h-4 w-4" />
                Save Draft
              </Button>
            </div>
            <Button
              onClick={handleSendToAll}
              disabled={!draftSubject || !draftBody}
            >
              <Send className="mr-2 h-4 w-4" />
              Send to All ({stats.totalEmails})
            </Button>
          </div>

          {existingBulkResponse?.status === 'sent' && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Response Already Sent</AlertTitle>
              <AlertDescription>
                A bulk response was sent to this group on{' '}
                {new Date(existingBulkResponse.sent_at || '').toLocaleString()}.
                Sent to {existingBulkResponse.sent_count} recipients.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

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
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupMessages.map((message) => (
                <TableRow key={message.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{message.from_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {message.from_email}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-md truncate">
                    {message.subject}
                  </TableCell>
                  <TableCell>
                    {new Date(message.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {message.assigned_to_user_id ? (
                      <Badge variant="secondary">Assigned</Badge>
                    ) : (
                      <Badge variant="outline">Unassigned</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Preview Email</DialogTitle>
            <DialogDescription>
              Preview how the email will look for a sample constituent
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-1">Subject:</p>
              <p className="text-sm bg-muted p-2 rounded">{draftSubject}</p>
            </div>
            <div>
              <p className="text-sm font-medium mb-1">Body:</p>
              <div className="text-sm bg-muted p-4 rounded whitespace-pre-wrap">
                {renderPreview()}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Confirmation Dialog */}
      <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Bulk Send</DialogTitle>
            <DialogDescription>
              Are you sure you want to send this email to all {stats.totalEmails}{' '}
              recipients? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSendDialog(false)}>
              Cancel
            </Button>
            <Button onClick={confirmSend}>
              <Send className="mr-2 h-4 w-4" />
              Confirm Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
