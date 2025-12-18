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

import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  ChevronDown,
  Plus,
  X,
  User,
  Briefcase,
  Tag,
  Reply,
  Mail,
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
  name: string;
  constituentId?: string;
}

interface CaseTag {
  id: string;
  name: string;
  color: string;
}

interface Caseworker {
  id: string;
  name: string;
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
  { id: 'case-1', name: 'Housing Association', constituentId: 'con-1' },
  { id: 'case-2', name: 'Council Tax Dispute', constituentId: 'con-2' },
  { id: 'case-3', name: 'Planning Application', constituentId: 'con-1' },
  { id: 'case-4', name: 'Benefits Query', constituentId: 'con-4' },
  { id: 'case-5', name: 'Parking Permit Issue' },
];

const mockTags: CaseTag[] = [
  { id: 'tag-1', name: 'Urgent', color: 'bg-red-100 text-red-700' },
  { id: 'tag-2', name: 'Housing', color: 'bg-blue-100 text-blue-700' },
  { id: 'tag-3', name: 'Benefits', color: 'bg-green-100 text-green-700' },
  { id: 'tag-4', name: 'Follow-up Required', color: 'bg-yellow-100 text-yellow-700' },
  { id: 'tag-5', name: 'Immigration', color: 'bg-purple-100 text-purple-700' },
  { id: 'tag-6', name: 'Council Tax', color: 'bg-orange-100 text-orange-700' },
  { id: 'tag-7', name: 'Planning', color: 'bg-teal-100 text-teal-700' },
  { id: 'tag-8', name: 'NHS', color: 'bg-pink-100 text-pink-700' },
];

const mockCaseworkers: Caseworker[] = [
  { id: 'cw-1', name: 'Caseworker 1' },
  { id: 'cw-2', name: 'Caseworker 2' },
  { id: 'cw-3', name: 'Senior Caseworker' },
  { id: 'cw-4', name: 'Office Manager' },
];

const mockEmail: Email = {
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
};

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
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-10"
          >
            <span className="flex items-center gap-2 truncate">
              {icon}
              {selectedItem ? (
                <span className="truncate">{selectedItem.name}</span>
              ) : (
                <span className="text-muted-foreground">{placeholder}</span>
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
    </div>
  );
}

// ============= TAG SELECTOR MODAL =============

interface TagSelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableTags: CaseTag[];
  selectedTagIds: string[];
  onTagsChange: (tagIds: string[]) => void;
}

function TagSelectorModal({
  open,
  onOpenChange,
  availableTags,
  selectedTagIds,
  onTagsChange,
}: TagSelectorModalProps) {
  const [search, setSearch] = useState('');

  const filteredTags = useMemo(() => {
    if (!search) return availableTags;
    return availableTags.filter((tag) =>
      tag.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [availableTags, search]);

  const toggleTag = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onTagsChange(selectedTagIds.filter((id) => id !== tagId));
    } else {
      onTagsChange([...selectedTagIds, tagId]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Case Tags</DialogTitle>
          <DialogDescription>
            Search and select tags to add to this case.
          </DialogDescription>
        </DialogHeader>
        <Command className="rounded-lg border shadow-md">
          <CommandInput
            placeholder="Search tags..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No tags found.</CommandEmpty>
            <CommandGroup>
              {filteredTags.map((tag) => {
                const isSelected = selectedTagIds.includes(tag.id);
                return (
                  <CommandItem
                    key={tag.id}
                    value={tag.id}
                    onSelect={() => toggleTag(tag.id)}
                  >
                    <div
                      className={cn(
                        'mr-2 flex h-4 w-4 items-center justify-center rounded border',
                        isSelected
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'opacity-50'
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    <Badge className={cn('font-normal', tag.color)}>
                      {tag.name}
                    </Badge>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

// ============= PRIORITY SELECTOR =============

interface PrioritySelectorProps {
  value: 'L' | 'M' | 'H';
  onChange: (value: 'L' | 'M' | 'H') => void;
}

function PrioritySelector({ value, onChange }: PrioritySelectorProps) {
  const priorities: { key: 'L' | 'M' | 'H'; label: string; color: string }[] = [
    { key: 'L', label: 'L', color: 'bg-green-100 text-green-700 border-green-300' },
    { key: 'M', label: 'M', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
    { key: 'H', label: 'H', color: 'bg-red-100 text-red-700 border-red-300' },
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

// ============= MAIN COMPONENT =============

export default function TriagePrototype5() {
  // State for selected values
  const [selectedConstituentId, setSelectedConstituentId] = useState<string | null>('con-1');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>('case-1');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(['tag-1', 'tag-2']);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>('cw-1');
  const [priority, setPriority] = useState<'L' | 'M' | 'H'>('H');

  // Modal states
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [createConstituentModalOpen, setCreateConstituentModalOpen] = useState(false);
  const [createCaseModalOpen, setCreateCaseModalOpen] = useState(false);
  const [requestAddressModalOpen, setRequestAddressModalOpen] = useState(false);

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
      name: c.name,
    }));
  }, [selectedConstituentId]);

  // Get selected items for display
  const selectedConstituent = mockConstituents.find(
    (c) => c.id === selectedConstituentId
  );
  const selectedCase = mockCases.find((c) => c.id === selectedCaseId);
  const selectedTags = mockTags.filter((t) => selectedTagIds.includes(t.id));

  // Prefill data from email
  const prefillConstituentData = {
    name: mockEmail.fromName,
    email: mockEmail.fromEmail,
    address: mockEmail.addressFound,
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
  };

  const handleSendAddressRequest = (message: string) => {
    console.log('Sending address request:', message);
    // In real app, this would send the email
  };

  const removeTag = (tagId: string) => {
    setSelectedTagIds(selectedTagIds.filter((id) => id !== tagId));
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-6">
      {/* Left Panel - Email View */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardContent className="flex-1 flex flex-col p-6 overflow-hidden">
          {/* Email Header */}
          <div className="shrink-0 border-b pb-4 mb-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              Subject
            </div>
            <h2 className="text-lg font-semibold">{mockEmail.subject}</h2>
            <div className="text-sm text-muted-foreground mt-2">
              From: {mockEmail.fromName} &lt;{mockEmail.fromEmail}&gt;
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {new Date(mockEmail.receivedAt).toLocaleString()}
            </div>
          </div>

          {/* Email Body */}
          <div className="flex-1 overflow-hidden">
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
              Body
            </div>
            <ScrollArea className="h-full pr-4">
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {mockEmail.body}
              </div>
            </ScrollArea>
          </div>

          {/* Reply To */}
          <div className="shrink-0 pt-4 mt-4 border-t">
            <Button className="w-full" variant="outline">
              <Reply className="mr-2 h-4 w-4" />
              Reply to
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Right Panel - Case Management */}
      <div className="w-[320px] flex flex-col gap-4">
        {/* Constituent Dropdown */}
        <Card>
          <CardContent className="p-4">
            <SearchableDropdown
              label="Constituent"
              icon={<User className="h-4 w-4" />}
              placeholder="Select constituent..."
              items={constituentItems}
              selectedId={selectedConstituentId}
              onSelect={setSelectedConstituentId}
              onCreateNew={() => setCreateConstituentModalOpen(true)}
              createNewLabel="Create new constituent"
            />
          </CardContent>
        </Card>

        {/* Case Dropdown */}
        <Card>
          <CardContent className="p-4">
            <SearchableDropdown
              label="Case"
              icon={<Briefcase className="h-4 w-4" />}
              placeholder="Select case..."
              items={caseItems}
              selectedId={selectedCaseId}
              onSelect={setSelectedCaseId}
              onCreateNew={() => setCreateCaseModalOpen(true)}
              createNewLabel="Create new case"
            />
          </CardContent>
        </Card>

        {/* Case Tags */}
        <Card>
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Case Tags</Label>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setTagModalOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5 min-h-[60px] p-2 border rounded-md bg-muted/30">
                {selectedTags.length > 0 ? (
                  selectedTags.map((tag) => (
                    <Badge
                      key={tag.id}
                      className={cn('gap-1 pr-1', tag.color)}
                    >
                      {tag.name}
                      <button
                        type="button"
                        onClick={() => removeTag(tag.id)}
                        className="ml-1 rounded-full hover:bg-black/10 p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">
                    No tags added
                  </span>
                )}
              </div>
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

        {/* Action Button */}
        <Button className="w-full" size="lg">
          <Check className="mr-2 h-4 w-4" />
          Save & Continue
        </Button>
      </div>

      {/* Modals */}
      <TagSelectorModal
        open={tagModalOpen}
        onOpenChange={setTagModalOpen}
        availableTags={mockTags}
        selectedTagIds={selectedTagIds}
        onTagsChange={setSelectedTagIds}
      />

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
        email={mockEmail}
        onSend={handleSendAddressRequest}
      />
    </div>
  );
}
