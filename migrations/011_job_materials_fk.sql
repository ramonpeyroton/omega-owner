-- Migration 011: declare the job_materials → jobs foreign key so the
-- PostgREST schema cache can resolve "jobs:job_id(...)" style joins.
-- Run once in Supabase SQL editor. Safe to re-run — uses IF NOT EXISTS.

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'job_materials_job_id_fkey'
  ) then
    alter table public.job_materials
      add constraint job_materials_job_id_fkey
      foreign key (job_id) references public.jobs(id)
      on delete cascade;
  end if;
end$$;

-- Tell PostgREST to refresh its schema cache so the new FK is picked up
-- without a dashboard restart.
notify pgrst, 'reload schema';
