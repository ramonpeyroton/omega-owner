-- Migration 024: profile fields on users + storage policies for the
-- new `user-profiles` bucket.
--
-- Powers the Profile modal that opens when clicking the user's name
-- in the sidebar. Each user can fill in a phone, an address, and
-- upload a profile photo. The photo URL is stored as TEXT and the
-- bytes live in Supabase Storage.
--
-- Storage:
--   * Bucket: `user-profiles` (PUBLIC) — must be created manually in
--     Supabase Dashboard → Storage → "New bucket" → name
--     `user-profiles` → toggle PUBLIC = ON.
--     Files inside live at:  user-profiles/<user_id>/<timestamp>-<filename>
--
-- The frontend only allows editing the user's OWN row (or the admin
-- editing anyone). The same client-side guard the rest of the app
-- already uses — Supabase RLS stays permissive to match.

alter table public.users
  add column if not exists phone text,
  add column if not exists address text,
  add column if not exists profile_photo_url text;


-- ─── Storage policies for the `user-profiles` bucket ───────────────
-- Same shape as migration 021 for `job-covers`: PUBLIC flag only
-- enables reads, so we explicitly allow anon insert/update/delete.

drop policy if exists "user_profiles_anon_select" on storage.objects;
create policy "user_profiles_anon_select" on storage.objects
  for select using (bucket_id = 'user-profiles');

drop policy if exists "user_profiles_anon_insert" on storage.objects;
create policy "user_profiles_anon_insert" on storage.objects
  for insert with check (bucket_id = 'user-profiles');

drop policy if exists "user_profiles_anon_update" on storage.objects;
create policy "user_profiles_anon_update" on storage.objects
  for update using (bucket_id = 'user-profiles');

drop policy if exists "user_profiles_anon_delete" on storage.objects;
create policy "user_profiles_anon_delete" on storage.objects
  for delete using (bucket_id = 'user-profiles');


-- Force PostgREST to refresh its schema cache so the new columns
-- are visible to the API immediately.
notify pgrst, 'reload schema';
