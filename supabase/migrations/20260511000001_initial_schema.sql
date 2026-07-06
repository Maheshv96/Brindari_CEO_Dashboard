-- ============================================================
-- Brindari CEO Dashboard — Initial Schema
-- ============================================================

-- gen_random_uuid() is not available on hosted Supabase; use gen_random_uuid() (pgcrypto, always available)

-- ============================================================
-- Helpers
-- ============================================================

-- Auto-update updated_at on any table that has the column
create or replace function handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Sequence-based human-readable number generator
create sequence if not exists order_number_seq start 1000;
create sequence if not exists invoice_number_seq start 2000;

-- ============================================================
-- BUYERS
-- ============================================================

create table buyers (
  id            uuid primary key default gen_random_uuid(),
  name          text        not null,
  email         text        not null unique,
  phone         text,
  company       text,
  address       text,
  city          text,
  state         text,
  country       text        not null default 'US',
  status        text        not null default 'active'
                  check (status in ('active', 'inactive', 'churned')),
  total_spent   numeric(14,2) not null default 0,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_buyers_email   on buyers (email);
create index idx_buyers_status  on buyers (status);
create index idx_buyers_company on buyers (company);

create trigger trg_buyers_updated_at
  before update on buyers
  for each row execute function handle_updated_at();

-- ============================================================
-- LEADS
-- ============================================================

create table leads (
  id                   uuid primary key default gen_random_uuid(),
  name                 text        not null,
  email                text,
  phone                text,
  company              text,
  source               text        check (source in (
                         'website', 'referral', 'social',
                         'email', 'cold_outreach', 'event', 'other')),
  status               text        not null default 'new'
                         check (status in (
                           'new', 'contacted', 'qualified',
                           'proposal', 'negotiation', 'won', 'lost')),
  estimated_value      numeric(14,2),
  notes                text,
  assigned_to          uuid        references auth.users (id) on delete set null,
  converted_at         timestamptz,
  converted_buyer_id   uuid        references buyers (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index idx_leads_status             on leads (status);
create index idx_leads_source             on leads (source);
create index idx_leads_converted_buyer_id on leads (converted_buyer_id);
create index idx_leads_assigned_to        on leads (assigned_to);

create trigger trg_leads_updated_at
  before update on leads
  for each row execute function handle_updated_at();

-- ============================================================
-- ORDERS
-- ============================================================

create table orders (
  id             uuid primary key default gen_random_uuid(),
  buyer_id       uuid        not null references buyers (id) on delete restrict,
  order_number   text        not null unique
                   default ('ORD-' || lpad(nextval('order_number_seq')::text, 6, '0')),
  status         text        not null default 'pending'
                   check (status in (
                     'pending', 'confirmed', 'processing',
                     'shipped', 'delivered', 'cancelled', 'refunded')),
  subtotal       numeric(14,2) not null default 0,
  tax            numeric(14,2) not null default 0,
  discount       numeric(14,2) not null default 0,
  total          numeric(14,2) not null default 0,
  currency       text        not null default 'USD',
  notes          text,
  ordered_at     timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index idx_orders_buyer_id    on orders (buyer_id);
create index idx_orders_status      on orders (status);
create index idx_orders_ordered_at  on orders (ordered_at desc);

create trigger trg_orders_updated_at
  before update on orders
  for each row execute function handle_updated_at();

-- ============================================================
-- ORDER ITEMS
-- ============================================================

create table order_items (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid        not null references orders (id) on delete cascade,
  product_name   text        not null,
  sku            text,
  quantity       integer     not null check (quantity > 0),
  unit_price     numeric(14,2) not null check (unit_price >= 0),
  total_price    numeric(14,2) not null generated always as
                   (quantity * unit_price) stored,
  created_at     timestamptz not null default now()
);

create index idx_order_items_order_id on order_items (order_id);

-- ============================================================
-- INVOICES
-- ============================================================

create table invoices (
  id               uuid primary key default gen_random_uuid(),
  buyer_id         uuid        not null references buyers (id) on delete restrict,
  order_id         uuid        references orders (id) on delete set null,
  invoice_number   text        not null unique
                     default ('INV-' || lpad(nextval('invoice_number_seq')::text, 6, '0')),
  status           text        not null default 'draft'
                     check (status in (
                       'draft', 'sent', 'viewed',
                       'paid', 'overdue', 'cancelled', 'refunded')),
  subtotal         numeric(14,2) not null default 0,
  tax              numeric(14,2) not null default 0,
  discount         numeric(14,2) not null default 0,
  total            numeric(14,2) not null default 0,
  amount_paid      numeric(14,2) not null default 0,
  amount_due       numeric(14,2) not null generated always as
                     (total - amount_paid) stored,
  currency         text        not null default 'USD',
  due_date         date,
  paid_at          timestamptz,
  notes            text,
  issued_at        timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index idx_invoices_buyer_id  on invoices (buyer_id);
create index idx_invoices_order_id  on invoices (order_id);
create index idx_invoices_status    on invoices (status);
create index idx_invoices_due_date  on invoices (due_date);
create index idx_invoices_issued_at on invoices (issued_at desc);

create trigger trg_invoices_updated_at
  before update on invoices
  for each row execute function handle_updated_at();

-- Auto-mark overdue invoices
create or replace function mark_overdue_invoices()
returns void language plpgsql as $$
begin
  update invoices
  set    status = 'overdue'
  where  status in ('sent', 'viewed')
    and  due_date < current_date
    and  amount_due > 0;
end;
$$;

-- ============================================================
-- REVENUE  (monthly MRR/ARR snapshot)
-- ============================================================

create table revenue (
  id                 uuid primary key default gen_random_uuid(),
  period_start       date        not null,
  period_end         date        not null,
  gross_revenue      numeric(14,2) not null default 0,
  refunds            numeric(14,2) not null default 0,
  net_revenue        numeric(14,2) not null generated always as
                       (gross_revenue - refunds) stored,
  new_mrr            numeric(14,2) not null default 0,
  expansion_mrr      numeric(14,2) not null default 0,
  churned_mrr        numeric(14,2) not null default 0,
  total_mrr          numeric(14,2) not null default 0,
  arr                numeric(14,2) not null generated always as
                       (total_mrr * 12) stored,
  new_customers      integer     not null default 0,
  churned_customers  integer     not null default 0,
  active_customers   integer     not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint revenue_period_unique unique (period_start, period_end),
  constraint revenue_period_order  check (period_end > period_start)
);

create index idx_revenue_period on revenue (period_start desc);

create trigger trg_revenue_updated_at
  before update on revenue
  for each row execute function handle_updated_at();

-- ============================================================
-- TRIGGER: sync buyer.total_spent when invoice is paid
-- ============================================================

create or replace function sync_buyer_total_spent()
returns trigger language plpgsql security definer as $$
begin
  update buyers
  set    total_spent = (
    select coalesce(sum(amount_paid), 0)
    from   invoices
    where  buyer_id = coalesce(new.buyer_id, old.buyer_id)
      and  status   = 'paid'
  )
  where id = coalesce(new.buyer_id, old.buyer_id);
  return new;
end;
$$;

create trigger trg_invoices_sync_buyer_spent
  after insert or update of amount_paid, status or delete
  on invoices
  for each row execute function sync_buyer_total_spent();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table buyers      enable row level security;
alter table leads       enable row level security;
alter table orders      enable row level security;
alter table order_items enable row level security;
alter table invoices    enable row level security;
alter table revenue     enable row level security;

-- ------------------------------------------------------------
-- BUYERS policies
-- ------------------------------------------------------------

-- Authenticated users can read all buyers
create policy "buyers: authenticated read"
  on buyers for select
  to authenticated
  using (true);

-- Authenticated users can insert buyers
create policy "buyers: authenticated insert"
  on buyers for insert
  to authenticated
  with check (true);

-- Authenticated users can update buyers
create policy "buyers: authenticated update"
  on buyers for update
  to authenticated
  using (true)
  with check (true);

-- Only service role can hard-delete buyers (soft-delete via status preferred)
create policy "buyers: service role delete"
  on buyers for delete
  to service_role
  using (true);

-- ------------------------------------------------------------
-- LEADS policies
-- ------------------------------------------------------------

create policy "leads: authenticated read"
  on leads for select
  to authenticated
  using (true);

create policy "leads: authenticated insert"
  on leads for insert
  to authenticated
  with check (true);

create policy "leads: authenticated update"
  on leads for update
  to authenticated
  using (true)
  with check (true);

create policy "leads: service role delete"
  on leads for delete
  to service_role
  using (true);

-- ------------------------------------------------------------
-- ORDERS policies
-- ------------------------------------------------------------

create policy "orders: authenticated read"
  on orders for select
  to authenticated
  using (true);

create policy "orders: authenticated insert"
  on orders for insert
  to authenticated
  with check (true);

create policy "orders: authenticated update"
  on orders for update
  to authenticated
  using (true)
  with check (true);

create policy "orders: service role delete"
  on orders for delete
  to service_role
  using (true);

-- ------------------------------------------------------------
-- ORDER ITEMS policies
-- ------------------------------------------------------------

create policy "order_items: authenticated read"
  on order_items for select
  to authenticated
  using (true);

create policy "order_items: authenticated insert"
  on order_items for insert
  to authenticated
  with check (true);

create policy "order_items: authenticated update"
  on order_items for update
  to authenticated
  using (true)
  with check (true);

create policy "order_items: service role delete"
  on order_items for delete
  to service_role
  using (true);

-- ------------------------------------------------------------
-- INVOICES policies
-- ------------------------------------------------------------

create policy "invoices: authenticated read"
  on invoices for select
  to authenticated
  using (true);

create policy "invoices: authenticated insert"
  on invoices for insert
  to authenticated
  with check (true);

create policy "invoices: authenticated update"
  on invoices for update
  to authenticated
  using (true)
  with check (true);

create policy "invoices: service role delete"
  on invoices for delete
  to service_role
  using (true);

-- ------------------------------------------------------------
-- REVENUE policies  (read-only for authenticated users)
-- ------------------------------------------------------------

create policy "revenue: authenticated read"
  on revenue for select
  to authenticated
  using (true);

-- Only service role writes revenue snapshots (typically from a cron/edge fn)
create policy "revenue: service role write"
  on revenue for all
  to service_role
  using (true)
  with check (true);

-- ============================================================
-- USEFUL VIEWS
-- ============================================================

-- Pipeline summary per lead status
create view lead_pipeline as
select
  status,
  count(*)                          as count,
  coalesce(sum(estimated_value), 0) as total_value
from leads
group by status;

-- Outstanding invoices with buyer info
create view outstanding_invoices as
select
  i.id,
  i.invoice_number,
  i.status,
  i.total,
  i.amount_paid,
  i.amount_due,
  i.due_date,
  i.issued_at,
  b.name  as buyer_name,
  b.email as buyer_email,
  b.company
from invoices i
join buyers b on b.id = i.buyer_id
where i.amount_due > 0
  and i.status not in ('cancelled', 'refunded');

-- Monthly revenue trend (derived from paid invoices)
create view monthly_revenue as
select
  date_trunc('month', paid_at) as month,
  count(distinct buyer_id)     as paying_customers,
  sum(amount_paid)             as revenue
from invoices
where status = 'paid'
  and paid_at is not null
group by 1
order by 1 desc;
