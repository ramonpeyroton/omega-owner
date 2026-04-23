-- Migration 005: settings table (editable annual goal, etc.) and enable
-- realtime replication on `jobs` and `contracts` so the Screen dashboard
-- can celebrate new leads and signed contracts as they happen.

-- ─── Key-value settings (used by Admin > Settings later) ─────────
create table if not exists public.app_settings (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table public.app_settings enable row level security;

drop policy if exists app_settings_anon_read on public.app_settings;
drop policy if exists app_settings_anon_write on public.app_settings;

-- Read open (Screen needs it). Write open for now — Admin UI is the only
-- place that touches this; lock down once real auth is in place.
create policy app_settings_anon_read  on public.app_settings for select using (true);
create policy app_settings_anon_write on public.app_settings for all    using (true) with check (true);

-- Seed the annual goal. Use upsert so re-running is safe.
insert into public.app_settings (key, value)
values ('annual_goal_2026', '6000000')
on conflict (key) do nothing;

-- ─── Enable realtime on jobs + contracts ─────────────────────────
-- Required for Supabase Realtime subscriptions to fire. Safe to run
-- repeatedly — `alter publication ... add table` will error if the
-- table is already in the publication; the DO blocks below swallow that.

do $$
begin
  alter publication supabase_realtime add table public.jobs;
exception
  when duplicate_object then null;
end$$;

do $$
begin
  alter publication supabase_realtime add table public.contracts;
exception
  when duplicate_object then null;
end$$;
