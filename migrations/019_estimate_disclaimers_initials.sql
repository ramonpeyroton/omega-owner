-- Migration 019: estimate disclaimers + customer initials.
--
-- Two new columns on `public.estimates`:
--   disclaimers   text   — full disclaimer text snapshot the customer
--                          saw at sign time. Stored as an immutable
--                          copy so a future edit to the global default
--                          can never alter the legal record of what
--                          someone agreed to.
--   initials_png  text   — small canvas image the customer drew at the
--                          top of the signing flow ("I have read this
--                          estimate"). Distinct from the full
--                          `signature_png` collected at the bottom.
--
-- The acknowledgement of every disclaimer checkbox is implicit: the
-- API rejects the sign request unless the client confirms `disclaimers
-- _acknowledged: true` in the body, so reaching `signed_at` already
-- means every checkbox was ticked.

alter table public.estimates
  add column if not exists disclaimers   text,
  add column if not exists initials_png  text;
