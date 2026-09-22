-- ============================================================================
-- Zybble · 0009 · private storage buckets + Realtime configuration
-- ============================================================================

-- ###########################################################################
-- # storage buckets
-- #   zybble-exports : worker-generated export files (private, signed URLs)
-- #   zybble-avatars : profile images (public read, owner-only write)
-- ###########################################################################

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('zybble-exports', 'zybble-exports', false, 104857600,
    array['text/csv', 'application/json', 'application/gzip', 'text/plain']),
  ('zybble-avatars', 'zybble-avatars', true, 2097152,
    array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- exports: only the API (secret key) writes; downloads happen through signed
-- URLs minted by /api/exports/{id}/download after an ownership check.
drop policy if exists zybble_exports_service_only on storage.objects;
create policy zybble_exports_service_only on storage.objects
  for select to authenticated
  using (
    bucket_id = 'zybble-exports'
    and exists (
      select 1
        from public.exports e
        join public.workspace_members m on m.workspace_id = e.workspace_id
       where e.storage_bucket = storage.objects.bucket_id
         and e.storage_path = storage.objects.name
         and m.user_id = auth.uid()
         and m.status = 'active'
         and e.deleted_at is null
         and e.status = 'ready'
    )
  );

-- avatars: a user may only write inside their own `{user_id}/` prefix
drop policy if exists zybble_avatars_insert_own on storage.objects;
create policy zybble_avatars_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'zybble-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists zybble_avatars_update_own on storage.objects;
create policy zybble_avatars_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'zybble-avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'zybble-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists zybble_avatars_delete_own on storage.objects;
create policy zybble_avatars_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'zybble-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists zybble_avatars_read_public on storage.objects;
create policy zybble_avatars_read_public on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'zybble-avatars');

-- ###########################################################################
-- # Realtime publication
--
-- Only the tables the live-search UI actually needs. Counters are written at a
-- throttled cadence by the worker, so Realtime never carries thousands of
-- events per second (task §23/§373).
-- ###########################################################################

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.searches;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.search_events;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.search_leads;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.notifications;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.exports;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.leads;
    exception when duplicate_object then null;
    end;
  else
    create publication supabase_realtime for table
      public.searches, public.search_events, public.search_leads, public.notifications, public.exports, public.leads;
  end if;
end $$;

-- full row data is required for the client to react without a follow-up fetch
alter table public.searches replica identity full;
alter table public.exports replica identity full;
alter table public.notifications replica identity full;
