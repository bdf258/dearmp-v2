/**
 * TriageFieldRow
 *
 * Reusable row component for triage workspace fields.
 * Wraps content in a tooltip with consistent styling and delay.
 */

import { type ReactNode, type ElementType } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface TriageFieldRowProps {
  /** Tooltip text displayed on hover */
  tooltip: string;
  /** Lucide icon component to display on the left */
  icon: ElementType;
  /** Field content (inputs, selects, etc.) */
  children: ReactNode;
  /** Additional class names for the row container */
  className?: string;
  /** Additional class names for the icon */
  iconClassName?: string;
  /** Whether to show the icon (default: true) */
  showIcon?: boolean;
}

export function TriageFieldRow({
  tooltip,
  icon: Icon,
  children,
  className,
  iconClassName,
  showIcon = true,
}: TriageFieldRowProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-2 py-1.5 rounded-md border border-transparent transition-colors hover:border-border',
        className
      )}
    >
      {showIcon && (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Icon className={cn("h-4 w-4 text-muted-foreground shrink-0 cursor-help", iconClassName)} />
            </TooltipTrigger>
            <TooltipContent>
              <p>{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      {children}
    </div>
  );
}

/**
 * Variant for rows with start-aligned content (like description textarea)
 */
interface TriageFieldColumnProps {
  /** Tooltip text displayed on hover */
  tooltip: string;
  /** Lucide icon component to display on the left */
  icon: ElementType;
  /** Field content (inputs, selects, etc.) */
  children: ReactNode;
  /** Optional footer content (e.g., character counter) */
  footer?: ReactNode;
  /** Additional class names for the row container */
  className?: string;
}

export function TriageFieldColumn({
  tooltip,
  icon: Icon,
  children,
  footer,
  className,
}: TriageFieldColumnProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1 px-2 py-1.5 rounded-md border border-transparent transition-colors hover:border-border',
        className
      )}
    >
      <div className="flex items-start gap-2">
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Icon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5 cursor-help" />
            </TooltipTrigger>
            <TooltipContent>
              <p>{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {children}
      </div>
      {footer}
    </div>
  );
}
