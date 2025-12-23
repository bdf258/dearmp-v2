import { Campaign } from '../entities';
import { OfficeId } from '../value-objects';

/**
 * Campaign match result with confidence score
 */
export interface CampaignMatchResult {
  campaign: Campaign;
  confidence: number;
  matchType: 'pattern' | 'fingerprint' | 'fuzzy';
}

/**
 * Repository Interface: ICampaignRepository
 *
 * Defines the contract for campaign data access.
 * Implementations must be office-scoped for multi-tenancy.
 */
export interface ICampaignRepository {
  /**
   * Find a campaign by internal UUID
   */
  findById(officeId: OfficeId, id: string): Promise<Campaign | null>;

  /**
   * Find all active campaigns for an office
   */
  findActive(officeId: OfficeId): Promise<Campaign[]>;

  /**
   * Find all campaigns for an office (paginated)
   */
  findAll(
    officeId: OfficeId,
    options?: {
      limit?: number;
      offset?: number;
      status?: 'active' | 'inactive' | 'archived';
    }
  ): Promise<Campaign[]>;

  /**
   * Find campaigns matching a subject line
   * Returns matches sorted by confidence score (highest first)
   */
  findBySubjectMatch(
    officeId: OfficeId,
    subject: string,
    options?: { minConfidence?: number; limit?: number }
  ): Promise<CampaignMatchResult[]>;

  /**
   * Find a campaign by fingerprint hash
   */
  findByFingerprint(officeId: OfficeId, fingerprintHash: string): Promise<Campaign | null>;

  /**
   * Save a campaign (upsert)
   */
  save(campaign: Campaign): Promise<Campaign>;

  /**
   * Increment email count for a campaign
   */
  incrementEmailCount(officeId: OfficeId, campaignId: string): Promise<void>;

  /**
   * Count campaigns for an office
   */
  count(officeId: OfficeId): Promise<number>;
}
