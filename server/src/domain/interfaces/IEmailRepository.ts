import { Email } from '../entities';
import { OfficeId, ExternalId } from '../value-objects';

/**
 * Repository Interface: IEmailRepository
 *
 * Defines the contract for email data access.
 * Implementations must be office-scoped for multi-tenancy.
 */
export interface IEmailRepository {
  /**
   * Find an email by internal UUID
   */
  findById(officeId: OfficeId, id: string): Promise<Email | null>;

  /**
   * Find an email by legacy external ID
   */
  findByExternalId(officeId: OfficeId, externalId: ExternalId): Promise<Email | null>;

  /**
   * Find emails for a case
   */
  findByCaseId(officeId: OfficeId, caseId: string): Promise<Email[]>;

  /**
   * Find unactioned emails (for triage)
   */
  findUnactioned(
    officeId: OfficeId,
    options?: {
      limit?: number;
      offset?: number;
      receivedSince?: Date;
    }
  ): Promise<Email[]>;

  /**
   * Find emails by sender address
   */
  findByFromAddress(officeId: OfficeId, fromAddress: string): Promise<Email[]>;

  /**
   * Get all emails for an office (paginated)
   */
  findAll(
    officeId: OfficeId,
    options?: {
      limit?: number;
      offset?: number;
      modifiedSince?: Date;
      type?: string;
      actioned?: boolean;
    }
  ): Promise<Email[]>;

  /**
   * Save an email (upsert by external_id)
   */
  save(email: Email): Promise<Email>;

  /**
   * Save multiple emails in a batch
   */
  saveMany(emails: Email[]): Promise<Email[]>;

  /**
   * Mark an email as actioned
   */
  markActioned(officeId: OfficeId, externalId: ExternalId): Promise<void>;

  /**
   * Delete an email by external ID
   */
  deleteByExternalId(officeId: OfficeId, externalId: ExternalId): Promise<void>;

  /**
   * Count emails for an office
   */
  count(officeId: OfficeId): Promise<number>;

  /**
   * Count unactioned emails for an office
   */
  countUnactioned(officeId: OfficeId): Promise<number>;

  /**
   * Create a new email
   */
  create(email: Email): Promise<Email>;

  /**
   * Update an existing email by internal ID
   */
  update(id: string, email: Partial<Email>): Promise<Email>;

  /**
   * Find an email by internal ID (simplified, without officeId for internal operations)
   */
  findById(id: string): Promise<Email | null>;

  /**
   * Update the external ID for an email (after pushing to legacy system)
   */
  updateExternalId(id: string, externalId: ExternalId): Promise<void>;
}
