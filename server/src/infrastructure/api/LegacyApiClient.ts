import {
  ILegacyApiClient,
  LegacyConstituentResponse,
  LegacyCaseResponse,
  LegacyEmailResponse,
  LegacySearchResult,
  LegacyConstituentMatch,
} from '../../domain/interfaces';
import { OfficeId, ExternalId } from '../../domain/value-objects';
import { RateLimiter, ExponentialBackoff } from './RateLimiter';

/**
 * Credentials repository interface
 */
export interface ICredentialsRepository {
  getCredentials(officeId: OfficeId): Promise<{
    apiBaseUrl: string;
    token?: string;
    tokenExpiresAt?: Date;
    email?: string;
    password?: string;
  } | null>;

  updateToken(officeId: OfficeId, token: string, expiresAt: Date): Promise<void>;
}

/**
 * Implementation: LegacyApiClient
 *
 * Implements the ILegacyApiClient interface for communicating
 * with the legacy Caseworker API.
 */
export class LegacyApiClient implements ILegacyApiClient {
  private readonly rateLimiter: RateLimiter;
  private readonly backoff: ExponentialBackoff;
  private readonly tokenCache: Map<string, { token: string; expiresAt: Date }> = new Map();

  constructor(private readonly credentialsRepository: ICredentialsRepository) {
    this.rateLimiter = new RateLimiter(10); // 10 RPS
    this.backoff = new ExponentialBackoff({
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      maxAttempts: 3,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // AUTHENTICATION
  // ─────────────────────────────────────────────────────────────────────────

  async authenticate(officeId: OfficeId): Promise<string> {
    const credentials = await this.credentialsRepository.getCredentials(officeId);
    if (!credentials) {
      throw new Error(`No credentials found for office: ${officeId.toString()}`);
    }

    // Check if we have a valid cached token
    const cached = this.tokenCache.get(officeId.toString());
    if (cached && cached.expiresAt > new Date(Date.now() + 5 * 60 * 1000)) {
      return cached.token;
    }

    // Authenticate with legacy API
    const response = await this.request<string>(
      credentials.apiBaseUrl,
      '/auth',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: credentials.email,
          password: credentials.password,
          locale: 'en-GB',
        }),
      }
    );

    // Calculate expiry (30 minutes from now, with 5 minute buffer)
    const expiresAt = new Date(Date.now() + 25 * 60 * 1000);

    // Cache and persist the token
    this.tokenCache.set(officeId.toString(), { token: response, expiresAt });
    await this.credentialsRepository.updateToken(officeId, response, expiresAt);

    return response;
  }

  async refreshToken(officeId: OfficeId): Promise<string> {
    // Force re-authentication
    this.tokenCache.delete(officeId.toString());
    return this.authenticate(officeId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INBOX OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────

  async searchInbox(
    officeId: OfficeId,
    params: {
      actioned?: boolean;
      type?: 'received' | 'sent' | 'draft';
      dateFrom?: Date;
      dateTo?: Date;
      page?: number;
      limit?: number;
    }
  ): Promise<LegacySearchResult<LegacyEmailResponse>> {
    return this.post(officeId, '/inbox/search', {
      actioned: params.actioned,
      type: params.type,
      dateFrom: params.dateFrom?.toISOString(),
      dateTo: params.dateTo?.toISOString(),
      page: params.page ?? 1,
      limit: params.limit ?? 100,
    });
  }

  async findConstituentMatches(
    officeId: OfficeId,
    params: { name?: string; email: string }
  ): Promise<LegacyConstituentMatch[]> {
    return this.post(officeId, '/inbox/constituentMatches', {
      name: params.name,
      email: params.email,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CONSTITUENT OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────

  async getConstituent(
    officeId: OfficeId,
    constituentId: ExternalId
  ): Promise<LegacyConstituentResponse | null> {
    try {
      return await this.get(officeId, `/constituents/${constituentId.toNumber()}`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  async searchConstituents(
    officeId: OfficeId,
    params: {
      term?: string;
      createdAfter?: Date;
      modifiedAfter?: Date;
      page?: number;
      limit?: number;
    }
  ): Promise<LegacySearchResult<LegacyConstituentResponse>> {
    return this.post(officeId, '/constituents/search', {
      term: params.term,
      createdAfter: params.createdAfter?.toISOString(),
      modifiedAfter: params.modifiedAfter?.toISOString(),
      page: params.page ?? 1,
      limit: params.limit ?? 100,
    });
  }

  async createConstituent(
    officeId: OfficeId,
    data: {
      firstName: string;
      lastName: string;
      title?: string;
      organisationType?: string;
    }
  ): Promise<LegacyConstituentResponse> {
    return this.post(officeId, '/constituents', data);
  }

  async updateConstituent(
    officeId: OfficeId,
    constituentId: ExternalId,
    data: Partial<{
      firstName: string;
      lastName: string;
      title: string;
      organisationType: string;
    }>
  ): Promise<LegacyConstituentResponse> {
    return this.patch(officeId, `/constituents/${constituentId.toNumber()}`, data);
  }

  async addContactDetail(
    officeId: OfficeId,
    constituentId: ExternalId,
    data: {
      contactTypeID: number;
      value: string;
      source?: string;
    }
  ): Promise<{ id: number }> {
    return this.post(officeId, '/contactDetails', {
      constituentID: constituentId.toNumber(),
      ...data,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CASE OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────

  async getCase(officeId: OfficeId, caseId: ExternalId): Promise<LegacyCaseResponse | null> {
    try {
      return await this.get(officeId, `/cases/${caseId.toNumber()}`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  async searchCases(
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
  ): Promise<LegacySearchResult<LegacyCaseResponse>> {
    return this.post(officeId, '/cases/search', {
      dateRange: params.dateRange
        ? {
            type: params.dateRange.type,
            from: params.dateRange.from.toISOString(),
            to: params.dateRange.to.toISOString(),
          }
        : undefined,
      statusID: params.statusID,
      casetypeID: params.caseTypeID,
      assignedToID: params.assignedToID,
      pageNo: params.pageNo ?? 1,
      resultsPerPage: params.resultsPerPage ?? 100,
    });
  }

  async createCase(
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
  ): Promise<LegacyCaseResponse> {
    return this.post(officeId, '/cases', data);
  }

  async updateCase(
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
  ): Promise<LegacyCaseResponse> {
    return this.patch(officeId, `/cases/${caseId.toNumber()}`, data);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EMAIL OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────

  async getEmail(officeId: OfficeId, emailId: ExternalId): Promise<LegacyEmailResponse | null> {
    try {
      return await this.get(officeId, `/emails/${emailId.toNumber()}`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  async markEmailActioned(officeId: OfficeId, emailId: ExternalId): Promise<void> {
    await this.patch(officeId, `/emails/${emailId.toNumber()}`, { actioned: true });
  }

  async assignEmail(
    officeId: OfficeId,
    emailId: ExternalId,
    caseworkerId: ExternalId
  ): Promise<void> {
    await this.patch(officeId, `/emails/${emailId.toNumber()}`, {
      assignedToID: caseworkerId.toNumber(),
    });
  }

  async createDraftEmail(
    officeId: OfficeId,
    data: {
      to: string[];
      cc?: string[];
      bcc?: string[];
      subject: string;
      htmlBody: string;
      caseId?: number;
    }
  ): Promise<LegacyEmailResponse> {
    return this.post(officeId, '/emails', {
      type: 'draft',
      to: data.to,
      cc: data.cc,
      bcc: data.bcc,
      subject: data.subject,
      htmlBody: data.htmlBody,
      caseID: data.caseId,
    });
  }

  async sendDraftEmail(officeId: OfficeId, emailId: ExternalId): Promise<void> {
    await this.post(officeId, `/emails/${emailId.toNumber()}/send`, {});
  }

  async scheduleEmail(
    officeId: OfficeId,
    emailId: ExternalId,
    scheduledAt: Date
  ): Promise<void> {
    await this.patch(officeId, `/emails/${emailId.toNumber()}`, {
      type: 'scheduled',
      scheduledAt: scheduledAt.toISOString(),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CASENOTE OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────

  async createCasenote(
    officeId: OfficeId,
    caseExternalId: number,
    data: {
      type: string;
      content?: string;
      subtypeId?: number;
    }
  ): Promise<{ id: number }> {
    return this.post(officeId, `/cases/${caseExternalId}/notes`, {
      type: data.type,
      content: data.content,
      subtypeId: data.subtypeId,
    });
  }

  async updateCasenote(
    officeId: OfficeId,
    casenoteId: ExternalId,
    data: {
      content?: string;
      actioned?: boolean;
    }
  ): Promise<void> {
    await this.patch(officeId, `/casenotes/${casenoteId.toNumber()}`, data);
  }

  async linkEmailToCase(
    officeId: OfficeId,
    caseExternalId: number,
    emailExternalId: number
  ): Promise<{ id: number }> {
    // Create a casenote of type 'email' that links to the email
    return this.post(officeId, `/cases/${caseExternalId}/notes`, {
      type: 'email',
      emailId: emailExternalId,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REFERENCE DATA
  // ─────────────────────────────────────────────────────────────────────────

  async getCaseworkers(
    officeId: OfficeId
  ): Promise<Array<{ id: number; name: string; email?: string; isActive: boolean }>> {
    const data = await this.get<Array<{ id: number; name: string; email?: string; is_active: boolean }>>(
      officeId,
      '/caseworkers/all'
    );
    return data.map(cw => ({
      id: cw.id,
      name: cw.name,
      email: cw.email,
      isActive: cw.is_active,
    }));
  }

  async getCaseTypes(
    officeId: OfficeId
  ): Promise<Array<{ id: number; name: string; isActive: boolean }>> {
    // Note: Caseworker API uses singular /casetype, returns 'casetype' field as name
    const data = await this.get<Array<{ id: number; casetype: string; is_active: boolean }>>(
      officeId,
      '/casetype'
    );
    return data.map(ct => ({
      id: ct.id,
      name: ct.casetype,
      isActive: ct.is_active,
    }));
  }

  async getStatusTypes(
    officeId: OfficeId
  ): Promise<Array<{ id: number; name: string; isActive: boolean }>> {
    // Note: Caseworker API uses singular /statustype, returns 'statustype' field as name
    const data = await this.get<Array<{ id: number; statustype: string; is_active: boolean }>>(
      officeId,
      '/statustype'
    );
    return data.map(st => ({
      id: st.id,
      name: st.statustype,
      isActive: st.is_active,
    }));
  }

  async getCategoryTypes(
    officeId: OfficeId
  ): Promise<Array<{ id: number; name: string; isActive: boolean }>> {
    // Note: Caseworker API uses singular /categorytype, returns 'categorytype' field as name
    const data = await this.get<Array<{ id: number; categorytype: string; is_active: boolean }>>(
      officeId,
      '/categorytype'
    );
    return data.map(cat => ({
      id: cat.id,
      name: cat.categorytype,
      isActive: cat.is_active,
    }));
  }

  async getContactTypes(
    officeId: OfficeId
  ): Promise<Array<{ id: number; name: string; type: string; isActive: boolean }>> {
    // Note: Caseworker API uses singular /contacttype (for constituent contact details)
    const data = await this.get<Array<{ id: number; name: string; type: string; is_active: boolean }>>(
      officeId,
      '/contacttype'
    );
    return data.map(ct => ({
      id: ct.id,
      name: ct.name,
      type: ct.type,
      isActive: ct.is_active,
    }));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INTERNAL HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Build the full API URL from subdomain and path.
   * The subdomain is stored in credentials.apiBaseUrl (e.g., "caseworker")
   * and is combined to form: https://{subdomain}.farier.com/api/ajax{path}
   */
  private buildApiUrl(subdomain: string, path: string): string {
    // Remove any protocol prefix or trailing slashes from subdomain if present
    const cleanSubdomain = subdomain
      .replace(/^https?:\/\//, '')
      .replace(/\.farier\.com.*$/, '')
      .replace(/\/$/, '');
    return `https://${cleanSubdomain}.farier.com/api/ajax${path}`;
  }

  private async request<T>(
    subdomain: string,
    path: string,
    init: RequestInit
  ): Promise<T> {
    const url = this.buildApiUrl(subdomain, path);

    // Safety guard: prevent all API calls when LEGACY_API_DISABLED is set
    if (process.env.LEGACY_API_DISABLED === 'true') {
      console.warn(`[LegacyApiClient] API calls disabled. Would have called: ${init.method} ${url}`);
      throw new Error('Legacy API calls are disabled (LEGACY_API_DISABLED=true)');
    }

    return this.rateLimiter.execute(() =>
      this.backoff.execute(
        async (): Promise<T> => {
          const response = await fetch(url, init);

          if (!response.ok) {
            if (response.status === 429) {
              throw new Error('Rate limited');
            }
            if (response.status === 401) {
              throw new Error('Unauthorized');
            }
            throw new Error(`API error: ${response.status} ${response.statusText}`);
          }

          const contentType = response.headers.get('content-type');
          if (contentType?.includes('application/json')) {
            return (await response.json()) as T;
          }
          return (await response.text()) as unknown as T;
        },
        (_error) => {
          // Retry on rate limit or network errors
          if (_error.message === 'Rate limited') return true;
          if (_error.message.includes('fetch failed')) return true;
          return false;
        }
      )
    );
  }

  /**
   * Make an authenticated GET request
   */
  private async get<T>(officeId: OfficeId, path: string): Promise<T> {
    const credentials = await this.credentialsRepository.getCredentials(officeId);
    if (!credentials) throw new Error(`No credentials for office: ${officeId.toString()}`);

    const token = await this.authenticate(officeId);

    return this.request<T>(credentials.apiBaseUrl, path, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
      },
    });
  }

  /**
   * Make an authenticated POST request
   */
  private async post<T>(officeId: OfficeId, path: string, body: unknown): Promise<T> {
    const credentials = await this.credentialsRepository.getCredentials(officeId);
    if (!credentials) throw new Error(`No credentials for office: ${officeId.toString()}`);

    const token = await this.authenticate(officeId);

    return this.request<T>(credentials.apiBaseUrl, path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
      },
      body: JSON.stringify(body),
    });
  }

  /**
   * Make an authenticated PATCH request
   */
  private async patch<T>(officeId: OfficeId, path: string, body: unknown): Promise<T> {
    const credentials = await this.credentialsRepository.getCredentials(officeId);
    if (!credentials) throw new Error(`No credentials for office: ${officeId.toString()}`);

    const token = await this.authenticate(officeId);

    return this.request<T>(credentials.apiBaseUrl, path, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
      },
      body: JSON.stringify(body),
    });
  }
}
