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
  public: {
    Tables: {
      account_fingerprints: {
        Row: {
          created_at: string
          device_fingerprint: string
          event_type: string
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_fingerprint: string
          event_type?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_fingerprint?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      admin_credit_grants: {
        Row: {
          amount: number
          granted_at: string
          granted_by: string
          id: string
          ledger_id: string | null
          reason: string | null
          target_email: string
          target_user_id: string
        }
        Insert: {
          amount: number
          granted_at?: string
          granted_by: string
          id?: string
          ledger_id?: string | null
          reason?: string | null
          target_email: string
          target_user_id: string
        }
        Update: {
          amount?: number
          granted_at?: string
          granted_by?: string
          id?: string
          ledger_id?: string | null
          reason?: string | null
          target_email?: string
          target_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_credit_grants_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "credit_ledger"
            referencedColumns: ["id"]
          },
        ]
      }
      allowed_emails: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          note: string | null
          plan_code: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          note?: string | null
          plan_code?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          note?: string | null
          plan_code?: string | null
        }
        Relationships: []
      }
      app_reload_events: {
        Row: {
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          cliente_id: string | null
          created_at: string | null
          date: string
          description: string | null
          duration_minutes: number | null
          google_event_id: string | null
          google_sync_status: string | null
          id: string
          orcamento_id: string | null
          origem: string | null
          package_id: string | null
          paid_amount: number | null
          session_id: string
          status: string | null
          time: string
          title: string
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string | null
          date: string
          description?: string | null
          duration_minutes?: number | null
          google_event_id?: string | null
          google_sync_status?: string | null
          id?: string
          orcamento_id?: string | null
          origem?: string | null
          package_id?: string | null
          paid_amount?: number | null
          session_id: string
          status?: string | null
          time: string
          title: string
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cliente_id?: string | null
          created_at?: string | null
          date?: string
          description?: string | null
          duration_minutes?: number | null
          google_event_id?: string | null
          google_sync_status?: string | null
          id?: string
          orcamento_id?: string | null
          origem?: string | null
          package_id?: string | null
          paid_amount?: number | null
          session_id?: string
          status?: string | null
          time?: string
          title?: string
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      asaas_webhook_events: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          installment_id: string | null
          payload: Json | null
          payment_id: string | null
          processed: boolean | null
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          installment_id?: string | null
          payload?: Json | null
          payment_id?: string | null
          processed?: boolean | null
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          installment_id?: string | null
          payload?: Json | null
          payment_id?: string | null
          processed?: boolean | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string
          created_at: string
          gallery_id: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          resource_id: string | null
          resource_type: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          gallery_id?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          gallery_id?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_gallery_id_fkey"
            columns: ["gallery_id"]
            isOneToOne: false
            referencedRelation: "galerias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_gallery_id_fkey"
            columns: ["gallery_id"]
            isOneToOne: false
            referencedRelation: "vw_cobrancas_suspeitas"
            referencedColumns: ["galeria_id_candidata"]
          },
        ]
      }
      availability_slots: {
        Row: {
          color: string | null
          created_at: string
          date: string
          description: string | null
          end_time: string
          full_day_description: string | null
          id: string
          is_full_day: boolean | null
          start_time: string
          type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          date: string
          description?: string | null
          end_time: string
          full_day_description?: string | null
          id?: string
          is_full_day?: boolean | null
          start_time: string
          type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          date?: string
          description?: string | null
          end_time?: string
          full_day_description?: string | null
          id?: string
          is_full_day?: boolean | null
          start_time?: string
          type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      backup_recovery_extras_audit_20260424: {
        Row: {
          appointment_id: string | null
          backup_at: string | null
          bk_gal_qtd: number | null
          bk_gal_total: number | null
          bk_gal_unit: number | null
          categoria: string | null
          cliente_id: string | null
          created_at: string | null
          data_sessao: string | null
          desconto: number | null
          descricao: string | null
          detalhes: string | null
          galeria_id: string | null
          hora_sessao: string | null
          id: string | null
          observacoes: string | null
          orcamento_id: string | null
          pacote: string | null
          produtos_incluidos: Json | null
          qtd_fotos_extra: number | null
          regras_congeladas: Json | null
          session_id: string | null
          status: string | null
          status_financeiro: string | null
          status_galeria: string | null
          status_pagamento_fotos_extra: string | null
          tipo_registro: string | null
          updated_at: string | null
          updated_by: string | null
          user_id: string | null
          valor_adicional: number | null
          valor_base_pacote: number | null
          valor_foto_extra: number | null
          valor_pago: number | null
          valor_total: number | null
          valor_total_foto_extra: number | null
        }
        Insert: {
          appointment_id?: string | null
          backup_at?: string | null
          bk_gal_qtd?: number | null
          bk_gal_total?: number | null
          bk_gal_unit?: number | null
          categoria?: string | null
          cliente_id?: string | null
          created_at?: string | null
          data_sessao?: string | null
          desconto?: number | null
          descricao?: string | null
          detalhes?: string | null
          galeria_id?: string | null
          hora_sessao?: string | null
          id?: string | null
          observacoes?: string | null
          orcamento_id?: string | null
          pacote?: string | null
          produtos_incluidos?: Json | null
          qtd_fotos_extra?: number | null
          regras_congeladas?: Json | null
          session_id?: string | null
          status?: string | null
          status_financeiro?: string | null
          status_galeria?: string | null
          status_pagamento_fotos_extra?: string | null
          tipo_registro?: string | null
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string | null
          valor_adicional?: number | null
          valor_base_pacote?: number | null
          valor_foto_extra?: number | null
          valor_pago?: number | null
          valor_total?: number | null
          valor_total_foto_extra?: number | null
        }
        Update: {
          appointment_id?: string | null
          backup_at?: string | null
          bk_gal_qtd?: number | null
          bk_gal_total?: number | null
          bk_gal_unit?: number | null
          categoria?: string | null
          cliente_id?: string | null
          created_at?: string | null
          data_sessao?: string | null
          desconto?: number | null
          descricao?: string | null
          detalhes?: string | null
          galeria_id?: string | null
          hora_sessao?: string | null
          id?: string | null
          observacoes?: string | null
          orcamento_id?: string | null
          pacote?: string | null
          produtos_incluidos?: Json | null
          qtd_fotos_extra?: number | null
          regras_congeladas?: Json | null
          session_id?: string | null
          status?: string | null
          status_financeiro?: string | null
          status_galeria?: string | null
          status_pagamento_fotos_extra?: string | null
          tipo_registro?: string | null
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string | null
          valor_adicional?: number | null
          valor_base_pacote?: number | null
          valor_foto_extra?: number | null
          valor_pago?: number | null
          valor_total?: number | null
          valor_total_foto_extra?: number | null
        }
        Relationships: []
      }
      backup_sessoes_desconto_progressivo_20260424: {
        Row: {
          appointment_id: string | null
          backup_at: string | null
          categoria: string | null
          cliente_id: string | null
          created_at: string | null
          data_sessao: string | null
          desconto: number | null
          descricao: string | null
          detalhes: string | null
          gal_qtd_extras: number | null
          gal_total_vendido: number | null
          gal_valor_foto_extra: number | null
          galeria_id: string | null
          hora_sessao: string | null
          id: string | null
          observacoes: string | null
          orcamento_id: string | null
          pacote: string | null
          produtos_incluidos: Json | null
          qtd_fotos_extra: number | null
          regras_congeladas: Json | null
          session_id: string | null
          status: string | null
          status_financeiro: string | null
          status_galeria: string | null
          status_pagamento_fotos_extra: string | null
          tipo_registro: string | null
          updated_at: string | null
          updated_by: string | null
          user_id: string | null
          valor_adicional: number | null
          valor_base_pacote: number | null
          valor_foto_extra: number | null
          valor_pago: number | null
          valor_total: number | null
          valor_total_foto_extra: number | null
        }
        Insert: {
          appointment_id?: string | null
          backup_at?: string | null
          categoria?: string | null
          cliente_id?: string | null
          created_at?: string | null
          data_sessao?: string | null
          desconto?: number | null
          descricao?: string | null
          detalhes?: string | null
          gal_qtd_extras?: number | null
          gal_total_vendido?: number | null
          gal_valor_foto_extra?: number | null
          galeria_id?: string | null
          hora_sessao?: string | null
          id?: string | null
          observacoes?: string | null
          orcamento_id?: string | null
          pacote?: string | null
          produtos_incluidos?: Json | null
          qtd_fotos_extra?: number | null
          regras_congeladas?: Json | null
          session_id?: string | null
          status?: string | null
          status_financeiro?: string | null
          status_galeria?: string | null
          status_pagamento_fotos_extra?: string | null
          tipo_registro?: string | null
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string | null
          valor_adicional?: number | null
          valor_base_pacote?: number | null
          valor_foto_extra?: number | null
          valor_pago?: number | null
          valor_total?: number | null
          valor_total_foto_extra?: number | null
        }
        Update: {
          appointment_id?: string | null
          backup_at?: string | null
          categoria?: string | null
          cliente_id?: string | null
          created_at?: string | null
          data_sessao?: string | null
          desconto?: number | null
          descricao?: string | null
          detalhes?: string | null
          gal_qtd_extras?: number | null
          gal_total_vendido?: number | null
          gal_valor_foto_extra?: number | null
          galeria_id?: string | null
          hora_sessao?: string | null
          id?: string | null
          observacoes?: string | null
          orcamento_id?: string | null
          pacote?: string | null
          produtos_incluidos?: Json | null
          qtd_fotos_extra?: number | null
          regras_congeladas?: Json | null
          session_id?: string | null
          status?: string | null
          status_financeiro?: string | null
          status_galeria?: string | null
          status_pagamento_fotos_extra?: string | null
          tipo_registro?: string | null
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string | null
          valor_adicional?: number | null
          valor_base_pacote?: number | null
          valor_foto_extra?: number | null
          valor_pago?: number | null
          valor_total?: number | null
          valor_total_foto_extra?: number | null
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          content: string
          created_at: string
          display_order: number
          featured_image_url: string | null
          id: string
          meta_description: string | null
          meta_title: string | null
          published_at: string | null
          route_reference: string | null
          slug: string
          status: string
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          display_order?: number
          featured_image_url?: string | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          published_at?: string | null
          route_reference?: string | null
          slug: string
          status?: string
          title: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          display_order?: number
          featured_image_url?: string | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          published_at?: string | null
          route_reference?: string | null
          slug?: string
          status?: string
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      categorias: {
        Row: {
          cor: string | null
          created_at: string
          id: string
          nome: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cor?: string | null
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cor?: string | null
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          created_at: string | null
          data_nascimento: string | null
          email: string | null
          endereco: string | null
          gallery_password: string | null
          gallery_status: string | null
          id: string
          nome: string
          observacoes: string | null
          origem: string | null
          telefone: string | null
          total_galerias: number | null
          updated_at: string | null
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          created_at?: string | null
          data_nascimento?: string | null
          email?: string | null
          endereco?: string | null
          gallery_password?: string | null
          gallery_status?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          origem?: string | null
          telefone?: string | null
          total_galerias?: number | null
          updated_at?: string | null
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          created_at?: string | null
          data_nascimento?: string | null
          email?: string | null
          endereco?: string | null
          gallery_password?: string | null
          gallery_status?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          origem?: string | null
          telefone?: string | null
          total_galerias?: number | null
          updated_at?: string | null
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      clientes_documentos: {
        Row: {
          cliente_id: string
          created_at: string | null
          descricao: string | null
          id: string
          nome: string
          r2_storage_path: string | null
          storage_path: string
          tamanho: number
          tipo: string
          user_id: string
        }
        Insert: {
          cliente_id: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome: string
          r2_storage_path?: string | null
          storage_path: string
          tamanho: number
          tipo: string
          user_id: string
        }
        Update: {
          cliente_id?: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          r2_storage_path?: string | null
          storage_path?: string
          tamanho?: number
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_documentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes_familia: {
        Row: {
          cliente_id: string
          created_at: string | null
          data_nascimento: string | null
          id: string
          nome: string | null
          tipo: string
          user_id: string
        }
        Insert: {
          cliente_id: string
          created_at?: string | null
          data_nascimento?: string | null
          id?: string
          nome?: string | null
          tipo: string
          user_id: string
        }
        Update: {
          cliente_id?: string
          created_at?: string | null
          data_nascimento?: string | null
          id?: string
          nome?: string | null
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_familia_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes_sessoes: {
        Row: {
          appointment_id: string | null
          categoria: string
          cliente_id: string
          created_at: string | null
          data_sessao: string
          desconto: number | null
          descricao: string | null
          detalhes: string | null
          extras_overridden: boolean
          extras_overridden_at: string | null
          galeria_id: string | null
          hora_sessao: string
          id: string
          observacoes: string | null
          orcamento_id: string | null
          pacote: string | null
          produtos_incluidos: Json | null
          qtd_fotos_extra: number | null
          regras_congeladas: Json | null
          session_id: string
          status: string | null
          status_financeiro: string | null
          status_galeria: string | null
          status_pagamento_fotos_extra: string | null
          tipo_registro: string
          updated_at: string | null
          updated_by: string | null
          user_id: string
          valor_adicional: number | null
          valor_base_pacote: number | null
          valor_foto_extra: number | null
          valor_pago: number | null
          valor_total: number | null
          valor_total_foto_extra: number | null
        }
        Insert: {
          appointment_id?: string | null
          categoria: string
          cliente_id: string
          created_at?: string | null
          data_sessao: string
          desconto?: number | null
          descricao?: string | null
          detalhes?: string | null
          extras_overridden?: boolean
          extras_overridden_at?: string | null
          galeria_id?: string | null
          hora_sessao: string
          id?: string
          observacoes?: string | null
          orcamento_id?: string | null
          pacote?: string | null
          produtos_incluidos?: Json | null
          qtd_fotos_extra?: number | null
          regras_congeladas?: Json | null
          session_id: string
          status?: string | null
          status_financeiro?: string | null
          status_galeria?: string | null
          status_pagamento_fotos_extra?: string | null
          tipo_registro?: string
          updated_at?: string | null
          updated_by?: string | null
          user_id: string
          valor_adicional?: number | null
          valor_base_pacote?: number | null
          valor_foto_extra?: number | null
          valor_pago?: number | null
          valor_total?: number | null
          valor_total_foto_extra?: number | null
        }
        Update: {
          appointment_id?: string | null
          categoria?: string
          cliente_id?: string
          created_at?: string | null
          data_sessao?: string
          desconto?: number | null
          descricao?: string | null
          detalhes?: string | null
          extras_overridden?: boolean
          extras_overridden_at?: string | null
          galeria_id?: string | null
          hora_sessao?: string
          id?: string
          observacoes?: string | null
          orcamento_id?: string | null
          pacote?: string | null
          produtos_incluidos?: Json | null
          qtd_fotos_extra?: number | null
          regras_congeladas?: Json | null
          session_id?: string
          status?: string | null
          status_financeiro?: string | null
          status_galeria?: string | null
          status_pagamento_fotos_extra?: string | null
          tipo_registro?: string
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string
          valor_adicional?: number | null
          valor_base_pacote?: number | null
          valor_foto_extra?: number | null
          valor_pago?: number | null
          valor_total?: number | null
          valor_total_foto_extra?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_sessoes_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_sessoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_sessoes_galeria_id_fkey"
            columns: ["galeria_id"]
            isOneToOne: false
            referencedRelation: "galerias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_sessoes_galeria_id_fkey"
            columns: ["galeria_id"]
            isOneToOne: false
            referencedRelation: "vw_cobrancas_suspeitas"
            referencedColumns: ["galeria_id_candidata"]
          },
        ]
      }
      clientes_sessoes_status_audit: {
        Row: {
          contexto: Json | null
          created_at: string
          id: string
          origem: string | null
          sessao_id: string
          session_id: string | null
          status_anterior: string | null
          status_novo: string | null
          user_id: string
        }
        Insert: {
          contexto?: Json | null
          created_at?: string
          id?: string
          origem?: string | null
          sessao_id: string
          session_id?: string | null
          status_anterior?: string | null
          status_novo?: string | null
          user_id: string
        }
        Update: {
          contexto?: Json | null
          created_at?: string
          id?: string
          origem?: string | null
          sessao_id?: string
          session_id?: string | null
          status_anterior?: string | null
          status_novo?: string | null
          user_id?: string
        }
        Relationships: []
      }
      clientes_transacoes: {
        Row: {
          cliente_id: string
          cobranca_id: string | null
          created_at: string | null
          data_transacao: string
          data_vencimento: string | null
          descricao: string | null
          id: string
          session_id: string | null
          taxa_antecipacao: number | null
          taxa_gateway: number | null
          tipo: string
          updated_at: string | null
          updated_by: string | null
          user_id: string
          valor: number
          valor_liquido: number | null
        }
        Insert: {
          cliente_id: string
          cobranca_id?: string | null
          created_at?: string | null
          data_transacao: string
          data_vencimento?: string | null
          descricao?: string | null
          id?: string
          session_id?: string | null
          taxa_antecipacao?: number | null
          taxa_gateway?: number | null
          tipo: string
          updated_at?: string | null
          updated_by?: string | null
          user_id: string
          valor: number
          valor_liquido?: number | null
        }
        Update: {
          cliente_id?: string
          cobranca_id?: string | null
          created_at?: string | null
          data_transacao?: string
          data_vencimento?: string | null
          descricao?: string | null
          id?: string
          session_id?: string | null
          taxa_antecipacao?: number | null
          taxa_gateway?: number | null
          tipo?: string
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string
          valor?: number
          valor_liquido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_transacoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_transacoes_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_transacoes_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "v_infinitepay_latency"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_transacoes_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "vw_cobrancas_suspeitas"
            referencedColumns: ["cobranca_id"]
          },
          {
            foreignKeyName: "fk_transacoes_session_id"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "clientes_sessoes"
            referencedColumns: ["session_id"]
          },
        ]
      }
      cobranca_parcelas: {
        Row: {
          antecipado: boolean | null
          asaas_payment_id: string
          billing_type: string | null
          cobranca_id: string
          created_at: string | null
          data_credito: string | null
          data_credito_real: string | null
          data_pagamento: string | null
          data_vencimento: string | null
          id: string
          mp_payment_id: string | null
          numero_parcela: number
          status: string
          taxa_antecipacao: number | null
          taxa_gateway: number | null
          updated_at: string | null
          valor_bruto: number
          valor_liquido: number | null
        }
        Insert: {
          antecipado?: boolean | null
          asaas_payment_id: string
          billing_type?: string | null
          cobranca_id: string
          created_at?: string | null
          data_credito?: string | null
          data_credito_real?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          id?: string
          mp_payment_id?: string | null
          numero_parcela: number
          status?: string
          taxa_antecipacao?: number | null
          taxa_gateway?: number | null
          updated_at?: string | null
          valor_bruto: number
          valor_liquido?: number | null
        }
        Update: {
          antecipado?: boolean | null
          asaas_payment_id?: string
          billing_type?: string | null
          cobranca_id?: string
          created_at?: string | null
          data_credito?: string | null
          data_credito_real?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          id?: string
          mp_payment_id?: string | null
          numero_parcela?: number
          status?: string
          taxa_antecipacao?: number | null
          taxa_gateway?: number | null
          updated_at?: string | null
          valor_bruto?: number
          valor_liquido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cobranca_parcelas_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobranca_parcelas_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "v_infinitepay_latency"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobranca_parcelas_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "vw_cobrancas_suspeitas"
            referencedColumns: ["cobranca_id"]
          },
        ]
      }
      cobrancas: {
        Row: {
          asaas_installment_id: string | null
          cliente_id: string | null
          correlation_id: string | null
          created_at: string | null
          dados_extras: Json | null
          data_pagamento: string | null
          descricao: string | null
          extras_contabilizados: boolean
          finalidade: string
          galeria_id: string | null
          id: string
          ip_checkout_url: string | null
          ip_order_nsu: string | null
          ip_receipt_url: string | null
          ip_transaction_nsu: string | null
          metodo_manual: string | null
          mp_expiration_date: string | null
          mp_payment_id: string | null
          mp_payment_link: string | null
          mp_pix_copia_cola: string | null
          mp_preference_id: string | null
          mp_qr_code: string | null
          mp_qr_code_base64: string | null
          obs_manual: string | null
          parcelas_pagas: number | null
          provedor: string | null
          qtd_fotos: number | null
          session_id: string | null
          snapshot_fotos_incluidas: number | null
          snapshot_regras_congeladas: Json | null
          status: string | null
          tipo_cobranca: string
          total_parcelas: number | null
          updated_at: string | null
          user_id: string
          valor: number
          valor_liquido: number | null
          visitor_id: string | null
        }
        Insert: {
          asaas_installment_id?: string | null
          cliente_id?: string | null
          correlation_id?: string | null
          created_at?: string | null
          dados_extras?: Json | null
          data_pagamento?: string | null
          descricao?: string | null
          extras_contabilizados?: boolean
          finalidade?: string
          galeria_id?: string | null
          id?: string
          ip_checkout_url?: string | null
          ip_order_nsu?: string | null
          ip_receipt_url?: string | null
          ip_transaction_nsu?: string | null
          metodo_manual?: string | null
          mp_expiration_date?: string | null
          mp_payment_id?: string | null
          mp_payment_link?: string | null
          mp_pix_copia_cola?: string | null
          mp_preference_id?: string | null
          mp_qr_code?: string | null
          mp_qr_code_base64?: string | null
          obs_manual?: string | null
          parcelas_pagas?: number | null
          provedor?: string | null
          qtd_fotos?: number | null
          session_id?: string | null
          snapshot_fotos_incluidas?: number | null
          snapshot_regras_congeladas?: Json | null
          status?: string | null
          tipo_cobranca: string
          total_parcelas?: number | null
          updated_at?: string | null
          user_id: string
          valor: number
          valor_liquido?: number | null
          visitor_id?: string | null
        }
        Update: {
          asaas_installment_id?: string | null
          cliente_id?: string | null
          correlation_id?: string | null
          created_at?: string | null
          dados_extras?: Json | null
          data_pagamento?: string | null
          descricao?: string | null
          extras_contabilizados?: boolean
          finalidade?: string
          galeria_id?: string | null
          id?: string
          ip_checkout_url?: string | null
          ip_order_nsu?: string | null
          ip_receipt_url?: string | null
          ip_transaction_nsu?: string | null
          metodo_manual?: string | null
          mp_expiration_date?: string | null
          mp_payment_id?: string | null
          mp_payment_link?: string | null
          mp_pix_copia_cola?: string | null
          mp_preference_id?: string | null
          mp_qr_code?: string | null
          mp_qr_code_base64?: string | null
          obs_manual?: string | null
          parcelas_pagas?: number | null
          provedor?: string | null
          qtd_fotos?: number | null
          session_id?: string | null
          snapshot_fotos_incluidas?: number | null
          snapshot_regras_congeladas?: Json | null
          status?: string | null
          tipo_cobranca?: string
          total_parcelas?: number | null
          updated_at?: string | null
          user_id?: string
          valor?: number
          valor_liquido?: number | null
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cobrancas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobrancas_galeria_id_fkey"
            columns: ["galeria_id"]
            isOneToOne: false
            referencedRelation: "galerias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobrancas_galeria_id_fkey"
            columns: ["galeria_id"]
            isOneToOne: false
            referencedRelation: "vw_cobrancas_suspeitas"
            referencedColumns: ["galeria_id_candidata"]
          },
          {
            foreignKeyName: "cobrancas_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "galeria_visitantes"
            referencedColumns: ["id"]
          },
        ]
      }
      contrato_templates: {
        Row: {
          ativo: boolean
          categoria: string | null
          conteudo: string
          created_at: string
          descricao: string | null
          id: string
          is_padrao: boolean
          nome: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string | null
          conteudo?: string
          created_at?: string
          descricao?: string | null
          id?: string
          is_padrao?: boolean
          nome: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          categoria?: string | null
          conteudo?: string
          created_at?: string
          descricao?: string | null
          id?: string
          is_padrao?: boolean
          nome?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      contratos: {
        Row: {
          arquivo_assinado_nome: string | null
          arquivo_assinado_path: string | null
          arquivo_assinado_tamanho: number | null
          assinado_em: string | null
          cliente_id: string
          conteudo: string
          created_at: string
          enviado_em: string | null
          id: string
          observacoes: string | null
          r2_arquivo_assinado_path: string | null
          session_id: string | null
          signature_external_id: string | null
          signature_provider: string | null
          signers: Json | null
          status: string
          template_id: string | null
          titulo: string
          updated_at: string
          user_id: string
          variaveis_snapshot: Json | null
        }
        Insert: {
          arquivo_assinado_nome?: string | null
          arquivo_assinado_path?: string | null
          arquivo_assinado_tamanho?: number | null
          assinado_em?: string | null
          cliente_id: string
          conteudo?: string
          created_at?: string
          enviado_em?: string | null
          id?: string
          observacoes?: string | null
          r2_arquivo_assinado_path?: string | null
          session_id?: string | null
          signature_external_id?: string | null
          signature_provider?: string | null
          signers?: Json | null
          status?: string
          template_id?: string | null
          titulo: string
          updated_at?: string
          user_id: string
          variaveis_snapshot?: Json | null
        }
        Update: {
          arquivo_assinado_nome?: string | null
          arquivo_assinado_path?: string | null
          arquivo_assinado_tamanho?: number | null
          assinado_em?: string | null
          cliente_id?: string
          conteudo?: string
          created_at?: string
          enviado_em?: string | null
          id?: string
          observacoes?: string | null
          r2_arquivo_assinado_path?: string | null
          session_id?: string | null
          signature_external_id?: string | null
          signature_provider?: string | null
          signers?: Json | null
          status?: string
          template_id?: string | null
          titulo?: string
          updated_at?: string
          user_id?: string
          variaveis_snapshot?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "contratos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contrato_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          applies_to: string
          code: string
          created_at: string
          current_uses: number
          description: string | null
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean
          max_uses: number | null
          plan_codes: string[] | null
          updated_at: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          applies_to?: string
          code: string
          created_at?: string
          current_uses?: number
          description?: string | null
          discount_type?: string
          discount_value: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          plan_codes?: string[] | null
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          applies_to?: string
          code?: string
          created_at?: string
          current_uses?: number
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          plan_codes?: string[] | null
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      credit_ledger: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          description: string | null
          gallery_id: string | null
          id: string
          metadata: Json | null
          operation_type: string
          photo_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          gallery_id?: string | null
          id?: string
          metadata?: Json | null
          operation_type: string
          photo_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          gallery_id?: string | null
          id?: string
          metadata?: Json | null
          operation_type?: string
          photo_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_ledger_gallery_id_fkey"
            columns: ["gallery_id"]
            isOneToOne: false
            referencedRelation: "galerias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_ledger_gallery_id_fkey"
            columns: ["gallery_id"]
            isOneToOne: false
            referencedRelation: "vw_cobrancas_suspeitas"
            referencedColumns: ["galeria_id_candidata"]
          },
          {
            foreignKeyName: "credit_ledger_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "galeria_fotos"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_purchases: {
        Row: {
          created_at: string
          credits_amount: number
          id: string
          ledger_id: string | null
          metadata: Json | null
          mp_payment_id: string | null
          mp_status: string
          package_id: string | null
          paid_at: string | null
          payment_method: string
          pix_copia_cola: string | null
          pix_expiration: string | null
          pix_qr_code: string | null
          pix_qr_code_base64: string | null
          price_cents: number
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits_amount: number
          id?: string
          ledger_id?: string | null
          metadata?: Json | null
          mp_payment_id?: string | null
          mp_status?: string
          package_id?: string | null
          paid_at?: string | null
          payment_method: string
          pix_copia_cola?: string | null
          pix_expiration?: string | null
          pix_qr_code?: string | null
          pix_qr_code_base64?: string | null
          price_cents: number
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits_amount?: number
          id?: string
          ledger_id?: string | null
          metadata?: Json | null
          mp_payment_id?: string | null
          mp_status?: string
          package_id?: string | null
          paid_at?: string | null
          payment_method?: string
          pix_copia_cola?: string | null
          pix_expiration?: string | null
          pix_qr_code?: string | null
          pix_qr_code_base64?: string | null
          price_cents?: number
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_purchases_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "credit_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_purchases_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "gallery_credit_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_time_slots: {
        Row: {
          created_at: string | null
          date: string
          id: string
          time_slots: string[]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          time_slots: string[]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          time_slots?: string[]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      email_delivery_logs: {
        Row: {
          cliente_email: string | null
          cliente_id: string | null
          cliente_nome: string | null
          created_at: string
          error_message: string | null
          event_type: Database["public"]["Enums"]["email_delivery_event_type"]
          friendly_message: string | null
          gallery_id: string | null
          id: string
          idempotency_key: string
          metadata: Json
          payment_id: string | null
          resend_message_id: string | null
          status: Database["public"]["Enums"]["email_delivery_status"]
          subject: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cliente_email?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          created_at?: string
          error_message?: string | null
          event_type: Database["public"]["Enums"]["email_delivery_event_type"]
          friendly_message?: string | null
          gallery_id?: string | null
          id?: string
          idempotency_key: string
          metadata?: Json
          payment_id?: string | null
          resend_message_id?: string | null
          status: Database["public"]["Enums"]["email_delivery_status"]
          subject?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cliente_email?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          created_at?: string
          error_message?: string | null
          event_type?: Database["public"]["Enums"]["email_delivery_event_type"]
          friendly_message?: string | null
          gallery_id?: string | null
          id?: string
          idempotency_key?: string
          metadata?: Json
          payment_id?: string | null
          resend_message_id?: string | null
          status?: Database["public"]["Enums"]["email_delivery_status"]
          subject?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_delivery_logs_gallery_id_fkey"
            columns: ["gallery_id"]
            isOneToOne: false
            referencedRelation: "galerias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_delivery_logs_gallery_id_fkey"
            columns: ["gallery_id"]
            isOneToOne: false
            referencedRelation: "vw_cobrancas_suspeitas"
            referencedColumns: ["galeria_id_candidata"]
          },
          {
            foreignKeyName: "email_delivery_logs_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "cobrancas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_delivery_logs_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "v_infinitepay_latency"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_delivery_logs_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "vw_cobrancas_suspeitas"
            referencedColumns: ["cobranca_id"]
          },
        ]
      }
      etapas_trabalho: {
        Row: {
          cor: string
          created_at: string
          id: string
          is_hidden_in_workflow: boolean
          is_system_status: boolean | null
          nome: string
          ordem: number
          updated_at: string
          user_id: string
        }
        Insert: {
          cor: string
          created_at?: string
          id?: string
          is_hidden_in_workflow?: boolean
          is_system_status?: boolean | null
          nome: string
          ordem: number
          updated_at?: string
          user_id: string
        }
        Update: {
          cor?: string
          created_at?: string
          id?: string
          is_hidden_in_workflow?: boolean
          is_system_status?: boolean | null
          nome?: string
          ordem?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      feed_items: {
        Row: {
          content: string | null
          created_at: string
          id: string
          metadata: Json | null
          scheduled_for: string | null
          status: string | null
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          scheduled_for?: string | null
          status?: string | null
          title: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          scheduled_for?: string | null
          status?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fin_credit_cards: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          dia_fechamento: number
          dia_vencimento: number
          id: string
          nome: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          dia_fechamento: number
          dia_vencimento: number
          id?: string
          nome: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          dia_fechamento?: number
          dia_vencimento?: number
          id?: string
          nome?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      fin_items_master: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          grupo_principal: string
          id: string
          is_default: boolean | null
          nome: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          grupo_principal: string
          id?: string
          is_default?: boolean | null
          nome: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          grupo_principal?: string
          id?: string
          is_default?: boolean | null
          nome?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      fin_recurring_blueprints: {
        Row: {
          created_at: string | null
          data_fim: string | null
          data_inicio: string
          dia_vencimento: number
          id: string
          is_valor_fixo: boolean | null
          item_id: string
          observacoes: string | null
          updated_at: string | null
          user_id: string
          valor: number
        }
        Insert: {
          created_at?: string | null
          data_fim?: string | null
          data_inicio: string
          dia_vencimento: number
          id?: string
          is_valor_fixo?: boolean | null
          item_id: string
          observacoes?: string | null
          updated_at?: string | null
          user_id: string
          valor: number
        }
        Update: {
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string
          dia_vencimento?: number
          id?: string
          is_valor_fixo?: boolean | null
          item_id?: string
          observacoes?: string | null
          updated_at?: string | null
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "fin_recurring_blueprints_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "fin_items_master"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_transactions: {
        Row: {
          created_at: string | null
          credit_card_id: string | null
          data_competencia: string | null
          data_compra: string | null
          data_vencimento: string
          id: string
          item_id: string
          observacoes: string | null
          parcela_atual: number | null
          parcela_total: number | null
          parent_id: string | null
          recurring_blueprint_id: string | null
          status: string
          updated_at: string | null
          user_id: string
          valor: number
        }
        Insert: {
          created_at?: string | null
          credit_card_id?: string | null
          data_competencia?: string | null
          data_compra?: string | null
          data_vencimento: string
          id?: string
          item_id: string
          observacoes?: string | null
          parcela_atual?: number | null
          parcela_total?: number | null
          parent_id?: string | null
          recurring_blueprint_id?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
          valor: number
        }
        Update: {
          created_at?: string | null
          credit_card_id?: string | null
          data_competencia?: string | null
          data_compra?: string | null
          data_vencimento?: string
          id?: string
          item_id?: string
          observacoes?: string | null
          parcela_atual?: number | null
          parcela_total?: number | null
          parent_id?: string | null
          recurring_blueprint_id?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "fin_transactions_credit_card_id_fkey"
            columns: ["credit_card_id"]
            isOneToOne: false
            referencedRelation: "fin_credit_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_transactions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "fin_items_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_transactions_recurring_blueprint_id_fkey"
            columns: ["recurring_blueprint_id"]
            isOneToOne: false
            referencedRelation: "fin_recurring_blueprints"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_items: {
        Row: {
          categoria: string
          created_at: string
          data: string
          descricao: string
          id: string
          metodo_pagamento: string | null
          observacoes: string | null
          status: string | null
          subcategoria: string | null
          tags: string[] | null
          tipo: string
          updated_at: string
          user_id: string
          valor: number
        }
        Insert: {
          categoria: string
          created_at?: string
          data: string
          descricao: string
          id?: string
          metodo_pagamento?: string | null
          observacoes?: string | null
          status?: string | null
          subcategoria?: string | null
          tags?: string[] | null
          tipo: string
          updated_at?: string
          user_id: string
          valor: number
        }
        Update: {
          categoria?: string
          created_at?: string
          data?: string
          descricao?: string
          id?: string
          metodo_pagamento?: string | null
          observacoes?: string | null
          status?: string | null
          subcategoria?: string | null
          tags?: string[] | null
          tipo?: string
          updated_at?: string
          user_id?: string
          valor?: number
        }
        Relationships: []
      }
      formulario_respostas: {
        Row: {
          created_at: string
          formulario_id: string
          id: string
          respondente_email: string | null
          respondente_nome: string | null
          respostas: Json
          submitted_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          formulario_id: string
          id?: string
          respondente_email?: string | null
          respondente_nome?: string | null
          respostas?: Json
          submitted_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          formulario_id?: string
          id?: string
          respondente_email?: string | null
          respondente_nome?: string | null
          respostas?: Json
          submitted_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "formulario_respostas_formulario_id_fkey"
            columns: ["formulario_id"]
            isOneToOne: false
            referencedRelation: "formularios"
            referencedColumns: ["id"]
          },
        ]
      }
      formulario_templates: {
        Row: {
          campos: Json
          categoria: string
          created_at: string
          descricao: string | null
          id: string
          is_system: boolean
          nome: string
          tempo_estimado: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          campos?: Json
          categoria?: string
          created_at?: string
          descricao?: string | null
          id?: string
          is_system?: boolean
          nome: string
          tempo_estimado?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          campos?: Json
          categoria?: string
          created_at?: string
          descricao?: string | null
          id?: string
          is_system?: boolean
          nome?: string
          tempo_estimado?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      formularios: {
        Row: {
          campos: Json
          cliente_id: string | null
          created_at: string
          descricao: string | null
          enviado_em: string | null
          expires_at: string | null
          id: string
          mensagem_conclusao: string | null
          public_token: string | null
          respondido_em: string | null
          session_id: string | null
          status: string
          status_envio: string
          template_id: string | null
          tempo_estimado: number | null
          titulo: string
          titulo_cliente: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          campos?: Json
          cliente_id?: string | null
          created_at?: string
          descricao?: string | null
          enviado_em?: string | null
          expires_at?: string | null
          id?: string
          mensagem_conclusao?: string | null
          public_token?: string | null
          respondido_em?: string | null
          session_id?: string | null
          status?: string
          status_envio?: string
          template_id?: string | null
          tempo_estimado?: number | null
          titulo: string
          titulo_cliente?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          campos?: Json
          cliente_id?: string | null
          created_at?: string
          descricao?: string | null
          enviado_em?: string | null
          expires_at?: string | null
          id?: string
          mensagem_conclusao?: string | null
          public_token?: string | null
          respondido_em?: string | null
          session_id?: string | null
          status?: string
          status_envio?: string
          template_id?: string | null
          tempo_estimado?: number | null
          titulo?: string
          titulo_cliente?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "formularios_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formularios_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "formulario_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      galeria_acoes: {
        Row: {
          created_at: string
          descricao: string | null
          galeria_id: string
          id: string
          tipo: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          galeria_id: string
          id?: string
          tipo: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          descricao?: string | null
          galeria_id?: string
          id?: string
          tipo?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "galeria_acoes_galeria_id_fkey"
            columns: ["galeria_id"]
            isOneToOne: false
            referencedRelation: "galerias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "galeria_acoes_galeria_id_fkey"
            columns: ["galeria_id"]
            isOneToOne: false
            referencedRelation: "vw_cobrancas_suspeitas"
            referencedColumns: ["galeria_id_candidata"]
          },
        ]
      }
      galeria_fotos: {
        Row: {
          comment: string | null
          cover_path: string | null
          created_at: string
          file_size: number | null
          filename: string
          galeria_id: string
          has_watermark: boolean | null
          height: number | null
          id: string
          is_favorite: boolean | null
          is_selected: boolean | null
          mime_type: string | null
          order_index: number | null
          original_file_size: number | null
          original_filename: string
          original_path: string | null
          pasta_id: string | null
          peso_visual: number | null
          preview_path: string | null
          preview_wm_path: string | null
          processing_status: string | null
          storage_key: string
          thumb_path: string | null
          updated_at: string
          upload_key: string | null
          user_id: string
          width: number | null
        }
        Insert: {
          comment?: string | null
          cover_path?: string | null
          created_at?: string
          file_size?: number | null
          filename: string
          galeria_id: string
          has_watermark?: boolean | null
          height?: number | null
          id?: string
          is_favorite?: boolean | null
          is_selected?: boolean | null
          mime_type?: string | null
          order_index?: number | null
          original_file_size?: number | null
          original_filename: string
          original_path?: string | null
          pasta_id?: string | null
          peso_visual?: number | null
          preview_path?: string | null
          preview_wm_path?: string | null
          processing_status?: string | null
          storage_key: string
          thumb_path?: string | null
          updated_at?: string
          upload_key?: string | null
          user_id: string
          width?: number | null
        }
        Update: {
          comment?: string | null
          cover_path?: string | null
          created_at?: string
          file_size?: number | null
          filename?: string
          galeria_id?: string
          has_watermark?: boolean | null
          height?: number | null
          id?: string
          is_favorite?: boolean | null
          is_selected?: boolean | null
          mime_type?: string | null
          order_index?: number | null
          original_file_size?: number | null
          original_filename?: string
          original_path?: string | null
          pasta_id?: string | null
          peso_visual?: number | null
          preview_path?: string | null
          preview_wm_path?: string | null
          processing_status?: string | null
          storage_key?: string
          thumb_path?: string | null
          updated_at?: string
          upload_key?: string | null
          user_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "galeria_fotos_galeria_id_fkey"
            columns: ["galeria_id"]
            isOneToOne: false
            referencedRelation: "galerias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "galeria_fotos_galeria_id_fkey"
            columns: ["galeria_id"]
            isOneToOne: false
            referencedRelation: "vw_cobrancas_suspeitas"
            referencedColumns: ["galeria_id_candidata"]
          },
          {
            foreignKeyName: "galeria_fotos_pasta_id_fkey"
            columns: ["pasta_id"]
            isOneToOne: false
            referencedRelation: "galeria_pastas"
            referencedColumns: ["id"]
          },
        ]
      }
      galeria_pastas: {
        Row: {
          cover_photo_id: string | null
          created_at: string
          galeria_id: string
          id: string
          nome: string
          ordem: number
          updated_at: string
          user_id: string
        }
        Insert: {
          cover_photo_id?: string | null
          created_at?: string
          galeria_id: string
          id?: string
          nome: string
          ordem?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          cover_photo_id?: string | null
          created_at?: string
          galeria_id?: string
          id?: string
          nome?: string
          ordem?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "galeria_pastas_cover_photo_id_fkey"
            columns: ["cover_photo_id"]
            isOneToOne: false
            referencedRelation: "galeria_fotos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "galeria_pastas_galeria_id_fkey"
            columns: ["galeria_id"]
            isOneToOne: false
            referencedRelation: "galerias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "galeria_pastas_galeria_id_fkey"
            columns: ["galeria_id"]
            isOneToOne: false
            referencedRelation: "vw_cobrancas_suspeitas"
            referencedColumns: ["galeria_id_candidata"]
          },
        ]
      }
      galeria_visitantes: {
        Row: {
          contato: string
          contato_tipo: string
          created_at: string
          device_hash: string | null
          finalized_at: string | null
          fotos_selecionadas: number
          galeria_id: string
          id: string
          nome: string
          status: string
          status_selecao: string
          updated_at: string
        }
        Insert: {
          contato: string
          contato_tipo: string
          created_at?: string
          device_hash?: string | null
          finalized_at?: string | null
          fotos_selecionadas?: number
          galeria_id: string
          id?: string
          nome: string
          status?: string
          status_selecao?: string
          updated_at?: string
        }
        Update: {
          contato?: string
          contato_tipo?: string
          created_at?: string
          device_hash?: string | null
          finalized_at?: string | null
          fotos_selecionadas?: number
          galeria_id?: string
          id?: string
          nome?: string
          status?: string
          status_selecao?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "galeria_visitantes_galeria_id_fkey"
            columns: ["galeria_id"]
            isOneToOne: false
            referencedRelation: "galerias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "galeria_visitantes_galeria_id_fkey"
            columns: ["galeria_id"]
            isOneToOne: false
            referencedRelation: "vw_cobrancas_suspeitas"
            referencedColumns: ["galeria_id_candidata"]
          },
        ]
      }
      galerias: {
        Row: {
          cliente_email: string | null
          cliente_id: string | null
          cliente_nome: string | null
          cliente_telefone: string | null
          configuracoes: Json | null
          cover_id: string | null
          created_at: string
          density: Database["public"]["Enums"]["gallery_density"] | null
          enviado_em: string | null
          finalized_at: string | null
          fotos_incluidas: number
          fotos_selecionadas: number | null
          gallery_password: string | null
          id: string
          mensagem_boas_vindas: string | null
          nome_pacote: string | null
          nome_sessao: string | null
          orcamento_id: string | null
          origin: string | null
          permissao: string | null
          prazo_selecao: string | null
          prazo_selecao_dias: number | null
          public_token: string | null
          published_at: string | null
          regras_congeladas: Json | null
          regras_override: boolean
          regras_selecao: Json | null
          session_id: string | null
          status: string
          status_pagamento: string | null
          status_selecao: string | null
          theme_id: string | null
          theme_overrides: Json | null
          tipo: string
          total_fotos: number | null
          total_fotos_extras_vendidas: number | null
          updated_at: string
          use_custom_theme: boolean | null
          user_id: string
          valor_extras: number | null
          valor_foto_extra: number
          valor_total_vendido: number | null
          venda_modo: string | null
          venda_pagamento_provedor: string | null
          venda_tipo_cobranca: string | null
        }
        Insert: {
          cliente_email?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          cliente_telefone?: string | null
          configuracoes?: Json | null
          cover_id?: string | null
          created_at?: string
          density?: Database["public"]["Enums"]["gallery_density"] | null
          enviado_em?: string | null
          finalized_at?: string | null
          fotos_incluidas?: number
          fotos_selecionadas?: number | null
          gallery_password?: string | null
          id?: string
          mensagem_boas_vindas?: string | null
          nome_pacote?: string | null
          nome_sessao?: string | null
          orcamento_id?: string | null
          origin?: string | null
          permissao?: string | null
          prazo_selecao?: string | null
          prazo_selecao_dias?: number | null
          public_token?: string | null
          published_at?: string | null
          regras_congeladas?: Json | null
          regras_override?: boolean
          regras_selecao?: Json | null
          session_id?: string | null
          status?: string
          status_pagamento?: string | null
          status_selecao?: string | null
          theme_id?: string | null
          theme_overrides?: Json | null
          tipo?: string
          total_fotos?: number | null
          total_fotos_extras_vendidas?: number | null
          updated_at?: string
          use_custom_theme?: boolean | null
          user_id: string
          valor_extras?: number | null
          valor_foto_extra?: number
          valor_total_vendido?: number | null
          venda_modo?: string | null
          venda_pagamento_provedor?: string | null
          venda_tipo_cobranca?: string | null
        }
        Update: {
          cliente_email?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          cliente_telefone?: string | null
          configuracoes?: Json | null
          cover_id?: string | null
          created_at?: string
          density?: Database["public"]["Enums"]["gallery_density"] | null
          enviado_em?: string | null
          finalized_at?: string | null
          fotos_incluidas?: number
          fotos_selecionadas?: number | null
          gallery_password?: string | null
          id?: string
          mensagem_boas_vindas?: string | null
          nome_pacote?: string | null
          nome_sessao?: string | null
          orcamento_id?: string | null
          origin?: string | null
          permissao?: string | null
          prazo_selecao?: string | null
          prazo_selecao_dias?: number | null
          public_token?: string | null
          published_at?: string | null
          regras_congeladas?: Json | null
          regras_override?: boolean
          regras_selecao?: Json | null
          session_id?: string | null
          status?: string
          status_pagamento?: string | null
          status_selecao?: string | null
          theme_id?: string | null
          theme_overrides?: Json | null
          tipo?: string
          total_fotos?: number | null
          total_fotos_extras_vendidas?: number | null
          updated_at?: string
          use_custom_theme?: boolean | null
          user_id?: string
          valor_extras?: number | null
          valor_foto_extra?: number
          valor_total_vendido?: number | null
          venda_modo?: string | null
          venda_pagamento_provedor?: string | null
          venda_tipo_cobranca?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "galerias_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      gallery_credit_packages: {
        Row: {
          active: boolean
          created_at: string
          credits: number
          description: string | null
          id: string
          name: string
          price_cents: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          credits: number
          description?: string | null
          id?: string
          name: string
          price_cents: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          credits?: number
          description?: string | null
          id?: string
          name?: string
          price_cents?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      gallery_discount_presets: {
        Row: {
          created_at: string | null
          id: string
          name: string
          packages: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          packages?: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          packages?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      gallery_email_templates: {
        Row: {
          body: string
          created_at: string | null
          id: string
          name: string
          subject: string
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: string
          name: string
          subject: string
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          name?: string
          subject?: string
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      gallery_settings: {
        Row: {
          active_theme_id: string | null
          client_theme: string | null
          created_at: string | null
          default_allow_comments: boolean | null
          default_allow_download: boolean | null
          default_allow_extra_photos: boolean | null
          default_charge_type: string | null
          default_cover_id: string
          default_expiration_days: number | null
          default_gallery_permission: string | null
          default_image_resize: number
          default_payment_method: string | null
          default_photo_spacing: number | null
          default_pricing_model: string | null
          default_sale_mode: string
          default_theme_id: string | null
          default_watermark: Json | null
          default_watermark_display: string | null
          default_welcome_message: string | null
          email_on_gallery_reactivated: boolean | null
          email_on_gallery_sent: boolean
          email_on_payment_confirmed: boolean
          email_sending_enabled: boolean
          favicon_url: string | null
          last_session_font: string | null
          studio_logo_url: string | null
          studio_name: string | null
          theme_overrides: Json | null
          theme_type: string | null
          updated_at: string | null
          user_id: string
          welcome_message_enabled: boolean | null
        }
        Insert: {
          active_theme_id?: string | null
          client_theme?: string | null
          created_at?: string | null
          default_allow_comments?: boolean | null
          default_allow_download?: boolean | null
          default_allow_extra_photos?: boolean | null
          default_charge_type?: string | null
          default_cover_id?: string
          default_expiration_days?: number | null
          default_gallery_permission?: string | null
          default_image_resize?: number
          default_payment_method?: string | null
          default_photo_spacing?: number | null
          default_pricing_model?: string | null
          default_sale_mode?: string
          default_theme_id?: string | null
          default_watermark?: Json | null
          default_watermark_display?: string | null
          default_welcome_message?: string | null
          email_on_gallery_reactivated?: boolean | null
          email_on_gallery_sent?: boolean
          email_on_payment_confirmed?: boolean
          email_sending_enabled?: boolean
          favicon_url?: string | null
          last_session_font?: string | null
          studio_logo_url?: string | null
          studio_name?: string | null
          theme_overrides?: Json | null
          theme_type?: string | null
          updated_at?: string | null
          user_id: string
          welcome_message_enabled?: boolean | null
        }
        Update: {
          active_theme_id?: string | null
          client_theme?: string | null
          created_at?: string | null
          default_allow_comments?: boolean | null
          default_allow_download?: boolean | null
          default_allow_extra_photos?: boolean | null
          default_charge_type?: string | null
          default_cover_id?: string
          default_expiration_days?: number | null
          default_gallery_permission?: string | null
          default_image_resize?: number
          default_payment_method?: string | null
          default_photo_spacing?: number | null
          default_pricing_model?: string | null
          default_sale_mode?: string
          default_theme_id?: string | null
          default_watermark?: Json | null
          default_watermark_display?: string | null
          default_welcome_message?: string | null
          email_on_gallery_reactivated?: boolean | null
          email_on_gallery_sent?: boolean
          email_on_payment_confirmed?: boolean
          email_sending_enabled?: boolean
          favicon_url?: string | null
          last_session_font?: string | null
          studio_logo_url?: string | null
          studio_name?: string | null
          theme_overrides?: Json | null
          theme_type?: string | null
          updated_at?: string | null
          user_id?: string
          welcome_message_enabled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_active_theme"
            columns: ["active_theme_id"]
            isOneToOne: false
            referencedRelation: "gallery_themes"
            referencedColumns: ["id"]
          },
        ]
      }
      gallery_theme_presets: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          owner_id: string | null
          scope: string
          theme_json: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          owner_id?: string | null
          scope?: string
          theme_json: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          owner_id?: string | null
          scope?: string
          theme_json?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      gallery_themes: {
        Row: {
          accent_color: string
          background_mode: string | null
          created_at: string | null
          emphasis_color: string
          id: string
          name: string
          primary_color: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          accent_color?: string
          background_mode?: string | null
          created_at?: string | null
          emphasis_color?: string
          id?: string
          name: string
          primary_color?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          accent_color?: string
          background_mode?: string | null
          created_at?: string | null
          emphasis_color?: string
          id?: string
          name?: string
          primary_color?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      gallery_token_aliases: {
        Row: {
          created_at: string
          gallery_id: string
          id: string
          old_token: string
        }
        Insert: {
          created_at?: string
          gallery_id: string
          id?: string
          old_token: string
        }
        Update: {
          created_at?: string
          gallery_id?: string
          id?: string
          old_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "gallery_token_aliases_gallery_id_fkey"
            columns: ["gallery_id"]
            isOneToOne: false
            referencedRelation: "galerias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gallery_token_aliases_gallery_id_fkey"
            columns: ["gallery_id"]
            isOneToOne: false
            referencedRelation: "vw_cobrancas_suspeitas"
            referencedColumns: ["galeria_id_candidata"]
          },
        ]
      }
      google_calendar_sync_queue: {
        Row: {
          action: string
          appointment_id: string
          attempts: number
          created_at: string
          id: string
          last_error: string | null
          next_attempt_at: string
          payload: Json | null
          processed_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          action: string
          appointment_id: string
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          payload?: Json | null
          processed_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          action?: string
          appointment_id?: string
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          payload?: Json | null
          processed_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lead_follow_up_config: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          dias_para_follow_up: number | null
          id: string
          status_monitorado: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          dias_para_follow_up?: number | null
          id?: string
          status_monitorado?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          dias_para_follow_up?: number | null
          id?: string
          status_monitorado?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      lead_statuses: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          is_converted: boolean | null
          is_lost: boolean | null
          key: string
          name: string
          sort_order: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          is_converted?: boolean | null
          is_lost?: boolean | null
          key: string
          name: string
          sort_order?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          is_converted?: boolean | null
          is_lost?: boolean | null
          key?: string
          name?: string
          sort_order?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          arquivado: boolean | null
          cliente_id: string | null
          created_at: string
          data_contato: string | null
          data_nascimento: string | null
          dias_sem_interacao: number | null
          email: string | null
          endereco: string | null
          historico_status: Json | null
          id: string
          interacoes: Json | null
          motivo_perda: string | null
          needs_follow_up: boolean | null
          needs_scheduling: boolean | null
          nome: string
          observacoes: string | null
          origem: string | null
          perdido_em: string | null
          scheduled_appointment_id: string | null
          status: string | null
          status_timestamp: string | null
          tags: string[] | null
          telefone: string | null
          ultima_interacao: string | null
          updated_at: string
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          arquivado?: boolean | null
          cliente_id?: string | null
          created_at?: string
          data_contato?: string | null
          data_nascimento?: string | null
          dias_sem_interacao?: number | null
          email?: string | null
          endereco?: string | null
          historico_status?: Json | null
          id?: string
          interacoes?: Json | null
          motivo_perda?: string | null
          needs_follow_up?: boolean | null
          needs_scheduling?: boolean | null
          nome: string
          observacoes?: string | null
          origem?: string | null
          perdido_em?: string | null
          scheduled_appointment_id?: string | null
          status?: string | null
          status_timestamp?: string | null
          tags?: string[] | null
          telefone?: string | null
          ultima_interacao?: string | null
          updated_at?: string
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          arquivado?: boolean | null
          cliente_id?: string | null
          created_at?: string
          data_contato?: string | null
          data_nascimento?: string | null
          dias_sem_interacao?: number | null
          email?: string | null
          endereco?: string | null
          historico_status?: Json | null
          id?: string
          interacoes?: Json | null
          motivo_perda?: string | null
          needs_follow_up?: boolean | null
          needs_scheduling?: boolean | null
          nome?: string
          observacoes?: string | null
          origem?: string | null
          perdido_em?: string | null
          scheduled_appointment_id?: string | null
          status?: string | null
          status_timestamp?: string | null
          tags?: string[] | null
          telefone?: string | null
          ultima_interacao?: string | null
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      metas_personalizadas: {
        Row: {
          ano: number
          categoria: string
          created_at: string | null
          id: string
          mes: number
          meta_faturamento: number
          meta_lucro: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ano: number
          categoria?: string
          created_at?: string | null
          id?: string
          mes: number
          meta_faturamento?: number
          meta_lucro?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ano?: number
          categoria?: string
          created_at?: string | null
          id?: string
          mes?: number
          meta_faturamento?: number
          meta_lucro?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      modelo_de_preco: {
        Row: {
          created_at: string
          id: string
          modelo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          modelo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          modelo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      municipios_ibge: {
        Row: {
          estado: string
          id: number
          nome: string
          regiao: string
          uf: string
        }
        Insert: {
          estado: string
          id: number
          nome: string
          regiao: string
          uf: string
        }
        Update: {
          estado?: string
          id?: number
          nome?: string
          regiao?: string
          uf?: string
        }
        Relationships: []
      }
      pacotes: {
        Row: {
          categoria_id: string
          created_at: string
          fotos_incluidas: number
          id: string
          nome: string
          produtos_incluidos: Json
          updated_at: string
          user_id: string
          valor_base: number
          valor_foto_extra: number
        }
        Insert: {
          categoria_id: string
          created_at?: string
          fotos_incluidas?: number
          id?: string
          nome: string
          produtos_incluidos?: Json
          updated_at?: string
          user_id: string
          valor_base: number
          valor_foto_extra?: number
        }
        Update: {
          categoria_id?: string
          created_at?: string
          fotos_incluidas?: number
          id?: string
          nome?: string
          produtos_incluidos?: Json
          updated_at?: string
          user_id?: string
          valor_base?: number
          valor_foto_extra?: number
        }
        Relationships: [
          {
            foreignKeyName: "pacotes_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      photographer_accounts: {
        Row: {
          account_over_limit: boolean | null
          account_status: Database["public"]["Enums"]["account_status"]
          account_type: Database["public"]["Enums"]["account_type"]
          asaas_customer_id: string | null
          created_at: string
          credits_consumed_total: number | null
          credits_purchased_total: number | null
          credits_subscription: number
          deletion_scheduled_at: string | null
          free_transfer_bytes: number
          galleries_published_total: number
          gallery_credits: number
          id: string
          over_limit_since: string | null
          photo_credits: number
          storage_bonus_bytes: number | null
          updated_at: string
          user_id: string
          watermark_mode: string | null
          watermark_opacity: number | null
          watermark_path: string | null
          watermark_scale: number | null
        }
        Insert: {
          account_over_limit?: boolean | null
          account_status?: Database["public"]["Enums"]["account_status"]
          account_type?: Database["public"]["Enums"]["account_type"]
          asaas_customer_id?: string | null
          created_at?: string
          credits_consumed_total?: number | null
          credits_purchased_total?: number | null
          credits_subscription?: number
          deletion_scheduled_at?: string | null
          free_transfer_bytes?: number
          galleries_published_total?: number
          gallery_credits?: number
          id?: string
          over_limit_since?: string | null
          photo_credits?: number
          storage_bonus_bytes?: number | null
          updated_at?: string
          user_id: string
          watermark_mode?: string | null
          watermark_opacity?: number | null
          watermark_path?: string | null
          watermark_scale?: number | null
        }
        Update: {
          account_over_limit?: boolean | null
          account_status?: Database["public"]["Enums"]["account_status"]
          account_type?: Database["public"]["Enums"]["account_type"]
          asaas_customer_id?: string | null
          created_at?: string
          credits_consumed_total?: number | null
          credits_purchased_total?: number | null
          credits_subscription?: number
          deletion_scheduled_at?: string | null
          free_transfer_bytes?: number
          galleries_published_total?: number
          gallery_credits?: number
          id?: string
          over_limit_since?: string | null
          photo_credits?: number
          storage_bonus_bytes?: number | null
          updated_at?: string
          user_id?: string
          watermark_mode?: string | null
          watermark_opacity?: number | null
          watermark_path?: string | null
          watermark_scale?: number | null
        }
        Relationships: []
      }
      plans: {
        Row: {
          code: string
          created_at: string
          description: string | null
          features: Json | null
          id: string
          interval: string
          is_active: boolean | null
          name: string
          price_cents: number
          stripe_price_id: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          features?: Json | null
          id?: string
          interval: string
          is_active?: boolean | null
          name: string
          price_cents: number
          stripe_price_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          features?: Json | null
          id?: string
          interval?: string
          is_active?: boolean | null
          name?: string
          price_cents?: number
          stripe_price_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      platform_integrations: {
        Row: {
          api_key: string
          created_at: string
          environment: string
          id: string
          last_test_at: string | null
          last_test_message: string | null
          last_test_status: string | null
          provider: string
          scope: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          api_key: string
          created_at?: string
          environment?: string
          id?: string
          last_test_at?: string | null
          last_test_message?: string | null
          last_test_status?: string | null
          provider: string
          scope: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          api_key?: string
          created_at?: string
          environment?: string
          id?: string
          last_test_at?: string | null
          last_test_message?: string | null
          last_test_status?: string | null
          provider?: string
          scope?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      pricing_calculadora_estados: {
        Row: {
          created_at: string | null
          custo_total_calculado: number | null
          custos_extras: Json | null
          horas_estimadas: number | null
          id: string
          is_default: boolean | null
          lucratividade: number | null
          markup: number | null
          nome: string | null
          preco_final_calculado: number | null
          produtos: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          custo_total_calculado?: number | null
          custos_extras?: Json | null
          horas_estimadas?: number | null
          id?: string
          is_default?: boolean | null
          lucratividade?: number | null
          markup?: number | null
          nome?: string | null
          preco_final_calculado?: number | null
          produtos?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          custo_total_calculado?: number | null
          custos_extras?: Json | null
          horas_estimadas?: number | null
          id?: string
          is_default?: boolean | null
          lucratividade?: number | null
          markup?: number | null
          nome?: string | null
          preco_final_calculado?: number | null
          produtos?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      pricing_configs: {
        Row: {
          config_data: Json
          config_type: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          config_data?: Json
          config_type: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          config_data?: Json
          config_type?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pricing_configuracoes: {
        Row: {
          ano_meta: number | null
          created_at: string | null
          dias_trabalhados: number | null
          horas_disponiveis: number | null
          id: string
          margem_lucro_desejada: number | null
          meta_faturamento_anual: number | null
          meta_lucro_anual: number | null
          modo_metas: string | null
          percentual_pro_labore: number | null
          updated_at: string | null
          usar_metas_personalizadas: boolean | null
          user_id: string
        }
        Insert: {
          ano_meta?: number | null
          created_at?: string | null
          dias_trabalhados?: number | null
          horas_disponiveis?: number | null
          id?: string
          margem_lucro_desejada?: number | null
          meta_faturamento_anual?: number | null
          meta_lucro_anual?: number | null
          modo_metas?: string | null
          percentual_pro_labore?: number | null
          updated_at?: string | null
          usar_metas_personalizadas?: boolean | null
          user_id: string
        }
        Update: {
          ano_meta?: number | null
          created_at?: string | null
          dias_trabalhados?: number | null
          horas_disponiveis?: number | null
          id?: string
          margem_lucro_desejada?: number | null
          meta_faturamento_anual?: number | null
          meta_lucro_anual?: number | null
          modo_metas?: string | null
          percentual_pro_labore?: number | null
          updated_at?: string | null
          usar_metas_personalizadas?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      pricing_custos_estudio: {
        Row: {
          created_at: string | null
          descricao: string
          fin_item_id: string | null
          id: string
          origem: string | null
          updated_at: string | null
          user_id: string
          valor: number
        }
        Insert: {
          created_at?: string | null
          descricao: string
          fin_item_id?: string | null
          id?: string
          origem?: string | null
          updated_at?: string | null
          user_id: string
          valor?: number
        }
        Update: {
          created_at?: string | null
          descricao?: string
          fin_item_id?: string | null
          id?: string
          origem?: string | null
          updated_at?: string | null
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pricing_custos_estudio_fin_item_id_fkey"
            columns: ["fin_item_id"]
            isOneToOne: false
            referencedRelation: "fin_items_master"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_equipamentos: {
        Row: {
          created_at: string | null
          data_compra: string
          fin_transaction_id: string | null
          id: string
          nome: string
          updated_at: string | null
          user_id: string
          valor_pago: number
          vida_util: number
        }
        Insert: {
          created_at?: string | null
          data_compra?: string
          fin_transaction_id?: string | null
          id?: string
          nome: string
          updated_at?: string | null
          user_id: string
          valor_pago?: number
          vida_util?: number
        }
        Update: {
          created_at?: string | null
          data_compra?: string
          fin_transaction_id?: string | null
          id?: string
          nome?: string
          updated_at?: string | null
          user_id?: string
          valor_pago?: number
          vida_util?: number
        }
        Relationships: [
          {
            foreignKeyName: "pricing_equipamentos_fin_transaction_id_fkey"
            columns: ["fin_transaction_id"]
            isOneToOne: false
            referencedRelation: "fin_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_gastos_pessoais: {
        Row: {
          created_at: string | null
          descricao: string
          id: string
          updated_at: string | null
          user_id: string
          valor: number
        }
        Insert: {
          created_at?: string | null
          descricao: string
          id?: string
          updated_at?: string | null
          user_id: string
          valor?: number
        }
        Update: {
          created_at?: string | null
          descricao?: string
          id?: string
          updated_at?: string | null
          user_id?: string
          valor?: number
        }
        Relationships: []
      }
      pricing_ignored_transactions: {
        Row: {
          created_at: string | null
          id: string
          transaction_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          transaction_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          transaction_id?: string
          user_id?: string
        }
        Relationships: []
      }
      produto_etiqueta_links: {
        Row: {
          created_at: string
          etiqueta_id: string
          produto_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          etiqueta_id: string
          produto_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          etiqueta_id?: string
          produto_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "produto_etiqueta_links_etiqueta_id_fkey"
            columns: ["etiqueta_id"]
            isOneToOne: false
            referencedRelation: "produto_etiquetas"
            referencedColumns: ["id"]
          },
        ]
      }
      produto_etiquetas: {
        Row: {
          cor: string
          created_at: string
          id: string
          nome: string
          ordem: number
          updated_at: string
          user_id: string
        }
        Insert: {
          cor: string
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          cor?: string
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      produtos: {
        Row: {
          created_at: string
          favorited_at: string | null
          favorito: boolean
          id: string
          nome: string
          preco_custo: number
          preco_venda: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          favorited_at?: string | null
          favorito?: boolean
          id?: string
          nome: string
          preco_custo?: number
          preco_venda?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          favorited_at?: string | null
          favorito?: boolean
          id?: string
          nome?: string
          preco_custo?: number
          preco_venda?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cidade: string | null
          cidade_ibge_id: number | null
          cidade_nome: string | null
          cidade_uf: string | null
          cpf_cnpj: string | null
          created_at: string
          email: string | null
          empresa: string | null
          endereco_comercial: string | null
          id: string
          is_onboarding_complete: boolean | null
          logo_url: string | null
          nicho: string | null
          nome: string | null
          referral_code: string | null
          referred_by: string | null
          site_redes_sociais: string[] | null
          studio_trial_ends_at: string | null
          studio_trial_started_at: string | null
          suspected_duplicate: boolean | null
          telefone: string | null
          telefones: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          cidade?: string | null
          cidade_ibge_id?: number | null
          cidade_nome?: string | null
          cidade_uf?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          empresa?: string | null
          endereco_comercial?: string | null
          id?: string
          is_onboarding_complete?: boolean | null
          logo_url?: string | null
          nicho?: string | null
          nome?: string | null
          referral_code?: string | null
          referred_by?: string | null
          site_redes_sociais?: string[] | null
          studio_trial_ends_at?: string | null
          studio_trial_started_at?: string | null
          suspected_duplicate?: boolean | null
          telefone?: string | null
          telefones?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          cidade?: string | null
          cidade_ibge_id?: number | null
          cidade_nome?: string | null
          cidade_uf?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          empresa?: string | null
          endereco_comercial?: string | null
          id?: string
          is_onboarding_complete?: boolean | null
          logo_url?: string | null
          nicho?: string | null
          nome?: string | null
          referral_code?: string | null
          referred_by?: string | null
          site_redes_sociais?: string[] | null
          studio_trial_ends_at?: string | null
          studio_trial_started_at?: string | null
          suspected_duplicate?: boolean | null
          telefone?: string | null
          telefones?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      r2_migration_log: {
        Row: {
          bytes: number | null
          created_at: string
          error_message: string | null
          id: string
          source_bucket: string
          source_path: string
          status: string
          target_path: string | null
        }
        Insert: {
          bytes?: number | null
          created_at?: string
          error_message?: string | null
          id?: string
          source_bucket: string
          source_path: string
          status?: string
          target_path?: string | null
        }
        Update: {
          bytes?: number | null
          created_at?: string
          error_message?: string | null
          id?: string
          source_bucket?: string
          source_path?: string
          status?: string
          target_path?: string | null
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string | null
          id: string
          referral_code: string
          referred_user_id: string
          referrer_user_id: string
          select_bonus_granted: boolean | null
          transfer_bonus_active: boolean | null
          transfer_bonus_bytes: number | null
          transfer_plan_storage_bytes: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          referral_code: string
          referred_user_id: string
          referrer_user_id: string
          select_bonus_granted?: boolean | null
          transfer_bonus_active?: boolean | null
          transfer_bonus_bytes?: number | null
          transfer_plan_storage_bytes?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          referral_code?: string
          referred_user_id?: string
          referrer_user_id?: string
          select_bonus_granted?: boolean | null
          transfer_bonus_active?: boolean | null
          transfer_bonus_bytes?: number | null
          transfer_plan_storage_bytes?: number | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan_id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id: string
          status: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions_asaas: {
        Row: {
          asaas_customer_id: string | null
          asaas_subscription_id: string | null
          billing_cycle: string
          created_at: string
          id: string
          metadata: Json | null
          next_due_date: string | null
          pending_downgrade_cycle: string | null
          pending_downgrade_plan: string | null
          plan_id: string | null
          plan_type: string
          status: string
          updated_at: string
          user_id: string
          value_cents: number
        }
        Insert: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          billing_cycle?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          next_due_date?: string | null
          pending_downgrade_cycle?: string | null
          pending_downgrade_plan?: string | null
          plan_id?: string | null
          plan_type: string
          status?: string
          updated_at?: string
          user_id: string
          value_cents?: number
        }
        Update: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          billing_cycle?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          next_due_date?: string | null
          pending_downgrade_cycle?: string | null
          pending_downgrade_plan?: string | null
          plan_id?: string | null
          plan_type?: string
          status?: string
          updated_at?: string
          user_id?: string
          value_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_asaas_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "unified_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      support_attachments: {
        Row: {
          created_at: string
          file_name: string | null
          id: string
          kind: Database["public"]["Enums"]["support_attachment_kind"]
          message_id: string | null
          mime_type: string | null
          r2_key: string
          size_bytes: number | null
          ticket_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name?: string | null
          id?: string
          kind: Database["public"]["Enums"]["support_attachment_kind"]
          message_id?: string | null
          mime_type?: string | null
          r2_key: string
          size_bytes?: number | null
          ticket_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["support_attachment_kind"]
          message_id?: string | null
          mime_type?: string | null
          r2_key?: string
          size_bytes?: number | null
          ticket_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "support_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_faq_articles: {
        Row: {
          active: boolean
          category: Database["public"]["Enums"]["support_faq_category"]
          created_at: string
          helpful_count: number
          id: string
          keywords: string[]
          media: Json
          not_helpful_count: number
          ordem: number
          pergunta: string
          published: boolean
          resposta: string
          search_tsv: unknown
          slug: string
          source_ticket_id: string | null
          updated_at: string
          views_count: number
        }
        Insert: {
          active?: boolean
          category: Database["public"]["Enums"]["support_faq_category"]
          created_at?: string
          helpful_count?: number
          id?: string
          keywords?: string[]
          media?: Json
          not_helpful_count?: number
          ordem?: number
          pergunta: string
          published?: boolean
          resposta: string
          search_tsv?: unknown
          slug: string
          source_ticket_id?: string | null
          updated_at?: string
          views_count?: number
        }
        Update: {
          active?: boolean
          category?: Database["public"]["Enums"]["support_faq_category"]
          created_at?: string
          helpful_count?: number
          id?: string
          keywords?: string[]
          media?: Json
          not_helpful_count?: number
          ordem?: number
          pergunta?: string
          published?: boolean
          resposta?: string
          search_tsv?: unknown
          slug?: string
          source_ticket_id?: string | null
          updated_at?: string
          views_count?: number
        }
        Relationships: []
      }
      support_faq_feedback: {
        Row: {
          article_id: string
          created_at: string
          helpful: boolean
          id: string
          user_id: string
        }
        Insert: {
          article_id: string
          created_at?: string
          helpful: boolean
          id?: string
          user_id: string
        }
        Update: {
          article_id?: string
          created_at?: string
          helpful?: boolean
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_faq_feedback_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "support_faq_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_internal_notes: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          ticket_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          ticket_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_internal_notes_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          author_id: string
          author_role: Database["public"]["Enums"]["support_message_author_role"]
          body: string
          created_at: string
          id: string
          ticket_id: string
        }
        Insert: {
          author_id: string
          author_role: Database["public"]["Enums"]["support_message_author_role"]
          body: string
          created_at?: string
          id?: string
          ticket_id: string
        }
        Update: {
          author_id?: string
          author_role?: Database["public"]["Enums"]["support_message_author_role"]
          body?: string
          created_at?: string
          id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          assunto: string
          categoria: Database["public"]["Enums"]["support_ticket_category"]
          closed_at: string | null
          created_at: string
          id: string
          last_message_at: string
          numero: number
          priority: Database["public"]["Enums"]["support_ticket_priority"]
          status: Database["public"]["Enums"]["support_ticket_status"]
          suggestion_status:
            | Database["public"]["Enums"]["support_suggestion_status"]
            | null
          technical_snapshot: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          assunto: string
          categoria: Database["public"]["Enums"]["support_ticket_category"]
          closed_at?: string | null
          created_at?: string
          id?: string
          last_message_at?: string
          numero?: never
          priority?: Database["public"]["Enums"]["support_ticket_priority"]
          status?: Database["public"]["Enums"]["support_ticket_status"]
          suggestion_status?:
            | Database["public"]["Enums"]["support_suggestion_status"]
            | null
          technical_snapshot?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          assunto?: string
          categoria?: Database["public"]["Enums"]["support_ticket_category"]
          closed_at?: string | null
          created_at?: string
          id?: string
          last_message_at?: string
          numero?: never
          priority?: Database["public"]["Enums"]["support_ticket_priority"]
          status?: Database["public"]["Enums"]["support_ticket_status"]
          suggestion_status?:
            | Database["public"]["Enums"]["support_suggestion_status"]
            | null
          technical_snapshot?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      system_audit_logs: {
        Row: {
          correlation_id: string
          created_at: string | null
          error_message: string | null
          event_type: string
          gallery_id: string | null
          id: string
          payload: Json | null
          session_id: string | null
          source: string
          source_name: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          correlation_id: string
          created_at?: string | null
          error_message?: string | null
          event_type: string
          gallery_id?: string | null
          id?: string
          payload?: Json | null
          session_id?: string | null
          source: string
          source_name?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          correlation_id?: string
          created_at?: string | null
          error_message?: string | null
          event_type?: string
          gallery_id?: string | null
          id?: string
          payload?: Json | null
          session_id?: string | null
          source?: string
          source_name?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_audit_logs_gallery_id_fkey"
            columns: ["gallery_id"]
            isOneToOne: false
            referencedRelation: "galerias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_audit_logs_gallery_id_fkey"
            columns: ["gallery_id"]
            isOneToOne: false
            referencedRelation: "vw_cobrancas_suspeitas"
            referencedColumns: ["galeria_id_candidata"]
          },
          {
            foreignKeyName: "system_audit_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "clientes_sessoes"
            referencedColumns: ["id"]
          },
        ]
      }
      system_cache: {
        Row: {
          created_at: string
          expires_at: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          expires_at: string
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          created_at?: string
          expires_at?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      tabelas_precos: {
        Row: {
          categoria_id: string | null
          created_at: string
          faixas: Json
          id: string
          nome: string
          tipo: string
          updated_at: string
          usar_valor_fixo_pacote: boolean | null
          user_id: string
        }
        Insert: {
          categoria_id?: string | null
          created_at?: string
          faixas?: Json
          id?: string
          nome: string
          tipo: string
          updated_at?: string
          usar_valor_fixo_pacote?: boolean | null
          user_id: string
        }
        Update: {
          categoria_id?: string | null
          created_at?: string
          faixas?: Json
          id?: string
          nome?: string
          tipo?: string
          updated_at?: string
          usar_valor_fixo_pacote?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tabelas_precos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      task_attachments: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          nome: string
          storage_path: string
          tamanho: number
          task_id: string
          tipo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          storage_path: string
          tamanho?: number
          task_id: string
          tipo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          storage_path?: string
          tamanho?: number
          task_id?: string
          tipo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      task_people: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          name: string
          sort_order: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
          sort_order?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
          sort_order?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      task_statuses: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          is_done: boolean | null
          key: string
          name: string
          sort_order: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          is_done?: boolean | null
          key: string
          name: string
          sort_order?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          is_done?: boolean | null
          key?: string
          name?: string
          sort_order?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      task_tags: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          name: string
          sort_order: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
          sort_order?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
          sort_order?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          active_sections: Json | null
          assignee_id: string | null
          assignee_name: string | null
          attachments: Json | null
          call_to_action: string | null
          captions: Json | null
          category: string | null
          checked: boolean | null
          checklist_items: Json | null
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          estimated_hours: number | null
          id: string
          last_notified_at: string | null
          notes: string | null
          priority: string | null
          related_budget_id: string | null
          related_cliente_id: string | null
          related_session_id: string | null
          snooze_until: string | null
          social_platforms: string[] | null
          source: string | null
          status: string | null
          tags: string[] | null
          title: string
          type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active_sections?: Json | null
          assignee_id?: string | null
          assignee_name?: string | null
          attachments?: Json | null
          call_to_action?: string | null
          captions?: Json | null
          category?: string | null
          checked?: boolean | null
          checklist_items?: Json | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          last_notified_at?: string | null
          notes?: string | null
          priority?: string | null
          related_budget_id?: string | null
          related_cliente_id?: string | null
          related_session_id?: string | null
          snooze_until?: string | null
          social_platforms?: string[] | null
          source?: string | null
          status?: string | null
          tags?: string[] | null
          title: string
          type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active_sections?: Json | null
          assignee_id?: string | null
          assignee_name?: string | null
          attachments?: Json | null
          call_to_action?: string | null
          captions?: Json | null
          category?: string | null
          checked?: boolean | null
          checklist_items?: Json | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          last_notified_at?: string | null
          notes?: string | null
          priority?: string | null
          related_budget_id?: string | null
          related_cliente_id?: string | null
          related_session_id?: string | null
          snooze_until?: string | null
          social_platforms?: string[] | null
          source?: string | null
          status?: string | null
          tags?: string[] | null
          title?: string
          type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      unified_plans: {
        Row: {
          code: string
          created_at: string | null
          description: string | null
          features: Json | null
          id: string
          includes_select: boolean | null
          includes_studio: boolean | null
          includes_transfer: boolean | null
          is_active: boolean | null
          monthly_price_cents: number
          name: string
          product_family: string
          select_credits_monthly: number | null
          sort_order: number | null
          transfer_storage_bytes: number | null
          updated_at: string | null
          yearly_price_cents: number
        }
        Insert: {
          code: string
          created_at?: string | null
          description?: string | null
          features?: Json | null
          id?: string
          includes_select?: boolean | null
          includes_studio?: boolean | null
          includes_transfer?: boolean | null
          is_active?: boolean | null
          monthly_price_cents?: number
          name: string
          product_family: string
          select_credits_monthly?: number | null
          sort_order?: number | null
          transfer_storage_bytes?: number | null
          updated_at?: string | null
          yearly_price_cents?: number
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string | null
          features?: Json | null
          id?: string
          includes_select?: boolean | null
          includes_studio?: boolean | null
          includes_transfer?: boolean | null
          is_active?: boolean | null
          monthly_price_cents?: number
          name?: string
          product_family?: string
          select_credits_monthly?: number | null
          sort_order?: number | null
          transfer_storage_bytes?: number | null
          updated_at?: string | null
          yearly_price_cents?: number
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          configuracoes_agenda: Json | null
          configuracoes_financeiro: Json | null
          created_at: string
          id: string
          idioma: string | null
          notificacoes_email: boolean | null
          notificacoes_push: boolean | null
          regime_tributario: string | null
          tema: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          configuracoes_agenda?: Json | null
          configuracoes_financeiro?: Json | null
          created_at?: string
          id?: string
          idioma?: string | null
          notificacoes_email?: boolean | null
          notificacoes_push?: boolean | null
          regime_tributario?: string | null
          tema?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          configuracoes_agenda?: Json | null
          configuracoes_financeiro?: Json | null
          created_at?: string
          id?: string
          idioma?: string | null
          notificacoes_email?: boolean | null
          notificacoes_push?: boolean | null
          regime_tributario?: string | null
          tema?: string | null
          updated_at?: string
          user_id?: string
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
      user_theme_preferences: {
        Row: {
          mode: string
          preset_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          mode?: string
          preset_id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          mode?: string
          preset_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      usuarios_integracoes: {
        Row: {
          access_token: string | null
          conectado_em: string | null
          created_at: string | null
          dados_extras: Json | null
          expira_em: string | null
          id: string
          is_default: boolean | null
          mp_public_key: string | null
          mp_user_id: string | null
          provedor: string
          refresh_token: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token?: string | null
          conectado_em?: string | null
          created_at?: string | null
          dados_extras?: Json | null
          expira_em?: string | null
          id?: string
          is_default?: boolean | null
          mp_public_key?: string | null
          mp_user_id?: string | null
          provedor: string
          refresh_token?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string | null
          conectado_em?: string | null
          created_at?: string | null
          dados_extras?: Json | null
          expira_em?: string | null
          id?: string
          is_default?: boolean | null
          mp_public_key?: string | null
          mp_user_id?: string | null
          provedor?: string
          refresh_token?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      vip_users: {
        Row: {
          created_at: string | null
          expires_at: string | null
          granted_by: string | null
          id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          granted_by?: string | null
          id?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          granted_by?: string | null
          id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      visitante_selecoes: {
        Row: {
          comment: string | null
          foto_id: string
          id: string
          is_favorite: boolean
          is_selected: boolean
          updated_at: string
          visitante_id: string
        }
        Insert: {
          comment?: string | null
          foto_id: string
          id?: string
          is_favorite?: boolean
          is_selected?: boolean
          updated_at?: string
          visitante_id: string
        }
        Update: {
          comment?: string | null
          foto_id?: string
          id?: string
          is_favorite?: boolean
          is_selected?: boolean
          updated_at?: string
          visitante_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visitante_selecoes_foto_id_fkey"
            columns: ["foto_id"]
            isOneToOne: false
            referencedRelation: "galeria_fotos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitante_selecoes_visitante_id_fkey"
            columns: ["visitante_id"]
            isOneToOne: false
            referencedRelation: "galeria_visitantes"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events_audit: {
        Row: {
          correlation_id: string | null
          created_at: string | null
          error_log: string | null
          event_name: string | null
          external_id: string | null
          id: string
          payload: Json | null
          processed_at: string | null
          processed_status: string | null
          provider: string
        }
        Insert: {
          correlation_id?: string | null
          created_at?: string | null
          error_log?: string | null
          event_name?: string | null
          external_id?: string | null
          id?: string
          payload?: Json | null
          processed_at?: string | null
          processed_status?: string | null
          provider: string
        }
        Update: {
          correlation_id?: string | null
          created_at?: string | null
          error_log?: string | null
          event_name?: string | null
          external_id?: string | null
          id?: string
          payload?: Json | null
          processed_at?: string | null
          processed_status?: string | null
          provider?: string
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          headers: Json | null
          id: string
          order_nsu: string | null
          payload: Json | null
          processed_at: string | null
          provedor: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          headers?: Json | null
          id?: string
          order_nsu?: string | null
          payload?: Json | null
          processed_at?: string | null
          provedor: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          headers?: Json | null
          id?: string
          order_nsu?: string | null
          payload?: Json | null
          processed_at?: string | null
          provedor?: string
          status?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      crescimento_mensal: {
        Row: {
          faturamento: number | null
          fotografos_ativos: number | null
          mes: string | null
          total_transacoes: number | null
        }
        Relationships: []
      }
      extrato_unificado: {
        Row: {
          cartao: string | null
          categoria: string | null
          categoria_session: string | null
          cliente: string | null
          created_at: string | null
          data: string | null
          data_competencia: string | null
          descricao: string | null
          id: string | null
          meio_pagamento: string | null
          observacoes: string | null
          origem: string | null
          parcela_atual: number | null
          parcela_total: number | null
          projeto: string | null
          session_id: string | null
          status: string | null
          tipo: string | null
          user_id: string | null
          valor: number | null
        }
        Relationships: []
      }
      faturamento_por_cidade: {
        Row: {
          cidade: string | null
          estado: string | null
          faturamento_total: number | null
          mes: string | null
          ticket_medio: number | null
          total_fotografos: number | null
        }
        Relationships: []
      }
      faturamento_por_cidade_nicho: {
        Row: {
          cidade: string | null
          estado: string | null
          faturamento_total: number | null
          mes: string | null
          nicho: string | null
          total_usuarios: number | null
        }
        Relationships: []
      }
      faturamento_por_nicho: {
        Row: {
          faturamento_total: number | null
          mes: string | null
          nicho: string | null
          ticket_medio: number | null
          total_usuarios: number | null
        }
        Relationships: []
      }
      v_infinitepay_latency: {
        Row: {
          cobranca_created: string | null
          data_pagamento: string | null
          db_update_seconds: number | null
          id: string | null
          ip_order_nsu: string | null
          status: string | null
          webhook_proc_seconds: number | null
          webhook_processed: string | null
          webhook_received: string | null
          webhook_status: string | null
        }
        Relationships: []
      }
      vw_cobrancas_suspeitas: {
        Row: {
          cliente_nome: string | null
          cobranca_id: string | null
          created_at: string | null
          descricao: string | null
          finalidade: string | null
          galeria_id_candidata: string | null
          nome_sessao: string | null
          provedor: string | null
          session_id: string | null
          status: string | null
          status_selecao: string | null
          user_id: string | null
          valor: number | null
          valor_foto_extra: number | null
        }
        Relationships: []
      }
      vw_transacoes_orfas: {
        Row: {
          cliente_id: string | null
          cliente_nome: string | null
          cobranca_id: string | null
          created_at: string | null
          data_transacao: string | null
          descricao: string | null
          id: string | null
          tipo: string | null
          user_id: string | null
          valor: number | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_transacoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_transacoes_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_transacoes_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "v_infinitepay_latency"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_transacoes_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "vw_cobrancas_suspeitas"
            referencedColumns: ["cobranca_id"]
          },
        ]
      }
    }
    Functions: {
      _extra_unit_price_for_quantity: {
        Args: {
          p_regras_congeladas: Json
          p_total_extras: number
          p_valor_fixo: number
        }
        Returns: number
      }
      activate_referral_transfer_bonus: {
        Args: { _plan_storage_bytes: number; _referred_user_id: string }
        Returns: boolean
      }
      add_gallery_credits: {
        Args: { _amount: number; _user_id: string }
        Returns: number
      }
      add_session_payment: {
        Args: {
          p_data_transacao: string
          p_descricao?: string
          p_session_id: string
          p_valor: number
        }
        Returns: Json
      }
      admin_grant_credits: {
        Args: { _amount: number; _reason?: string; _target_user_id: string }
        Returns: string
      }
      agenda_allow_blocked_write:
        | { Args: { p_slot_id?: string }; Returns: undefined }
        | {
            Args: { p_date?: string; p_full_day?: boolean; p_slot_id?: string }
            Returns: undefined
          }
      atomic_update_session_extras: {
        Args: {
          p_extras_increment: number
          p_session_id: string
          p_status_galeria?: string
          p_valor_increment: number
          p_valor_unitario: number
        }
        Returns: Json
      }
      calculate_gallery_extra_payment: {
        Args: { p_gallery_id: string }
        Returns: Json
      }
      calculate_manual_products_total: {
        Args: { produtos: Json }
        Returns: number
      }
      check_photo_credits: {
        Args: { _photo_count: number; _user_id: string }
        Returns: boolean
      }
      claim_orphan_payment_for_gallery: {
        Args: { p_cobranca_id: string; p_galeria_id: string }
        Returns: Json
      }
      consume_photo_credits: {
        Args: { _gallery_id: string; _photo_count: number; _user_id: string }
        Returns: boolean
      }
      create_session_from_appointment: {
        Args: { p_appointment_id: string }
        Returns: Json
      }
      deactivate_referral_transfer_bonus: {
        Args: { _referred_user_id: string }
        Returns: boolean
      }
      deduct_gallery_credit: { Args: { _user_id: string }; Returns: boolean }
      delete_appointment_cascade: {
        Args: { p_appointment_id: string; p_keep_payments?: boolean }
        Returns: Json
      }
      delete_workflow_session_cascade: {
        Args: { p_action?: string; p_session_pk: string }
        Returns: Json
      }
      enqueue_google_calendar_sync: {
        Args: {
          p_action: string
          p_appointment_id: string
          p_payload?: Json
          p_user_id: string
        }
        Returns: undefined
      }
      ensure_referral_code: { Args: never; Returns: string }
      expire_subscription_credits: {
        Args: { _user_id: string }
        Returns: undefined
      }
      finalize_gallery_payment: {
        Args: {
          p_cobranca_id: string
          p_manual_method?: string
          p_manual_obs?: string
          p_paid_at?: string
          p_receipt_url?: string
        }
        Returns: Json
      }
      fix_all_valor_pago: { Args: never; Returns: number }
      generate_public_token: { Args: never; Returns: string }
      get_access_state: { Args: never; Returns: Json }
      get_audit_extras_suggestion: {
        Args: { p_galeria_id: string }
        Returns: Json
      }
      get_current_correlation_id: { Args: never; Returns: string }
      get_formulario_resposta_publica: {
        Args: { p_token: string }
        Returns: Json
      }
      get_photo_credit_balance: { Args: { _user_id: string }; Returns: number }
      get_photographer_account: {
        Args: { _user_id: string }
        Returns: {
          account_id: string
          account_status: Database["public"]["Enums"]["account_status"]
          account_type: Database["public"]["Enums"]["account_type"]
          galleries_published_total: number
          gallery_credits: number
          has_gestao_integration: boolean
          is_active: boolean
        }[]
      }
      get_transfer_storage_bytes: {
        Args: { _user_id: string }
        Returns: number
      }
      grant_referral_select_bonus: {
        Args: { _referred_user_id: string }
        Returns: boolean
      }
      has_active_subscription: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_gallery_photo_count: {
        Args: { gallery_id: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_agenda_slot_blocked: {
        Args: { p_date: string; p_time: string; p_user_id: string }
        Returns: boolean
      }
      prepare_gallery_share: {
        Args: { p_gallery_id: string; p_mark_as_sent?: boolean }
        Returns: Json
      }
      purchase_credits: {
        Args: {
          _amount: number
          _description?: string
          _purchase_id: string
          _user_id: string
        }
        Returns: string
      }
      recalculate_referral_transfer_bonus: {
        Args: { _new_plan_storage_bytes: number; _referred_user_id: string }
        Returns: boolean
      }
      recompute_session_paid: {
        Args: { p_session_id: string }
        Returns: undefined
      }
      reconcile_gallery_extras_counters: { Args: never; Returns: Json }
      reconcile_orphan_paid_gallery_charges: { Args: never; Returns: Json }
      reconcile_session_extras: {
        Args: {
          p_destino_sobra?: string
          p_qtd_extras: number
          p_session_id: string
          p_valor_sobra?: number
          p_valor_unitario: number
        }
        Returns: Json
      }
      reconcile_session_payments: {
        Args: { p_session_id: string }
        Returns: Json
      }
      record_device_fingerprint: {
        Args: {
          _event_type?: string
          _fingerprint: string
          _ip_address?: string
          _user_agent?: string
          _user_id: string
        }
        Returns: Json
      }
      refund_photo_credit: { Args: { _user_id: string }; Returns: undefined }
      register_referral: { Args: { _referral_code: string }; Returns: boolean }
      release_advisory_lock: { Args: { lock_key: string }; Returns: boolean }
      renew_subscription_credits: {
        Args: { _amount: number; _user_id: string }
        Returns: undefined
      }
      reopen_gallery_selection: {
        Args: { p_days: number; p_gallery_id: string }
        Returns: Json
      }
      set_session_extras: {
        Args: {
          p_session_id: string
          p_status_galeria?: string
          p_total_extras: number
          p_total_valor: number
          p_valor_unitario: number
        }
        Returns: undefined
      }
      start_studio_trial: { Args: never; Returns: Json }
      support_faq_increment_view: {
        Args: { _article_id: string }
        Returns: undefined
      }
      support_faq_register_feedback: {
        Args: { _article_id: string; _helpful: boolean }
        Returns: undefined
      }
      support_faq_search: {
        Args: { lim?: number; q: string }
        Returns: {
          active: boolean
          category: Database["public"]["Enums"]["support_faq_category"]
          created_at: string
          helpful_count: number
          id: string
          keywords: string[]
          media: Json
          not_helpful_count: number
          ordem: number
          pergunta: string
          published: boolean
          resposta: string
          search_tsv: unknown
          slug: string
          source_ticket_id: string | null
          updated_at: string
          views_count: number
        }[]
        SetofOptions: {
          from: "*"
          to: "support_faq_articles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      support_is_admin: { Args: { _uid: string }; Returns: boolean }
      try_acquire_advisory_lock: {
        Args: { lock_key: string }
        Returns: boolean
      }
      try_lock_gallery_selection: {
        Args: { p_gallery_id: string }
        Returns: Json
      }
      try_lock_visitor_selection: {
        Args: { p_visitor_id: string }
        Returns: Json
      }
      user_has_gallery_access: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      account_status: "active" | "suspended" | "canceled"
      account_type: "gallery_solo" | "starter" | "pro" | "pro_gallery"
      app_role: "admin" | "moderator" | "user"
      email_delivery_event_type:
        | "gallery_sent"
        | "payment_confirmed"
        | "gallery_reactivated"
      email_delivery_status: "enviado" | "erro" | "ignorado"
      gallery_density: "compact" | "comfortable" | "airy"
      support_attachment_kind: "image" | "video"
      support_faq_category:
        | "conta"
        | "galerias"
        | "lunari_studio"
        | "lunari_gallery"
        | "financeiro"
        | "assinatura"
        | "configuracoes"
        | "outros"
      support_message_author_role: "user" | "admin" | "system"
      support_suggestion_status:
        | "recebida"
        | "em_analise"
        | "planejada"
        | "em_desenvolvimento"
        | "implementada"
        | "recusada"
      support_ticket_category:
        | "problema_tecnico"
        | "duvida"
        | "sugestao"
        | "financeiro"
        | "conta"
        | "galerias"
        | "outro"
      support_ticket_priority: "baixa" | "normal" | "alta" | "urgente"
      support_ticket_status:
        | "novo"
        | "recebido"
        | "em_analise"
        | "aguardando_cliente"
        | "resolvido"
        | "resolvido_whatsapp"
        | "fechado"
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
      account_status: ["active", "suspended", "canceled"],
      account_type: ["gallery_solo", "starter", "pro", "pro_gallery"],
      app_role: ["admin", "moderator", "user"],
      email_delivery_event_type: [
        "gallery_sent",
        "payment_confirmed",
        "gallery_reactivated",
      ],
      email_delivery_status: ["enviado", "erro", "ignorado"],
      gallery_density: ["compact", "comfortable", "airy"],
      support_attachment_kind: ["image", "video"],
      support_faq_category: [
        "conta",
        "galerias",
        "lunari_studio",
        "lunari_gallery",
        "financeiro",
        "assinatura",
        "configuracoes",
        "outros",
      ],
      support_message_author_role: ["user", "admin", "system"],
      support_suggestion_status: [
        "recebida",
        "em_analise",
        "planejada",
        "em_desenvolvimento",
        "implementada",
        "recusada",
      ],
      support_ticket_category: [
        "problema_tecnico",
        "duvida",
        "sugestao",
        "financeiro",
        "conta",
        "galerias",
        "outro",
      ],
      support_ticket_priority: ["baixa", "normal", "alta", "urgente"],
      support_ticket_status: [
        "novo",
        "recebido",
        "em_analise",
        "aguardando_cliente",
        "resolvido",
        "resolvido_whatsapp",
        "fechado",
      ],
    },
  },
} as const
