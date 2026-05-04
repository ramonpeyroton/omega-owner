-- Migration 033: relink old single-name user references to the new
-- full-name records that Ramon registered through Admin → Users.
--
-- Up to now, every "who did this" / "who is this assigned to" string
-- in the database was just a first name ("Attila", "Brenda", etc.) —
-- those were the field-team conventions and the values typed by the
-- old hardcoded-PIN logins. With the new users table populated, the
-- canonical name is the full one. We rewrite every referenced
-- column so that historical data shows up under each user's new
-- record and doesn't get orphaned when we kill the PIN_TO_ROLE
-- fallback.
--
-- Mapping (built from the current `users` table):
--   Attila   → Attila Dasilva       (sales)
--   Brenda   → Brenda Dasilva       (operations)
--   Inacio   → Inacio Deoliveira    (owner)
--   Rafaela  → Rafaela Costa        (receptionist)
--   Gabriel  → Gabriel Ramanho      (manager)
--   Ramon    → Ramon Peyroton       (marketing)
--
-- Idempotent: rerunning is a no-op once every row already holds the
-- full name (the WHERE clauses match the OLD short form only).

-- ─── helper: rename a single value in a single column ─────────────
-- We DO NOT use a temp function — these UPDATEs run once and a flat
-- list keeps the audit trail readable when someone diffs this file
-- against migrations/032_*.sql.

-- ╔═══════════════════════════════════════════════════════════════╗
-- ║  jobs                                                          ║
-- ╚═══════════════════════════════════════════════════════════════╝
UPDATE jobs SET salesperson_name = 'Attila Dasilva'    WHERE salesperson_name = 'Attila';
UPDATE jobs SET salesperson_name = 'Brenda Dasilva'    WHERE salesperson_name = 'Brenda';
UPDATE jobs SET salesperson_name = 'Inacio Deoliveira' WHERE salesperson_name = 'Inacio';
UPDATE jobs SET salesperson_name = 'Rafaela Costa'     WHERE salesperson_name = 'Rafaela';
UPDATE jobs SET salesperson_name = 'Gabriel Ramanho'   WHERE salesperson_name = 'Gabriel';
UPDATE jobs SET salesperson_name = 'Ramon Peyroton'    WHERE salesperson_name = 'Ramon';

UPDATE jobs SET pm_name = 'Attila Dasilva'    WHERE pm_name = 'Attila';
UPDATE jobs SET pm_name = 'Brenda Dasilva'    WHERE pm_name = 'Brenda';
UPDATE jobs SET pm_name = 'Inacio Deoliveira' WHERE pm_name = 'Inacio';
UPDATE jobs SET pm_name = 'Rafaela Costa'     WHERE pm_name = 'Rafaela';
UPDATE jobs SET pm_name = 'Gabriel Ramanho'   WHERE pm_name = 'Gabriel';
UPDATE jobs SET pm_name = 'Ramon Peyroton'    WHERE pm_name = 'Ramon';

UPDATE jobs SET assigned_to = 'Attila Dasilva'    WHERE assigned_to = 'Attila';
UPDATE jobs SET assigned_to = 'Brenda Dasilva'    WHERE assigned_to = 'Brenda';
UPDATE jobs SET assigned_to = 'Inacio Deoliveira' WHERE assigned_to = 'Inacio';
UPDATE jobs SET assigned_to = 'Rafaela Costa'     WHERE assigned_to = 'Rafaela';
UPDATE jobs SET assigned_to = 'Gabriel Ramanho'   WHERE assigned_to = 'Gabriel';
UPDATE jobs SET assigned_to = 'Ramon Peyroton'    WHERE assigned_to = 'Ramon';

-- ╔═══════════════════════════════════════════════════════════════╗
-- ║  audit_log                                                     ║
-- ╚═══════════════════════════════════════════════════════════════╝
UPDATE audit_log SET user_name = 'Attila Dasilva'    WHERE user_name = 'Attila';
UPDATE audit_log SET user_name = 'Brenda Dasilva'    WHERE user_name = 'Brenda';
UPDATE audit_log SET user_name = 'Inacio Deoliveira' WHERE user_name = 'Inacio';
UPDATE audit_log SET user_name = 'Rafaela Costa'     WHERE user_name = 'Rafaela';
UPDATE audit_log SET user_name = 'Gabriel Ramanho'   WHERE user_name = 'Gabriel';
UPDATE audit_log SET user_name = 'Ramon Peyroton'    WHERE user_name = 'Ramon';

-- ╔═══════════════════════════════════════════════════════════════╗
-- ║  calendar_events                                               ║
-- ╚═══════════════════════════════════════════════════════════════╝
UPDATE calendar_events SET assigned_to_name = 'Attila Dasilva'    WHERE assigned_to_name = 'Attila';
UPDATE calendar_events SET assigned_to_name = 'Brenda Dasilva'    WHERE assigned_to_name = 'Brenda';
UPDATE calendar_events SET assigned_to_name = 'Inacio Deoliveira' WHERE assigned_to_name = 'Inacio';
UPDATE calendar_events SET assigned_to_name = 'Rafaela Costa'     WHERE assigned_to_name = 'Rafaela';
UPDATE calendar_events SET assigned_to_name = 'Gabriel Ramanho'   WHERE assigned_to_name = 'Gabriel';
UPDATE calendar_events SET assigned_to_name = 'Ramon Peyroton'    WHERE assigned_to_name = 'Ramon';

UPDATE calendar_events SET created_by_name = 'Attila Dasilva'    WHERE created_by_name = 'Attila';
UPDATE calendar_events SET created_by_name = 'Brenda Dasilva'    WHERE created_by_name = 'Brenda';
UPDATE calendar_events SET created_by_name = 'Inacio Deoliveira' WHERE created_by_name = 'Inacio';
UPDATE calendar_events SET created_by_name = 'Rafaela Costa'     WHERE created_by_name = 'Rafaela';
UPDATE calendar_events SET created_by_name = 'Gabriel Ramanho'   WHERE created_by_name = 'Gabriel';
UPDATE calendar_events SET created_by_name = 'Ramon Peyroton'    WHERE created_by_name = 'Ramon';

-- ╔═══════════════════════════════════════════════════════════════╗
-- ║  job_notes                                                     ║
-- ╚═══════════════════════════════════════════════════════════════╝
-- The pre-existing job_notes table uses author_name / author_role
-- (not user_name / user_role — migration 031 was a no-op against
-- the live schema). Frontend JobNotesPanel was patched to match.
UPDATE job_notes SET author_name = 'Attila Dasilva'    WHERE author_name = 'Attila';
UPDATE job_notes SET author_name = 'Brenda Dasilva'    WHERE author_name = 'Brenda';
UPDATE job_notes SET author_name = 'Inacio Deoliveira' WHERE author_name = 'Inacio';
UPDATE job_notes SET author_name = 'Rafaela Costa'     WHERE author_name = 'Rafaela';
UPDATE job_notes SET author_name = 'Gabriel Ramanho'   WHERE author_name = 'Gabriel';
UPDATE job_notes SET author_name = 'Ramon Peyroton'    WHERE author_name = 'Ramon';

-- ╔═══════════════════════════════════════════════════════════════╗
-- ║  daily_log_reads  (migration 030)                              ║
-- ╚═══════════════════════════════════════════════════════════════╝
-- daily_log_reads has a (user_name, job_id) primary key. If the new
-- name already exists for the same job (because the user signed in
-- under both old & new names) we'd get a unique-violation, so do a
-- guarded delete first.
DELETE FROM daily_log_reads
  WHERE user_name = 'Attila'
    AND job_id IN (SELECT job_id FROM daily_log_reads WHERE user_name = 'Attila Dasilva');
UPDATE daily_log_reads SET user_name = 'Attila Dasilva' WHERE user_name = 'Attila';

DELETE FROM daily_log_reads
  WHERE user_name = 'Brenda'
    AND job_id IN (SELECT job_id FROM daily_log_reads WHERE user_name = 'Brenda Dasilva');
UPDATE daily_log_reads SET user_name = 'Brenda Dasilva' WHERE user_name = 'Brenda';

DELETE FROM daily_log_reads
  WHERE user_name = 'Inacio'
    AND job_id IN (SELECT job_id FROM daily_log_reads WHERE user_name = 'Inacio Deoliveira');
UPDATE daily_log_reads SET user_name = 'Inacio Deoliveira' WHERE user_name = 'Inacio';

DELETE FROM daily_log_reads
  WHERE user_name = 'Rafaela'
    AND job_id IN (SELECT job_id FROM daily_log_reads WHERE user_name = 'Rafaela Costa');
UPDATE daily_log_reads SET user_name = 'Rafaela Costa' WHERE user_name = 'Rafaela';

DELETE FROM daily_log_reads
  WHERE user_name = 'Gabriel'
    AND job_id IN (SELECT job_id FROM daily_log_reads WHERE user_name = 'Gabriel Ramanho');
UPDATE daily_log_reads SET user_name = 'Gabriel Ramanho' WHERE user_name = 'Gabriel';

-- ╔═══════════════════════════════════════════════════════════════╗
-- ║  ghost_payments  (migration 032)                               ║
-- ╚═══════════════════════════════════════════════════════════════╝
UPDATE ghost_payments SET created_by = 'Attila Dasilva'    WHERE created_by = 'Attila';
UPDATE ghost_payments SET created_by = 'Brenda Dasilva'    WHERE created_by = 'Brenda';
UPDATE ghost_payments SET created_by = 'Inacio Deoliveira' WHERE created_by = 'Inacio';
UPDATE ghost_payments SET created_by = 'Rafaela Costa'     WHERE created_by = 'Rafaela';
UPDATE ghost_payments SET created_by = 'Gabriel Ramanho'   WHERE created_by = 'Gabriel';
UPDATE ghost_payments SET created_by = 'Ramon Peyroton'    WHERE created_by = 'Ramon';

UPDATE ghost_payments SET updated_by = 'Attila Dasilva'    WHERE updated_by = 'Attila';
UPDATE ghost_payments SET updated_by = 'Brenda Dasilva'    WHERE updated_by = 'Brenda';
UPDATE ghost_payments SET updated_by = 'Inacio Deoliveira' WHERE updated_by = 'Inacio';
UPDATE ghost_payments SET updated_by = 'Rafaela Costa'     WHERE updated_by = 'Rafaela';
UPDATE ghost_payments SET updated_by = 'Gabriel Ramanho'   WHERE updated_by = 'Gabriel';
UPDATE ghost_payments SET updated_by = 'Ramon Peyroton'    WHERE updated_by = 'Ramon';

UPDATE ghost_payments SET deleted_by = 'Attila Dasilva'    WHERE deleted_by = 'Attila';
UPDATE ghost_payments SET deleted_by = 'Brenda Dasilva'    WHERE deleted_by = 'Brenda';
UPDATE ghost_payments SET deleted_by = 'Inacio Deoliveira' WHERE deleted_by = 'Inacio';
UPDATE ghost_payments SET deleted_by = 'Rafaela Costa'     WHERE deleted_by = 'Rafaela';
UPDATE ghost_payments SET deleted_by = 'Gabriel Ramanho'   WHERE deleted_by = 'Gabriel';
UPDATE ghost_payments SET deleted_by = 'Ramon Peyroton'    WHERE deleted_by = 'Ramon';

-- ╔═══════════════════════════════════════════════════════════════╗
-- ║  Cleanup: stray duplicate "Brenda" row in users               ║
-- ╚═══════════════════════════════════════════════════════════════╝
-- Old placeholder row left over from before Ramon created the real
-- one. Has username = NULL and would never authenticate, but keep
-- the table tidy.
DELETE FROM users WHERE name = 'Brenda' AND username IS NULL;
