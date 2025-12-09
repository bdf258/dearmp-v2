// Shared type definitions for DearMP Edge Functions

// Database enums
export type UserRole = 'admin' | 'staff' | 'mp';
export type CaseStatus = 'open' | 'in_progress' | 'awaiting_response' | 'closed';
export type CasePriority = 'low' | 'medium' | 'high' | 'urgent';
export type MessageDirection = 'inbound' | 'outbound';
export type MessageChannel = 'email' | 'letter' | 'phone' | 'in_person';
export type ContactType = 'email' | 'phone' | 'mobile' | 'address' | 'other';
export type AuditAction = 'created' | 'updated' | 'deleted' | 'viewed' | 'exported';

export interface Office {
  id: string;
  name: string;
  domain?: string;
  settings: Record<string, unknown>; // JSONB field for flexible settings
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string; // References auth.users(id)
  office_id?: string;
  full_name?: string;
  role: UserRole;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Constituent {
  id: string;
  office_id: string;
  full_name: string;
  salutation?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ConstituentContact {
  id: string;
  office_id: string;
  constituent_id: string;
  type: ContactType;
  value: string;
  is_primary: boolean;
  created_at: string;
}

export interface ConstituentRelationship {
  id: string;
  office_id: string;
  constituent_a_id: string;
  constituent_b_id: string;
  relationship_type: string;
  created_at: string;
}

export interface Organization {
  id: string;
  office_id: string;
  name: string;
  type?: string;
  website?: string;
  created_at: string;
}

export interface OrganizationMembership {
  id: string;
  office_id: string;
  organization_id: string;
  constituent_id: string;
  role_title?: string;
  created_at: string;
}

export interface Tag {
  id: string;
  office_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface TagAssignment {
  id: string;
  office_id: string;
  tag_id: string;
  entity_type: string;
  entity_id: string;
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
  created_at: string;
  updated_at: string;
}

export interface Case {
  id: string;
  office_id: string;
  reference_number: number;
  title: string;
  description?: string;
  status: CaseStatus;
  priority: CasePriority;
  category?: string;
  assigned_to?: string; // References profiles(id)
  created_by?: string; // References profiles(id)
  created_at: string;
  updated_at: string;
  closed_at?: string;
  retention_policy_date?: string;
}

export interface CaseParty {
  id: string;
  office_id: string;
  case_id: string;
  constituent_id?: string;
  organization_id?: string;
  role: string;
  created_at: string;
}

export interface Message {
  id: string;
  office_id: string;
  case_id?: string;
  campaign_id?: string;
  direction: MessageDirection;
  channel: MessageChannel;
  subject?: string;
  snippet?: string;
  storage_path_html?: string;
  storage_path_text?: string;
  message_id_header?: string;
  in_reply_to_header?: string;
  thread_id?: string;
  received_at: string;
  sent_at?: string;
  body_search_text?: string;
  search_vector?: unknown; // tsvector type
}

export interface MessageRecipient {
  id: string;
  office_id: string;
  message_id: string;
  recipient_type: string; // 'to', 'cc', 'bcc', 'from'
  email_address: string;
  name?: string;
  constituent_id?: string;
}

export interface Attachment {
  id: string;
  office_id: string;
  message_id: string;
  filename: string;
  file_size?: number;
  mime_type?: string;
  storage_path: string;
  created_at: string;
}

export interface BulkResponse {
  id: string;
  office_id: string;
  campaign_id: string;
  subject?: string;
  body_markdown?: string;
  created_by?: string; // References profiles(id)
  status: 'draft' | 'pending_approval' | 'approved' | 'sending' | 'sent' | 'rejected';
  created_at: string;
}

export interface BulkResponseLog {
  id: string;
  office_id: string;
  bulk_response_id: string;
  constituent_id: string;
  generated_message_id?: string;
  status: 'pending' | 'sent' | 'failed';
  error_log?: string;
  sent_at?: string;
}

export interface EmailOutboxQueue {
  id: string;
  office_id?: string;
  to_email: string;
  subject: string;
  body_html: string;
  status: 'pending' | 'sent' | 'failed';
  created_at: string;
  error_log?: string;
}

export interface IntegrationOutlookSession {
  office_id: string;
  email?: string;
  storage_state: Record<string, unknown>; // JSONB field
  status: 'active' | 'inactive' | 'expired';
  updated_at: string;
}

export interface BrowserAutomationLock {
  id: number; // Always 1
  is_locked: boolean;
  locked_by_office_id?: string;
  locked_at?: string;
}

export interface AuditLog {
  id: string;
  office_id: string;
  actor_id?: string; // References profiles(id)
  action: AuditAction;
  entity_type: string;
  entity_id?: string;
  metadata: Record<string, unknown>; // JSONB field
  ip_address?: string;
  created_at: string;
}
