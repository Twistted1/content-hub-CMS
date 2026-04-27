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
      automation_runs: {
        Row: {
          automation_id: string
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          result: Json | null
          started_at: string
          status: string
          user_id: string
        }
        Insert: {
          automation_id: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          result?: Json | null
          started_at?: string
          status?: string
          user_id: string
        }
        Update: {
          automation_id?: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          result?: Json | null
          started_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
        ]
      }
      automations: {
        Row: {
          actions: Json
          conditions: Json | null
          created_at: string
          description: string | null
          id: string
          last_run: string | null
          name: string
          next_run: string | null
          platforms: string[]
          run_count: number
          schedule: Database["public"]["Enums"]["automation_schedule"] | null
          status: Database["public"]["Enums"]["automation_status"]
          trigger: Database["public"]["Enums"]["automation_trigger"]
          updated_at: string
          user_id: string
        }
        Insert: {
          actions?: Json
          conditions?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          last_run?: string | null
          name: string
          next_run?: string | null
          platforms?: string[]
          run_count?: number
          schedule?: Database["public"]["Enums"]["automation_schedule"] | null
          status?: Database["public"]["Enums"]["automation_status"]
          trigger?: Database["public"]["Enums"]["automation_trigger"]
          updated_at?: string
          user_id: string
        }
        Update: {
          actions?: Json
          conditions?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          last_run?: string | null
          name?: string
          next_run?: string | null
          platforms?: string[]
          run_count?: number
          schedule?: Database["public"]["Enums"]["automation_schedule"] | null
          status?: Database["public"]["Enums"]["automation_status"]
          trigger?: Database["public"]["Enums"]["automation_trigger"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
          token: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          token: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          token?: string
        }
        Relationships: []
      }
      media: {
        Row: {
          created_at: string
          filename: string
          id: string
          mime_type: string | null
          post_id: string | null
          size_bytes: number | null
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filename: string
          id?: string
          mime_type?: string | null
          post_id?: string | null
          size_bytes?: number | null
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          filename?: string
          id?: string
          mime_type?: string | null
          post_id?: string | null
          size_bytes?: number | null
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          platforms: string[]
          post_id: string | null
          result: Json | null
          schedule_mode: string
          scheduled_at: string | null
          status: string
          steps: Json
          topic: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          platforms?: string[]
          post_id?: string | null
          result?: Json | null
          schedule_mode?: string
          scheduled_at?: string | null
          status?: string
          steps?: Json
          topic: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          platforms?: string[]
          post_id?: string | null
          result?: Json | null
          schedule_mode?: string
          scheduled_at?: string | null
          status?: string
          steps?: Json
          topic?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_runs_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          color: string | null
          content: string | null
          created_at: string
          id: string
          is_pinned: boolean | null
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          color?: string | null
          content?: string | null
          created_at?: string
          id?: string
          is_pinned?: boolean | null
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          color?: string | null
          content?: string | null
          created_at?: string
          id?: string
          is_pinned?: boolean | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      post_platforms: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          platform: Database["public"]["Enums"]["platform_type"]
          platform_post_id: string | null
          post_id: string
          published_at: string | null
          status: Database["public"]["Enums"]["post_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          platform: Database["public"]["Enums"]["platform_type"]
          platform_post_id?: string | null
          post_id: string
          published_at?: string | null
          status?: Database["public"]["Enums"]["post_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          platform?: Database["public"]["Enums"]["platform_type"]
          platform_post_id?: string | null
          post_id?: string
          published_at?: string | null
          status?: Database["public"]["Enums"]["post_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_platforms_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          approved_at: string | null
          category: string | null
          content: string | null
          cost_estimate: number | null
          cover_image_url: string | null
          created_at: string
          excerpt: string | null
          id: string
          is_ai_generated: boolean | null
          published_at: string | null
          read_time: number | null
          scheduled_at: string | null
          status: Database["public"]["Enums"]["post_status"]
          tags: string[] | null
          title: string
          type: Database["public"]["Enums"]["post_type"]
          updated_at: string
          user_id: string
          workflow_step: string | null
        }
        Insert: {
          approved_at?: string | null
          category?: string | null
          content?: string | null
          cost_estimate?: number | null
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          is_ai_generated?: boolean | null
          published_at?: string | null
          read_time?: number | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["post_status"]
          tags?: string[] | null
          title: string
          type?: Database["public"]["Enums"]["post_type"]
          updated_at?: string
          user_id: string
          workflow_step?: string | null
        }
        Update: {
          approved_at?: string | null
          category?: string | null
          content?: string | null
          cost_estimate?: number | null
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          is_ai_generated?: boolean | null
          published_at?: string | null
          read_time?: number | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["post_status"]
          tags?: string[] | null
          title?: string
          type?: Database["public"]["Enums"]["post_type"]
          updated_at?: string
          user_id?: string
          workflow_step?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          company_name: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          company_name?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          company_name?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_settings: {
        Row: {
          current_month_spend: number | null
          id: string
          last_reset_date: string | null
          monthly_openai_budget: number | null
          supabase_anon_key: string | null
          supabase_url: string | null
          updated_at: string | null
        }
        Insert: {
          current_month_spend?: number | null
          id?: string
          last_reset_date?: string | null
          monthly_openai_budget?: number | null
          supabase_anon_key?: string | null
          supabase_url?: string | null
          updated_at?: string | null
        }
        Update: {
          current_month_spend?: number | null
          id?: string
          last_reset_date?: string | null
          monthly_openai_budget?: number | null
          supabase_anon_key?: string | null
          supabase_url?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          name: string
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          description: string | null
          format: string
          id: string
          last_generated: string | null
          name: string
          schedule_frequency: string | null
          schedule_next_run: string | null
          status: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          format?: string
          id?: string
          last_generated?: string | null
          name: string
          schedule_frequency?: string | null
          schedule_next_run?: string | null
          status?: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          format?: string
          id?: string
          last_generated?: string | null
          name?: string
          schedule_frequency?: string | null
          schedule_next_run?: string | null
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      strategies: {
        Row: {
          assignees: string[]
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          name: string
          platforms: string[]
          progress: number
          start_date: string | null
          status: Database["public"]["Enums"]["strategy_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          assignees?: string[]
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          platforms?: string[]
          progress?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["strategy_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          assignees?: string[]
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          platforms?: string[]
          progress?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["strategy_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      strategy_goals: {
        Row: {
          completed: boolean
          created_at: string
          id: string
          sort_order: number
          strategy_id: string
          title: string
          updated_at: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          id?: string
          sort_order?: number
          strategy_id: string
          title: string
          updated_at?: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          id?: string
          sort_order?: number
          strategy_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "strategy_goals_strategy_id_fkey"
            columns: ["strategy_id"]
            isOneToOne: false
            referencedRelation: "strategies"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          start_date: string
          tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          start_date?: string
          tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          start_date?: string
          tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assignee_id: string | null
          created_at: string
          dependencies: string[] | null
          description: string | null
          due_date: string | null
          duration: number | null
          id: string
          name: string
          priority: Database["public"]["Enums"]["task_priority"]
          progress: number
          project_id: string
          sort_order: number
          start_date: number | null
          status: Database["public"]["Enums"]["task_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          dependencies?: string[] | null
          description?: string | null
          due_date?: string | null
          duration?: number | null
          id?: string
          name: string
          priority?: Database["public"]["Enums"]["task_priority"]
          progress?: number
          project_id: string
          sort_order?: number
          start_date?: number | null
          status?: Database["public"]["Enums"]["task_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          dependencies?: string[] | null
          description?: string | null
          due_date?: string | null
          duration?: number | null
          id?: string
          name?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          progress?: number
          project_id?: string
          sort_order?: number
          start_date?: number | null
          status?: Database["public"]["Enums"]["task_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
          role?: Database["public"]["Enums"]["app_role"]
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
      webhook_configs: {
        Row: {
          created_at: string
          headers: Json | null
          id: string
          is_active: boolean
          name: string
          platforms: string[]
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          headers?: Json | null
          id?: string
          is_active?: boolean
          name: string
          platforms?: string[]
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          headers?: Json | null
          id?: string
          is_active?: boolean
          name?: string
          platforms?: string[]
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      user_platforms: {
        Row: {
          account_name: string
          avatar_url: string | null
          created_at: string
          id: string
          last_sync: string | null
          platform_type: Database["public"]["Enums"]["platform_type"]
          settings: Json
          status: string
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          account_name: string
          avatar_url?: string | null
          created_at?: string
          id?: string
          last_sync?: string | null
          platform_type: Database["public"]["Enums"]["platform_type"]
          settings?: Json
          status?: string
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          account_name?: string
          avatar_url?: string | null
          created_at?: string
          id?: string
          last_sync?: string | null
          platform_type?: Database["public"]["Enums"]["platform_type"]
          settings?: Json
          status?: string
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
      automation_schedule: "hourly" | "daily" | "weekly" | "monthly"
      automation_status: "active" | "paused" | "draft"
      automation_trigger: "scheduled" | "new-content" | "engagement" | "manual"
      platform_type:
        | "instagram"
        | "twitter"
        | "youtube"
        | "tiktok"
        | "facebook"
        | "linkedin"
        | "website"
        | "podcast"
        | "rumble"
      post_status:
        | "draft"
        | "scheduled"
        | "published"
        | "failed"
        | "awaiting_review"
        | "generating"
      post_type:
        | "text"
        | "image"
        | "video"
        | "carousel"
        | "reel"
        | "thread"
        | "article"
      project_status:
        | "planning"
        | "in-progress"
        | "review"
        | "completed"
        | "on-hold"
      strategy_status: "active" | "planning" | "completed" | "paused"
      subscription_tier: "free" | "pro" | "enterprise"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status: "todo" | "in-progress" | "review" | "done" | "blocked"
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
      automation_schedule: ["hourly", "daily", "weekly", "monthly"],
      automation_status: ["active", "paused", "draft"],
      automation_trigger: ["scheduled", "new-content", "engagement", "manual"],
      platform_type: [
        "instagram",
        "twitter",
        "youtube",
        "tiktok",
        "facebook",
        "linkedin",
        "website",
        "podcast",
        "rumble",
      ],
      post_status: [
        "draft",
        "scheduled",
        "published",
        "failed",
        "awaiting_review",
        "generating",
      ],
      post_type: [
        "text",
        "image",
        "video",
        "carousel",
        "reel",
        "thread",
        "article",
      ],
      project_status: [
        "planning",
        "in-progress",
        "review",
        "completed",
        "on-hold",
      ],
      strategy_status: ["active", "planning", "completed", "paused"],
      subscription_tier: ["free", "pro", "enterprise"],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["todo", "in-progress", "review", "done", "blocked"],
    },
  },
} as const
