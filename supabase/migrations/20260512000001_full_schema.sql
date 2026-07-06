-- Drop all existing tables cleanly (children first)
drop table if exists email_logs        cascade;
drop table if exists email_campaigns   cascade;
drop table if exists fob_calculations  cascade;
drop table if exists shipments         cascade;
drop table if exists documents         cascade;
drop table if exists invoices          cascade;
drop table if exists orders            cascade;
drop table if exists supplier_quotes   cascade;
drop table if exists suppliers         cascade;
drop table if exists buyers            cascade;
drop table if exists leads             cascade;
-- ============================================================
-- Brindari CEO Dashboard — Complete Schema
-- Moringa export business: leads → buyers → orders → invoices
-- ============================================================

-- Extensions

-- ============================================================
-- TRIGGER: auto-update updated_at
-- ============================================================

create or replace function handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- LEADS
-- ============================================================

create table leads (
  id                uuid        primary key default gen_random_uuid(),
  company           text        not null,
  contact_name      text        not null,
  email             text,
  phone             text,
  country           text        not null,
  product_interest  text,
  status            text        not null default 'new'
                      check (status in ('new','contacted','qualified','negotiating','closed','lost')),
  deal_value_usd    numeric(14,2),
  lead_score        integer     check (lead_score between 0 and 100),
  source            text,
  notes             text,
  last_contacted_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  user_id           uuid        references auth.users (id) on delete set null
);

create trigger trg_leads_updated_at
  before update on leads
  for each row execute function handle_updated_at();

alter table leads enable row level security;

-- Admin: full access to own rows
create policy "leads: admin all"
  on leads for all to authenticated
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

create index idx_leads_status  on leads (status);
create index idx_leads_country on leads (country);
create index idx_leads_user_id on leads (user_id);

-- ============================================================
-- BUYERS
-- ============================================================

create table buyers (
  id                 uuid        primary key default gen_random_uuid(),
  lead_id            uuid        references leads (id) on delete set null,
  company            text        not null,
  contact_name       text        not null,
  email              text        not null unique,
  phone              text,
  country            text        not null,
  address            text,
  preferred_product  text,
  preferred_incoterm text,
  payment_terms      text,
  total_orders       integer     not null default 0,
  total_value_usd    numeric(14,2) not null default 0,
  last_order_date    date,
  portal_access      boolean     not null default false,
  auth_user_id       uuid        references auth.users (id) on delete set null,
  owner_user_id      uuid        references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger trg_buyers_updated_at
  before update on buyers
  for each row execute function handle_updated_at();

alter table buyers enable row level security;

-- Admin: owner can manage their buyers
create policy "buyers: admin all"
  on buyers for all to authenticated
  using  (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

-- Buyer portal: buyer sees only their own record
create policy "buyers: portal select"
  on buyers for select to authenticated
  using (auth_user_id = auth.uid());

create index idx_buyers_owner_user_id on buyers (owner_user_id);
create index idx_buyers_auth_user_id  on buyers (auth_user_id);
create index idx_buyers_country       on buyers (country);

-- ============================================================
-- SUPPLIERS
-- ============================================================

create table suppliers (
  id                uuid        primary key default gen_random_uuid(),
  company           text        not null,
  contact_name      text        not null,
  email             text,
  location          text,
  product           text        not null,
  price_per_kg_inr  numeric(10,2),
  moq_kg            numeric(10,2),
  lead_time_days    integer,
  certifications    text[],
  payment_terms     text,
  rating            numeric(2,1) check (rating between 1 and 5),
  is_active         boolean     not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  user_id           uuid        references auth.users (id) on delete set null
);

alter table suppliers enable row level security;

create policy "suppliers: admin all"
  on suppliers for all to authenticated
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

create index idx_suppliers_user_id   on suppliers (user_id);
create index idx_suppliers_is_active on suppliers (is_active);

-- ============================================================
-- SUPPLIER QUOTES
-- ============================================================

create table supplier_quotes (
  id                uuid        primary key default gen_random_uuid(),
  supplier_id       uuid        not null references suppliers (id) on delete cascade,
  product           text        not null,
  quantity_kg       numeric(10,2) not null,
  price_per_kg_inr  numeric(10,2) not null,
  valid_until       date,
  quote_date        date        not null default current_date,
  created_at        timestamptz not null default now(),
  user_id           uuid        references auth.users (id) on delete set null
);

alter table supplier_quotes enable row level security;

create policy "supplier_quotes: admin all"
  on supplier_quotes for all to authenticated
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

create index idx_supplier_quotes_supplier_id on supplier_quotes (supplier_id);
create index idx_supplier_quotes_user_id     on supplier_quotes (user_id);

-- ============================================================
-- ORDERS
-- ============================================================

create table orders (
  id                 uuid          primary key default gen_random_uuid(),
  order_number       text          not null unique,
  buyer_id           uuid          not null references buyers (id) on delete restrict,
  product            text          not null,
  quantity_kg        numeric(10,2) not null check (quantity_kg > 0),
  fob_price_usd      numeric(10,4) not null check (fob_price_usd > 0),
  total_value_usd    numeric(14,2) not null generated always as
                       (quantity_kg * fob_price_usd) stored,
  incoterm           text          check (incoterm in ('FOB','CIF','EXW','CFR','DAP')),
  hs_code            text,
  payment_terms      text,
  payment_status     text          not null default 'pending'
                       check (payment_status in ('pending','partial','paid','overdue')),
  status             text          not null default 'confirmed'
                       check (status in ('confirmed','in-production','quality-check',
                                         'ready-to-ship','shipped','in-transit',
                                         'delivered','cancelled')),
  supplier_id        uuid          references suppliers (id) on delete set null,
  shipment_date      date,
  estimated_arrival  date,
  destination_port   text,
  tracking_number    text,
  aftership_slug     text,
  notes              text,
  created_at         timestamptz   not null default now(),
  updated_at         timestamptz   not null default now(),
  user_id            uuid          references auth.users (id) on delete set null
);

create trigger trg_orders_updated_at
  before update on orders
  for each row execute function handle_updated_at();

alter table orders enable row level security;

-- Admin
create policy "orders: admin all"
  on orders for all to authenticated
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Buyer portal: buyer sees orders linked to their buyer record
create policy "orders: portal select"
  on orders for select to authenticated
  using (
    exists (
      select 1 from buyers
      where buyers.id = orders.buyer_id
        and buyers.auth_user_id = auth.uid()
    )
  );

create index idx_orders_user_id        on orders (user_id);
create index idx_orders_buyer_id       on orders (buyer_id);
create index idx_orders_status         on orders (status);
create index idx_orders_payment_status on orders (payment_status);
create index idx_orders_shipment_date  on orders (shipment_date);

-- ============================================================
-- INVOICES
-- ============================================================

create table invoices (
  id              uuid          primary key default gen_random_uuid(),
  invoice_number  text          not null unique,
  order_id        uuid          not null references orders (id) on delete restrict,
  buyer_id        uuid          not null references buyers (id) on delete restrict,
  issued_date     date          not null default current_date,
  due_date        date,
  subtotal_usd    numeric(14,2) not null default 0,
  tax_amount      numeric(14,2) not null default 0,
  total_usd       numeric(14,2) not null default 0,
  status          text          not null default 'draft'
                    check (status in ('draft','sent','paid','overdue','cancelled')),
  pdf_url         text,
  sent_at         timestamptz,
  paid_at         timestamptz,
  created_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now(),
  user_id         uuid          references auth.users (id) on delete set null
);

create trigger trg_invoices_updated_at
  before update on invoices
  for each row execute function handle_updated_at();

alter table invoices enable row level security;

-- Admin
create policy "invoices: admin all"
  on invoices for all to authenticated
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Buyer portal
create policy "invoices: portal select"
  on invoices for select to authenticated
  using (
    exists (
      select 1 from buyers
      where buyers.id = invoices.buyer_id
        and buyers.auth_user_id = auth.uid()
    )
  );

create index idx_invoices_user_id   on invoices (user_id);
create index idx_invoices_order_id  on invoices (order_id);
create index idx_invoices_buyer_id  on invoices (buyer_id);
create index idx_invoices_status    on invoices (status);
create index idx_invoices_due_date  on invoices (due_date);

-- ============================================================
-- DOCUMENTS
-- ============================================================

create table documents (
  id                 uuid        primary key default gen_random_uuid(),
  order_id           uuid        not null references orders (id) on delete cascade,
  doc_type           text        not null
                       check (doc_type in ('bill_of_lading','packing_list',
                                           'certificate_of_origin','phytosanitary',
                                           'fssai','commercial_invoice','insurance','other')),
  file_name          text        not null,
  file_url           text,
  status             text        not null default 'pending'
                       check (status in ('pending','uploaded','verified','shared')),
  shared_with_buyer  boolean     not null default false,
  created_at         timestamptz not null default now(),
  user_id            uuid        references auth.users (id) on delete set null
);

alter table documents enable row level security;

-- Admin
create policy "documents: admin all"
  on documents for all to authenticated
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Buyer portal: only shared documents
create policy "documents: portal select"
  on documents for select to authenticated
  using (
    shared_with_buyer = true
    and exists (
      select 1 from orders
      join buyers on buyers.id = orders.buyer_id
      where orders.id = documents.order_id
        and buyers.auth_user_id = auth.uid()
    )
  );

create index idx_documents_order_id on documents (order_id);
create index idx_documents_user_id  on documents (user_id);
create index idx_documents_status   on documents (status);

-- ============================================================
-- SHIPMENTS
-- ============================================================

create table shipments (
  id                 uuid        primary key default gen_random_uuid(),
  order_id           uuid        not null references orders (id) on delete cascade,
  tracking_number    text,
  carrier            text,
  aftership_slug     text,
  status             text,
  tag                text,
  last_update        timestamptz,
  estimated_delivery date,
  actual_delivery    date,
  raw_tracking       jsonb,
  updated_at         timestamptz not null default now(),
  user_id            uuid        references auth.users (id) on delete set null
);

alter table shipments enable row level security;

create policy "shipments: admin all"
  on shipments for all to authenticated
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

create index idx_shipments_order_id on shipments (order_id);
create index idx_shipments_user_id  on shipments (user_id);

-- ============================================================
-- EMAIL CAMPAIGNS
-- ============================================================

create table email_campaigns (
  id                uuid        primary key default gen_random_uuid(),
  name              text        not null,
  product           text,
  target_country    text,
  status            text        not null default 'draft'
                      check (status in ('draft','active','paused','completed')),
  total_leads       integer     not null default 0,
  emails_sent       integer     not null default 0,
  replies_received  integer     not null default 0,
  interested_count  integer     not null default 0,
  created_at        timestamptz not null default now(),
  user_id           uuid        references auth.users (id) on delete set null
);

alter table email_campaigns enable row level security;

create policy "email_campaigns: admin all"
  on email_campaigns for all to authenticated
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

create index idx_email_campaigns_user_id on email_campaigns (user_id);
create index idx_email_campaigns_status  on email_campaigns (status);

-- ============================================================
-- EMAIL LOGS
-- ============================================================

create table email_logs (
  id              uuid        primary key default gen_random_uuid(),
  campaign_id     uuid        references email_campaigns (id) on delete set null,
  lead_id         uuid        references leads (id) on delete set null,
  email_to        text        not null,
  subject         text,
  body            text,
  sequence_step   integer     not null default 1,
  status          text        not null default 'queued'
                    check (status in ('queued','sent','opened','replied','bounced','unsubscribed')),
  classification  text
                    check (classification in ('interested','not_interested','needs_info','no_response')),
  sent_at         timestamptz,
  replied_at      timestamptz,
  created_at      timestamptz not null default now(),
  user_id         uuid        references auth.users (id) on delete set null
);

alter table email_logs enable row level security;

create policy "email_logs: admin all"
  on email_logs for all to authenticated
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

create index idx_email_logs_campaign_id on email_logs (campaign_id);
create index idx_email_logs_lead_id     on email_logs (lead_id);
create index idx_email_logs_user_id     on email_logs (user_id);
create index idx_email_logs_status      on email_logs (status);

-- ============================================================
-- FOB CALCULATIONS
-- ============================================================

create table fob_calculations (
  id                   uuid          primary key default gen_random_uuid(),
  product              text          not null,
  quantity_kg          numeric(10,2) not null,
  ex_works_inr         numeric(14,2) not null,
  inland_freight_inr   numeric(14,2) not null default 0,
  export_charges_inr   numeric(14,2) not null default 0,
  fob_inr              numeric(14,2) not null generated always as
                         (ex_works_inr + inland_freight_inr + export_charges_inr) stored,
  fob_usd              numeric(14,4),
  margin_percent       numeric(5,2),
  destination_country  text,
  notes                text,
  created_at           timestamptz   not null default now(),
  user_id              uuid          references auth.users (id) on delete set null
);

alter table fob_calculations enable row level security;

create policy "fob_calculations: admin all"
  on fob_calculations for all to authenticated
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

create index idx_fob_calculations_user_id on fob_calculations (user_id);
