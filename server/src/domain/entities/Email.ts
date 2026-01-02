import { OfficeId, ExternalId } from '../value-objects';

/**
 * Email type in the legacy system
 */
export type EmailType = 'draft' | 'sent' | 'received' | 'scheduled';

/**
 * Domain Entity: Email
 *
 * Represents an email message in the casework system.
 * Emails can be inbound (from constituents) or outbound (from caseworkers).
 */
export interface EmailProps {
  id?: string;
  officeId: OfficeId;
  externalId: ExternalId;
  caseId?: string;
  caseExternalId?: ExternalId;
  constituentId?: string;
  constituentExternalId?: ExternalId;
  type?: EmailType;
  subject?: string;
  htmlBody?: string;
  fromAddress?: string;
  toAddresses?: string[];
  ccAddresses?: string[];
  bccAddresses?: string[];
  actioned: boolean;
  assignedToId?: string;
  assignedToExternalId?: ExternalId;
  scheduledAt?: Date;
  sentAt?: Date;
  receivedAt?: Date;
  lastSyncedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Email {
  private readonly props: EmailProps;

  private constructor(props: EmailProps) {
    this.props = props;
  }

  /**
   * Factory method to create an Email from legacy API data
   */
  static fromLegacy(
    officeId: OfficeId,
    externalId: ExternalId,
    data: {
      caseExternalId?: number;
      constituentExternalId?: number;
      type?: EmailType;
      subject?: string;
      htmlBody?: string;
      fromAddress?: string;
      toAddresses?: string[];
      ccAddresses?: string[];
      bccAddresses?: string[];
      actioned?: boolean;
      assignedToExternalId?: number;
      scheduledAt?: string;
      sentAt?: string;
      receivedAt?: string;
    }
  ): Email {
    return new Email({
      officeId,
      externalId,
      caseExternalId: data.caseExternalId
        ? ExternalId.fromTrusted(data.caseExternalId)
        : undefined,
      constituentExternalId: data.constituentExternalId
        ? ExternalId.fromTrusted(data.constituentExternalId)
        : undefined,
      type: data.type,
      subject: data.subject,
      htmlBody: data.htmlBody,
      fromAddress: data.fromAddress,
      toAddresses: data.toAddresses,
      ccAddresses: data.ccAddresses,
      bccAddresses: data.bccAddresses,
      actioned: data.actioned ?? false,
      assignedToExternalId: data.assignedToExternalId
        ? ExternalId.fromTrusted(data.assignedToExternalId)
        : undefined,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
      sentAt: data.sentAt ? new Date(data.sentAt) : undefined,
      receivedAt: data.receivedAt ? new Date(data.receivedAt) : undefined,
      lastSyncedAt: new Date(),
    });
  }

  /**
   * Factory method to reconstitute from database
   */
  static fromDatabase(props: EmailProps): Email {
    return new Email(props);
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

  get caseId(): string | undefined {
    return this.props.caseId;
  }

  get caseExternalId(): ExternalId | undefined {
    return this.props.caseExternalId;
  }

  get constituentId(): string | undefined {
    return this.props.constituentId;
  }

  get constituentExternalId(): ExternalId | undefined {
    return this.props.constituentExternalId;
  }

  get type(): EmailType | undefined {
    return this.props.type;
  }

  get subject(): string | undefined {
    return this.props.subject;
  }

  get htmlBody(): string | undefined {
    return this.props.htmlBody;
  }

  get fromAddress(): string | undefined {
    return this.props.fromAddress;
  }

  get toAddresses(): string[] | undefined {
    return this.props.toAddresses;
  }

  get actioned(): boolean {
    return this.props.actioned;
  }

  get receivedAt(): Date | undefined {
    return this.props.receivedAt;
  }

  get lastSyncedAt(): Date | undefined {
    return this.props.lastSyncedAt;
  }

  /**
   * Check if email is inbound (received from constituent)
   */
  isInbound(): boolean {
    return this.props.type === 'received';
  }

  /**
   * Check if email is outbound (sent to constituent)
   */
  isOutbound(): boolean {
    return this.props.type === 'sent';
  }

  /**
   * Check if email needs triage (unactioned inbound)
   */
  needsTriage(): boolean {
    return this.isInbound() && !this.props.actioned;
  }

  /**
   * Check if email is linked to a case
   */
  isLinkedToCase(): boolean {
    return this.props.caseId !== undefined || this.props.caseExternalId !== undefined;
  }

  /**
   * Check if email is linked to a constituent
   */
  isLinkedToConstituent(): boolean {
    return this.props.constituentId !== undefined || this.props.constituentExternalId !== undefined;
  }

  /**
   * Mark email as actioned
   */
  markActioned(): Email {
    return new Email({
      ...this.props,
      actioned: true,
      updatedAt: new Date(),
    });
  }

  /**
   * Link email to a case
   */
  linkToCase(caseId: string, caseExternalId: ExternalId): Email {
    return new Email({
      ...this.props,
      caseId,
      caseExternalId,
      updatedAt: new Date(),
    });
  }

  /**
   * Link email to a constituent
   */
  linkToConstituent(constituentId: string, constituentExternalId: ExternalId): Email {
    return new Email({
      ...this.props,
      constituentId,
      constituentExternalId,
      updatedAt: new Date(),
    });
  }

  /**
   * Update email data from legacy sync
   */
  updateFromLegacy(data: {
    caseExternalId?: number;
    constituentExternalId?: number;
    type?: EmailType;
    subject?: string;
    htmlBody?: string;
    actioned?: boolean;
  }): Email {
    return new Email({
      ...this.props,
      caseExternalId: data.caseExternalId
        ? ExternalId.fromTrusted(data.caseExternalId)
        : this.props.caseExternalId,
      constituentExternalId: data.constituentExternalId
        ? ExternalId.fromTrusted(data.constituentExternalId)
        : this.props.constituentExternalId,
      type: data.type ?? this.props.type,
      subject: data.subject ?? this.props.subject,
      htmlBody: data.htmlBody ?? this.props.htmlBody,
      actioned: data.actioned ?? this.props.actioned,
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
      case_id: this.props.caseId,
      case_external_id: this.props.caseExternalId?.toNumber(),
      constituent_id: this.props.constituentId,
      constituent_external_id: this.props.constituentExternalId?.toNumber(),
      type: this.props.type,
      subject: this.props.subject,
      html_body: this.props.htmlBody,
      from_address: this.props.fromAddress,
      to_addresses: this.props.toAddresses,
      cc_addresses: this.props.ccAddresses,
      bcc_addresses: this.props.bccAddresses,
      actioned: this.props.actioned,
      assigned_to_id: this.props.assignedToId,
      assigned_to_external_id: this.props.assignedToExternalId?.toNumber(),
      scheduled_at: this.props.scheduledAt?.toISOString(),
      sent_at: this.props.sentAt?.toISOString(),
      received_at: this.props.receivedAt?.toISOString(),
      last_synced_at: this.props.lastSyncedAt?.toISOString(),
    };
  }
}
