-- Migration 027: QuickBooks OAuth tokens.
--
-- Stores the access_token + refresh_token that the company's QuickBooks
-- connection grants the app. One row per "company" (QB calls it
-- realm_id) — typically just one for Omega, but the schema supports
-- multiple in case the company opens a second QB ledger later.
--
-- Tokens are STORED IN PLAINTEXT in this MVP — Supabase RLS + service
-- role on the API side keep them out of the client. Future hardening
-- can wrap them in pgcrypto symmetric encryption keyed by an env var.
--
-- Lifetime:
--   * access_token expires in ~1h (Intuit's default)
--   * refresh_token rolls over each refresh; **always store the new
--     one** the API returns or you'll lose access in 100 days
--   * full disconnect happens via api/quickbooks/disconnect.js, which
--     deletes the row + revokes at Intuit's side

create table if not exists public.quickbooks_tokens (
  id                  uuid primary key default gen_random_uuid(),
  realm_id            text not null unique,
  access_token        text not null,
  refresh_token       text not null,
  token_expires_at    timestamptz not null,
  refresh_expires_at  timestamptz,
  -- audit fields
  connected_at        timestamptz not null default now(),
  connected_by_user_id uuid,
  last_refreshed_at   timestamptz,
  active              boolean not null default true,
  -- so we can distinguish sandbox vs prod tokens once we go live
  environment         text not null default 'sandbox',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists quickbooks_tokens_realm_idx
  on public.quickbooks_tokens (realm_id) where active = true;

-- RLS: same permissive policy as the rest. The tokens never leave the
-- server (api/_lib/quickbooks.js uses SERVICE_ROLE), so RLS is mostly
-- a defence-in-depth here.
alter table public.quickbooks_tokens enable row level security;
drop policy if exists quickbooks_tokens_anon_all on public.quickbooks_tokens;
create policy quickbooks_tokens_anon_all
  on public.quickbooks_tokens for all using (true) with check (true);

notify pgrst, 'reload schema';
