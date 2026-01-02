import { OfficeId, ExternalId } from '../value-objects';
import { DomainEvent } from './SyncEvent';

/**
 * Triage decision types
 */
export type TriageAction = 'create_case' | 'add_to_case' | 'ignore';

/**
 * Event: Email Received for Triage
 *
 * Emitted when a new email is ready for triage processing.
 */
export class EmailReceivedForTriageEvent implements DomainEvent {
  readonly eventType = 'triage.email_received';
  readonly occurredAt: Date;

  constructor(
    readonly officeId: OfficeId,
    readonly emailExternalId: ExternalId,
    readonly fromAddress: string,
    readonly subject: string
  ) {
    this.occurredAt = new Date();
  }
}

/**
 * Event: Constituent Matched
 *
 * Emitted when an email is matched to a constituent.
 */
export class ConstituentMatchedEvent implements DomainEvent {
  readonly eventType = 'triage.constituent_matched';
  readonly occurredAt: Date;

  constructor(
    readonly officeId: OfficeId,
    readonly emailExternalId: ExternalId,
    readonly constituentExternalId: ExternalId,
    readonly matchConfidence: number
  ) {
    this.occurredAt = new Date();
  }
}

/**
 * Event: LLM Analysis Completed
 *
 * Emitted when LLM analysis of an email is complete.
 */
export class LLMAnalysisCompletedEvent implements DomainEvent {
  readonly eventType = 'triage.llm_analysis_completed';
  readonly occurredAt: Date;

  constructor(
    readonly officeId: OfficeId,
    readonly emailExternalId: ExternalId,
    readonly suggestedCaseType?: number,
    readonly suggestedCategory?: number,
    readonly urgency?: 'low' | 'medium' | 'high',
    readonly summary?: string
  ) {
    this.occurredAt = new Date();
  }
}

/**
 * Event: Triage Decision Made
 *
 * Emitted when a user makes a triage decision on an email.
 */
export class TriageDecisionMadeEvent implements DomainEvent {
  readonly eventType = 'triage.decision_made';
  readonly occurredAt: Date;

  constructor(
    readonly officeId: OfficeId,
    readonly emailExternalId: ExternalId,
    readonly action: TriageAction,
    readonly userId: string,
    readonly caseExternalId?: ExternalId,
    readonly newConstituentId?: ExternalId
  ) {
    this.occurredAt = new Date();
  }
}

/**
 * Event: Case Created from Triage
 *
 * Emitted when a new case is created during triage.
 */
export class CaseCreatedFromTriageEvent implements DomainEvent {
  readonly eventType = 'triage.case_created';
  readonly occurredAt: Date;

  constructor(
    readonly officeId: OfficeId,
    readonly emailExternalId: ExternalId,
    readonly caseExternalId: ExternalId,
    readonly constituentExternalId: ExternalId
  ) {
    this.occurredAt = new Date();
  }
}

/**
 * Event: Email Added to Case
 *
 * Emitted when an email is linked to an existing case during triage.
 */
export class EmailAddedToCaseEvent implements DomainEvent {
  readonly eventType = 'triage.email_added_to_case';
  readonly occurredAt: Date;

  constructor(
    readonly officeId: OfficeId,
    readonly emailExternalId: ExternalId,
    readonly caseExternalId: ExternalId
  ) {
    this.occurredAt = new Date();
  }
}

/**
 * Event: Email Ignored
 *
 * Emitted when an email is marked as actioned without creating a case.
 */
export class EmailIgnoredEvent implements DomainEvent {
  readonly eventType = 'triage.email_ignored';
  readonly occurredAt: Date;

  constructor(
    readonly officeId: OfficeId,
    readonly emailExternalId: ExternalId,
    readonly reason?: string
  ) {
    this.occurredAt = new Date();
  }
}
