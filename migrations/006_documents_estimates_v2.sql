-- Migration 006: Documents tab + Estimate v2 + audit for deletes.
-- Run once in Supabase SQL editor. Safe to re-run.

-- ─── Notes & Alerts (quick per-job notepad inside Documents tab) ──
alter table public.jobs add column if not exists notes_alerts text;

-- ─── Track who deleted a job (admin can see which PIN authorized it) ──
-- We log via audit_log but include the PIN in details. No schema change
-- to audit_log needed — details is JSONB — but we DO want an explicit
-- flag so the Admin UI can filter.
-- (No-op here; handled by app code writing audit details.)

-- ─── job_documents (6 folders: invoices/permits/plans/checks/contracts/change_orders) ──
create table if not exists public.job_documents (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null,
  folder      text not null check (folder in (
    'invoices','permits','building_plans','checks','contracts','change_orders'
  )),
  title       text not null,
  photo_url   text,
  uploaded_by text,
  created_at  timestamptz not null default now()
);
create index if not exists job_documents_job_folder_idx
  on public.job_documents (job_id, folder, created_at desc);

alter table public.job_documents enable row level security;
drop policy if exists job_documents_anon_read on public.job_documents;
drop policy if exists job_documents_anon_ins  on public.job_documents;
drop policy if exists job_documents_anon_del  on public.job_documents;
create policy job_documents_anon_read on public.job_documents for select using (true);
create policy job_documents_anon_ins  on public.job_documents for insert with check (true);
create policy job_documents_anon_del  on public.job_documents for delete using (true);

-- ─── Estimate builder v2 columns (extend existing `estimates` table) ──
-- The old flow had a line-item structure; v2 adds the full "sections of
-- items" shape plus customer message + payment schedule. Stored as JSONB
-- so the shape can evolve without migrations.
alter table public.estimates add column if not exists estimate_number        int;
alter table public.estimates add column if not exists header_description     text;
alter table public.estimates add column if not exists sections               jsonb;
alter table public.estimates add column if not exists customer_message       text;
alter table public.estimates add column if not exists payment_schedule_text  text;
alter table public.estimates add column if not exists pdf_url                text;

-- Sequence for human-readable estimate numbers. Starts at 2000 per owner
-- request. `bigint` is overkill for this but matches the safer pg default.
create sequence if not exists public.estimate_number_seq
  start with 2000
  increment by 1;

-- Client-callable RPC that bumps the sequence atomically. Exposed with
-- SECURITY DEFINER so the anon role can call it without owning the
-- sequence directly.
create or replace function public.next_estimate_number()
returns int
language sql
security definer
as $$
  select nextval('public.estimate_number_seq')::int;
$$;
grant execute on function public.next_estimate_number() to anon, authenticated;

-- Backfill: anything existing keeps its estimate_number null; the next
-- new estimate gets 2000.

-- ─── Email log for estimate sends (Resend SID, status, etc.) ──────
create table if not exists public.estimate_emails (
  id             uuid primary key default gen_random_uuid(),
  estimate_id    uuid,
  job_id         uuid,
  to_email       text not null,
  subject        text,
  status         text not null check (status in ('sent','failed')),
  provider       text default 'resend',
  provider_id    text,
  error          text,
  sent_by_name   text,
  sent_by_role   text,
  created_at     timestamptz not null default now()
);
create index if not exists estimate_emails_job_idx
  on public.estimate_emails (job_id, created_at desc);

alter table public.estimate_emails enable row level security;
drop policy if exists estimate_emails_anon_read on public.estimate_emails;
create policy estimate_emails_anon_read on public.estimate_emails for select using (true);
-- No insert policy from the client — only the serverless function using
-- the service role key writes to this table.
