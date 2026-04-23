-- Migration 012: Last-touch tracking on jobs.
-- Two columns used by the receptionist's "My Leads" screen to log the
-- most recent follow-up note. Single-note (not history) by design.
-- Safe to run multiple times.

alter table public.jobs add column if not exists last_touch_at   timestamptz;
alter table public.jobs add column if not exists last_touch_note text;
