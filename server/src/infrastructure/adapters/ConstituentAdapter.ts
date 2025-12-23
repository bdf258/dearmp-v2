import { Constituent } from '../../domain/entities';
import { OfficeId, ExternalId } from '../../domain/value-objects';
import { LegacyConstituentResponse } from '../../domain/interfaces';
import { ConstituentDto } from '../../application/dtos';

/**
 * Adapter: ConstituentAdapter
 *
 * Transforms constituent data between:
 * - Legacy API responses → Domain entities
 * - Domain entities → DTOs
 * - Domain entities → Legacy API payloads
 */
export class ConstituentAdapter {
  /**
   * Transform legacy API response to domain entity
   */
  static fromLegacy(
    officeId: OfficeId,
    legacy: LegacyConstituentResponse
  ): Constituent {
    return Constituent.fromLegacy(
      officeId,
      ExternalId.fromTrusted(legacy.id),
      {
        firstName: legacy.firstName,
        lastName: legacy.lastName,
        title: legacy.title,
        organisationType: legacy.organisationType,
        geocodeLat: legacy.geocodeLat,
        geocodeLng: legacy.geocodeLng,
      }
    );
  }

  /**
   * Transform domain entity to DTO
   */
  static toDto(constituent: Constituent): ConstituentDto {
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
   * Transform create request to legacy API payload
   */
  static toCreatePayload(data: {
    firstName: string;
    lastName: string;
    title?: string;
    organisationType?: string;
  }): Record<string, unknown> {
    return {
      firstName: data.firstName,
      lastName: data.lastName,
      title: data.title,
      organisationType: data.organisationType,
    };
  }

  /**
   * Transform update data to legacy API payload
   */
  static toUpdatePayload(data: Partial<{
    firstName: string;
    lastName: string;
    title: string;
    organisationType: string;
  }>): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    if (data.firstName !== undefined) payload.firstName = data.firstName;
    if (data.lastName !== undefined) payload.lastName = data.lastName;
    if (data.title !== undefined) payload.title = data.title;
    if (data.organisationType !== undefined) payload.organisationType = data.organisationType;
    return payload;
  }
}
