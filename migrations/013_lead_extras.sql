-- Migration 013: Receptionist lead form additions.
--  · lead_date          — the date the lead was captured (may predate
--                         created_at when backfilling old leads).
--  · unit_number        — apt/unit for condos & multi-unit buildings.
--  · additional_services — JSONB array of extra services when a client
--                         asks for more than one job (e.g. bathroom + kitchen).
--                         Primary service stays in `service` for backward
--                         compatibility with the rest of the app.
-- Safe to run multiple times.

alter table public.jobs add column if not exists lead_date           date;
alter table public.jobs add column if not exists unit_number         varchar(32);
alter table public.jobs add column if not exists additional_services jsonb;
