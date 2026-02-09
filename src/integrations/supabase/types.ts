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
      accounts: {
        Row: {
          account_group: string | null
          account_type: Database["public"]["Enums"]["account_type"]
          allow_manual_entry: boolean | null
          code: string
          created_at: string
          currency_id: string | null
          default_tax_id: string | null
          id: string
          internal_type: string | null
          is_active: boolean | null
          is_frozen: boolean | null
          level: number
          name: string
          opening_balance: number | null
          parent_id: string | null
          reconcile: boolean | null
          updated_at: string
        }
        Insert: {
          account_group?: string | null
          account_type: Database["public"]["Enums"]["account_type"]
          allow_manual_entry?: boolean | null
          code: string
          created_at?: string
          currency_id?: string | null
          default_tax_id?: string | null
          id?: string
          internal_type?: string | null
          is_active?: boolean | null
          is_frozen?: boolean | null
          level?: number
          name: string
          opening_balance?: number | null
          parent_id?: string | null
          reconcile?: boolean | null
          updated_at?: string
        }
        Update: {
          account_group?: string | null
          account_type?: Database["public"]["Enums"]["account_type"]
          allow_manual_entry?: boolean | null
          code?: string
          created_at?: string
          currency_id?: string | null
          default_tax_id?: string | null
          id?: string
          internal_type?: string | null
          is_active?: boolean | null
          is_frozen?: boolean | null
          level?: number
          name?: string
          opening_balance?: number | null
          parent_id?: string | null
          reconcile?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          account_id: string | null
          account_number: string
          bank_name: string
          branch_id: string | null
          code: string
          created_at: string
          currency_id: string | null
          current_balance: number | null
          id: string
          is_active: boolean | null
          opening_balance: number | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          account_number: string
          bank_name: string
          branch_id?: string | null
          code: string
          created_at?: string
          currency_id?: string | null
          current_balance?: number | null
          id?: string
          is_active?: boolean | null
          opening_balance?: number | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          account_number?: string
          bank_name?: string
          branch_id?: string | null
          code?: string
          created_at?: string
          currency_id?: string | null
          current_balance?: number | null
          id?: string
          is_active?: boolean | null
          opening_balance?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_accounts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_accounts_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_reconciliations: {
        Row: {
          adjustment_journal_id: string | null
          bank_account_id: string
          book_balance: number
          created_at: string
          created_by: string
          difference: number
          id: string
          notes: string | null
          reconciliation_date: string
          statement_balance: number
          status: string | null
        }
        Insert: {
          adjustment_journal_id?: string | null
          bank_account_id: string
          book_balance?: number
          created_at?: string
          created_by: string
          difference?: number
          id?: string
          notes?: string | null
          reconciliation_date: string
          statement_balance?: number
          status?: string | null
        }
        Update: {
          adjustment_journal_id?: string | null
          bank_account_id?: string
          book_balance?: number
          created_at?: string
          created_by?: string
          difference?: number
          id?: string
          notes?: string | null
          reconciliation_date?: string
          statement_balance?: number
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_reconciliations_adjustment_journal_id_fkey"
            columns: ["adjustment_journal_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliations_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_statement_lines: {
        Row: {
          created_at: string
          credit_amount: number | null
          debit_amount: number | null
          description: string | null
          id: string
          is_matched: boolean | null
          match_difference: number | null
          matched_entry_id: string | null
          reference: string | null
          statement_id: string
          transaction_date: string
        }
        Insert: {
          created_at?: string
          credit_amount?: number | null
          debit_amount?: number | null
          description?: string | null
          id?: string
          is_matched?: boolean | null
          match_difference?: number | null
          matched_entry_id?: string | null
          reference?: string | null
          statement_id: string
          transaction_date: string
        }
        Update: {
          created_at?: string
          credit_amount?: number | null
          debit_amount?: number | null
          description?: string | null
          id?: string
          is_matched?: boolean | null
          match_difference?: number | null
          matched_entry_id?: string | null
          reference?: string | null
          statement_id?: string
          transaction_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_statement_lines_matched_entry_id_fkey"
            columns: ["matched_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entry_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statement_lines_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "bank_statements"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_statements: {
        Row: {
          bank_account_id: string
          closing_balance: number
          created_at: string
          created_by: string
          id: string
          opening_balance: number
          statement_date: string
          statement_number: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          bank_account_id: string
          closing_balance?: number
          created_at?: string
          created_by: string
          id?: string
          opening_balance?: number
          statement_date: string
          statement_number?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          bank_account_id?: string
          closing_balance?: number
          created_at?: string
          created_by?: string
          id?: string
          opening_balance?: number
          statement_date?: string
          statement_number?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_statements_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          code: string
          created_at: string
          id: string
          is_active: boolean | null
          manager_id: string | null
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          code: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          manager_id?: string | null
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          manager_id?: string | null
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_boxes: {
        Row: {
          account_id: string | null
          branch_id: string | null
          code: string
          created_at: string
          current_balance: number | null
          id: string
          is_active: boolean | null
          name: string
          opening_balance: number | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          branch_id?: string | null
          code: string
          created_at?: string
          current_balance?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          opening_balance?: number | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          branch_id?: string | null
          code?: string
          created_at?: string
          current_balance?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          opening_balance?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_boxes_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_boxes_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_allocations: {
        Row: {
          allocated_amount: number
          collection_id: string
          created_at: string
          id: string
          invoice_id: string
        }
        Insert: {
          allocated_amount: number
          collection_id: string
          created_at?: string
          id?: string
          invoice_id: string
        }
        Update: {
          allocated_amount?: number
          collection_id?: string
          created_at?: string
          id?: string
          invoice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_allocations_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          amount: number
          bank_account_id: string | null
          cash_box_id: string | null
          created_at: string
          created_by: string
          customer_id: string
          id: string
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          receipt_date: string
          receipt_number: string
          updated_at: string
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          cash_box_id?: string | null
          created_at?: string
          created_by: string
          customer_id: string
          id?: string
          notes?: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          receipt_date: string
          receipt_number: string
          updated_at?: string
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          cash_box_id?: string | null
          created_at?: string
          created_by?: string
          customer_id?: string
          id?: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          receipt_date?: string
          receipt_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collections_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collections_cash_box_id_fkey"
            columns: ["cash_box_id"]
            isOneToOne: false
            referencedRelation: "cash_boxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collections_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_centers: {
        Row: {
          branch_id: string | null
          code: string
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          code: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_centers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_centers_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      currencies: {
        Row: {
          code: string
          created_at: string
          exchange_rate: number
          id: string
          is_active: boolean | null
          is_base: boolean | null
          name: string
          symbol: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          exchange_rate?: number
          id?: string
          is_active?: boolean | null
          is_base?: boolean | null
          name: string
          symbol: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          exchange_rate?: number
          id?: string
          is_active?: boolean | null
          is_base?: boolean | null
          name?: string
          symbol?: string
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          account_id: string | null
          address: string | null
          code: string
          created_at: string
          credit_limit: number | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          payment_terms: number | null
          phone: string | null
          tax_number: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          address?: string | null
          code: string
          created_at?: string
          credit_limit?: number | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          payment_terms?: number | null
          phone?: string | null
          tax_number?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          address?: string | null
          code?: string
          created_at?: string
          credit_limit?: number | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          payment_terms?: number | null
          phone?: string | null
          tax_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      document_sequences: {
        Row: {
          branch_id: string
          created_at: string
          current_number: number
          document_type: string
          format_pattern: string
          id: string
          number_padding: number
          prefix: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          current_number?: number
          document_type: string
          format_pattern?: string
          id?: string
          number_padding?: number
          prefix: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          current_number?: number
          document_type?: string
          format_pattern?: string
          id?: string
          number_padding?: number
          prefix?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_sequences_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rates: {
        Row: {
          buy_rate: number
          created_at: string
          created_by: string
          currency_id: string
          id: string
          is_locked: boolean | null
          rate_date: string
          sell_rate: number
          updated_at: string
        }
        Insert: {
          buy_rate?: number
          created_at?: string
          created_by: string
          currency_id: string
          id?: string
          is_locked?: boolean | null
          rate_date: string
          sell_rate?: number
          updated_at?: string
        }
        Update: {
          buy_rate?: number
          created_at?: string
          created_by?: string
          currency_id?: string
          id?: string
          is_locked?: boolean | null
          rate_date?: string
          sell_rate?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exchange_rates_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses_revenues: {
        Row: {
          account_id: string | null
          amount: number
          category: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          notes: string | null
          payment_method: string | null
          reference: string | null
          transaction_date: string
          transaction_number: string
          transaction_type: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          amount?: number
          category?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          reference?: string | null
          transaction_date: string
          transaction_number: string
          transaction_type: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          reference?: string | null
          transaction_date?: string
          transaction_number?: string
          transaction_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_revenues_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_periods: {
        Row: {
          code: string
          created_at: string
          end_date: string
          id: string
          is_closed: boolean | null
          name: string
          start_date: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          end_date: string
          id?: string
          is_closed?: boolean | null
          name: string
          start_date: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          end_date?: string
          id?: string
          is_closed?: boolean | null
          name?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      fixed_assets: {
        Row: {
          account_id: string | null
          accumulated_depreciation: number | null
          category: string | null
          code: string
          created_at: string
          created_by: string
          current_value: number | null
          depreciation_method: string | null
          description: string | null
          id: string
          location: string | null
          name: string
          purchase_cost: number
          purchase_date: string
          salvage_value: number | null
          status: string | null
          updated_at: string
          useful_life_years: number | null
        }
        Insert: {
          account_id?: string | null
          accumulated_depreciation?: number | null
          category?: string | null
          code: string
          created_at?: string
          created_by: string
          current_value?: number | null
          depreciation_method?: string | null
          description?: string | null
          id?: string
          location?: string | null
          name: string
          purchase_cost?: number
          purchase_date: string
          salvage_value?: number | null
          status?: string | null
          updated_at?: string
          useful_life_years?: number | null
        }
        Update: {
          account_id?: string | null
          accumulated_depreciation?: number | null
          category?: string | null
          code?: string
          created_at?: string
          created_by?: string
          current_value?: number | null
          depreciation_method?: string | null
          description?: string | null
          id?: string
          location?: string | null
          name?: string
          purchase_cost?: number
          purchase_date?: string
          salvage_value?: number | null
          status?: string | null
          updated_at?: string
          useful_life_years?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fixed_assets_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      fx_adjustments: {
        Row: {
          adjusted_amount: number
          adjustment_date: string
          adjustment_type: string
          created_at: string
          created_by: string
          currency_id: string
          difference_amount: number
          gain_account_id: string | null
          id: string
          journal_entry_id: string | null
          loss_account_id: string | null
          notes: string | null
          original_amount: number
        }
        Insert: {
          adjusted_amount?: number
          adjustment_date: string
          adjustment_type: string
          created_at?: string
          created_by: string
          currency_id: string
          difference_amount?: number
          gain_account_id?: string | null
          id?: string
          journal_entry_id?: string | null
          loss_account_id?: string | null
          notes?: string | null
          original_amount?: number
        }
        Update: {
          adjusted_amount?: number
          adjustment_date?: string
          adjustment_type?: string
          created_at?: string
          created_by?: string
          currency_id?: string
          difference_amount?: number
          gain_account_id?: string | null
          id?: string
          journal_entry_id?: string | null
          loss_account_id?: string | null
          notes?: string | null
          original_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "fx_adjustments_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fx_adjustments_gain_account_id_fkey"
            columns: ["gain_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fx_adjustments_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fx_adjustments_loss_account_id_fkey"
            columns: ["loss_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string
          created_by: string
          id: string
          movement_date: string
          movement_number: string
          notes: string | null
          product_id: string
          quantity: number
          reference: string | null
          unit_cost: number | null
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          movement_date: string
          movement_number: string
          notes?: string | null
          product_id: string
          quantity: number
          reference?: string | null
          unit_cost?: number | null
          warehouse_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          movement_date?: string
          movement_number?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          reference?: string | null
          unit_cost?: number | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          approved_by: string | null
          branch_id: string | null
          cost_center_id: string | null
          created_at: string
          created_by: string
          currency_id: string | null
          description: string | null
          entry_date: string
          entry_number: string
          exchange_rate: number | null
          id: string
          is_posted: boolean | null
          journal_type_id: string | null
          original_amount: number | null
          original_currency_id: string | null
          reference: string | null
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          branch_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          created_by: string
          currency_id?: string | null
          description?: string | null
          entry_date: string
          entry_number: string
          exchange_rate?: number | null
          id?: string
          is_posted?: boolean | null
          journal_type_id?: string | null
          original_amount?: number | null
          original_currency_id?: string | null
          reference?: string | null
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          branch_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          created_by?: string
          currency_id?: string | null
          description?: string | null
          entry_date?: string
          entry_number?: string
          exchange_rate?: number | null
          id?: string
          is_posted?: boolean | null
          journal_type_id?: string | null
          original_amount?: number | null
          original_currency_id?: string | null
          reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_journal_type_id_fkey"
            columns: ["journal_type_id"]
            isOneToOne: false
            referencedRelation: "journal_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_original_currency_id_fkey"
            columns: ["original_currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entry_lines: {
        Row: {
          account_id: string
          created_at: string
          credit_amount: number | null
          debit_amount: number | null
          description: string | null
          id: string
          journal_entry_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          credit_amount?: number | null
          debit_amount?: number | null
          description?: string | null
          id?: string
          journal_entry_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          credit_amount?: number | null
          debit_amount?: number | null
          description?: string | null
          id?: string
          journal_entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entry_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_types: {
        Row: {
          bank_account_id: string | null
          cash_box_id: string | null
          code: string
          created_at: string
          default_credit_account_id: string | null
          default_debit_account_id: string | null
          id: string
          is_active: boolean | null
          is_auto_generated: boolean | null
          name: string
          type_category: string
        }
        Insert: {
          bank_account_id?: string | null
          cash_box_id?: string | null
          code: string
          created_at?: string
          default_credit_account_id?: string | null
          default_debit_account_id?: string | null
          id?: string
          is_active?: boolean | null
          is_auto_generated?: boolean | null
          name: string
          type_category: string
        }
        Update: {
          bank_account_id?: string | null
          cash_box_id?: string | null
          code?: string
          created_at?: string
          default_credit_account_id?: string | null
          default_debit_account_id?: string | null
          id?: string
          is_active?: boolean | null
          is_auto_generated?: boolean | null
          name?: string
          type_category?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_types_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: true
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_types_cash_box_id_fkey"
            columns: ["cash_box_id"]
            isOneToOne: true
            referencedRelation: "cash_boxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_types_default_credit_account_id_fkey"
            columns: ["default_credit_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_types_default_debit_account_id_fkey"
            columns: ["default_debit_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_allocations: {
        Row: {
          allocated_amount: number
          created_at: string
          id: string
          invoice_id: string
          payment_id: string
        }
        Insert: {
          allocated_amount: number
          created_at?: string
          id?: string
          invoice_id: string
          payment_id: string
        }
        Update: {
          allocated_amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "purchase_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          bank_account_id: string | null
          cash_box_id: string | null
          created_at: string
          created_by: string
          id: string
          notes: string | null
          payment_date: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_number: string
          supplier_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          cash_box_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          notes?: string | null
          payment_date: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_number: string
          supplier_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          cash_box_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_number?: string
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_cash_box_id_fkey"
            columns: ["cash_box_id"]
            isOneToOne: false
            referencedRelation: "cash_boxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          module: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          module: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          module?: string
          name?: string
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          code: string
          cost_price: number | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          max_stock_level: number | null
          min_stock_level: number | null
          name: string
          reorder_point: number | null
          selling_price: number | null
          supplier_id: string | null
          track_inventory: boolean | null
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          code: string
          cost_price?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          max_stock_level?: number | null
          min_stock_level?: number | null
          name: string
          reorder_point?: number | null
          selling_price?: number | null
          supplier_id?: string | null
          track_inventory?: boolean | null
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          code?: string
          cost_price?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          max_stock_level?: number | null
          min_stock_level?: number | null
          name?: string
          reorder_point?: number | null
          selling_price?: number | null
          supplier_id?: string | null
          track_inventory?: boolean | null
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units_of_measure"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      purchase_invoice_lines: {
        Row: {
          created_at: string
          description: string | null
          discount_percent: number | null
          id: string
          invoice_id: string
          line_total: number
          product_id: string
          quantity: number
          tax_percent: number | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount_percent?: number | null
          id?: string
          invoice_id: string
          line_total: number
          product_id: string
          quantity: number
          tax_percent?: number | null
          unit_price: number
        }
        Update: {
          created_at?: string
          description?: string | null
          discount_percent?: number | null
          id?: string
          invoice_id?: string
          line_total?: number
          product_id?: string
          quantity?: number
          tax_percent?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "purchase_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoice_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_invoices: {
        Row: {
          approved_by: string | null
          branch_id: string | null
          created_at: string
          created_by: string
          currency_id: string | null
          discount_amount: number | null
          id: string
          invoice_date: string
          invoice_number: string
          notes: string | null
          paid_amount: number | null
          status: Database["public"]["Enums"]["invoice_status"] | null
          subtotal: number | null
          supplier_id: string
          tax_amount: number | null
          total_amount: number | null
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          approved_by?: string | null
          branch_id?: string | null
          created_at?: string
          created_by: string
          currency_id?: string | null
          discount_amount?: number | null
          id?: string
          invoice_date: string
          invoice_number: string
          notes?: string | null
          paid_amount?: number | null
          status?: Database["public"]["Enums"]["invoice_status"] | null
          subtotal?: number | null
          supplier_id: string
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          approved_by?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string
          currency_id?: string | null
          discount_amount?: number | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          notes?: string | null
          paid_amount?: number | null
          status?: Database["public"]["Enums"]["invoice_status"] | null
          subtotal?: number | null
          supplier_id?: string
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_invoices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoices_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoices_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          id?: string
          permission_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          id?: string
          permission_id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_invoice_lines: {
        Row: {
          created_at: string
          description: string | null
          discount_percent: number | null
          id: string
          invoice_id: string
          line_total: number
          product_id: string
          quantity: number
          tax_percent: number | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount_percent?: number | null
          id?: string
          invoice_id: string
          line_total: number
          product_id: string
          quantity: number
          tax_percent?: number | null
          unit_price: number
        }
        Update: {
          created_at?: string
          description?: string | null
          discount_percent?: number | null
          id?: string
          invoice_id?: string
          line_total?: number
          product_id?: string
          quantity?: number
          tax_percent?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoice_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_invoices: {
        Row: {
          approved_by: string | null
          branch_id: string | null
          created_at: string
          created_by: string
          currency_id: string | null
          customer_id: string
          discount_amount: number | null
          id: string
          invoice_date: string
          invoice_number: string
          notes: string | null
          paid_amount: number | null
          status: Database["public"]["Enums"]["invoice_status"] | null
          subtotal: number | null
          tax_amount: number | null
          total_amount: number | null
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          approved_by?: string | null
          branch_id?: string | null
          created_at?: string
          created_by: string
          currency_id?: string | null
          customer_id: string
          discount_amount?: number | null
          id?: string
          invoice_date: string
          invoice_number: string
          notes?: string | null
          paid_amount?: number | null
          status?: Database["public"]["Enums"]["invoice_status"] | null
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          approved_by?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string
          currency_id?: string | null
          customer_id?: string
          discount_amount?: number | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          notes?: string | null
          paid_amount?: number | null
          status?: Database["public"]["Enums"]["invoice_status"] | null
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_invoices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          account_id: string | null
          address: string | null
          code: string
          created_at: string
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          payment_terms: number | null
          phone: string | null
          tax_number: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          address?: string | null
          code: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          payment_terms?: number | null
          phone?: string | null
          tax_number?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          address?: string | null
          code?: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          payment_terms?: number | null
          phone?: string | null
          tax_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          setting_key: string
          setting_type: string
          setting_value: string | null
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          setting_key: string
          setting_type?: string
          setting_value?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          setting_key?: string
          setting_type?: string
          setting_value?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      units_of_measure: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      user_branch_assignments: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          is_primary: boolean | null
          user_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          is_primary?: boolean | null
          user_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_branch_assignments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_branch_assignments_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          is_granted: boolean | null
          permission_id: string
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          is_granted?: boolean | null
          permission_id: string
          user_id: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          is_granted?: boolean | null
          permission_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          is_global: boolean | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          is_global?: boolean | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          is_global?: boolean | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          address: string | null
          branch_id: string | null
          code: string
          created_at: string
          id: string
          is_active: boolean | null
          manager_id: string | null
          name: string
          updated_at: string
          valuation_method:
            | Database["public"]["Enums"]["inventory_valuation"]
            | null
        }
        Insert: {
          address?: string | null
          branch_id?: string | null
          code: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          manager_id?: string | null
          name: string
          updated_at?: string
          valuation_method?:
            | Database["public"]["Enums"]["inventory_valuation"]
            | null
        }
        Update: {
          address?: string | null
          branch_id?: string | null
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          manager_id?: string | null
          name?: string
          updated_at?: string
          valuation_method?:
            | Database["public"]["Enums"]["inventory_valuation"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouses_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      year_end_closings: {
        Row: {
          closed_by: string | null
          closing_date: string
          closing_journal_id: string | null
          created_at: string
          fiscal_period_id: string
          id: string
          net_income: number | null
          next_period_id: string | null
          opening_journal_id: string | null
          retained_earnings_account_id: string | null
          status: string | null
          total_expenses: number | null
          total_revenue: number | null
        }
        Insert: {
          closed_by?: string | null
          closing_date: string
          closing_journal_id?: string | null
          created_at?: string
          fiscal_period_id: string
          id?: string
          net_income?: number | null
          next_period_id?: string | null
          opening_journal_id?: string | null
          retained_earnings_account_id?: string | null
          status?: string | null
          total_expenses?: number | null
          total_revenue?: number | null
        }
        Update: {
          closed_by?: string | null
          closing_date?: string
          closing_journal_id?: string | null
          created_at?: string
          fiscal_period_id?: string
          id?: string
          net_income?: number | null
          next_period_id?: string | null
          opening_journal_id?: string | null
          retained_earnings_account_id?: string | null
          status?: string | null
          total_expenses?: number | null
          total_revenue?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "year_end_closings_closing_journal_id_fkey"
            columns: ["closing_journal_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "year_end_closings_fiscal_period_id_fkey"
            columns: ["fiscal_period_id"]
            isOneToOne: false
            referencedRelation: "fiscal_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "year_end_closings_next_period_id_fkey"
            columns: ["next_period_id"]
            isOneToOne: false
            referencedRelation: "fiscal_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "year_end_closings_opening_journal_id_fkey"
            columns: ["opening_journal_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "year_end_closings_retained_earnings_account_id_fkey"
            columns: ["retained_earnings_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_next_document_number: {
        Args: { _branch_id: string; _document_type: string }
        Returns: string
      }
      get_user_branches: {
        Args: { _user_id: string }
        Returns: {
          branch_code: string
          branch_id: string
          branch_name: string
          is_primary: boolean
        }[]
      }
      has_branch_access: {
        Args: { _branch_id: string; _user_id: string }
        Returns: boolean
      }
      has_permission: {
        Args: {
          _branch_id?: string
          _permission_code: string
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_date_in_open_period: { Args: { check_date: string }; Returns: boolean }
      is_postable_account: { Args: { account_id: string }; Returns: boolean }
    }
    Enums: {
      account_type: "asset" | "liability" | "equity" | "revenue" | "expense"
      app_role:
        | "admin"
        | "accountant"
        | "sales_manager"
        | "inventory_manager"
        | "user"
      inventory_valuation: "fifo" | "lifo" | "average"
      invoice_status:
        | "draft"
        | "confirmed"
        | "paid"
        | "partially_paid"
        | "cancelled"
      payment_method: "cash" | "bank_transfer" | "check" | "credit_card"
      transaction_type: "debit" | "credit"
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
      account_type: ["asset", "liability", "equity", "revenue", "expense"],
      app_role: [
        "admin",
        "accountant",
        "sales_manager",
        "inventory_manager",
        "user",
      ],
      inventory_valuation: ["fifo", "lifo", "average"],
      invoice_status: [
        "draft",
        "confirmed",
        "paid",
        "partially_paid",
        "cancelled",
      ],
      payment_method: ["cash", "bank_transfer", "check", "credit_card"],
      transaction_type: ["debit", "credit"],
    },
  },
} as const
