import { Constituent } from '../entities';
import { OfficeId, ExternalId } from '../value-objects';

/**
 * Repository Interface: IConstituentRepository
 *
 * Defines the contract for constituent data access.
 * Implementations must be office-scoped for multi-tenancy.
 */
export interface IConstituentRepository {
  /**
   * Find a constituent by internal UUID
   */
  findById(officeId: OfficeId, id: string): Promise<Constituent | null>;

  /**
   * Find a constituent by legacy external ID
   */
  findByExternalId(officeId: OfficeId, externalId: ExternalId): Promise<Constituent | null>;

  /**
   * Find constituents by email address
   */
  findByEmail(officeId: OfficeId, email: string): Promise<Constituent[]>;

  /**
   * Find constituents by name (partial match)
   */
  findByName(officeId: OfficeId, name: string, limit?: number): Promise<Constituent[]>;

  /**
   * Get all constituents for an office (paginated)
   */
  findAll(
    officeId: OfficeId,
    options?: {
      limit?: number;
      offset?: number;
      modifiedSince?: Date;
    }
  ): Promise<Constituent[]>;

  /**
   * Save a constituent (upsert by external_id)
   */
  save(constituent: Constituent): Promise<Constituent>;

  /**
   * Save multiple constituents in a batch
   */
  saveMany(constituents: Constituent[]): Promise<Constituent[]>;

  /**
   * Delete a constituent by external ID
   */
  deleteByExternalId(officeId: OfficeId, externalId: ExternalId): Promise<void>;

  /**
   * Count constituents for an office
   */
  count(officeId: OfficeId): Promise<number>;

  /**
   * Create a new constituent
   */
  create(constituent: Constituent): Promise<Constituent>;

  /**
   * Update an existing constituent by internal ID
   */
  update(id: string, constituent: Partial<Constituent>): Promise<Constituent>;

  /**
   * Update the external ID for a constituent (after push to legacy)
   */
  updateExternalId(id: string, externalId: ExternalId): Promise<void>;
}
