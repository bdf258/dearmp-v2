import { OfficeId, ExternalId } from '../value-objects';

/**
 * Legacy API response types (raw data from Caseworker API)
 */
export interface LegacyConstituentResponse {
  id: number;
  firstName?: string;
  lastName?: string;
  title?: string;
  organisationType?: string;
  geocodeLat?: number;
  geocodeLng?: number;
  contactDetails?: Array<{
    id: number;
    type: string;
    value: string;
  }>;
}

export interface LegacyCaseResponse {
  id: number;
  constituentID?: number;
  caseTypeID?: number;
  statusID?: number;
  categoryTypeID?: number;
  contactTypeID?: number;
  assignedToID?: number;
  summary?: string;
  reviewDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LegacyEmailResponse {
  id: number;
  caseID?: number;
  constituentID?: number;
  type?: 'draft' | 'sent' | 'received' | 'scheduled';
  subject?: string;
  htmlBody?: string;
  from?: string;
  to?: string[];
  cc?: string[];
  bcc?: string[];
  actioned?: boolean;
  assignedToID?: number;
  scheduledAt?: string;
  sentAt?: string;
  receivedAt?: string;
}

export interface LegacySearchResult<T> {
  results: T[];
  total: number;
  page: number;
  limit: number;
}

export interface LegacyConstituentMatch {
  id: number;
  firstName?: string;
  lastName?: string;
  email?: string;
  matchScore: number;
}

/**
 * Interface: ILegacyApiClient
 *
 * Defines the contract for interacting with the legacy Caseworker API.
 * All methods require an officeId to load the correct credentials.
 */
export interface ILegacyApiClient {
  /**
   * Authenticate with the legacy API and get a token
   */
  authenticate(officeId: OfficeId): Promise<string>;

  /**
   * Refresh the authentication token before it expires
   */
  refreshToken(officeId: OfficeId): Promise<string>;

  // ─────────────────────────────────────────────────────────────────────────
  // INBOX OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Search inbox for emails
   */
  searchInbox(
    officeId: OfficeId,
    params: {
      actioned?: boolean;
      type?: 'received' | 'sent' | 'draft';
      dateFrom?: Date;
      dateTo?: Date;
      page?: number;
      limit?: number;
    }
  ): Promise<LegacySearchResult<LegacyEmailResponse>>;

  /**
   * Find constituent matches for an email address (and optionally name)
   */
  findConstituentMatches(
    officeId: OfficeId,
    params: { name?: string; email: string }
  ): Promise<LegacyConstituentMatch[]>;

  // ─────────────────────────────────────────────────────────────────────────
  // CONSTITUENT OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get a constituent by ID
   */
  getConstituent(
    officeId: OfficeId,
    constituentId: ExternalId
  ): Promise<LegacyConstituentResponse | null>;

  /**
   * Search for constituents
   */
  searchConstituents(
    officeId: OfficeId,
    params: {
      term?: string;
      createdAfter?: Date;
      modifiedAfter?: Date;
      page?: number;
      limit?: number;
    }
  ): Promise<LegacySearchResult<LegacyConstituentResponse>>;

  /**
   * Create a new constituent
   */
  createConstituent(
    officeId: OfficeId,
    data: {
      firstName: string;
      lastName: string;
      title?: string;
      organisationType?: string;
    }
  ): Promise<LegacyConstituentResponse>;

  /**
   * Update a constituent
   */
  updateConstituent(
    officeId: OfficeId,
    constituentId: ExternalId,
    data: Partial<{
      firstName: string;
      lastName: string;
      title: string;
      organisationType: string;
    }>
  ): Promise<LegacyConstituentResponse>;

  /**
   * Add contact detail to a constituent
   */
  addContactDetail(
    officeId: OfficeId,
    constituentId: ExternalId,
    data: {
      contactTypeID: number;
      value: string;
      source?: string;
    }
  ): Promise<{ id: number }>;

  // ─────────────────────────────────────────────────────────────────────────
  // CASE OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get a case by ID
   */
  getCase(officeId: OfficeId, caseId: ExternalId): Promise<LegacyCaseResponse | null>;

  /**
   * Search for cases
   */
  searchCases(
    officeId: OfficeId,
    params: {
      dateRange?: {
        type: 'created' | 'modified';
        from: Date;
        to: Date;
      };
      statusID?: number[];
      caseTypeID?: number[];
      assignedToID?: number[];
      pageNo?: number;
      resultsPerPage?: number;
    }
  ): Promise<LegacySearchResult<LegacyCaseResponse>>;

  /**
   * Create a new case
   */
  createCase(
    officeId: OfficeId,
    data: {
      constituentID: number;
      caseTypeID?: number;
      statusID?: number;
      categoryTypeID?: number;
      contactTypeID?: number;
      assignedToID?: number;
      summary?: string;
      reviewDate?: string;
    }
  ): Promise<LegacyCaseResponse>;

  /**
   * Update a case
   */
  updateCase(
    officeId: OfficeId,
    caseId: ExternalId,
    data: Partial<{
      caseTypeID: number;
      statusID: number;
      categoryTypeID: number;
      contactTypeID: number;
      assignedToID: number;
      summary: string;
      reviewDate: string;
    }>
  ): Promise<LegacyCaseResponse>;

  // ─────────────────────────────────────────────────────────────────────────
  // EMAIL OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get an email by ID
   */
  getEmail(officeId: OfficeId, emailId: ExternalId): Promise<LegacyEmailResponse | null>;

  /**
   * Mark an email as actioned
   */
  markEmailActioned(officeId: OfficeId, emailId: ExternalId): Promise<void>;

  /**
   * Assign an email to a caseworker
   */
  assignEmail(
    officeId: OfficeId,
    emailId: ExternalId,
    caseworkerId: ExternalId
  ): Promise<void>;

  // ─────────────────────────────────────────────────────────────────────────
  // REFERENCE DATA
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get all caseworkers
   */
  getCaseworkers(
    officeId: OfficeId
  ): Promise<Array<{ id: number; name: string; email?: string; isActive: boolean }>>;

  /**
   * Get all case types
   */
  getCaseTypes(
    officeId: OfficeId
  ): Promise<Array<{ id: number; name: string; isActive: boolean }>>;

  /**
   * Get all status types
   */
  getStatusTypes(
    officeId: OfficeId
  ): Promise<Array<{ id: number; name: string; isActive: boolean }>>;

  /**
   * Get all category types
   */
  getCategoryTypes(
    officeId: OfficeId
  ): Promise<Array<{ id: number; name: string; isActive: boolean }>>;

  /**
   * Get all contact types
   */
  getContactTypes(
    officeId: OfficeId
  ): Promise<Array<{ id: number; name: string; type: string; isActive: boolean }>>;
}
