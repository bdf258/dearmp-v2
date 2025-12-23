import { Case } from '../../domain/entities';
import { OfficeId, ExternalId } from '../../domain/value-objects';
import { LegacyCaseResponse } from '../../domain/interfaces';
import { CaseDto, CreateCaseDto } from '../../application/dtos';

/**
 * Adapter: CaseAdapter
 *
 * Transforms case data between:
 * - Legacy API responses → Domain entities
 * - Domain entities → DTOs
 * - Domain entities → Legacy API payloads
 */
export class CaseAdapter {
  /**
   * Transform legacy API response to domain entity
   */
  static fromLegacy(officeId: OfficeId, legacy: LegacyCaseResponse): Case {
    return Case.fromLegacy(
      officeId,
      ExternalId.fromTrusted(legacy.id),
      {
        constituentExternalId: legacy.constituentID,
        caseTypeExternalId: legacy.caseTypeID,
        statusExternalId: legacy.statusID,
        categoryTypeExternalId: legacy.categoryTypeID,
        contactTypeExternalId: legacy.contactTypeID,
        assignedToExternalId: legacy.assignedToID,
        summary: legacy.summary,
        reviewDate: legacy.reviewDate,
      }
    );
  }

  /**
   * Transform domain entity to DTO
   */
  static toDto(caseEntity: Case, options?: {
    caseTypeName?: string;
    statusName?: string;
    categoryTypeName?: string;
    assignedToName?: string;
  }): CaseDto {
    return {
      id: caseEntity.id ?? '',
      officeId: caseEntity.officeId.toString(),
      externalId: caseEntity.externalId.toNumber(),
      constituentId: caseEntity.constituentId,
      constituentExternalId: caseEntity.constituentExternalId?.toNumber(),
      caseTypeId: caseEntity.caseTypeId,
      caseTypeName: options?.caseTypeName,
      statusId: caseEntity.statusId,
      statusName: options?.statusName,
      categoryTypeId: caseEntity.categoryTypeId,
      categoryTypeName: options?.categoryTypeName,
      assignedToId: caseEntity.assignedToId,
      assignedToName: options?.assignedToName,
      summary: caseEntity.summary,
      reviewDate: caseEntity.reviewDate?.toISOString(),
      isOverdue: caseEntity.isReviewOverdue(),
      lastSyncedAt: caseEntity.lastSyncedAt?.toISOString(),
    };
  }

  /**
   * Transform create request to legacy API payload
   */
  static toCreatePayload(data: CreateCaseDto): Record<string, unknown> {
    return {
      constituentID: data.constituentExternalId,
      caseTypeID: data.caseTypeId,
      statusID: data.statusId,
      categoryTypeID: data.categoryTypeId,
      contactTypeID: data.contactTypeId,
      assignedToID: data.assignedToId,
      summary: data.summary,
      reviewDate: data.reviewDate,
    };
  }

  /**
   * Transform update data to legacy API payload
   */
  static toUpdatePayload(data: Partial<{
    caseTypeId: number;
    statusId: number;
    categoryTypeId: number;
    contactTypeId: number;
    assignedToId: number;
    summary: string;
    reviewDate: string;
  }>): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    if (data.caseTypeId !== undefined) payload.caseTypeID = data.caseTypeId;
    if (data.statusId !== undefined) payload.statusID = data.statusId;
    if (data.categoryTypeId !== undefined) payload.categoryTypeID = data.categoryTypeId;
    if (data.contactTypeId !== undefined) payload.contactTypeID = data.contactTypeId;
    if (data.assignedToId !== undefined) payload.assignedToID = data.assignedToId;
    if (data.summary !== undefined) payload.summary = data.summary;
    if (data.reviewDate !== undefined) payload.reviewDate = data.reviewDate;
    return payload;
  }
}
