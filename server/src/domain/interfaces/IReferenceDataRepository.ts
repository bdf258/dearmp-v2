import { OfficeId } from '../value-objects';

/**
 * Reference data types synced from the legacy system
 */
export interface CaseType {
  id: string;
  externalId: number;
  officeId: string;
  name: string;
  isActive: boolean;
  lastSyncedAt: Date;
}

export interface StatusType {
  id: string;
  externalId: number;
  officeId: string;
  name: string;
  isActive: boolean;
  lastSyncedAt: Date;
}

export interface CategoryType {
  id: string;
  externalId: number;
  officeId: string;
  name: string;
  isActive: boolean;
  lastSyncedAt: Date;
}

export interface ContactType {
  id: string;
  externalId: number;
  officeId: string;
  name: string;
  type: string;
  isActive: boolean;
  lastSyncedAt: Date;
}

export interface Caseworker {
  id: string;
  externalId: number;
  officeId: string;
  name: string;
  email?: string;
  isActive: boolean;
  lastSyncedAt: Date;
}

/**
 * Interface for reference data repository operations
 */
export interface IReferenceDataRepository {
  // Case Types
  upsertCaseTypes(
    officeId: OfficeId,
    caseTypes: Array<{ id: number; name: string; isActive: boolean }>
  ): Promise<CaseType[]>;

  getCaseTypes(officeId: OfficeId): Promise<CaseType[]>;

  getCaseTypeByExternalId(officeId: OfficeId, externalId: number): Promise<CaseType | null>;

  // Status Types
  upsertStatusTypes(
    officeId: OfficeId,
    statusTypes: Array<{ id: number; name: string; isActive: boolean }>
  ): Promise<StatusType[]>;

  getStatusTypes(officeId: OfficeId): Promise<StatusType[]>;

  getStatusTypeByExternalId(officeId: OfficeId, externalId: number): Promise<StatusType | null>;

  // Category Types
  upsertCategoryTypes(
    officeId: OfficeId,
    categoryTypes: Array<{ id: number; name: string; isActive: boolean }>
  ): Promise<CategoryType[]>;

  getCategoryTypes(officeId: OfficeId): Promise<CategoryType[]>;

  getCategoryTypeByExternalId(officeId: OfficeId, externalId: number): Promise<CategoryType | null>;

  // Contact Types
  upsertContactTypes(
    officeId: OfficeId,
    contactTypes: Array<{ id: number; name: string; type: string; isActive: boolean }>
  ): Promise<ContactType[]>;

  getContactTypes(officeId: OfficeId): Promise<ContactType[]>;

  getContactTypeByExternalId(officeId: OfficeId, externalId: number): Promise<ContactType | null>;

  // Caseworkers
  upsertCaseworkers(
    officeId: OfficeId,
    caseworkers: Array<{ id: number; name: string; email?: string; isActive: boolean }>
  ): Promise<Caseworker[]>;

  getCaseworkers(officeId: OfficeId): Promise<Caseworker[]>;

  getCaseworkerByExternalId(officeId: OfficeId, externalId: number): Promise<Caseworker | null>;

  // Cleanup operations
  deleteStaleRecords(officeId: OfficeId, olderThan: Date): Promise<number>;
}
