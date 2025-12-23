import { OfficeId, ExternalId } from '../value-objects';

/**
 * Domain Entity: Constituent
 *
 * Represents a person who contacts the MP's office for assistance.
 * This is a core aggregate root in the casework domain.
 */
export interface ConstituentProps {
  id?: string;
  officeId: OfficeId;
  externalId: ExternalId;
  firstName?: string;
  lastName?: string;
  title?: string;
  organisationType?: string;
  geocodeLat?: number;
  geocodeLng?: number;
  lastSyncedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Constituent {
  private readonly props: ConstituentProps;

  private constructor(props: ConstituentProps) {
    this.props = props;
  }

  /**
   * Factory method to create a Constituent from legacy API data
   */
  static fromLegacy(
    officeId: OfficeId,
    externalId: ExternalId,
    data: {
      firstName?: string;
      lastName?: string;
      title?: string;
      organisationType?: string;
      geocodeLat?: number;
      geocodeLng?: number;
    }
  ): Constituent {
    return new Constituent({
      officeId,
      externalId,
      firstName: data.firstName,
      lastName: data.lastName,
      title: data.title,
      organisationType: data.organisationType,
      geocodeLat: data.geocodeLat,
      geocodeLng: data.geocodeLng,
      lastSyncedAt: new Date(),
    });
  }

  /**
   * Factory method to reconstitute from database
   */
  static fromDatabase(props: ConstituentProps): Constituent {
    return new Constituent(props);
  }

  // Getters
  get id(): string | undefined {
    return this.props.id;
  }

  get officeId(): OfficeId {
    return this.props.officeId;
  }

  get externalId(): ExternalId {
    return this.props.externalId;
  }

  get firstName(): string | undefined {
    return this.props.firstName;
  }

  get lastName(): string | undefined {
    return this.props.lastName;
  }

  get fullName(): string {
    const parts = [this.props.title, this.props.firstName, this.props.lastName]
      .filter(Boolean);
    return parts.join(' ');
  }

  get title(): string | undefined {
    return this.props.title;
  }

  get organisationType(): string | undefined {
    return this.props.organisationType;
  }

  get geocodeLat(): number | undefined {
    return this.props.geocodeLat;
  }

  get geocodeLng(): number | undefined {
    return this.props.geocodeLng;
  }

  get lastSyncedAt(): Date | undefined {
    return this.props.lastSyncedAt;
  }

  /**
   * Check if constituent has valid geocoding
   */
  hasGeocode(): boolean {
    return this.props.geocodeLat !== undefined && this.props.geocodeLng !== undefined;
  }

  /**
   * Check if constituent is an organisation
   */
  isOrganisation(): boolean {
    return this.props.organisationType !== undefined && this.props.organisationType !== '';
  }

  /**
   * Update constituent data from legacy sync
   */
  updateFromLegacy(data: {
    firstName?: string;
    lastName?: string;
    title?: string;
    organisationType?: string;
    geocodeLat?: number;
    geocodeLng?: number;
  }): Constituent {
    return new Constituent({
      ...this.props,
      firstName: data.firstName ?? this.props.firstName,
      lastName: data.lastName ?? this.props.lastName,
      title: data.title ?? this.props.title,
      organisationType: data.organisationType ?? this.props.organisationType,
      geocodeLat: data.geocodeLat ?? this.props.geocodeLat,
      geocodeLng: data.geocodeLng ?? this.props.geocodeLng,
      lastSyncedAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /**
   * Convert to plain object for persistence
   */
  toPersistence(): Record<string, unknown> {
    return {
      id: this.props.id,
      office_id: this.props.officeId.toString(),
      external_id: this.props.externalId.toNumber(),
      first_name: this.props.firstName,
      last_name: this.props.lastName,
      title: this.props.title,
      organisation_type: this.props.organisationType,
      geocode_lat: this.props.geocodeLat,
      geocode_lng: this.props.geocodeLng,
      last_synced_at: this.props.lastSyncedAt?.toISOString(),
    };
  }
}
