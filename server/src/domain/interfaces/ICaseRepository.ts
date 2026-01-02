import { Case } from '../entities';
import { OfficeId, ExternalId } from '../value-objects';

/**
 * Repository Interface: ICaseRepository
 *
 * Defines the contract for case data access.
 * Implementations must be office-scoped for multi-tenancy.
 */
export interface ICaseRepository {
  /**
   * Find a case by internal UUID
   */
  findById(officeId: OfficeId, id: string): Promise<Case | null>;

  /**
   * Find a case by legacy external ID
   */
  findByExternalId(officeId: OfficeId, externalId: ExternalId): Promise<Case | null>;

  /**
   * Find cases for a constituent with optional filters
   */
  findByConstituentId(
    officeId: OfficeId,
    constituentId: string,
    options?: { openOnly?: boolean }
  ): Promise<Case[]>;

  /**
   * Find cases for a constituent by external ID
   */
  findByConstituentExternalId(officeId: OfficeId, constituentExternalId: ExternalId): Promise<Case[]>;

  /**
   * Find open cases for a constituent (for triage matching)
   */
  findOpenCasesForConstituent(officeId: OfficeId, constituentId: string): Promise<Case[]>;

  /**
   * Get all cases for an office (paginated)
   */
  findAll(
    officeId: OfficeId,
    options?: {
      limit?: number;
      offset?: number;
      modifiedSince?: Date;
      statusId?: string;
      caseTypeId?: string;
      assignedToId?: string;
    }
  ): Promise<Case[]>;

  /**
   * Save a case (upsert by external_id)
   */
  save(caseEntity: Case): Promise<Case>;

  /**
   * Save multiple cases in a batch
   */
  saveMany(cases: Case[]): Promise<Case[]>;

  /**
   * Delete a case by external ID
   */
  deleteByExternalId(officeId: OfficeId, externalId: ExternalId): Promise<void>;

  /**
   * Count cases for an office
   */
  count(officeId: OfficeId): Promise<number>;

  /**
   * Count cases by status for an office
   */
  countByStatus(officeId: OfficeId): Promise<Record<string, number>>;

  /**
   * Create a new case
   */
  create(caseEntity: Case): Promise<Case>;

  /**
   * Update an existing case by internal ID
   */
  update(id: string, caseEntity: Partial<Case>): Promise<Case>;

  /**
   * Update the external ID for a case (after push to legacy)
   */
  updateExternalId(id: string, externalId: ExternalId): Promise<void>;
}
