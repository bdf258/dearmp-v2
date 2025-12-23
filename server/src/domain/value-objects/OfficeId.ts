/**
 * Value Object: OfficeId
 *
 * Represents a tenant identifier in the multi-tenant system.
 * Immutable and validated on construction.
 */
export class OfficeId {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  /**
   * Creates an OfficeId from a UUID string
   * @throws Error if the UUID format is invalid
   */
  static create(uuid: string): OfficeId {
    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(uuid)) {
      throw new Error(`Invalid OfficeId format: ${uuid}`);
    }

    return new OfficeId(uuid.toLowerCase());
  }

  /**
   * Creates an OfficeId from a trusted source (no validation)
   * Use only when the UUID is known to be valid (e.g., from database)
   */
  static fromTrusted(uuid: string): OfficeId {
    return new OfficeId(uuid.toLowerCase());
  }

  toString(): string {
    return this.value;
  }

  equals(other: OfficeId): boolean {
    return this.value === other.value;
  }

  toJSON(): string {
    return this.value;
  }
}
