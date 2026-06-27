-- PRIVATE storage bucket for ID-card scans (copie CI) uploaded by team members.
-- The public form may upload, but files are NOT publicly readable: reads
-- require auth and are served through short-lived signed URLs (createSignedUrl).
-- Files are named after the person, e.g. "Andrei Popescu.jpg".
insert into storage.buckets (id, name, public)
values ('echipa-ci', 'echipa-ci', false)
on conflict (id) do nothing;

-- Anon (public form) + authenticated may upload ID scans.
drop policy if exists "Anyone can upload echipa CI" on storage.objects;
create policy "Anyone can upload echipa CI"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'echipa-ci');

-- Only authenticated users may read ID scans (via signed URLs). Anon cannot.
drop policy if exists "Authenticated can read echipa CI" on storage.objects;
create policy "Authenticated can read echipa CI"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'echipa-ci');
