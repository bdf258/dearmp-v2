/**
 * CaseEmailCard
 *
 * Card component for displaying an email in the triage queue.
 * Shows subject, preview, sender info, and triage status pills.
 * Supports selection for bulk actions.
 */

import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import {
  ConstituentPill,
  CasePill,
  CaseworkerStatusPill,
  type ConstituentPillData,
  type CasePillData,
  type CaseworkerPillData,
} from './StatusPills';

// ============= TYPES =============

export interface CaseEmailData {
  id: string;
  subject: string;
  preview: string;
  fromEmail: string;
  fromName?: string;
  receivedAt: string;
  isSelected?: boolean;
  constituent: ConstituentPillData;
  case: CasePillData;
  caseworker: CaseworkerPillData;
}

interface CaseEmailCardProps {
  email: CaseEmailData;
  isSelected?: boolean;
  onSelectionChange?: (id: string, checked: boolean) => void;
  onClick?: () => void;
  onConstituentClick?: () => void;
  onCaseClick?: () => void;
  onCaseworkerClick?: () => void;
  className?: string;
}

// ============= COMPONENT =============

/**
 * CaseEmailCard
 *
 * Displays an email with subject, preview, and triage status pills.
 * Supports checkbox selection for bulk operations.
 */
export function CaseEmailCard({
  email,
  isSelected,
  onSelectionChange,
  onClick,
  onConstituentClick,
  onCaseClick,
  onCaseworkerClick,
  className,
}: CaseEmailCardProps) {
  const handleCheckboxChange = (checked: boolean) => {
    onSelectionChange?.(email.id, checked);
  };

  return (
    <Card
      className={cn(
        'hover:shadow-md transition-all border bg-white',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-3">
        {/* Top row: checkbox, subject, preview */}
        <div className="flex items-start gap-3 mb-2">
          {onSelectionChange && (
            <Checkbox
              checked={isSelected ?? email.isSelected}
              onCheckedChange={handleCheckboxChange}
              onClick={(e) => e.stopPropagation()}
              className="mt-0.5 shrink-0"
              aria-label={`Select email: ${email.subject}`}
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium truncate">{email.subject}</h3>
              <span className="text-xs text-muted-foreground shrink-0">
                {email.preview.slice(0, 40)}...
              </span>
            </div>
          </div>
        </div>

        {/* Bottom row: email, pills */}
        <div className="flex items-center gap-2 ml-7">
          <span className="text-xs text-muted-foreground truncate max-w-[180px]">
            {email.fromEmail}
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <ConstituentPill
              constituent={email.constituent}
              onClick={onConstituentClick}
            />
            <CasePill
              caseInfo={email.case}
              onClick={onCaseClick}
            />
            <CaseworkerStatusPill
              caseworker={email.caseworker}
              onClick={onCaseworkerClick}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============= CASE EMAIL LIST =============

interface CaseEmailListProps {
  emails: CaseEmailData[];
  selectedIds?: Set<string>;
  onSelectionChange?: (id: string, checked: boolean) => void;
  onEmailClick?: (emailId: string) => void;
  onConstituentClick?: (emailId: string) => void;
  onCaseClick?: (emailId: string) => void;
  onCaseworkerClick?: (emailId: string) => void;
  emptyMessage?: string;
  className?: string;
}

/**
 * CaseEmailList
 *
 * Renders a list of CaseEmailCards with empty state handling.
 */
export function CaseEmailList({
  emails,
  selectedIds,
  onSelectionChange,
  onEmailClick,
  onConstituentClick,
  onCaseClick,
  onCaseworkerClick,
  emptyMessage = 'No emails to display',
  className,
}: CaseEmailListProps) {
  if (emails.length === 0) {
    return (
      <div className={cn('text-center py-8 text-muted-foreground', className)}>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {emails.map((email) => (
        <CaseEmailCard
          key={email.id}
          email={email}
          isSelected={selectedIds?.has(email.id)}
          onSelectionChange={onSelectionChange}
          onClick={onEmailClick ? () => onEmailClick(email.id) : undefined}
          onConstituentClick={onConstituentClick ? () => onConstituentClick(email.id) : undefined}
          onCaseClick={onCaseClick ? () => onCaseClick(email.id) : undefined}
          onCaseworkerClick={onCaseworkerClick ? () => onCaseworkerClick(email.id) : undefined}
        />
      ))}
    </div>
  );
}

// ============= COMPACT EMAIL ROW =============

interface CompactEmailRowProps {
  email: {
    id: string;
    fromEmail: string;
    fromName?: string;
    subject?: string;
    status?: 'pending' | 'confirmed' | 'rejected';
  };
  isActive?: boolean;
  onConfirm?: () => void;
  onReject?: () => void;
  onClick?: () => void;
  className?: string;
}

/**
 * CompactEmailRow
 *
 * Minimal email row for sidebar lists in campaign review mode.
 * Shows sender info and confirm/reject actions.
 */
export function CompactEmailRow({
  email,
  isActive,
  onConfirm,
  onReject,
  onClick,
  className,
}: CompactEmailRowProps) {
  const isPending = email.status === 'pending';
  const isConfirmed = email.status === 'confirmed';
  const isRejected = email.status === 'rejected';

  return (
    <div
      className={cn(
        'px-3 py-2 cursor-pointer transition-colors flex items-center gap-2',
        isConfirmed && 'bg-green-100',
        isRejected && 'bg-red-50 opacity-50',
        isActive && !isConfirmed && !isRejected && 'bg-blue-100',
        !isActive && !isConfirmed && !isRejected && 'hover:bg-muted',
        className
      )}
      onClick={onClick}
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{email.fromEmail}</div>
        {email.fromName && (
          <div className="text-xs text-muted-foreground truncate">{email.fromName}</div>
        )}
      </div>

      {isPending && (onConfirm || onReject) && (
        <div className="flex items-center gap-1 shrink-0">
          {onConfirm && (
            <button
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-green-100 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onConfirm();
              }}
              aria-label="Confirm email"
            >
              <svg
                className="h-3.5 w-3.5 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </button>
          )}
          {onReject && (
            <button
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-red-100 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onReject();
              }}
              aria-label="Reject email"
            >
              <svg
                className="h-3.5 w-3.5 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}

      {isConfirmed && (
        <svg
          className="h-4 w-4 text-green-600 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}

      {isRejected && (
        <svg
          className="h-4 w-4 text-red-500 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
    </div>
  );
}
