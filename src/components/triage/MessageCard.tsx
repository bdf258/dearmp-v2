/**
 * MessageCard
 *
 * Reusable message metadata display component for inbox lists and detail views.
 * Shows subject, snippet, sender info, campaign, timestamp.
 */

import { useMemo } from 'react';
import { useSupabase } from '@/lib/SupabaseContext';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Mail,
  User,
  Clock,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import type { TriageMessage, ConstituentStatus } from '@/hooks/triage/useTriage';
import { CaseRefBadge } from './CaseSelector';
import { TagList } from './TagPicker';
import { CaseworkerAvatar } from './CaseworkerSelector';

interface MessageCardProps {
  message: TriageMessage;
  isSelected?: boolean;
  onSelect?: () => void;
  onClick?: () => void;
  showCheckbox?: boolean;
  showCampaign?: boolean;
  showCase?: boolean;
  showAssignee?: boolean;
  showTags?: boolean;
  isActive?: boolean;
  className?: string;
}

// Helper to get initials from name/email
function getInitials(name: string): string {
  if (name.includes('@')) {
    return name[0].toUpperCase();
  }
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Format date for display
function formatMessageDate(date: string): string {
  const d = new Date(date);
  if (isToday(d)) {
    return format(d, 'h:mm a');
  }
  if (isYesterday(d)) {
    return 'Yesterday';
  }
  return format(d, 'MMM d');
}

// Constituent status indicator
function ConstituentStatusBadge({ status }: { status: ConstituentStatus }) {
  switch (status) {
    case 'known':
      return (
        <div className="flex items-center gap-1 text-green-600">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span className="text-xs">Known</span>
        </div>
      );
    case 'has_address':
      return (
        <div className="flex items-center gap-1 text-yellow-600">
          <HelpCircle className="h-3.5 w-3.5" />
          <span className="text-xs">Has address</span>
        </div>
      );
    case 'no_address':
      return (
        <div className="flex items-center gap-1 text-red-600">
          <AlertCircle className="h-3.5 w-3.5" />
          <span className="text-xs">No address</span>
        </div>
      );
  }
}

export function MessageCard({
  message,
  isSelected,
  onSelect,
  onClick,
  showCheckbox,
  showCampaign,
  showCase = true,
  showAssignee,
  showTags,
  isActive,
  className,
}: MessageCardProps) {
  const { campaigns, cases, getTagsForEntity } = useSupabase();

  const campaign = message.campaign_id
    ? campaigns.find(c => c.id === message.campaign_id)
    : null;

  const linkedCase = message.case_id
    ? cases.find(c => c.id === message.case_id)
    : null;

  const messageTags = useMemo(() => {
    return getTagsForEntity('message', message.id);
  }, [message.id, getTagsForEntity]);

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 border-b cursor-pointer transition-colors',
        isActive && 'bg-primary/5 border-l-2 border-l-primary',
        !isActive && 'hover:bg-muted/50',
        className
      )}
      onClick={onClick}
    >
      {/* Checkbox for bulk selection */}
      {showCheckbox && (
        <div className="pt-1" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onSelect?.()}
            aria-label="Select message"
          />
        </div>
      )}

      {/* Avatar */}
      <Avatar className="h-9 w-9 shrink-0">
        <AvatarFallback className="bg-muted text-sm">
          {message.senderConstituent
            ? getInitials(message.senderConstituent.full_name)
            : getInitials(message.senderName)}
        </AvatarFallback>
      </Avatar>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        {/* Top row: sender + date */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-medium truncate">
              {message.senderConstituent?.full_name || message.senderName}
            </span>
            <ConstituentStatusBadge status={message.constituentStatus} />
          </div>
          <span className="text-xs text-muted-foreground shrink-0">
            {formatMessageDate(message.received_at)}
          </span>
        </div>

        {/* Subject */}
        <div className="font-medium text-sm truncate">{message.subject || '(No subject)'}</div>

        {/* Snippet */}
        <div className="text-sm text-muted-foreground line-clamp-2">
          {message.snippet || 'No preview available'}
        </div>

        {/* Bottom row: badges */}
        <div className="flex items-center gap-2 flex-wrap pt-1">
          {/* Campaign badge */}
          {showCampaign && campaign && (
            <Badge variant="secondary" className="text-xs">
              <MessageSquare className="h-3 w-3 mr-1" />
              {campaign.name}
            </Badge>
          )}

          {/* Case reference */}
          {showCase && linkedCase && (
            <CaseRefBadge caseId={linkedCase.id} />
          )}

          {/* Assignee */}
          {showAssignee && linkedCase?.assigned_to && (
            <CaseworkerAvatar profileId={linkedCase.assigned_to} size="sm" />
          )}

          {/* Tags */}
          {showTags && messageTags.length > 0 && (
            <TagList tagIds={messageTags.map(t => t.tag_id)} />
          )}

          {/* Address from email (for has_address status) */}
          {message.constituentStatus === 'has_address' && message.addressFromEmail && (
            <Badge variant="outline" className="text-xs bg-yellow-50">
              {message.addressFromEmail}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

// Compact version for campaign email lists
export function CompactMessageCard({
  message,
  isSelected,
  onSelect,
  onClick,
  isActive,
  className,
}: Omit<MessageCardProps, 'showCheckbox' | 'showCampaign' | 'showCase' | 'showAssignee' | 'showTags'> & {
  isSelected?: boolean;
  onSelect?: () => void;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 px-3 py-2 border-b cursor-pointer transition-colors',
        isSelected && 'bg-primary/10',
        isActive && !isSelected && 'bg-muted',
        !isActive && !isSelected && 'hover:bg-muted/50',
        className
      )}
      onClick={onClick}
    >
      <Checkbox
        checked={isSelected}
        onCheckedChange={() => onSelect?.()}
        onClick={(e) => e.stopPropagation()}
        aria-label="Select message"
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-sm truncate">
            {message.senderConstituent?.full_name || message.senderName}
          </span>
          <ConstituentStatusBadge status={message.constituentStatus} />
        </div>
        <div className="text-xs text-muted-foreground truncate">{message.senderEmail}</div>
      </div>
    </div>
  );
}

// Message detail header (for triage workspace)
export function MessageDetailHeader({
  message,
  className,
}: {
  message: TriageMessage;
  className?: string;
}) {
  return (
    <div className={cn('space-y-3', className)}>
      <h2 className="text-xl font-semibold">{message.subject || '(No subject)'}</h2>

      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarFallback className="bg-primary/10 text-primary">
            {getInitials(message.senderConstituent?.full_name || message.senderName)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">
              {message.senderConstituent?.full_name || message.senderName}
            </span>
            <ConstituentStatusBadge status={message.constituentStatus} />
          </div>
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Mail className="h-3.5 w-3.5" />
            {message.senderEmail}
          </div>
        </div>

        <div className="text-sm text-muted-foreground flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {format(new Date(message.received_at), 'MMM d, yyyy h:mm a')}
        </div>
      </div>
    </div>
  );
}
