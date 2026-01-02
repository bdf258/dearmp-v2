/**
 * Triage Job Handlers
 *
 * Handles email triage pipeline jobs including:
 * - Processing emails to find constituent matches
 * - LLM-powered suggestion generation (with Gemini)
 * - Batch prefetching for UI performance
 * - Submitting triage decisions
 */

import PgBoss from 'pg-boss';
import { OfficeId, ExternalId } from '../../../domain/value-objects';
import { ILegacyApiClient } from '../../../domain/interfaces';
import { IConstituentRepository, ICaseRepository, IEmailRepository } from '../../../domain/interfaces';
import { ILLMAnalysisService } from '../../../application/services';
import {
  TriageContextDto,
  TriageSuggestionDto,
  EmailContentForAnalysis,
  ConstituentContextDto,
  CaseContextDto,
  OfficeReferenceDataDto,
} from '../../../application/dtos';
import {
  JobNames,
  TriageProcessEmailJobData,
  TriageSubmitDecisionJobData,
  TriageBatchPrefetchJobData,
  TriageJobResult,
} from '../types';
import { PgBossClient } from '../PgBossClient';

export interface TriageJobHandlerDependencies {
  pgBossClient: PgBossClient;
  legacyApiClient: ILegacyApiClient;
  constituentRepository: IConstituentRepository;
  caseRepository: ICaseRepository;
  emailRepository: IEmailRepository;
  triageCacheRepository: ITriageCacheRepository;
  llmAnalysisService?: ILLMAnalysisService;
}

/**
 * Cache for storing pre-processed triage suggestions
 */
export interface ITriageCacheRepository {
  set(
    emailId: string,
    data: {
      matchedConstituent?: { id: string; externalId: number; name: string };
      matchedCases?: Array<{ id: string; externalId: number; summary: string }>;
      suggestion?: {
        action: string;
        confidence: number;
        reasoning: string;
      };
      processedAt: Date;
    }
  ): Promise<void>;

  get(emailId: string): Promise<{
    matchedConstituent?: { id: string; externalId: number; name: string };
    matchedCases?: Array<{ id: string; externalId: number; summary: string }>;
    suggestion?: {
      action: string;
      confidence: number;
      reasoning: string;
    };
    processedAt: Date;
  } | null>;

  delete(emailId: string): Promise<void>;
}

/**
 * Handler for email triage jobs
 */
export class TriageJobHandler {
  private readonly client: PgBossClient;
  private readonly legacyApi: ILegacyApiClient;
  private readonly constituentRepo: IConstituentRepository;
  private readonly caseRepo: ICaseRepository;
  private readonly emailRepo: IEmailRepository;
  private readonly triageCache: ITriageCacheRepository;
  private readonly llmService?: ILLMAnalysisService;

  constructor(deps: TriageJobHandlerDependencies) {
    this.client = deps.pgBossClient;
    this.legacyApi = deps.legacyApiClient;
    this.constituentRepo = deps.constituentRepository;
    this.caseRepo = deps.caseRepository;
    this.emailRepo = deps.emailRepository;
    this.triageCache = deps.triageCacheRepository;
    this.llmService = deps.llmAnalysisService;

    if (this.llmService) {
      console.log('[TriageJobHandler] LLM analysis service enabled');
    } else {
      console.log('[TriageJobHandler] LLM analysis service not configured, using rule-based suggestions');
    }
  }

  /**
   * Register all triage job handlers
   */
  async register(): Promise<void> {
    await this.client.work<TriageProcessEmailJobData>(
      JobNames.TRIAGE_PROCESS_EMAIL,
      this.handleProcessEmail.bind(this)
    );

    await this.client.work<TriageSubmitDecisionJobData>(
      JobNames.TRIAGE_SUBMIT_DECISION,
      this.handleSubmitDecision.bind(this)
    );

    await this.client.work<TriageBatchPrefetchJobData>(
      JobNames.TRIAGE_BATCH_PREFETCH,
      this.handleBatchPrefetch.bind(this)
    );

    console.log('[TriageJobHandler] Registered all triage job handlers');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PROCESS EMAIL
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Process a single email to find constituent matches and generate suggestions
   */
  private async handleProcessEmail(
    job: PgBoss.Job<TriageProcessEmailJobData>
  ): Promise<void> {
    const { officeId, emailId, emailExternalId, fromAddress, subject } = job.data;
    const startTime = Date.now();
    const office = OfficeId.create(officeId);

    console.log(`[TriageProcessEmail] Processing email ${emailId} from: ${fromAddress}`);

    const result: TriageJobResult = {
      success: false,
      emailId,
      durationMs: 0,
    };

    try {
      // Step 1: Fetch the full email from repository
      const email = await this.emailRepo.findByExternalId(office, ExternalId.create(emailExternalId));
      const emailBody = email?.htmlBody || '';

      // Step 2: Find constituent matches via legacy API
      const constituentMatches = await this.legacyApi.findConstituentMatches(
        office,
        { email: fromAddress }
      );

      let matchedConstituent: TriageJobResult['matchedConstituent'];
      let matchedCases: Array<{ id: string; externalId: number; summary: string }> = [];
      let constituentContext: ConstituentContextDto | undefined;

      if (constituentMatches.length > 0) {
        const bestMatch = constituentMatches[0];

        // Look up or create constituent in shadow DB
        const constituent = await this.constituentRepo.findByExternalId(
          office,
          ExternalId.create(bestMatch.id)
        );

        if (constituent) {
          matchedConstituent = {
            id: constituent.id!,
            externalId: bestMatch.id,
            name: `${bestMatch.firstName} ${bestMatch.lastName}`.trim(),
          };

          // Step 3: Find open cases for this constituent
          const cases = await this.caseRepo.findByConstituentId(
            office,
            constituent.id!,
            { openOnly: true }
          );

          matchedCases = cases.map((c) => ({
            id: c.id!,
            externalId: c.externalId?.toNumber() ?? 0,
            summary: c.summary ?? 'No summary',
          }));

          // Build constituent context for LLM
          constituentContext = {
            id: constituent.id!,
            externalId: bestMatch.id,
            fullName: `${bestMatch.firstName} ${bestMatch.lastName}`.trim(),
            title: constituent.title,
            isOrganisation: !!constituent.organisationType,
            previousCaseCount: matchedCases.length,
            lastContactDate: constituent.lastSyncedAt?.toISOString(),
          };
        }

        result.matchedConstituent = matchedConstituent;
        result.matchedCase = matchedCases[0]; // Primary match
      }

      // Step 4: Generate triage suggestion
      let suggestion: TriageJobResult['suggestion'];

      if (this.llmService) {
        // Use LLM for intelligent suggestion generation
        console.log(`[TriageProcessEmail] Using LLM analysis for ${emailId}`);

        try {
          const llmSuggestion = await this.generateLLMSuggestion(
            office,
            {
              subject: subject || '',
              body: this.extractPlainTextFromHtml(emailBody),
              senderEmail: fromAddress,
              receivedAt: email?.receivedAt?.toISOString() || new Date().toISOString(),
            },
            constituentContext,
            matchedCases
          );

          suggestion = {
            action: this.mapRecommendedAction(llmSuggestion.recommendedAction),
            confidence: llmSuggestion.actionConfidence,
            reasoning: llmSuggestion.actionReasoning || llmSuggestion.classificationReasoning || '',
          };

          console.log(`[TriageProcessEmail] LLM suggested: ${suggestion.action} (${Math.round(suggestion.confidence * 100)}%)`);
        } catch (llmError) {
          console.error(`[TriageProcessEmail] LLM analysis failed, falling back to rule-based:`, llmError);
          suggestion = this.generateRuleBasedSuggestion(
            fromAddress,
            subject,
            matchedConstituent,
            matchedCases
          );
        }
      } else {
        // Use rule-based suggestion
        suggestion = this.generateRuleBasedSuggestion(
          fromAddress,
          subject,
          matchedConstituent,
          matchedCases
        );
      }

      result.suggestion = suggestion;

      // Step 5: Cache the result for quick UI access
      await this.triageCache.set(emailId, {
        matchedConstituent,
        matchedCases,
        suggestion,
        processedAt: new Date(),
      });

      result.success = true;
      result.durationMs = Date.now() - startTime;

      console.log(
        `[TriageProcessEmail] Completed processing ${emailId}: ` +
          `matched=${!!matchedConstituent}, cases=${matchedCases.length}, ` +
          `suggestion=${suggestion.action} in ${result.durationMs}ms`
      );
    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown error';
      result.durationMs = Date.now() - startTime;

      console.error(`[TriageProcessEmail] Failed to process ${emailId}:`, error);
      throw error;
    }
  }

  /**
   * Generate suggestion using LLM service
   */
  private async generateLLMSuggestion(
    office: OfficeId,
    emailContent: EmailContentForAnalysis,
    constituentContext: ConstituentContextDto | undefined,
    matchedCases: Array<{ id: string; externalId: number; summary: string }>
  ): Promise<TriageSuggestionDto> {
    if (!this.llmService) {
      throw new Error('LLM service not available');
    }

    // Build case contexts
    const caseContexts: CaseContextDto[] = matchedCases.map((c) => ({
      id: c.id,
      externalId: c.externalId,
      summary: c.summary,
      createdAt: new Date().toISOString(), // Would need actual data
    }));

    // Get reference data from legacy API
    let referenceData: OfficeReferenceDataDto;
    try {
      const [caseTypes, categoryTypes, statusTypes, caseworkers] = await Promise.all([
        this.legacyApi.getCaseTypes(office),
        this.legacyApi.getCategoryTypes(office),
        this.legacyApi.getStatusTypes(office),
        this.legacyApi.getCaseworkers(office),
      ]);

      referenceData = {
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
        tags: [], // Tags would come from Supabase
      };
    } catch (refError) {
      console.warn('[TriageProcessEmail] Failed to load reference data:', refError);
      referenceData = {
        caseTypes: [],
        categoryTypes: [],
        statusTypes: [],
        caseworkers: [],
        tags: [],
      };
    }

    // Build full triage context
    const triageContext: TriageContextDto = {
      email: emailContent,
      matchedConstituent: constituentContext,
      constituentMatchConfidence: constituentContext ? 1.0 : undefined,
      existingCases: caseContexts,
      matchedCampaigns: [], // Would need campaign matching
      referenceData,
    };

    // Call LLM service
    return this.llmService.analyzeEmail(triageContext);
  }

  /**
   * Map LLM recommended action to job result action
   */
  private mapRecommendedAction(action: TriageSuggestionDto['recommendedAction']): string {
    switch (action) {
      case 'create_case':
        return 'create_new';
      case 'add_to_case':
        return 'add_to_case';
      case 'assign_campaign':
        return 'assign_campaign';
      case 'ignore':
        return 'ignore';
      default:
        return 'create_new';
    }
  }

  /**
   * Extract plain text from HTML
   */
  private extractPlainTextFromHtml(html: string): string {
    if (!html) return '';

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
   * Generate a rule-based triage suggestion when LLM is not available
   */
  private generateRuleBasedSuggestion(
    fromAddress: string,
    subject: string | undefined,
    matchedConstituent: TriageJobResult['matchedConstituent'],
    matchedCases: Array<{ id: string; externalId: number; summary: string }>
  ): NonNullable<TriageJobResult['suggestion']> {
    // Simple rule-based suggestion (fallback when LLM unavailable)

    if (!matchedConstituent) {
      return {
        action: 'create_new',
        confidence: 0.8,
        reasoning: 'No matching constituent found. Suggest creating new constituent and case.',
      };
    }

    if (matchedCases.length > 0) {
      // Check if subject suggests this is related to an existing case
      const subjectLower = (subject ?? '').toLowerCase();
      const relatedCase = matchedCases.find(
        (c) =>
          c.summary.toLowerCase().includes(subjectLower) ||
          subjectLower.includes(c.summary.toLowerCase().substring(0, 20))
      );

      if (relatedCase) {
        return {
          action: 'add_to_case',
          confidence: 0.9,
          reasoning: `Subject appears related to existing case: "${relatedCase.summary}"`,
        };
      }

      return {
        action: 'add_to_case',
        confidence: 0.6,
        reasoning: `Constituent has ${matchedCases.length} open case(s). May be related.`,
      };
    }

    return {
      action: 'create_new',
      confidence: 0.85,
      reasoning: 'Known constituent with no open cases. Suggest creating new case.',
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SUBMIT DECISION
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Submit a user's triage decision
   */
  private async handleSubmitDecision(
    job: PgBoss.Job<TriageSubmitDecisionJobData>
  ): Promise<void> {
    const { officeId, emailId, emailExternalId, decision } = job.data;
    const startTime = Date.now();
    const office = OfficeId.create(officeId);

    console.log(
      `[TriageSubmitDecision] Processing decision for email ${emailId}: ${decision.action}`
    );

    try {
      switch (decision.action) {
        case 'create_new':
          await this.handleCreateNew(office, emailId, emailExternalId, decision);
          break;

        case 'add_to_case':
          await this.handleAddToCase(office, emailId, emailExternalId, decision);
          break;

        case 'ignore':
          await this.handleIgnore(office, emailId, emailExternalId, decision);
          break;
      }

      // Clear the cache entry
      await this.triageCache.delete(emailId);

      console.log(
        `[TriageSubmitDecision] Completed ${decision.action} for ${emailId} ` +
          `in ${Date.now() - startTime}ms`
      );
    } catch (error) {
      console.error(`[TriageSubmitDecision] Failed for ${emailId}:`, error);
      throw error;
    }
  }

  /**
   * Create new constituent and case
   */
  private async handleCreateNew(
    office: OfficeId,
    emailId: string,
    emailExternalId: number,
    decision: TriageSubmitDecisionJobData['decision']
  ): Promise<void> {
    let constituentExternalId: number | undefined;

    // Create new constituent if needed
    if (decision.newConstituent) {
      const legacyConstituent = await this.legacyApi.createConstituent(office, {
        firstName: decision.newConstituent.firstName,
        lastName: decision.newConstituent.lastName,
      });

      constituentExternalId = legacyConstituent.id;

      // Add email as contact detail
      await this.legacyApi.addContactDetail(
        office,
        ExternalId.create(legacyConstituent.id),
        {
          contactTypeID: 1, // Email type - would be looked up in real implementation
          value: decision.newConstituent.email,
          source: 'email_triage',
        }
      );
    } else if (decision.constituentId) {
      // Use existing constituent
      const constituent = await this.constituentRepo.findById(office, decision.constituentId);
      constituentExternalId = constituent?.externalId?.toNumber();
    }

    if (!constituentExternalId) {
      throw new Error('No constituent ID available for case creation');
    }

    // Create new case if needed
    if (decision.newCase) {
      await this.legacyApi.createCase(office, {
        constituentID: constituentExternalId,
        caseTypeID: decision.newCase.caseTypeId,
        statusID: decision.newCase.statusId,
        summary: decision.newCase.summary,
      });
    }

    // Mark email as actioned
    if (decision.markActioned) {
      await this.legacyApi.markEmailActioned(office, ExternalId.create(emailExternalId));
    }
  }

  /**
   * Add email to existing case
   */
  private async handleAddToCase(
    office: OfficeId,
    emailId: string,
    emailExternalId: number,
    decision: TriageSubmitDecisionJobData['decision']
  ): Promise<void> {
    if (!decision.caseId) {
      throw new Error('Case ID required for add_to_case action');
    }

    // Get case external ID
    const caseEntity = await this.caseRepo.findById(office, decision.caseId);
    if (!caseEntity?.externalId) {
      throw new Error(`Case ${decision.caseId} has no external ID`);
    }

    // Link the email to the case by creating a casenote of type 'email'
    await this.legacyApi.linkEmailToCase(
      office,
      caseEntity.externalId.toNumber(),
      emailExternalId
    );

    console.log(
      `[TriageSubmitDecision] Linked email ${emailExternalId} to case ${caseEntity.externalId.toNumber()}`
    );

    // Mark email as actioned
    if (decision.markActioned) {
      await this.legacyApi.markEmailActioned(office, ExternalId.create(emailExternalId));
    }
  }

  /**
   * Ignore email (just mark as actioned)
   */
  private async handleIgnore(
    office: OfficeId,
    emailId: string,
    emailExternalId: number,
    decision: TriageSubmitDecisionJobData['decision']
  ): Promise<void> {
    if (decision.markActioned) {
      await this.legacyApi.markEmailActioned(office, ExternalId.create(emailExternalId));
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BATCH PREFETCH
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Prefetch and process multiple emails in batch
   */
  private async handleBatchPrefetch(
    job: PgBoss.Job<TriageBatchPrefetchJobData>
  ): Promise<void> {
    const { officeId, emailIds, prefetchAhead } = job.data;
    const startTime = Date.now();

    console.log(
      `[TriageBatchPrefetch] Prefetching ${emailIds.length} emails for office: ${officeId}`
    );

    try {
      // Check which emails are already cached
      const uncachedIds: string[] = [];
      for (const emailId of emailIds.slice(0, prefetchAhead)) {
        const cached = await this.triageCache.get(emailId);
        if (!cached) {
          uncachedIds.push(emailId);
        }
      }

      if (uncachedIds.length === 0) {
        console.log('[TriageBatchPrefetch] All emails already cached');
        return;
      }

      // Schedule processing jobs for uncached emails
      const jobs = uncachedIds.map((emailId) => ({
        name: JobNames.TRIAGE_PROCESS_EMAIL,
        data: {
          type: JobNames.TRIAGE_PROCESS_EMAIL,
          officeId,
          emailId,
          emailExternalId: 0, // Would be looked up
          fromAddress: '', // Would be looked up
          correlationId: job.data.correlationId,
        } as TriageProcessEmailJobData,
      }));

      await this.client.sendBatch(jobs);

      console.log(
        `[TriageBatchPrefetch] Scheduled ${uncachedIds.length} email processing jobs ` +
          `in ${Date.now() - startTime}ms`
      );
    } catch (error) {
      console.error(`[TriageBatchPrefetch] Failed:`, error);
      throw error;
    }
  }
}
