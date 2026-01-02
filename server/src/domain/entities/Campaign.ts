import { OfficeId } from '../value-objects';

/**
 * Campaign status
 */
export type CampaignStatus = 'active' | 'inactive' | 'archived';

/**
 * Domain Entity: Campaign
 *
 * Represents a coordinated email campaign (e.g., petitions, policy campaigns).
 * Used for grouping similar emails and batch triage.
 */
export interface CampaignProps {
  id?: string;
  officeId: OfficeId;
  name: string;
  description?: string;
  status: CampaignStatus;
  subjectPattern?: string; // Regex pattern to match subjects
  fingerprintHash?: string; // Content hash for matching similar emails
  emailCount: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Campaign {
  private readonly props: CampaignProps;

  private constructor(props: CampaignProps) {
    this.props = props;
  }

  /**
   * Factory method to create a Campaign
   */
  static create(props: CampaignProps): Campaign {
    return new Campaign(props);
  }

  /**
   * Factory method to reconstitute from database
   */
  static fromDatabase(props: CampaignProps): Campaign {
    return new Campaign(props);
  }

  // Getters
  get id(): string | undefined {
    return this.props.id;
  }

  get officeId(): OfficeId {
    return this.props.officeId;
  }

  get name(): string {
    return this.props.name;
  }

  get description(): string | undefined {
    return this.props.description;
  }

  get status(): CampaignStatus {
    return this.props.status;
  }

  get subjectPattern(): string | undefined {
    return this.props.subjectPattern;
  }

  get fingerprintHash(): string | undefined {
    return this.props.fingerprintHash;
  }

  get emailCount(): number {
    return this.props.emailCount;
  }

  get createdAt(): Date | undefined {
    return this.props.createdAt;
  }

  get updatedAt(): Date | undefined {
    return this.props.updatedAt;
  }

  /**
   * Check if campaign is active
   */
  isActive(): boolean {
    return this.props.status === 'active';
  }

  /**
   * Check if a subject matches this campaign's pattern
   * Returns a confidence score between 0 and 1
   */
  matchSubject(subject: string): { matches: boolean; confidence: number; matchType: 'pattern' | 'fuzzy' | 'none' } {
    if (!subject) {
      return { matches: false, confidence: 0, matchType: 'none' };
    }

    // Try regex pattern match first
    if (this.props.subjectPattern) {
      try {
        const regex = new RegExp(this.props.subjectPattern, 'i');
        if (regex.test(subject)) {
          return { matches: true, confidence: 0.95, matchType: 'pattern' };
        }
      } catch {
        // Invalid regex, fall through to fuzzy matching
      }
    }

    // Fuzzy matching: check if campaign name words appear in subject
    const campaignWords = this.props.name.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const subjectLower = subject.toLowerCase();

    let matchedWords = 0;
    for (const word of campaignWords) {
      if (subjectLower.includes(word)) {
        matchedWords++;
      }
    }

    if (campaignWords.length > 0 && matchedWords > 0) {
      const confidence = (matchedWords / campaignWords.length) * 0.7; // Max 0.7 for fuzzy match
      if (confidence >= 0.3) {
        return { matches: true, confidence, matchType: 'fuzzy' };
      }
    }

    return { matches: false, confidence: 0, matchType: 'none' };
  }

  /**
   * Check if content matches this campaign's fingerprint
   */
  matchFingerprint(contentHash: string): boolean {
    if (!this.props.fingerprintHash || !contentHash) {
      return false;
    }
    return this.props.fingerprintHash === contentHash;
  }

  /**
   * Convert to plain object for persistence
   */
  toPersistence(): Record<string, unknown> {
    return {
      id: this.props.id,
      office_id: this.props.officeId.toString(),
      name: this.props.name,
      description: this.props.description,
      status: this.props.status,
      subject_pattern: this.props.subjectPattern,
      fingerprint_hash: this.props.fingerprintHash,
      email_count: this.props.emailCount,
      created_at: this.props.createdAt?.toISOString(),
      updated_at: this.props.updatedAt?.toISOString(),
    };
  }
}
