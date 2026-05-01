-- Migration 029: per-visit status on calendar_events.
--
-- The receptionist asked for a way to flag each Sales Visit with how
-- it actually went, so the team can scan the calendar at a glance:
--
--   * to_do       — visit booked, not yet happened (default; orange)
--   * completed   — visit happened and went well   (sky blue)
--   * pending     — visit awaiting confirmation     (lime green)
--   * cancelled   — visit was cancelled            (slate / dark)
--
-- The status is meaningful only for kind = 'sales_visit'. We still
-- store it on every row (default 'to_do') so we don't have to special-
-- case nullability everywhere; UI only surfaces the picker for
-- sales_visit.

ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS visit_status TEXT NOT NULL DEFAULT 'to_do';

-- Allowed values. Drop first in case the migration is rerun against
-- a DB that already has a slightly different constraint.
ALTER TABLE calendar_events
  DROP CONSTRAINT IF EXISTS calendar_events_visit_status_check;

ALTER TABLE calendar_events
  ADD CONSTRAINT calendar_events_visit_status_check
  CHECK (visit_status IN ('to_do', 'completed', 'pending', 'cancelled'));

-- Helps the calendar queries that filter by date range + status.
CREATE INDEX IF NOT EXISTS calendar_events_status_idx
  ON calendar_events (visit_status);
