/**
 * CaseworkerSelector
 *
 * Dropdown for selecting a caseworker from office profiles.
 * Shows avatar/initials fallback and role badge.
 */

import { useMemo } from 'react';
import { useCaseworkers } from '@/hooks/triage/useTriage';
import { useSupabase } from '@/lib/SupabaseContext';
import { SearchableDropdown, type DropdownItem } from './SearchableDropdown';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserCog, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/lib/database.types';

interface CaseworkerSelectorProps {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
  showUnassignedOption?: boolean;
}

const roleLabels: Record<UserRole, string> = {
  admin: 'Admin',
  staff: 'Staff',
  readonly: 'Viewer',
};

function getInitials(name: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function CaseworkerSelector({
  selectedId,
  onSelect,
  disabled,
  label = 'Assignee',
  className,
  showUnassignedOption,
}: CaseworkerSelectorProps) {
  const { caseworkers } = useCaseworkers();

  // Build dropdown items
  const items: DropdownItem[] = useMemo(() => {
    const baseItems = caseworkers.map((p) => ({
      id: p.id,
      name: p.full_name || 'Unknown',
      secondary: p.role ? roleLabels[p.role] : undefined,
      badge: p.role === 'admin' ? (
        <Badge variant="outline" className="text-xs py-0 bg-purple-100 text-purple-700">
          admin
        </Badge>
      ) : undefined,
    }));

    if (showUnassignedOption) {
      return [
        { id: '__unassigned__', name: 'Unassigned', secondary: 'No assignee' },
        ...baseItems,
      ];
    }

    return baseItems;
  }, [caseworkers, showUnassignedOption]);

  const handleSelect = (id: string | null) => {
    if (id === '__unassigned__') {
      onSelect(null);
    } else {
      onSelect(id);
    }
  };

  return (
    <SearchableDropdown
      label={label}
      icon={<UserCog className="h-4 w-4 text-muted-foreground" />}
      placeholder="Select assignee"
      items={items}
      selectedId={selectedId}
      onSelect={handleSelect}
      disabled={disabled}
      searchPlaceholder="Search team members..."
      emptyMessage="No team members found"
      className={className}
    />
  );
}

// Avatar badge for caseworker
export function CaseworkerAvatar({
  profileId,
  size = 'default',
  showName = false,
  className,
}: {
  profileId: string | null;
  size?: 'sm' | 'default' | 'lg';
  showName?: boolean;
  className?: string;
}) {
  const { profiles } = useSupabase();

  const profile = profileId ? profiles.find(p => p.id === profileId) : null;

  if (!profile) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Avatar className={cn(
          size === 'sm' && 'h-6 w-6',
          size === 'default' && 'h-8 w-8',
          size === 'lg' && 'h-10 w-10'
        )}>
          <AvatarFallback className="bg-muted">
            <User className="h-4 w-4 text-muted-foreground" />
          </AvatarFallback>
        </Avatar>
        {showName && <span className="text-sm text-muted-foreground">Unassigned</span>}
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Avatar className={cn(
        size === 'sm' && 'h-6 w-6 text-xs',
        size === 'default' && 'h-8 w-8 text-sm',
        size === 'lg' && 'h-10 w-10 text-base'
      )}>
        {profile.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile.full_name || ''} />}
        <AvatarFallback className="bg-primary/10 text-primary font-medium">
          {getInitials(profile.full_name)}
        </AvatarFallback>
      </Avatar>
      {showName && (
        <span className="text-sm font-medium">{profile.full_name || 'Unknown'}</span>
      )}
    </div>
  );
}

// Inline caseworker pill
export function CaseworkerPill({
  profileId,
  className,
}: {
  profileId: string | null;
  className?: string;
}) {
  const { profiles } = useSupabase();

  const profile = profileId ? profiles.find(p => p.id === profileId) : null;

  return (
    <div className={cn(
      'inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted text-sm',
      className
    )}>
      <Avatar className="h-5 w-5 text-[10px]">
        {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
        <AvatarFallback className="bg-primary/10 text-primary font-medium">
          {profile ? getInitials(profile.full_name) : <User className="h-3 w-3" />}
        </AvatarFallback>
      </Avatar>
      <span className="font-medium">
        {profile?.full_name || 'Unassigned'}
      </span>
    </div>
  );
}
