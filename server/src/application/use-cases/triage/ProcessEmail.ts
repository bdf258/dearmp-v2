import {
  IConstituentRepository,
  ICaseRepository,
  IEmailRepository,
  ILegacyApiClient,
} from '../../../domain/interfaces';
import { OfficeId, ExternalId } from '../../../domain/value-objects';
import { Email, Constituent, Case } from '../../../domain/entities';
import { TriageEmailDto, ConstituentMatchDto, CaseSuggestionDto, CaseDto } from '../../dtos';
import { ILLMAnalysisService } from '../../services/TriageService';

/**
 * Use Case: ProcessEmail
 *
 * Processes a single email for triage, including:
 * - Fetching the email
 * - Matching to a constituent
 * - Finding existing cases
 * - Running LLM analysis
 */
export class ProcessEmail {
  constructor(
    private readonly legacyApiClient: ILegacyApiClient,
    private readonly constituentRepository: IConstituentRepository,
    private readonly caseRepository: ICaseRepository,
    private readonly emailRepository: IEmailRepository,
    private readonly llmAnalysisService: ILLMAnalysisService
  ) {}

  /**
   * Execute the use case
   */
  async execute(officeId: OfficeId, emailExternalId: ExternalId): Promise<TriageEmailDto> {
    // 1. Fetch the email
    const email = await this.fetchEmail(officeId, emailExternalId);
    if (!email) {
      throw new Error(`Email not found: ${emailExternalId.toNumber()}`);
    }

    // 2. Match to constituent
    const constituentMatch = await this.matchConstituent(officeId, email);

    // 3. Find existing cases for constituent
    let existingCases: CaseDto[] = [];
    if (constituentMatch) {
      existingCases = await this.findExistingCases(officeId, constituentMatch.constituent.id);
    }

    // 4. Run LLM analysis
    const suggestion = await this.runLLMAnalysis(
      officeId,
      email,
      constituentMatch?.constituent,
      existingCases
    );

    // 5. Build and return TriageEmailDto
    return this.buildTriageEmailDto(email, constituentMatch, existingCases, suggestion);
  }

  /**
   * Fetch email from repository or legacy API
   */
  private async fetchEmail(officeId: OfficeId, externalId: ExternalId): Promise<Email | null> {
    // Try local repository first
    const localEmail = await this.emailRepository.findByExternalId(officeId, externalId);
    if (localEmail) {
      return localEmail;
    }

    // Fetch from legacy API and sync
    const legacyEmail = await this.legacyApiClient.getEmail(officeId, externalId);
    if (!legacyEmail) {
      return null;
    }

    // Create and save email entity
    const email = Email.fromLegacy(officeId, externalId, {
      caseExternalId: legacyEmail.caseID,
      constituentExternalId: legacyEmail.constituentID,
      type: legacyEmail.type,
      subject: legacyEmail.subject,
      htmlBody: legacyEmail.htmlBody,
      fromAddress: legacyEmail.from,
      toAddresses: legacyEmail.to,
      ccAddresses: legacyEmail.cc,
      bccAddresses: legacyEmail.bcc,
      actioned: legacyEmail.actioned,
      assignedToExternalId: legacyEmail.assignedToID,
      scheduledAt: legacyEmail.scheduledAt,
      sentAt: legacyEmail.sentAt,
      receivedAt: legacyEmail.receivedAt,
    });

    return this.emailRepository.save(email);
  }

  /**
   * Match email to a constituent
   */
  private async matchConstituent(
    officeId: OfficeId,
    email: Email
  ): Promise<ConstituentMatchDto | null> {
    if (!email.fromAddress) {
      return null;
    }

    // Try local repository first (by email address)
    const localMatches = await this.constituentRepository.findByEmail(officeId, email.fromAddress);
    if (localMatches.length > 0) {
      return {
        constituent: this.constituentToDto(localMatches[0]),
        matchScore: 1.0,
        matchedOn: 'email',
      };
    }

    // Try legacy API for constituent matching
    const legacyMatches = await this.legacyApiClient.findConstituentMatches(
      officeId,
      { email: email.fromAddress }
    );

    if (legacyMatches.length > 0) {
      // Sync the matched constituent to local repository
      const topMatch = legacyMatches[0];
      const constituent = Constituent.fromLegacy(
        officeId,
        ExternalId.fromTrusted(topMatch.id),
        {
          firstName: topMatch.firstName,
          lastName: topMatch.lastName,
        }
      );
      const saved = await this.constituentRepository.save(constituent);

      return {
        constituent: this.constituentToDto(saved),
        matchScore: topMatch.matchScore,
        matchedOn: 'email',
      };
    }

    return null;
  }

  /**
   * Find existing open cases for a constituent
   */
  private async findExistingCases(officeId: OfficeId, constituentId: string): Promise<CaseDto[]> {
    const cases = await this.caseRepository.findOpenCasesForConstituent(officeId, constituentId);
    return cases.map(c => this.caseToDto(c));
  }

  /**
   * Run LLM analysis on the email
   */
  private async runLLMAnalysis(
    officeId: OfficeId,
    email: Email,
    constituent: { id: string } | undefined,
    existingCases: CaseDto[]
  ): Promise<CaseSuggestionDto> {
    // Convert DTOs back to domain entities for LLM analysis
    // In a real implementation, you'd fetch the full entities
    const constituentEntity = constituent
      ? await this.constituentRepository.findById(officeId, constituent.id)
      : null;

    const caseEntities = await Promise.all(
      existingCases.map(c => this.caseRepository.findById(officeId, c.id))
    );

    return this.llmAnalysisService.analyzeEmail(
      email,
      constituentEntity,
      caseEntities.filter((c): c is Case => c !== null)
    );
  }

  /**
   * Build the final TriageEmailDto
   */
  private buildTriageEmailDto(
    email: Email,
    constituentMatch: ConstituentMatchDto | null,
    existingCases: CaseDto[],
    suggestion: CaseSuggestionDto
  ): TriageEmailDto {
    return {
      id: email.id ?? '',
      officeId: email.officeId.toString(),
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
      matchedConstituent: constituentMatch ?? undefined,
      existingCases,
      suggestion,
      processingStatus: 'ready',
    };
  }

  /**
   * Convert Constituent entity to DTO
   */
  private constituentToDto(constituent: Constituent): import('../../dtos').ConstituentDto {
    return {
      id: constituent.id ?? '',
      officeId: constituent.officeId.toString(),
      externalId: constituent.externalId.toNumber(),
      firstName: constituent.firstName,
      lastName: constituent.lastName,
      fullName: constituent.fullName,
      title: constituent.title,
      organisationType: constituent.organisationType,
      geocodeLat: constituent.geocodeLat,
      geocodeLng: constituent.geocodeLng,
      lastSyncedAt: constituent.lastSyncedAt?.toISOString(),
    };
  }

  /**
   * Convert Case entity to DTO
   */
  private caseToDto(caseEntity: Case): CaseDto {
    return {
      id: caseEntity.id ?? '',
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
}
