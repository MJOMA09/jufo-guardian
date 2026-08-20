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
    PostgrestVersion: "14.15"
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
      scifilter_annotations: {
        Row: {
          content: string
          created_at: string
          id: string
          is_shared: boolean
          kind: string
          paper_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_shared?: boolean
          kind?: string
          paper_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_shared?: boolean
          kind?: string
          paper_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scifilter_collections: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_shared: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_shared?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_shared?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scifilter_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          paper_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          paper_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          paper_id?: string
          user_id?: string
        }
        Relationships: []
      }
      scifilter_notes: {
        Row: {
          content: string
          created_at: string
          id: string
          is_shared: boolean
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          is_shared?: boolean
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_shared?: boolean
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scifilter_papers: {
        Row: {
          abstract: string | null
          applicability: string | null
          authors: string | null
          citations: number | null
          collection_id: string | null
          concepts: Json | null
          confidence: number | null
          created_at: string
          doi: string | null
          explanation: string | null
          feedback: string | null
          id: string
          methodology: string | null
          reason_breakdown: Json | null
          related_authors: Json | null
          relevance: string | null
          relevance_score: number | null
          search_id: string
          source: string | null
          summary: string | null
          title: string
          url: string | null
          user_id: string
          year: number | null
        }
        Insert: {
          abstract?: string | null
          applicability?: string | null
          authors?: string | null
          citations?: number | null
          collection_id?: string | null
          concepts?: Json | null
          confidence?: number | null
          created_at?: string
          doi?: string | null
          explanation?: string | null
          feedback?: string | null
          id?: string
          methodology?: string | null
          reason_breakdown?: Json | null
          related_authors?: Json | null
          relevance?: string | null
          relevance_score?: number | null
          search_id: string
          source?: string | null
          summary?: string | null
          title: string
          url?: string | null
          user_id: string
          year?: number | null
        }
        Update: {
          abstract?: string | null
          applicability?: string | null
          authors?: string | null
          citations?: number | null
          collection_id?: string | null
          concepts?: Json | null
          confidence?: number | null
          created_at?: string
          doi?: string | null
          explanation?: string | null
          feedback?: string | null
          id?: string
          methodology?: string | null
          reason_breakdown?: Json | null
          related_authors?: Json | null
          relevance?: string | null
          relevance_score?: number | null
          search_id?: string
          source?: string | null
          summary?: string | null
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
      scifilter_projects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scifilter_saved_searches: {
        Row: {
          created_at: string
          domain: string | null
          id: string
          label: string
          query: string
          user_id: string
          year_from: number | null
          year_to: number | null
        }
        Insert: {
          created_at?: string
          domain?: string | null
          id?: string
          label: string
          query: string
          user_id: string
          year_from?: number | null
          year_to?: number | null
        }
        Update: {
          created_at?: string
          domain?: string | null
          id?: string
          label?: string
          query?: string
          user_id?: string
          year_from?: number | null
          year_to?: number | null
        }
        Relationships: []
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
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_sifter_admin_stats: { Args: never; Returns: Json }
      get_sifter_recent_searches: { Args: never; Returns: Json }
      get_sifter_users: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
