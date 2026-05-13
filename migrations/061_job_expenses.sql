-- Migration 061: job_expenses table
-- Tracks individual cost line items logged against a job
-- (materials, labor, sub payments, etc.). Feeds JobExpensesSection
-- in the Financials tab and ReceiptCaptureModal in the manager app.

create table if not exists public.job_expenses (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null references public.jobs(id) on delete cascade,
  date         date,
  category     text not null default 'Material',
  description  text,
  amount       numeric(12, 2) not null,
  receipt_url  text,
  logged_by    text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Index for the most common query pattern: all expenses for a job
create index if not exists job_expenses_job_id_idx on public.job_expenses(job_id);

-- RLS: permissive (same pattern as all internal tables)
alter table public.job_expenses enable row level security;

create policy "allow all" on public.job_expenses
  for all using (true) with check (true);
