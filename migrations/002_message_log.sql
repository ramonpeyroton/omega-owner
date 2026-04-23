-- Migration 002: message log for Twilio SMS / WhatsApp sends.
--
-- The `/api/twilio-send` serverless function writes one row here per send
-- attempt (success or failure) when SUPABASE_URL and
-- SUPABASE_SERVICE_ROLE_KEY are configured. Drop this file into the
-- Supabase SQL editor and run it once.
--
-- Nothing in this table is required for the app to send messages — it is
-- for audit/history only. If the table is missing, the serverless
-- function still sends and silently skips logging.

create table if not exists public.message_log (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz      not null default now(),
  channel            text             not null check (channel in ('sms', 'whatsapp')),
  to_number          text             not null,
  body               text             not null,
  provider_sid       text,
  status             text             not null check (status in ('sent', 'failed', 'queued')),
  error              text,
  job_id             uuid,
  phase_id           text,
  sub_id             uuid,
  kind               text,
  requested_by_name  text,
  requested_by_role  text
);

create index if not exists message_log_job_id_idx  on public.message_log (job_id);
create index if not exists message_log_sub_id_idx  on public.message_log (sub_id);
create index if not exists message_log_created_idx on public.message_log (created_at desc);

-- No RLS policy here on purpose — the serverless function uses the
-- service role key. If you later want to expose this to the client
-- (e.g. a "Message history" UI), add a policy that restricts by role.
