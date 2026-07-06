-- ============================================================
-- Dev-mode anon policies
-- Allows the anon key (used before Supabase Auth is configured)
-- to read and write all tables. Remove or disable in production
-- by setting ENABLE_AUTH=true in environment variables.
-- ============================================================

-- LEADS
create policy "leads: anon read"   on leads for select to anon using (true);
create policy "leads: anon insert" on leads for insert to anon with check (true);
create policy "leads: anon update" on leads for update to anon using (true) with check (true);
create policy "leads: anon delete" on leads for delete to anon using (true);

-- BUYERS
create policy "buyers: anon read"   on buyers for select to anon using (true);
create policy "buyers: anon insert" on buyers for insert to anon with check (true);
create policy "buyers: anon update" on buyers for update to anon using (true) with check (true);
create policy "buyers: anon delete" on buyers for delete to anon using (true);

-- SUPPLIERS
create policy "suppliers: anon read"   on suppliers for select to anon using (true);
create policy "suppliers: anon insert" on suppliers for insert to anon with check (true);
create policy "suppliers: anon update" on suppliers for update to anon using (true) with check (true);
create policy "suppliers: anon delete" on suppliers for delete to anon using (true);

-- SUPPLIER QUOTES
create policy "supplier_quotes: anon read"   on supplier_quotes for select to anon using (true);
create policy "supplier_quotes: anon insert" on supplier_quotes for insert to anon with check (true);
create policy "supplier_quotes: anon update" on supplier_quotes for update to anon using (true) with check (true);
create policy "supplier_quotes: anon delete" on supplier_quotes for delete to anon using (true);

-- ORDERS
create policy "orders: anon read"   on orders for select to anon using (true);
create policy "orders: anon insert" on orders for insert to anon with check (true);
create policy "orders: anon update" on orders for update to anon using (true) with check (true);
create policy "orders: anon delete" on orders for delete to anon using (true);

-- INVOICES
create policy "invoices: anon read"   on invoices for select to anon using (true);
create policy "invoices: anon insert" on invoices for insert to anon with check (true);
create policy "invoices: anon update" on invoices for update to anon using (true) with check (true);
create policy "invoices: anon delete" on invoices for delete to anon using (true);

-- DOCUMENTS
create policy "documents: anon read"   on documents for select to anon using (true);
create policy "documents: anon insert" on documents for insert to anon with check (true);
create policy "documents: anon update" on documents for update to anon using (true) with check (true);
create policy "documents: anon delete" on documents for delete to anon using (true);

-- SHIPMENTS
create policy "shipments: anon read"   on shipments for select to anon using (true);
create policy "shipments: anon insert" on shipments for insert to anon with check (true);
create policy "shipments: anon update" on shipments for update to anon using (true) with check (true);
create policy "shipments: anon delete" on shipments for delete to anon using (true);

-- EMAIL CAMPAIGNS
create policy "email_campaigns: anon read"   on email_campaigns for select to anon using (true);
create policy "email_campaigns: anon insert" on email_campaigns for insert to anon with check (true);
create policy "email_campaigns: anon update" on email_campaigns for update to anon using (true) with check (true);
create policy "email_campaigns: anon delete" on email_campaigns for delete to anon using (true);

-- EMAIL LOGS
create policy "email_logs: anon read"   on email_logs for select to anon using (true);
create policy "email_logs: anon insert" on email_logs for insert to anon with check (true);
create policy "email_logs: anon update" on email_logs for update to anon using (true) with check (true);
create policy "email_logs: anon delete" on email_logs for delete to anon using (true);

-- FOB CALCULATIONS
create policy "fob_calculations: anon read"   on fob_calculations for select to anon using (true);
create policy "fob_calculations: anon insert" on fob_calculations for insert to anon with check (true);
create policy "fob_calculations: anon update" on fob_calculations for update to anon using (true) with check (true);
create policy "fob_calculations: anon delete" on fob_calculations for delete to anon using (true);
