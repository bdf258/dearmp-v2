import { TriageService } from '../../application/services';
import { OfficeId, ExternalId } from '../../domain/value-objects';
import { TriageEmailDto, TriageResultDto, TriageDecisionDto } from '../../application/dtos';

/**
 * Job data for triage prefetch
 */
export interface TriagePrefetchJobData {
  officeId: string;
  emailExternalIds: number[];
}

/**
 * Job data for triage decision processing
 */
export interface TriageDecisionJobData {
  officeId: string;
  userId: string;
  decision: TriageDecisionDto;
}

/**
 * Worker: TriageWorker
 *
 * Handles background triage operations including:
 * - Prefetching email analysis
 * - Processing triage decisions
 */
export class TriageWorker {
  constructor(private readonly triageService: TriageService) {}

  /**
   * Prefetch analysis for a batch of emails
   */
  async processPrefetchJob(data: TriagePrefetchJobData): Promise<TriageEmailDto[]> {
    const officeId = OfficeId.fromTrusted(data.officeId);
    const results: TriageEmailDto[] = [];

    console.log(`[TriageWorker] Prefetching ${data.emailExternalIds.length} emails for office ${data.officeId}`);

    for (const emailId of data.emailExternalIds) {
      try {
        const result = await this.triageService.processEmailForTriage(
          officeId,
          ExternalId.fromTrusted(emailId)
        );
        results.push(result);
      } catch (error) {
        console.error(`[TriageWorker] Failed to prefetch email ${emailId}:`, error);
        // Continue with other emails
      }
    }

    console.log(`[TriageWorker] Prefetched ${results.length}/${data.emailExternalIds.length} emails`);
    return results;
  }

  /**
   * Process a triage decision
   */
  async processDecisionJob(data: TriageDecisionJobData): Promise<TriageResultDto> {
    const officeId = OfficeId.fromTrusted(data.officeId);

    console.log(
      `[TriageWorker] Processing ${data.decision.action} decision for email ${data.decision.emailExternalId}`
    );

    try {
      const result = await this.triageService.submitTriageDecision(
        officeId,
        data.userId,
        data.decision
      );

      console.log(
        `[TriageWorker] Completed ${data.decision.action} for email ${data.decision.emailExternalId}`
      );
      return result;
    } catch (error) {
      console.error(`[TriageWorker] Failed to process decision:`, error);
      return {
        success: false,
        action: data.decision.action,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Batch process multiple triage decisions
   * Useful for when user approves multiple emails at once
   */
  async processBatchDecisions(
    officeId: OfficeId,
    userId: string,
    decisions: TriageDecisionDto[]
  ): Promise<TriageResultDto[]> {
    const results: TriageResultDto[] = [];

    for (const decision of decisions) {
      const result = await this.processDecisionJob({
        officeId: officeId.toString(),
        userId,
        decision,
      });
      results.push(result);
    }

    return results;
  }
}
