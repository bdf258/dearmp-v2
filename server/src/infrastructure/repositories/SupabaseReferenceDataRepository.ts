import {
  IReferenceDataRepository,
  CaseType,
  StatusType,
  CategoryType,
  ContactType,
  Caseworker,
} from '../../domain/interfaces';
import { OfficeId } from '../../domain/value-objects';
import { ISupabaseClient } from './SupabaseConstituentRepository';

/**
 * Implementation: SupabaseReferenceDataRepository
 *
 * Implements IReferenceDataRepository using Supabase for data access.
 * All queries are scoped to the office via RLS.
 */
export class SupabaseReferenceDataRepository implements IReferenceDataRepository {
  private readonly schema = 'legacy';

  constructor(private readonly supabase: ISupabaseClient) {}

  // ─────────────────────────────────────────────────────────────────────────
  // CASE TYPES
  // ─────────────────────────────────────────────────────────────────────────

  async upsertCaseTypes(
    officeId: OfficeId,
    caseTypes: Array<{ id: number; name: string; isActive: boolean }>
  ): Promise<CaseType[]> {
    const now = new Date();
    const records = caseTypes.map((ct) => ({
      office_id: officeId.toString(),
      external_id: ct.id,
      name: ct.name,
      is_active: ct.isActive,
      last_synced_at: now.toISOString(),
    }));

    const { data, error } = await this.supabase
      .from(`${this.schema}.case_types`)
      .upsert(records, { onConflict: 'office_id,external_id' })
      .select('*');

    if (error) throw error;
    return ((data as unknown[]) ?? []).map((row) => this.toCaseType(row as Record<string, unknown>));
  }

  async getCaseTypes(officeId: OfficeId): Promise<CaseType[]> {
    const { data, error } = await this.supabase
      .from(`${this.schema}.case_types`)
      .select('*')
      .eq('office_id', officeId.toString())
      .order('name');

    if (error) throw error;
    return ((data as unknown[]) ?? []).map((row) => this.toCaseType(row as Record<string, unknown>));
  }

  async getCaseTypeByExternalId(officeId: OfficeId, externalId: number): Promise<CaseType | null> {
    const { data, error } = await this.supabase
      .from(`${this.schema}.case_types`)
      .select('*')
      .eq('office_id', officeId.toString())
      .eq('external_id', externalId)
      .single();

    if (error || !data) return null;
    return this.toCaseType(data as Record<string, unknown>);
  }

  private toCaseType(row: Record<string, unknown>): CaseType {
    return {
      id: row.id as string,
      externalId: row.external_id as number,
      officeId: row.office_id as string,
      name: row.name as string,
      isActive: row.is_active as boolean,
      lastSyncedAt: new Date(row.last_synced_at as string),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STATUS TYPES
  // ─────────────────────────────────────────────────────────────────────────

  async upsertStatusTypes(
    officeId: OfficeId,
    statusTypes: Array<{ id: number; name: string; isActive: boolean }>
  ): Promise<StatusType[]> {
    const now = new Date();
    const records = statusTypes.map((st) => ({
      office_id: officeId.toString(),
      external_id: st.id,
      name: st.name,
      is_active: st.isActive,
      last_synced_at: now.toISOString(),
    }));

    const { data, error } = await this.supabase
      .from(`${this.schema}.status_types`)
      .upsert(records, { onConflict: 'office_id,external_id' })
      .select('*');

    if (error) throw error;
    return ((data as unknown[]) ?? []).map((row) => this.toStatusType(row as Record<string, unknown>));
  }

  async getStatusTypes(officeId: OfficeId): Promise<StatusType[]> {
    const { data, error } = await this.supabase
      .from(`${this.schema}.status_types`)
      .select('*')
      .eq('office_id', officeId.toString())
      .order('name');

    if (error) throw error;
    return ((data as unknown[]) ?? []).map((row) => this.toStatusType(row as Record<string, unknown>));
  }

  async getStatusTypeByExternalId(officeId: OfficeId, externalId: number): Promise<StatusType | null> {
    const { data, error } = await this.supabase
      .from(`${this.schema}.status_types`)
      .select('*')
      .eq('office_id', officeId.toString())
      .eq('external_id', externalId)
      .single();

    if (error || !data) return null;
    return this.toStatusType(data as Record<string, unknown>);
  }

  private toStatusType(row: Record<string, unknown>): StatusType {
    return {
      id: row.id as string,
      externalId: row.external_id as number,
      officeId: row.office_id as string,
      name: row.name as string,
      isActive: row.is_active as boolean,
      lastSyncedAt: new Date(row.last_synced_at as string),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CATEGORY TYPES
  // ─────────────────────────────────────────────────────────────────────────

  async upsertCategoryTypes(
    officeId: OfficeId,
    categoryTypes: Array<{ id: number; name: string; isActive: boolean }>
  ): Promise<CategoryType[]> {
    const now = new Date();
    const records = categoryTypes.map((ct) => ({
      office_id: officeId.toString(),
      external_id: ct.id,
      name: ct.name,
      is_active: ct.isActive,
      last_synced_at: now.toISOString(),
    }));

    const { data, error } = await this.supabase
      .from(`${this.schema}.category_types`)
      .upsert(records, { onConflict: 'office_id,external_id' })
      .select('*');

    if (error) throw error;
    return ((data as unknown[]) ?? []).map((row) => this.toCategoryType(row as Record<string, unknown>));
  }

  async getCategoryTypes(officeId: OfficeId): Promise<CategoryType[]> {
    const { data, error } = await this.supabase
      .from(`${this.schema}.category_types`)
      .select('*')
      .eq('office_id', officeId.toString())
      .order('name');

    if (error) throw error;
    return ((data as unknown[]) ?? []).map((row) => this.toCategoryType(row as Record<string, unknown>));
  }

  async getCategoryTypeByExternalId(officeId: OfficeId, externalId: number): Promise<CategoryType | null> {
    const { data, error } = await this.supabase
      .from(`${this.schema}.category_types`)
      .select('*')
      .eq('office_id', officeId.toString())
      .eq('external_id', externalId)
      .single();

    if (error || !data) return null;
    return this.toCategoryType(data as Record<string, unknown>);
  }

  private toCategoryType(row: Record<string, unknown>): CategoryType {
    return {
      id: row.id as string,
      externalId: row.external_id as number,
      officeId: row.office_id as string,
      name: row.name as string,
      isActive: row.is_active as boolean,
      lastSyncedAt: new Date(row.last_synced_at as string),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CONTACT TYPES
  // ─────────────────────────────────────────────────────────────────────────

  async upsertContactTypes(
    officeId: OfficeId,
    contactTypes: Array<{ id: number; name: string; type: string; isActive: boolean }>
  ): Promise<ContactType[]> {
    const now = new Date();
    const records = contactTypes.map((ct) => ({
      office_id: officeId.toString(),
      external_id: ct.id,
      name: ct.name,
      type: ct.type,
      is_active: ct.isActive,
      last_synced_at: now.toISOString(),
    }));

    const { data, error } = await this.supabase
      .from(`${this.schema}.contact_types`)
      .upsert(records, { onConflict: 'office_id,external_id' })
      .select('*');

    if (error) throw error;
    return ((data as unknown[]) ?? []).map((row) => this.toContactType(row as Record<string, unknown>));
  }

  async getContactTypes(officeId: OfficeId): Promise<ContactType[]> {
    const { data, error } = await this.supabase
      .from(`${this.schema}.contact_types`)
      .select('*')
      .eq('office_id', officeId.toString())
      .order('name');

    if (error) throw error;
    return ((data as unknown[]) ?? []).map((row) => this.toContactType(row as Record<string, unknown>));
  }

  async getContactTypeByExternalId(officeId: OfficeId, externalId: number): Promise<ContactType | null> {
    const { data, error } = await this.supabase
      .from(`${this.schema}.contact_types`)
      .select('*')
      .eq('office_id', officeId.toString())
      .eq('external_id', externalId)
      .single();

    if (error || !data) return null;
    return this.toContactType(data as Record<string, unknown>);
  }

  private toContactType(row: Record<string, unknown>): ContactType {
    return {
      id: row.id as string,
      externalId: row.external_id as number,
      officeId: row.office_id as string,
      name: row.name as string,
      type: row.type as string,
      isActive: row.is_active as boolean,
      lastSyncedAt: new Date(row.last_synced_at as string),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CASEWORKERS
  // ─────────────────────────────────────────────────────────────────────────

  async upsertCaseworkers(
    officeId: OfficeId,
    caseworkers: Array<{ id: number; name: string; email?: string; isActive: boolean }>
  ): Promise<Caseworker[]> {
    const now = new Date();
    const records = caseworkers.map((cw) => ({
      office_id: officeId.toString(),
      external_id: cw.id,
      name: cw.name,
      email: cw.email,
      is_active: cw.isActive,
      last_synced_at: now.toISOString(),
    }));

    const { data, error } = await this.supabase
      .from(`${this.schema}.caseworkers`)
      .upsert(records, { onConflict: 'office_id,external_id' })
      .select('*');

    if (error) throw error;
    return ((data as unknown[]) ?? []).map((row) => this.toCaseworker(row as Record<string, unknown>));
  }

  async getCaseworkers(officeId: OfficeId): Promise<Caseworker[]> {
    const { data, error } = await this.supabase
      .from(`${this.schema}.caseworkers`)
      .select('*')
      .eq('office_id', officeId.toString())
      .order('name');

    if (error) throw error;
    return ((data as unknown[]) ?? []).map((row) => this.toCaseworker(row as Record<string, unknown>));
  }

  async getCaseworkerByExternalId(officeId: OfficeId, externalId: number): Promise<Caseworker | null> {
    const { data, error } = await this.supabase
      .from(`${this.schema}.caseworkers`)
      .select('*')
      .eq('office_id', officeId.toString())
      .eq('external_id', externalId)
      .single();

    if (error || !data) return null;
    return this.toCaseworker(data as Record<string, unknown>);
  }

  private toCaseworker(row: Record<string, unknown>): Caseworker {
    return {
      id: row.id as string,
      externalId: row.external_id as number,
      officeId: row.office_id as string,
      name: row.name as string,
      email: row.email as string | undefined,
      isActive: row.is_active as boolean,
      lastSyncedAt: new Date(row.last_synced_at as string),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CLEANUP
  // ─────────────────────────────────────────────────────────────────────────

  async deleteStaleRecords(officeId: OfficeId, olderThan: Date): Promise<number> {
    let totalDeleted = 0;
    const tables = ['case_types', 'status_types', 'category_types', 'contact_types', 'caseworkers'];

    for (const table of tables) {
      const { data, error } = await this.supabase
        .from(`${this.schema}.${table}`)
        .delete()
        .eq('office_id', officeId.toString())
        .lt('last_synced_at', olderThan.toISOString())
        .select('id');

      if (error) {
        console.error(`[ReferenceDataRepository] Failed to delete stale records from ${table}:`, error);
        continue;
      }

      totalDeleted += (data as unknown[])?.length ?? 0;
    }

    return totalDeleted;
  }
}
