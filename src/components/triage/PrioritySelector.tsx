/**
 * PrioritySelector
 *
 * Enum-aware priority selector with optimistic updates.
 * Uses the case_priority enum from the database.
 */

import { useState, useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { CasePriority } from '@/lib/database.types';
import { Loader2 } from 'lucide-react';

interface PrioritySelectorProps {
  value: CasePriority | null;
  onChange: (value: CasePriority) => void | Promise<void>;
  disabled?: boolean;
  label?: string;
  className?: string;
  size?: 'sm' | 'default';
}

const priorities: { key: CasePriority; label: string; shortLabel: string; color: string }[] = [
  { key: 'low', label: 'Low', shortLabel: 'L', color: 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200' },
  { key: 'medium', label: 'Medium', shortLabel: 'M', color: 'bg-yellow-100 text-yellow-700 border-yellow-300 hover:bg-yellow-200' },
  { key: 'high', label: 'High', shortLabel: 'H', color: 'bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-200' },
  { key: 'urgent', label: 'Urgent', shortLabel: 'U', color: 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200' },
];

export function PrioritySelector({
  value,
  onChange,
  disabled,
  label = 'Priority',
  className,
  size = 'default',
}: PrioritySelectorProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [optimisticValue, setOptimisticValue] = useState<CasePriority | null>(null);

  const handleChange = useCallback(async (newValue: CasePriority) => {
    if (disabled || isUpdating) return;

    // Optimistic update
    setOptimisticValue(newValue);
    setIsUpdating(true);

    try {
      await onChange(newValue);
    } catch (error) {
      // Rollback on error
      setOptimisticValue(null);
      console.error('Failed to update priority:', error);
    } finally {
      setIsUpdating(false);
      setOptimisticValue(null);
    }
  }, [onChange, disabled, isUpdating]);

  const displayValue = optimisticValue ?? value;

  return (
    <div className={cn('space-y-2', className)}>
      {label && <Label className="text-sm font-medium">{label}</Label>}
      <div className={cn(
        'flex border rounded-md overflow-hidden relative',
        disabled && 'opacity-50 cursor-not-allowed'
      )}>
        {isUpdating && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        )}
        {priorities.map((p) => (
          <button
            key={p.key}
            type="button"
            disabled={disabled || isUpdating}
            onClick={() => handleChange(p.key)}
            className={cn(
              'flex-1 font-medium transition-colors border-r last:border-r-0',
              size === 'sm' ? 'py-1.5 px-2 text-xs' : 'py-2 px-3 text-sm',
              displayValue === p.key
                ? p.color
                : 'bg-background hover:bg-muted text-muted-foreground',
              disabled && 'cursor-not-allowed'
            )}
          >
            {size === 'sm' ? p.shortLabel : p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// Compact version for inline use
export function PriorityBadge({ priority }: { priority: CasePriority | null }) {
  if (!priority) return null;

  const p = priorities.find(pr => pr.key === priority);
  if (!p) return null;

  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border',
      p.color
    )}>
      {p.label}
    </span>
  );
}
