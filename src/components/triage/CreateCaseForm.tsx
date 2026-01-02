/**
 * CreateCaseForm
 *
 * Inline form for creating a new case, used in accordion.
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Briefcase, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { useTriageActions } from '@/hooks/triage/useTriage';
import { PrioritySelector } from './PrioritySelector';
import { CaseworkerSelector } from './CaseworkerSelector';
import type { CasePriority, CaseStatus, CaseType } from '@/lib/database.types';

// Case type options with display labels
const CASE_TYPE_OPTIONS: { value: CaseType; label: string }[] = [
  { value: 'type_1', label: 'Type 1' },
  { value: 'type_2', label: 'Type 2' },
  { value: 'type_3', label: 'Type 3' },
  { value: 'type_4', label: 'Type 4' },
  { value: 'type_5', label: 'Type 5' },
  { value: 'type_6', label: 'Type 6' },
  { value: 'type_7', label: 'Type 7' },
  { value: 'type_8', label: 'Type 8' },
];

// Case status options with display labels
const CASE_STATUS_OPTIONS: { value: CaseStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'pending', label: 'Pending' },
  { value: 'closed', label: 'Closed' },
  { value: 'archived', label: 'Archived' },
];

interface CreateCaseFormProps {
  onCreated?: (caseId: string) => void;
  onCancel?: () => void;
  defaultTitle?: string;
  defaultDescription?: string;
  messageId?: string;
}

export function CreateCaseForm({
  onCreated,
  onCancel,
  defaultTitle = '',
  defaultDescription = '',
  messageId,
}: CreateCaseFormProps) {
  const { createCaseForMessage, isProcessing } = useTriageActions();

  const [formData, setFormData] = useState({
    title: defaultTitle,
    description: defaultDescription,
    priority: 'medium' as CasePriority,
    assigned_to: null as string | null,
    status: 'open' as CaseStatus,
    case_type: null as CaseType | null,
    review_date: '' as string,
  });

  // Update form when defaults change
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      title: defaultTitle,
      description: defaultDescription,
    }));
  }, [defaultTitle, defaultDescription]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast.error('Title is required');
      return;
    }

    const result = await createCaseForMessage(messageId || '', {
      title: formData.title.trim(),
      description: formData.description.trim() || undefined,
      priority: formData.priority,
      assigned_to: formData.assigned_to || undefined,
      status: formData.status,
      case_type: formData.case_type || undefined,
      review_date: formData.review_date || undefined,
    });

    if (result.success && result.caseId) {
      toast.success(`Case "${formData.title}" created`);
      onCreated?.(result.caseId);
    } else {
      toast.error(result.error || 'Failed to create case');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="inline_title" className="text-xs">Title *</Label>
        <div className="relative">
          <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="inline_title"
            placeholder="Enter case title"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            className="pl-10 h-9"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="inline_description" className="text-xs">Description</Label>
        <Textarea
          id="inline_description"
          placeholder="Optional case description..."
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          rows={2}
          className="resize-none"
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

      {/* Case Type */}
      <div className="space-y-1.5">
        <Label className="text-xs">Type</Label>
        <Select
          value={formData.case_type || ''}
          onValueChange={(value) => setFormData(prev => ({
            ...prev,
            case_type: value as CaseType
          }))}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Select case type" />
          </SelectTrigger>
          <SelectContent>
            {CASE_TYPE_OPTIONS.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Status */}
      <div className="space-y-1.5">
        <Label className="text-xs">Status</Label>
        <Select
          value={formData.status}
          onValueChange={(value) => setFormData(prev => ({
            ...prev,
            status: value as CaseStatus
          }))}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            {CASE_STATUS_OPTIONS.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Review Date */}
      <div className="space-y-1.5">
        <Label htmlFor="inline_review_date" className="text-xs">Review Date</Label>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="inline_review_date"
            type="date"
            value={formData.review_date}
            onChange={(e) => setFormData(prev => ({ ...prev, review_date: e.target.value }))}
            className="pl-10 h-9"
          />
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isProcessing}
            className="flex-1"
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          size="sm"
          disabled={isProcessing || !formData.title.trim()}
          className="flex-1"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            'Create Case'
          )}
        </Button>
      </div>
    </form>
  );
}
