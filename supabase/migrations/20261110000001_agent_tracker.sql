-- ============================================================
-- Brindari agent tracker (docs/agents/BRIEF.md section 5) in Supabase
--
-- Moves the shared tracker from the Excel workbook into the database so
-- agents can run in the cloud and the CEO dashboard can show it (/agents).
--
-- Access:
--   * Dashboard users (authenticated, is_admin()) : full access, as for other tables.
--   * brindari_agent role (used by agent scripts via a JWT with role=brindari_agent):
--       - agent_* tables : SELECT + INSERT only (no update, no delete)
--       - business tables: SELECT only
--       - leads          : INSERT only rows with source 'Scout (agent)' and status 'new'
--   * anon: nothing.
-- Additive only: creates new tables, a role and policies. Changes no existing data.
-- ============================================================

-- ── Tables ──────────────────────────────────────────────────────────────────

create table if not exists agent_activity (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  actor          text not null,
  action         text not null,
  item           text not null,
  status         text not null,
  needs_approval boolean not null default false,
  source         text,
  notes          text
);

create table if not exists agent_tasks (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  task       text not null,
  owner      text not null,
  priority   text not null check (priority in ('high','medium','low')),
  status     text not null default 'not started' check (status in ('not started','in progress','blocked','done')),
  due_date   date,
  blocker    text,
  created_by text
);

create table if not exists agent_outputs (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  agent          text not null,
  kind           text not null,          -- daily-update, weekly-review, drafts, batch, check, card, candidate, ...
  title          text not null,
  body           text not null,
  audience       text not null default 'internal' check (audience in ('internal','external')),
  needs_approval boolean not null default false
);

create table if not exists agent_approvals (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  item         text not null,
  requested_by text not null,
  reason       text not null,
  risk         text not null,
  atlas_review text,
  output_id    uuid references agent_outputs (id) on delete set null,
  decision     text not null default 'pending' check (decision in ('pending','approved','rejected','changed')),
  decided_by   text,
  decided_at   timestamptz,
  decision_note text
);

create table if not exists agent_decisions (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  decided_on      date not null default current_date,
  decision        text not null,
  who_decided     text not null,
  reason          text,
  what_it_changes text
);

create table if not exists agent_diversification (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  product        text not null,
  hs_code        text,
  stage          text not null check (stage in ('screen','gate 0','gate 1','gate 2','gate 3','gate 4','gate 5','gate 6','dropped')),
  screen_result  text not null check (screen_result in ('pass','fail','unclear','pending')),
  owner          text not null,
  next_gate_date date,
  go_no_go       text check (go_no_go in ('go','wait','drop','pending')),
  reason         text,
  sources        text
);

create table if not exists agent_compliance (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  item        text not null,
  type        text not null check (type in ('registration','certification','filing','other')),
  status      text not null check (status in ('held','applied','not held','unknown')),
  number_ref  text,
  expiry      date,
  evidence    text,
  owner       text not null,
  next_action text
);

create table if not exists agent_marketing_kpis (
  id                   uuid primary key default gen_random_uuid(),
  created_at           timestamptz not null default now(),
  week_start           date not null,
  fb_reach             integer,
  sample_leads         integer,
  group_posts          integer,
  linkedin_connections integer,
  linkedin_posts       integer,
  source               text,
  notes                text
);

-- Scout's record of every prospect it checks (VERIFIED ones also go to `leads`)
create table if not exists agent_prospects (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  company      text not null,
  country      text not null,
  contact      text,
  verification text not null check (verification in ('VERIFIED','PARTIAL','REJECTED')),
  evidence     text not null,
  source_list  text,
  notes        text
);

-- Harvest's supplier reviews (scores 0-5; 0 = no evidence)
create table if not exists agent_supplier_reviews (
  id                     uuid primary key default gen_random_uuid(),
  created_at             timestamptz not null default now(),
  supplier_name          text not null,
  location               text,
  source                 text,
  discovered_supplier_id uuid references discovered_suppliers (id) on delete set null,
  quality                smallint check (quality between 0 and 5),
  price                  smallint check (price between 0 and 5),
  lead_time              smallint check (lead_time between 0 and 5),
  trust                  smallint check (trust between 0 and 5),
  communication          smallint check (communication between 0 and 5),
  certifications_claimed text,
  certificates_seen      text,
  recommendation         text not null check (recommendation in ('approve','reject','needs info')),
  evidence               text,
  notes                  text
);

-- Read-only copies of the founders' research workbooks (Master_v5, contacts, ...)
create table if not exists agent_sources (
  id          uuid primary key default gen_random_uuid(),
  imported_at timestamptz not null default now(),
  workbook    text not null,
  sheet       text not null,
  row_num     integer not null,
  data        jsonb not null
);

create index if not exists idx_agent_activity_created  on agent_activity (created_at desc);
create index if not exists idx_agent_outputs_agent      on agent_outputs (agent, kind, created_at desc);
create index if not exists idx_agent_approvals_decision on agent_approvals (decision, created_at desc);
create index if not exists idx_agent_tasks_status       on agent_tasks (status);
create index if not exists idx_agent_prospects_company  on agent_prospects (lower(company), lower(country));
create index if not exists idx_agent_sources_sheet      on agent_sources (workbook, sheet, row_num);

-- keep agent_tasks.updated_at current when the dashboard edits a task
create or replace function agent_touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists trg_agent_tasks_updated_at on agent_tasks;
create trigger trg_agent_tasks_updated_at before update on agent_tasks
  for each row execute function agent_touch_updated_at();

-- ── Agent role ──────────────────────────────────────────────────────────────

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'brindari_agent') then
    create role brindari_agent nologin;
  end if;
end $$;
grant brindari_agent to authenticator;
grant usage on schema public to brindari_agent;

-- ── RLS: dashboard admins full access; agent role select + insert ───────────

do $$
declare t text;
begin
  foreach t in array array['agent_activity','agent_tasks','agent_outputs','agent_approvals','agent_decisions',
                           'agent_diversification','agent_compliance','agent_marketing_kpis','agent_prospects',
                           'agent_supplier_reviews','agent_sources']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "%s: admin all" on %I', t, t);
    execute format('create policy "%s: admin all" on %I for all to authenticated using (is_admin()) with check (is_admin())', t, t);
    execute format('grant select, insert on %I to brindari_agent', t);
    execute format('drop policy if exists "%s: agent read" on %I', t, t);
    execute format('create policy "%s: agent read" on %I for select to brindari_agent using (true)', t, t);
    execute format('drop policy if exists "%s: agent insert" on %I', t, t);
    execute format('create policy "%s: agent insert" on %I for insert to brindari_agent with check (true)', t, t);
  end loop;
end $$;

-- Business tables: agent may read
do $$
declare t text;
begin
  foreach t in array array['leads','buyers','suppliers','supplier_quotes','discovered_suppliers','supplier_discovery_jobs',
                           'orders','order_items','shipments','invoices','email_campaigns','email_logs',
                           'fob_calculations','revenue']
  loop
    if to_regclass('public.' || t) is not null then
      execute format('grant select on %I to brindari_agent', t);
      execute format('drop policy if exists "%s: agent read" on %I', t, t);
      execute format('create policy "%s: agent read" on %I for select to brindari_agent using (true)', t, t);
    end if;
  end loop;
end $$;

-- Leads: agent may insert only Scout prospects in the "new" stage (approved by Mahesh 2026-11-10)
grant insert on leads to brindari_agent;
drop policy if exists "leads: agent insert scout" on leads;
create policy "leads: agent insert scout" on leads for insert to brindari_agent
  with check (source = 'Scout (agent)' and status = 'new' and deal_value_usd is null);
