/**
 * Component Prototype Page
 *
 * Showcases all triage workspace components in their various states.
 * States demonstrated: Empty, AI Matched/Determined, Confirmed/Approved
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ConstituentSelector,
  ConstituentCard,
  CaseSelector,
  CaseCard,
  CaseworkerSelector,
  CaseworkerAvatar,
  CaseworkerPill,
  PrioritySelector,
  PriorityBadge,
  TagPicker,
  TagList,
  MessageDetailHeader,
  MessageCard,
  CompactMessageCard,
  TriageSkeletons,
  ConstituentPill,
  CasePill,
  CaseworkerStatusPill,
  PillStatusRow,
  SearchableDropdown,
} from '@/components/triage';
import type { CasePriority } from '@/lib/database.types';
import type { TriageMessage } from '@/hooks/triage/useTriage';
import { HelpCircle, AlertCircle, CheckCircle2, Info } from 'lucide-react';

// Mock data for demonstrations
const mockMessage: TriageMessage = {
  id: 'mock-message-1',
  subject: 'Concerns about local traffic issues',
  snippet: 'Dear MP, I am writing to express my concerns about the increasing traffic congestion on High Street...',
  body: 'Dear MP,\n\nI am writing to express my concerns about the increasing traffic congestion on High Street. The situation has become quite difficult for residents...',
  senderEmail: 'john.smith@example.com',
  senderName: 'John Smith',
  received_at: new Date().toISOString(),
  triage_status: 'pending',
  campaign_id: null,
  case_id: null,
  constituentStatus: 'has_address',
  senderConstituent: null,
  addressFromEmail: '123 High Street, London SW1A 1AA',
};

const mockMessageKnown: TriageMessage = {
  ...mockMessage,
  id: 'mock-message-2',
  constituentStatus: 'known',
  triage_status: 'confirmed',
  senderConstituent: {
    id: 'const-1',
    full_name: 'John Smith',
  },
};

const mockMessageUnknown: TriageMessage = {
  ...mockMessage,
  id: 'mock-message-3',
  constituentStatus: 'no_address',
  addressFromEmail: undefined,
};

// Section wrapper component
function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// State label component
function StateLabel({ label, variant }: { label: string; variant: 'empty' | 'ai' | 'approved' | 'info' }) {
  const colors = {
    empty: 'bg-gray-100 text-gray-700 border-gray-300',
    ai: 'bg-orange-100 text-orange-700 border-orange-300',
    approved: 'bg-green-100 text-green-700 border-green-300',
    info: 'bg-blue-100 text-blue-700 border-blue-300',
  };

  return (
    <Badge variant="outline" className={`text-xs ${colors[variant]} mb-2`}>
      {label}
    </Badge>
  );
}

export default function ComponentPrototypePage() {
  // State for interactive components
  const [constituentId, setConstituentId] = useState<string | null>(null);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [caseworkerId, setCaseworkerId] = useState<string | null>(null);
  const [priority, setPriority] = useState<CasePriority>('medium');
  const [tagIds, setTagIds] = useState<string[]>([]);

  return (
    <ScrollArea className="h-full">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Component Prototype</h1>
          <p className="text-muted-foreground mt-1">
            All triage workspace components displayed in their various states
          </p>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>About this page</AlertTitle>
          <AlertDescription>
            This page demonstrates all triage workspace components in three main states:
            <strong> Empty</strong> (no selection), <strong>AI/Determined</strong> (AI-matched but not confirmed),
            and <strong>Approved/Confirmed</strong> (human verified).
          </AlertDescription>
        </Alert>

        {/* ===== SEARCHABLE DROPDOWN ===== */}
        <Section
          title="SearchableDropdown (Base Component)"
          description="Base reusable dropdown with search, create new option, and recognition status indicators"
        >
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <StateLabel label="Empty State" variant="empty" />
              <SearchableDropdown
                placeholder="Select item..."
                items={[
                  { id: '1', name: 'Item One', secondary: 'Description' },
                  { id: '2', name: 'Item Two', secondary: 'Another description' },
                ]}
                selectedId={null}
                onSelect={() => {}}
                onCreateNew={() => {}}
                createNewLabel="Create new item"
              />
            </div>
            <div>
              <StateLabel label="AI Matched" variant="ai" />
              <SearchableDropdown
                placeholder="Select item..."
                items={[
                  { id: '1', name: 'Item One', secondary: 'Description' },
                  { id: '2', name: 'Item Two', secondary: 'Another description' },
                ]}
                selectedId="1"
                onSelect={() => {}}
                recognitionStatus="ai_matched"
              />
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <HelpCircle className="h-3 w-3 text-orange-500" /> Orange help icon indicates AI match
              </p>
            </div>
            <div>
              <StateLabel label="Confirmed" variant="approved" />
              <SearchableDropdown
                placeholder="Select item..."
                items={[
                  { id: '1', name: 'Item One', secondary: 'Description' },
                  { id: '2', name: 'Item Two', secondary: 'Another description' },
                ]}
                selectedId="1"
                onSelect={() => {}}
                recognitionStatus="confirmed"
              />
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-600" /> Green checkmark indicates confirmed
              </p>
            </div>
          </div>
        </Section>

        {/* ===== CONSTITUENT SELECTOR ===== */}
        <Section
          title="ConstituentSelector"
          description="Searchable dropdown for selecting/creating constituents with recognition status"
        >
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <StateLabel label="Empty State" variant="empty" />
              <ConstituentSelector
                selectedId={null}
                onSelect={() => {}}
                onCreateNew={() => {}}
                recognitionStatus="none"
              />
            </div>
            <div>
              <StateLabel label="AI Matched" variant="ai" />
              <ConstituentSelector
                selectedId={constituentId}
                onSelect={setConstituentId}
                onCreateNew={() => {}}
                recognitionStatus="ai_matched"
              />
            </div>
            <div>
              <StateLabel label="Confirmed" variant="approved" />
              <ConstituentSelector
                selectedId={constituentId}
                onSelect={setConstituentId}
                recognitionStatus="confirmed"
              />
            </div>
          </div>

          <Separator className="my-6" />

          <h4 className="font-medium mb-3">ConstituentCard</h4>
          <p className="text-sm text-muted-foreground mb-3">
            Displays selected constituent details (name, email, address)
          </p>
          <div className="max-w-sm">
            <ConstituentCard constituentId={constituentId} />
            {!constituentId && (
              <p className="text-sm text-muted-foreground italic">
                Select a constituent above to see the card
              </p>
            )}
          </div>
        </Section>

        {/* ===== CASE SELECTOR ===== */}
        <Section
          title="CaseSelector"
          description="Searchable dropdown for selecting/creating cases with status badges"
        >
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <StateLabel label="Empty State" variant="empty" />
              <CaseSelector
                selectedId={null}
                onSelect={() => {}}
                onCreateNew={() => {}}
              />
            </div>
            <div>
              <StateLabel label="Selected" variant="info" />
              <CaseSelector
                selectedId={caseId}
                onSelect={setCaseId}
                onCreateNew={() => {}}
              />
            </div>
            <div>
              <StateLabel label="Disabled (Campaign)" variant="empty" />
              <CaseSelector
                selectedId={null}
                onSelect={() => {}}
                disabled={true}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Disabled when message is assigned to a campaign
              </p>
            </div>
          </div>

          <Separator className="my-6" />

          <h4 className="font-medium mb-3">CaseCard</h4>
          <p className="text-sm text-muted-foreground mb-3">
            Displays selected case details (title, reference number, status, priority)
          </p>
          <div className="max-w-sm">
            <CaseCard caseId={caseId} />
            {!caseId && (
              <p className="text-sm text-muted-foreground italic">
                Select a case above to see the card
              </p>
            )}
          </div>
        </Section>

        {/* ===== CASEWORKER SELECTOR ===== */}
        <Section
          title="CaseworkerSelector"
          description="Dropdown for selecting a caseworker/assignee with avatar and role badge"
        >
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <StateLabel label="Unassigned" variant="empty" />
              <CaseworkerSelector
                selectedId={null}
                onSelect={() => {}}
                showUnassignedOption
              />
            </div>
            <div>
              <StateLabel label="Selected" variant="info" />
              <CaseworkerSelector
                selectedId={caseworkerId}
                onSelect={setCaseworkerId}
                showUnassignedOption
              />
            </div>
            <div>
              <StateLabel label="Disabled" variant="empty" />
              <CaseworkerSelector
                selectedId={null}
                onSelect={() => {}}
                disabled={true}
              />
            </div>
          </div>

          <Separator className="my-6" />

          <h4 className="font-medium mb-3">CaseworkerAvatar & CaseworkerPill</h4>
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Avatar sizes:</p>
              <div className="flex items-center gap-4">
                <CaseworkerAvatar profileId={caseworkerId} size="sm" />
                <CaseworkerAvatar profileId={caseworkerId} size="default" />
                <CaseworkerAvatar profileId={caseworkerId} size="lg" />
                <CaseworkerAvatar profileId={caseworkerId} size="default" showName />
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">Caseworker Pill:</p>
              <CaseworkerPill profileId={caseworkerId} />
            </div>
          </div>
        </Section>

        {/* ===== PRIORITY SELECTOR ===== */}
        <Section
          title="PrioritySelector"
          description="Button group for selecting case priority with optimistic updates"
        >
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <StateLabel label="Default Size" variant="info" />
              <PrioritySelector
                value={priority}
                onChange={setPriority}
              />
            </div>
            <div>
              <StateLabel label="Small Size" variant="info" />
              <PrioritySelector
                value={priority}
                onChange={setPriority}
                size="sm"
              />
            </div>
            <div>
              <StateLabel label="Disabled" variant="empty" />
              <PrioritySelector
                value="medium"
                onChange={() => {}}
                disabled={true}
              />
            </div>
          </div>

          <Separator className="my-6" />

          <h4 className="font-medium mb-3">PriorityBadge</h4>
          <div className="flex gap-2 flex-wrap">
            <PriorityBadge priority="low" />
            <PriorityBadge priority="medium" />
            <PriorityBadge priority="high" />
            <PriorityBadge priority="urgent" />
          </div>
        </Section>

        {/* ===== TAG PICKER ===== */}
        <Section
          title="TagPicker"
          description="Tag selection with create new, supports showing change states (new, removed, unchanged)"
        >
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <StateLabel label="Default Variant (Empty)" variant="empty" />
              <TagPicker
                selectedTagIds={[]}
                onChange={() => {}}
                variant="default"
              />
            </div>
            <div>
              <StateLabel label="Default Variant (With Tags)" variant="info" />
              <TagPicker
                selectedTagIds={tagIds}
                onChange={setTagIds}
                variant="default"
              />
            </div>
            <div>
              <StateLabel label="Menubar Variant (Empty)" variant="empty" />
              <TagPicker
                selectedTagIds={[]}
                onChange={() => {}}
                variant="menubar"
              />
            </div>
            <div>
              <StateLabel label="Menubar Variant (With Tags)" variant="info" />
              <TagPicker
                selectedTagIds={tagIds}
                onChange={setTagIds}
                variant="menubar"
              />
            </div>
            <div>
              <StateLabel label="Disabled" variant="empty" />
              <TagPicker
                selectedTagIds={[]}
                onChange={() => {}}
                disabled={true}
              />
            </div>
          </div>

          <Separator className="my-6" />

          <h4 className="font-medium mb-3">TagList (Read-only display)</h4>
          <TagList tagIds={tagIds} />
          {tagIds.length === 0 && (
            <p className="text-sm text-muted-foreground italic">
              Select some tags above to see them displayed here
            </p>
          )}
        </Section>

        {/* ===== STATUS PILLS ===== */}
        <Section
          title="StatusPills"
          description="Pill badges showing triage status with three visual states: approved, determined, uncertain"
        >
          <h4 className="font-medium mb-3">ConstituentPill</h4>
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="space-y-1">
              <StateLabel label="Approved" variant="approved" />
              <ConstituentPill constituent={{ status: 'approved', name: 'John Smith' }} />
            </div>
            <div className="space-y-1">
              <StateLabel label="Determined (AI)" variant="ai" />
              <ConstituentPill constituent={{ status: 'determined', name: 'Jane Doe' }} />
            </div>
            <div className="space-y-1">
              <StateLabel label="Uncertain + Address" variant="empty" />
              <ConstituentPill constituent={{ status: 'uncertain_with_address' }} />
            </div>
            <div className="space-y-1">
              <StateLabel label="Uncertain - No Address" variant="empty" />
              <ConstituentPill constituent={{ status: 'uncertain_no_address' }} />
            </div>
          </div>

          <h4 className="font-medium mb-3">CasePill</h4>
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="space-y-1">
              <StateLabel label="Approved" variant="approved" />
              <CasePill caseInfo={{ status: 'approved', caseNumber: '#12345' }} />
            </div>
            <div className="space-y-1">
              <StateLabel label="Determined (AI)" variant="ai" />
              <CasePill caseInfo={{ status: 'determined', caseNumber: '#12346' }} />
            </div>
            <div className="space-y-1">
              <StateLabel label="Uncertain" variant="empty" />
              <CasePill caseInfo={{ status: 'uncertain' }} />
            </div>
          </div>

          <h4 className="font-medium mb-3">CaseworkerStatusPill</h4>
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="space-y-1">
              <StateLabel label="Approved" variant="approved" />
              <CaseworkerStatusPill caseworker={{ status: 'approved', name: 'Alice Brown' }} />
            </div>
            <div className="space-y-1">
              <StateLabel label="Determined (AI)" variant="ai" />
              <CaseworkerStatusPill caseworker={{ status: 'determined', name: 'Bob Wilson' }} />
            </div>
            <div className="space-y-1">
              <StateLabel label="Uncertain" variant="empty" />
              <CaseworkerStatusPill caseworker={{ status: 'uncertain' }} />
            </div>
          </div>

          <h4 className="font-medium mb-3">PillStatusRow (All pills combined)</h4>
          <div className="space-y-3">
            <div>
              <StateLabel label="All Approved" variant="approved" />
              <PillStatusRow
                constituent={{ status: 'approved', name: 'John Smith' }}
                caseInfo={{ status: 'approved', caseNumber: '#12345' }}
                caseworker={{ status: 'approved', name: 'Alice Brown' }}
              />
            </div>
            <div>
              <StateLabel label="Mixed States" variant="ai" />
              <PillStatusRow
                constituent={{ status: 'determined', name: 'Jane Doe' }}
                caseInfo={{ status: 'uncertain' }}
                caseworker={{ status: 'determined', name: 'Bob Wilson' }}
              />
            </div>
            <div>
              <StateLabel label="All Uncertain" variant="empty" />
              <PillStatusRow
                constituent={{ status: 'uncertain_no_address' }}
                caseInfo={{ status: 'uncertain' }}
                caseworker={{ status: 'uncertain' }}
              />
            </div>
          </div>
        </Section>

        {/* ===== MESSAGE COMPONENTS ===== */}
        <Section
          title="Message Components"
          description="Components for displaying message information in lists and detail views"
        >
          <h4 className="font-medium mb-3">MessageDetailHeader</h4>
          <div className="space-y-4 mb-6">
            <div>
              <StateLabel label="Known Constituent" variant="approved" />
              <div className="border rounded-lg p-4">
                <MessageDetailHeader message={mockMessageKnown} />
              </div>
            </div>
            <div>
              <StateLabel label="Has Address (Can Create)" variant="ai" />
              <div className="border rounded-lg p-4">
                <MessageDetailHeader message={mockMessage} />
              </div>
            </div>
            <div>
              <StateLabel label="No Address (Unknown)" variant="empty" />
              <div className="border rounded-lg p-4">
                <MessageDetailHeader message={mockMessageUnknown} />
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          <h4 className="font-medium mb-3">MessageCard</h4>
          <div className="border rounded-lg overflow-hidden mb-6">
            <MessageCard message={mockMessageKnown} showCase showTags />
            <MessageCard message={mockMessage} showCase showTags />
            <MessageCard message={mockMessageUnknown} showCase showTags isActive />
          </div>

          <h4 className="font-medium mb-3">CompactMessageCard</h4>
          <div className="border rounded-lg overflow-hidden max-w-md">
            <CompactMessageCard message={mockMessageKnown} />
            <CompactMessageCard message={mockMessage} isSelected />
            <CompactMessageCard message={mockMessageUnknown} />
          </div>
        </Section>

        {/* ===== CONSTITUENT STATUS ALERTS ===== */}
        <Section
          title="Constituent Status Alerts"
          description="Alert banners shown based on constituent matching status"
        >
          <div className="space-y-4">
            <div>
              <StateLabel label="Known Constituent" variant="approved" />
              <p className="text-sm text-muted-foreground mb-2">No alert shown - constituent is matched</p>
            </div>
            <div>
              <StateLabel label="Has Address" variant="ai" />
              <Alert>
                <HelpCircle className="h-4 w-4" />
                <AlertTitle>Address found in message</AlertTitle>
                <AlertDescription>
                  <span className="font-medium">123 High Street, London SW1A 1AA</span>
                  {' - '}You can create a new constituent record with this address.
                </AlertDescription>
              </Alert>
            </div>
            <div>
              <StateLabel label="No Address" variant="empty" />
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Unknown sender</AlertTitle>
                <AlertDescription>
                  No constituent match found and no address detected. Consider requesting
                  address confirmation.
                </AlertDescription>
              </Alert>
            </div>
          </div>
        </Section>

        {/* ===== SKELETONS ===== */}
        <Section
          title="Loading Skeletons"
          description="Animated placeholder components shown during data loading"
        >
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h4 className="font-medium mb-3">MessageCard Skeleton</h4>
              <TriageSkeletons.MessageCard />
            </div>
            <div>
              <h4 className="font-medium mb-3">Dropdown Skeleton</h4>
              <TriageSkeletons.Dropdown />
            </div>
            <div>
              <h4 className="font-medium mb-3">Badge Skeleton</h4>
              <TriageSkeletons.Badge />
            </div>
            <div>
              <h4 className="font-medium mb-3">Campaign Card Skeleton</h4>
              <TriageSkeletons.CampaignCard />
            </div>
          </div>

          <Separator className="my-6" />

          <h4 className="font-medium mb-3">Message Detail Skeleton</h4>
          <div className="border rounded-lg p-4">
            <TriageSkeletons.MessageDetail />
          </div>

          <Separator className="my-6" />

          <h4 className="font-medium mb-3">Triage Panel Skeleton</h4>
          <div className="border rounded-lg max-w-sm">
            <TriageSkeletons.TriagePanel />
          </div>

          <Separator className="my-6" />

          <h4 className="font-medium mb-3">Message List Skeleton</h4>
          <div className="border rounded-lg overflow-hidden max-w-md">
            <TriageSkeletons.MessageList count={3} />
          </div>
        </Section>

        {/* ===== INTERACTIVE DEMO ===== */}
        <Section
          title="Interactive Demo"
          description="Try out the components with live state"
        >
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <ConstituentSelector
                selectedId={constituentId}
                onSelect={setConstituentId}
                onCreateNew={() => alert('Create new constituent clicked!')}
                recognitionStatus={constituentId ? 'ai_matched' : 'none'}
              />
              {constituentId && <ConstituentCard constituentId={constituentId} />}

              <CaseSelector
                selectedId={caseId}
                onSelect={setCaseId}
                onCreateNew={() => alert('Create new case clicked!')}
                constituentId={constituentId}
              />
              {caseId && <CaseCard caseId={caseId} />}

              <CaseworkerSelector
                selectedId={caseworkerId}
                onSelect={setCaseworkerId}
                showUnassignedOption
              />

              <PrioritySelector
                value={priority}
                onChange={setPriority}
              />

              <TagPicker
                selectedTagIds={tagIds}
                onChange={setTagIds}
              />
            </div>

            <div className="space-y-4">
              <h4 className="font-medium">Current Triage State:</h4>
              <div className="bg-muted/30 rounded-lg p-4 space-y-2 font-mono text-sm">
                <div><span className="text-muted-foreground">constituentId:</span> {constituentId || 'null'}</div>
                <div><span className="text-muted-foreground">caseId:</span> {caseId || 'null'}</div>
                <div><span className="text-muted-foreground">caseworkerId:</span> {caseworkerId || 'null'}</div>
                <div><span className="text-muted-foreground">priority:</span> {priority}</div>
                <div><span className="text-muted-foreground">tagIds:</span> [{tagIds.join(', ')}]</div>
              </div>

              <h4 className="font-medium mt-6">Status Pills Preview:</h4>
              <PillStatusRow
                constituent={{
                  status: constituentId ? 'determined' : 'uncertain_no_address',
                  name: constituentId ? 'Selected Constituent' : undefined,
                }}
                caseInfo={{
                  status: caseId ? 'determined' : 'uncertain',
                  caseNumber: caseId ? '#Preview' : undefined,
                }}
                caseworker={{
                  status: caseworkerId ? 'determined' : 'uncertain',
                  name: caseworkerId ? 'Assigned' : undefined,
                }}
              />
            </div>
          </div>
        </Section>
      </div>
    </ScrollArea>
  );
}
