-- ============================================================
-- Auth lockdown — remove public anon access, fix admin policies
--
-- Problem 1: 20260515000002_anon_dev_policies.sql and part of
--   20260519000001_supplier_discovery.sql grant full read/write/delete
--   to the "anon" Postgres role. The anon key ships in the browser
--   bundle — it is not a secret — so today anyone can read/write/
--   delete every business table with no login at all. This drops
--   all of those anon policies.
--
-- Problem 2: the admin policies added in 20260512000001_full_schema.sql
--   scope access via `user_id = auth.uid()` / `owner_user_id = auth.uid()`.
--   Since this is a single-CEO dashboard (not multi-tenant), that's a
--   foot-gun: any insert that forgets to stamp user_id becomes
--   invisible to the very account that created it. Replaced with
--   is_admin() — true for any authenticated user who is not a
--   recognized buyer (buyers are identified via buyers.auth_user_id,
--   already used by the existing buyer-portal policies).
-- ============================================================

create or replace function is_admin() returns boolean
language sql stable as $$
  select auth.uid() is not null
    and not exists (select 1 from buyers where auth_user_id = auth.uid());
$$;

-- ── Drop anon policies (20260515000002_anon_dev_policies.sql) ────────────────
drop policy if exists "leads: anon read"     on leads;
drop policy if exists "leads: anon insert"   on leads;
drop policy if exists "leads: anon update"   on leads;
drop policy if exists "leads: anon delete"   on leads;

drop policy if exists "buyers: anon read"    on buyers;
drop policy if exists "buyers: anon insert"  on buyers;
drop policy if exists "buyers: anon update"  on buyers;
drop policy if exists "buyers: anon delete"  on buyers;

drop policy if exists "suppliers: anon read"   on suppliers;
drop policy if exists "suppliers: anon insert" on suppliers;
drop policy if exists "suppliers: anon update" on suppliers;
drop policy if exists "suppliers: anon delete" on suppliers;

drop policy if exists "supplier_quotes: anon read"   on supplier_quotes;
drop policy if exists "supplier_quotes: anon insert" on supplier_quotes;
drop policy if exists "supplier_quotes: anon update" on supplier_quotes;
drop policy if exists "supplier_quotes: anon delete" on supplier_quotes;

drop policy if exists "orders: anon read"    on orders;
drop policy if exists "orders: anon insert"  on orders;
drop policy if exists "orders: anon update"  on orders;
drop policy if exists "orders: anon delete"  on orders;

drop policy if exists "invoices: anon read"    on invoices;
drop policy if exists "invoices: anon insert"  on invoices;
drop policy if exists "invoices: anon update"  on invoices;
drop policy if exists "invoices: anon delete"  on invoices;

drop policy if exists "documents: anon read"    on documents;
drop policy if exists "documents: anon insert"  on documents;
drop policy if exists "documents: anon update"  on documents;
drop policy if exists "documents: anon delete"  on documents;

drop policy if exists "shipments: anon read"    on shipments;
drop policy if exists "shipments: anon insert"  on shipments;
drop policy if exists "shipments: anon update"  on shipments;
drop policy if exists "shipments: anon delete"  on shipments;

drop policy if exists "email_campaigns: anon read"    on email_campaigns;
drop policy if exists "email_campaigns: anon insert"  on email_campaigns;
drop policy if exists "email_campaigns: anon update"  on email_campaigns;
drop policy if exists "email_campaigns: anon delete"  on email_campaigns;

drop policy if exists "email_logs: anon read"    on email_logs;
drop policy if exists "email_logs: anon insert"  on email_logs;
drop policy if exists "email_logs: anon update"  on email_logs;
drop policy if exists "email_logs: anon delete"  on email_logs;

drop policy if exists "fob_calculations: anon read"    on fob_calculations;
drop policy if exists "fob_calculations: anon insert"  on fob_calculations;
drop policy if exists "fob_calculations: anon update"  on fob_calculations;
drop policy if exists "fob_calculations: anon delete"  on fob_calculations;

-- ── Drop anon policies (20260519000001_supplier_discovery.sql) ───────────────
drop policy if exists "discovered_suppliers: anon read"   on discovered_suppliers;
drop policy if exists "discovered_suppliers: anon insert" on discovered_suppliers;
drop policy if exists "discovered_suppliers: anon update" on discovered_suppliers;
drop policy if exists "discovered_suppliers: anon delete" on discovered_suppliers;

drop policy if exists "supplier_discovery_jobs: anon read"   on supplier_discovery_jobs;
drop policy if exists "supplier_discovery_jobs: anon insert" on supplier_discovery_jobs;
drop policy if exists "supplier_discovery_jobs: anon update" on supplier_discovery_jobs;
drop policy if exists "supplier_discovery_jobs: anon delete" on supplier_discovery_jobs;

-- ── Replace user_id/owner_user_id-scoped admin policies with is_admin() ──────
drop policy if exists "leads: admin all"      on leads;
create policy "leads: admin all" on leads for all to authenticated
  using (is_admin()) with check (is_admin());

drop policy if exists "buyers: admin all"     on buyers;
create policy "buyers: admin all" on buyers for all to authenticated
  using (is_admin()) with check (is_admin());
-- "buyers: portal select" (auth_user_id = auth.uid()) is untouched — still correct.

drop policy if exists "suppliers: admin all"  on suppliers;
create policy "suppliers: admin all" on suppliers for all to authenticated
  using (is_admin()) with check (is_admin());

drop policy if exists "supplier_quotes: admin all" on supplier_quotes;
create policy "supplier_quotes: admin all" on supplier_quotes for all to authenticated
  using (is_admin()) with check (is_admin());

drop policy if exists "orders: admin all"     on orders;
create policy "orders: admin all" on orders for all to authenticated
  using (is_admin()) with check (is_admin());
-- "orders: portal select" is untouched — still correct.

drop policy if exists "invoices: admin all"   on invoices;
create policy "invoices: admin all" on invoices for all to authenticated
  using (is_admin()) with check (is_admin());
-- "invoices: portal select" is untouched — still correct.

drop policy if exists "documents: admin all"  on documents;
create policy "documents: admin all" on documents for all to authenticated
  using (is_admin()) with check (is_admin());
-- "documents: portal select" is untouched — still correct.

drop policy if exists "shipments: admin all"  on shipments;
create policy "shipments: admin all" on shipments for all to authenticated
  using (is_admin()) with check (is_admin());

drop policy if exists "email_campaigns: admin all" on email_campaigns;
create policy "email_campaigns: admin all" on email_campaigns for all to authenticated
  using (is_admin()) with check (is_admin());

drop policy if exists "email_logs: admin all" on email_logs;
create policy "email_logs: admin all" on email_logs for all to authenticated
  using (is_admin()) with check (is_admin());

drop policy if exists "fob_calculations: admin all" on fob_calculations;
create policy "fob_calculations: admin all" on fob_calculations for all to authenticated
  using (is_admin()) with check (is_admin());

-- ── discovered_suppliers / supplier_discovery_jobs had ONLY anon policies ────
-- (no authenticated policy existed at all) — add admin access now that anon is gone.
create policy "discovered_suppliers: admin all" on discovered_suppliers for all to authenticated
  using (is_admin()) with check (is_admin());

create policy "supplier_discovery_jobs: admin all" on supplier_discovery_jobs for all to authenticated
  using (is_admin()) with check (is_admin());
