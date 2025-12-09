export type UserRole = 'admin' | 'staff' | 'readonly';
export type CaseStatus = 'open' | 'pending' | 'closed' | 'archived';
export type CasePriority = 'low' | 'medium' | 'high' | 'urgent';
export type MessageDirection = 'inbound' | 'outbound';
export type MessageChannel = 'email' | 'phone' | 'letter' | 'meeting' | 'social_media';
export type ContactType = 'email' | 'phone' | 'address' | 'social';
export type AuditAction = 'create' | 'update' | 'delete' | 'view' | 'login' | 'send_email';

export interface Database {
  public: {
    Tables: {
      offices: {
        Row: {
          id: string;
          name: string;
          domain: string | null;
          settings: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          domain?: string | null;
          settings?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          domain?: string | null;
          settings?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          office_id: string | null;
          full_name: string | null;
          role: UserRole;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          office_id?: string | null;
          full_name?: string | null;
          role?: UserRole;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          office_id?: string | null;
          full_name?: string | null;
          role?: UserRole;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      constituents: {
        Row: {
          id: string;
          office_id: string;
          full_name: string;
          salutation: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          office_id: string;
          full_name: string;
          salutation?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          office_id?: string;
          full_name?: string;
          salutation?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      constituent_contacts: {
        Row: {
          id: string;
          office_id: string;
          constituent_id: string;
          type: ContactType;
          value: string;
          is_primary: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          office_id: string;
          constituent_id: string;
          type: ContactType;
          value: string;
          is_primary?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          office_id?: string;
          constituent_id?: string;
          type?: ContactType;
          value?: string;
          is_primary?: boolean;
          created_at?: string;
        };
      };
      constituent_relationships: {
        Row: {
          id: string;
          office_id: string;
          constituent_a_id: string;
          constituent_b_id: string;
          relationship_type: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          office_id: string;
          constituent_a_id: string;
          constituent_b_id: string;
          relationship_type: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          office_id?: string;
          constituent_a_id?: string;
          constituent_b_id?: string;
          relationship_type?: string;
          created_at?: string;
        };
      };
      organizations: {
        Row: {
          id: string;
          office_id: string;
          name: string;
          type: string | null;
          website: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          office_id: string;
          name: string;
          type?: string | null;
          website?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          office_id?: string;
          name?: string;
          type?: string | null;
          website?: string | null;
          created_at?: string;
        };
      };
      organization_memberships: {
        Row: {
          id: string;
          office_id: string;
          organization_id: string;
          constituent_id: string;
          role_title: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          office_id: string;
          organization_id: string;
          constituent_id: string;
          role_title?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          office_id?: string;
          organization_id?: string;
          constituent_id?: string;
          role_title?: string | null;
          created_at?: string;
        };
      };
      cases: {
        Row: {
          id: string;
          office_id: string;
          reference_number: number | null;
          title: string;
          description: string | null;
          status: CaseStatus;
          priority: CasePriority;
          category: string | null;
          assigned_to: string | null;
          created_by: string | null;
          retention_policy_date: string | null;
          created_at: string;
          updated_at: string;
          closed_at: string | null;
        };
        Insert: {
          id?: string;
          office_id: string;
          reference_number?: number | null;
          title: string;
          description?: string | null;
          status?: CaseStatus;
          priority?: CasePriority;
          category?: string | null;
          assigned_to?: string | null;
          created_by?: string | null;
          retention_policy_date?: string | null;
          created_at?: string;
          updated_at?: string;
          closed_at?: string | null;
        };
        Update: {
          id?: string;
          office_id?: string;
          reference_number?: number | null;
          title?: string;
          description?: string | null;
          status?: CaseStatus;
          priority?: CasePriority;
          category?: string | null;
          assigned_to?: string | null;
          created_by?: string | null;
          retention_policy_date?: string | null;
          created_at?: string;
          updated_at?: string;
          closed_at?: string | null;
        };
      };
      case_parties: {
        Row: {
          id: string;
          office_id: string;
          case_id: string;
          constituent_id: string | null;
          organization_id: string | null;
          role: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          office_id: string;
          case_id: string;
          constituent_id?: string | null;
          organization_id?: string | null;
          role: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          office_id?: string;
          case_id?: string;
          constituent_id?: string | null;
          organization_id?: string | null;
          role?: string;
          created_at?: string;
        };
      };
      campaigns: {
        Row: {
          id: string;
          office_id: string;
          name: string;
          description: string | null;
          status: string;
          subject_pattern: string | null;
          fingerprint_hash: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          office_id: string;
          name: string;
          description?: string | null;
          status?: string;
          subject_pattern?: string | null;
          fingerprint_hash?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          office_id?: string;
          name?: string;
          description?: string | null;
          status?: string;
          subject_pattern?: string | null;
          fingerprint_hash?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          office_id: string;
          case_id: string | null;
          campaign_id: string | null;
          direction: MessageDirection;
          channel: MessageChannel;
          subject: string | null;
          snippet: string | null;
          storage_path_html: string | null;
          storage_path_text: string | null;
          body_search_text: string | null;
          message_id_header: string | null;
          in_reply_to_header: string | null;
          thread_id: string | null;
          received_at: string;
          sent_at: string | null;
        };
        Insert: {
          id?: string;
          office_id: string;
          case_id?: string | null;
          campaign_id?: string | null;
          direction: MessageDirection;
          channel?: MessageChannel;
          subject?: string | null;
          snippet?: string | null;
          storage_path_html?: string | null;
          storage_path_text?: string | null;
          body_search_text?: string | null;
          message_id_header?: string | null;
          in_reply_to_header?: string | null;
          thread_id?: string | null;
          received_at?: string;
          sent_at?: string | null;
        };
        Update: {
          id?: string;
          office_id?: string;
          case_id?: string | null;
          campaign_id?: string | null;
          direction?: MessageDirection;
          channel?: MessageChannel;
          subject?: string | null;
          snippet?: string | null;
          storage_path_html?: string | null;
          storage_path_text?: string | null;
          body_search_text?: string | null;
          message_id_header?: string | null;
          in_reply_to_header?: string | null;
          thread_id?: string | null;
          received_at?: string;
          sent_at?: string | null;
        };
      };
      message_recipients: {
        Row: {
          id: string;
          office_id: string;
          message_id: string;
          recipient_type: string;
          email_address: string;
          name: string | null;
          constituent_id: string | null;
        };
        Insert: {
          id?: string;
          office_id: string;
          message_id: string;
          recipient_type: string;
          email_address: string;
          name?: string | null;
          constituent_id?: string | null;
        };
        Update: {
          id?: string;
          office_id?: string;
          message_id?: string;
          recipient_type?: string;
          email_address?: string;
          name?: string | null;
          constituent_id?: string | null;
        };
      };
      attachments: {
        Row: {
          id: string;
          office_id: string;
          message_id: string;
          filename: string;
          file_size: number | null;
          mime_type: string | null;
          storage_path: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          office_id: string;
          message_id: string;
          filename: string;
          file_size?: number | null;
          mime_type?: string | null;
          storage_path: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          office_id?: string;
          message_id?: string;
          filename?: string;
          file_size?: number | null;
          mime_type?: string | null;
          storage_path?: string;
          created_at?: string;
        };
      };
      bulk_responses: {
        Row: {
          id: string;
          office_id: string;
          campaign_id: string;
          subject: string | null;
          body_markdown: string | null;
          created_by: string | null;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          office_id: string;
          campaign_id: string;
          subject?: string | null;
          body_markdown?: string | null;
          created_by?: string | null;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          office_id?: string;
          campaign_id?: string;
          subject?: string | null;
          body_markdown?: string | null;
          created_by?: string | null;
          status?: string;
          created_at?: string;
        };
      };
      bulk_response_log: {
        Row: {
          id: string;
          office_id: string;
          bulk_response_id: string;
          constituent_id: string;
          generated_message_id: string | null;
          status: string;
          error_log: string | null;
          sent_at: string | null;
        };
        Insert: {
          id?: string;
          office_id: string;
          bulk_response_id: string;
          constituent_id: string;
          generated_message_id?: string | null;
          status?: string;
          error_log?: string | null;
          sent_at?: string | null;
        };
        Update: {
          id?: string;
          office_id?: string;
          bulk_response_id?: string;
          constituent_id?: string;
          generated_message_id?: string | null;
          status?: string;
          error_log?: string | null;
          sent_at?: string | null;
        };
      };
      tags: {
        Row: {
          id: string;
          office_id: string;
          name: string;
          color: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          office_id: string;
          name: string;
          color?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          office_id?: string;
          name?: string;
          color?: string;
          created_at?: string;
        };
      };
      tag_assignments: {
        Row: {
          id: string;
          office_id: string;
          tag_id: string;
          entity_type: string;
          entity_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          office_id: string;
          tag_id: string;
          entity_type: string;
          entity_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          office_id?: string;
          tag_id?: string;
          entity_type?: string;
          entity_id?: string;
          created_at?: string;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          office_id: string;
          actor_id: string | null;
          action: AuditAction;
          entity_type: string;
          entity_id: string | null;
          metadata: Record<string, unknown>;
          ip_address: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          office_id: string;
          actor_id?: string | null;
          action: AuditAction;
          entity_type: string;
          entity_id?: string | null;
          metadata?: Record<string, unknown>;
          ip_address?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          office_id?: string;
          actor_id?: string | null;
          action?: AuditAction;
          entity_type?: string;
          entity_id?: string | null;
          metadata?: Record<string, unknown>;
          ip_address?: string | null;
          created_at?: string;
        };
      };
    };
    Views: {};
    Functions: {
      get_my_office_id: {
        Args: Record<string, never>;
        Returns: string;
      };
    };
    Enums: {
      user_role: UserRole;
      case_status: CaseStatus;
      case_priority: CasePriority;
      message_direction: MessageDirection;
      message_channel: MessageChannel;
      contact_type: ContactType;
      audit_action: AuditAction;
    };
  };
}

// Convenience type aliases
export type Office = Database['public']['Tables']['offices']['Row'];
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Constituent = Database['public']['Tables']['constituents']['Row'];
export type ConstituentContact = Database['public']['Tables']['constituent_contacts']['Row'];
export type ConstituentRelationship = Database['public']['Tables']['constituent_relationships']['Row'];
export type Organization = Database['public']['Tables']['organizations']['Row'];
export type OrganizationMembership = Database['public']['Tables']['organization_memberships']['Row'];
export type Case = Database['public']['Tables']['cases']['Row'];
export type CaseParty = Database['public']['Tables']['case_parties']['Row'];
export type Campaign = Database['public']['Tables']['campaigns']['Row'];
export type Message = Database['public']['Tables']['messages']['Row'];
export type MessageRecipient = Database['public']['Tables']['message_recipients']['Row'];
export type Attachment = Database['public']['Tables']['attachments']['Row'];
export type BulkResponse = Database['public']['Tables']['bulk_responses']['Row'];
export type BulkResponseLog = Database['public']['Tables']['bulk_response_log']['Row'];
export type Tag = Database['public']['Tables']['tags']['Row'];
export type TagAssignment = Database['public']['Tables']['tag_assignments']['Row'];
export type AuditLog = Database['public']['Tables']['audit_logs']['Row'];

// Insert types
export type OfficeInsert = Database['public']['Tables']['offices']['Insert'];
export type ConstituentInsert = Database['public']['Tables']['constituents']['Insert'];
export type CaseInsert = Database['public']['Tables']['cases']['Insert'];
export type MessageInsert = Database['public']['Tables']['messages']['Insert'];
export type CampaignInsert = Database['public']['Tables']['campaigns']['Insert'];
