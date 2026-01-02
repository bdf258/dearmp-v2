import {
  IConstituentRepository,
  ICaseRepository,
  IEmailRepository,
  ICampaignRepository,
  ILegacyApiClient,
} from '../../domain/interfaces';
import { OfficeId, ExternalId } from '../../domain/value-objects';
import { Email, Constituent, Case } from '../../domain/entities';
import {
  TriageEmailDto,
  TriageDecisionDto,
  TriageResultDto,
  CaseSuggestionDto,
  ConstituentMatchDto,
  CampaignMatchDto,
  CaseDto,
  TriageContextDto,
  TriageSuggestionDto,
  EmailContentForAnalysis,
  ConstituentContextDto,
  CaseContextDto,
  CampaignContextDto,
  OfficeReferenceDataDto,
  buildTriageContextPrompt,
} from '../dtos';

/**
 * LLM Analysis Service Interface
 *
 * Defines the contract for LLM-based email analysis.
 * Implementations should handle the actual LLM API calls.
 */
export interface ILLMAnalysisService {
  /**
   * Analyze an email and generate triage suggestions
   */
  analyzeEmail(context: TriageContextDto): Promise<TriageSuggestionDto>;
}

/**
 * Service: TriageService
 *
 * Orchestrates the email triage workflow including:
 * - Fetching emails for triage
 * - Matching emails to constituents
 * - Matching emails to campaigns
 * - Finding existing cases for constituents
 * - Running LLM analysis
 * - Processing user triage decisions
 */
export class TriageService {
  private prefetchAhead = 3; // Number of emails to prefetch

  constructor(
    private readonly legacyApiClient: ILegacyApiClient,
    private readonly constituentRepository: IConstituentRepository,
    private readonly caseRepository: ICaseRepository,
    private readonly emailRepository: IEmailRepository,
    private readonly campaignRepository: ICampaignRepository,
    private readonly llmAnalysisService?: ILLMAnalysisService
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC METHODS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get the next batch of emails for triage
   */
  async getEmailsForTriage(
    officeId: OfficeId,
    options?: { limit?: number; offset?: number }
  ): Promise<TriageEmailDto[]> {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;

    // 1. Fetch unactioned emails from repository
    const emails = await this.emailRepository.findUnactioned(officeId, { limit, offset });

    // 2. Enrich each email with triage information
    const enrichedEmails = await Promise.all(
      emails.map(email => this.enrichEmailForTriage(officeId, email))
    );

    return enrichedEmails;
  }

  /**
   * Process a single email for triage (with full enrichment)
   */
  async processEmailForTriage(
    officeId: OfficeId,
    emailExternalId: ExternalId
  ): Promise<TriageEmailDto> {
    // 1. Fetch email from repository
    const email = await this.emailRepository.findByExternalId(officeId, emailExternalId);
    if (!email) {
      throw new Error(`Email not found: ${emailExternalId.toNumber()}`);
    }

    // 2. Enrich with full triage context
    const enrichedEmail = await this.enrichEmailForTriage(officeId, email);

    // 3. Trigger prefetch of next emails (fire and forget)
    this.prefetchNextEmails(officeId, 0).catch(err => {
      console.error('Prefetch error:', err);
    });

    return enrichedEmail;
  }

  /**
   * Match an email to a constituent
   */
  async matchConstituent(
    officeId: OfficeId,
    email: Email
  ): Promise<ConstituentMatchDto | null> {
    const senderEmail = email.fromAddress;
    if (!senderEmail) {
      return null;
    }

    // 1. Check local repository for exact email match
    const localMatches = await this.constituentRepository.findByEmail(officeId, senderEmail);
    const match = localMatches[0];
    if (match) {
      return {
        constituent: {
          id: match.id!,
          officeId: match.officeId.toString(),
          externalId: match.externalId.toNumber(),
          firstName: match.firstName,
          lastName: match.lastName,
          fullName: match.fullName,
          title: match.title,
          organisationType: match.organisationType,
          geocodeLat: match.geocodeLat,
          geocodeLng: match.geocodeLng,
          lastSyncedAt: match.lastSyncedAt?.toISOString(),
        },
        matchScore: 1.0, // Exact email match
        matchedOn: 'email',
      };
    }

    // 2. Query legacy API for matches
    try {
      const legacyMatches = await this.legacyApiClient.findConstituentMatches(officeId, { email: senderEmail });
      const bestMatch = legacyMatches[0]; // Already sorted by score
      if (bestMatch) {
        return {
          constituent: {
            id: '', // Will be assigned when synced
            officeId: officeId.toString(),
            externalId: bestMatch.id,
            firstName: bestMatch.firstName,
            lastName: bestMatch.lastName,
            fullName: [bestMatch.firstName, bestMatch.lastName].filter(Boolean).join(' '),
          },
          matchScore: bestMatch.matchScore,
          matchedOn: 'email',
        };
      }
    } catch (error) {
      console.error('Legacy API constituent match error:', error);
      // Continue without legacy matches
    }

    return null;
  }

  /**
   * Match an email to campaigns by subject
   */
  async matchCampaigns(
    officeId: OfficeId,
    email: Email
  ): Promise<CampaignMatchDto[]> {
    const subject = email.subject;
    if (!subject) {
      return [];
    }

    // Find campaigns matching the subject
    const matches = await this.campaignRepository.findBySubjectMatch(officeId, subject, {
      minConfidence: 0.3,
      limit: 5,
    });

    return matches.map(match => ({
      campaignId: match.campaign.id!,
      campaignName: match.campaign.name,
      confidence: match.confidence,
      matchType: match.matchType,
    }));
  }

  /**
   * Get open cases for a constituent
   */
  async getOpenCasesForConstituent(
    officeId: OfficeId,
    constituentId: string
  ): Promise<Case[]> {
    // Query case repository for open cases
    const cases = await this.caseRepository.findOpenCasesForConstituent(officeId, constituentId);

    // Sort by recency (most recent first)
    return cases.sort((a, b) => {
      const dateA = a.lastSyncedAt || new Date(0);
      const dateB = b.lastSyncedAt || new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
  }

  /**
   * Build the complete triage context for LLM analysis
   */
  async buildTriageContext(
    officeId: OfficeId,
    email: Email,
    matchedConstituent: ConstituentMatchDto | null,
    existingCases: Case[],
    matchedCampaigns: CampaignMatchDto[]
  ): Promise<TriageContextDto> {
    // Build email content for analysis
    const emailContent: EmailContentForAnalysis = {
      subject: email.subject || '',
      body: this.extractPlainTextFromHtml(email.htmlBody || ''),
      senderEmail: email.fromAddress || '',
      senderName: undefined, // Could be extracted from fromAddress
      receivedAt: email.receivedAt?.toISOString() || new Date().toISOString(),
    };

    // Build constituent context
    let constituentContext: ConstituentContextDto | undefined;
    if (matchedConstituent) {
      const caseCount = await this.caseRepository.findByConstituentId(
        officeId,
        matchedConstituent.constituent.id
      );
      constituentContext = {
        id: matchedConstituent.constituent.id,
        externalId: matchedConstituent.constituent.externalId,
        fullName: matchedConstituent.constituent.fullName,
        title: matchedConstituent.constituent.title,
        isOrganisation: !!matchedConstituent.constituent.organisationType,
        previousCaseCount: caseCount.length,
        lastContactDate: matchedConstituent.constituent.lastSyncedAt,
      };
    }

    // Build case contexts
    const caseContexts: CaseContextDto[] = existingCases.map(c => ({
      id: c.id!,
      externalId: c.externalId.toNumber(),
      summary: c.summary,
      caseTypeName: c.caseTypeId, // Would need lookup
      categoryName: c.categoryTypeId, // Would need lookup
      statusName: c.statusId, // Would need lookup
      createdAt: c.lastSyncedAt?.toISOString() || new Date().toISOString(),
      lastActivityAt: c.lastSyncedAt?.toISOString(),
    }));

    // Build campaign contexts
    const campaignContexts: CampaignContextDto[] = await Promise.all(
      matchedCampaigns.map(async cm => {
        const campaign = await this.campaignRepository.findById(officeId, cm.campaignId);
        return {
          id: cm.campaignId,
          name: cm.campaignName,
          description: campaign?.description,
          emailCount: campaign?.emailCount || 0,
          matchConfidence: cm.confidence,
          matchType: cm.matchType,
        };
      })
    );

    // Get reference data
    const referenceData = await this.getOfficeReferenceData(officeId);

    return {
      email: emailContent,
      matchedConstituent: constituentContext,
      constituentMatchConfidence: matchedConstituent?.matchScore,
      existingCases: caseContexts,
      matchedCampaigns: campaignContexts,
      referenceData,
    };
  }

  /**
   * Get reference data for an office (case types, categories, etc.)
   */
  async getOfficeReferenceData(officeId: OfficeId): Promise<OfficeReferenceDataDto> {
    try {
      const [caseTypes, categoryTypes, statusTypes, caseworkers] = await Promise.all([
        this.legacyApiClient.getCaseTypes(officeId),
        this.legacyApiClient.getCategoryTypes(officeId),
        this.legacyApiClient.getStatusTypes(officeId),
        this.legacyApiClient.getCaseworkers(officeId),
      ]);

      return {
        caseTypes: caseTypes.filter(ct => ct.isActive).map(ct => ({
          id: ct.id,
          name: ct.name,
        })),
        categoryTypes: categoryTypes.filter(ct => ct.isActive).map(ct => ({
          id: ct.id,
          name: ct.name,
        })),
        statusTypes: statusTypes.filter(st => st.isActive).map(st => ({
          id: st.id,
          name: st.name,
        })),
        caseworkers: caseworkers.filter(cw => cw.isActive).map(cw => ({
          id: cw.id,
          name: cw.name,
          email: cw.email,
        })),
        tags: [], // Tags are loaded from Supabase, not legacy
      };
    } catch (error) {
      console.error('Error fetching reference data:', error);
      return {
        caseTypes: [],
        categoryTypes: [],
        statusTypes: [],
        caseworkers: [],
        tags: [],
      };
    }
  }

  /**
   * Get LLM analysis for an email
   * Returns suggestions based on the full triage context
   */
  async analyzeEmail(
    officeId: OfficeId,
    email: Email,
    constituent: Constituent | null,
    existingCases: Case[],
    matchedCampaigns: CampaignMatchDto[]
  ): Promise<CaseSuggestionDto> {
    // Build constituent match DTO if we have one
    const constituentMatch: ConstituentMatchDto | null = constituent
      ? {
          constituent: {
            id: constituent.id!,
            officeId: constituent.officeId.toString(),
            externalId: constituent.externalId.toNumber(),
            firstName: constituent.firstName,
            lastName: constituent.lastName,
            fullName: constituent.fullName,
            title: constituent.title,
            organisationType: constituent.organisationType,
          },
          matchScore: 1.0,
          matchedOn: 'email',
        }
      : null;

    // Build the full triage context
    const context = await this.buildTriageContext(
      officeId,
      email,
      constituentMatch,
      existingCases,
      matchedCampaigns
    );

    // If LLM service is available, use it
    if (this.llmAnalysisService) {
      const suggestion = await this.llmAnalysisService.analyzeEmail(context);
      return this.convertToLegacySuggestion(suggestion);
    }

    // Otherwise, use rule-based suggestions
    return this.generateRuleBasedSuggestion(email, constituentMatch, existingCases, matchedCampaigns);
  }

  /**
   * Submit a triage decision
   */
  async submitTriageDecision(
    officeId: OfficeId,
    _userId: string,
    decision: TriageDecisionDto
  ): Promise<TriageResultDto> {
    const emailExternalId = ExternalId.fromTrusted(decision.emailExternalId);

    try {
      switch (decision.action) {
        case 'create_case': {
          const result = await this.createCaseFromTriage(officeId, decision);
          if (decision.markActioned) {
            await this.markEmailActioned(officeId, emailExternalId);
          }
          return {
            success: true,
            action: 'create_case',
            caseExternalId: result.caseExternalId,
            constituentExternalId: result.constituentExternalId,
          };
        }

        case 'add_to_case': {
          if (!decision.existingCaseId) {
            throw new Error('existingCaseId is required for add_to_case action');
          }
          await this.addEmailToCase(
            officeId,
            emailExternalId,
            ExternalId.fromTrusted(decision.existingCaseId)
          );
          if (decision.markActioned) {
            await this.markEmailActioned(officeId, emailExternalId);
          }
          return {
            success: true,
            action: 'add_to_case',
            caseExternalId: decision.existingCaseId,
          };
        }

        case 'ignore': {
          if (decision.markActioned) {
            await this.markEmailActioned(officeId, emailExternalId);
          }
          return {
            success: true,
            action: 'ignore',
          };
        }

        default:
          throw new Error(`Unknown triage action: ${decision.action}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        action: decision.action,
        error: message,
      };
    }
  }

  /**
   * Get the prompt text for LLM analysis (for debugging/testing)
   */
  async getTriagePrompt(
    officeId: OfficeId,
    email: Email,
    matchedConstituent: ConstituentMatchDto | null,
    existingCases: Case[],
    matchedCampaigns: CampaignMatchDto[]
  ): Promise<string> {
    const context = await this.buildTriageContext(
      officeId,
      email,
      matchedConstituent,
      existingCases,
      matchedCampaigns
    );
    return buildTriageContextPrompt(context);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE METHODS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Enrich an email with full triage context
   */
  private async enrichEmailForTriage(
    officeId: OfficeId,
    email: Email
  ): Promise<TriageEmailDto> {
    try {
      // 1. Match to constituent
      const constituentMatch = await this.matchConstituent(officeId, email);

      // 2. Match to campaigns
      const campaignMatches = await this.matchCampaigns(officeId, email);

      // 3. Get open cases for constituent
      let existingCases: CaseDto[] = [];
      if (constituentMatch?.constituent.id) {
        const cases = await this.getOpenCasesForConstituent(
          officeId,
          constituentMatch.constituent.id
        );
        existingCases = cases.map(c => this.caseToDto(c));
      }

      // 4. Generate rule-based suggestion (LLM would be called separately)
      const suggestion = await this.generateRuleBasedSuggestion(
        email,
        constituentMatch,
        existingCases.map(dto => this.dtoCaseToEntity(officeId, dto)),
        campaignMatches
      );

      return {
        id: email.id!,
        officeId: officeId.toString(),
        externalId: email.externalId.toNumber(),
        caseId: email.caseId,
        caseExternalId: email.caseExternalId?.toNumber(),
        constituentId: email.constituentId,
        constituentExternalId: email.constituentExternalId?.toNumber(),
        type: email.type,
        subject: email.subject,
        htmlBody: email.htmlBody,
        fromAddress: email.fromAddress,
        toAddresses: email.toAddresses,
        actioned: email.actioned,
        receivedAt: email.receivedAt?.toISOString(),
        lastSyncedAt: email.lastSyncedAt?.toISOString(),
        matchedConstituent: constituentMatch || undefined,
        existingCases,
        matchedCampaigns: campaignMatches,
        suggestion,
        processingStatus: 'ready',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        id: email.id!,
        officeId: officeId.toString(),
        externalId: email.externalId.toNumber(),
        type: email.type,
        subject: email.subject,
        fromAddress: email.fromAddress,
        actioned: email.actioned,
        receivedAt: email.receivedAt?.toISOString(),
        processingStatus: 'error',
        processingError: message,
      };
    }
  }

  /**
   * Generate rule-based suggestions when LLM is not available
   */
  private async generateRuleBasedSuggestion(
    email: Email,
    _constituentMatch: ConstituentMatchDto | null,
    existingCases: Case[],
    campaignMatches: CampaignMatchDto[]
  ): Promise<CaseSuggestionDto> {
    // Default suggestion
    const suggestion: CaseSuggestionDto = {
      urgency: 'medium',
      summary: email.subject || 'No subject',
    };

    // If there's a high-confidence campaign match, suggest that
    const firstCampaign = campaignMatches[0];
    if (firstCampaign && firstCampaign.confidence >= 0.8) {
      suggestion.summary = `Campaign: ${firstCampaign.campaignName}`;
      suggestion.urgency = 'low'; // Campaigns are usually lower urgency
    }

    // If there are existing cases, check for subject similarity
    if (existingCases.length > 0 && email.subject) {
      const subjectLower = email.subject.toLowerCase();
      for (const existingCase of existingCases) {
        if (existingCase.summary) {
          const summaryLower = existingCase.summary.toLowerCase();
          // Simple word overlap check
          const subjectWords = new Set(subjectLower.split(/\s+/).filter(w => w.length > 3));
          const summaryWords = summaryLower.split(/\s+/).filter(w => w.length > 3);
          const overlap = summaryWords.filter(w => subjectWords.has(w)).length;
          if (overlap >= 2) {
            suggestion.summary = `Related to: ${existingCase.summary}`;
            break;
          }
        }
      }
    }

    // Check for urgency keywords
    const urgentKeywords = ['urgent', 'emergency', 'asap', 'immediately', 'critical'];
    const subjectLower = (email.subject || '').toLowerCase();
    const bodyLower = (email.htmlBody || '').toLowerCase();
    for (const keyword of urgentKeywords) {
      if (subjectLower.includes(keyword) || bodyLower.includes(keyword)) {
        suggestion.urgency = 'high';
        break;
      }
    }

    return suggestion;
  }

  /**
   * Convert LLM suggestion to legacy format
   */
  private convertToLegacySuggestion(suggestion: TriageSuggestionDto): CaseSuggestionDto {
    return {
      suggestedCaseType: suggestion.suggestedCaseType,
      suggestedCategory: suggestion.suggestedCategory,
      urgency: suggestion.suggestedPriority === 'urgent' ? 'high' : suggestion.suggestedPriority,
      summary: suggestion.suggestedSummary || '',
      suggestedResponse: suggestion.suggestedResponse,
    };
  }

  /**
   * Create a new case from triage decision
   */
  private async createCaseFromTriage(
    officeId: OfficeId,
    decision: TriageDecisionDto
  ): Promise<{ caseExternalId: number; constituentExternalId: number }> {
    let constituentExternalId: number;

    // Create constituent if needed
    if (decision.newConstituent) {
      const constituent = await this.legacyApiClient.createConstituent(officeId, {
        firstName: decision.newConstituent.firstName,
        lastName: decision.newConstituent.lastName,
        title: decision.newConstituent.title,
      });
      constituentExternalId = constituent.id;

      // Add email contact if provided
      if (decision.newConstituent.email) {
        await this.legacyApiClient.addContactDetail(officeId, ExternalId.fromTrusted(constituent.id), {
          contactTypeID: 1, // Email type - should be configurable
          value: decision.newConstituent.email,
          source: 'triage',
        });
      }
    } else if (decision.existingConstituentId) {
      constituentExternalId = decision.existingConstituentId;
    } else {
      throw new Error('Either newConstituent or existingConstituentId is required');
    }

    // Create the case
    const newCase = await this.legacyApiClient.createCase(officeId, {
      constituentID: constituentExternalId,
      caseTypeID: decision.newCase?.caseTypeId,
      statusID: decision.newCase?.statusId,
      categoryTypeID: decision.newCase?.categoryTypeId,
      assignedToID: decision.newCase?.assignedToId,
      summary: decision.newCase?.summary,
    });

    return {
      caseExternalId: newCase.id,
      constituentExternalId,
    };
  }

  /**
   * Add email to existing case
   */
  private async addEmailToCase(
    officeId: OfficeId,
    emailExternalId: ExternalId,
    caseExternalId: ExternalId
  ): Promise<void> {
    // Update the email's case link in the repository
    const email = await this.emailRepository.findByExternalId(officeId, emailExternalId);
    if (email) {
      const updatedEmail = email.linkToCase(email.caseId || '', caseExternalId);
      await this.emailRepository.save(updatedEmail);
    }
  }

  /**
   * Mark email as actioned
   */
  private async markEmailActioned(
    officeId: OfficeId,
    emailExternalId: ExternalId
  ): Promise<void> {
    // Update in legacy API
    await this.legacyApiClient.markEmailActioned(officeId, emailExternalId);

    // Update in shadow database
    await this.emailRepository.markActioned(officeId, emailExternalId);
  }

  /**
   * Prefetch next emails for analysis (background)
   */
  private async prefetchNextEmails(
    officeId: OfficeId,
    currentIndex: number
  ): Promise<void> {
    const offset = currentIndex + 1;
    const limit = this.prefetchAhead;

    const nextEmails = await this.emailRepository.findUnactioned(officeId, { limit, offset });

    // Pre-process each email (will be cached by the calling code)
    await Promise.all(
      nextEmails.map(email => this.enrichEmailForTriage(officeId, email))
    );
  }

  /**
   * Extract plain text from HTML
   */
  private extractPlainTextFromHtml(html: string): string {
    if (!html) return '';

    // Simple HTML to text conversion
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Convert Case entity to DTO
   */
  private caseToDto(caseEntity: Case): CaseDto {
    return {
      id: caseEntity.id!,
      officeId: caseEntity.officeId.toString(),
      externalId: caseEntity.externalId.toNumber(),
      constituentId: caseEntity.constituentId,
      constituentExternalId: caseEntity.constituentExternalId?.toNumber(),
      caseTypeId: caseEntity.caseTypeId,
      statusId: caseEntity.statusId,
      categoryTypeId: caseEntity.categoryTypeId,
      assignedToId: caseEntity.assignedToId,
      summary: caseEntity.summary,
      reviewDate: caseEntity.reviewDate?.toISOString(),
      isOverdue: caseEntity.isReviewOverdue(),
      lastSyncedAt: caseEntity.lastSyncedAt?.toISOString(),
    };
  }

  /**
   * Convert CaseDto back to Case entity (for internal use)
   */
  private dtoCaseToEntity(officeId: OfficeId, dto: CaseDto): Case {
    return Case.fromDatabase({
      id: dto.id,
      officeId,
      externalId: ExternalId.fromTrusted(dto.externalId),
      constituentId: dto.constituentId,
      constituentExternalId: dto.constituentExternalId
        ? ExternalId.fromTrusted(dto.constituentExternalId)
        : undefined,
      caseTypeId: dto.caseTypeId,
      statusId: dto.statusId,
      categoryTypeId: dto.categoryTypeId,
      assignedToId: dto.assignedToId,
      summary: dto.summary,
      reviewDate: dto.reviewDate ? new Date(dto.reviewDate) : undefined,
      lastSyncedAt: dto.lastSyncedAt ? new Date(dto.lastSyncedAt) : undefined,
    });
  }
}
