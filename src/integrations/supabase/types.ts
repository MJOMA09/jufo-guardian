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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_otp: {
        Row: {
          created_at: string | null
          email: string
          expires_at: string
          id: string
          otp_hash: string
          used: boolean | null
        }
        Insert: {
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          otp_hash: string
          used?: boolean | null
        }
        Update: {
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          otp_hash?: string
          used?: boolean | null
        }
        Relationships: []
      }
      jufo_entries: {
        Row: {
          created_at: string
          evaluated: boolean | null
          id: string
          issn: string | null
          level: number
          name: string
          norwegian_level: number | null
          publisher: string | null
          type: string | null
          year: number | null
        }
        Insert: {
          created_at?: string
          evaluated?: boolean | null
          id?: string
          issn?: string | null
          level?: number
          name: string
          norwegian_level?: number | null
          publisher?: string | null
          type?: string | null
          year?: number | null
        }
        Update: {
          created_at?: string
          evaluated?: boolean | null
          id?: string
          issn?: string | null
          level?: number
          name?: string
          norwegian_level?: number | null
          publisher?: string | null
          type?: string | null
          year?: number | null
        }
        Relationships: []
      }
      jufo_metadata: {
        Row: {
          entry_count: number
          id: string
          latest_year: number
          updated_at: string
          version: number
        }
        Insert: {
          entry_count?: number
          id?: string
          latest_year?: number
          updated_at?: string
          version?: number
        }
        Update: {
          entry_count?: number
          id?: string
          latest_year?: number
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scifilter_papers: {
        Row: {
          abstract: string | null
          authors: string | null
          citations: number | null
          concepts: Json | null
          created_at: string
          doi: string | null
          explanation: string | null
          feedback: string | null
          id: string
          relevance: string | null
          relevance_score: number | null
          search_id: string
          source: string | null
          title: string
          url: string | null
          user_id: string
          year: number | null
        }
        Insert: {
          abstract?: string | null
          authors?: string | null
          citations?: number | null
          concepts?: Json | null
          created_at?: string
          doi?: string | null
          explanation?: string | null
          feedback?: string | null
          id?: string
          relevance?: string | null
          relevance_score?: number | null
          search_id: string
          source?: string | null
          title: string
          url?: string | null
          user_id: string
          year?: number | null
        }
        Update: {
          abstract?: string | null
          authors?: string | null
          citations?: number | null
          concepts?: Json | null
          created_at?: string
          doi?: string | null
          explanation?: string | null
          feedback?: string | null
          id?: string
          relevance?: string | null
          relevance_score?: number | null
          search_id?: string
          source?: string | null
          title?: string
          url?: string | null
          user_id?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "scifilter_papers_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: false
            referencedRelation: "scifilter_searches"
            referencedColumns: ["id"]
          },
        ]
      }
      scifilter_searches: {
        Row: {
          created_at: string
          domain: string | null
          id: string
          query: string
          user_id: string
          year_from: number | null
          year_to: number | null
        }
        Insert: {
          created_at?: string
          domain?: string | null
          id?: string
          query: string
          user_id: string
          year_from?: number | null
          year_to?: number | null
        }
        Update: {
          created_at?: string
          domain?: string | null
          id?: string
          query?: string
          user_id?: string
          year_from?: number | null
          year_to?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  public: {
    Enums: {},
  },
} as const
