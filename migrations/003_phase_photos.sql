-- Migration 003: phase_photos table for PhaseBreakdown inline uploads.
--
-- Each check-off item in PhaseBreakdown has a camera button. Every upload
-- creates one row here, linking the photo to (job_id, phase_id, item_id).
--
-- Storage: files live in the `phase-photos` bucket. Create the bucket
-- through Supabase Dashboard → Storage → "New bucket" → name `phase-photos`,
-- visibility Public. (Cannot be done via SQL.)

create table if not exists public.phase_photos (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null,
  phase_id    text not null,
  item_id     text not null,
  type        text not null default 'progress' check (type in ('before', 'progress', 'after')),
  photo_url   text not null,
  taken_by    text,
  taken_at    timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create index if not exists phase_photos_scope_idx
  on public.phase_photos (job_id, phase_id, item_id, taken_at desc);

-- Allow the app (anon role) to read/write its own rows. Matches the
-- permissive pattern the rest of the schema uses — tighten later when
-- real auth is wired up.
alter table public.phase_photos enable row level security;

drop policy if exists phase_photos_anon_read   on public.phase_photos;
drop policy if exists phase_photos_anon_insert on public.phase_photos;
drop policy if exists phase_photos_anon_delete on public.phase_photos;

create policy phase_photos_anon_read   on public.phase_photos for select using (true);
create policy phase_photos_anon_insert on public.phase_photos for insert with check (true);
create policy phase_photos_anon_delete on public.phase_photos for delete using (true);
