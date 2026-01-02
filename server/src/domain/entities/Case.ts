import { OfficeId, ExternalId } from '../value-objects';

/**
 * Domain Entity: Case
 *
 * Represents a constituent issue or request being tracked.
 * This is the central entity in the casework domain.
 */
export interface CaseProps {
  id?: string;
  officeId: OfficeId;
  externalId: ExternalId;
  constituentId?: string;
  constituentExternalId?: ExternalId;
  caseTypeId?: string;
  caseTypeExternalId?: ExternalId;
  statusId?: string;
  statusExternalId?: ExternalId;
  categoryTypeId?: string;
  categoryTypeExternalId?: ExternalId;
  contactTypeId?: string;
  contactTypeExternalId?: ExternalId;
  assignedToId?: string;
  assignedToExternalId?: ExternalId;
  summary?: string;
  reviewDate?: Date;
  lastSyncedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Case {
  private readonly props: CaseProps;

  private constructor(props: CaseProps) {
    this.props = props;
  }

  /**
   * Factory method to create a Case from legacy API data
   */
  static fromLegacy(
    officeId: OfficeId,
    externalId: ExternalId,
    data: {
      constituentExternalId?: number;
      caseTypeExternalId?: number;
      statusExternalId?: number;
      categoryTypeExternalId?: number;
      contactTypeExternalId?: number;
      assignedToExternalId?: number;
      summary?: string;
      reviewDate?: string;
    }
  ): Case {
    return new Case({
      officeId,
      externalId,
      constituentExternalId: data.constituentExternalId
        ? ExternalId.fromTrusted(data.constituentExternalId)
        : undefined,
      caseTypeExternalId: data.caseTypeExternalId
        ? ExternalId.fromTrusted(data.caseTypeExternalId)
        : undefined,
      statusExternalId: data.statusExternalId
        ? ExternalId.fromTrusted(data.statusExternalId)
        : undefined,
      categoryTypeExternalId: data.categoryTypeExternalId
        ? ExternalId.fromTrusted(data.categoryTypeExternalId)
        : undefined,
      contactTypeExternalId: data.contactTypeExternalId
        ? ExternalId.fromTrusted(data.contactTypeExternalId)
        : undefined,
      assignedToExternalId: data.assignedToExternalId
        ? ExternalId.fromTrusted(data.assignedToExternalId)
        : undefined,
      summary: data.summary,
      reviewDate: data.reviewDate ? new Date(data.reviewDate) : undefined,
      lastSyncedAt: new Date(),
    });
  }

  /**
   * Factory method to reconstitute from database
   */
  static fromDatabase(props: CaseProps): Case {
    return new Case(props);
  }

  // Getters
  get id(): string | undefined {
    return this.props.id;
  }

  get officeId(): OfficeId {
    return this.props.officeId;
  }

  get externalId(): ExternalId {
    return this.props.externalId;
  }

  get constituentId(): string | undefined {
    return this.props.constituentId;
  }

  get constituentExternalId(): ExternalId | undefined {
    return this.props.constituentExternalId;
  }

  get caseTypeId(): string | undefined {
    return this.props.caseTypeId;
  }

  get statusId(): string | undefined {
    return this.props.statusId;
  }

  get categoryTypeId(): string | undefined {
    return this.props.categoryTypeId;
  }

  get assignedToId(): string | undefined {
    return this.props.assignedToId;
  }

  get summary(): string | undefined {
    return this.props.summary;
  }

  get reviewDate(): Date | undefined {
    return this.props.reviewDate;
  }

  get lastSyncedAt(): Date | undefined {
    return this.props.lastSyncedAt;
  }

  /**
   * Check if case has a review date set
   */
  hasReviewDate(): boolean {
    return this.props.reviewDate !== undefined;
  }

  /**
   * Check if review date is overdue
   */
  isReviewOverdue(): boolean {
    if (!this.props.reviewDate) return false;
    return this.props.reviewDate < new Date();
  }

  /**
   * Check if case is assigned
   */
  isAssigned(): boolean {
    return this.props.assignedToId !== undefined || this.props.assignedToExternalId !== undefined;
  }

  /**
   * Update case data from legacy sync
   */
  updateFromLegacy(data: {
    constituentExternalId?: number;
    caseTypeExternalId?: number;
    statusExternalId?: number;
    categoryTypeExternalId?: number;
    contactTypeExternalId?: number;
    assignedToExternalId?: number;
    summary?: string;
    reviewDate?: string;
  }): Case {
    return new Case({
      ...this.props,
      constituentExternalId: data.constituentExternalId
        ? ExternalId.fromTrusted(data.constituentExternalId)
        : this.props.constituentExternalId,
      caseTypeExternalId: data.caseTypeExternalId
        ? ExternalId.fromTrusted(data.caseTypeExternalId)
        : this.props.caseTypeExternalId,
      statusExternalId: data.statusExternalId
        ? ExternalId.fromTrusted(data.statusExternalId)
        : this.props.statusExternalId,
      categoryTypeExternalId: data.categoryTypeExternalId
        ? ExternalId.fromTrusted(data.categoryTypeExternalId)
        : this.props.categoryTypeExternalId,
      contactTypeExternalId: data.contactTypeExternalId
        ? ExternalId.fromTrusted(data.contactTypeExternalId)
        : this.props.contactTypeExternalId,
      assignedToExternalId: data.assignedToExternalId
        ? ExternalId.fromTrusted(data.assignedToExternalId)
        : this.props.assignedToExternalId,
      summary: data.summary ?? this.props.summary,
      reviewDate: data.reviewDate ? new Date(data.reviewDate) : this.props.reviewDate,
      lastSyncedAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /**
   * Convert to plain object for persistence
   */
  toPersistence(): Record<string, unknown> {
    return {
      id: this.props.id,
      office_id: this.props.officeId.toString(),
      external_id: this.props.externalId.toNumber(),
      constituent_id: this.props.constituentId,
      constituent_external_id: this.props.constituentExternalId?.toNumber(),
      case_type_id: this.props.caseTypeId,
      case_type_external_id: this.props.caseTypeExternalId?.toNumber(),
      status_id: this.props.statusId,
      status_external_id: this.props.statusExternalId?.toNumber(),
      category_type_id: this.props.categoryTypeId,
      category_type_external_id: this.props.categoryTypeExternalId?.toNumber(),
      contact_type_id: this.props.contactTypeId,
      contact_type_external_id: this.props.contactTypeExternalId?.toNumber(),
      assigned_to_id: this.props.assignedToId,
      assigned_to_external_id: this.props.assignedToExternalId?.toNumber(),
      summary: this.props.summary,
      review_date: this.props.reviewDate?.toISOString(),
      last_synced_at: this.props.lastSyncedAt?.toISOString(),
    };
  }
}
