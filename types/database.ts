/**
 * Hand-maintained types aligned with supabase/schema-v1.2.sql.
 * Regenerate with: npx supabase gen types typescript --project-id <id> > types/database.generated.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "organizer" | "admin" | "staff";
export type OrganizerStatus = "pending" | "approved" | "suspended";
export type EventStatus =
  | "draft"
  | "pending_approval"
  | "active"
  | "sold_out"
  | "completed"
  | "cancelled";
export type ReservationStatus = "pending" | "expired" | "converted";
export type OrderStatus = "pending" | "confirmed" | "cancelled";
export type TicketStatus = "confirmed" | "used" | "voided";
export type PaymentStatus = "pending" | "completed" | "failed";
export type PayoutStatus =
  | "held"
  | "eligible"
  | "scheduled"
  | "processing"
  | "completed"
  | "failed";
export type LedgerEventType =
  | "payment_received"
  | "commission_deducted"
  | "payout_scheduled"
  | "payout_completed"
  | "ticket_voided"
  | "event_cancelled";
export type PayoutTriggerReason = "sold_out" | "sale_ended";

export interface Database {
  public: {
    Tables: {
      platform_config: {
        Row: {
          key: string;
          value_text: string | null;
          value_num: number | null;
          updated_at: string;
        };
        Insert: {
          key: string;
          value_text?: string | null;
          value_num?: number | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["platform_config"]["Insert"]>;
        Relationships: [];
      };
      users: {
        Row: {
          id: string;
          supabase_auth_id: string;
          email: string;
          full_name: string;
          phone: string | null;
          role: UserRole;
          organizer_status: OrganizerStatus | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          supabase_auth_id: string;
          email: string;
          full_name: string;
          phone?: string | null;
          role: UserRole;
          organizer_status?: OrganizerStatus | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
        Relationships: [];
      };
      guest_customers: {
        Row: {
          id: string;
          full_name: string;
          phone: string;
          email: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          full_name: string;
          phone: string;
          email?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["guest_customers"]["Insert"]>;
        Relationships: [];
      };
      events: {
        Row: {
          id: string;
          organizer_id: string;
          title: string;
          description: string | null;
          venue: string;
          event_date: string;
          sale_ends_at: string;
          status: EventStatus;
          max_tickets_per_order: number;
          refund_policy_note: string | null;
          approved_by: string | null;
          approved_at: string | null;
          sold_out_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organizer_id: string;
          title: string;
          description?: string | null;
          venue: string;
          event_date: string;
          sale_ends_at: string;
          status?: EventStatus;
          max_tickets_per_order?: number;
          refund_policy_note?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
          sold_out_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["events"]["Insert"]>;
        Relationships: [];
      };
      ticket_types: {
        Row: {
          id: string;
          event_id: string;
          name: string;
          description: string | null;
          price: number;
          total_capacity: number;
          available: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          name: string;
          description?: string | null;
          price: number;
          total_capacity: number;
          available: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ticket_types"]["Insert"]>;
        Relationships: [];
      };
      reservation_items: {
        Row: {
          id: string;
          reservation_id: string;
          ticket_type_id: string;
          quantity: number;
        };
        Insert: {
          id?: string;
          reservation_id: string;
          ticket_type_id: string;
          quantity: number;
        };
        Update: Partial<Database["public"]["Tables"]["reservation_items"]["Insert"]>;
        Relationships: [];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          ticket_type_id: string;
          quantity: number;
          unit_price: number;
          line_total: number;
        };
        Insert: {
          id?: string;
          order_id: string;
          ticket_type_id: string;
          quantity: number;
          unit_price: number;
          line_total: number;
        };
        Update: Partial<Database["public"]["Tables"]["order_items"]["Insert"]>;
        Relationships: [];
      };
      payment_webhook_events: {
        Row: {
          id: string;
          provider: string;
          provider_event_id: string;
          provider_payment_id: string | null;
          order_id: string | null;
          payload_hash: string;
          processed_at: string;
        };
        Insert: {
          id?: string;
          provider?: string;
          provider_event_id: string;
          provider_payment_id?: string | null;
          order_id?: string | null;
          payload_hash: string;
          processed_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["payment_webhook_events"]["Insert"]>;
        Relationships: [];
      };
      ledger: {
        Row: {
          id: number;
          event_type: LedgerEventType;
          amount: number;
          reference_id: string;
          reference_table: string;
          organizer_id: string | null;
          customer_id: string | null;
          event_id: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          event_type: LedgerEventType;
          amount: number;
          reference_id: string;
          reference_table: string;
          organizer_id?: string | null;
          customer_id?: string | null;
          event_id?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ledger"]["Insert"]>;
        Relationships: [];
      };
      reservations: {
        Row: {
          id: string;
          customer_id: string;
          event_id: string;
          status: ReservationStatus;
          expires_at: string;
          inventory_held: boolean;
          inventory_held_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          event_id: string;
          status?: ReservationStatus;
          expires_at: string;
          inventory_held?: boolean;
          inventory_held_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reservations"]["Insert"]>;
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          customer_id: string;
          reservation_id: string;
          event_id: string;
          total_amount: number;
          status: OrderStatus;
          tickets_issued: boolean;
          idempotency_key: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          reservation_id: string;
          event_id: string;
          total_amount: number;
          status?: OrderStatus;
          tickets_issued?: boolean;
          idempotency_key: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["orders"]["Insert"]>;
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          order_id: string;
          provider: string;
          provider_payment_id: string;
          amount: number;
          currency: string;
          status: PaymentStatus;
          webhook_verified: boolean;
          webhook_received_at: string | null;
          raw_webhook_payload: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          provider?: string;
          provider_payment_id: string;
          amount: number;
          currency?: string;
          status?: PaymentStatus;
          webhook_verified?: boolean;
          webhook_received_at?: string | null;
          raw_webhook_payload?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["payments"]["Insert"]>;
        Relationships: [];
      };
      tickets: {
        Row: {
          id: string;
          order_id: string;
          order_item_id: string;
          ticket_type_id: string;
          event_id: string;
          customer_id: string;
          holder_name: string;
          holder_phone: string;
          token: string;
          hmac_signature: string;
          hmac_key_version: number;
          qr_image_url: string | null;
          status: TicketStatus;
          scanned_at: string | null;
          scanned_by: string | null;
          voided_at: string | null;
          voided_by: string | null;
          void_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          order_item_id: string;
          ticket_type_id: string;
          event_id: string;
          customer_id: string;
          holder_name: string;
          holder_phone: string;
          token: string;
          hmac_signature: string;
          hmac_key_version: number;
          qr_image_url?: string | null;
          status?: TicketStatus;
          scanned_at?: string | null;
          scanned_by?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
          void_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tickets"]["Insert"]>;
        Relationships: [];
      };
      hmac_key_versions: {
        Row: {
          version: number;
          is_current: boolean;
          created_at: string;
          retired_at: string | null;
        };
        Insert: {
          version: number;
          is_current?: boolean;
          created_at?: string;
          retired_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["hmac_key_versions"]["Insert"]>;
        Relationships: [];
      };
      payouts: {
        Row: {
          id: string;
          organizer_id: string;
          event_id: string;
          trigger_reason: PayoutTriggerReason;
          gross_amount: number;
          commission_rate: number;
          commission_amount: number;
          net_amount: number;
          status: PayoutStatus;
          eligible_at: string | null;
          initiated_by: string | null;
          provider_tx_id: string | null;
          scheduled_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organizer_id: string;
          event_id: string;
          trigger_reason: PayoutTriggerReason;
          gross_amount: number;
          commission_rate?: number;
          commission_amount: number;
          net_amount: number;
          status?: PayoutStatus;
          eligible_at?: string | null;
          initiated_by?: string | null;
          provider_tx_id?: string | null;
          scheduled_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["payouts"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      atomic_decrement_inventory: {
        Args: { p_reservation_id: string };
        Returns: boolean;
      };
      validate_qr_scan: {
        Args: { p_token: string; p_event_id: string };
        Returns: string;
      };
      upsert_guest_customer: {
        Args: { p_phone: string; p_full_name: string; p_email?: string | null };
        Returns: string;
      };
      expire_stale_reservations: {
        Args: Record<string, never>;
        Returns: number;
      };
      fulfill_payment_webhook: {
        Args: {
          p_provider_payment_id: string;
          p_provider_event_id: string;
          p_payload_hash: string;
          p_raw_payload: Json;
          p_tickets: Json;
          p_amount?: number | null;
        };
        Returns: Json;
      };
    };
    Enums: {
      user_role: UserRole;
      event_status: EventStatus;
      order_status: OrderStatus;
      ticket_status: TicketStatus;
      payment_status: PaymentStatus;
      payout_status: PayoutStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
