import { IEmailRepository } from '../../domain/interfaces';
import { Email, EmailProps } from '../../domain/entities';
import { OfficeId, ExternalId } from '../../domain/value-objects';
import { ISupabaseClient } from './SupabaseConstituentRepository';

/**
 * Implementation: SupabaseEmailRepository
 *
 * Implements IEmailRepository using Supabase for data access.
 * All queries are scoped to the office via RLS.
 */
export class SupabaseEmailRepository implements IEmailRepository {
  private readonly tableName = 'legacy.emails';

  constructor(private readonly supabase: ISupabaseClient) {}

  async findById(officeIdOrId: OfficeId | string, id?: string): Promise<Email | null> {
    // Handle both overloads:
    // findById(officeId: OfficeId, id: string)
    // findById(id: string)
    let query = this.supabase.from(this.tableName).select('*');

    if (typeof officeIdOrId === 'string' && id === undefined) {
      // Called as findById(id: string)
      query = query.eq('id', officeIdOrId);
    } else if (officeIdOrId instanceof OfficeId && id !== undefined) {
      // Called as findById(officeId: OfficeId, id: string)
      query = query.eq('office_id', officeIdOrId.toString()).eq('id', id);
    } else {
      throw new Error('Invalid arguments to findById');
    }

    const { data, error } = await query.single();

    if (error || !data) return null;
    return this.toDomain(data as Record<string, unknown>);
  }

  async findByExternalId(officeId: OfficeId, externalId: ExternalId): Promise<Email | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('office_id', officeId.toString())
      .eq('external_id', externalId.toNumber())
      .single();

    if (error || !data) return null;
    return this.toDomain(data as Record<string, unknown>);
  }

  async findByCaseId(officeId: OfficeId, caseId: string): Promise<Email[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('office_id', officeId.toString())
      .eq('case_id', caseId)
      .order('received_at', { ascending: false });

    if (error) throw error;
    return ((data as unknown[]) ?? []).map(row => this.toDomain(row as Record<string, unknown>));
  }

  async findUnactioned(
    officeId: OfficeId,
    options?: {
      limit?: number;
      offset?: number;
      receivedSince?: Date;
    }
  ): Promise<Email[]> {
    let query = this.supabase
      .from(this.tableName)
      .select('*')
      .eq('office_id', officeId.toString())
      .eq('actioned', false)
      .eq('type', 'received')
      .order('received_at', { ascending: false });

    if (options?.receivedSince) {
      query = query.gte('received_at', options.receivedSince.toISOString());
    }

    if (options?.limit) {
      const offset = options.offset ?? 0;
      query = query.range(offset, offset + options.limit - 1);
    }

    const { data, error } = await query;
    if (error) throw error;
    return ((data as unknown[]) ?? []).map(row => this.toDomain(row as Record<string, unknown>));
  }

  async findByFromAddress(officeId: OfficeId, fromAddress: string): Promise<Email[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('office_id', officeId.toString())
      .ilike('from_address', fromAddress)
      .order('received_at', { ascending: false });

    if (error) throw error;
    return ((data as unknown[]) ?? []).map(row => this.toDomain(row as Record<string, unknown>));
  }

  async findAll(
    officeId: OfficeId,
    options?: {
      limit?: number;
      offset?: number;
      modifiedSince?: Date;
      type?: string;
      actioned?: boolean;
    }
  ): Promise<Email[]> {
    let query = this.supabase
      .from(this.tableName)
      .select('*')
      .eq('office_id', officeId.toString())
      .order('received_at', { ascending: false });

    if (options?.modifiedSince) {
      query = query.gte('updated_at', options.modifiedSince.toISOString());
    }

    if (options?.type) {
      query = query.eq('type', options.type);
    }

    if (options?.actioned !== undefined) {
      query = query.eq('actioned', options.actioned);
    }

    if (options?.limit) {
      const offset = options.offset ?? 0;
      query = query.range(offset, offset + options.limit - 1);
    }

    const { data, error } = await query;
    if (error) throw error;
    return ((data as unknown[]) ?? []).map(row => this.toDomain(row as Record<string, unknown>));
  }

  async save(email: Email): Promise<Email> {
    const data = email.toPersistence();

    const { data: result, error } = await this.supabase
      .from(this.tableName)
      .upsert(data)
      .select('*')
      .single();

    if (error) throw error;
    return this.toDomain(result as Record<string, unknown>);
  }

  async saveMany(emails: Email[]): Promise<Email[]> {
    const data = emails.map(e => e.toPersistence());

    const { data: results, error } = await this.supabase
      .from(this.tableName)
      .upsert(data)
      .select('*');

    if (error) throw error;
    return ((results as unknown[]) ?? []).map(row => this.toDomain(row as Record<string, unknown>));
  }

  async markActioned(officeId: OfficeId, externalId: ExternalId): Promise<void> {
    const { error } = await this.supabase
      .from(this.tableName)
      .update({ actioned: true, updated_at: new Date().toISOString() })
      .eq('office_id', officeId.toString())
      .eq('external_id', externalId.toNumber());

    if (error) throw error;
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

  async countUnactioned(officeId: OfficeId): Promise<number> {
    const { count, error } = await this.supabase
      .from(this.tableName)
      .select('*', { count: 'exact', head: true })
      .eq('office_id', officeId.toString())
      .eq('actioned', false)
      .eq('type', 'received');

    if (error) throw error;
    return count ?? 0;
  }

  async create(email: Email): Promise<Email> {
    const data = email.toPersistence();

    const { data: result, error } = await this.supabase
      .from(this.tableName)
      .insert(data)
      .select('*')
      .single();

    if (error) throw error;
    return this.toDomain(result as Record<string, unknown>);
  }

  async update(id: string, email: Partial<Email>): Promise<Email> {
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // Map entity properties to database columns
    if (email.subject !== undefined) updateData.subject = email.subject;
    if (email.htmlBody !== undefined) updateData.html_body = email.htmlBody;
    if (email.actioned !== undefined) updateData.actioned = email.actioned;
    if (email.type !== undefined) updateData.type = email.type;

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
      .update({
        external_id: externalId.toNumber(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;
  }

  /**
   * Convert database row to domain entity
   */
  private toDomain(row: Record<string, unknown>): Email {
    const props: EmailProps = {
      id: row.id as string,
      officeId: OfficeId.fromTrusted(row.office_id as string),
      externalId: ExternalId.fromTrusted(row.external_id as number),
      caseId: row.case_id as string | undefined,
      caseExternalId: row.case_external_id
        ? ExternalId.fromTrusted(row.case_external_id as number)
        : undefined,
      constituentId: row.constituent_id as string | undefined,
      constituentExternalId: row.constituent_external_id
        ? ExternalId.fromTrusted(row.constituent_external_id as number)
        : undefined,
      type: row.type as EmailProps['type'],
      subject: row.subject as string | undefined,
      htmlBody: row.html_body as string | undefined,
      fromAddress: row.from_address as string | undefined,
      toAddresses: row.to_addresses as string[] | undefined,
      ccAddresses: row.cc_addresses as string[] | undefined,
      bccAddresses: row.bcc_addresses as string[] | undefined,
      actioned: (row.actioned as boolean) ?? false,
      assignedToId: row.assigned_to_id as string | undefined,
      assignedToExternalId: row.assigned_to_external_id
        ? ExternalId.fromTrusted(row.assigned_to_external_id as number)
        : undefined,
      scheduledAt: row.scheduled_at ? new Date(row.scheduled_at as string) : undefined,
      sentAt: row.sent_at ? new Date(row.sent_at as string) : undefined,
      receivedAt: row.received_at ? new Date(row.received_at as string) : undefined,
      lastSyncedAt: row.last_synced_at ? new Date(row.last_synced_at as string) : undefined,
      createdAt: row.created_at ? new Date(row.created_at as string) : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
    };

    return Email.fromDatabase(props);
  }
}
