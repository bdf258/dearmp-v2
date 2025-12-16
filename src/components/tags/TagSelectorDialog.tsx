import { useState, useEffect } from 'react';
import { useSupabase } from '@/lib/SupabaseContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Tag, Plus, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface TagSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: string;
  entityId: string;
  title?: string;
  description?: string;
}

export function TagSelectorDialog({
  open,
  onOpenChange,
  entityType,
  entityId,
  title = 'Manage Tags',
  description = 'Select tags to apply to this item',
}: TagSelectorDialogProps) {
  const { tags, getTagsForEntity, addTagToEntity, removeTagFromEntity, createTag } = useSupabase();
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [showNewTagInput, setShowNewTagInput] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [isCreatingTag, setIsCreatingTag] = useState(false);

  // Load current tag assignments when dialog opens
  useEffect(() => {
    if (open) {
      const assignments = getTagsForEntity(entityType, entityId);
      setSelectedTagIds(new Set(assignments.map(a => a.tag_id)));
    }
  }, [open, entityType, entityId, getTagsForEntity]);

  const handleTagToggle = async (tagId: string, checked: boolean) => {
    setIsLoading(true);
    try {
      if (checked) {
        const result = await addTagToEntity(tagId, entityType, entityId);
        if (result) {
          setSelectedTagIds(prev => new Set([...prev, tagId]));
        } else {
          toast.error('Failed to add tag');
        }
      } else {
        const result = await removeTagFromEntity(tagId, entityType, entityId);
        if (result) {
          setSelectedTagIds(prev => {
            const next = new Set(prev);
            next.delete(tagId);
            return next;
          });
        } else {
          toast.error('Failed to remove tag');
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;

    setIsCreatingTag(true);
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
        setNewTagName('');
        setShowNewTagInput(false);
        // Automatically select the new tag
        await handleTagToggle(newTag.id, true);
      } else {
        toast.error('Failed to create tag');
      }
    } finally {
      setIsCreatingTag(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {tags.length === 0 ? (
            <div className="text-center py-8">
              <Tag className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                No tags available. Create your first tag to get started.
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-2 pr-4">
                {tags.map((tag) => {
                  const isSelected = selectedTagIds.has(tag.id);
                  return (
                    <button
                      key={tag.id}
                      onClick={() => handleTagToggle(tag.id, !isSelected)}
                      disabled={isLoading}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors w-full text-left disabled:opacity-50"
                    >
                      <div
                        className={`h-5 w-5 rounded border flex items-center justify-center transition-colors ${
                          isSelected
                            ? 'bg-primary border-primary text-primary-foreground'
                            : 'border-input bg-background'
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>
                      <Badge
                        variant="outline"
                        style={{
                          borderColor: tag.color,
                          backgroundColor: `${tag.color}20`,
                          color: tag.color,
                        }}
                      >
                        {tag.name}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          )}

          {/* Create new tag section */}
          {showNewTagInput ? (
            <div className="flex gap-2">
              <Input
                placeholder="Tag name..."
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreateTag();
                  }
                  if (e.key === 'Escape') {
                    setShowNewTagInput(false);
                    setNewTagName('');
                  }
                }}
                autoFocus
                disabled={isCreatingTag}
              />
              <Button
                size="sm"
                onClick={handleCreateTag}
                disabled={!newTagName.trim() || isCreatingTag}
              >
                {isCreatingTag ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Add'
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowNewTagInput(false);
                  setNewTagName('');
                }}
                disabled={isCreatingTag}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setShowNewTagInput(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Create New Tag
            </Button>
          )}
        </div>

        <div className="flex justify-end">
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
