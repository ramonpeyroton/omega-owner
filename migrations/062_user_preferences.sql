-- migrations/062_user_preferences.sql
-- Stores per-user UI preferences so each role can persist their
-- preferred view mode, sort field, and sort direction across sessions.
-- User identified by display name (matches users.name or the PIN
-- fallback name — no FK so it works even before Supabase auth).

create table if not exists user_preferences (
  id               uuid        primary key default gen_random_uuid(),
  user_name        text        not null unique,
  leads_view_mode  text        not null default 'list'
                               check (leads_view_mode in ('list', 'cards')),
  leads_sort_field text        not null default 'date',
  leads_sort_dir   text        not null default 'desc'
                               check (leads_sort_dir in ('asc', 'desc')),
  updated_at       timestamptz not null default now()
);

-- Automatically bump updated_at on any row change.
create or replace function touch_updated_at_user_preferences()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger user_preferences_updated_at
  before update on user_preferences
  for each row execute procedure touch_updated_at_user_preferences();

-- Open RLS: app uses the anon key (no per-row secrets here).
alter table user_preferences enable row level security;

create policy "user_preferences_all"
  on user_preferences
  using (true)
  with check (true);
