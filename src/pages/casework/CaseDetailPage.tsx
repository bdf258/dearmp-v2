import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSupabase } from '@/lib/SupabaseContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { MailThread } from '@/components/mail';
import { NotesSection } from '@/components/notes';
import {
  ArrowLeft,
  User,
  Building2,
  Mail,
  AlertCircle,
} from 'lucide-react';

export default function CaseDetailPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const { cases, profiles, constituents, constituentContacts, organizations, messages, caseParties } =
    useSupabase();

  // Find the case
  const caseData = cases.find((c) => c.id === caseId);

  // Get case messages
  const caseMessages = useMemo(() => {
    if (!caseId) return [];
    return messages
      .filter((m) => m.case_id === caseId)
      .sort((a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime());
  }, [caseId, messages]);

  // Get case parties
  const parties = useMemo(() => {
    if (!caseId) return { constituents: [], organizations: [] };
    const partiesForCase = caseParties.filter((cp) => cp.case_id === caseId);

    return {
      constituents: partiesForCase
        .filter((p) => p.constituent_id)
        .map((p) => {
          const constituent = constituents.find((c) => c.id === p.constituent_id);
          if (!constituent) return null;
          const contacts = constituentContacts.filter(cc => cc.constituent_id === constituent.id);
          const email = contacts.find(c => c.type === 'email')?.value || '';
          const phone = contacts.find(c => c.type === 'phone')?.value || '';
          return {
            ...constituent,
            email,
            phone,
            role: p.role,
          };
        })
        .filter(Boolean),
      organizations: partiesForCase
        .filter((p) => p.organization_id)
        .map((p) => {
          const org = organizations.find((o) => o.id === p.organization_id);
          if (!org) return null;
          return {
            ...org,
            role: p.role,
          };
        })
        .filter(Boolean),
    };
  }, [caseId, caseParties, constituents, constituentContacts, organizations]);

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
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'closed':
        return <Badge variant="default">Closed</Badge>;
      case 'archived':
        return <Badge>Archived</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <Badge variant="destructive">Urgent</Badge>;
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

  const getUserName = (userId: string | null) => {
    if (!userId) return 'Unassigned';
    const profile = profiles.find((p) => p.id === userId);
    return profile?.full_name || 'Unassigned';
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
            #{caseData.reference_number}
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
            <div className="text-sm">{getUserName(caseData.assigned_to)}</div>
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
                      {parties.constituents.map((constituent: any) => (
                        <div
                          key={constituent.id}
                          className="rounded-lg border p-3 space-y-1"
                        >
                          <div className="font-medium text-sm">
                            {constituent.full_name}
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {constituent.role}
                          </Badge>
                          {constituent.email && (
                            <div className="text-xs text-muted-foreground">
                              {constituent.email}
                            </div>
                          )}
                          {constituent.phone && (
                            <div className="text-xs text-muted-foreground">
                              {constituent.phone}
                            </div>
                          )}
                        </div>
                      ))}
                      {parties.constituents.length === 0 && (
                        <p className="text-sm text-muted-foreground">No constituents linked</p>
                      )}
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
                      {parties.organizations.map((org: any) => (
                        <div key={org.id} className="rounded-lg border p-3 space-y-1">
                          <div className="font-medium text-sm">{org.name}</div>
                          <Badge variant="outline" className="text-xs">
                            {org.role}
                          </Badge>
                          {org.type && (
                            <div className="text-xs text-muted-foreground">
                              Type: {org.type}
                            </div>
                          )}
                        </div>
                      ))}
                      {parties.organizations.length === 0 && (
                        <p className="text-sm text-muted-foreground">No organizations linked</p>
                      )}
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
                {caseData.description || 'No description provided'}
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
              {caseMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Mail className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold">No messages yet</h3>
                  <p className="text-sm text-muted-foreground">
                    Messages will appear here once communication begins
                  </p>
                </div>
              ) : (
                <MailThread
                  messages={caseMessages}
                  mode="casework"
                  caseId={caseId}
                  showComposer={true}
                />
              )}
            </CardContent>
          </Card>

          {/* Notes Section */}
          <NotesSection caseId={caseId} maxHeight="400px" />

          {/* Placeholders for future features */}
          <div className="grid gap-4 md:grid-cols-2">
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
