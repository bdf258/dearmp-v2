/**
 * Triage Component Kit
 *
 * Reusable components for the triage workflow:
 * - Campaign dashboard (bulk triage)
 * - Single-email triage workspace
 */

// Base components
export { SearchableDropdown, type DropdownItem } from './SearchableDropdown';

// Selectors
export { ConstituentSelector, ConstituentCard } from './ConstituentSelector';
export { CaseSelector, CaseCard, CaseRefBadge } from './CaseSelector';
export { CaseworkerSelector, CaseworkerAvatar, CaseworkerPill } from './CaseworkerSelector';
export { PrioritySelector, PriorityBadge } from './PrioritySelector';
export { TagPicker, TagList } from './TagPicker';

// Dialogs
export { CreateConstituentDialog } from './CreateConstituentDialog';
export { CreateCaseDialog } from './CreateCaseDialog';

// Message display
export { MessageCard, CompactMessageCard, MessageDetailHeader } from './MessageCard';

// Skeletons
export { TriageSkeletons } from './Skeletons';
