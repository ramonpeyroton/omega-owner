-- Migration 014: manual KPI overrides for the Screen (TV) dashboard.
-- Single-row table (id = 1). When a column here is NULL the dashboard
-- falls back to live-calculated values from jobs/contracts; when it's
-- set, the override wins. This lets Ramon preload headline numbers
-- before the real data starts flowing.

create table if not exists public.screen_overrides (
  id                integer primary key default 1 check (id = 1),
  pipeline_value    numeric,          -- $ — total value in pipeline
  contracts_signed  integer,          -- # contracts signed this month
  new_leads         integer,          -- # new leads this month
  avg_job_value     numeric,          -- $ — average signed job value
  recent_contracts  jsonb,            -- [{client, service, amount, signed_at}]
  top_services      jsonb,            -- [{service, count, revenue}]
  note              text,             -- free-form message shown in-screen (optional)
  updated_at        timestamptz not null default now(),
  updated_by        text
);

insert into public.screen_overrides (id)
  values (1)
on conflict (id) do nothing;

-- Permissive RLS consistent with the rest of the schema.
alter table public.screen_overrides enable row level security;
drop policy if exists allow_all_screen_overrides on public.screen_overrides;
create policy allow_all_screen_overrides on public.screen_overrides
  for all using (true) with check (true);
