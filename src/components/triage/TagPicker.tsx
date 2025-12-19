/**
 * TagPicker
 *
 * Tag picker with keyboard search, create new, and remove functionality.
 * Supports showing tag change states (new, removed, unchanged).
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
  label?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  showCreateNew?: boolean;
}

export function TagPicker({
  selectedTagIds,
  onChange,
  originalTagIds = [],
  label = 'Tags',
  placeholder = 'Add tags',
  className,
  disabled,
  showCreateNew = true,
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
        <PopoverContent className="w-[260px] p-0" align="start">
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
                  return (
                    <CommandItem
                      key={tag.id}
                      value={tag.id}
                      onSelect={() => handleToggleTag(tag.id)}
                      className="cursor-pointer"
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <TagBadge tag={tag} state="unchanged" />
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
      </Popover>
    </div>
  );
}

// Shadcn-compatible color variants for tags
// Maps hex colors to Tailwind class combinations
const TAG_COLOR_VARIANTS: Record<string, { bg: string; text: string; border: string }> = {
  // Red variants
  '#ef4444': { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
  '#f43f5e': { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-300' },
  // Orange variants
  '#f97316': { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
  '#f59e0b': { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' },
  // Green variants
  '#84cc16': { bg: 'bg-lime-100', text: 'text-lime-700', border: 'border-lime-300' },
  '#22c55e': { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' },
  // Teal/Cyan variants
  '#14b8a6': { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-300' },
  '#06b6d4': { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-300' },
  // Blue variants
  '#3b82f6': { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  '#6366f1': { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-300' },
  // Purple variants
  '#8b5cf6': { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-300' },
  '#a855f7': { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
  // Pink variants
  '#d946ef': { bg: 'bg-fuchsia-100', text: 'text-fuchsia-700', border: 'border-fuchsia-300' },
  '#ec4899': { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-300' },
};

// Default fallback colors
const DEFAULT_TAG_COLORS = { bg: 'bg-secondary', text: 'text-secondary-foreground', border: 'border-border' };

// Get color classes for a tag
function getTagColorClasses(color: string | null | undefined): { bg: string; text: string; border: string } {
  if (!color) return DEFAULT_TAG_COLORS;
  return TAG_COLOR_VARIANTS[color.toLowerCase()] || DEFAULT_TAG_COLORS;
}

// Tag badge component with state styling
function TagBadge({ tag, state }: { tag: Tag; state: TagState }) {
  const colors = getTagColorClasses(tag.color);

  return (
    <Badge
      variant="outline"
      className={cn(
        'text-xs border',
        colors.bg,
        colors.text,
        colors.border,
        state === 'new' && 'border-dashed',
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
