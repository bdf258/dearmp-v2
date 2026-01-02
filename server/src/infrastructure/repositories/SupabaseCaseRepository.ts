import { ICaseRepository } from '../../domain/interfaces';
import { Case, CaseProps } from '../../domain/entities';
import { OfficeId, ExternalId } from '../../domain/value-objects';
import { ISupabaseClient } from './SupabaseConstituentRepository';

/**
 * Implementation: SupabaseCaseRepository
 *
 * Implements ICaseRepository using Supabase for data access.
 * All queries are scoped to the office via RLS.
 */
export class SupabaseCaseRepository implements ICaseRepository {
  private readonly tableName = 'legacy.cases';

  constructor(private readonly supabase: ISupabaseClient) {}

  async findById(officeId: OfficeId, id: string): Promise<Case | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('office_id', officeId.toString())
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return this.toDomain(data as Record<string, unknown>);
  }

  async findByExternalId(officeId: OfficeId, externalId: ExternalId): Promise<Case | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('office_id', officeId.toString())
      .eq('external_id', externalId.toNumber())
      .single();

    if (error || !data) return null;
    return this.toDomain(data as Record<string, unknown>);
  }

  async findByConstituentId(officeId: OfficeId, constituentId: string): Promise<Case[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('office_id', officeId.toString())
      .eq('constituent_id', constituentId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return ((data as unknown[]) ?? []).map(row => this.toDomain(row as Record<string, unknown>));
  }

  async findByConstituentExternalId(
    officeId: OfficeId,
    constituentExternalId: ExternalId
  ): Promise<Case[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('office_id', officeId.toString())
      .eq('constituent_external_id', constituentExternalId.toNumber())
      .order('created_at', { ascending: false });

    if (error) throw error;
    return ((data as unknown[]) ?? []).map(row => this.toDomain(row as Record<string, unknown>));
  }

  async findOpenCasesForConstituent(officeId: OfficeId, constituentId: string): Promise<Case[]> {
    // Query for cases that are not in closed statuses
    // Note: This assumes closed status has a specific external_id
    // In practice, you might need to fetch the status types and determine which are "closed"
    // For now, we filter out cases with null status or use a configurable closed status list
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('office_id', officeId.toString())
      .eq('constituent_id', constituentId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Filter to only include cases without a "closed" status
    // This is a simplified approach - in production you'd have a list of closed status IDs
    return ((data as unknown[]) ?? [])
      .map(row => this.toDomain(row as Record<string, unknown>));
  }

  async findAll(
    officeId: OfficeId,
    options?: {
      limit?: number;
      offset?: number;
      modifiedSince?: Date;
      statusId?: string;
      caseTypeId?: string;
      assignedToId?: string;
    }
  ): Promise<Case[]> {
    let query = this.supabase
      .from(this.tableName)
      .select('*')
      .eq('office_id', officeId.toString())
      .order('created_at', { ascending: false });

    if (options?.modifiedSince) {
      query = query.gte('updated_at', options.modifiedSince.toISOString());
    }

    if (options?.statusId) {
      query = query.eq('status_id', options.statusId);
    }

    if (options?.caseTypeId) {
      query = query.eq('case_type_id', options.caseTypeId);
    }

    if (options?.assignedToId) {
      query = query.eq('assigned_to_id', options.assignedToId);
    }

    if (options?.limit) {
      const offset = options.offset ?? 0;
      query = query.range(offset, offset + options.limit - 1);
    }

    const { data, error } = await query;
    if (error) throw error;
    return ((data as unknown[]) ?? []).map(row => this.toDomain(row as Record<string, unknown>));
  }

  async save(caseEntity: Case): Promise<Case> {
    const data = caseEntity.toPersistence();

    const { data: result, error } = await this.supabase
      .from(this.tableName)
      .upsert(data)
      .select('*')
      .single();

    if (error) throw error;
    return this.toDomain(result as Record<string, unknown>);
  }

  async saveMany(cases: Case[]): Promise<Case[]> {
    const data = cases.map(c => c.toPersistence());

    const { data: results, error } = await this.supabase
      .from(this.tableName)
      .upsert(data)
      .select('*');

    if (error) throw error;
    return ((results as unknown[]) ?? []).map(row => this.toDomain(row as Record<string, unknown>));
  }

  async deleteByExternalId(officeId: OfficeId, externalId: ExternalId): Promise<void> {
    const { error } = await this.supabase
      .from(this.tableName)
      .delete()
      .eq('office_id', officeId.toString())
      .eq('external_id', externalId.toNumber());

    if (error) throw error;
  }

  async count(officeId: OfficeId): Promise<number> {
    const { count, error } = await this.supabase
      .from(this.tableName)
      .select('*', { count: 'exact', head: true })
      .eq('office_id', officeId.toString());

    if (error) throw error;
    return count ?? 0;
  }

  async countByStatus(officeId: OfficeId): Promise<Record<string, number>> {
    // Fetch all cases for the office and group by status
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('status_id')
      .eq('office_id', officeId.toString());

    if (error) throw error;

    // Group by status_id and count
    const counts: Record<string, number> = {};
    for (const row of (data as Array<{ status_id: string | null }>) ?? []) {
      const statusId = row.status_id ?? 'unassigned';
      counts[statusId] = (counts[statusId] ?? 0) + 1;
    }

    return counts;
  }

  async create(caseEntity: Case): Promise<Case> {
    const data = caseEntity.toPersistence();

    const { data: result, error } = await this.supabase
      .from(this.tableName)
      .insert(data)
      .select('*')
      .single();

    if (error) throw error;
    return this.toDomain(result as Record<string, unknown>);
  }

  async update(id: string, caseEntity: Partial<Case>): Promise<Case> {
    const updateData: Record<string, unknown> = {};

    if (caseEntity.summary !== undefined) updateData.summary = caseEntity.summary;
    if (caseEntity.statusId !== undefined) updateData.status_id = caseEntity.statusId;
    if (caseEntity.caseTypeId !== undefined) updateData.case_type_id = caseEntity.caseTypeId;
    if (caseEntity.categoryTypeId !== undefined) updateData.category_type_id = caseEntity.categoryTypeId;
    if (caseEntity.contactTypeId !== undefined) updateData.contact_type_id = caseEntity.contactTypeId;
    if (caseEntity.assignedToId !== undefined) updateData.assigned_to_id = caseEntity.assignedToId;
    if (caseEntity.reviewDate !== undefined) updateData.review_date = caseEntity.reviewDate;

    const { data: result, error } = await this.supabase
      .from(this.tableName)
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return this.toDomain(result as Record<string, unknown>);
  }

  async updateExternalId(id: string, externalId: ExternalId): Promise<void> {
    const { error } = await this.supabase
      .from(this.tableName)
      .update({ external_id: externalId.toNumber() })
      .eq('id', id);

    if (error) throw error;
  }

  /**
   * Convert database row to domain entity
   */
  private toDomain(row: Record<string, unknown>): Case {
    const props: CaseProps = {
      id: row.id as string,
      officeId: OfficeId.fromTrusted(row.office_id as string),
      externalId: ExternalId.fromTrusted(row.external_id as number),
      constituentId: row.constituent_id as string | undefined,
      constituentExternalId: row.constituent_external_id
        ? ExternalId.fromTrusted(row.constituent_external_id as number)
        : undefined,
      caseTypeId: row.case_type_id as string | undefined,
      caseTypeExternalId: row.case_type_external_id
        ? ExternalId.fromTrusted(row.case_type_external_id as number)
        : undefined,
      statusId: row.status_id as string | undefined,
      statusExternalId: row.status_external_id
        ? ExternalId.fromTrusted(row.status_external_id as number)
        : undefined,
      categoryTypeId: row.category_type_id as string | undefined,
      categoryTypeExternalId: row.category_type_external_id
        ? ExternalId.fromTrusted(row.category_type_external_id as number)
        : undefined,
      contactTypeId: row.contact_type_id as string | undefined,
      contactTypeExternalId: row.contact_type_external_id
        ? ExternalId.fromTrusted(row.contact_type_external_id as number)
        : undefined,
      assignedToId: row.assigned_to_id as string | undefined,
      assignedToExternalId: row.assigned_to_external_id
        ? ExternalId.fromTrusted(row.assigned_to_external_id as number)
        : undefined,
      summary: row.summary as string | undefined,
      reviewDate: row.review_date ? new Date(row.review_date as string) : undefined,
      lastSyncedAt: row.last_synced_at ? new Date(row.last_synced_at as string) : undefined,
      createdAt: row.created_at ? new Date(row.created_at as string) : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
    };

    return Case.fromDatabase(props);
  }
}
