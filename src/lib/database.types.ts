export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      attachments: {
        Row: {
          created_at: string
          file_size: number | null
          filename: string
          id: string
          message_id: string
          mime_type: string | null
          office_id: string
          storage_path: string
        }
        Insert: {
          created_at?: string | null
          file_size?: number | null
          filename: string
          id?: string
          message_id: string
          mime_type?: string | null
          office_id: string
          storage_path: string
        }
        Update: {
          created_at?: string | null
          file_size?: number | null
          filename?: string
          id?: string
          message_id?: string
          mime_type?: string | null
          office_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          office_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_id?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          office_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          actor_id?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          office_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      browser_automation_lock: {
        Row: {
          id: number
          is_locked: boolean | null
          locked_at: string | null
          locked_by_office_id: string | null
        }
        Insert: {
          id?: number
          is_locked?: boolean | null
          locked_at?: string | null
          locked_by_office_id?: string | null
        }
        Update: {
          id?: number
          is_locked?: boolean | null
          locked_at?: string | null
          locked_by_office_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "browser_automation_lock_locked_by_office_id_fkey"
            columns: ["locked_by_office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      bulk_response_log: {
        Row: {
          bulk_response_id: string
          constituent_id: string
          error_log: string | null
          generated_message_id: string | null
          id: string
          office_id: string
          sent_at: string
          status: string | null
        }
        Insert: {
          bulk_response_id: string
          constituent_id: string
          error_log?: string | null
          generated_message_id?: string | null
          id?: string
          office_id: string
          sent_at?: string | null
          status?: string | null
        }
        Update: {
          bulk_response_id?: string
          constituent_id?: string
          error_log?: string | null
          generated_message_id?: string | null
          id?: string
          office_id?: string
          sent_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bulk_response_log_bulk_response_id_fkey"
            columns: ["bulk_response_id"]
            isOneToOne: false
            referencedRelation: "bulk_responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_response_log_constituent_id_fkey"
            columns: ["constituent_id"]
            isOneToOne: false
            referencedRelation: "constituents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_response_log_generated_message_id_fkey"
            columns: ["generated_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_response_log_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      bulk_responses: {
        Row: {
          body_markdown: string | null
          campaign_id: string
          created_at: string
          created_by: string | null
          id: string
          office_id: string
          status: string | null
          subject: string | null
        }
        Insert: {
          body_markdown?: string | null
          campaign_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          office_id: string
          status?: string | null
          subject?: string | null
        }
        Update: {
          body_markdown?: string | null
          campaign_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          office_id?: string
          status?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bulk_responses_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_responses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_responses_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string
          description: string | null
          fingerprint_hash: string | null
          id: string
          name: string
          office_id: string
          status: string | null
          subject_pattern: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          fingerprint_hash?: string | null
          id?: string
          name: string
          office_id: string
          status?: string | null
          subject_pattern?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          fingerprint_hash?: string | null
          id?: string
          name?: string
          office_id?: string
          status?: string | null
          subject_pattern?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      case_parties: {
        Row: {
          case_id: string
          constituent_id: string | null
          created_at: string
          id: string
          office_id: string
          organization_id: string | null
          role: string
        }
        Insert: {
          case_id: string
          constituent_id?: string | null
          created_at?: string | null
          id?: string
          office_id: string
          organization_id?: string | null
          role: string
        }
        Update: {
          case_id?: string
          constituent_id?: string | null
          created_at?: string | null
          id?: string
          office_id?: string
          organization_id?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_parties_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_parties_constituent_id_fkey"
            columns: ["constituent_id"]
            isOneToOne: false
            referencedRelation: "constituents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_parties_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_parties_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          assigned_to: string | null
          category: string | null
          closed_at: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          office_id: string
          priority: Database["public"]["Enums"]["case_priority"] | null
          reference_number?: number
          retention_policy_date: string | null
          status: Database["public"]["Enums"]["case_status"] | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string | null
          closed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          office_id: string
          priority?: Database["public"]["Enums"]["case_priority"] | null
          reference_number?: number
          retention_policy_date?: string | null
          status?: Database["public"]["Enums"]["case_status"] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          category?: string | null
          closed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          office_id?: string
          priority?: Database["public"]["Enums"]["case_priority"] | null
          reference_number?: number
          retention_policy_date?: string | null
          status?: Database["public"]["Enums"]["case_status"] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cases_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      constituent_contacts: {
        Row: {
          constituent_id: string
          created_at: string
          id: string
          is_primary: boolean | null
          office_id: string
          type: Database["public"]["Enums"]["contact_type"]
          value: string
        }
        Insert: {
          constituent_id: string
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          office_id: string
          type: Database["public"]["Enums"]["contact_type"]
          value: string
        }
        Update: {
          constituent_id?: string
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          office_id?: string
          type?: Database["public"]["Enums"]["contact_type"]
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "constituent_contacts_constituent_id_fkey"
            columns: ["constituent_id"]
            isOneToOne: false
            referencedRelation: "constituents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "constituent_contacts_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      constituent_relationships: {
        Row: {
          constituent_a_id: string
          constituent_b_id: string
          created_at: string
          id: string
          office_id: string
          relationship_type: string
        }
        Insert: {
          constituent_a_id: string
          constituent_b_id: string
          created_at?: string | null
          id?: string
          office_id: string
          relationship_type: string
        }
        Update: {
          constituent_a_id?: string
          constituent_b_id?: string
          created_at?: string | null
          id?: string
          office_id?: string
          relationship_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "constituent_relationships_constituent_a_id_fkey"
            columns: ["constituent_a_id"]
            isOneToOne: false
            referencedRelation: "constituents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "constituent_relationships_constituent_b_id_fkey"
            columns: ["constituent_b_id"]
            isOneToOne: false
            referencedRelation: "constituents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "constituent_relationships_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      constituents: {
        Row: {
          created_at: string
          full_name: string
          id: string
          notes: string | null
          office_id: string
          salutation: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string | null
          full_name: string
          id?: string
          notes?: string | null
          office_id: string
          salutation?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          office_id?: string
          salutation?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "constituents_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      email_outbox_queue: {
        Row: {
          bcc_email: string | null
          body_html: string
          campaign_id: string | null
          case_id: string | null
          cc_email: string | null
          created_at: string
          error_log: string | null
          id: string
          office_id: string
          processed_at: string
          status: string | null
          subject: string
          to_email: string
        }
        Insert: {
          bcc_email?: string | null
          body_html: string
          campaign_id?: string | null
          case_id?: string | null
          cc_email?: string | null
          created_at?: string | null
          error_log?: string | null
          id?: string
          office_id: string
          processed_at?: string | null
          status?: string | null
          subject: string
          to_email: string
        }
        Update: {
          bcc_email?: string | null
          body_html?: string
          campaign_id?: string | null
          case_id?: string | null
          cc_email?: string | null
          created_at?: string | null
          error_log?: string | null
          id?: string
          office_id?: string
          processed_at?: string | null
          status?: string | null
          subject?: string
          to_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_outbox_queue_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_outbox_queue_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_outbox_queue_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_outlook_sessions: {
        Row: {
          cookies: Json[]
          created_at: string
          id: string
          is_connected: boolean | null
          last_used_at: string
          office_id: string
          origins: Json | null
          updated_at: string
        }
        Insert: {
          cookies: Json[]
          created_at?: string | null
          id?: string
          is_connected?: boolean | null
          last_used_at?: string | null
          office_id: string
          origins?: Json | null
          updated_at?: string | null
        }
        Update: {
          cookies?: Json[]
          created_at?: string | null
          id?: string
          is_connected?: boolean | null
          last_used_at?: string | null
          office_id?: string
          origins?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_outlook_sessions_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: true
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      message_recipients: {
        Row: {
          constituent_id: string | null
          email_address: string
          id: string
          message_id: string
          name: string | null
          office_id: string
          recipient_type: string
        }
        Insert: {
          constituent_id?: string | null
          email_address: string
          id?: string
          message_id: string
          name?: string | null
          office_id: string
          recipient_type: string
        }
        Update: {
          constituent_id?: string | null
          email_address?: string
          id?: string
          message_id?: string
          name?: string | null
          office_id?: string
          recipient_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_recipients_constituent_id_fkey"
            columns: ["constituent_id"]
            isOneToOne: false
            referencedRelation: "constituents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_recipients_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_recipients_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body_search_text: string | null
          campaign_id: string | null
          case_id: string | null
          channel: Database["public"]["Enums"]["message_channel"] | null
          direction: Database["public"]["Enums"]["message_direction"]
          id: string
          in_reply_to_header: string | null
          message_id_header: string | null
          office_id: string
          received_at: string
          search_vector: unknown
          sent_at: string
          snippet: string | null
          storage_path_html: string | null
          storage_path_text: string | null
          subject: string | null
          thread_id: string | null
        }
        Insert: {
          body_search_text?: string | null
          campaign_id?: string | null
          case_id?: string | null
          channel?: Database["public"]["Enums"]["message_channel"] | null
          direction: Database["public"]["Enums"]["message_direction"]
          id?: string
          in_reply_to_header?: string | null
          message_id_header?: string | null
          office_id: string
          received_at?: string | null
          search_vector?: unknown
          sent_at?: string | null
          snippet?: string | null
          storage_path_html?: string | null
          storage_path_text?: string | null
          subject?: string | null
          thread_id?: string | null
        }
        Update: {
          body_search_text?: string | null
          campaign_id?: string | null
          case_id?: string | null
          channel?: Database["public"]["Enums"]["message_channel"] | null
          direction?: Database["public"]["Enums"]["message_direction"]
          id?: string
          in_reply_to_header?: string | null
          message_id_header?: string | null
          office_id?: string
          received_at?: string | null
          search_vector?: unknown
          sent_at?: string | null
          snippet?: string | null
          storage_path_html?: string | null
          storage_path_text?: string | null
          subject?: string | null
          thread_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      note_replies: {
        Row: {
          body: string
          created_at: string
          created_by: string
          id: string
          note_id: string
          office_id: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string | null
          created_by: string
          id?: string
          note_id: string
          office_id: string
          updated_at?: string | null
        }
        Update: {
          body?: string
          created_at?: string | null
          created_by?: string
          id?: string
          note_id?: string
          office_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "note_replies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_replies_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_replies_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          body: string
          campaign_id: string | null
          case_id: string | null
          created_at: string
          created_by: string
          id: string
          office_id: string
          thread_id: string | null
          updated_at: string
        }
        Insert: {
          body: string
          campaign_id?: string | null
          case_id?: string | null
          created_at?: string | null
          created_by: string
          id?: string
          office_id: string
          thread_id?: string | null
          updated_at?: string | null
        }
        Update: {
          body?: string
          campaign_id?: string | null
          case_id?: string | null
          created_at?: string | null
          created_by?: string
          id?: string
          office_id?: string
          thread_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      offices: {
        Row: {
          created_at: string
          domain: string | null
          id: string
          name: string
          settings: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string | null
          domain?: string | null
          id?: string
          name: string
          settings?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          domain?: string | null
          id?: string
          name?: string
          settings?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      organization_memberships: {
        Row: {
          constituent_id: string
          created_at: string
          id: string
          office_id: string
          organization_id: string
          role_title: string | null
        }
        Insert: {
          constituent_id: string
          created_at?: string | null
          id?: string
          office_id: string
          organization_id: string
          role_title?: string | null
        }
        Update: {
          constituent_id?: string
          created_at?: string | null
          id?: string
          office_id?: string
          organization_id?: string
          role_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_memberships_constituent_id_fkey"
            columns: ["constituent_id"]
            isOneToOne: false
            referencedRelation: "constituents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_memberships_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          office_id: string
          type: string | null
          website: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          office_id: string
          type?: string | null
          website?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          office_id?: string
          type?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          office_id: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id: string
          office_id?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          office_id?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      rejected_emails: {
        Row: {
          id: string
          received_at: string
          rejection_reason: string | null
          sender_email: string
          sender_name: string | null
          subject: string | null
          target_email: string
        }
        Insert: {
          id?: string
          received_at?: string | null
          rejection_reason?: string | null
          sender_email: string
          sender_name?: string | null
          subject?: string | null
          target_email: string
        }
        Update: {
          id?: string
          received_at?: string | null
          rejection_reason?: string | null
          sender_email?: string
          sender_name?: string | null
          subject?: string | null
          target_email?: string
        }
        Relationships: []
      }
      tag_assignments: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          office_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string | null
          entity_id: string
          entity_type: string
          id?: string
          office_id: string
          tag_id: string
        }
        Update: {
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          office_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tag_assignments_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tag_assignments_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          office_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
          office_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
          office_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_campaign_outbox_messages: {
        Args: { p_bulk_response_id: string; p_office_id: string }
        Returns: Json
      }
      get_constituent_primary_email: {
        Args: { p_constituent_id: string }
        Returns: string
      }
      get_my_office_id: { Args: never; Returns: string }
      ingest_inbound_email: {
        Args: {
          p_attachments: Json
          p_body_html: string
          p_body_text: string
          p_message_id_header: string
          p_sender_email: string
          p_sender_name: string
          p_subject: string
          p_target_email: string
        }
        Returns: string
      }
      process_bulk_response_approval: {
        Args: { p_approver_user_id: string; p_bulk_response_id: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      audit_action:
        | "create"
        | "update"
        | "delete"
        | "view"
        | "login"
        | "send_email"
      case_priority: "low" | "medium" | "high" | "urgent"
      case_status: "open" | "pending" | "closed" | "archived"
      contact_type: "email" | "phone" | "address" | "social"
      message_channel: "email" | "phone" | "letter" | "meeting" | "social_media"
      message_direction: "inbound" | "outbound"
      user_role: "admin" | "staff" | "readonly"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      audit_action: [
        "create",
        "update",
        "delete",
        "view",
        "login",
        "send_email",
      ],
      case_priority: ["low", "medium", "high", "urgent"],
      case_status: ["open", "pending", "closed", "archived"],
      contact_type: ["email", "phone", "address", "social"],
      message_channel: ["email", "phone", "letter", "meeting", "social_media"],
      message_direction: ["inbound", "outbound"],
      user_role: ["admin", "staff", "readonly"],
    },
  },
} as const

// Custom type aliases for convenience
export type UserRole = 'admin' | 'staff' | 'readonly';
export type CaseStatus = 'open' | 'pending' | 'closed' | 'archived';
export type CasePriority = 'low' | 'medium' | 'high' | 'urgent';
export type MessageDirection = 'inbound' | 'outbound';
export type MessageChannel = 'email' | 'phone' | 'letter' | 'meeting' | 'social_media';
export type ContactType = 'email' | 'phone' | 'address' | 'social';
export type AuditAction = 'create' | 'update' | 'delete' | 'view' | 'login' | 'send_email';
export type EmailQueueStatus = 'pending' | 'processing' | 'sent' | 'failed';

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
export type RejectedEmail = Database['public']['Tables']['rejected_emails']['Row'];

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
export type MessageUpdate = Database['public']['Tables']['messages']['Update'];

// Notes types
export type Note = Database['public']['Tables']['notes']['Row'];
export type NoteReply = Database['public']['Tables']['note_replies']['Row'];
export type NoteInsert = Database['public']['Tables']['notes']['Insert'];
export type NoteReplyInsert = Database['public']['Tables']['note_replies']['Insert'];
export type TagAssignmentInsert = Database['public']['Tables']['tag_assignments']['Insert'];
