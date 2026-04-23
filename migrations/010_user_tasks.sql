-- Migration 010: per-user personal tasks ("Today" scratchpad).
-- Not tied to a job — these are quick demands that pop up during the
-- day (e.g. "pick up tile at HD", "call Joe about the deck"). Each
-- user sees only the rows they created.

create table if not exists public.user_tasks (
  id          uuid primary key default gen_random_uuid(),
  user_name   text not null,     -- matches the logged-in PIN user name
  user_role   text,
  body        text not null,
  done        boolean not null default false,
  created_at  timestamptz not null default now(),
  done_at     timestamptz
);

create index if not exists user_tasks_owner_idx
  on public.user_tasks (user_name, done, created_at desc);

alter table public.user_tasks enable row level security;
drop policy if exists user_tasks_anon_read on public.user_tasks;
drop policy if exists user_tasks_anon_ins  on public.user_tasks;
drop policy if exists user_tasks_anon_upd  on public.user_tasks;
drop policy if exists user_tasks_anon_del  on public.user_tasks;
create policy user_tasks_anon_read on public.user_tasks for select using (true);
create policy user_tasks_anon_ins  on public.user_tasks for insert with check (true);
create policy user_tasks_anon_upd  on public.user_tasks for update using (true) with check (true);
create policy user_tasks_anon_del  on public.user_tasks for delete using (true);
