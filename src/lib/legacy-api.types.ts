/**
 * Legacy API Types and Contract
 *
 * This file defines the TypeScript types for the legacy integration RPC functions
 * and serves as the API contract documentation.
 *
 * These RPC functions work with the shadow database (legacy schema) that mirrors
 * the legacy Caseworker system data.
 */

// ============================================================================
// TRIAGE QUEUE TYPES
// ============================================================================

/**
 * Get Legacy Triage Queue Parameters
 */
export interface GetLegacyTriageQueueParams {
  p_limit?: number;
  p_offset?: number;
  p_order_by?: 'received_at' | 'created_at';
  p_order_dir?: 'asc' | 'desc';
}

/**
 * Triage Queue Item from legacy.emails
 */
export interface LegacyTriageQueueItem {
  id: string;
  office_id: string;
  external_id: number;
  subject: string | null;
  snippet: string | null;
  from_address: string | null;
  to_addresses: string[] | null;
  received_at: string | null;
  created_at: string;
  actioned: boolean;
  case_id: string | null;
  case_external_id: number | null;
  constituent_id: string | null;
  constituent_external_id: number | null;
  constituent_name: string | null;
  total_count: number;
}

/**
 * Email Details from legacy.emails with related entities
 */
export interface LegacyEmailDetails {
  id: string;
  office_id: string;
  external_id: number;
  subject: string | null;
  html_body: string | null;
  from_address: string | null;
  to_addresses: string[] | null;
  cc_addresses: string[] | null;
  bcc_addresses: string[] | null;
  type: string | null;
  actioned: boolean;
  received_at: string | null;
  sent_at: string | null;
  created_at: string;
  case_id: string | null;
  case_external_id: number | null;
  case_summary: string | null;
  case_status: string | null;
  case_type: string | null;
  constituent_id: string | null;
  constituent_external_id: number | null;
  constituent_first_name: string | null;
  constituent_last_name: string | null;
  constituent_title: string | null;
}

/**
 * Confirm Triage Parameters
 */
export interface ConfirmLegacyTriageParams {
  p_email_ids: string[];
  p_case_id?: string | null;
  p_notes?: string | null;
}

/**
 * Confirm Triage Response
 */
export interface ConfirmLegacyTriageResponse {
  success: boolean;
  confirmed_count: number;
  case_id: string | null;
  error: string | null;
}

/**
 * Dismiss Triage Parameters
 */
export interface DismissLegacyTriageParams {
  p_email_ids: string[];
  p_reason?: string | null;
}

/**
 * Dismiss Triage Response
 */
export interface DismissLegacyTriageResponse {
  success: boolean;
  dismissed_count: number;
  error: string | null;
}

/**
 * Triage Statistics
 */
export interface LegacyTriageStats {
  pending_count: number;
  actioned_today_count: number;
  total_this_week: number;
  actioned_this_week: number;
}

// ============================================================================
// SYNC STATUS TYPES
// ============================================================================

/**
 * Sync Status for an entity type
 */
export interface LegacySyncStatus {
  entity_type: string;
  last_sync_started_at: string | null;
  last_sync_completed_at: string | null;
  last_sync_success: boolean;
  last_sync_error: string | null;
  records_synced: number;
  records_failed: number;
  updated_at: string;
}

// ============================================================================
// REFERENCE DATA TYPES
// ============================================================================

/**
 * Case Type from legacy.case_types
 */
export interface LegacyCaseType {
  id: string;
  externalId: number;
  name: string;
  isActive: boolean;
}

/**
 * Status Type from legacy.status_types
 */
export interface LegacyStatusType {
  id: string;
  externalId: number;
  name: string;
  isActive: boolean;
}

/**
 * Category Type from legacy.category_types
 */
export interface LegacyCategoryType {
  id: string;
  externalId: number;
  name: string;
  isActive: boolean;
}

/**
 * Contact Type from legacy.contact_types
 */
export interface LegacyContactType {
  id: string;
  externalId: number;
  name: string;
  type: string | null;
  isActive: boolean;
}

/**
 * Caseworker from legacy.caseworkers
 */
export interface LegacyCaseworker {
  id: string;
  externalId: number;
  name: string;
  email: string | null;
  isActive: boolean;
}

/**
 * Tag from legacy.tags
 */
export interface LegacyTag {
  id: string;
  externalId: number;
  name: string;
}

/**
 * Flag from legacy.flags
 */
export interface LegacyFlag {
  id: string;
  externalId: number;
  name: string;
}

/**
 * All Reference Data
 */
export interface LegacyReferenceData {
  case_types: LegacyCaseType[];
  status_types: LegacyStatusType[];
  category_types: LegacyCategoryType[];
  contact_types: LegacyContactType[];
  caseworkers: LegacyCaseworker[];
  tags: LegacyTag[];
  flags: LegacyFlag[];
}

// ============================================================================
// CONSTITUENT TYPES
// ============================================================================

/**
 * Constituent Search Result
 */
export interface LegacyConstituentSearchResult {
  id: string;
  external_id: number;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  email: string | null;
  case_count: number;
}

// ============================================================================
// CASE TYPES
// ============================================================================

/**
 * Case Search Result
 */
export interface LegacyCaseSearchResult {
  id: string;
  external_id: number;
  summary: string | null;
  status_name: string | null;
  case_type_name: string | null;
  constituent_name: string | null;
  assigned_to_name: string | null;
  created_at: string;
  total_count: number;
}

/**
 * Case Search Parameters
 */
export interface SearchLegacyCasesParams {
  p_query?: string | null;
  p_constituent_id?: string | null;
  p_status_ids?: string[] | null;
  p_limit?: number;
  p_offset?: number;
}

// ============================================================================
// SUPABASE RPC FUNCTION TYPE HELPERS
// ============================================================================

/**
 * Type-safe Supabase RPC call helper
 *
 * @example
 * const { data, error } = await supabase.rpc('get_legacy_triage_queue', {
 *   p_limit: 50,
 *   p_offset: 0,
 * });
 * // data is typed as LegacyTriageQueueItem[]
 */
export type LegacyRpcFunctions = {
  get_legacy_triage_queue: {
    params: GetLegacyTriageQueueParams;
    returns: LegacyTriageQueueItem[];
  };
  get_legacy_email_details: {
    params: { p_email_id: string };
    returns: LegacyEmailDetails[];
  };
  confirm_legacy_triage: {
    params: ConfirmLegacyTriageParams;
    returns: ConfirmLegacyTriageResponse[];
  };
  dismiss_legacy_triage: {
    params: DismissLegacyTriageParams;
    returns: DismissLegacyTriageResponse[];
  };
  get_legacy_triage_stats: {
    params: Record<string, never>;
    returns: LegacyTriageStats[];
  };
  get_legacy_sync_status: {
    params: Record<string, never>;
    returns: LegacySyncStatus[];
  };
  get_legacy_reference_data: {
    params: { p_active_only?: boolean };
    returns: LegacyReferenceData[];
  };
  search_legacy_constituents: {
    params: { p_query: string; p_limit?: number };
    returns: LegacyConstituentSearchResult[];
  };
  search_legacy_cases: {
    params: SearchLegacyCasesParams;
    returns: LegacyCaseSearchResult[];
  };
};
