-- Migration 056: track per-milestone invoice sends.
--
-- The Estimate Flow step 5 ("Invoice & Deposit") used to handle a
-- single deposit invoice on the contract row (`deposit_invoice_sent_at`).
-- The new flow renders ONE row per parcela do payment plan from
-- `payment_milestones` (already populated on contract signing) and
-- gives Brenda a Send button per row.
--
-- Two new columns:
--   * `invoice_sent_at`  — timestamp do clique. Trava o botão Send;
--                          o "Resend" zera este campo após confirmação
--                          dupla (na verdade só sobrescreve com new now()).
--   * `invoice_doc_id`   — FK loose pra `job_documents.id` da cópia
--                          do PDF salva no folder='invoices'. Pra
--                          futuro "ver invoice enviada" sem precisar
--                          re-renderizar.
--
-- Idempotent.

ALTER TABLE public.payment_milestones
  ADD COLUMN IF NOT EXISTS invoice_sent_at  timestamptz,
  ADD COLUMN IF NOT EXISTS invoice_doc_id   uuid;

CREATE INDEX IF NOT EXISTS payment_milestones_invoice_sent_idx
  ON public.payment_milestones (invoice_sent_at);
