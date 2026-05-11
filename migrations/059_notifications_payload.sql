-- Migration 059: payload field for live-rendered notifications.
--
-- Audit #9 — notifications.message used to bake client_name (and
-- other live values) into a frozen string at insert time. If Brenda
-- later corrected a typo, the bell kept showing the old name forever.
--
-- We add `payload` (jsonb) as the new authoritative shape for newly
-- emitted notifications. The render layer reads payload + live job
-- data when available, and falls back to the old `message` string
-- when payload is null (so historical rows still display).
--
-- Idempotent.

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS payload jsonb;

CREATE INDEX IF NOT EXISTS notifications_payload_type_idx
  ON public.notifications ((payload->>'type'));
