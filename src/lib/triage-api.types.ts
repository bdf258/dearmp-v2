/**
 * Triage API Types and Contract
 *
 * This file defines the TypeScript types for the triage RPC functions
 * and serves as the API contract documentation.
 *
 * STATE MACHINE:
 *   pending → triaged (AI processed) → confirmed (human approved)
 *                                   ↘ dismissed (rejected)
 */

// ============================================================================
// ENUMS
// ============================================================================

export type TriageStatus = 'pending' | 'triaged' | 'confirmed' | 'dismissed';

// ============================================================================
// RPC: confirm_triage
// ============================================================================
/**
 * Confirms one or more messages as triaged (human-approved).
 * Optionally links to a case, assigns a caseworker, and applies tags.
 *
 * @example
 * const { data, error } = await supabase.rpc('confirm_triage', {
 *   p_message_ids: ['uuid1', 'uuid2'],
 *   p_case_id: 'case-uuid',
 *   p_assignee_id: 'user-uuid',
 *   p_tag_ids: ['tag-uuid1', 'tag-uuid2']
 * });
 */
export interface ConfirmTriageParams {
  p_message_ids: string[];
  p_case_id?: string | null;
  p_assignee_id?: string | null;
  p_tag_ids?: string[] | null;
}

export interface ConfirmTriageResponse {
  success: boolean;
  confirmed_count?: number;
  case_id?: string;
  error?: string;
}

// ============================================================================
// RPC: dismiss_triage
// ============================================================================
/**
 * Dismisses one or more messages from the triage queue.
 * Use for spam, irrelevant messages, or duplicates.
 *
 * @example
 * const { data, error } = await supabase.rpc('dismiss_triage', {
 *   p_message_ids: ['uuid1', 'uuid2'],
 *   p_reason: 'spam'
 * });
 */
export interface DismissTriageParams {
  p_message_ids: string[];
  p_reason?: string | null;
}

export interface DismissTriageResponse {
  success: boolean;
  dismissed_count?: number;
  error?: string;
}

// ============================================================================
// RPC: get_triage_queue
// ============================================================================
/**
 * Retrieves messages pending triage with filtering and pagination.
 *
 * @example
 * const { data, error } = await supabase.rpc('get_triage_queue', {
 *   p_status: ['pending', 'triaged'],
 *   p_campaign_id: 'campaign-uuid',
 *   p_email_type: 'policy',
 *   p_limit: 50,
 *   p_offset: 0,
 *   p_order_by: 'received_at',
 *   p_order_dir: 'desc'
 * });
 */
export interface GetTriageQueueParams {
  p_status?: TriageStatus[];
  p_campaign_id?: string | null;
  p_email_type?: string | null;
  p_limit?: number;
  p_offset?: number;
  p_order_by?: 'received_at' | 'confidence';
  p_order_dir?: 'asc' | 'desc';
}

export interface TriageQueueItem {
  id: string;
  office_id: string;
  subject: string | null;
  snippet: string | null;
  received_at: string;
  triage_status: TriageStatus;
  triaged_at: string | null;
  email_type: string | null;
  is_campaign_email: boolean | null;
  campaign_id: string | null;
  case_id: string | null;
  classification_confidence: number | null;
  triage_metadata: TriageMetadata;
  sender_email: string | null;
  sender_name: string | null;
  sender_constituent_id: string | null;
  sender_constituent_name: string | null;
}

// ============================================================================
// RPC: get_triage_stats
// ============================================================================
/**
 * Returns triage queue statistics for dashboard display.
 *
 * @example
 * const { data, error } = await supabase.rpc('get_triage_stats');
 */
export interface TriageStats {
  pending_count: number;
  triaged_count: number;
  confirmed_today: number;
  dismissed_today: number;
  by_email_type: Record<string, number>;
  by_campaign: Record<string, number>;
  avg_confidence: number | null;
  error?: string;
}

// ============================================================================
// RPC: mark_as_triaged (Service/AI use)
// ============================================================================
/**
 * Called by AI processing to mark messages as AI-triaged with suggestions.
 * Primarily used by the email-ingestion edge function.
 *
 * @example
 * const { data, error } = await supabase.rpc('mark_as_triaged', {
 *   p_message_id: 'uuid',
 *   p_triaged_by: 'gemini-flash-2.0',
 *   p_confidence: 0.92,
 *   p_email_type: 'policy',
 *   p_is_campaign: false,
 *   p_metadata: { suggested_tags: [...], suggested_assignee: {...} }
 * });
 */
export interface MarkAsTriagedParams {
  p_message_id: string;
  p_triaged_by: string;
  p_confidence?: number | null;
  p_email_type?: string | null;
  p_is_campaign?: boolean;
  p_metadata?: TriageMetadata;
}

export interface MarkAsTriagedResponse {
  success: boolean;
  message_id?: string;
  error?: string;
}

// ============================================================================
// METADATA STRUCTURES
// ============================================================================

export interface TriageMetadata {
  // AI processing metadata
  suggested_tags?: SuggestedTag[];
  suggested_assignee?: SuggestedAssignee;
  alternative_assignees?: SuggestedAssignee[];
  classification_reasoning?: string;

  // Confirmation metadata (added when confirmed)
  confirmed_at?: string;
  confirmed_by?: string;
  assigned_case_id?: string;
  assigned_to?: string;
  applied_tags?: string[];

  // Dismissal metadata (added when dismissed)
  dismissed_at?: string;
  dismissed_by?: string;
  dismiss_reason?: string;

  // Campaign detection
  campaign_match_type?: 'fingerprint' | 'subject_pattern' | 'manual';
  matched_campaign_id?: string;

  // Constituent matching
  constituent_match?: ConstituentMatch;
}

export interface SuggestedTag {
  tag_id: string;
  tag_name: string;
  tag_color: string;
  confidence: number;
}

export interface SuggestedAssignee {
  user_id: string;
  user_name: string;
  reason: string;
}

export interface ConstituentMatch {
  status: 'exact' | 'fuzzy' | 'multiple' | 'none';
  matched_constituent?: {
    id: string;
    name: string;
    address?: string;
    previous_cases?: number;
  };
  alternatives?: {
    id: string;
    name: string;
    match_reason: string;
  }[];
  extracted_data?: {
    name?: string;
    address?: string;
    phone?: string;
  };
}

// ============================================================================
// MESSAGE EXTENSIONS (columns added by migration)
// ============================================================================

export interface MessageTriageExtensions {
  triage_status: TriageStatus;
  triaged_at: string | null;
  triaged_by: string | null;
  confirmed_at: string | null;
  confirmed_by: string | null;
  triage_metadata: TriageMetadata;
  ai_processed_at: string | null;
  classification_confidence: number | null;
  classification_reasoning: string | null;
  email_type: string | null;
  is_policy_email: boolean;
  is_campaign_email: boolean;
  fingerprint_hash: string | null;
}
