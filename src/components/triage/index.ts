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

// Status pills (triage state indicators)
export {
  ConstituentPill,
  CasePill,
  CaseworkerStatusPill,
  PillStatusRow,
  type ConstituentPillData,
  type CasePillData,
  type CaseworkerPillData,
  type TriageApprovalStatus,
} from './StatusPills';

// Campaign components
export {
  CampaignCard,
  CampaignList,
  CampaignStatsSummary,
  type CampaignCardData,
} from './CampaignCard';

// Case email components (for triage queue)
export {
  CaseEmailCard,
  CaseEmailList,
  CompactEmailRow,
  type CaseEmailData,
} from './CaseEmailCard';

// Dialogs
export { CreateConstituentDialog } from './CreateConstituentDialog';
export { CreateCaseDialog } from './CreateCaseDialog';
export { RequestAddressDialog } from './RequestAddressDialog';
export { AssignCampaignDialog } from './AssignCampaignDialog';

// Message display
export { MessageCard, CompactMessageCard, MessageDetailHeader } from './MessageCard';

// Skeletons
export { TriageSkeletons } from './Skeletons';
