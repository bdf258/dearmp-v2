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
      <Popover open={open} onOpenChange={setOpen}>
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

// Tag badge component with state styling
function TagBadge({ tag, state }: { tag: Tag; state: TagState }) {
  // Parse color to create background and text colors
  const bgColor = tag.color ? `${tag.color}20` : undefined;
  const textColor = tag.color || undefined;
  const borderColor = tag.color || undefined;

  return (
    <Badge
      variant={state === 'new' ? 'outline' : 'default'}
      style={{
        backgroundColor: state === 'removed' ? undefined : bgColor,
        color: textColor,
        borderColor: borderColor,
      }}
      className={cn(
        'text-xs',
        state === 'new' && 'bg-transparent border-dashed',
        state === 'removed' && 'line-through opacity-50'
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
