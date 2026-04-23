-- Migration 009: Job materials tracking + voice note flag.
-- Run once in Supabase SQL editor. Safe to re-run.

-- ─── job_materials ────────────────────────────────────────────────
-- Manual list per job of materials Gabriel needs to buy / has bought.
-- Used by "Materials Run" to show a shopping list aggregated across all
-- active jobs.
create table if not exists public.job_materials (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null,
  phase_id    text,                     -- optional: which phase triggered the need
  name        text not null,            -- "2x4 pressure treated, 8ft"
  quantity    text,                     -- "12 pcs" / "3 boxes" — free text
  store       text,                     -- "Home Depot" / "Lowes" / "Ring's End" / custom
  status      text not null default 'needed' check (status in ('needed','bought')),
  price       numeric,                  -- filled when bought, optional
  receipt_url text,                     -- photo of the receipt
  added_by    text,
  bought_by   text,
  added_at    timestamptz not null default now(),
  bought_at   timestamptz,
  notes       text
);

create index if not exists job_materials_job_idx
  on public.job_materials (job_id, status, added_at desc);
create index if not exists job_materials_status_idx
  on public.job_materials (status, added_at desc);

alter table public.job_materials enable row level security;
drop policy if exists job_materials_anon_read on public.job_materials;
drop policy if exists job_materials_anon_ins  on public.job_materials;
drop policy if exists job_materials_anon_upd  on public.job_materials;
drop policy if exists job_materials_anon_del  on public.job_materials;
create policy job_materials_anon_read on public.job_materials for select using (true);
create policy job_materials_anon_ins  on public.job_materials for insert with check (true);
create policy job_materials_anon_upd  on public.job_materials for update using (true) with check (true);
create policy job_materials_anon_del  on public.job_materials for delete using (true);

-- ─── job_notes: flag voice transcription origin ───────────────────
-- Existing `job_notes` table gets an optional source so the UI can
-- show a mic icon on notes dictated in the field.
alter table public.job_notes add column if not exists source text
  check (source in ('typed','voice'));

-- ─── phase_data voice support (stays in JSONB — no schema change) ─
-- PhaseBreakdown now stores per-item `verify_status` ('pass'|'fail'|'fix')
-- inside `jobs.phase_data.phases[i].items[j].verify_status` — pure JSONB,
-- no migration needed for that data.
