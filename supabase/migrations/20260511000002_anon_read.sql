-- Allow anon role to read all tables (dashboard is internal, no public auth yet)
create policy "leads: anon read"       on leads       for select to anon using (true);
create policy "buyers: anon read"      on buyers      for select to anon using (true);
create policy "orders: anon read"      on orders      for select to anon using (true);
create policy "order_items: anon read" on order_items for select to anon using (true);
create policy "invoices: anon read"    on invoices    for select to anon using (true);
create policy "revenue: anon read"     on revenue     for select to anon using (true);
