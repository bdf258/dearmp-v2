import { ConstituentMatchDto } from './ConstituentDto';
import { CaseDto, CaseSuggestionDto } from './CaseDto';

/**
 * DTO: EmailDto
 *
 * Data Transfer Object for email data between layers.
 */
export interface EmailDto {
  id: string;
  officeId: string;
  externalId: number;
  caseId?: string;
  caseExternalId?: number;
  constituentId?: string;
  constituentExternalId?: number;
  type?: 'draft' | 'sent' | 'received' | 'scheduled';
  subject?: string;
  htmlBody?: string;
  plainTextBody?: string;
  fromAddress?: string;
  toAddresses?: string[];
  ccAddresses?: string[];
  bccAddresses?: string[];
  actioned: boolean;
  assignedToId?: string;
  assignedToName?: string;
  scheduledAt?: string;
  sentAt?: string;
  receivedAt?: string;
  lastSyncedAt?: string;
  createdAt?: string;
}

/**
 * DTO: CampaignMatchDto
 *
 * Result of matching an email to a campaign.
 */
export interface CampaignMatchDto {
  campaignId: string;
  campaignName: string;
  confidence: number;
  matchType: 'pattern' | 'fingerprint' | 'fuzzy';
}

/**
 * DTO: TriageEmailDto
 *
 * Email enriched with triage information for the UI.
 */
export interface TriageEmailDto extends EmailDto {
  // Matched constituent information
  matchedConstituent?: ConstituentMatchDto;

  // Existing open cases for the constituent
  existingCases?: CaseDto[];

  // Matched campaigns (sorted by confidence, highest first)
  matchedCampaigns?: CampaignMatchDto[];

  // LLM-generated suggestions
  suggestion?: CaseSuggestionDto;

  // Processing status
  processingStatus: 'pending' | 'ready' | 'processing' | 'error';
  processingError?: string;
}

/**
 * DTO: TriageDecisionDto
 *
 * User's decision on how to handle a triaged email.
 */
export interface TriageDecisionDto {
  emailExternalId: number;
  action: 'create_case' | 'add_to_case' | 'ignore';

  // For 'create_case' action
  newConstituent?: {
    firstName: string;
    lastName: string;
    title?: string;
    email?: string;
  };
  newCase?: {
    caseTypeId?: number;
    categoryTypeId?: number;
    statusId?: number;
    assignedToId?: number;
    summary?: string;
  };

  // For 'add_to_case' action
  existingCaseId?: number;
  existingConstituentId?: number;

  // Common
  markActioned: boolean;
}

/**
 * DTO: TriageResultDto
 *
 * Result of processing a triage decision.
 */
export interface TriageResultDto {
  success: boolean;
  action: 'create_case' | 'add_to_case' | 'ignore';
  caseId?: string;
  caseExternalId?: number;
  constituentId?: string;
  constituentExternalId?: number;
  error?: string;
}

/**
 * DTO: EmailSearchDto
 *
 * Parameters for searching emails.
 */
export interface EmailSearchDto {
  type?: 'draft' | 'sent' | 'received' | 'scheduled';
  actioned?: boolean;
  caseId?: string;
  fromAddress?: string;
  subject?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}
