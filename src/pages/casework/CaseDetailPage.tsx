import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSupabase } from '@/lib/SupabaseContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { MailThread } from '@/components/mail';
import { NotesSection } from '@/components/notes';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  ArrowLeft,
  User,
  Building2,
  Mail,
  AlertCircle,
  Pencil,
  Plus,
  X,
  MapPin,
  Check,
} from 'lucide-react';

export default function CaseDetailPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const {
    cases,
    profiles,
    constituents,
    constituentContacts,
    organizations,
    messages,
    caseParties,
    createCaseParty,
    removeCaseParty,
    updateCase,
  } = useSupabase();

  // State for popovers
  const [constituentPopoverOpen, setConstituentPopoverOpen] = useState(false);
  const [organizationPopoverOpen, setOrganizationPopoverOpen] = useState(false);
  const [assigneePopoverOpen, setAssigneePopoverOpen] = useState(false);

  // Find the case
  const caseData = cases.find((c) => c.id === caseId);

  // Get case messages
  const caseMessages = useMemo(() => {
    if (!caseId) return [];
    return messages
      .filter((m) => m.case_id === caseId)
      .sort((a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime());
  }, [caseId, messages]);

  // Get case parties with full data
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
          const address = contacts.find(c => c.type === 'address')?.value || '';
          // Consider a constituent "confirmed" if they have both email and address
          const isConfirmed = !!(email && address);
          return {
            ...constituent,
            email,
            phone,
            address,
            role: p.role,
            partyId: p.id,
            isConfirmed,
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
            partyId: p.id,
          };
        })
        .filter(Boolean),
    };
  }, [caseId, caseParties, constituents, constituentContacts, organizations]);

  // Get constituents not already linked to this case
  const availableConstituents = useMemo(() => {
    const linkedIds = new Set(parties.constituents.map((c: any) => c.id));
    return constituents.filter(c => !linkedIds.has(c.id));
  }, [constituents, parties.constituents]);

  // Get organizations not already linked to this case
  const availableOrganizations = useMemo(() => {
    const linkedIds = new Set(parties.organizations.map((o: any) => o.id));
    return organizations.filter(o => !linkedIds.has(o.id));
  }, [organizations, parties.organizations]);

  // Handle adding a constituent to the case
  const handleAddConstituent = async (constituentId: string) => {
    if (!caseId) return;
    await createCaseParty({
      case_id: caseId,
      constituent_id: constituentId,
      role: 'constituent',
    });
    setConstituentPopoverOpen(false);
  };

  // Handle adding an organization to the case
  const handleAddOrganization = async (organizationId: string) => {
    if (!caseId) return;
    await createCaseParty({
      case_id: caseId,
      organization_id: organizationId,
      role: 'organization',
    });
    setOrganizationPopoverOpen(false);
  };

  // Handle removing a party from the case
  const handleRemoveParty = async (partyId: string) => {
    await removeCaseParty(partyId);
  };

  // Handle changing the assignee
  const handleChangeAssignee = async (profileId: string | null) => {
    if (!caseId) return;
    await updateCase(caseId, { assigned_to: profileId });
    setAssigneePopoverOpen(false);
  };

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

  const getStatusBadge = (status: string | null) => {
    if (!status) return <Badge variant="outline">Unknown</Badge>;
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

  const getPriorityBadge = (priority: string | null) => {
    if (!priority) return <Badge variant="outline">Unknown</Badge>;
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
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <span>Assigned To</span>
              <Popover open={assigneePopoverOpen} onOpenChange={setAssigneePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <Pencil className="h-3 w-3" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[250px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search staff..." />
                    <CommandList>
                      <CommandEmpty>No staff found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          onSelect={() => handleChangeAssignee(null)}
                          className="flex items-center gap-2"
                        >
                          <X className="h-4 w-4 text-muted-foreground" />
                          <span>Unassigned</span>
                          {!caseData.assigned_to && <Check className="ml-auto h-4 w-4" />}
                        </CommandItem>
                        {profiles.map((profile) => (
                          <CommandItem
                            key={profile.id}
                            onSelect={() => handleChangeAssignee(profile.id)}
                            className="flex items-center gap-2"
                          >
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span>{profile.full_name || 'Unknown'}</span>
                            {caseData.assigned_to === profile.id && (
                              <Check className="ml-auto h-4 w-4" />
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </CardTitle>
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
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Constituents
                      </h3>
                      <Popover open={constituentPopoverOpen} onOpenChange={setConstituentPopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            <Plus className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search constituents..." />
                            <CommandList>
                              <CommandEmpty>No constituents found.</CommandEmpty>
                              <CommandGroup>
                                {availableConstituents.map((constituent) => {
                                  const contacts = constituentContacts.filter(
                                    cc => cc.constituent_id === constituent.id
                                  );
                                  const email = contacts.find(c => c.type === 'email')?.value;
                                  return (
                                    <CommandItem
                                      key={constituent.id}
                                      onSelect={() => handleAddConstituent(constituent.id)}
                                      className="flex flex-col items-start gap-1"
                                    >
                                      <span className="font-medium">{constituent.full_name}</span>
                                      {email && (
                                        <span className="text-xs text-muted-foreground">
                                          {email}
                                        </span>
                                      )}
                                    </CommandItem>
                                  );
                                })}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-3">
                      {parties.constituents.map((constituent: any) => (
                        <div
                          key={constituent.id}
                          className="rounded-lg border p-3 space-y-2"
                        >
                          <div className="flex items-start justify-between">
                            <div className="font-medium text-sm">
                              {constituent.full_name}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 text-muted-foreground hover:text-destructive"
                              onClick={() => handleRemoveParty(constituent.partyId)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                          {constituent.email && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              {constituent.email}
                            </div>
                          )}
                          {constituent.address && (
                            <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                              <span>{constituent.address}</span>
                            </div>
                          )}
                          <div className="pt-1">
                            {constituent.isConfirmed ? (
                              <Badge className="text-[10px] px-1.5 py-0.5 bg-green-400 hover:bg-green-400 text-white">
                                Confirmed constituent
                              </Badge>
                            ) : (
                              <Badge className="text-[10px] px-1.5 py-0.5 bg-red-400 hover:bg-red-400 text-white">
                                Unconfirmed constituent
                              </Badge>
                            )}
                          </div>
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
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Organizations
                      </h3>
                      <Popover open={organizationPopoverOpen} onOpenChange={setOrganizationPopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            <Plus className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search organizations..." />
                            <CommandList>
                              <CommandEmpty>No organizations found.</CommandEmpty>
                              <CommandGroup>
                                {availableOrganizations.map((org) => (
                                  <CommandItem
                                    key={org.id}
                                    onSelect={() => handleAddOrganization(org.id)}
                                    className="flex flex-col items-start gap-1"
                                  >
                                    <span className="font-medium">{org.name}</span>
                                    {org.type && (
                                      <span className="text-xs text-muted-foreground">
                                        {org.type}
                                      </span>
                                    )}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-3">
                      {parties.organizations.map((org: any) => (
                        <div key={org.id} className="rounded-lg border p-3 space-y-1">
                          <div className="flex items-start justify-between">
                            <div className="font-medium text-sm">{org.name}</div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 text-muted-foreground hover:text-destructive"
                              onClick={() => handleRemoveParty(org.partyId)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                          {org.type && (
                            <div className="text-xs text-muted-foreground">
                              Type: {org.type}
                            </div>
                          )}
                          {org.website && (
                            <div className="text-xs text-muted-foreground">
                              {org.website}
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
