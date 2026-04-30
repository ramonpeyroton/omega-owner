-- Migration 025: username column on `users`.
--
-- Adds a login handle separate from the displayed full name. The
-- redesigned Login.jsx now asks for "Username" + PIN and only accepts
-- the pair if it matches a row in `users`. Sidebars and chat continue
-- to render `users.name` (the full name) — username is just for login.
--
-- The column is NULLABLE on purpose: pre-existing rows (e.g. Brenda
-- created before this migration) can keep working through Login.jsx's
-- legacy fallback (name ilike + pin) until the admin backfills the
-- username field. Once everyone is migrated, the fallback can be
-- removed in a future migration.
--
-- The unique index uses lower(username) so logins are
-- case-insensitive — "Inacio", "inacio" and "INACIO" all resolve to
-- the same account. This matches how the rest of the app treats
-- names (ilike comparisons everywhere).

alter table public.users
  add column if not exists username text;

-- Drop first to make the migration idempotent — running it again
-- after editing the index would otherwise error.
drop index if exists users_username_lower_idx;
create unique index users_username_lower_idx
  on public.users (lower(username))
  where username is not null;

-- Force PostgREST to refresh its schema cache so the new column is
-- visible to the API immediately.
notify pgrst, 'reload schema';
