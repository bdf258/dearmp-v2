/**
 * StatusPills
 *
 * Pill badges showing triage status for constituents, cases, and caseworkers.
 * Three visual states:
 * - approved: White bg, solid border (human confirmed)
 * - determined: Gray bg, solid border (AI matched, not yet confirmed)
 * - uncertain: Dark gray bg, dashed border (needs action)
 */

import { Badge } from '@/components/ui/badge';
import {
  User,
  FileText,
  CircleUser,
  MapPin,
  MapPinOff,
  HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============= TYPES =============

export type TriageApprovalStatus = 'approved' | 'determined' | 'uncertain';

export interface ConstituentPillData {
  status: 'approved' | 'determined' | 'uncertain_with_address' | 'uncertain_no_address';
  name?: string;
  id?: string;
}

export interface CasePillData {
  status: TriageApprovalStatus;
  caseNumber?: string;
  caseId?: string;
}

export interface CaseworkerPillData {
  status: TriageApprovalStatus;
  name?: string;
  id?: string;
}

// ============= STYLES =============

const pillStyles = {
  approved: 'bg-white border-gray-300 text-gray-700',
  determined: 'bg-gray-300 border-gray-400 text-gray-700',
  uncertain: 'bg-gray-500 border-dashed border-gray-600 text-white',
} as const;

// ============= CONSTITUENT PILL =============

interface ConstituentPillProps {
  constituent: ConstituentPillData;
  onClick?: () => void;
  className?: string;
}

/**
 * ConstituentPill
 *
 * Shows constituent match status:
 * - approved: Known constituent, human verified
 * - determined: AI matched to existing constituent
 * - uncertain_with_address: Unknown but address found in email
 * - uncertain_no_address: Unknown with no address
 */
export function ConstituentPill({ constituent, onClick, className }: ConstituentPillProps) {
  const isClickable = !!onClick;
  const baseClasses = cn(
    'gap-1 shrink-0',
    isClickable && 'cursor-pointer hover:opacity-80 transition-opacity',
    className
  );

  switch (constituent.status) {
    case 'approved':
      return (
        <Badge
          variant="outline"
          className={cn(baseClasses, pillStyles.approved)}
          onClick={onClick}
        >
          <User className="h-3 w-3" />
          {constituent.name}
        </Badge>
      );
    case 'determined':
      return (
        <Badge
          variant="outline"
          className={cn(baseClasses, pillStyles.determined)}
          onClick={onClick}
        >
          <HelpCircle className="h-3 w-3" />
          {constituent.name}
        </Badge>
      );
    case 'uncertain_with_address':
      return (
        <Badge
          variant="outline"
          className={cn(baseClasses, pillStyles.uncertain)}
          onClick={onClick}
        >
          <MapPin className="h-3 w-3" />
          Create constituent
        </Badge>
      );
    case 'uncertain_no_address':
      return (
        <Badge
          variant="outline"
          className={cn(baseClasses, pillStyles.uncertain)}
          onClick={onClick}
        >
          <MapPinOff className="h-3 w-3" />
          Request address
        </Badge>
      );
  }
}

// ============= CASE PILL =============

interface CasePillProps {
  caseInfo: CasePillData;
  onClick?: () => void;
  className?: string;
}

/**
 * CasePill
 *
 * Shows case assignment status:
 * - approved: Case assigned, human verified
 * - determined: AI suggested case match
 * - uncertain: No matching case (show "New case" or suggested case number)
 */
export function CasePill({ caseInfo, onClick, className }: CasePillProps) {
  const isClickable = !!onClick;
  const baseClasses = cn(
    'gap-1 shrink-0',
    isClickable && 'cursor-pointer hover:opacity-80 transition-opacity',
    className
  );

  switch (caseInfo.status) {
    case 'approved':
      return (
        <Badge
          variant="outline"
          className={cn(baseClasses, pillStyles.approved)}
          onClick={onClick}
        >
          <FileText className="h-3 w-3" />
          {caseInfo.caseNumber}
        </Badge>
      );
    case 'determined':
      return (
        <Badge
          variant="outline"
          className={cn(baseClasses, pillStyles.determined)}
          onClick={onClick}
        >
          <FileText className="h-3 w-3" />
          {caseInfo.caseNumber}
        </Badge>
      );
    case 'uncertain':
      return (
        <Badge
          variant="outline"
          className={cn(baseClasses, pillStyles.uncertain)}
          onClick={onClick}
        >
          <HelpCircle className="h-3 w-3" />
          {caseInfo.caseNumber || 'New case'}
        </Badge>
      );
  }
}

// ============= CASEWORKER PILL =============

interface CaseworkerStatusPillProps {
  caseworker: CaseworkerPillData;
  onClick?: () => void;
  className?: string;
}

/**
 * CaseworkerStatusPill
 *
 * Shows caseworker assignment status:
 * - approved: Caseworker assigned, human verified
 * - determined: AI suggested caseworker
 * - uncertain: No caseworker assigned
 */
export function CaseworkerStatusPill({ caseworker, onClick, className }: CaseworkerStatusPillProps) {
  const isClickable = !!onClick;
  const baseClasses = cn(
    'gap-1 shrink-0',
    isClickable && 'cursor-pointer hover:opacity-80 transition-opacity',
    className
  );

  switch (caseworker.status) {
    case 'approved':
      return (
        <Badge
          variant="outline"
          className={cn(baseClasses, pillStyles.approved)}
          onClick={onClick}
        >
          <CircleUser className="h-3 w-3" />
          {caseworker.name}
        </Badge>
      );
    case 'determined':
      return (
        <Badge
          variant="outline"
          className={cn(baseClasses, pillStyles.determined)}
          onClick={onClick}
        >
          <CircleUser className="h-3 w-3" />
          {caseworker.name}
        </Badge>
      );
    case 'uncertain':
      return (
        <Badge
          variant="outline"
          className={cn(baseClasses, pillStyles.uncertain)}
          onClick={onClick}
        >
          <HelpCircle className="h-3 w-3" />
          Assign case
        </Badge>
      );
  }
}

// ============= PILL STATUS ROW =============

interface PillStatusRowProps {
  constituent?: ConstituentPillData;
  caseInfo?: CasePillData;
  caseworker?: CaseworkerPillData;
  onConstituentClick?: () => void;
  onCaseClick?: () => void;
  onCaseworkerClick?: () => void;
  className?: string;
}

/**
 * PillStatusRow
 *
 * Convenience component for rendering all three pills in a row.
 * Useful for email list items and triage cards.
 */
export function PillStatusRow({
  constituent,
  caseInfo,
  caseworker,
  onConstituentClick,
  onCaseClick,
  onCaseworkerClick,
  className,
}: PillStatusRowProps) {
  return (
    <div className={cn('flex items-center gap-1.5 flex-wrap', className)}>
      {constituent && (
        <ConstituentPill constituent={constituent} onClick={onConstituentClick} />
      )}
      {caseInfo && (
        <CasePill caseInfo={caseInfo} onClick={onCaseClick} />
      )}
      {caseworker && (
        <CaseworkerStatusPill caseworker={caseworker} onClick={onCaseworkerClick} />
      )}
    </div>
  );
}
