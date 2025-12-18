/**
 * PROTOTYPE 5: Email Triage with Dropdown Search
 *
 * Concept: Single email view with searchable dropdowns for constituent/case linking.
 * Features:
 * - Email preview on the left
 * - Constituent searchable dropdown with "Create new" pinned
 * - Case searchable dropdown with "Create new" pinned
 * - Case tags with modal Command search
 * - Assignee simple dropdown
 * - Priority selector (L/M/H)
 * - Create new constituent/case modal with prefilled fields
 * - Request address submodal with email template
 */

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTriageProgress } from '@/lib/TriageProgressContext';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
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
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Plus,
  User,
  Briefcase,
  FileText,
  Mail,
  Reply,
  Megaphone,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============= TYPES =============

interface Constituent {
  id: string;
  name: string;
  email: string;
  address?: string;
}

interface Case {
  id: string;
  ref: string;
  title: string;
  constituentId?: string;
}

interface CaseTag {
  id: string;
  name: string;
  color: string;
  borderColor: string; // For 'new' state styling
}

interface Caseworker {
  id: string;
  name: string;
}

interface Campaign {
  id: string;
  title: string;
  description: string;
  tags: string[];
}

interface Email {
  id: string;
  subject: string;
  body: string;
  fromEmail: string;
  fromName: string;
  receivedAt: string;
  addressFound?: string;
}

// ============= MOCK DATA =============

const mockConstituents: Constituent[] = [
  { id: 'con-1', name: 'Maria Santos', email: 'maria.santos@gmail.com', address: '45 Park Lane, Westminster' },
  { id: 'con-2', name: 'John Smith', email: 'john.smith@email.com', address: '12 High Street' },
  { id: 'con-3', name: 'Sarah Williams', email: 'sarah.w@outlook.com' },
  { id: 'con-4', name: 'David Brown', email: 'david.brown@gmail.com', address: '78 Oak Road' },
  { id: 'con-5', name: 'Emma Wilson', email: 'emma.wilson@yahoo.com' },
];

const mockCases: Case[] = [
  { id: 'case-1', ref: 'CW-2024-0123', title: 'Housing Association Dispute', constituentId: 'con-1' },
  { id: 'case-2', ref: 'CW-2024-0098', title: 'Council Tax Dispute', constituentId: 'con-2' },
  { id: 'case-3', ref: 'CW-2024-0087', title: 'Planning Application Query', constituentId: 'con-1' },
  { id: 'case-4', ref: 'CW-2023-0456', title: 'Benefits Query - PIP', constituentId: 'con-4' },
  { id: 'case-5', ref: 'CW-2024-0134', title: 'Parking Permit Issue' },
];

const mockTags: CaseTag[] = [
  { id: 'tag-1', name: 'Urgent', color: 'bg-red-100 text-red-700', borderColor: 'border-red-700' },
  { id: 'tag-2', name: 'Housing', color: 'bg-blue-100 text-blue-700', borderColor: 'border-blue-700' },
  { id: 'tag-3', name: 'Benefits', color: 'bg-green-100 text-green-700', borderColor: 'border-green-700' },
  { id: 'tag-4', name: 'Follow-up Required', color: 'bg-yellow-100 text-yellow-700', borderColor: 'border-yellow-700' },
  { id: 'tag-5', name: 'Immigration', color: 'bg-purple-100 text-purple-700', borderColor: 'border-purple-700' },
  { id: 'tag-6', name: 'Council Tax', color: 'bg-orange-100 text-orange-700', borderColor: 'border-orange-700' },
  { id: 'tag-7', name: 'Planning', color: 'bg-teal-100 text-teal-700', borderColor: 'border-teal-700' },
  { id: 'tag-8', name: 'NHS', color: 'bg-pink-100 text-pink-700', borderColor: 'border-pink-700' },
];

const mockCaseworkers: Caseworker[] = [
  { id: 'cw-1', name: 'Caseworker 1' },
  { id: 'cw-2', name: 'Caseworker 2' },
  { id: 'cw-3', name: 'Senior Caseworker' },
  { id: 'cw-4', name: 'Office Manager' },
];

const mockCampaigns: Campaign[] = [
  { id: 'camp-1', title: 'Housing Crisis Response', description: 'Coordinated response to housing issues in the constituency', tags: ['Housing', 'Urgent'] },
  { id: 'camp-2', title: 'Benefits Support Drive', description: 'Helping constituents with PIP and Universal Credit applications', tags: ['Benefits'] },
  { id: 'camp-3', title: 'Local Planning Objections', description: 'Coordinating response to major planning applications', tags: ['Planning'] },
  { id: 'camp-4', title: 'NHS Waiting Times', description: 'Campaign addressing NHS delays and waiting lists', tags: ['NHS', 'Health'] },
];

// Thread email type
interface ThreadEmail {
  id: string;
  direction: 'inbound' | 'outbound';
  subject: string;
  snippet: string;
  body: string;
  sentAt: string;
  fromName: string;
}

// Triage case bundles all data for one email to process
interface TriageCase {
  email: Email;
  threadEmails: ThreadEmail[];
  suggestedConstituentId: string | null;
  suggestedCaseId: string | null;
  suggestedTagIds: string[];
  suggestedAssigneeId: string;
  suggestedPriority: 'L' | 'M' | 'H';
}

const mockTriageCases: TriageCase[] = [
  // Case 1: Maria Santos - Housing/Eviction
  {
    email: {
      id: 'email-1',
      subject: 'URGENT - Eviction notice received',
      body: `Dear MP,

I am writing to you in desperation as I have just received an eviction notice from my housing association.

I have been a tenant at this property for over 8 years and have always paid my rent on time. However, due to recent changes in my circumstances (I was made redundant from my job in March), I fell behind on a few payments.

I have since found new employment and have been making regular payments to catch up on arrears, but the housing association is still proceeding with eviction proceedings.

I am terrified of losing my home. I have two young children who are settled in local schools and this would be devastating for our family.

Please, I am begging you to help me. Is there anything you can do to intervene or advise me on my options?

I can be reached at this email address or by phone on 07700 900123.

Thank you for any help you can provide.

Yours sincerely,
Maria Santos`,
      fromEmail: 'maria.santos@gmail.com',
      fromName: 'Maria Santos',
      receivedAt: '2024-01-15T09:30:00Z',
      addressFound: '45 Park Lane, Westminster',
    },
    threadEmails: [
      {
        id: 'thread-1-1',
        direction: 'outbound',
        subject: 'Re: URGENT - Eviction notice received',
        snippet: 'Thank you for contacting my office. I have asked my caseworker to look into this matter urgently...',
        body: `Dear Ms Santos,

Thank you for contacting my office. I have asked my caseworker to look into this matter urgently.

I understand how distressing this situation must be for you and your family.

Kind regards,
[MP Name]`,
        sentAt: '2024-01-14T14:22:00Z',
        fromName: 'Office of [MP Name]',
      },
    ],
    suggestedConstituentId: 'con-1',
    suggestedCaseId: 'case-1',
    suggestedTagIds: ['tag-1', 'tag-2'],
    suggestedAssigneeId: 'cw-1',
    suggestedPriority: 'H',
  },
  // Case 2: John Smith - Council Tax
  {
    email: {
      id: 'email-2',
      subject: 'Council Tax Bill Query',
      body: `Dear MP,

I am writing regarding my council tax bill which I believe contains errors. I have been charged for a Band D property but my house was reassessed last year and should be Band C.

I have contacted the council multiple times but they keep sending me the same incorrect bill. I am worried about penalties if I don't pay, but I don't want to overpay either.

Could you please help me resolve this matter with the council?

Best regards,
John Smith
12 High Street`,
      fromEmail: 'john.smith@email.com',
      fromName: 'John Smith',
      receivedAt: '2024-01-15T10:15:00Z',
      addressFound: '12 High Street',
    },
    threadEmails: [],
    suggestedConstituentId: 'con-2',
    suggestedCaseId: 'case-2',
    suggestedTagIds: ['tag-6'],
    suggestedAssigneeId: 'cw-2',
    suggestedPriority: 'M',
  },
  // Case 3: New constituent - Immigration
  {
    email: {
      id: 'email-3',
      subject: 'Spouse Visa Application Delay',
      body: `Dear MP,

My name is Amara Okonkwo and I am writing to seek your assistance with my spouse visa application.

I applied for a spouse visa to join my husband in the UK over 14 months ago. We have a 2-year-old British citizen daughter who has never met her father in person.

The Home Office website shows "awaiting decision" but we have heard nothing despite multiple enquiries. The separation is causing immense distress to our family.

I would be extremely grateful if you could make enquiries on our behalf.

Yours faithfully,
Amara Okonkwo
Currently residing in Lagos, Nigeria`,
      fromEmail: 'amara.okonkwo@gmail.com',
      fromName: 'Amara Okonkwo',
      receivedAt: '2024-01-15T11:00:00Z',
    },
    threadEmails: [],
    suggestedConstituentId: null,
    suggestedCaseId: null,
    suggestedTagIds: ['tag-5', 'tag-1'],
    suggestedAssigneeId: 'cw-3',
    suggestedPriority: 'H',
  },
  // Case 4: Benefits query
  {
    email: {
      id: 'email-4',
      subject: 'PIP Assessment Appeal Help',
      body: `Dear MP,

I am writing to ask for your help with my PIP appeal. I was recently reassessed and my award was reduced from enhanced to standard rate for daily living, despite my condition worsening.

I have fibromyalgia and chronic fatigue syndrome which severely impacts my daily life. The assessor spent only 20 minutes with me and seemed to ignore what I told them.

I have submitted a mandatory reconsideration but I am scared about managing if my benefits are cut.

Please could you advise on what I can do?

Thank you,
David Brown
78 Oak Road`,
      fromEmail: 'david.brown@gmail.com',
      fromName: 'David Brown',
      receivedAt: '2024-01-15T11:45:00Z',
      addressFound: '78 Oak Road',
    },
    threadEmails: [
      {
        id: 'thread-4-1',
        direction: 'inbound',
        subject: 'Benefits concern',
        snippet: 'I wanted to let you know about my upcoming PIP assessment...',
        body: `Dear MP,

I wanted to let you know about my upcoming PIP assessment. I am very anxious about it.

Thank you,
David Brown`,
        sentAt: '2024-01-10T09:00:00Z',
        fromName: 'David Brown',
      },
    ],
    suggestedConstituentId: 'con-4',
    suggestedCaseId: 'case-4',
    suggestedTagIds: ['tag-3', 'tag-4'],
    suggestedAssigneeId: 'cw-2',
    suggestedPriority: 'M',
  },
  // Case 5: Planning concern
  {
    email: {
      id: 'email-5',
      subject: 'Objection to Planning Application 2024/0892',
      body: `Dear MP,

I am writing to express my strong objection to planning application 2024/0892 for a 5-storey apartment block on Green Lane.

This development would:
- Overlook my garden and remove all privacy
- Block natural light to my property
- Increase traffic on an already congested road
- Destroy the character of our neighbourhood

The council planning committee is meeting next week. Could you please intervene?

I have lived here for 30 years and this would ruin our quality of life.

Regards,
Emma Wilson`,
      fromEmail: 'emma.wilson@yahoo.com',
      fromName: 'Emma Wilson',
      receivedAt: '2024-01-15T14:20:00Z',
    },
    threadEmails: [],
    suggestedConstituentId: 'con-5',
    suggestedCaseId: null,
    suggestedTagIds: ['tag-7'],
    suggestedAssigneeId: 'cw-1',
    suggestedPriority: 'M',
  },
];

// ============= SEARCHABLE DROPDOWN COMPONENT =============

interface SearchableDropdownProps {
  label: string;
  icon: React.ReactNode;
  placeholder: string;
  items: { id: string; name: string; secondary?: string }[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCreateNew: () => void;
  createNewLabel: string;
  isRecognized?: boolean;
}

function SearchableDropdown({
  label,
  icon,
  placeholder,
  items,
  selectedId,
  onSelect,
  onCreateNew,
  createNewLabel,
  isRecognized,
}: SearchableDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredItems = useMemo(() => {
    if (!search) return items;
    const lowerSearch = search.toLowerCase();
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(lowerSearch) ||
        item.secondary?.toLowerCase().includes(lowerSearch)
    );
  }, [items, search]);

  const selectedItem = items.find((item) => item.id === selectedId);

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="flex-1 justify-between h-10 min-w-0"
            >
              <span className="flex items-center gap-2 truncate min-w-0">
                <span className="shrink-0">{icon}</span>
                {selectedItem ? (
                  <span className="truncate">{selectedItem.name}</span>
                ) : (
                  <span className="text-muted-foreground truncate">{placeholder}</span>
                )}
              </span>
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={`Search ${label.toLowerCase()}...`}
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              {/* Pinned Create New option */}
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    setOpen(false);
                    setSearch('');
                    onCreateNew();
                  }}
                  className="text-primary"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {createNewLabel}
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
              {/* Filtered items */}
              <CommandGroup>
                {filteredItems.length === 0 ? (
                  <CommandEmpty>No results found.</CommandEmpty>
                ) : (
                  filteredItems.map((item) => (
                    <CommandItem
                      key={item.id}
                      value={item.id}
                      onSelect={() => {
                        onSelect(item.id === selectedId ? null : item.id);
                        setOpen(false);
                        setSearch('');
                      }}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          selectedId === item.id ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <div className="flex flex-col">
                        <span>{item.name}</span>
                        {item.secondary && (
                          <span className="text-xs text-muted-foreground">
                            {item.secondary}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  ))
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
        </Popover>
        {isRecognized && selectedId && (
          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
        )}
      </div>
    </div>
  );
}

// ============= CREATE CONSTITUENT MODAL =============

interface CreateConstituentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefillData: {
    name: string;
    email: string;
    address?: string;
  };
  onRequestAddress: () => void;
  onCreate: (constituent: Omit<Constituent, 'id'>) => void;
}

function CreateConstituentModal({
  open,
  onOpenChange,
  prefillData,
  onRequestAddress,
  onCreate,
}: CreateConstituentModalProps) {
  const [name, setName] = useState(prefillData.name);
  const [email, setEmail] = useState(prefillData.email);
  const [address, setAddress] = useState(prefillData.address || '');

  // Reset form when modal opens with new prefill data
  useState(() => {
    setName(prefillData.name);
    setEmail(prefillData.email);
    setAddress(prefillData.address || '');
  });

  const handleCreate = () => {
    onCreate({ name, email, address: address || undefined });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Constituent</DialogTitle>
          <DialogDescription>
            Add a new constituent to the system. Fields have been prefilled from
            the email.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="address">Address</Label>
              {!address && (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  onClick={onRequestAddress}
                >
                  Request Address
                </Button>
              )}
            </div>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Postal address (optional)"
            />
            {!address && (
              <p className="text-xs text-muted-foreground">
                No address found in email. You can request it from the
                constituent.
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!name || !email}>
            Create Constituent
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============= CREATE CASE MODAL =============

interface CreateCaseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefillData: {
    name: string;
    constituentId?: string;
    constituentName?: string;
  };
  onCreate: (caseName: string) => void;
}

function CreateCaseModal({
  open,
  onOpenChange,
  prefillData,
  onCreate,
}: CreateCaseModalProps) {
  const [name, setName] = useState(prefillData.name);

  const handleCreate = () => {
    onCreate(name);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Case</DialogTitle>
          <DialogDescription>
            Create a new case for this constituent.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="case-name">Case Name</Label>
            <Input
              id="case-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter case name"
            />
          </div>
          {prefillData.constituentName && (
            <div className="space-y-2">
              <Label>Constituent</Label>
              <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{prefillData.constituentName}</span>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!name}>
            Create Case
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============= REQUEST ADDRESS MODAL =============

interface RequestAddressModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: Email;
  onSend: (message: string) => void;
}

function RequestAddressModal({
  open,
  onOpenChange,
  email,
  onSend,
}: RequestAddressModalProps) {
  const defaultTemplate = `Dear ${email.fromName},

Thank you for contacting me regarding your concerns.

To help me assist you more effectively, I need to verify that you are a constituent in my constituency. Could you please reply to this email with your full postal address?

This information is required so that I can confirm you reside within my constituency and take appropriate action on your behalf.

Thank you for your understanding.

Kind regards,
[MP Name]
Member of Parliament for [Constituency]`;

  const [message, setMessage] = useState(defaultTemplate);

  const handleSend = () => {
    onSend(message);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Request Address from Constituent</DialogTitle>
          <DialogDescription>
            Send an email to {email.fromEmail} requesting their postal address.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>To</Label>
            <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                {email.fromName} &lt;{email.fromEmail}&gt;
              </span>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Subject</Label>
            <Input
              value={`Re: ${email.subject}`}
              readOnly
              className="bg-muted"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[250px] font-mono text-sm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSend}>
            <Reply className="mr-2 h-4 w-4" />
            Send Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============= ASSIGN TO CAMPAIGN MODAL =============

interface AssignToCampaignModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssign: (campaignId: string) => void;
  onCreate: (campaign: Omit<Campaign, 'id'>) => void;
}

function AssignToCampaignModal({
  open,
  onOpenChange,
  onAssign,
  onCreate,
}: AssignToCampaignModalProps) {
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [search, setSearch] = useState('');

  // New campaign form state
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newTags, setNewTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  const filteredCampaigns = useMemo(() => {
    if (!search) return mockCampaigns;
    const lowerSearch = search.toLowerCase();
    return mockCampaigns.filter(
      (c) =>
        c.title.toLowerCase().includes(lowerSearch) ||
        c.description.toLowerCase().includes(lowerSearch) ||
        c.tags.some((t) => t.toLowerCase().includes(lowerSearch))
    );
  }, [search]);

  const selectedCampaign = mockCampaigns.find((c) => c.id === selectedCampaignId);

  const handleSelectCampaign = (id: string) => {
    setSelectedCampaignId(id);
    setIsCreatingNew(false);
  };

  const handleSelectCreateNew = () => {
    setSelectedCampaignId(null);
    setIsCreatingNew(true);
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !newTags.includes(tagInput.trim())) {
      setNewTags([...newTags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setNewTags(newTags.filter((t) => t !== tag));
  };

  const handleConfirm = () => {
    if (isCreatingNew && newTitle) {
      onCreate({ title: newTitle, description: newDescription, tags: newTags });
    } else if (selectedCampaignId) {
      onAssign(selectedCampaignId);
    }
    // Reset state
    setSelectedCampaignId(null);
    setIsCreatingNew(false);
    setSearch('');
    setNewTitle('');
    setNewDescription('');
    setNewTags([]);
    onOpenChange(false);
  };

  const handleCancel = () => {
    setSelectedCampaignId(null);
    setIsCreatingNew(false);
    setSearch('');
    setNewTitle('');
    setNewDescription('');
    setNewTags([]);
    onOpenChange(false);
  };

  const canConfirm = isCreatingNew ? !!newTitle : !!selectedCampaignId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign to Campaign</DialogTitle>
          <DialogDescription>
            Add this email to an existing campaign or create a new one.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Campaign Search Command */}
          <Command className="border rounded-md" shouldFilter={false}>
            <CommandInput
              placeholder="Search campaigns..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList className="max-h-[200px]">
              {/* Pinned Create New option */}
              <CommandGroup>
                <CommandItem
                  onSelect={handleSelectCreateNew}
                  className={cn(
                    'text-primary',
                    isCreatingNew && 'bg-accent'
                  )}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create new campaign
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
              {/* Existing campaigns */}
              <CommandGroup heading="Existing Campaigns">
                {filteredCampaigns.length === 0 ? (
                  <CommandEmpty>No campaigns found.</CommandEmpty>
                ) : (
                  filteredCampaigns.map((campaign) => (
                    <CommandItem
                      key={campaign.id}
                      value={campaign.id}
                      onSelect={() => handleSelectCampaign(campaign.id)}
                      className={cn(
                        selectedCampaignId === campaign.id && 'bg-accent'
                      )}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          selectedCampaignId === campaign.id ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <div className="flex flex-col">
                        <span className="font-medium">{campaign.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {campaign.description}
                        </span>
                      </div>
                    </CommandItem>
                  ))
                )}
              </CommandGroup>
            </CommandList>
          </Command>

          {/* Selected campaign info */}
          {selectedCampaign && !isCreatingNew && (
            <div className="p-3 bg-muted/50 rounded-md space-y-2">
              <div className="font-medium">{selectedCampaign.title}</div>
              <div className="text-sm text-muted-foreground">
                {selectedCampaign.description}
              </div>
              <div className="flex flex-wrap gap-1">
                {selectedCampaign.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* New campaign form */}
          {isCreatingNew && (
            <div className="space-y-4 p-3 bg-muted/50 rounded-md">
              <div className="space-y-2">
                <Label htmlFor="campaign-title">Title</Label>
                <Input
                  id="campaign-title"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Campaign title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="campaign-description">Description</Label>
                <Textarea
                  id="campaign-description"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Brief description of the campaign"
                  className="min-h-[80px]"
                />
              </div>
              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex gap-2">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    placeholder="Add a tag"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" size="icon" onClick={handleAddTag}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {newTags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {newTags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="text-xs cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => handleRemoveTag(tag)}
                      >
                        {tag} ×
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>
            {isCreatingNew ? 'Create & Assign' : 'Assign to Campaign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============= PRIORITY SELECTOR =============

interface PrioritySelectorProps {
  value: 'L' | 'M' | 'H';
  onChange: (value: 'L' | 'M' | 'H') => void;
}

function PrioritySelector({ value, onChange }: PrioritySelectorProps) {
  const priorities: { key: 'L' | 'M' | 'H'; label: string; color: string }[] = [
    { key: 'L', label: 'Low', color: 'bg-green-100 text-green-700 border-green-300' },
    { key: 'M', label: 'Med', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
    { key: 'H', label: 'High', color: 'bg-red-100 text-red-700 border-red-300' },
  ];

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Priority</Label>
      <div className="flex border rounded-md overflow-hidden">
        {priorities.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => onChange(p.key)}
            className={cn(
              'flex-1 py-2 px-3 text-sm font-medium transition-colors border-r last:border-r-0',
              value === p.key
                ? p.color
                : 'bg-background hover:bg-muted text-muted-foreground'
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ============= CONFETTI COMPONENT =============

function Confetti() {
  const [pieces, setPieces] = useState<Array<{
    id: number;
    x: number;
    color: string;
    delay: number;
    duration: number;
  }>>([]);

  useEffect(() => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
    ];

    const newPieces = Array.from({ length: 100 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 0.5,
      duration: 2 + Math.random() * 2,
    }));

    setPieces(newPieces);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {pieces.map((piece) => (
        <div
          key={piece.id}
          className="absolute w-3 h-3 animate-confetti"
          style={{
            left: `${piece.x}%`,
            top: '-20px',
            backgroundColor: piece.color,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
            transform: `rotate(${Math.random() * 360}deg)`,
          }}
        />
      ))}
      <style>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-confetti {
          animation: confetti-fall linear forwards;
        }
      `}</style>
    </div>
  );
}

// ============= SUCCESS PAGE COMPONENT =============

function SuccessPage({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-gradient-to-b from-green-50 to-white">
      <Confetti />
      <div className="text-center space-y-6">
        <div className="text-8xl mb-4">0</div>
        <h1 className="text-4xl font-bold text-green-600">Congratulations!</h1>
        <p className="text-2xl text-muted-foreground">Inbox Zero</p>
        <p className="text-sm text-muted-foreground mt-8">
          All emails have been triaged successfully.
        </p>
        <Button
          variant="outline"
          className="mt-8"
          onClick={onReset}
        >
          Start Over (Demo)
        </Button>
      </div>
    </div>
  );
}

// ============= MAIN COMPONENT =============

// Mock: original tags for existing cases (simulating what was saved)
const originalCaseTags: Record<string, string[]> = {
  'case-1': ['tag-1', 'tag-2'],
  'case-2': ['tag-6'],
  'case-3': ['tag-7'],
  'case-4': ['tag-3'],
  'case-5': [],
};

export default function TriagePrototype5() {
  // Current case index
  const [currentCaseIndex, setCurrentCaseIndex] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const currentTriageCase = mockTriageCases[currentCaseIndex];
  const { setProgress } = useTriageProgress();

  // State for selected values (initialized from current triage case)
  const [selectedConstituentId, setSelectedConstituentId] = useState<string | null>(
    currentTriageCase.suggestedConstituentId
  );
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(
    currentTriageCase.suggestedCaseId
  );
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
    currentTriageCase.suggestedTagIds
  );
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>(
    currentTriageCase.suggestedAssigneeId
  );
  const [priority, setPriority] = useState<'L' | 'M' | 'H'>(
    currentTriageCase.suggestedPriority
  );

  // Track if this is a newly created case (no original tags)
  const [isNewCase, setIsNewCase] = useState(!currentTriageCase.suggestedCaseId);

  // Modal states
  const [createConstituentModalOpen, setCreateConstituentModalOpen] = useState(false);
  const [createCaseModalOpen, setCreateCaseModalOpen] = useState(false);
  const [requestAddressModalOpen, setRequestAddressModalOpen] = useState(false);
  const [assignCampaignModalOpen, setAssignCampaignModalOpen] = useState(false);

  // Update header progress bar
  useEffect(() => {
    if (!isCompleted) {
      setProgress({ current: currentCaseIndex, total: mockTriageCases.length });
    } else {
      setProgress(null);
    }
    // Cleanup on unmount
    return () => setProgress(null);
  }, [currentCaseIndex, isCompleted, setProgress]);

  // Load case data when index changes
  const loadCase = (index: number) => {
    const triageCase = mockTriageCases[index];
    setSelectedConstituentId(triageCase.suggestedConstituentId);
    setSelectedCaseId(triageCase.suggestedCaseId);
    setSelectedTagIds(triageCase.suggestedTagIds);
    setSelectedAssigneeId(triageCase.suggestedAssigneeId);
    setPriority(triageCase.suggestedPriority);
    setIsNewCase(!triageCase.suggestedCaseId);
  };

  // Handle approve and move to next case
  const handleApprove = () => {
    console.log('Approved case:', currentCaseIndex, {
      constituentId: selectedConstituentId,
      caseId: selectedCaseId,
      tagIds: selectedTagIds,
      assigneeId: selectedAssigneeId,
      priority,
    });

    // Move to next case if available
    if (currentCaseIndex < mockTriageCases.length - 1) {
      const nextIndex = currentCaseIndex + 1;
      setCurrentCaseIndex(nextIndex);
      loadCase(nextIndex);
    } else {
      // All cases processed - show success page
      setIsCompleted(true);
    }
  };

  // Reset triage (for demo purposes)
  const handleReset = () => {
    setCurrentCaseIndex(0);
    setIsCompleted(false);
    loadCase(0);
  };

  // Get constituent items for dropdown
  const constituentItems = mockConstituents.map((c) => ({
    id: c.id,
    name: c.name,
    secondary: c.email,
  }));

  // Get case items for dropdown (filtered by constituent if selected)
  const caseItems = useMemo(() => {
    const cases = selectedConstituentId
      ? mockCases.filter(
          (c) => !c.constituentId || c.constituentId === selectedConstituentId
        )
      : mockCases;
    return cases.map((c) => ({
      id: c.id,
      name: `${c.ref}: ${c.title}`,
      ref: c.ref,
      title: c.title,
    }));
  }, [selectedConstituentId]);

  // Get selected case for display
  const selectedCase = mockCases.find((c) => c.id === selectedCaseId);

  // Get selected items for display
  const selectedConstituent = mockConstituents.find(
    (c) => c.id === selectedConstituentId
  );

  // Get original tags for the selected case (empty if new case)
  const originalTags = useMemo(() => {
    if (isNewCase || !selectedCaseId) return [];
    return originalCaseTags[selectedCaseId] || [];
  }, [selectedCaseId, isNewCase]);

  // Compute tag states: 'no-change' | 'new' | 'removed'
  const tagStates = useMemo(() => {
    const states: Record<string, 'no-change' | 'new' | 'removed'> = {};

    // For new cases, all selected tags are 'no-change'
    if (isNewCase) {
      selectedTagIds.forEach((id) => {
        states[id] = 'no-change';
      });
      return states;
    }

    // For existing cases, compute changes
    // Tags in both original and current = no-change
    // Tags in current but not original = new
    // Tags in original but not current = removed
    selectedTagIds.forEach((id) => {
      states[id] = originalTags.includes(id) ? 'no-change' : 'new';
    });
    originalTags.forEach((id) => {
      if (!selectedTagIds.includes(id)) {
        states[id] = 'removed';
      }
    });

    return states;
  }, [selectedTagIds, originalTags, isNewCase]);

  // Get all tags to display (current + removed)
  const displayTags = useMemo(() => {
    const allTagIds = new Set([...selectedTagIds, ...originalTags.filter((id) => !selectedTagIds.includes(id))]);
    return mockTags.filter((t) => allTagIds.has(t.id));
  }, [selectedTagIds, originalTags]);

  // Prefill data from email
  const prefillConstituentData = {
    name: currentTriageCase.email.fromName,
    email: currentTriageCase.email.fromEmail,
    address: currentTriageCase.email.addressFound,
  };

  const prefillCaseData = {
    name: 'Eviction Notice - Housing Association',
    constituentId: selectedConstituentId || undefined,
    constituentName: selectedConstituent?.name,
  };

  const handleCreateConstituent = (constituent: Omit<Constituent, 'id'>) => {
    console.log('Creating constituent:', constituent);
    // In real app, this would create the constituent and select it
  };

  const handleCreateCase = (caseName: string) => {
    console.log('Creating case:', caseName);
    // In real app, this would create the case and select it
    // Mark as new case so all tags show as 'no-change' state
    setIsNewCase(true);
    setSelectedTagIds([]); // Reset tags for new case
  };

  const handleSendAddressRequest = (message: string) => {
    console.log('Sending address request:', message);
    // In real app, this would send the email
  };

  const handleAssignToCampaign = (campaignId: string) => {
    console.log('Assigning email to campaign:', campaignId);
    // In real app, this would link the email to the campaign
  };

  const handleCreateCampaign = (campaign: Omit<Campaign, 'id'>) => {
    console.log('Creating new campaign:', campaign);
    // In real app, this would create the campaign and assign the email
  };

  // Show success page if all cases are completed
  if (isCompleted) {
    return (
      <div className="h-full">
        <SuccessPage onReset={handleReset} />
      </div>
    );
  }

  return (
    <div className="flex flex-1 gap-4 h-[calc(100vh-8rem)] overflow-hidden">
      {/* Left Panel - Email View */}
      <div className="flex-1 min-h-0 bg-background">
        <ScrollArea className="h-full pr-4">
          <div className="flex flex-col">
            {/* Email Header */}
            <div className="shrink-0 border-b pb-4 mb-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Subject
              </div>
              <h2 className="text-lg font-semibold">{currentTriageCase.email.subject}</h2>
              <div className="text-sm text-muted-foreground mt-2">
                From: {currentTriageCase.email.fromName} &lt;{currentTriageCase.email.fromEmail}&gt;
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {new Date(currentTriageCase.email.receivedAt).toLocaleString()}
              </div>
            </div>

            {/* Email Body */}
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                Body
              </div>
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {currentTriageCase.email.body}
              </div>
            </div>

            {/* Thread Emails */}
            {currentTriageCase.threadEmails.length > 0 && (
              <div className="pt-4 mt-4 border-t">
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                  Previous in thread
                </div>
                <Accordion type="single" collapsible className="space-y-2">
                  {currentTriageCase.threadEmails.map((threadEmail) => (
                    <AccordionItem
                      key={threadEmail.id}
                      value={threadEmail.id}
                      className={cn(
                        'border rounded-md px-3',
                        threadEmail.direction === 'outbound'
                          ? 'bg-blue-50/50 border-blue-200'
                          : 'bg-muted/30'
                      )}
                    >
                      <AccordionTrigger className="py-2 hover:no-underline">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="font-medium text-xs truncate">
                            {threadEmail.fromName}
                          </span>
                          <span className="text-xs text-muted-foreground ml-auto mr-2">
                            {new Date(threadEmail.sentAt).toLocaleDateString()}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="whitespace-pre-wrap text-sm leading-relaxed pt-2 border-t">
                          {threadEmail.body}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right Panel - Case Management */}
      <div className="w-[320px] h-full flex flex-col shrink-0 bg-background">
        {/* Scrollable Content */}
        <ScrollArea className="flex-1 min-h-0 w-[320px] pb-3">
          <div className="flex flex-col gap-3 w-[320px] min-w-0">
          {/* Campaign Button */}
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => setAssignCampaignModalOpen(true)}
          >
            <Megaphone className="mr-2 h-4 w-4" />
            Assign to Campaign
          </Button>

          {/* Constituent, Case & Tags Card */}
          <Card>
            <CardContent className="p-4 space-y-4">
              {/* Constituent Dropdown */}
              <SearchableDropdown
                label="Constituent"
                icon={<User className="h-4 w-4" />}
                placeholder="Select constituent..."
                items={constituentItems}
                selectedId={selectedConstituentId}
                onSelect={setSelectedConstituentId}
                onCreateNew={() => setCreateConstituentModalOpen(true)}
                createNewLabel="Create new constituent"
                isRecognized={!!selectedConstituentId}
              />

              {/* Case Dropdown */}
              <div className="space-y-2">
                <SearchableDropdown
                  label="Case"
                  icon={<Briefcase className="h-4 w-4" />}
                  placeholder="Select case..."
                  items={caseItems}
                  selectedId={selectedCaseId}
                  onSelect={setSelectedCaseId}
                  onCreateNew={() => setCreateCaseModalOpen(true)}
                  createNewLabel="Create new case"
                  isRecognized={!!selectedCaseId}
                />
                {/* Case Pill - shown when case is selected */}
                {selectedCase && (
                  <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
                    <FileText className="h-3 w-3 mr-1" />
                    {selectedCase.ref}
                  </Badge>
                )}
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Tags</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <div className="flex flex-wrap gap-1.5 min-h-[40px] p-2 border rounded-md bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors">
                      {displayTags.length > 0 ? (
                        <>
                          {displayTags.map((tag) => {
                            const state = tagStates[tag.id];
                            // Extract text color class for border styling
                            const textColorClass = tag.color.split(' ').find(c => c.startsWith('text-')) || '';
                            return (
                              <Badge
                                key={tag.id}
                                variant={state === 'new' ? 'outline' : 'default'}
                                className={cn(
                                  'text-xs',
                                  state === 'no-change' && tag.color,
                                  state === 'new' && `bg-transparent ${textColorClass} ${tag.borderColor}`,
                                  state === 'removed' && `${tag.color} line-through opacity-50`
                                )}
                              >
                                {tag.name}
                              </Badge>
                            );
                          })}
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Plus className="h-3 w-3" />
                          Add tags
                        </span>
                      )}
                    </div>
                  </PopoverTrigger>
                  <PopoverContent className="w-[220px] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput placeholder="Search tags..." />
                      <CommandList>
                        <CommandEmpty>No tags found.</CommandEmpty>
                        <CommandGroup>
                          {mockTags.map((tag) => {
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
            </CardContent>
          </Card>

          {/* Assignee & Priority Row */}
          <Card>
            <CardContent className="p-4 space-y-4">
              {/* Assignee */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Assignee</Label>
                <Select value={selectedAssigneeId} onValueChange={setSelectedAssigneeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockCaseworkers.map((cw) => (
                      <SelectItem key={cw.id} value={cw.id}>
                        {cw.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Priority */}
              <PrioritySelector value={priority} onChange={setPriority} />
            </CardContent>
          </Card>
          </div>
        </ScrollArea>

        {/* Pinned Action Button */}
        <div className="shrink-0 border-t bg-background">
          <Button className="w-full" size="lg" onClick={handleApprove}>
            <Check className="mr-2 h-4 w-4" />
            Approve & Next
          </Button>
        </div>
      </div>

      {/* Modals */}
      <CreateConstituentModal
        open={createConstituentModalOpen}
        onOpenChange={setCreateConstituentModalOpen}
        prefillData={prefillConstituentData}
        onRequestAddress={() => {
          setCreateConstituentModalOpen(false);
          setRequestAddressModalOpen(true);
        }}
        onCreate={handleCreateConstituent}
      />

      <CreateCaseModal
        open={createCaseModalOpen}
        onOpenChange={setCreateCaseModalOpen}
        prefillData={prefillCaseData}
        onCreate={handleCreateCase}
      />

      <RequestAddressModal
        open={requestAddressModalOpen}
        onOpenChange={setRequestAddressModalOpen}
        email={currentTriageCase.email}
        onSend={handleSendAddressRequest}
      />

      <AssignToCampaignModal
        open={assignCampaignModalOpen}
        onOpenChange={setAssignCampaignModalOpen}
        onAssign={handleAssignToCampaign}
        onCreate={handleCreateCampaign}
      />
    </div>
  );
}
