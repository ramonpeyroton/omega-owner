-- Migration 004: Receptionist role + expanded pipeline statuses.
-- Adds new jobs columns for receptionist-created leads and expands the
-- pipeline_status domain to 10 values. Safe to run multiple times.

-- ─── New jobs columns ────────────────────────────────────────────
alter table public.jobs add column if not exists preferred_visit_date date;
alter table public.jobs add column if not exists preferred_visit_time time;
alter table public.jobs add column if not exists assigned_to        varchar(255);
alter table public.jobs add column if not exists client_email       varchar(255);
alter table public.jobs add column if not exists referral_name      varchar(255);
alter table public.jobs add column if not exists lead_source        varchar(64);
alter table public.jobs add column if not exists created_by         varchar(64);
alter table public.jobs add column if not exists availability_window varchar(32);

-- ─── Pipeline status constraint ───────────────────────────────────
-- Drop any old CHECK constraint so we can add the expanded domain.
alter table public.jobs drop constraint if exists jobs_pipeline_status_check;

-- Normalize legacy values before locking down the domain.
update public.jobs set pipeline_status = 'new_lead'
  where pipeline_status is null
     or pipeline_status in ('to_quote', 'draft', 'on_hold');

-- Re-add the expanded check — 10 canonical values.
alter table public.jobs
  add constraint jobs_pipeline_status_check
  check (pipeline_status in (
    'new_lead',
    'estimate_draft',
    'estimate_sent',
    'estimate_negotiating',
    'estimate_approved',
    'contract_sent',
    'contract_signed',
    'in_progress',
    'completed',
    'estimate_rejected'
  ));
