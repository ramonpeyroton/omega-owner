-- Migration 008: unified calendar across all roles.
-- One table drives every event on the shared company calendar: sales
-- visits booked by Rafaela, job starts/service days from the Manager,
-- inspections, internal meetings. Store timestamps in UTC; the app
-- displays everything in America/New_York (Fairfield County CT).

create table if not exists public.calendar_events (
  id                  uuid primary key default gen_random_uuid(),
  kind                text not null check (kind in (
    'sales_visit','job_start','service_day','inspection','meeting'
  )),
  title               text not null,
  starts_at           timestamptz not null,
  ends_at             timestamptz not null,
  all_day             boolean not null default false,
  job_id              uuid,
  assigned_to_name    text,
  assigned_to_role    text,
  location            text,
  notes               text,
  color               text,
  created_by_name     text,
  created_by_role    text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists calendar_events_range_idx
  on public.calendar_events (starts_at, ends_at);
create index if not exists calendar_events_assigned_idx
  on public.calendar_events (assigned_to_name, starts_at);
create index if not exists calendar_events_job_idx
  on public.calendar_events (job_id);

alter table public.calendar_events enable row level security;
drop policy if exists calendar_events_anon_read on public.calendar_events;
drop policy if exists calendar_events_anon_ins  on public.calendar_events;
drop policy if exists calendar_events_anon_upd  on public.calendar_events;
drop policy if exists calendar_events_anon_del  on public.calendar_events;
create policy calendar_events_anon_read on public.calendar_events for select using (true);
create policy calendar_events_anon_ins  on public.calendar_events for insert with check (true);
create policy calendar_events_anon_upd  on public.calendar_events for update using (true) with check (true);
create policy calendar_events_anon_del  on public.calendar_events for delete using (true);
