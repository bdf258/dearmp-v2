/**
 * CreateCaseDialog
 *
 * Modal dialog for creating a new case with title, description,
 * priority, and optional assignee.
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Briefcase } from 'lucide-react';
import { toast } from 'sonner';
import { useTriageActions } from '@/hooks/triage/useTriage';
import { PrioritySelector } from './PrioritySelector';
import { CaseworkerSelector } from './CaseworkerSelector';
import type { CasePriority } from '@/lib/database.types';

interface CreateCaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (caseId: string) => void;
  defaultTitle?: string;
  defaultDescription?: string;
  messageId?: string; // If provided, links the message to the new case
}

export function CreateCaseDialog({
  open,
  onOpenChange,
  onCreated,
  defaultTitle = '',
  defaultDescription = '',
  messageId,
}: CreateCaseDialogProps) {
  const { createCaseForMessage, isProcessing } = useTriageActions();

  const [formData, setFormData] = useState({
    title: defaultTitle,
    description: defaultDescription,
    priority: 'medium' as CasePriority,
    assigned_to: null as string | null,
  });

  // Reset form when dialog opens with defaults
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setFormData({
        title: defaultTitle,
        description: defaultDescription,
        priority: 'medium',
        assigned_to: null,
      });
    }
    onOpenChange(isOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast.error('Title is required');
      return;
    }

    // Create case (and optionally link to message)
    const result = await createCaseForMessage(messageId || '', {
      title: formData.title.trim(),
      description: formData.description.trim() || undefined,
      priority: formData.priority,
      assigned_to: formData.assigned_to || undefined,
    });

    if (result.success && result.caseId) {
      toast.success(`Case "${formData.title}" created`);
      onCreated?.(result.caseId);
      onOpenChange(false);
    } else {
      toast.error(result.error || 'Failed to create case');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Create New Case
          </DialogTitle>
          <DialogDescription>
            Create a new case to track this matter.
            {messageId && ' The current message will be linked to this case.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="Enter case title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Optional case description..."
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
            />
          </div>

          <PrioritySelector
            value={formData.priority}
            onChange={(priority) => setFormData(prev => ({ ...prev, priority }))}
          />

          <CaseworkerSelector
            selectedId={formData.assigned_to}
            onSelect={(id) => setFormData(prev => ({ ...prev, assigned_to: id }))}
            showUnassignedOption
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isProcessing || !formData.title.trim()}>
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Case'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
