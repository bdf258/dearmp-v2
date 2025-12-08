// Shared type definitions for DearMP Edge Functions

export interface Office {
  id: string;
  name: string;
  mode: 'casework' | 'westminster';
  mp_name?: string;
  mp_email?: string;
  signature_template?: string;
  created_at: string;
  updated_at: string;
}

export interface OfficeSettings {
  id: string;
  office_id: string;
  default_casework_assignee?: string;
  default_policy_assignee?: string;
  auto_assign_enabled: boolean;
  round_robin_enabled: boolean;
  ai_classification_enabled: boolean;
  ai_draft_response_enabled: boolean;
  ai_tagging_enabled: boolean;
  policy_response_style: 'formal' | 'friendly' | 'brief';
  casework_acknowledgment_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  office_id: string;
  name: string;
  email: string;
  role: 'admin' | 'staff' | 'mp';
  is_active: boolean;
  can_handle_casework: boolean;
  can_handle_policy: boolean;
  max_active_cases: number;
  specialties: string[];
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: string;
  office_id: string;
  name: string;
  color: string;
  description?: string;
  auto_assign_keywords: string[];
  created_at: string;
}

export interface Campaign {
  id: string;
  office_id: string;
  name: string;
  description?: string;
  status: 'active' | 'inactive' | 'archived';
  subject_pattern?: string;
  fingerprint_hash?: string;
  email_count: number;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  office_id: string;
  from_email: string;
  from_name?: string;
  to_email: string;
  to_name?: string;
  subject: string;
  snippet?: string;
  body: string;
  body_html?: string;
  direction: 'inbound' | 'outbound';
  thread_id?: string;
  in_reply_to_message_id?: string;
  is_triage_needed: boolean;
  is_policy_email?: boolean;
  email_type?: 'policy' | 'casework' | 'campaign' | 'spam' | 'personal';
  classification_confidence?: number;
  classification_reasoning?: string;
  fingerprint_hash?: string;
  is_campaign_email: boolean;
  case_id?: string;
  campaign_id?: string;
  assigned_to_user_id?: string;
  ai_processed_at?: string;
  ai_error?: string;
  received_at: string;
  created_at: string;
  updated_at: string;
}

export interface DraftResponse {
  id: string;
  message_id: string;
  office_id: string;
  subject: string;
  body: string;
  body_html?: string;
  draft_type: 'individual' | 'bulk';
  status: 'draft' | 'edited' | 'approved' | 'sent' | 'rejected';
  campaign_id?: string;
  fingerprint_hash?: string;
  generated_by: string;
  generation_prompt?: string;
  edited_by_user_id?: string;
  edited_at?: string;
  approved_by_user_id?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
}

export interface BulkResponse {
  id: string;
  campaign_id?: string;
  office_id: string;
  fingerprint_hash: string;
  subject: string;
  body_template: string;
  body_template_html?: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'sending' | 'sent' | 'rejected';
  created_by_user_id?: string;
  edited_by_user_id?: string;
  approved_by_user_id?: string;
  approved_at?: string;
  sent_at?: string;
  sent_count: number;
  total_recipients: number;
  created_at: string;
  updated_at: string;
}

export interface AIProcessingQueueItem {
  id: string;
  message_id: string;
  office_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  priority: number;
  attempts: number;
  max_attempts: number;
  last_error?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

// AI Classification Types
export interface EmailClassification {
  email_type: 'policy' | 'casework' | 'campaign' | 'spam' | 'personal';
  is_policy_email: boolean;
  confidence: number;
  reasoning: string;
  suggested_tags: string[];
  is_campaign_email: boolean;
  campaign_topic?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  sentiment: 'positive' | 'neutral' | 'negative' | 'urgent';
}

export interface TagSuggestion {
  tag_id: string;
  tag_name: string;
  confidence: number;
  reason: string;
}

export interface AssignmentSuggestion {
  user_id: string;
  user_name: string;
  confidence: number;
  reason: string;
}

export interface DraftResponseSuggestion {
  subject: string;
  body: string;
  body_html?: string;
  tone: 'formal' | 'friendly' | 'brief';
}

export interface AIProcessingResult {
  classification: EmailClassification;
  tags: TagSuggestion[];
  assignment?: AssignmentSuggestion;
  draft_response?: DraftResponseSuggestion;
  fingerprint_hash: string;
  existing_bulk_response_id?: string;
}

// Context for AI processing
export interface ProcessingContext {
  message: Message;
  office: Office;
  office_settings: OfficeSettings;
  available_tags: Tag[];
  available_users: User[];
  active_campaigns: Campaign[];
  existing_bulk_responses: BulkResponse[];
}
