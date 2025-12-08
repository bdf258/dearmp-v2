import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDummyData } from '@/lib/useDummyData';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  User,
  Building2,
  Mail,
  Calendar,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Reply,
} from 'lucide-react';

export default function CaseDetailPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const { cases, users, constituents, organizations, messages, case_parties } =
    useDummyData();

  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());

  // Find the case
  const caseData = cases.find((c) => c.id === caseId);

  // Get case messages
  const caseMessages = useMemo(() => {
    if (!caseId) return [];
    return messages
      .filter((m) => m.case_id === caseId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [caseId, messages]);

  // Group messages by thread
  const messageThreads = useMemo(() => {
    const threads: { [key: string]: typeof caseMessages } = {};
    caseMessages.forEach((msg) => {
      const threadId = msg.thread_id || msg.id;
      if (!threads[threadId]) {
        threads[threadId] = [];
      }
      threads[threadId].push(msg);
    });
    return Object.values(threads);
  }, [caseMessages]);

  // Get case parties
  const caseParties = useMemo(() => {
    if (!caseId) return { constituents: [], organizations: [] };
    const parties = case_parties.filter((cp) => cp.case_id === caseId);

    return {
      constituents: parties
        .filter((p) => p.party_type === 'constituent')
        .map((p) => ({
          ...constituents.find((c) => c.id === p.party_id)!,
          role: p.role,
        }))
        .filter(Boolean),
      organizations: parties
        .filter((p) => p.party_type === 'organization')
        .map((p) => ({
          ...organizations.find((o) => o.id === p.party_id)!,
          role: p.role,
        }))
        .filter(Boolean),
    };
  }, [caseId, case_parties, constituents, organizations]);

  if (!caseData) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold">Case not found</h2>
        <p className="text-muted-foreground mb-4">
          The case you're looking for doesn't exist
        </p>
        <Button onClick={() => navigate('/casework/cases')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Cases
        </Button>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <Badge variant="outline">Open</Badge>;
      case 'in_progress':
        return <Badge variant="secondary">In Progress</Badge>;
      case 'closed':
        return <Badge variant="default">Closed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <Badge variant="destructive">High</Badge>;
      case 'medium':
        return <Badge variant="secondary">Medium</Badge>;
      case 'low':
        return <Badge variant="outline">Low</Badge>;
      default:
        return <Badge>{priority}</Badge>;
    }
  };

  const getUserName = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    return user?.name || 'Unassigned';
  };

  const toggleMessageExpanded = (messageId: string) => {
    setExpandedMessages((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/casework/cases')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{caseData.title}</h1>
          <p className="text-muted-foreground font-mono text-sm">
            {caseData.reference_number}
          </p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
          </CardHeader>
          <CardContent>{getStatusBadge(caseData.status)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Priority</CardTitle>
          </CardHeader>
          <CardContent>{getPriorityBadge(caseData.priority)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Assigned To</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">{getUserName(caseData.assigned_to_user_id)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Created</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">{formatDate(caseData.created_at)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              {caseData.closed_at ? 'Closed' : 'Last Updated'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              {formatDate(caseData.closed_at || caseData.updated_at)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-4">
        {/* Left Sidebar - Case Participants */}
        <div className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Participants</CardTitle>
              <CardDescription>People and organizations involved</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-6">
                  {/* Constituents */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Constituents
                    </h3>
                    <div className="space-y-3">
                      {caseParties.constituents.map((constituent) => (
                        <div
                          key={constituent.id}
                          className="rounded-lg border p-3 space-y-1"
                        >
                          <div className="font-medium text-sm">
                            {constituent.first_name} {constituent.last_name}
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {constituent.role}
                          </Badge>
                          <div className="text-xs text-muted-foreground">
                            {constituent.email}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {constituent.phone}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Organizations */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Organizations
                    </h3>
                    <div className="space-y-3">
                      {caseParties.organizations.map((org) => (
                        <div key={org.id} className="rounded-lg border p-3 space-y-1">
                          <div className="font-medium text-sm">{org.name}</div>
                          <Badge variant="outline" className="text-xs">
                            {org.role}
                          </Badge>
                          <div className="text-xs text-muted-foreground">
                            Contact: {org.contact_name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {org.contact_email}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Main Content - Messages and Threads */}
        <div className="lg:col-span-3 space-y-6">
          {/* Case Description */}
          <Card>
            <CardHeader>
              <CardTitle>Case Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {caseData.description}
              </p>
            </CardContent>
          </Card>

          {/* Message Threads */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Messages ({caseMessages.length})
              </CardTitle>
              <CardDescription>
                All correspondence related to this case
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[800px]">
                <div className="space-y-4">
                  {messageThreads.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Mail className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold">No messages yet</h3>
                      <p className="text-sm text-muted-foreground">
                        Messages will appear here once communication begins
                      </p>
                    </div>
                  ) : (
                    messageThreads.map((thread, threadIndex) => (
                      <div key={threadIndex} className="space-y-2">
                        {thread.map((message, msgIndex) => {
                          const isExpanded = expandedMessages.has(message.id);
                          const isInbound = message.direction === 'inbound';

                          return (
                            <div
                              key={message.id}
                              className={`rounded-lg border ${
                                isInbound ? 'bg-background' : 'bg-muted/50'
                              } ${msgIndex > 0 ? 'ml-8' : ''}`}
                            >
                              <div
                                className="p-4 cursor-pointer"
                                onClick={() => toggleMessageExpanded(message.id)}
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 space-y-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-sm">
                                        {isInbound ? (
                                          <>From: {message.from_name}</>
                                        ) : (
                                          <>To: {message.to_name}</>
                                        )}
                                      </span>
                                      <Badge
                                        variant={
                                          isInbound ? 'outline' : 'secondary'
                                        }
                                        className="text-xs"
                                      >
                                        {isInbound ? 'Inbound' : 'Outbound'}
                                      </Badge>
                                    </div>
                                    <div className="text-sm font-medium">
                                      {message.subject}
                                    </div>
                                    {!isExpanded && (
                                      <div className="text-sm text-muted-foreground truncate">
                                        {message.snippet}
                                      </div>
                                    )}
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                      <Calendar className="h-3 w-3" />
                                      {formatDate(message.created_at)}
                                    </div>
                                  </div>
                                  <Button variant="ghost" size="sm">
                                    {isExpanded ? (
                                      <ChevronUp className="h-4 w-4" />
                                    ) : (
                                      <ChevronDown className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>

                                {isExpanded && (
                                  <div className="mt-4 space-y-4">
                                    <Separator />
                                    <div className="text-sm whitespace-pre-wrap">
                                      {message.body}
                                    </div>
                                    <Separator />
                                    <div className="flex gap-2">
                                      <Button size="sm" variant="outline">
                                        <Reply className="mr-2 h-4 w-4" />
                                        Reply
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Placeholders for future features */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Internal notes (coming soon)
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Tasks</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Case tasks (coming soon)
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Attachments</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  File attachments (coming soon)
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
