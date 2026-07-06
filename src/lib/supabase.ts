import { createBrowserClient } from "@supabase/ssr";

// ── Browser client (safe to import in Client Components) ─────────────────────
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Server client and service client live in lib/supabase-server.ts
// (they import next/headers which is server-only)

// ============================================================
// TypeScript interfaces
// ============================================================

export interface Lead {
  id: string;
  company: string;
  contact_name: string;
  email: string | null;
  phone: string | null;
  country: string;
  product_interest: string | null;
  status: "new" | "contacted" | "qualified" | "negotiating" | "closed" | "lost";
  deal_value_usd: number | null;
  lead_score: number | null;
  source: string | null;
  notes: string | null;
  last_contacted_at: string | null;
  created_at: string;
  updated_at: string;
  user_id: string | null;
}

export interface Buyer {
  id: string;
  lead_id: string | null;
  company: string;
  contact_name: string;
  email: string;
  phone: string | null;
  country: string;
  address: string | null;
  preferred_product: string | null;
  preferred_incoterm: string | null;
  payment_terms: string | null;
  total_orders: number;
  total_value_usd: number;
  last_order_date: string | null;
  portal_access: boolean;
  auth_user_id: string | null;
  owner_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  company: string;
  contact_name: string;
  email: string | null;
  location: string | null;
  product: string;
  price_per_kg_inr: number | null;
  moq_kg: number | null;
  lead_time_days: number | null;
  certifications: string[] | null;
  payment_terms: string | null;
  rating: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  user_id: string | null;
}

export interface SupplierQuote {
  id: string;
  supplier_id: string;
  product: string;
  quantity_kg: number;
  price_per_kg_inr: number;
  valid_until: string | null;
  quote_date: string;
  created_at: string;
  user_id: string | null;
}

export interface Order {
  id: string;
  order_number: string;
  buyer_id: string;
  product: string;
  quantity_kg: number;
  fob_price_usd: number;
  total_value_usd: number;
  incoterm: "FOB" | "CIF" | "EXW" | "CFR" | "DAP" | null;
  hs_code: string | null;
  payment_terms: string | null;
  payment_status: "pending" | "partial" | "paid" | "overdue";
  status:
    | "confirmed"
    | "in-production"
    | "quality-check"
    | "ready-to-ship"
    | "shipped"
    | "in-transit"
    | "delivered"
    | "cancelled";
  supplier_id: string | null;
  shipment_date: string | null;
  estimated_arrival: string | null;
  destination_port: string | null;
  tracking_number: string | null;
  aftership_slug: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  user_id: string | null;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  order_id: string;
  buyer_id: string;
  issued_date: string;
  due_date: string | null;
  subtotal_usd: number;
  tax_amount: number;
  total_usd: number;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  pdf_url: string | null;
  sent_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  user_id: string | null;
}

export interface Document {
  id: string;
  order_id: string;
  doc_type:
    | "bill_of_lading"
    | "packing_list"
    | "certificate_of_origin"
    | "phytosanitary"
    | "fssai"
    | "commercial_invoice"
    | "insurance"
    | "other";
  file_name: string;
  file_url: string | null;
  status: "pending" | "uploaded" | "verified" | "shared";
  shared_with_buyer: boolean;
  created_at: string;
  user_id: string | null;
}

export interface Shipment {
  id: string;
  order_id: string;
  tracking_number: string | null;
  carrier: string | null;
  aftership_slug: string | null;
  status: string | null;
  tag: string | null;
  last_update: string | null;
  estimated_delivery: string | null;
  actual_delivery: string | null;
  raw_tracking: Record<string, unknown> | null;
  updated_at: string;
  user_id: string | null;
}

export interface EmailCampaign {
  id: string;
  name: string;
  product: string | null;
  target_country: string | null;
  status: "draft" | "active" | "paused" | "completed";
  total_leads: number;
  emails_sent: number;
  replies_received: number;
  interested_count: number;
  created_at: string;
  user_id: string | null;
}

export interface EmailLog {
  id: string;
  campaign_id: string | null;
  lead_id: string | null;
  email_to: string;
  subject: string | null;
  body: string | null;
  sequence_step: number;
  status: "queued" | "sent" | "opened" | "replied" | "bounced" | "unsubscribed";
  classification: "interested" | "not_interested" | "needs_info" | "no_response" | null;
  sent_at: string | null;
  replied_at: string | null;
  created_at: string;
  user_id: string | null;
}

export interface DiscoveredSupplier {
  id: string;
  company_name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  state: string | null;
  location: string | null;
  gst_number: string | null;
  iec_code: string | null;
  fssai_license: string | null;
  certifications: string[] | null;
  organic_certified: boolean;
  rating: number | null;
  verified: boolean;
  iec_verified: boolean;
  source: string | null;
  source_url: string | null;
  total_score: number;
  status: "new" | "approved" | "rejected";
  rejection_reason: string | null;
  is_test: boolean;
  created_at: string;
  updated_at: string;
}

export interface SupplierDiscoveryJob {
  id: string;
  job_id: string;
  status: "running" | "completed" | "failed";
  suppliers_found: number;
  error_message: string | null;
  is_test: boolean;
  started_at: string;
  completed_at: string | null;
}

export interface FobCalculation {
  id: string;
  product: string;
  quantity_kg: number;
  ex_works_inr: number;
  inland_freight_inr: number;
  export_charges_inr: number;
  fob_inr: number;
  fob_usd: number | null;
  margin_percent: number | null;
  destination_country: string | null;
  notes: string | null;
  created_at: string;
  user_id: string | null;
}
