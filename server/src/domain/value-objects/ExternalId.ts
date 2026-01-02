/**
 * Value Object: ExternalId
 *
 * Represents an ID from the legacy Caseworker system.
 * External IDs are integers and are unique only within an office's context.
 */
export class ExternalId {
  private readonly value: number;

  private constructor(value: number) {
    this.value = value;
  }

  /**
   * Creates an ExternalId from a number
   * @throws Error if the value is not a positive integer
   */
  static create(value: number): ExternalId {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`Invalid ExternalId: ${value}. Must be a non-negative integer.`);
    }

    return new ExternalId(value);
  }

  /**
   * Creates an ExternalId from a trusted source (no validation)
   */
  static fromTrusted(value: number): ExternalId {
    return new ExternalId(value);
  }

  toNumber(): number {
    return this.value;
  }

  toString(): string {
    return this.value.toString();
  }

  equals(other: ExternalId): boolean {
    return this.value === other.value;
  }

  toJSON(): number {
    return this.value;
  }
}
