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
      allowed_emails: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          note: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          note?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          note?: string | null
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
      blog_posts: {
        Row: {
          content: string
          created_at: string
          featured_image_url: string | null
          id: string
          meta_description: string | null
          meta_title: string | null
          published_at: string | null
          slug: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          featured_image_url?: string | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          published_at?: string | null
          slug: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          featured_image_url?: string | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          published_at?: string | null
          slug?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      categorias: {
        Row: {
          cor: string
          created_at: string
          id: string
          nome: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cor: string
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cor?: string
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
        ]
      }
      clientes_transacoes: {
        Row: {
          cliente_id: string
          created_at: string | null
          data_transacao: string
          data_vencimento: string | null
          descricao: string | null
          id: string
          session_id: string | null
          tipo: string
          updated_at: string | null
          updated_by: string | null
          user_id: string
          valor: number
        }
        Insert: {
          cliente_id: string
          created_at?: string | null
          data_transacao: string
          data_vencimento?: string | null
          descricao?: string | null
          id?: string
          session_id?: string | null
          tipo: string
          updated_at?: string | null
          updated_by?: string | null
          user_id: string
          valor: number
        }
        Update: {
          cliente_id?: string
          created_at?: string | null
          data_transacao?: string
          data_vencimento?: string | null
          descricao?: string | null
          id?: string
          session_id?: string | null
          tipo?: string
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string
          valor?: number
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
            foreignKeyName: "clientes_transacoes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "clientes_sessoes"
            referencedColumns: ["session_id"]
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
      cobrancas: {
        Row: {
          cliente_id: string
          created_at: string | null
          data_pagamento: string | null
          descricao: string | null
          id: string
          ip_checkout_url: string | null
          ip_order_nsu: string | null
          ip_receipt_url: string | null
          ip_transaction_nsu: string | null
          mp_expiration_date: string | null
          mp_payment_id: string | null
          mp_payment_link: string | null
          mp_pix_copia_cola: string | null
          mp_preference_id: string | null
          mp_qr_code: string | null
          mp_qr_code_base64: string | null
          provedor: string | null
          session_id: string | null
          status: string | null
          tipo_cobranca: string
          updated_at: string | null
          user_id: string
          valor: number
        }
        Insert: {
          cliente_id: string
          created_at?: string | null
          data_pagamento?: string | null
          descricao?: string | null
          id?: string
          ip_checkout_url?: string | null
          ip_order_nsu?: string | null
          ip_receipt_url?: string | null
          ip_transaction_nsu?: string | null
          mp_expiration_date?: string | null
          mp_payment_id?: string | null
          mp_payment_link?: string | null
          mp_pix_copia_cola?: string | null
          mp_preference_id?: string | null
          mp_qr_code?: string | null
          mp_qr_code_base64?: string | null
          provedor?: string | null
          session_id?: string | null
          status?: string | null
          tipo_cobranca: string
          updated_at?: string | null
          user_id: string
          valor: number
        }
        Update: {
          cliente_id?: string
          created_at?: string | null
          data_pagamento?: string | null
          descricao?: string | null
          id?: string
          ip_checkout_url?: string | null
          ip_order_nsu?: string | null
          ip_receipt_url?: string | null
          ip_transaction_nsu?: string | null
          mp_expiration_date?: string | null
          mp_payment_id?: string | null
          mp_payment_link?: string | null
          mp_pix_copia_cola?: string | null
          mp_preference_id?: string | null
          mp_qr_code?: string | null
          mp_qr_code_base64?: string | null
          provedor?: string | null
          session_id?: string | null
          status?: string | null
          tipo_cobranca?: string
          updated_at?: string | null
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "cobrancas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
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
      etapas_trabalho: {
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
          ordem: number
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
        ]
      }
      galeria_fotos: {
        Row: {
          comment: string | null
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
          original_filename: string
          original_path: string | null
          preview_path: string | null
          preview_wm_path: string | null
          storage_key: string
          thumb_path: string | null
          updated_at: string
          user_id: string
          width: number | null
        }
        Insert: {
          comment?: string | null
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
          original_filename: string
          original_path?: string | null
          preview_path?: string | null
          preview_wm_path?: string | null
          storage_key: string
          thumb_path?: string | null
          updated_at?: string
          user_id: string
          width?: number | null
        }
        Update: {
          comment?: string | null
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
          original_filename?: string
          original_path?: string | null
          preview_path?: string | null
          preview_wm_path?: string | null
          storage_key?: string
          thumb_path?: string | null
          updated_at?: string
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
        ]
      }
      galerias: {
        Row: {
          cliente_email: string | null
          cliente_id: string | null
          cliente_nome: string | null
          cliente_telefone: string | null
          configuracoes: Json | null
          created_at: string
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
          permissao: string | null
          prazo_selecao: string | null
          prazo_selecao_dias: number | null
          public_token: string | null
          published_at: string | null
          regras_selecao: Json | null
          session_id: string | null
          status: string
          status_pagamento: string | null
          status_selecao: string | null
          total_fotos: number | null
          total_fotos_extras_vendidas: number | null
          updated_at: string
          user_id: string
          valor_extras: number | null
          valor_foto_extra: number
          valor_total_vendido: number | null
        }
        Insert: {
          cliente_email?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          cliente_telefone?: string | null
          configuracoes?: Json | null
          created_at?: string
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
          permissao?: string | null
          prazo_selecao?: string | null
          prazo_selecao_dias?: number | null
          public_token?: string | null
          published_at?: string | null
          regras_selecao?: Json | null
          session_id?: string | null
          status?: string
          status_pagamento?: string | null
          status_selecao?: string | null
          total_fotos?: number | null
          total_fotos_extras_vendidas?: number | null
          updated_at?: string
          user_id: string
          valor_extras?: number | null
          valor_foto_extra?: number
          valor_total_vendido?: number | null
        }
        Update: {
          cliente_email?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          cliente_telefone?: string | null
          configuracoes?: Json | null
          created_at?: string
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
          permissao?: string | null
          prazo_selecao?: string | null
          prazo_selecao_dias?: number | null
          public_token?: string | null
          published_at?: string | null
          regras_selecao?: Json | null
          session_id?: string | null
          status?: string
          status_pagamento?: string | null
          status_selecao?: string | null
          total_fotos?: number | null
          total_fotos_extras_vendidas?: number | null
          updated_at?: string
          user_id?: string
          valor_extras?: number | null
          valor_foto_extra?: number
          valor_total_vendido?: number | null
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
      gallery_clientes: {
        Row: {
          created_at: string
          email: string
          gallery_password: string
          id: string
          nome: string
          status: string
          telefone: string | null
          total_galerias: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          gallery_password: string
          id?: string
          nome: string
          status?: string
          telefone?: string | null
          total_galerias?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          gallery_password?: string
          id?: string
          nome?: string
          status?: string
          telefone?: string | null
          total_galerias?: number | null
          updated_at?: string
          user_id?: string
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
          default_expiration_days: number | null
          default_gallery_permission: string | null
          default_watermark: Json | null
          favicon_url: string | null
          studio_logo_url: string | null
          studio_name: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          active_theme_id?: string | null
          client_theme?: string | null
          created_at?: string | null
          default_expiration_days?: number | null
          default_gallery_permission?: string | null
          default_watermark?: Json | null
          favicon_url?: string | null
          studio_logo_url?: string | null
          studio_name?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          active_theme_id?: string | null
          client_theme?: string | null
          created_at?: string | null
          default_expiration_days?: number | null
          default_gallery_permission?: string | null
          default_watermark?: Json | null
          favicon_url?: string | null
          studio_logo_url?: string | null
          studio_name?: string | null
          updated_at?: string | null
          user_id?: string
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
      gallery_themes: {
        Row: {
          accent_color: string
          background_color: string
          created_at: string | null
          id: string
          is_default: boolean | null
          name: string
          primary_color: string
          text_color: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          accent_color?: string
          background_color?: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          primary_color?: string
          text_color?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          accent_color?: string
          background_color?: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          primary_color?: string
          text_color?: string
          updated_at?: string | null
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
          percentual_pro_labore: number | null
          updated_at: string | null
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
          percentual_pro_labore?: number | null
          updated_at?: string | null
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
          percentual_pro_labore?: number | null
          updated_at?: string | null
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
      produtos: {
        Row: {
          created_at: string
          id: string
          nome: string
          preco_custo: number
          preco_venda: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          preco_custo?: number
          preco_venda?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
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
          site_redes_sociais: string[] | null
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
          site_redes_sociais?: string[] | null
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
          site_redes_sociais?: string[] | null
          telefone?: string | null
          telefones?: string[] | null
          updated_at?: string
          user_id?: string
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
      usuarios_integracoes: {
        Row: {
          access_token: string | null
          conectado_em: string | null
          created_at: string | null
          dados_extras: Json | null
          expira_em: string | null
          id: string
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
          descricao: string | null
          id: string | null
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
    }
    Functions: {
      add_session_payment: {
        Args: {
          p_data_transacao: string
          p_descricao?: string
          p_session_id: string
          p_valor: number
        }
        Returns: Json
      }
      calculate_manual_products_total: {
        Args: { produtos: Json }
        Returns: number
      }
      create_session_from_appointment: {
        Args: { p_appointment_id: string }
        Returns: Json
      }
      delete_appointment_cascade: {
        Args: { p_appointment_id: string; p_keep_payments?: boolean }
        Returns: Json
      }
      fix_all_valor_pago: { Args: never; Returns: number }
      generate_public_token: { Args: never; Returns: string }
      get_access_state: { Args: never; Returns: Json }
      has_active_subscription: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      recompute_session_paid: {
        Args: { p_session_id: string }
        Returns: undefined
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
