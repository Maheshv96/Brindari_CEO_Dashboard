-- Allow anon role to write leads (for dev — will lock down once auth is added)
create policy "leads: anon insert" on leads for insert to anon with check (true);
create policy "leads: anon update" on leads for update to anon using (true) with check (true);
create policy "leads: anon delete" on leads for delete to anon using (true);
