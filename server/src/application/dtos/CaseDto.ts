/**
 * DTO: CaseDto
 *
 * Data Transfer Object for case data between layers.
 */
export interface CaseDto {
  id: string;
  officeId: string;
  externalId: number;
  constituentId?: string;
  constituentExternalId?: number;
  caseTypeId?: string;
  caseTypeName?: string;
  statusId?: string;
  statusName?: string;
  categoryTypeId?: string;
  categoryTypeName?: string;
  assignedToId?: string;
  assignedToName?: string;
  summary?: string;
  reviewDate?: string;
  isOverdue: boolean;
  lastSyncedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * DTO: CreateCaseDto
 *
 * Data required to create a new case.
 */
export interface CreateCaseDto {
  constituentId: string;
  constituentExternalId: number;
  caseTypeId?: number;
  statusId?: number;
  categoryTypeId?: number;
  contactTypeId?: number;
  assignedToId?: number;
  summary?: string;
  reviewDate?: string;
}

/**
 * DTO: UpdateCaseDto
 *
 * Data for updating an existing case.
 */
export interface UpdateCaseDto {
  caseTypeId?: number;
  statusId?: number;
  categoryTypeId?: number;
  contactTypeId?: number;
  assignedToId?: number;
  summary?: string;
  reviewDate?: string;
}

/**
 * DTO: CaseSearchDto
 *
 * Parameters for searching cases.
 */
export interface CaseSearchDto {
  constituentId?: string;
  statusIds?: number[];
  caseTypeIds?: number[];
  assignedToIds?: number[];
  dateRangeType?: 'created' | 'modified';
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

/**
 * DTO: CaseSuggestionDto
 *
 * LLM-generated suggestion for a case based on email content.
 */
export interface CaseSuggestionDto {
  suggestedCaseType?: {
    id: number;
    name: string;
    confidence: number;
  };
  suggestedCategory?: {
    id: number;
    name: string;
    confidence: number;
  };
  urgency: 'low' | 'medium' | 'high';
  summary: string;
  suggestedResponse?: string;
}
