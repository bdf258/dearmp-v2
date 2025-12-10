export type UserRole = 'admin' | 'staff' | 'readonly';
export type CaseStatus = 'open' | 'pending' | 'closed' | 'archived';
export type CasePriority = 'low' | 'medium' | 'high' | 'urgent';
export type MessageDirection = 'inbound' | 'outbound';
export type MessageChannel = 'email' | 'phone' | 'letter' | 'meeting' | 'social_media';
export type ContactType = 'email' | 'phone' | 'address' | 'social';
export type AuditAction = 'create' | 'update' | 'delete' | 'view' | 'login' | 'send_email';
export type EmailQueueStatus = 'pending' | 'processing' | 'sent' | 'failed';

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
        Relationships: [];
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
        Relationships: [
          {
            foreignKeyName: "profiles_office_id_fkey";
            columns: ["office_id"];
            referencedRelation: "offices";
            referencedColumns: ["id"];
          }
        ];
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
        Relationships: [
          {
            foreignKeyName: "constituents_office_id_fkey";
            columns: ["office_id"];
            referencedRelation: "offices";
            referencedColumns: ["id"];
          }
        ];
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
        Relationships: [
          {
            foreignKeyName: "constituent_contacts_office_id_fkey";
            columns: ["office_id"];
            referencedRelation: "offices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "constituent_contacts_constituent_id_fkey";
            columns: ["constituent_id"];
            referencedRelation: "constituents";
            referencedColumns: ["id"];
          }
        ];
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
        Relationships: [
          {
            foreignKeyName: "constituent_relationships_office_id_fkey";
            columns: ["office_id"];
            referencedRelation: "offices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "constituent_relationships_constituent_a_id_fkey";
            columns: ["constituent_a_id"];
            referencedRelation: "constituents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "constituent_relationships_constituent_b_id_fkey";
            columns: ["constituent_b_id"];
            referencedRelation: "constituents";
            referencedColumns: ["id"];
          }
        ];
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
        Relationships: [
          {
            foreignKeyName: "organizations_office_id_fkey";
            columns: ["office_id"];
            referencedRelation: "offices";
            referencedColumns: ["id"];
          }
        ];
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
        Relationships: [
          {
            foreignKeyName: "organization_memberships_office_id_fkey";
            columns: ["office_id"];
            referencedRelation: "offices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_memberships_organization_id_fkey";
            columns: ["organization_id"];
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_memberships_constituent_id_fkey";
            columns: ["constituent_id"];
            referencedRelation: "constituents";
            referencedColumns: ["id"];
          }
        ];
      };
      cases: {
        Row: {
          id: string;
          office_id: string;
          reference_number: number;
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
          reference_number?: number;
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
          reference_number?: number;
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
        Relationships: [
          {
            foreignKeyName: "cases_office_id_fkey";
            columns: ["office_id"];
            referencedRelation: "offices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cases_assigned_to_fkey";
            columns: ["assigned_to"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cases_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
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
        Relationships: [
          {
            foreignKeyName: "case_parties_office_id_fkey";
            columns: ["office_id"];
            referencedRelation: "offices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "case_parties_case_id_fkey";
            columns: ["case_id"];
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "case_parties_constituent_id_fkey";
            columns: ["constituent_id"];
            referencedRelation: "constituents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "case_parties_organization_id_fkey";
            columns: ["organization_id"];
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          }
        ];
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
        Relationships: [
          {
            foreignKeyName: "campaigns_office_id_fkey";
            columns: ["office_id"];
            referencedRelation: "offices";
            referencedColumns: ["id"];
          }
        ];
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
        Relationships: [
          {
            foreignKeyName: "messages_office_id_fkey";
            columns: ["office_id"];
            referencedRelation: "offices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_case_id_fkey";
            columns: ["case_id"];
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_campaign_id_fkey";
            columns: ["campaign_id"];
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          }
        ];
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
        Relationships: [
          {
            foreignKeyName: "message_recipients_office_id_fkey";
            columns: ["office_id"];
            referencedRelation: "offices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_recipients_message_id_fkey";
            columns: ["message_id"];
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_recipients_constituent_id_fkey";
            columns: ["constituent_id"];
            referencedRelation: "constituents";
            referencedColumns: ["id"];
          }
        ];
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
        Relationships: [
          {
            foreignKeyName: "attachments_office_id_fkey";
            columns: ["office_id"];
            referencedRelation: "offices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attachments_message_id_fkey";
            columns: ["message_id"];
            referencedRelation: "messages";
            referencedColumns: ["id"];
          }
        ];
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
        Relationships: [
          {
            foreignKeyName: "bulk_responses_office_id_fkey";
            columns: ["office_id"];
            referencedRelation: "offices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bulk_responses_campaign_id_fkey";
            columns: ["campaign_id"];
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bulk_responses_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
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
        Relationships: [
          {
            foreignKeyName: "bulk_response_log_office_id_fkey";
            columns: ["office_id"];
            referencedRelation: "offices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bulk_response_log_bulk_response_id_fkey";
            columns: ["bulk_response_id"];
            referencedRelation: "bulk_responses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bulk_response_log_constituent_id_fkey";
            columns: ["constituent_id"];
            referencedRelation: "constituents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bulk_response_log_generated_message_id_fkey";
            columns: ["generated_message_id"];
            referencedRelation: "messages";
            referencedColumns: ["id"];
          }
        ];
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
        Relationships: [
          {
            foreignKeyName: "tags_office_id_fkey";
            columns: ["office_id"];
            referencedRelation: "offices";
            referencedColumns: ["id"];
          }
        ];
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
        Relationships: [
          {
            foreignKeyName: "tag_assignments_office_id_fkey";
            columns: ["office_id"];
            referencedRelation: "offices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tag_assignments_tag_id_fkey";
            columns: ["tag_id"];
            referencedRelation: "tags";
            referencedColumns: ["id"];
          }
        ];
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
        Relationships: [
          {
            foreignKeyName: "audit_logs_office_id_fkey";
            columns: ["office_id"];
            referencedRelation: "offices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_logs_actor_id_fkey";
            columns: ["actor_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      integration_outlook_sessions: {
        Row: {
          id: string;
          office_id: string;
          cookies: Record<string, unknown>[];
          is_connected: boolean;
          last_used_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          office_id: string;
          cookies: Record<string, unknown>[];
          is_connected?: boolean;
          last_used_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          office_id?: string;
          cookies?: Record<string, unknown>[];
          is_connected?: boolean;
          last_used_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "integration_outlook_sessions_office_id_fkey";
            columns: ["office_id"];
            referencedRelation: "offices";
            referencedColumns: ["id"];
          }
        ];
      };
      email_outbox_queue: {
        Row: {
          id: string;
          office_id: string;
          to_email: string;
          cc_email: string | null;
          bcc_email: string | null;
          subject: string;
          body_html: string;
          status: EmailQueueStatus;
          error_log: string | null;
          case_id: string | null;
          campaign_id: string | null;
          created_at: string;
          processed_at: string | null;
        };
        Insert: {
          id?: string;
          office_id: string;
          to_email: string;
          cc_email?: string | null;
          bcc_email?: string | null;
          subject: string;
          body_html: string;
          status?: EmailQueueStatus;
          error_log?: string | null;
          case_id?: string | null;
          campaign_id?: string | null;
          created_at?: string;
          processed_at?: string | null;
        };
        Update: {
          id?: string;
          office_id?: string;
          to_email?: string;
          cc_email?: string | null;
          bcc_email?: string | null;
          subject?: string;
          body_html?: string;
          status?: EmailQueueStatus;
          error_log?: string | null;
          case_id?: string | null;
          campaign_id?: string | null;
          created_at?: string;
          processed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "email_outbox_queue_office_id_fkey";
            columns: ["office_id"];
            referencedRelation: "offices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "email_outbox_queue_case_id_fkey";
            columns: ["case_id"];
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "email_outbox_queue_campaign_id_fkey";
            columns: ["campaign_id"];
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          }
        ];
      };
      browser_automation_lock: {
        Row: {
          id: number;
          is_locked: boolean;
          locked_by_office_id: string | null;
          locked_at: string | null;
        };
        Insert: {
          id?: number;
          is_locked?: boolean;
          locked_by_office_id?: string | null;
          locked_at?: string | null;
        };
        Update: {
          id?: number;
          is_locked?: boolean;
          locked_by_office_id?: string | null;
          locked_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "browser_automation_lock_locked_by_office_id_fkey";
            columns: ["locked_by_office_id"];
            referencedRelation: "offices";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {};
    Functions: {
      get_my_office_id: {
        Args: Record<string, never>;
        Returns: string;
      };
      generate_campaign_outbox_messages: {
        Args: {
          p_bulk_response_id: string;
          p_office_id: string;
        };
        Returns: {
          queued_count: number;
          error?: string;
        };
      };
      get_constituent_primary_email: {
        Args: {
          p_constituent_id: string;
        };
        Returns: string | null;
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
      email_queue_status: EmailQueueStatus;
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

// Outlook Worker types
export type OutlookSession = Database['public']['Tables']['integration_outlook_sessions']['Row'];
export type EmailOutboxQueue = Database['public']['Tables']['email_outbox_queue']['Row'];
export type BrowserAutomationLock = Database['public']['Tables']['browser_automation_lock']['Row'];

// Insert types
export type OfficeInsert = Database['public']['Tables']['offices']['Insert'];
export type ConstituentInsert = Database['public']['Tables']['constituents']['Insert'];
export type CaseInsert = Database['public']['Tables']['cases']['Insert'];
export type MessageInsert = Database['public']['Tables']['messages']['Insert'];
export type CampaignInsert = Database['public']['Tables']['campaigns']['Insert'];
export type OutlookSessionInsert = Database['public']['Tables']['integration_outlook_sessions']['Insert'];
export type EmailOutboxQueueInsert = Database['public']['Tables']['email_outbox_queue']['Insert'];
export type CasePartyInsert = Database['public']['Tables']['case_parties']['Insert'];
