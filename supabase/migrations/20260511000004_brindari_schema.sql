-- ============================================================
-- Replace generic tables with Brindari moringa export schema
-- ============================================================

-- Drop old tables (order matters: children first)
drop table if exists invoices    cascade;
drop table if exists order_items cascade;
drop table if exists orders      cascade;
drop table if exists revenue     cascade;
drop table if exists leads       cascade;
drop table if exists buyers      cascade;

-- Drop old sequences
drop sequence if exists order_number_seq;
drop sequence if exists invoice_number_seq;

-- ============================================================
-- LEADS
-- ============================================================

create table leads (
  id               uuid        primary key default gen_random_uuid(),
  company          text        not null,
  contact_name     text        not null,
  email            text,
  country          text        not null,
  product_interest text,
  status           text        not null default 'new'
                     check (status in ('new','contacted','qualified','proposal','won','lost')),
  deal_value_usd   numeric(14,2),
  notes            text,
  created_at       timestamptz not null default now()
);

alter table leads enable row level security;

create policy "leads: owner read"   on leads for select to authenticated using (true);
create policy "leads: owner insert" on leads for insert to authenticated with check (true);
create policy "leads: owner update" on leads for update to authenticated using (true) with check (true);
create policy "leads: owner delete" on leads for delete to authenticated using (true);
create policy "leads: anon read"    on leads for select to anon using (true);
create policy "leads: anon insert"  on leads for insert to anon with check (true);
create policy "leads: anon update"  on leads for update to anon using (true) with check (true);
create policy "leads: anon delete"  on leads for delete to anon using (true);

create index idx_leads_status  on leads (status);
create index idx_leads_country on leads (country);

-- ============================================================
-- ORDERS
-- ============================================================

create table orders (
  id              uuid          primary key default gen_random_uuid(),
  buyer_id        uuid          not null references leads (id) on delete restrict,
  product         text          not null,
  quantity_kg     numeric(10,2) not null check (quantity_kg > 0),
  fob_price_usd   numeric(10,4) not null check (fob_price_usd > 0),
  total_value     numeric(14,2) not null generated always as (quantity_kg * fob_price_usd) stored,
  shipment_date   date,
  status          text          not null default 'pending'
                    check (status in ('pending','confirmed','in_production',
                                      'ready_to_ship','shipped','delivered','cancelled')),
  hs_code         text,
  incoterm        text          check (incoterm in ('FOB','CIF','EXW','DDP','CFR')),
  created_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now()
);

create trigger trg_orders_updated_at
  before update on orders
  for each row execute function handle_updated_at();

alter table orders enable row level security;

create policy "orders: owner read"   on orders for select to authenticated using (true);
create policy "orders: owner insert" on orders for insert to authenticated with check (true);
create policy "orders: owner update" on orders for update to authenticated using (true) with check (true);
create policy "orders: owner delete" on orders for delete to authenticated using (true);
create policy "orders: anon read"    on orders for select to anon using (true);
create policy "orders: anon insert"  on orders for insert to anon with check (true);
create policy "orders: anon update"  on orders for update to anon using (true) with check (true);
create policy "orders: anon delete"  on orders for delete to anon using (true);

create index idx_orders_buyer_id      on orders (buyer_id);
create index idx_orders_status        on orders (status);
create index idx_orders_shipment_date on orders (shipment_date);

-- ============================================================
-- INVOICES
-- ============================================================

create table invoices (
  id              uuid        primary key default gen_random_uuid(),
  order_id        uuid        not null references orders (id) on delete restrict,
  invoice_number  text        not null unique,
  issued_date     date        not null default current_date,
  due_date        date,
  pdf_url         text,
  status          text        not null default 'draft'
                    check (status in ('draft','sent','paid','overdue','cancelled')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger trg_invoices_updated_at
  before update on invoices
  for each row execute function handle_updated_at();

alter table invoices enable row level security;

create policy "invoices: owner read"   on invoices for select to authenticated using (true);
create policy "invoices: owner insert" on invoices for insert to authenticated with check (true);
create policy "invoices: owner update" on invoices for update to authenticated using (true) with check (true);
create policy "invoices: owner delete" on invoices for delete to authenticated using (true);
create policy "invoices: anon read"    on invoices for select to anon using (true);
create policy "invoices: anon insert"  on invoices for insert to anon with check (true);
create policy "invoices: anon update"  on invoices for update to anon using (true) with check (true);
create policy "invoices: anon delete"  on invoices for delete to anon using (true);

create index idx_invoices_order_id on invoices (order_id);
create index idx_invoices_status   on invoices (status);
create index idx_invoices_due_date on invoices (due_date);
