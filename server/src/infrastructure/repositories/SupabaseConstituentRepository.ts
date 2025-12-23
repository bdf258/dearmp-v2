import { IConstituentRepository } from '../../domain/interfaces';
import { Constituent, ConstituentProps } from '../../domain/entities';
import { OfficeId, ExternalId } from '../../domain/value-objects';

/**
 * Supabase client interface (minimal for type safety)
 */
export interface ISupabaseClient {
  from(table: string): ISupabaseQueryBuilder;
}

export interface ISupabaseQueryBuilder {
  select(columns?: string): ISupabaseQueryBuilder;
  insert(values: Record<string, unknown> | Record<string, unknown>[]): ISupabaseQueryBuilder;
  update(values: Record<string, unknown>): ISupabaseQueryBuilder;
  upsert(values: Record<string, unknown> | Record<string, unknown>[]): ISupabaseQueryBuilder;
  delete(): ISupabaseQueryBuilder;
  eq(column: string, value: unknown): ISupabaseQueryBuilder;
  ilike(column: string, value: string): ISupabaseQueryBuilder;
  gte(column: string, value: unknown): ISupabaseQueryBuilder;
  order(column: string, options?: { ascending?: boolean }): ISupabaseQueryBuilder;
  limit(count: number): ISupabaseQueryBuilder;
  range(from: number, to: number): ISupabaseQueryBuilder;
  single(): Promise<{ data: unknown; error: Error | null }>;
  then<T>(onfulfilled: (value: { data: unknown[]; error: Error | null; count: number | null }) => T): Promise<T>;
}

/**
 * Implementation: SupabaseConstituentRepository
 *
 * Implements IConstituentRepository using Supabase for data access.
 * All queries are scoped to the office via RLS.
 */
export class SupabaseConstituentRepository implements IConstituentRepository {
  private readonly tableName = 'legacy.constituents';

  constructor(private readonly supabase: ISupabaseClient) {}

  async findById(officeId: OfficeId, id: string): Promise<Constituent | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('office_id', officeId.toString())
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return this.toDomain(data as Record<string, unknown>);
  }

  async findByExternalId(officeId: OfficeId, externalId: ExternalId): Promise<Constituent | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('office_id', officeId.toString())
      .eq('external_id', externalId.toNumber())
      .single();

    if (error || !data) return null;
    return this.toDomain(data as Record<string, unknown>);
  }

  async findByEmail(officeId: OfficeId, email: string): Promise<Constituent[]> {
    // Query contact_details to find constituents by email
    // Note: This requires the contact_details table to have the email type
    const { data: contactDetails, error: cdError } = await this.supabase
      .from('legacy.contact_details')
      .select('constituent_id')
      .eq('office_id', officeId.toString())
      .ilike('value', email);

    if (cdError) throw cdError;
    if (!contactDetails || contactDetails.length === 0) return [];

    // Extract unique constituent IDs
    const constituentIds = [...new Set(
      (contactDetails as Array<{ constituent_id: string }>).map(cd => cd.constituent_id)
    )];

    // Fetch the constituents by their IDs
    const constituents: Constituent[] = [];
    for (const constituentId of constituentIds) {
      const constituent = await this.findById(officeId, constituentId);
      if (constituent) {
        constituents.push(constituent);
      }
    }

    return constituents;
  }

  async findByName(officeId: OfficeId, name: string, limit = 20): Promise<Constituent[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('office_id', officeId.toString())
      .ilike('last_name', `%${name}%`)
      .limit(limit);

    if (error) throw error;
    return ((data as unknown[]) ?? []).map(row => this.toDomain(row as Record<string, unknown>));
  }

  async findAll(
    officeId: OfficeId,
    options?: {
      limit?: number;
      offset?: number;
      modifiedSince?: Date;
    }
  ): Promise<Constituent[]> {
    let query = this.supabase
      .from(this.tableName)
      .select('*')
      .eq('office_id', officeId.toString())
      .order('created_at', { ascending: false });

    if (options?.modifiedSince) {
      query = query.gte('updated_at', options.modifiedSince.toISOString());
    }

    if (options?.limit) {
      const offset = options.offset ?? 0;
      query = query.range(offset, offset + options.limit - 1);
    }

    const { data, error } = await query;
    if (error) throw error;
    return ((data as unknown[]) ?? []).map(row => this.toDomain(row as Record<string, unknown>));
  }

  async save(constituent: Constituent): Promise<Constituent> {
    const data = constituent.toPersistence();

    const { data: result, error } = await this.supabase
      .from(this.tableName)
      .upsert(data)
      .select('*')
      .single();

    if (error) throw error;
    return this.toDomain(result as Record<string, unknown>);
  }

  async saveMany(constituents: Constituent[]): Promise<Constituent[]> {
    const data = constituents.map(c => c.toPersistence());

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
      .select('*', { count: 'exact', head: true } as unknown as string)
      .eq('office_id', officeId.toString());

    if (error) throw error;
    return count ?? 0;
  }

  /**
   * Convert database row to domain entity
   */
  private toDomain(row: Record<string, unknown>): Constituent {
    const props: ConstituentProps = {
      id: row.id as string,
      officeId: OfficeId.fromTrusted(row.office_id as string),
      externalId: ExternalId.fromTrusted(row.external_id as number),
      firstName: row.first_name as string | undefined,
      lastName: row.last_name as string | undefined,
      title: row.title as string | undefined,
      organisationType: row.organisation_type as string | undefined,
      geocodeLat: row.geocode_lat as number | undefined,
      geocodeLng: row.geocode_lng as number | undefined,
      lastSyncedAt: row.last_synced_at ? new Date(row.last_synced_at as string) : undefined,
      createdAt: row.created_at ? new Date(row.created_at as string) : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
    };

    return Constituent.fromDatabase(props);
  }
}
