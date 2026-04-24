-- Migration 018: customer-entered signature date.
--
-- The customer types the date next to the signature (standard contract
-- practice). This is separate from `signed_at` (timestamptz captured
-- server-side) — the two should match in 99% of cases but the client
-- is the source of truth for the "date the agreement was entered."
-- Keeping both gives us a clean audit trail:
--   signed_date  — what the customer wrote  (legal record)
--   signed_at    — when the POST reached us (fraud-forensic record)

alter table public.estimates
  add column if not exists signed_date date;
