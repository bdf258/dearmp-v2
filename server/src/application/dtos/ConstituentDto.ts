/**
 * DTO: ConstituentDto
 *
 * Data Transfer Object for constituent data between layers.
 * Used for API responses and cross-layer communication.
 */
export interface ConstituentDto {
  id: string;
  officeId: string;
  externalId: number;
  firstName?: string;
  lastName?: string;
  fullName: string;
  title?: string;
  organisationType?: string;
  geocodeLat?: number;
  geocodeLng?: number;
  lastSyncedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * DTO: CreateConstituentDto
 *
 * Data required to create a new constituent.
 */
export interface CreateConstituentDto {
  firstName: string;
  lastName: string;
  title?: string;
  organisationType?: string;
  email?: string;
  phone?: string;
  address?: string;
}

/**
 * DTO: UpdateConstituentDto
 *
 * Data for updating an existing constituent.
 */
export interface UpdateConstituentDto {
  firstName?: string;
  lastName?: string;
  title?: string;
  organisationType?: string;
}

/**
 * DTO: ConstituentSearchDto
 *
 * Parameters for searching constituents.
 */
export interface ConstituentSearchDto {
  term?: string;
  email?: string;
  page?: number;
  limit?: number;
}

/**
 * DTO: ConstituentMatchDto
 *
 * Result of matching an email to a constituent.
 */
export interface ConstituentMatchDto {
  constituent: ConstituentDto;
  matchScore: number;
  matchedOn: 'email' | 'name' | 'phone';
}
