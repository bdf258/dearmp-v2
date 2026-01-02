import { Email } from '../../domain/entities';
import { OfficeId, ExternalId } from '../../domain/value-objects';
import { LegacyEmailResponse } from '../../domain/interfaces';
import { EmailDto, TriageEmailDto } from '../../application/dtos';

/**
 * Adapter: EmailAdapter
 *
 * Transforms email data between:
 * - Legacy API responses → Domain entities
 * - Domain entities → DTOs
 */
export class EmailAdapter {
  /**
   * Transform legacy API response to domain entity
   */
  static fromLegacy(officeId: OfficeId, legacy: LegacyEmailResponse): Email {
    return Email.fromLegacy(
      officeId,
      ExternalId.fromTrusted(legacy.id),
      {
        caseExternalId: legacy.caseID,
        constituentExternalId: legacy.constituentID,
        type: legacy.type,
        subject: legacy.subject,
        htmlBody: legacy.htmlBody,
        fromAddress: legacy.from,
        toAddresses: legacy.to,
        ccAddresses: legacy.cc,
        bccAddresses: legacy.bcc,
        actioned: legacy.actioned,
        assignedToExternalId: legacy.assignedToID,
        scheduledAt: legacy.scheduledAt,
        sentAt: legacy.sentAt,
        receivedAt: legacy.receivedAt,
      }
    );
  }

  /**
   * Transform domain entity to DTO
   */
  static toDto(email: Email, options?: {
    assignedToName?: string;
  }): EmailDto {
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
      assignedToName: options?.assignedToName,
      receivedAt: email.receivedAt?.toISOString(),
      lastSyncedAt: email.lastSyncedAt?.toISOString(),
    };
  }

  /**
   * Transform domain entity to triage DTO (with enrichment data)
   */
  static toTriageDto(
    email: Email,
    enrichment: {
      matchedConstituent?: import('../../application/dtos').ConstituentMatchDto;
      existingCases?: import('../../application/dtos').CaseDto[];
      suggestion?: import('../../application/dtos').CaseSuggestionDto;
      processingStatus: 'pending' | 'ready' | 'processing' | 'error';
      processingError?: string;
    }
  ): TriageEmailDto {
    return {
      ...this.toDto(email),
      matchedConstituent: enrichment.matchedConstituent,
      existingCases: enrichment.existingCases,
      suggestion: enrichment.suggestion,
      processingStatus: enrichment.processingStatus,
      processingError: enrichment.processingError,
    };
  }

  /**
   * Strip HTML tags to get plain text
   */
  static htmlToPlainText(html: string): string {
    // Basic HTML stripping - in production, use a proper library
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
