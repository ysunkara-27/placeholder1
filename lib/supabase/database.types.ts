export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      applications: {
        Row: {
          applied_at: string | null;
          attempt_count: number;
          browsing_task_id: string | null;
          completed_at: string | null;
          confirmation_text: string | null;
          created_at: string;
          id: string;
          job_id: string;
          last_error: string | null;
          last_run_id: string | null;
          queued_at: string;
          request_payload: Json;
          started_at: string | null;
          status: string;
          updated_at: string;
          user_id: string;
          worker_id: string | null;
        };
        Insert: {
          applied_at?: string | null;
          attempt_count?: number;
          browsing_task_id?: string | null;
          completed_at?: string | null;
          confirmation_text?: string | null;
          created_at?: string;
          id?: string;
          job_id: string;
          last_error?: string | null;
          last_run_id?: string | null;
          queued_at?: string;
          request_payload?: Json;
          started_at?: string | null;
          status?: string;
          updated_at?: string;
          user_id: string;
          worker_id?: string | null;
        };
        Update: {
          applied_at?: string | null;
          attempt_count?: number;
          browsing_task_id?: string | null;
          completed_at?: string | null;
          confirmation_text?: string | null;
          created_at?: string;
          id?: string;
          job_id?: string;
          last_error?: string | null;
          last_run_id?: string | null;
          queued_at?: string;
          request_payload?: Json;
          started_at?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
          worker_id?: string | null;
        };
        Relationships: [];
      };
      apply_runs: {
        Row: {
          created_at: string;
          error: string | null;
          id: string;
          job_id: string | null;
          mode: string;
          portal: string | null;
          request_payload: Json;
          result_payload: Json;
          status: string;
          url: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          error?: string | null;
          id?: string;
          job_id?: string | null;
          mode: string;
          portal?: string | null;
          request_payload?: Json;
          result_payload?: Json;
          status: string;
          url: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          error?: string | null;
          id?: string;
          job_id?: string | null;
          mode?: string;
          portal?: string | null;
          request_payload?: Json;
          result_payload?: Json;
          status?: string;
          url?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      alerts: {
        Row: {
          alerted_at: string;
          expires_at: string | null;
          id: string;
          job_id: string;
          metadata: Json;
          replied_at: string | null;
          response_channel: string | null;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          alerted_at?: string;
          expires_at?: string | null;
          id?: string;
          job_id: string;
          metadata?: Json;
          replied_at?: string | null;
          response_channel?: string | null;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          alerted_at?: string;
          expires_at?: string | null;
          id?: string;
          job_id?: string;
          metadata?: Json;
          replied_at?: string | null;
          response_channel?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      jobs: {
        Row: {
          application_url: string;
          company: string;
          created_at: string;
          id: string;
          industries: string[];
          jd_summary: string | null;
          level: string;
          location: string;
          metadata: Json;
          portal: string | null;
          posted_at: string;
          remote: boolean;
          scraped_at: string;
          status: string;
          title: string;
          updated_at: string;
          url: string;
        };
        Insert: {
          application_url: string;
          company: string;
          created_at?: string;
          id?: string;
          industries?: string[];
          jd_summary?: string | null;
          level: string;
          location: string;
          metadata?: Json;
          portal?: string | null;
          posted_at: string;
          remote?: boolean;
          scraped_at?: string;
          status?: string;
          title: string;
          updated_at?: string;
          url: string;
        };
        Update: {
          application_url?: string;
          company?: string;
          created_at?: string;
          id?: string;
          industries?: string[];
          jd_summary?: string | null;
          level?: string;
          location?: string;
          metadata?: Json;
          portal?: string | null;
          posted_at?: string;
          remote?: boolean;
          scraped_at?: string;
          status?: string;
          title?: string;
          updated_at?: string;
          url?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          authorized_to_work: boolean;
          city: string | null;
          country: string;
          created_at: string;
          degree: string | null;
          earliest_start_date: string | null;
          eeo: Json | null;
          email: string | null;
          full_name: string | null;
          github_url: string | null;
          gpa: string | null;
          graduation: string | null;
          gray_areas: Json | null;
          id: string;
          industries: string[];
          levels: string[];
          linkedin_url: string | null;
          locations: string[];
          major: string | null;
          notification_pref: string;
          onboarding_completed: boolean;
          phone: string | null;
          remote_ok: boolean;
          resume_json: Json | null;
          school: string | null;
          sms_opt_in: boolean;
          sms_provider: string | null;
          state_region: string | null;
          subscription_tier: string;
          updated_at: string;
          visa_type: string | null;
          website_url: string | null;
        };
        Insert: {
          authorized_to_work?: boolean;
          city?: string | null;
          country?: string;
          created_at?: string;
          degree?: string | null;
          earliest_start_date?: string | null;
          eeo?: Json | null;
          email?: string | null;
          full_name?: string | null;
          github_url?: string | null;
          gpa?: string | null;
          graduation?: string | null;
          gray_areas?: Json | null;
          id: string;
          industries?: string[];
          levels?: string[];
          linkedin_url?: string | null;
          locations?: string[];
          major?: string | null;
          notification_pref?: string;
          onboarding_completed?: boolean;
          phone?: string | null;
          remote_ok?: boolean;
          resume_json?: Json | null;
          school?: string | null;
          sms_opt_in?: boolean;
          sms_provider?: string | null;
          state_region?: string | null;
          subscription_tier?: string;
          updated_at?: string;
          visa_type?: string | null;
          website_url?: string | null;
        };
        Update: {
          authorized_to_work?: boolean;
          city?: string | null;
          country?: string;
          created_at?: string;
          degree?: string | null;
          earliest_start_date?: string | null;
          eeo?: Json | null;
          email?: string | null;
          full_name?: string | null;
          github_url?: string | null;
          gpa?: string | null;
          graduation?: string | null;
          gray_areas?: Json | null;
          id?: string;
          industries?: string[];
          levels?: string[];
          linkedin_url?: string | null;
          locations?: string[];
          major?: string | null;
          notification_pref?: string;
          onboarding_completed?: boolean;
          phone?: string | null;
          remote_ok?: boolean;
          resume_json?: Json | null;
          school?: string | null;
          sms_opt_in?: boolean;
          sms_provider?: string | null;
          state_region?: string | null;
          subscription_tier?: string;
          updated_at?: string;
          visa_type?: string | null;
          website_url?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      claim_next_application: {
        Args: {
          p_user_id?: string | null;
          p_worker_id: string;
        };
        Returns: Database["public"]["Tables"]["applications"]["Row"][];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
