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
    PostgrestVersion: "14.5"
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
      ocorrencias: {
        Row: {
          categoria: string
          created_at: string
          descricao: string
          foto_url: string | null
          id: string
          latitude: number | null
          longitude: number | null
          secao_id: string
          status: string
          user_id: string | null
        }
        Insert: {
          categoria: string
          created_at?: string
          descricao: string
          foto_url?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          secao_id: string
          status?: string
          user_id?: string | null
        }
        Update: {
          categoria?: string
          created_at?: string
          descricao?: string
          foto_url?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          secao_id?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ocorrencias_secao_id_fkey"
            columns: ["secao_id"]
            isOneToOne: false
            referencedRelation: "secoes_eleitorais_pi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocorrencias_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          deletion_requested_at: string | null
          full_name: string
          id: string
          lgpd_consent: boolean
          phone: string | null
          role: string
        }
        Insert: {
          created_at?: string
          deletion_requested_at?: string | null
          full_name: string
          id: string
          lgpd_consent?: boolean
          phone?: string | null
          role?: string
        }
        Update: {
          created_at?: string
          deletion_requested_at?: string | null
          full_name?: string
          id?: string
          lgpd_consent?: boolean
          phone?: string | null
          role?: string
        }
        Relationships: []
      }
      secoes_eleitorais_pi: {
        Row: {
          id: string
          last_synced: string
          local_votacao: string
          municipio: string
          secao: string
          urna: string
          zona: string
        }
        Insert: {
          id?: string
          last_synced?: string
          local_votacao: string
          municipio: string
          secao: string
          urna: string
          zona: string
        }
        Update: {
          id?: string
          last_synced?: string
          local_votacao?: string
          municipio?: string
          secao?: string
          urna?: string
          zona?: string
        }
        Relationships: []
      }
    }
    Views: {
      vw_ocorrencias_detalhadas: {
        Row: {
          agente_nome: string | null
          agente_phone: string | null
          categoria: string | null
          created_at: string | null
          descricao: string | null
          foto_url: string | null
          id: string | null
          latitude: number | null
          local_votacao: string | null
          longitude: number | null
          municipio: string | null
          secao: string | null
          status: string | null
          urna: string | null
          user_id: string | null
          zona: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ocorrencias_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_dashboard_metrics: { Args: never; Returns: Json }
      get_locais_municipio_pi: {
        Args: { p_municipio: string }
        Returns: {
          local_votacao: string
        }[]
      }
      get_locais_pi: {
        Args: { p_municipio: string; p_zona: string }
        Returns: {
          local_votacao: string
        }[]
      }
      get_municipios_pi: {
        Args: never
        Returns: {
          municipio: string
        }[]
      }
      get_ocorrencias_por_categoria: {
        Args: never
        Returns: {
          categoria: string
          total: number
        }[]
      }
      get_secao_id_pi: {
        Args: {
          p_local_votacao: string
          p_municipio: string
          p_secao: string
          p_zona: string
        }
        Returns: {
          id: string
          urna: string
        }[]
      }
      get_secoes_pi: {
        Args: { p_local_votacao: string; p_municipio: string; p_zona: string }
        Returns: {
          secao: string
        }[]
      }
      get_top_municipios: {
        Args: { limit_n?: number }
        Returns: {
          municipio: string
          total: number
        }[]
      }
      get_zonas_pi: {
        Args: { p_municipio: string }
        Returns: {
          zona: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      request_account_deletion: { Args: never; Returns: undefined }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

// ── Aliases de conveniência ────────────────────────────────────────────────

export type Profile = Database['public']['Tables']['profiles']['Row']
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

export type SecaoEleitoral = Database['public']['Tables']['secoes_eleitorais_pi']['Row']

export type Ocorrencia        = Database['public']['Tables']['ocorrencias']['Row']
export type OcorrenciaInsert  = Database['public']['Tables']['ocorrencias']['Insert']
export type OcorrenciaUpdate  = Database['public']['Tables']['ocorrencias']['Update']
export type OcorrenciaDetalhada = Database['public']['Views']['vw_ocorrencias_detalhadas']['Row']

export type UserRole         = 'agent' | 'admin' | 'revoked'
export type OcorrenciaStatus = 'pendente' | 'em_analise' | 'resolvido' | 'arquivado'
export type OcorrenciaCategoria =
  | 'irregularidade_administrativa'
  | 'problema_com_urna'
  | 'fila_aglomeracao'
  | 'acessibilidade'
  | 'conduta_suspeita'
  | 'outro'
