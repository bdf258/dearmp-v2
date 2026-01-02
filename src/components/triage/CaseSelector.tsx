/**
 * CaseSelector
 *
 * Searchable dropdown for selecting a case with create-new option.
 * Shows case title, reference number, status and priority badges.
 */

import { useMemo } from 'react';
import { useSupabase } from '@/lib/SupabaseContext';
import { SearchableDropdown, type DropdownItem } from './SearchableDropdown';
import { PriorityBadge } from './PrioritySelector';
import { Badge } from '@/components/ui/badge';
import { Briefcase, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';
// Types used from '@/lib/database.types'

interface CaseSelectorProps {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCreateNew?: () => void;
  constituentId?: string | null; // To prioritize cases for this constituent
  disabled?: boolean;
  label?: string;
  className?: string;
  /** Remove border from the button for seamless integration */
  borderless?: boolean;
  /** Hide secondary text in the button display */
  hideSecondary?: boolean;
  /** Custom placeholder text to override default */
  placeholder?: string;
  /** Custom class for the label element */
  labelClassName?: string;
}

const statusColors: Record<string, string> = {
  open: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  closed: 'bg-gray-100 text-gray-700',
  archived: 'bg-gray-100 text-gray-500',
};

export function CaseSelector({
  selectedId,
  onSelect,
  onCreateNew,
  constituentId,
  disabled,
  label = 'Case',
  className,
  borderless,
  hideSecondary,
  placeholder = 'Select or create case',
  labelClassName,
}: CaseSelectorProps) {
  const { cases, caseParties } = useSupabase();

  // Build dropdown items with case badges - filtered to constituent's cases only
  const items: DropdownItem[] = useMemo(() => {
    // Get case IDs for this constituent
    const constituentCaseIds = constituentId
      ? caseParties
          .filter(cp => cp.constituent_id === constituentId)
          .map(cp => cp.case_id)
      : [];

    // Filter to only show constituent's cases (or all cases if no constituent selected)
    const filteredCases = constituentId
      ? cases.filter(c => constituentCaseIds.includes(c.id))
      : cases;

    // Sort by date (most recent first)
    const sortedCases = [...filteredCases].sort((a, b) => {
      return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
    });

    return sortedCases.map((c) => {
      // Build secondary text with reference number and truncated description
      const parts: string[] = [];
      if (c.reference_number) parts.push(`#${c.reference_number}`);
      if (c.description) {
        // Truncate description to ~60 chars
        const truncated = c.description.length > 60
          ? c.description.slice(0, 60).trim() + '…'
          : c.description;
        parts.push(truncated);
      }

      return {
        id: c.id,
        name: c.title,
        secondary: parts.join(' • ') || undefined,
        badge: (
          <div className="flex gap-1">
            {c.status && (
              <Badge variant="outline" className={cn('text-xs py-0', statusColors[c.status])}>
                {c.status}
              </Badge>
            )}
          </div>
        ),
      };
    });
  }, [cases, caseParties, constituentId]);

  return (
    <SearchableDropdown
      label={label}
      icon={<Briefcase className="h-4 w-4 text-muted-foreground" />}
      placeholder={placeholder}
      items={items}
      selectedId={selectedId}
      onSelect={onSelect}
      onCreateNew={onCreateNew}
      createNewLabel="Create new case"
      disabled={disabled}
      searchPlaceholder="Search cases..."
      emptyMessage="No cases found"
      className={className}
      borderless={borderless}
      hideSecondary={hideSecondary}
      labelClassName={labelClassName}
    />
  );
}

// Compact case display
export function CaseCard({
  caseId,
  className,
}: {
  caseId: string | null;
  className?: string;
}) {
  const { cases } = useSupabase();

  const caseData = useMemo(() => {
    if (!caseId) return null;
    return cases.find(c => c.id === caseId) || null;
  }, [caseId, cases]);

  if (!caseData) return null;

  return (
    <div className={cn('p-3 bg-muted/30 rounded-lg', className)}>
      <div className="font-medium flex items-center gap-2">
        <Briefcase className="h-4 w-4 text-muted-foreground" />
        {caseData.title}
      </div>
      <div className="flex items-center gap-2 mt-1">
        {caseData.reference_number && (
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <Hash className="h-3 w-3" />
            {caseData.reference_number}
          </span>
        )}
        {caseData.status && (
          <Badge variant="outline" className={cn('text-xs py-0', statusColors[caseData.status])}>
            {caseData.status}
          </Badge>
        )}
        {caseData.priority && <PriorityBadge priority={caseData.priority} />}
      </div>
    </div>
  );
}

// Reference number badge for inline use
export function CaseRefBadge({ caseId }: { caseId: string | null }) {
  const { cases } = useSupabase();

  const caseData = caseId ? cases.find(c => c.id === caseId) : null;
  if (!caseData?.reference_number) return null;

  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
      <Hash className="h-3 w-3" />
      {caseData.reference_number}
    </span>
  );
}
