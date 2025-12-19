/**
 * TagPicker
 *
 * Tag picker with keyboard search, create new, and remove functionality.
 * Supports showing tag change states (new, removed, unchanged).
 *
 * Variants:
 * - 'default': Full tag picker with label, shows all tags in a bordered container
 * - 'menubar': Compact variant for headers/menubars, responsive button with popover
 */

import { useState, useMemo, useCallback } from 'react';
import { useSupabase } from '@/lib/SupabaseContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
import { Check, Plus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Tag } from '@/lib/database.types';

export type TagState = 'unchanged' | 'new' | 'removed';

interface TagPickerProps {
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
  originalTagIds?: string[]; // For showing change states
  variant?: 'default' | 'menubar';
  label?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  showCreateNew?: boolean;
  maxDisplayTags?: number; // For menubar variant: how many tags to show before "+X more"
}

export function TagPicker({
  selectedTagIds,
  onChange,
  originalTagIds = [],
  variant = 'default',
  label = 'Tags',
  placeholder = 'Add tags',
  className,
  disabled,
  showCreateNew = true,
  maxDisplayTags = 2,
}: TagPickerProps) {
  const { tags, createTag } = useSupabase();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newTagName, setNewTagName] = useState('');

  // Filter tags by search
  const filteredTags = useMemo(() => {
    if (!search) return tags;
    const lowerSearch = search.toLowerCase();
    return tags.filter(t => t.name.toLowerCase().includes(lowerSearch));
  }, [tags, search]);

  // Compute tag states
  const getTagState = useCallback((tagId: string): TagState => {
    const isSelected = selectedTagIds.includes(tagId);
    const wasOriginal = originalTagIds.includes(tagId);

    if (isSelected && wasOriginal) return 'unchanged';
    if (isSelected && !wasOriginal) return 'new';
    if (!isSelected && wasOriginal) return 'removed';
    return 'unchanged';
  }, [selectedTagIds, originalTagIds]);

  // Tags to display (selected + removed originals)
  const displayTags = useMemo(() => {
    const allTagIds = new Set([...selectedTagIds, ...originalTagIds]);
    return tags.filter(t => allTagIds.has(t.id));
  }, [tags, selectedTagIds, originalTagIds]);

  const handleToggleTag = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onChange(selectedTagIds.filter(id => id !== tagId));
    } else {
      onChange([...selectedTagIds, tagId]);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;

    setIsCreating(true);
    try {
      // Generate a random color
      const colors = [
        '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
        '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
        '#a855f7', '#d946ef', '#ec4899', '#f43f5e',
      ];
      const color = colors[Math.floor(Math.random() * colors.length)];

      const newTag = await createTag(newTagName.trim(), color);
      if (newTag) {
        toast.success(`Tag "${newTag.name}" created`);
        onChange([...selectedTagIds, newTag.id]);
        setNewTagName('');
      } else {
        toast.error('Failed to create tag');
      }
    } finally {
      setIsCreating(false);
    }
  };

  // Shared popover content
  const popoverContent = (
    <PopoverContent className="w-[260px] p-0" align={variant === 'menubar' ? 'end' : 'start'}>
      <Command shouldFilter={false}>
        <CommandInput
          placeholder="Search tags..."
          value={search}
          onValueChange={setSearch}
        />
        <CommandList>
          <CommandEmpty>
            {search ? 'No tags found.' : 'No tags available.'}
          </CommandEmpty>
          <CommandGroup>
            {filteredTags.map((tag) => {
              const isSelected = selectedTagIds.includes(tag.id);
              const state = getTagState(tag.id);
              return (
                <CommandItem
                  key={tag.id}
                  value={tag.id}
                  onSelect={() => handleToggleTag(tag.id)}
                  className="cursor-pointer"
                >
                  <div className="flex items-center gap-2 flex-1">
                    <TagBadge tag={tag} state={variant === 'menubar' ? state : 'unchanged'} />
                  </div>
                  {isSelected && <Check className="h-4 w-4" />}
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </Command>

      {/* Create new tag */}
      {showCreateNew && (
        <div className="border-t p-2">
          <div className="flex gap-2">
            <Input
              placeholder="New tag name..."
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCreateTag();
                }
              }}
              disabled={isCreating}
              className="h-8 text-sm"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={handleCreateTag}
              disabled={!newTagName.trim() || isCreating}
              className="h-8 px-2"
            >
              {isCreating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      )}
    </PopoverContent>
  );

  // Menubar variant
  if (variant === 'menubar') {
    return (
      <Popover open={open && !disabled} onOpenChange={(isOpen) => !disabled && setOpen(isOpen)}>
        {/* Icon button for small screens */}
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className={cn(
              "h-8 w-8 sm:hidden shrink-0 relative",
              disabled && "opacity-50 cursor-not-allowed",
              className
            )}
            disabled={disabled}
          >
            <Plus className="h-4 w-4" />
            {displayTags.length > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 bg-primary text-primary-foreground text-[10px] rounded-full flex items-center justify-center">
                {displayTags.length}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        {/* Full button for larger screens */}
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-8 min-w-[120px] justify-start hidden sm:flex",
              disabled && "opacity-50 cursor-not-allowed",
              className
            )}
            disabled={disabled}
          >
            {displayTags.length > 0 ? (
              <div className="flex items-center gap-1 overflow-hidden">
                {displayTags.slice(0, maxDisplayTags).map((tag) => {
                  const state = getTagState(tag.id);
                  return (
                    <TagBadge key={tag.id} tag={tag} state={state} size="sm" />
                  );
                })}
                {displayTags.length > maxDisplayTags && (
                  <span className="text-xs text-muted-foreground">+{displayTags.length - maxDisplayTags}</span>
                )}
              </div>
            ) : (
              <span className="text-muted-foreground flex items-center gap-1">
                <Plus className="h-3 w-3" />
                {placeholder}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        {popoverContent}
      </Popover>
    );
  }

  // Default variant
  return (
    <div className={cn('space-y-2', className)}>
      {label && <Label className="text-sm font-medium">{label}</Label>}
      <Popover open={open && !disabled} onOpenChange={(isOpen) => !disabled && setOpen(isOpen)}>
        <PopoverTrigger asChild>
          <div
            className={cn(
              'flex flex-wrap gap-1.5 min-h-[40px] p-2 border rounded-md cursor-pointer transition-colors',
              disabled ? 'bg-muted/50 cursor-not-allowed' : 'bg-muted/30 hover:bg-muted/50'
            )}
          >
            {displayTags.length > 0 ? (
              displayTags.map((tag) => {
                const state = getTagState(tag.id);
                return (
                  <TagBadge key={tag.id} tag={tag} state={state} />
                );
              })
            ) : (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Plus className="h-3 w-3" />
                {placeholder}
              </span>
            )}
          </div>
        </PopoverTrigger>
        {popoverContent}
      </Popover>
    </div>
  );
}

// Shadcn-compatible color variants for tags
// Maps hex colors to Tailwind class combinations (color-300 bg, color-400 border)
const TAG_COLOR_VARIANTS: Record<string, { bg: string; text: string; border: string }> = {
  // Red variants
  '#ef4444': { bg: 'bg-red-300', text: 'text-red-900', border: 'border-red-400' },
  '#f43f5e': { bg: 'bg-rose-300', text: 'text-rose-900', border: 'border-rose-400' },
  // Orange variants
  '#f97316': { bg: 'bg-orange-300', text: 'text-orange-900', border: 'border-orange-400' },
  '#f59e0b': { bg: 'bg-amber-300', text: 'text-amber-900', border: 'border-amber-400' },
  // Green variants
  '#84cc16': { bg: 'bg-lime-300', text: 'text-lime-900', border: 'border-lime-400' },
  '#22c55e': { bg: 'bg-green-300', text: 'text-green-900', border: 'border-green-400' },
  // Teal/Cyan variants
  '#14b8a6': { bg: 'bg-teal-300', text: 'text-teal-900', border: 'border-teal-400' },
  '#06b6d4': { bg: 'bg-cyan-300', text: 'text-cyan-900', border: 'border-cyan-400' },
  // Blue variants
  '#3b82f6': { bg: 'bg-blue-300', text: 'text-blue-900', border: 'border-blue-400' },
  '#6366f1': { bg: 'bg-indigo-300', text: 'text-indigo-900', border: 'border-indigo-400' },
  // Purple variants
  '#8b5cf6': { bg: 'bg-violet-300', text: 'text-violet-900', border: 'border-violet-400' },
  '#a855f7': { bg: 'bg-purple-300', text: 'text-purple-900', border: 'border-purple-400' },
  // Pink variants
  '#d946ef': { bg: 'bg-fuchsia-300', text: 'text-fuchsia-900', border: 'border-fuchsia-400' },
  '#ec4899': { bg: 'bg-pink-300', text: 'text-pink-900', border: 'border-pink-400' },
};

// Default fallback colors
const DEFAULT_TAG_COLORS = { bg: 'bg-secondary', text: 'text-secondary-foreground', border: 'border-border' };

// Get color classes for a tag
function getTagColorClasses(color: string | null | undefined): { bg: string; text: string; border: string } {
  if (!color) return DEFAULT_TAG_COLORS;
  return TAG_COLOR_VARIANTS[color.toLowerCase()] || DEFAULT_TAG_COLORS;
}

// Tag badge component with state styling
function TagBadge({ tag, state, size = 'default' }: { tag: Tag; state: TagState; size?: 'default' | 'sm' }) {
  const colors = getTagColorClasses(tag.color);

  return (
    <Badge
      variant="outline"
      className={cn(
        'border',
        size === 'sm' ? 'text-[10px] h-5 px-1.5' : 'text-xs',
        colors.bg,
        colors.text,
        colors.border,
        state === 'new' && 'border-dashed border-2',
        state === 'removed' && 'line-through opacity-50 bg-muted text-muted-foreground border-muted'
      )}
    >
      {tag.name}
    </Badge>
  );
}

// Inline tag display (non-editable)
export function TagList({ tagIds, className }: { tagIds: string[]; className?: string }) {
  const { tags } = useSupabase();

  const displayTags = useMemo(() => {
    return tags.filter(t => tagIds.includes(t.id));
  }, [tags, tagIds]);

  if (displayTags.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {displayTags.map((tag) => (
        <TagBadge key={tag.id} tag={tag} state="unchanged" />
      ))}
    </div>
  );
}

// Export TagBadge for external use
export { TagBadge, getTagColorClasses };
