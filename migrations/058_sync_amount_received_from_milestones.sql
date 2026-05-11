-- Migration 058: auto-sync job_costs.amount_received from milestones.
--
-- Audit #5 — the Job Costing tab inside each job card and the Finance
-- area each owned their own number. Brenda could mark an installment
-- received in Finance and the Job Costing balance would silently keep
-- the old value (and vice versa). Two ways to fix:
--   (a) drop the column and compute on read (joins everywhere, slow)
--   (b) keep the column but auto-update it via trigger whenever a
--       payment_milestones row changes — the data stays denormalized
--       for fast reads but is guaranteed in sync.
-- We pick (b). Triggers cover INSERT / UPDATE / DELETE and recompute
-- the sum for the affected job_id. Idempotent (DROP IF EXISTS first).

-- Recompute helper — takes a job_id and writes the fresh sum into
-- job_costs. Inserts a job_costs row if one doesn't exist so callers
-- don't have to worry about ordering.
CREATE OR REPLACE FUNCTION public.sync_job_costs_amount_received(p_job_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_total numeric(12,2);
BEGIN
  IF p_job_id IS NULL THEN RETURN; END IF;
  SELECT COALESCE(SUM(received_amount), 0)
    INTO v_total
    FROM public.payment_milestones
    WHERE job_id = p_job_id;
  -- UPDATE first; INSERT a starter row if there was nothing to update.
  -- The starter row's other cost columns stay at 0/null so Finance
  -- isn't fooled into thinking the job has been costed.
  UPDATE public.job_costs
     SET amount_received = v_total,
         updated_at      = now()
   WHERE job_id = p_job_id;
  IF NOT FOUND THEN
    INSERT INTO public.job_costs (job_id, amount_received)
    VALUES (p_job_id, v_total)
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

-- Trigger function — fires for each row change on payment_milestones,
-- calls the sync helper with the affected job_id(s). For UPDATE we
-- sync BOTH old and new job_id in case the milestone was reassigned.
CREATE OR REPLACE FUNCTION public.payment_milestones_sync_costs()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    PERFORM public.sync_job_costs_amount_received(OLD.job_id);
    RETURN OLD;
  END IF;
  PERFORM public.sync_job_costs_amount_received(NEW.job_id);
  IF (TG_OP = 'UPDATE' AND NEW.job_id IS DISTINCT FROM OLD.job_id) THEN
    PERFORM public.sync_job_costs_amount_received(OLD.job_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payment_milestones_sync_costs_trg ON public.payment_milestones;
CREATE TRIGGER payment_milestones_sync_costs_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.payment_milestones
  FOR EACH ROW
  EXECUTE FUNCTION public.payment_milestones_sync_costs();

-- One-time backfill so existing jobs catch up to the new invariant.
-- Wrapped in a DO block so we can run it inline.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT DISTINCT job_id FROM public.payment_milestones WHERE job_id IS NOT NULL LOOP
    PERFORM public.sync_job_costs_amount_received(r.job_id);
  END LOOP;
END;
$$;
