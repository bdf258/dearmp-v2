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
          created_at: string | null
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
            foreignKeyName: "attachments_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments_default: {
        Row: {
          created_at: string | null
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
        Relationships: []
      }
      audit_alert_queue: {
        Row: {
          audit_log_id: string
          created_at: string | null
          error_message: string | null
          id: string
          office_id: string
          processed_at: string | null
          retry_count: number | null
          severity: string
        }
        Insert: {
          audit_log_id: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          office_id: string
          processed_at?: string | null
          retry_count?: number | null
          severity: string
        }
        Update: {
          audit_log_id?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          office_id?: string
          processed_at?: string | null
          retry_count?: number | null
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_alert_queue_office_id_fkey"
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
          alert_sent_at: string | null
          created_at: string | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          office_id: string
          requires_alert: boolean | null
          severity: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_id?: string | null
          alert_sent_at?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          office_id: string
          requires_alert?: boolean | null
          severity?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          actor_id?: string | null
          alert_sent_at?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          office_id?: string
          requires_alert?: boolean | null
          severity?: string | null
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
      audit_logs_default: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_id: string | null
          alert_sent_at: string | null
          created_at: string | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          office_id: string
          requires_alert: boolean | null
          severity: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_id?: string | null
          alert_sent_at?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          office_id: string
          requires_alert?: boolean | null
          severity?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          actor_id?: string | null
          alert_sent_at?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          office_id?: string
          requires_alert?: boolean | null
          severity?: string | null
        }
        Relationships: []
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
          sent_at: string | null
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
          created_at: string | null
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
          canonical_body_preview: string | null
          canonical_subject: string | null
          created_at: string | null
          description: string | null
          fingerprint_hash: string | null
          first_seen_at: string | null
          id: string
          message_count: number | null
          name: string
          office_id: string | null
          status: string | null
          subject_pattern: string | null
          updated_at: string | null
        }
        Insert: {
          canonical_body_preview?: string | null
          canonical_subject?: string | null
          created_at?: string | null
          description?: string | null
          fingerprint_hash?: string | null
          first_seen_at?: string | null
          id?: string
          message_count?: number | null
          name: string
          office_id?: string | null
          status?: string | null
          subject_pattern?: string | null
          updated_at?: string | null
        }
        Update: {
          canonical_body_preview?: string | null
          canonical_subject?: string | null
          created_at?: string | null
          description?: string | null
          fingerprint_hash?: string | null
          first_seen_at?: string | null
          id?: string
          message_count?: number | null
          name?: string
          office_id?: string | null
          status?: string | null
          subject_pattern?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      case_parties: {
        Row: {
          case_id: string
          constituent_id: string | null
          created_at: string | null
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
          case_type: Database["public"]["Enums"]["case_type"] | null
          category: string | null
          closed_at: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          office_id: string
          priority: Database["public"]["Enums"]["case_priority"] | null
          reference_number: number
          retention_policy_date: string | null
          review_date: string | null
          status: Database["public"]["Enums"]["case_status"] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          case_type?: Database["public"]["Enums"]["case_type"] | null
          category?: string | null
          closed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          office_id: string
          priority?: Database["public"]["Enums"]["case_priority"] | null
          reference_number: number
          retention_policy_date?: string | null
          review_date?: string | null
          status?: Database["public"]["Enums"]["case_status"] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          case_type?: Database["public"]["Enums"]["case_type"] | null
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
          review_date?: string | null
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
          created_at: string | null
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
          created_at: string | null
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
          created_at: string | null
          full_name: string
          id: string
          notes: string | null
          office_id: string
          salutation: string | null
          updated_at: string | null
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
          created_at: string | null
          error_log: string | null
          id: string
          office_id: string
          processed_at: string | null
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
          created_at: string | null
          id: string
          is_connected: boolean | null
          last_used_at: string | null
          office_id: string
          origins: Json | null
          updated_at: string | null
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
      login_attempts: {
        Row: {
          attempted_at: string | null
          email: string
          id: string
          ip_address: string | null
          success: boolean | null
        }
        Insert: {
          attempted_at?: string | null
          email: string
          id?: string
          ip_address?: string | null
          success?: boolean | null
        }
        Update: {
          attempted_at?: string | null
          email?: string
          id?: string
          ip_address?: string | null
          success?: boolean | null
        }
        Relationships: []
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
          ai_processed_at: string | null
          body_search_text: string | null
          campaign_id: string | null
          case_id: string | null
          channel: Database["public"]["Enums"]["message_channel"] | null
          classification_confidence: number | null
          classification_reasoning: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          direction: Database["public"]["Enums"]["message_direction"]
          email_type: string | null
          fingerprint_hash: string | null
          id: string
          in_reply_to_header: string | null
          is_campaign_email: boolean | null
          is_policy_email: boolean | null
          message_id_header: string | null
          office_id: string
          received_at: string | null
          search_vector: unknown
          sent_at: string | null
          snippet: string | null
          storage_path_html: string | null
          storage_path_text: string | null
          subject: string | null
          thread_id: string | null
          triage_metadata: Json | null
          triage_status: Database["public"]["Enums"]["triage_status"] | null
          triaged_at: string | null
          triaged_by: string | null
        }
        Insert: {
          ai_processed_at?: string | null
          body_search_text?: string | null
          campaign_id?: string | null
          case_id?: string | null
          channel?: Database["public"]["Enums"]["message_channel"] | null
          classification_confidence?: number | null
          classification_reasoning?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          direction: Database["public"]["Enums"]["message_direction"]
          email_type?: string | null
          fingerprint_hash?: string | null
          id?: string
          in_reply_to_header?: string | null
          is_campaign_email?: boolean | null
          is_policy_email?: boolean | null
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
          triage_metadata?: Json | null
          triage_status?: Database["public"]["Enums"]["triage_status"] | null
          triaged_at?: string | null
          triaged_by?: string | null
        }
        Update: {
          ai_processed_at?: string | null
          body_search_text?: string | null
          campaign_id?: string | null
          case_id?: string | null
          channel?: Database["public"]["Enums"]["message_channel"] | null
          classification_confidence?: number | null
          classification_reasoning?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          direction?: Database["public"]["Enums"]["message_direction"]
          email_type?: string | null
          fingerprint_hash?: string | null
          id?: string
          in_reply_to_header?: string | null
          is_campaign_email?: boolean | null
          is_policy_email?: boolean | null
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
          triage_metadata?: Json | null
          triage_status?: Database["public"]["Enums"]["triage_status"] | null
          triaged_at?: string | null
          triaged_by?: string | null
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
      messages_default: {
        Row: {
          ai_processed_at: string | null
          body_search_text: string | null
          campaign_id: string | null
          case_id: string | null
          channel: Database["public"]["Enums"]["message_channel"] | null
          classification_confidence: number | null
          classification_reasoning: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          direction: Database["public"]["Enums"]["message_direction"]
          email_type: string | null
          fingerprint_hash: string | null
          id: string
          in_reply_to_header: string | null
          is_campaign_email: boolean | null
          is_policy_email: boolean | null
          message_id_header: string | null
          office_id: string
          received_at: string | null
          search_vector: unknown
          sent_at: string | null
          snippet: string | null
          storage_path_html: string | null
          storage_path_text: string | null
          subject: string | null
          thread_id: string | null
          triage_metadata: Json | null
          triage_status: Database["public"]["Enums"]["triage_status"] | null
          triaged_at: string | null
          triaged_by: string | null
        }
        Insert: {
          ai_processed_at?: string | null
          body_search_text?: string | null
          campaign_id?: string | null
          case_id?: string | null
          channel?: Database["public"]["Enums"]["message_channel"] | null
          classification_confidence?: number | null
          classification_reasoning?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          direction: Database["public"]["Enums"]["message_direction"]
          email_type?: string | null
          fingerprint_hash?: string | null
          id?: string
          in_reply_to_header?: string | null
          is_campaign_email?: boolean | null
          is_policy_email?: boolean | null
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
          triage_metadata?: Json | null
          triage_status?: Database["public"]["Enums"]["triage_status"] | null
          triaged_at?: string | null
          triaged_by?: string | null
        }
        Update: {
          ai_processed_at?: string | null
          body_search_text?: string | null
          campaign_id?: string | null
          case_id?: string | null
          channel?: Database["public"]["Enums"]["message_channel"] | null
          classification_confidence?: number | null
          classification_reasoning?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          direction?: Database["public"]["Enums"]["message_direction"]
          email_type?: string | null
          fingerprint_hash?: string | null
          id?: string
          in_reply_to_header?: string | null
          is_campaign_email?: boolean | null
          is_policy_email?: boolean | null
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
          triage_metadata?: Json | null
          triage_status?: Database["public"]["Enums"]["triage_status"] | null
          triaged_at?: string | null
          triaged_by?: string | null
        }
        Relationships: []
      }
      note_replies: {
        Row: {
          body: string
          created_at: string | null
          created_by: string
          id: string
          note_id: string
          office_id: string
          updated_at: string | null
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
          created_at: string | null
          created_by: string
          id: string
          office_id: string
          thread_id: string | null
          updated_at: string | null
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
      office_invitations: {
        Row: {
          created_at: string | null
          created_by: string | null
          email: string | null
          expires_at: string
          id: string
          max_uses: number | null
          office_id: string
          role: Database["public"]["Enums"]["user_role"]
          token: string
          use_count: number | null
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          expires_at?: string
          id?: string
          max_uses?: number | null
          office_id: string
          role?: Database["public"]["Enums"]["user_role"]
          token?: string
          use_count?: number | null
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          expires_at?: string
          id?: string
          max_uses?: number | null
          office_id?: string
          role?: Database["public"]["Enums"]["user_role"]
          token?: string
          use_count?: number | null
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "office_invitations_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      office_settings: {
        Row: {
          ai_classification_enabled: boolean | null
          ai_draft_response_enabled: boolean | null
          ai_tagging_enabled: boolean | null
          auto_assign_enabled: boolean | null
          casework_acknowledgment_enabled: boolean | null
          created_at: string | null
          default_casework_assignee: string | null
          default_policy_assignee: string | null
          id: string
          inbound_email: string | null
          mp_email: string | null
          mp_name: string | null
          office_id: string
          policy_response_style: string | null
          round_robin_enabled: boolean | null
          signature_template: string | null
          updated_at: string | null
        }
        Insert: {
          ai_classification_enabled?: boolean | null
          ai_draft_response_enabled?: boolean | null
          ai_tagging_enabled?: boolean | null
          auto_assign_enabled?: boolean | null
          casework_acknowledgment_enabled?: boolean | null
          created_at?: string | null
          default_casework_assignee?: string | null
          default_policy_assignee?: string | null
          id?: string
          inbound_email?: string | null
          mp_email?: string | null
          mp_name?: string | null
          office_id: string
          policy_response_style?: string | null
          round_robin_enabled?: boolean | null
          signature_template?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_classification_enabled?: boolean | null
          ai_draft_response_enabled?: boolean | null
          ai_tagging_enabled?: boolean | null
          auto_assign_enabled?: boolean | null
          casework_acknowledgment_enabled?: boolean | null
          created_at?: string | null
          default_casework_assignee?: string | null
          default_policy_assignee?: string | null
          id?: string
          inbound_email?: string | null
          mp_email?: string | null
          mp_name?: string | null
          office_id?: string
          policy_response_style?: string | null
          round_robin_enabled?: boolean | null
          signature_template?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "office_settings_default_casework_assignee_fkey"
            columns: ["default_casework_assignee"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "office_settings_default_policy_assignee_fkey"
            columns: ["default_policy_assignee"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "office_settings_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: true
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      offices: {
        Row: {
          created_at: string | null
          domain: string | null
          id: string
          name: string
          settings: Json | null
          updated_at: string | null
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
          created_at: string | null
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
          created_at: string | null
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
          created_at: string | null
          full_name: string | null
          id: string
          mfa_enabled: boolean | null
          mfa_verified_at: string | null
          office_id: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id: string
          mfa_enabled?: boolean | null
          mfa_verified_at?: string | null
          office_id?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          mfa_enabled?: boolean | null
          mfa_verified_at?: string | null
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
          received_at: string | null
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
      session_anomalies: {
        Row: {
          actual_value: string | null
          anomaly_type: string
          created_at: string | null
          expected_value: string | null
          id: string
          resolution: string | null
          resolved_at: string | null
          session_id: string
          severity: string
          user_id: string | null
        }
        Insert: {
          actual_value?: string | null
          anomaly_type: string
          created_at?: string | null
          expected_value?: string | null
          id?: string
          resolution?: string | null
          resolved_at?: string | null
          session_id: string
          severity: string
          user_id?: string | null
        }
        Update: {
          actual_value?: string | null
          anomaly_type?: string
          created_at?: string | null
          expected_value?: string | null
          id?: string
          resolution?: string | null
          resolved_at?: string | null
          session_id?: string
          severity?: string
          user_id?: string | null
        }
        Relationships: []
      }
      session_contexts: {
        Row: {
          country_code: string | null
          created_at: string | null
          id: string
          ip_address: unknown
          ip_subnet: unknown
          is_trusted: boolean | null
          last_seen_at: string | null
          risk_score: number | null
          session_id: string
          user_agent: string | null
          user_agent_hash: string | null
          user_id: string | null
        }
        Insert: {
          country_code?: string | null
          created_at?: string | null
          id?: string
          ip_address: unknown
          ip_subnet?: unknown
          is_trusted?: boolean | null
          last_seen_at?: string | null
          risk_score?: number | null
          session_id: string
          user_agent?: string | null
          user_agent_hash?: string | null
          user_id?: string | null
        }
        Update: {
          country_code?: string | null
          created_at?: string | null
          id?: string
          ip_address?: unknown
          ip_subnet?: unknown
          is_trusted?: boolean | null
          last_seen_at?: string | null
          risk_score?: number | null
          session_id?: string
          user_agent?: string | null
          user_agent_hash?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      tag_assignments: {
        Row: {
          created_at: string | null
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
          color: string | null
          created_at: string | null
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
      trusted_contexts: {
        Row: {
          context_type: string
          context_value: string
          first_seen_at: string | null
          id: string
          last_used_at: string | null
          trusted_at: string | null
          use_count: number | null
          user_id: string | null
        }
        Insert: {
          context_type: string
          context_value: string
          first_seen_at?: string | null
          id?: string
          last_used_at?: string | null
          trusted_at?: string | null
          use_count?: number | null
          user_id?: string | null
        }
        Update: {
          context_type?: string
          context_value?: string
          first_seen_at?: string | null
          id?: string
          last_used_at?: string | null
          trusted_at?: string | null
          use_count?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_or_update_trusted_context: {
        Args: { p_type: string; p_user_id: string; p_value: string }
        Returns: undefined
      }
      calculate_ip_subnet: { Args: { ip: unknown }; Returns: unknown }
      check_login_rate_limit: {
        Args: {
          p_email: string
          p_max_attempts?: number
          p_window_minutes?: number
        }
        Returns: boolean
      }
      claim_invitation: {
        Args: { p_email?: string; p_token: string; p_user_id: string }
        Returns: {
          error_message: string
          office_id: string
          role: Database["public"]["Enums"]["user_role"]
          success: boolean
        }[]
      }
      confirm_triage: {
        Args: {
          p_assignee_id?: string
          p_case_id?: string
          p_message_ids: string[]
          p_tag_ids?: string[]
        }
        Returns: Json
      }
      create_office_invitation: {
        Args: {
          p_email?: string
          p_expires_in_days?: number
          p_max_uses?: number
          p_office_id: string
          p_role?: Database["public"]["Enums"]["user_role"]
        }
        Returns: {
          created_at: string | null
          created_by: string | null
          email: string | null
          expires_at: string
          id: string
          max_uses: number | null
          office_id: string
          role: Database["public"]["Enums"]["user_role"]
          token: string
          use_count: number | null
          used_at: string | null
          used_by: string | null
        }
      }
      create_office_partition: {
        Args: { p_office_id: string; p_table_name: string }
        Returns: undefined
      }
      dismiss_triage: {
        Args: { p_message_ids: string[]; p_reason?: string }
        Returns: Json
      }
      generate_campaign_outbox_messages: {
        Args: { p_bulk_response_id: string; p_office_id: string }
        Returns: Json
      }
      generate_ua_hash: { Args: { user_agent: string }; Returns: string }
      get_audit_logs: {
        Args: {
          p_action?: string
          p_end_date?: string
          p_limit?: number
          p_offset?: number
          p_severity?: string
          p_start_date?: string
        }
        Returns: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_id: string
          actor_name: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          ip_address: string
          metadata: Json
          office_id: string
          severity: string
        }[]
      }
      get_audit_stats: {
        Args: { p_days?: number }
        Returns: {
          critical_events: number
          high_events: number
          most_common_action: string
          most_common_count: number
          total_events: number
          unique_actors: number
        }[]
      }
      get_constituent_primary_email: {
        Args: { p_constituent_id: string }
        Returns: string
      }
      get_my_office_id: { Args: never; Returns: string }
      get_office_settings: {
        Args: { p_office_id: string }
        Returns: {
          ai_classification_enabled: boolean | null
          ai_draft_response_enabled: boolean | null
          ai_tagging_enabled: boolean | null
          auto_assign_enabled: boolean | null
          casework_acknowledgment_enabled: boolean | null
          created_at: string | null
          default_casework_assignee: string | null
          default_policy_assignee: string | null
          id: string
          inbound_email: string | null
          mp_email: string | null
          mp_name: string | null
          office_id: string
          policy_response_style: string | null
          round_robin_enabled: boolean | null
          signature_template: string | null
          updated_at: string | null
        }
      }
      get_session_aal: { Args: never; Returns: string }
      get_triage_queue: {
        Args: {
          p_campaign_id?: string
          p_email_type?: string
          p_limit?: number
          p_offset?: number
          p_order_by?: string
          p_order_dir?: string
          p_status?: Database["public"]["Enums"]["triage_status"][]
        }
        Returns: {
          campaign_id: string
          case_id: string
          classification_confidence: number
          email_type: string
          id: string
          is_campaign_email: boolean
          office_id: string
          received_at: string
          sender_constituent_id: string
          sender_constituent_name: string
          sender_email: string
          sender_name: string
          snippet: string
          subject: string
          triage_metadata: Json
          triage_status: Database["public"]["Enums"]["triage_status"]
          triaged_at: string
        }[]
      }
      get_triage_stats: { Args: never; Returns: Json }
      get_trusted_contexts: {
        Args: never
        Returns: {
          context_type: string
          context_value: string
          first_seen_at: string
          is_trusted: boolean
          last_used_at: string
          use_count: number
        }[]
      }
      get_unresolved_anomalies: {
        Args: never
        Returns: {
          actual_value: string
          anomaly_type: string
          created_at: string
          expected_value: string
          id: string
          severity: string
        }[]
      }
      get_user_mfa_status: {
        Args: { target_user_id?: string }
        Returns: {
          full_name: string
          has_mfa_enabled: boolean
          office_id: string
          role: string
          user_id: string
          verified_factor_count: number
        }[]
      }
      increment_bulk_response_recipients: {
        Args: { p_bulk_response_id: string }
        Returns: undefined
      }
      increment_campaign_count: {
        Args: { p_campaign_id: string }
        Returns: undefined
      }
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
      mark_as_triaged: {
        Args: {
          p_confidence?: number
          p_email_type?: string
          p_is_campaign?: boolean
          p_message_id: string
          p_metadata?: Json
          p_triaged_by: string
        }
        Returns: Json
      }
      process_bulk_response_approval: {
        Args: { p_approver_user_id: string; p_bulk_response_id: string }
        Returns: undefined
      }
      record_session_context: {
        Args: {
          p_country_code?: string
          p_ip_address: string
          p_user_agent: string
        }
        Returns: Json
      }
      requires_mfa_verification: { Args: never; Returns: boolean }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      trust_current_context: { Args: never; Returns: Json }
      uuid_generate_v7: { Args: never; Returns: string }
    }
    Enums: {
      audit_action:
        | "create"
        | "update"
        | "delete"
        | "view"
        | "login"
        | "send_email"
        | "mfa_enroll"
        | "mfa_verify"
        | "mfa_disable"
        | "mfa_unenroll"
        | "login_success"
        | "login_failure"
        | "role_change"
        | "user_create"
        | "user_delete"
        | "settings_change"
        | "outlook_connect"
        | "outlook_disconnect"
        | "bulk_export"
        | "session_anomaly"
        | "case_assign"
        | "case_close"
        | "email_send"
        | "triage_confirm"
        | "triage_dismiss"
        | "triage_batch"
      case_priority: "low" | "medium" | "high" | "urgent"
      case_status: "open" | "pending" | "closed" | "archived"
      case_type:
        | "type_1"
        | "type_2"
        | "type_3"
        | "type_4"
        | "type_5"
        | "type_6"
        | "type_7"
        | "type_8"
      contact_type: "email" | "phone" | "address" | "social"
      message_channel: "email" | "phone" | "letter" | "meeting" | "social_media"
      message_direction: "inbound" | "outbound"
      triage_status: "pending" | "triaged" | "confirmed" | "dismissed"
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
        "mfa_enroll",
        "mfa_verify",
        "mfa_disable",
        "mfa_unenroll",
        "login_success",
        "login_failure",
        "role_change",
        "user_create",
        "user_delete",
        "settings_change",
        "outlook_connect",
        "outlook_disconnect",
        "bulk_export",
        "session_anomaly",
        "case_assign",
        "case_close",
        "email_send",
        "triage_confirm",
        "triage_dismiss",
        "triage_batch",
      ],
      case_priority: ["low", "medium", "high", "urgent"],
      case_status: ["open", "pending", "closed", "archived"],
      case_type: ["type_1", "type_2", "type_3", "type_4", "type_5", "type_6", "type_7", "type_8"],
      contact_type: ["email", "phone", "address", "social"],
      message_channel: ["email", "phone", "letter", "meeting", "social_media"],
      message_direction: ["inbound", "outbound"],
      triage_status: ["pending", "triaged", "confirmed", "dismissed"],
      user_role: ["admin", "staff", "readonly"],
    },
  },
} as const

// Custom type aliases for convenience
export type UserRole = 'admin' | 'staff' | 'readonly';
export type CaseStatus = 'open' | 'pending' | 'closed' | 'archived';
export type CasePriority = 'low' | 'medium' | 'high' | 'urgent';
export type CaseType = 'type_1' | 'type_2' | 'type_3' | 'type_4' | 'type_5' | 'type_6' | 'type_7' | 'type_8';
export type MessageDirection = 'inbound' | 'outbound';
export type MessageChannel = 'email' | 'phone' | 'letter' | 'meeting' | 'social_media';
export type ContactType = 'email' | 'phone' | 'address' | 'social';
export type AuditAction = 'create' | 'update' | 'delete' | 'view' | 'login' | 'send_email' | 'mfa_enroll' | 'mfa_verify' | 'mfa_disable' | 'mfa_unenroll' | 'login_success' | 'login_failure' | 'role_change' | 'user_create' | 'user_delete' | 'settings_change' | 'outlook_connect' | 'outlook_disconnect' | 'bulk_export' | 'session_anomaly' | 'case_assign' | 'case_close' | 'email_send' | 'triage_confirm' | 'triage_dismiss' | 'triage_batch';
export type EmailQueueStatus = 'pending' | 'processing' | 'sent' | 'failed';
export type TriageStatus = 'pending' | 'triaged' | 'confirmed' | 'dismissed';

// Convenience type aliases
export type Office = Database['public']['Tables']['offices']['Row'];
export type OfficeSettings = Database['public']['Tables']['office_settings']['Row'];
export type OfficeSettingsUpdate = Database['public']['Tables']['office_settings']['Update'];
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

// Security types (new)
export type LoginAttempt = Database['public']['Tables']['login_attempts']['Row'];
export type SessionContext = Database['public']['Tables']['session_contexts']['Row'];
export type SessionAnomaly = Database['public']['Tables']['session_anomalies']['Row'];
export type TrustedContext = Database['public']['Tables']['trusted_contexts']['Row'];
export type AuditAlertQueue = Database['public']['Tables']['audit_alert_queue']['Row'];
export type OfficeInvitation = Database['public']['Tables']['office_invitations']['Row'];

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
export type OfficeInvitationInsert = Database['public']['Tables']['office_invitations']['Insert'];

// Notes types
export type Note = Database['public']['Tables']['notes']['Row'];
export type NoteReply = Database['public']['Tables']['note_replies']['Row'];
export type NoteInsert = Database['public']['Tables']['notes']['Insert'];
export type NoteReplyInsert = Database['public']['Tables']['note_replies']['Insert'];
export type TagAssignmentInsert = Database['public']['Tables']['tag_assignments']['Insert'];
