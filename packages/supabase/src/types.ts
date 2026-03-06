// Supabase Database Types
// These will be auto-generated later via: npx supabase gen types typescript
// For now, define the core tables manually to unblock development.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          auth_user_id: string | null
          username: string
          email: string
          first_name: string
          last_name: string
          role: 'admin' | 'manager' | 'server' | 'counter' | 'kitchen'
          is_active: boolean
          org_id: string
          location_id: string | null
          pin_hash: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          auth_user_id?: string | null
          username: string
          email: string
          first_name: string
          last_name: string
          role: 'admin' | 'manager' | 'server' | 'counter' | 'kitchen'
          is_active?: boolean
          org_id: string
          location_id?: string | null
          pin_hash?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          auth_user_id?: string | null
          username?: string
          email?: string
          first_name?: string
          last_name?: string
          role?: 'admin' | 'manager' | 'server' | 'counter' | 'kitchen'
          is_active?: boolean
          org_id?: string
          location_id?: string | null
          pin_hash?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          logo_url: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          logo_url?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          slug?: string
          logo_url?: string | null
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      locations: {
        Row: {
          id: string
          org_id: string
          name: string
          code: string
          address: string | null
          phone: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          code: string
          address?: string | null
          phone?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          org_id?: string
          name?: string
          code?: string
          address?: string | null
          phone?: string | null
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          id: string
          org_id: string
          name: string
          description: string | null
          color: string | null
          sort_order: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          description?: string | null
          color?: string | null
          sort_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          description?: string | null
          color?: string | null
          sort_order?: number
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          id: string
          org_id: string
          category_id: string | null
          name: string
          description: string | null
          price: number
          image_url: string | null
          barcode: string | null
          sku: string | null
          is_available: boolean
          preparation_time: number
          sort_order: number
          dietary_type: string | null
          calorie_count: number | null
          food_allergens: string | null
          product_type: 'simple' | 'configurable' | 'combo'
          has_option_groups: boolean
          min_variation_price: number | null
          max_variation_price: number | null
          location_ids: string[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          category_id?: string | null
          name: string
          description?: string | null
          price: number
          image_url?: string | null
          barcode?: string | null
          sku?: string | null
          is_available?: boolean
          preparation_time?: number
          sort_order?: number
          dietary_type?: string | null
          calorie_count?: number | null
          food_allergens?: string | null
          product_type?: 'simple' | 'configurable' | 'combo'
          has_option_groups?: boolean
          min_variation_price?: number | null
          max_variation_price?: number | null
          location_ids?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          name?: string
          description?: string | null
          price?: number
          image_url?: string | null
          barcode?: string | null
          sku?: string | null
          is_available?: boolean
          preparation_time?: number
          sort_order?: number
          dietary_type?: string | null
          calorie_count?: number | null
          food_allergens?: string | null
          product_type?: 'simple' | 'configurable' | 'combo'
          has_option_groups?: boolean
          min_variation_price?: number | null
          max_variation_price?: number | null
          location_ids?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          id: string
          org_id: string
          location_id: string | null
          order_number: string
          table_id: string | null
          user_id: string | null
          customer_id: string | null
          customer_name: string | null
          order_type: 'dine_in' | 'takeout' | 'delivery'
          status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'paid' | 'completed' | 'cancelled'
          subtotal: number
          tax_amount: number
          discount_amount: number
          total_amount: number
          notes: string | null
          parent_order_id: string | null
          is_kot: boolean
          kot_number: string | null
          token_number: number | null
          order_source: 'pos' | 'swiggy' | 'zomato' | 'kiosk' | 'customer_app'
          external_order_id: string | null
          external_data: Json | null
          delivery_partner_name: string | null
          delivery_partner_phone: string | null
          aggregator_confirmed_at: string | null
          accept_deadline: string | null
          created_at: string
          updated_at: string
          served_at: string | null
          completed_at: string | null
          confirmed_at: string | null
          preparing_at: string | null
          ready_at: string | null
          paid_at: string | null
          cleared_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          location_id?: string | null
          order_number: string
          table_id?: string | null
          user_id?: string | null
          customer_id?: string | null
          customer_name?: string | null
          order_type: 'dine_in' | 'takeout' | 'delivery'
          status?: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'paid' | 'completed' | 'cancelled'
          subtotal?: number
          tax_amount?: number
          discount_amount?: number
          total_amount?: number
          notes?: string | null
          parent_order_id?: string | null
          is_kot?: boolean
          kot_number?: string | null
          token_number?: number | null
          order_source?: 'pos' | 'swiggy' | 'zomato' | 'kiosk' | 'customer_app'
          external_order_id?: string | null
          external_data?: Json | null
          delivery_partner_name?: string | null
          delivery_partner_phone?: string | null
          aggregator_confirmed_at?: string | null
          accept_deadline?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          status?: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'paid' | 'completed' | 'cancelled'
          subtotal?: number
          tax_amount?: number
          discount_amount?: number
          total_amount?: number
          notes?: string | null
          served_at?: string | null
          completed_at?: string | null
          confirmed_at?: string | null
          preparing_at?: string | null
          ready_at?: string | null
          paid_at?: string | null
          cleared_at?: string | null
          aggregator_confirmed_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string
          quantity: number
          unit_price: number
          total_price: number
          special_instructions: string | null
          status: 'pending' | 'preparing' | 'ready' | 'served'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          order_id: string
          product_id: string
          quantity: number
          unit_price: number
          total_price: number
          special_instructions?: string | null
          status?: 'pending' | 'preparing' | 'ready' | 'served'
          created_at?: string
          updated_at?: string
        }
        Update: {
          quantity?: number
          unit_price?: number
          total_price?: number
          special_instructions?: string | null
          status?: 'pending' | 'preparing' | 'ready' | 'served'
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          id: string
          org_id: string
          order_id: string
          payment_method: 'cash' | 'credit_card' | 'debit_card' | 'digital_wallet'
          amount: number
          cash_received: number | null
          change_amount: number | null
          reference_number: string | null
          status: 'pending' | 'completed' | 'failed' | 'refunded'
          processed_by: string | null
          processed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          order_id: string
          payment_method: 'cash' | 'credit_card' | 'debit_card' | 'digital_wallet'
          amount: number
          cash_received?: number | null
          change_amount?: number | null
          reference_number?: string | null
          status?: 'pending' | 'completed' | 'failed' | 'refunded'
          processed_by?: string | null
          processed_at?: string | null
          created_at?: string
        }
        Update: {
          status?: 'pending' | 'completed' | 'failed' | 'refunded'
          processed_at?: string | null
        }
        Relationships: []
      }
      dining_tables: {
        Row: {
          id: string
          org_id: string
          table_number: string
          seating_capacity: number
          location: string | null
          floor: string | null
          status: 'available' | 'occupied' | 'reserved'
          is_occupied: boolean
          location_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          table_number: string
          seating_capacity?: number
          location?: string | null
          floor?: string | null
          status?: 'available' | 'occupied' | 'reserved'
          is_occupied?: boolean
          location_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          table_number?: string
          seating_capacity?: number
          location?: string | null
          floor?: string | null
          status?: 'available' | 'occupied' | 'reserved'
          is_occupied?: boolean
          location_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          id: string
          org_id: string
          phone: string
          name: string | null
          email: string | null
          address: string | null
          notes: string | null
          total_orders: number
          total_spent: number
          last_order_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          phone: string
          name?: string | null
          email?: string | null
          address?: string | null
          notes?: string | null
          total_orders?: number
          total_spent?: number
          last_order_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          phone?: string
          name?: string | null
          email?: string | null
          address?: string | null
          notes?: string | null
          total_orders?: number
          total_spent?: number
          last_order_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          id: string
          org_id: string
          location_id: string | null
          key: string
          value: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          location_id?: string | null
          key: string
          value: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          value?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_configs: {
        Row: {
          id: string
          org_id: string
          location_id: string | null
          platform: 'swiggy' | 'zomato'
          is_enabled: boolean
          api_key: string | null
          api_secret: string | null
          webhook_secret: string | null
          restaurant_id: string | null
          config_data: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          location_id?: string | null
          platform: 'swiggy' | 'zomato'
          is_enabled?: boolean
          api_key?: string | null
          api_secret?: string | null
          webhook_secret?: string | null
          restaurant_id?: string | null
          config_data?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          is_enabled?: boolean
          api_key?: string | null
          api_secret?: string | null
          webhook_secret?: string | null
          restaurant_id?: string | null
          config_data?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      product_option_groups: {
        Row: {
          id: string
          product_id: string
          name: string
          selection_type: 'single' | 'multiple'
          is_required: boolean
          min_selections: number
          max_selections: number
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          product_id: string
          name: string
          selection_type?: 'single' | 'multiple'
          is_required?: boolean
          min_selections?: number
          max_selections?: number
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          selection_type?: 'single' | 'multiple'
          is_required?: boolean
          min_selections?: number
          max_selections?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      product_option_items: {
        Row: {
          id: string
          option_group_id: string
          name: string
          price_adjustment: number
          is_default: boolean
          is_available: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          option_group_id: string
          name: string
          price_adjustment?: number
          is_default?: boolean
          is_available?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          price_adjustment?: number
          is_default?: boolean
          is_available?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      variation_groups: {
        Row: {
          id: string
          org_id: string
          name: string
          description: string | null
          sort_order: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          description?: string | null
          sort_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          description?: string | null
          sort_order?: number
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      variation_items: {
        Row: {
          id: string
          variation_group_id: string
          name: string
          description: string | null
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          variation_group_id: string
          name: string
          description?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          description?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      combo_slots: {
        Row: {
          id: string
          product_id: string
          name: string
          is_required: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          product_id: string
          name: string
          is_required?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          is_required?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      combo_slot_choices: {
        Row: {
          id: string
          combo_slot_id: string
          product_id: string
          variation_item_id: string | null
          price_override: number | null
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          combo_slot_id: string
          product_id: string
          variation_item_id?: string | null
          price_override?: number | null
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          product_id?: string
          variation_item_id?: string | null
          price_override?: number | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      promos: {
        Row: {
          id: string
          org_id: string
          image_url: string
          title: string | null
          description: string | null
          start_date: string | null
          end_date: string | null
          is_active: boolean
          sort_order: number
          duration: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          image_url: string
          title?: string | null
          description?: string | null
          start_date?: string | null
          end_date?: string | null
          is_active?: boolean
          sort_order?: number
          duration?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          image_url?: string
          title?: string | null
          description?: string | null
          start_date?: string | null
          end_date?: string | null
          is_active?: boolean
          sort_order?: number
          duration?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      media: {
        Row: {
          id: string
          org_id: string
          filename: string
          original_name: string | null
          file_url: string
          file_size: number | null
          mime_type: string | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          filename: string
          original_name?: string | null
          file_url: string
          file_size?: number | null
          mime_type?: string | null
          created_at?: string
        }
        Update: {
          filename?: string
          original_name?: string | null
          file_url?: string
          file_size?: number | null
          mime_type?: string | null
        }
        Relationships: []
      }
      customer_sessions: {
        Row: {
          id: string
          org_id: string
          table_id: string
          session_token: string
          started_at: string
          expires_at: string
          last_activity_at: string
          is_active: boolean
          customer_name: string | null
          customer_phone: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          table_id: string
          session_token: string
          started_at?: string
          expires_at: string
          last_activity_at?: string
          is_active?: boolean
          customer_name?: string | null
          customer_phone?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          last_activity_at?: string
          is_active?: boolean
          customer_name?: string | null
          customer_phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      table_qr_codes: {
        Row: {
          id: string
          org_id: string
          table_id: string
          qr_token: string
          qr_data: string
          is_active: boolean
          scan_count: number
          last_scanned_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          table_id: string
          qr_token: string
          qr_data: string
          is_active?: boolean
          scan_count?: number
          last_scanned_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          is_active?: boolean
          scan_count?: number
          last_scanned_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tenants: {
        Row: {
          id: string
          business_name: string
          subdomain: string
          domain: string | null
          plan: 'free' | 'starter' | 'professional' | 'enterprise'
          subscription_status: 'trialing' | 'active' | 'past_due' | 'cancelled' | 'paused'
          trial_ends_at: string | null
          max_locations: number
          max_users: number
          max_products: number
          is_active: boolean
          onboarding_completed: boolean
          settings: Json | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          business_name: string
          subdomain: string
          domain?: string | null
          plan?: 'free' | 'starter' | 'professional' | 'enterprise'
          subscription_status?: 'trialing' | 'active' | 'past_due' | 'cancelled' | 'paused'
          trial_ends_at?: string | null
          max_locations?: number
          max_users?: number
          max_products?: number
          is_active?: boolean
          onboarding_completed?: boolean
          settings?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          business_name?: string
          subdomain?: string
          domain?: string | null
          plan?: 'free' | 'starter' | 'professional' | 'enterprise'
          subscription_status?: 'trialing' | 'active' | 'past_due' | 'cancelled' | 'paused'
          trial_ends_at?: string | null
          max_locations?: number
          max_users?: number
          max_products?: number
          is_active?: boolean
          onboarding_completed?: boolean
          settings?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_my_org_id: {
        Args: Record<string, never>
        Returns: string
      }
      get_my_role: {
        Args: Record<string, never>
        Returns: string
      }
      get_my_location_id: {
        Args: Record<string, never>
        Returns: string
      }
      create_order: {
        Args: {
          p_table_id?: string | null
          p_customer_id?: string | null
          p_customer_name?: string | null
          p_order_type: string
          p_items: Json
          p_notes?: string | null
          p_parent_order_id?: string | null
          p_create_as_kot?: boolean
          p_order_source?: string
          p_initial_status?: string | null
        }
        Returns: Json
      }
      process_payment: {
        Args: {
          p_order_id: string
          p_payment_method: string
          p_amount: number
          p_reference_number?: string | null
          p_cash_received?: number | null
        }
        Returns: Json
      }
      update_order_status: {
        Args: {
          p_order_id: string
          p_new_status: string
          p_notes?: string | null
        }
        Returns: Json
      }
      get_bill_summary: {
        Args: {
          p_order_id: string
        }
        Returns: Json
      }
      get_dashboard_stats: {
        Args: Record<string, never>
        Returns: Json
      }
      get_sales_report: {
        Args: {
          p_period: string
        }
        Returns: Json
      }
      get_orders_report: {
        Args: Record<string, never>
        Returns: Json
      }
      get_income_report: {
        Args: {
          p_period: string
        }
        Returns: Json
      }
      clear_table: {
        Args: {
          p_table_id: string
        }
        Returns: Json
      }
      transfer_table: {
        Args: {
          p_from_table_id: string
          p_to_table_id: string
        }
        Returns: Json
      }
      register_tenant: {
        Args: {
          p_business_name: string
          p_subdomain: string
          p_admin_email: string
          p_admin_password: string
          p_admin_first_name: string
          p_admin_last_name: string
        }
        Returns: Json
      }
      check_setup_status: {
        Args: Record<string, never>
        Returns: Json
      }
      initial_setup: {
        Args: {
          p_auth_user_id: string
          p_username: string
          p_email: string
          p_first_name: string
          p_last_name: string
          p_pin?: string | null
          p_store_name?: string
          p_location_name?: string
          p_location_code?: string
          p_currency?: string
          p_currency_symbol?: string
          p_tax_rate?: string
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
}
