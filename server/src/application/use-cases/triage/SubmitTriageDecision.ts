import { ILegacyApiClient, IEmailRepository } from '../../../domain/interfaces';
import { OfficeId, ExternalId } from '../../../domain/value-objects';
import { TriageDecisionDto, TriageResultDto } from '../../dtos';
import { IEventEmitter } from '../../services/SyncService';
import {
  TriageDecisionMadeEvent,
  CaseCreatedFromTriageEvent,
  EmailAddedToCaseEvent,
  EmailIgnoredEvent,
} from '../../../domain/events';

/**
 * Use Case: SubmitTriageDecision
 *
 * Processes a user's triage decision and updates both
 * the legacy system and shadow database.
 */
export class SubmitTriageDecision {
  constructor(
    private readonly legacyApiClient: ILegacyApiClient,
    private readonly emailRepository: IEmailRepository,
    private readonly eventEmitter: IEventEmitter
  ) {}

  /**
   * Execute the use case
   */
  async execute(
    officeId: OfficeId,
    userId: string,
    decision: TriageDecisionDto
  ): Promise<TriageResultDto> {
    const emailExternalId = ExternalId.fromTrusted(decision.emailExternalId);

    try {
      switch (decision.action) {
        case 'create_case':
          return this.handleCreateCase(officeId, userId, emailExternalId, decision);

        case 'add_to_case':
          return this.handleAddToCase(officeId, userId, emailExternalId, decision);

        case 'ignore':
          return this.handleIgnore(officeId, userId, emailExternalId, decision);

        default:
          throw new Error(`Unknown action: ${decision.action}`);
      }
    } catch (error) {
      return {
        success: false,
        action: decision.action,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Handle 'create_case' action
   */
  private async handleCreateCase(
    officeId: OfficeId,
    userId: string,
    emailExternalId: ExternalId,
    decision: TriageDecisionDto
  ): Promise<TriageResultDto> {
    let constituentExternalId: number;

    // 1. Create constituent if new
    if (decision.newConstituent) {
      const newConstituent = await this.legacyApiClient.createConstituent(officeId, {
        firstName: decision.newConstituent.firstName,
        lastName: decision.newConstituent.lastName,
        title: decision.newConstituent.title,
      });
      constituentExternalId = newConstituent.id;

      // Add email as contact detail
      if (decision.newConstituent.email) {
        await this.legacyApiClient.addContactDetail(
          officeId,
          ExternalId.fromTrusted(newConstituent.id),
          {
            contactTypeID: 1, // Email type (should be configurable)
            value: decision.newConstituent.email,
            source: 'email_triage',
          }
        );
      }
    } else if (decision.existingConstituentId) {
      constituentExternalId = decision.existingConstituentId;
    } else {
      throw new Error('Either newConstituent or existingConstituentId must be provided');
    }

    // 2. Create case
    const newCase = await this.legacyApiClient.createCase(officeId, {
      constituentID: constituentExternalId,
      caseTypeID: decision.newCase?.caseTypeId,
      statusID: decision.newCase?.statusId,
      categoryTypeID: decision.newCase?.categoryTypeId,
      assignedToID: decision.newCase?.assignedToId,
      summary: decision.newCase?.summary,
    });

    // 3. Mark email as actioned
    if (decision.markActioned) {
      await this.legacyApiClient.markEmailActioned(officeId, emailExternalId);
      await this.emailRepository.markActioned(officeId, emailExternalId);
    }

    // 4. Emit events
    this.eventEmitter.emit(
      new TriageDecisionMadeEvent(
        officeId,
        emailExternalId,
        'create_case',
        userId,
        ExternalId.fromTrusted(newCase.id),
        decision.newConstituent ? ExternalId.fromTrusted(constituentExternalId) : undefined
      )
    );

    this.eventEmitter.emit(
      new CaseCreatedFromTriageEvent(
        officeId,
        emailExternalId,
        ExternalId.fromTrusted(newCase.id),
        ExternalId.fromTrusted(constituentExternalId)
      )
    );

    return {
      success: true,
      action: 'create_case',
      caseExternalId: newCase.id,
      constituentExternalId,
    };
  }

  /**
   * Handle 'add_to_case' action
   */
  private async handleAddToCase(
    officeId: OfficeId,
    userId: string,
    emailExternalId: ExternalId,
    decision: TriageDecisionDto
  ): Promise<TriageResultDto> {
    if (!decision.existingCaseId) {
      throw new Error('existingCaseId is required for add_to_case action');
    }

    const caseExternalId = ExternalId.fromTrusted(decision.existingCaseId);

    // 1. Update case to link email (if applicable in legacy system)
    // Note: The legacy system may not have direct email-to-case linking
    // This might involve creating a casenote instead

    // 2. Mark email as actioned
    if (decision.markActioned) {
      await this.legacyApiClient.markEmailActioned(officeId, emailExternalId);
      await this.emailRepository.markActioned(officeId, emailExternalId);
    }

    // 3. Emit events
    this.eventEmitter.emit(
      new TriageDecisionMadeEvent(
        officeId,
        emailExternalId,
        'add_to_case',
        userId,
        caseExternalId
      )
    );

    this.eventEmitter.emit(
      new EmailAddedToCaseEvent(officeId, emailExternalId, caseExternalId)
    );

    return {
      success: true,
      action: 'add_to_case',
      caseExternalId: decision.existingCaseId,
    };
  }

  /**
   * Handle 'ignore' action
   */
  private async handleIgnore(
    officeId: OfficeId,
    userId: string,
    emailExternalId: ExternalId,
    decision: TriageDecisionDto
  ): Promise<TriageResultDto> {
    // 1. Mark email as actioned
    if (decision.markActioned) {
      await this.legacyApiClient.markEmailActioned(officeId, emailExternalId);
      await this.emailRepository.markActioned(officeId, emailExternalId);
    }

    // 2. Emit events
    this.eventEmitter.emit(
      new TriageDecisionMadeEvent(officeId, emailExternalId, 'ignore', userId)
    );

    this.eventEmitter.emit(new EmailIgnoredEvent(officeId, emailExternalId));

    return {
      success: true,
      action: 'ignore',
    };
  }
}
