-- Migration 007: daily_logs + job_notes (growing Notes & Alerts history).
-- Safe to re-run. Run once in Supabase SQL Editor.

-- ─── daily_logs ───────────────────────────────────────────────────
create table if not exists public.daily_logs (
  id                   uuid primary key default gen_random_uuid(),
  job_id               uuid not null,
  log_date             date not null,
  weather              text,
  workers_on_site      int,
  work_performed       text,
  materials_delivered  text,
  issues_encountered   text,
  logged_by            text,
  created_at           timestamptz not null default now()
);
create index if not exists daily_logs_job_date_idx
  on public.daily_logs (job_id, log_date desc, created_at desc);

alter table public.daily_logs enable row level security;
drop policy if exists daily_logs_anon_read on public.daily_logs;
drop policy if exists daily_logs_anon_ins  on public.daily_logs;
drop policy if exists daily_logs_anon_del  on public.daily_logs;
create policy daily_logs_anon_read on public.daily_logs for select using (true);
create policy daily_logs_anon_ins  on public.daily_logs for insert with check (true);
create policy daily_logs_anon_del  on public.daily_logs for delete using (true);

-- ─── job_notes ────────────────────────────────────────────────────
-- Replaces the single `jobs.notes_alerts` field with a growing log of
-- dated notes, each with author + role. The old column stays (not
-- dropped) so any data already there isn't lost — the app just stops
-- reading/writing to it. Admin can manually migrate if they want to.
create table if not exists public.job_notes (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null,
  body         text not null,
  author_name  text,
  author_role  text,
  created_at   timestamptz not null default now()
);
create index if not exists job_notes_job_idx
  on public.job_notes (job_id, created_at desc);

alter table public.job_notes enable row level security;
drop policy if exists job_notes_anon_read on public.job_notes;
drop policy if exists job_notes_anon_ins  on public.job_notes;
drop policy if exists job_notes_anon_del  on public.job_notes;
create policy job_notes_anon_read on public.job_notes for select using (true);
create policy job_notes_anon_ins  on public.job_notes for insert with check (true);
create policy job_notes_anon_del  on public.job_notes for delete using (true);
