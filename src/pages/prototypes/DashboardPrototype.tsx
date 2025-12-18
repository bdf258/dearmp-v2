/**
 * Dashboard Prototype: Campaign Dashboard with Menubar
 *
 * Concept: Main dashboard view with greeting, tabs for Campaigns/Communications,
 * and campaign cards showing email counts and constituent breakdown.
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  Flag,
  MapPin,
  ArrowLeft,
  Mail,
  Check,
  X,
  MapPinOff,
  User,
  HelpCircle,
  CircleUser,
  Palette,
  FileText,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@radix-ui/react-separator';

// Import shared data
import {
  dashboardCampaigns,
  responseEmails as initialResponseEmails,
  newCaseEmails as initialNewCaseEmails,
  caseworkers,
  tags,
  type DashboardCampaign,
  type ResponseEmail,
} from './prototypeData';

// Use type alias for Campaign to match the imported DashboardCampaign
type Campaign = DashboardCampaign;

// ============= HELPER COMPONENTS =============

function CampaignCard({
  campaign,
  onClick,
}: {
  campaign: Campaign;
  onClick: () => void;
}) {
  const knownCount = campaign.emails.filter(e => e.constituentStatus === 'known' && e.status === 'pending').length;
  const hasAddressCount = campaign.emails.filter(e => e.constituentStatus === 'has_address' && e.status === 'pending').length;
  const noAddressCount = campaign.emails.filter(e => e.constituentStatus === 'no_address' && e.status === 'pending').length;
  const totalEmails = campaign.emails.filter(e => e.status === 'pending').length;

  return (
    <Card
      className="hover:shadow-md transition-all border bg-white cursor-pointer"
      onClick={onClick}
    >
      <CardContent className="p-3 flex items-center gap-3">
        <Flag className="h-4 w-4 text-muted-foreground shrink-0" />
        <h3 className="text-sm font-medium truncate flex-1">{campaign.name}</h3>

        {/* Email count badge */}
        <Badge
          variant="outline"
          className="rounded-full h-6 w-6 p-0 flex items-center justify-center text-xs font-semibold"
        >
          {totalEmails}
        </Badge>

        {/* Stats */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <User className="h-3 w-3 text-gray-700" />
            <span>{knownCount.toString().padStart(2, '0')}</span>
          </span>
          <span className="text-muted-foreground/50">|</span>
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3 text-gray-500" />
            <span>{hasAddressCount.toString().padStart(2, '0')}</span>
          </span>
          <span className="text-muted-foreground/50">|</span>
          <span className="flex items-center gap-1">
            <MapPinOff className="h-3 w-3 text-gray-500" />
            <span>{noAddressCount.toString().padStart(2, '0')}</span>
          </span>
        </div>

        {/* Review button */}
        <Button
          size="sm"
          className="h-7 px-3 text-xs shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
        >
          Review
        </Button>
      </CardContent>
    </Card>
  );
}

// Constituent Pill Component
function ConstituentPill({ constituent }: { constituent: ResponseEmail['constituent'] }) {
  switch (constituent.status) {
    case 'approved':
      return (
        <Badge variant="outline" className="bg-white border-gray-300 text-gray-700 gap-1 shrink-0">
          <User className="h-3 w-3" />
          {constituent.name}
        </Badge>
      );
    case 'determined':
      return (
        <Badge variant="outline" className="bg-gray-300 border-gray-400 text-gray-700 gap-1 shrink-0">
          <HelpCircle className="h-3 w-3" />
          {constituent.name}
        </Badge>
      );
    case 'uncertain_with_address':
      return (
        <Badge variant="outline" className="bg-gray-500 border-dashed border-gray-600 text-white gap-1 shrink-0">
          <MapPin className="h-3 w-3" />
          Create constituent
        </Badge>
      );
    case 'uncertain_no_address':
      return (
        <Badge variant="outline" className="bg-gray-500 border-dashed border-gray-600 text-white gap-1 shrink-0">
          <MapPinOff className="h-3 w-3" />
          Request address
        </Badge>
      );
  }
}

// Case Pill Component
function CasePill({ caseInfo }: { caseInfo: ResponseEmail['case'] }) {
  switch (caseInfo.status) {
    case 'approved':
      return (
        <Badge variant="outline" className="bg-white border-gray-300 text-gray-700 gap-1 shrink-0">
          <FileText className="h-3 w-3" />
          {caseInfo.caseNumber}
        </Badge>
      );
    case 'determined':
      return (
        <Badge variant="outline" className="bg-gray-300 border-gray-400 text-gray-700 gap-1 shrink-0">
          <FileText className="h-3 w-3" />
          {caseInfo.caseNumber}
        </Badge>
      );
    case 'uncertain':
      return (
        <Badge variant="outline" className="bg-gray-500 border-dashed border-gray-600 text-white gap-1 shrink-0">
          <HelpCircle className="h-3 w-3" />
          {caseInfo.caseNumber || 'New case'}
        </Badge>
      );
  }
}

// Caseworker Pill Component
function CaseworkerPill({ caseworker }: { caseworker: ResponseEmail['caseworker'] }) {
  switch (caseworker.status) {
    case 'approved':
      return (
        <Badge variant="outline" className="bg-white border-gray-300 text-gray-700 gap-1 shrink-0">
          <CircleUser className="h-3 w-3" />
          {caseworker.name}
        </Badge>
      );
    case 'determined':
      return (
        <Badge variant="outline" className="bg-gray-300 border-gray-400 text-gray-700 gap-1 shrink-0">
          <CircleUser className="h-3 w-3" />
          {caseworker.name}
        </Badge>
      );
    case 'uncertain':
      return (
        <Badge variant="outline" className="bg-gray-500 border-dashed border-gray-600 text-white gap-1 shrink-0">
          <HelpCircle className="h-3 w-3" />
          Assign case
        </Badge>
      );
  }
}

// Pill Showcase Modal Component
function PillShowcaseModal() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Palette className="h-4 w-4" />
          Pill Styles
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Pill Component States</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          {/* Legend */}
          <div className="text-xs text-muted-foreground space-y-1 p-3 bg-muted/30 rounded">
            <div><strong>Approved:</strong> White background, solid border (human confirmed)</div>
            <div><strong>Determined:</strong> Gray-300 background, gray-400 border (system matched)</div>
            <div><strong>Uncertain:</strong> Gray-500 background, dashed gray-600 border (needs action)</div>
          </div>

          {/* Constituent Pills */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Constituent
            </h3>
            <div className="grid grid-cols-1 gap-2">
              <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                <span className="text-sm text-muted-foreground">Approved</span>
                <Badge variant="outline" className="bg-white border-gray-300 text-gray-700 gap-1">
                  <User className="h-3 w-3" />
                  Maria Santos
                </Badge>
              </div>
              <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                <span className="text-sm text-muted-foreground">Determined</span>
                <Badge variant="outline" className="bg-gray-300 border-gray-400 text-gray-700 gap-1">
                  <HelpCircle className="h-3 w-3" />
                  James Okonkwo
                </Badge>
              </div>
              <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                <span className="text-sm text-muted-foreground">Uncertain (has address)</span>
                <Badge variant="outline" className="bg-gray-500 border-dashed border-gray-600 text-white gap-1">
                  <MapPin className="h-3 w-3" />
                  Create constituent
                </Badge>
              </div>
              <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                <span className="text-sm text-muted-foreground">Uncertain (no address)</span>
                <Badge variant="outline" className="bg-gray-500 border-dashed border-gray-600 text-white gap-1">
                  <MapPinOff className="h-3 w-3" />
                  Request address
                </Badge>
              </div>
            </div>
          </div>

          {/* Case Pills */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Case
            </h3>
            <div className="grid grid-cols-1 gap-2">
              <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                <span className="text-sm text-muted-foreground">Approved</span>
                <Badge variant="outline" className="bg-white border-gray-300 text-gray-700 gap-1">
                  <FileText className="h-3 w-3" />
                  CW-2014-0123
                </Badge>
              </div>
              <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                <span className="text-sm text-muted-foreground">Determined</span>
                <Badge variant="outline" className="bg-gray-300 border-gray-400 text-gray-700 gap-1">
                  <FileText className="h-3 w-3" />
                  CW-2024-0156
                </Badge>
              </div>
              <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                <span className="text-sm text-muted-foreground">Uncertain (guessed)</span>
                <Badge variant="outline" className="bg-gray-500 border-dashed border-gray-600 text-white gap-1">
                  <HelpCircle className="h-3 w-3" />
                  CW-2024-0189
                </Badge>
              </div>
              <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                <span className="text-sm text-muted-foreground">Uncertain (new)</span>
                <Badge variant="outline" className="bg-gray-500 border-dashed border-gray-600 text-white gap-1">
                  <HelpCircle className="h-3 w-3" />
                  New case
                </Badge>
              </div>
            </div>
          </div>

          {/* Caseworker Pills */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Caseworker
            </h3>
            <div className="grid grid-cols-1 gap-2">
              <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                <span className="text-sm text-muted-foreground">Approved</span>
                <Badge variant="outline" className="bg-white border-gray-300 text-gray-700 gap-1">
                  <CircleUser className="h-3 w-3" />
                  Mark
                </Badge>
              </div>
              <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                <span className="text-sm text-muted-foreground">Determined</span>
                <Badge variant="outline" className="bg-gray-300 border-gray-400 text-gray-700 gap-1">
                  <CircleUser className="h-3 w-3" />
                  Sarah
                </Badge>
              </div>
              <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                <span className="text-sm text-muted-foreground">Uncertain</span>
                <Badge variant="outline" className="bg-gray-500 border-dashed border-gray-600 text-white gap-1">
                  <HelpCircle className="h-3 w-3" />
                  Assign case
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Response Email Row Component
function ResponseEmailRow({
  email,
  onSelectionChange,
  onClick,
}: {
  email: ResponseEmail;
  onSelectionChange: (id: string, checked: boolean) => void;
  onClick?: () => void;
}) {
  return (
    <Card
      className="hover:shadow-md transition-all border bg-white cursor-pointer"
      onClick={onClick}
    >
      <CardContent className="p-3">
        {/* Top row: checkbox, subject, preview */}
        <div className="flex items-start gap-3 mb-2">
          <Checkbox
            checked={email.isSelected}
            onCheckedChange={(checked) => onSelectionChange(email.id, checked === true)}
            onClick={(e) => e.stopPropagation()}
            className="mt-0.5 shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium truncate">{email.subject}</h3>
              <span className="text-xs text-muted-foreground shrink-0">
                {email.preview.slice(0, 40)}...
              </span>
            </div>
          </div>
        </div>

        {/* Bottom row: email, pills */}
        <div className="flex items-center gap-2 ml-7">
          <span className="text-xs text-muted-foreground truncate max-w-[180px]">
            {email.fromEmail}
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <ConstituentPill constituent={email.constituent} />
            <CasePill caseInfo={email.case} />
            <CaseworkerPill caseworker={email.caseworker} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Full Page List View - email list on left, detail pane on right
function CampaignFullPageView({
  campaign,
  onBack,
  onConfirmEmail,
  onRejectEmail,
}: {
  campaign: Campaign;
  onBack: () => void;
  onConfirmEmail: (emailId: string) => void;
  onRejectEmail: (emailId: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<'known' | 'has_address' | 'no_address'>('known');
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>(caseworkers[0]?.id || '');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [tagsPopoverOpen, setTagsPopoverOpen] = useState(false);

  const knownEmails = campaign.emails.filter(e => e.constituentStatus === 'known');
  const hasAddressEmails = campaign.emails.filter(e => e.constituentStatus === 'has_address');
  const noAddressEmails = campaign.emails.filter(e => e.constituentStatus === 'no_address');

  const pendingCount = campaign.emails.filter(e => e.status === 'pending').length;

  const getCurrentEmails = () => {
    switch (activeTab) {
      case 'known': return knownEmails;
      case 'has_address': return hasAddressEmails;
      case 'no_address': return noAddressEmails;
    }
  };

  const currentEmails = getCurrentEmails();
  const selectedEmail = currentEmails.find(e => e.id === selectedEmailId) || currentEmails.find(e => e.status === 'pending') || currentEmails[0] || null;

  const handleAction = (emailId: string, action: 'confirm' | 'reject') => {
    // Find the next pending email in the current list
    const currentIndex = currentEmails.findIndex(e => e.id === emailId);
    const nextPendingEmail = currentEmails.slice(currentIndex + 1).find(e => e.status === 'pending')
      || currentEmails.slice(0, currentIndex).find(e => e.status === 'pending');

    // Perform the action
    if (action === 'confirm') {
      onConfirmEmail(emailId);
    } else {
      onRejectEmail(emailId);
    }

    // Move to next pending email
    if (nextPendingEmail) {
      setSelectedEmailId(nextPendingEmail.id);
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between pb-4 border-b mb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div className="h-4 w-px bg-border" />
          <Flag className="h-5 w-5 text-blue-600" />
          <h1 className="text-xl font-semibold">{campaign.name}</h1>
          <Badge variant="secondary">{pendingCount} pending</Badge>
        </div>

        {/* Menubar: Assignee & Tags */}
        <div className="flex items-center gap-4">
          {/* Assignee Dropdown */}
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">Assignee:</Label>
            <Select value={selectedAssigneeId} onValueChange={setSelectedAssigneeId}>
              <SelectTrigger className="w-[140px] h-8">
                <SelectValue placeholder="Select assignee" />
              </SelectTrigger>
              <SelectContent>
                {caseworkers.map((cw) => (
                  <SelectItem key={cw.id} value={cw.id}>
                    {cw.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tags Popover */}
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">Tags:</Label>
            <Popover open={tagsPopoverOpen} onOpenChange={setTagsPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 min-w-[120px] justify-start">
                  {selectedTagIds.length > 0 ? (
                    <div className="flex items-center gap-1 overflow-hidden">
                      {selectedTagIds.slice(0, 2).map((tagId) => {
                        const tag = tags.find(t => t.id === tagId);
                        return tag ? (
                          <Badge key={tag.id} className={cn('text-xs h-5', tag.color)}>
                            {tag.name}
                          </Badge>
                        ) : null;
                      })}
                      {selectedTagIds.length > 2 && (
                        <span className="text-xs text-muted-foreground">+{selectedTagIds.length - 2}</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Plus className="h-3 w-3" />
                      Add tags
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[220px] p-0" align="end">
                <Command shouldFilter={false}>
                  <CommandInput placeholder="Search tags..." />
                  <CommandList>
                    <CommandEmpty>No tags found.</CommandEmpty>
                    <CommandGroup>
                      {tags.map((tag) => {
                        const isSelected = selectedTagIds.includes(tag.id);
                        return (
                          <CommandItem
                            key={tag.id}
                            value={tag.id}
                            onSelect={() => {
                              if (isSelected) {
                                setSelectedTagIds(selectedTagIds.filter((id) => id !== tag.id));
                              } else {
                                setSelectedTagIds([...selectedTagIds, tag.id]);
                              }
                            }}
                            className="cursor-pointer"
                          >
                            <div className="flex items-center gap-2 flex-1">
                              <Badge className={cn('text-xs', tag.color)}>
                                {tag.name}
                              </Badge>
                            </div>
                            {isSelected && <Check className="h-4 w-4" />}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v as typeof activeTab);
          setSelectedEmailId(null);
        }}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <TabsList className="grid w-full grid-cols-3 shrink-0">
          <TabsTrigger value="known" className="gap-2">
            <User className="h-4 w-4" />
            Known
            <Badge variant="outline" className="ml-1">{knownEmails.filter(e => e.status === 'pending').length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="has_address" className="gap-2">
            <MapPin className="h-4 w-4" />
            Address included
            <Badge variant="outline" className="ml-1">{hasAddressEmails.filter(e => e.status === 'pending').length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="no_address" className="gap-2">
            <MapPinOff className="h-4 w-4" />
            No address
            <Badge variant="outline" className="ml-1">{noAddressEmails.filter(e => e.status === 'pending').length}</Badge>
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 flex overflow-hidden mt-4 gap-0">
          {/* Left sidebar - email list */}
          <div className="w-1/3 flex flex-col overflow-hidden border-y border-l bg-muted/30">
            <ScrollArea className="flex-1">
              <div className="divide-y">
                {currentEmails.length > 0 ? (
                  currentEmails.map(email => (
                    <div
                      key={email.id}
                      className={`px-3 py-2 cursor-pointer transition-colors flex items-center gap-2 ${
                        email.status === 'confirmed'
                          ? 'bg-green-100'
                          : email.status === 'rejected'
                          ? 'bg-red-50 opacity-50'
                          : selectedEmail?.id === email.id
                          ? 'bg-blue-100'
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => setSelectedEmailId(email.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{email.fromEmail}</div>
                        <div className="text-xs text-muted-foreground truncate">{email.fromName}</div>
                      </div>
                      {email.status === 'pending' && (
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAction(email.id, 'confirm');
                            }}
                          >
                            <Check className="h-3.5 w-3.5 text-green-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAction(email.id, 'reject');
                            }}
                          >
                            <X className="h-3.5 w-3.5 text-red-500" />
                          </Button>
                        </div>
                      )}
                      {email.status === 'confirmed' && (
                        <Check className="h-4 w-4 text-green-600 shrink-0" />
                      )}
                      {email.status === 'rejected' && (
                        <X className="h-4 w-4 text-red-500 shrink-0" />
                      )}
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    No emails in this category
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Right pane - email detail */}
          <div className="w-2/3 flex flex-col overflow-hidden border bg-background relative">
            {selectedEmail ? (
              <>
                {/* Floating toolbar */}
                <div className="absolute top-0 left-0 right-0 bg-background/95 backdrop-blur border-b z-10 px-4 py-2">
                  <div className="flex items-center justify-end gap-2">
                    {selectedEmail.status === 'pending' ? (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleAction(selectedEmail.id, 'reject')}
                        >
                          Not a campaign email
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleAction(selectedEmail.id, 'confirm')}
                        >
                          Confirmed campaign email
                        </Button>
                      </>
                    ) : (
                      <Badge variant={selectedEmail.status === 'confirmed' ? 'default' : 'secondary'} className={selectedEmail.status === 'confirmed' ? 'bg-green-600' : 'bg-red-100 text-red-700'}>
                        {selectedEmail.status === 'confirmed' ? 'Confirmed' : 'Not a campaign email'}
                      </Badge>
                    )}
                  </div>
                </div>

                <ScrollArea className="flex-1 pt-12">
                  <div className="p-4 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-lg">{selectedEmail.subject}</h3>
                        <div className="text-sm text-muted-foreground mt-1">
                          From: {selectedEmail.fromName} &lt;{selectedEmail.fromEmail}&gt;
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {new Date(selectedEmail.receivedAt).toLocaleString()}
                        </div>
                      </div>
                      {selectedEmail.constituentStatus === 'known' && selectedEmail.constituentName && (
                        <Badge variant="outline" className="bg-white border-gray-300 text-gray-700 shrink-0 gap-1">
                          <User className="h-3 w-3" />
                          {selectedEmail.constituentName}
                        </Badge>
                      )}
                      {selectedEmail.constituentStatus === 'has_address' && (
                        <Badge variant="outline" className="bg-gray-500 border-dashed border-gray-600 text-white shrink-0 gap-1">
                          <MapPin className="h-3 w-3" />
                          Create constituent
                        </Badge>
                      )}
                      {selectedEmail.constituentStatus === 'no_address' && (
                        <Badge variant="outline" className="bg-gray-500 border-dashed border-gray-600 text-white shrink-0 gap-1">
                          <MapPinOff className="h-3 w-3" />
                          Request address
                        </Badge>
                      )}
                    </div>

                    {selectedEmail.constituentStatus === 'has_address' && selectedEmail.addressFromEmail && (
                      <div className="text-sm text-gray-600 bg-gray-100 px-3 py-2 rounded border border-gray-200">
                        <MapPin className="inline h-4 w-4 mr-1" />
                        Address found: {selectedEmail.addressFromEmail}
                      </div>
                    )}

                    <div className="border-t pt-4">
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{selectedEmail.body}</p>
                    </div>
                  </div>
                </ScrollArea>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Mail className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Select an email to view</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </Tabs>
    </div>
  );
}

// ============= MAIN COMPONENT =============

export default function DashboardPrototype() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'campaigns' | 'responses' | 'new-cases'>('campaigns');
  const [campaigns, setCampaigns] = useState<Campaign[]>(dashboardCampaigns);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [responseEmails, setResponseEmails] = useState<ResponseEmail[]>(initialResponseEmails);
  const [newCaseEmails, setNewCaseEmails] = useState<ResponseEmail[]>(initialNewCaseEmails);

  // Navigate to triage page for a specific case
  const handleNavigateToCase = (triageCaseIndex: number) => {
    navigate(`/triage-prototype-5?case=${triageCaseIndex}`);
  };

  const totalPendingEmails = useMemo(() =>
    campaigns.reduce((sum, c) => sum + c.emails.filter(e => e.status === 'pending').length, 0),
    [campaigns]
  );
  const userName = 'Stewart';

  const selectedCampaign = useMemo(() =>
    campaigns.find(c => c.id === selectedCampaignId) || null,
    [campaigns, selectedCampaignId]
  );

  const handleConfirmEmail = (emailId: string) => {
    setCampaigns(prev => prev.map(campaign => ({
      ...campaign,
      emails: campaign.emails.map(email =>
        email.id === emailId ? { ...email, status: 'confirmed' as const } : email
      )
    })));
  };

  const handleRejectEmail = (emailId: string) => {
    setCampaigns(prev => prev.map(campaign => ({
      ...campaign,
      emails: campaign.emails.map(email =>
        email.id === emailId ? { ...email, status: 'rejected' as const } : email
      )
    })));
  };

  const handleResponseEmailSelection = (emailId: string, checked: boolean) => {
    setResponseEmails(prev => prev.map(email =>
      email.id === emailId ? { ...email, isSelected: checked } : email
    ));
  };

  const handleNewCaseEmailSelection = (emailId: string, checked: boolean) => {
    setNewCaseEmails(prev => prev.map(email =>
      email.id === emailId ? { ...email, isSelected: checked } : email
    ));
  };

  // If a campaign is selected, show the full page view
  if (selectedCampaign) {
    return (
      <CampaignFullPageView
        campaign={selectedCampaign}
        onBack={() => setSelectedCampaignId(null)}
        onConfirmEmail={handleConfirmEmail}
        onRejectEmail={handleRejectEmail}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Greeting Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Good morning, {userName}
          </h1>
          <p className="text-muted-foreground">
            There are {totalPendingEmails} new emails to triage.
          </p>
        </div>
        <PillShowcaseModal />
      </div>

      {/* Tabs Menubar */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as typeof activeTab)}
        className="w-full"
      >
        <TabsList className="flex flex-row w-fit mb-4">
          <TabsTrigger value="campaigns" className="px-6">
            Campaigns
          </TabsTrigger>
          <Separator orientation='vertical' className="h-6 w-px bg-gray-600 border border-gray-400 mx-2"/>
          <TabsTrigger value="responses" className="px-6">
            Responses
          </TabsTrigger>
          <TabsTrigger value="new-cases" className="px-6">
            New cases
          </TabsTrigger>
        </TabsList>

        {/* Campaigns Tab Content */}
        <TabsContent value="campaigns" className="mt-0">
          <div className="flex flex-col gap-3">
            {campaigns.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                onClick={() => setSelectedCampaignId(campaign.id)}
              />
            ))}
          </div>
        </TabsContent>

        {/* Responses Tab Content */}
        <TabsContent value="responses" className="mt-0">
          <div className="flex flex-col gap-3">
            {responseEmails.map((email) => (
              <ResponseEmailRow
                key={email.id}
                email={email}
                onSelectionChange={handleResponseEmailSelection}
                onClick={() => handleNavigateToCase(email.triageCaseIndex)}
              />
            ))}
          </div>
        </TabsContent>

        {/* New Cases Tab Content */}
        <TabsContent value="new-cases" className="mt-0">
          <div className="flex flex-col gap-3">
            {newCaseEmails.map((email) => (
              <ResponseEmailRow
                key={email.id}
                email={email}
                onSelectionChange={handleNewCaseEmailSelection}
                onClick={() => handleNavigateToCase(email.triageCaseIndex)}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>

    </div>
  );
}
