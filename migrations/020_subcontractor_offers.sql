-- Migration 020: subcontractor offers (Accept/Reject workflow)
--
-- New flow: when Inácio assigns a sub to a job, the system creates an
-- `subcontractor_offers` row, sends an SMS link to the sub, and waits
-- for them to Accept or Reject from a public page (`/sub-offer/:id`,
-- mirrors the `/estimate-view/:id` pattern). On Accept, an agreement
-- row is auto-generated. On Reject, the owner is notified to pick
-- another sub.
--
-- Why a separate table from subcontractor_agreements?
--   • An offer can be rejected — we still want a record of the
--     attempt for audit / "we tried him first"
--   • Snapshot of scope / amount / payment is captured at offer time;
--     editing the agreement later doesn't rewrite history of what
--     the sub originally agreed to
--   • Lets us run a daily "still no answer?" reminder query against
--     status='sent' && sent_at < now() - 24h cleanly

-- ─── Sub language preference ────────────────────────────────────────
-- Sub-facing pages translate to PT / EN / ES based on this. The app
-- stays English everywhere for the team.
alter table public.subcontractors
  add column if not exists preferred_language text default 'en';

-- ─── Offer table ────────────────────────────────────────────────────
create table if not exists public.subcontractor_offers (
  id                  uuid primary key default gen_random_uuid(),
  job_id              uuid references public.jobs(id) on delete cascade,
  subcontractor_id    uuid references public.subcontractors(id) on delete cascade,
  agreement_id        uuid references public.subcontractor_agreements(id) on delete set null,

  -- Snapshot of the offer (denormalized so editing the job/sub later
  -- doesn't rewrite the legal record of what was offered)
  scope_of_work       text,
  their_estimate      numeric,
  payment_plan        jsonb,
  start_date          date,
  end_date            date,
  location            text,

  -- Lifecycle
  status              text default 'sent',  -- sent / accepted / rejected
  sent_at             timestamptz default now(),
  accepted_at         timestamptz,
  rejected_at         timestamptz,
  reject_reason       text,

  -- 24h reminder bookkeeping — the daily cron stamps this whenever it
  -- nudges Inácio about a still-pending offer, so the same offer
  -- doesn't generate a notification every single day.
  last_reminder_at    timestamptz,

  -- Audit
  created_by          text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- Permissive RLS to match the rest of the v1 app (PIN-based, no real
-- auth). Both anon and authenticated can do everything; tighten later.
alter table public.subcontractor_offers enable row level security;
drop policy if exists allow_all_subcontractor_offers on public.subcontractor_offers;
create policy allow_all_subcontractor_offers
  on public.subcontractor_offers
  for all
  to anon, authenticated
  using (true) with check (true);

-- Hot path: "show me every pending offer for this job" / "every offer
-- still waiting after 24h".
create index if not exists subcontractor_offers_job_idx
  on public.subcontractor_offers (job_id);
create index if not exists subcontractor_offers_status_idx
  on public.subcontractor_offers (status, sent_at)
  where status = 'sent';
