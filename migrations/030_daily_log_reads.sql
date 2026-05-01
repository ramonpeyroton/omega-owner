-- Migration 030: per-user "last read" tracking for Daily Logs.
--
-- Goal: pipeline cards show a small red dot when the current user
-- hasn't seen the latest Slack messages on that job's channel.
--
-- We need two things:
--   1. A way to know "what's the timestamp of the latest message in
--      this job's Slack channel?" — without having to call Slack from
--      the kanban load (which would hit the rate limit on a busy
--      pipeline). We cache the latest ts on the job row itself,
--      bumped whenever ProjectChat polls and sees something newer.
--   2. A "what did this user already see?" pointer per (user, job).
--      That lives in a tiny join table.
--
-- The dot rule on the kanban card is: render iff
--   slack_last_message_at IS NOT NULL
--   AND (read.last_read_at IS NULL OR read.last_read_at < slack_last_message_at)

-- 1. Cached "newest message" timestamp on each job. Nullable — most
--    jobs never get a Slack channel, so leaving it NULL is the
--    "no chat activity" state.
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS slack_last_message_at TIMESTAMPTZ;

-- 2. Read-pointer table. Keyed by (user_name, job_id) — same lo-fi
--    user_name string the rest of the app uses (e.g. 'Attila',
--    'Brenda', 'Inacio'). Migrate to user_id when we move off PIN
--    login (auth-hardening phase 3).
CREATE TABLE IF NOT EXISTS daily_log_reads (
  user_name     TEXT        NOT NULL,
  job_id        UUID        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  last_read_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_name, job_id)
);

-- Lookups: "load every read pointer for THIS user across all their
-- jobs" is the hot path on pipeline mount.
CREATE INDEX IF NOT EXISTS daily_log_reads_user_idx
  ON daily_log_reads (user_name);

-- Permissive RLS to match the rest of the app's PIN-only auth model.
ALTER TABLE daily_log_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_log_reads anon all" ON daily_log_reads;
CREATE POLICY "daily_log_reads anon all"
  ON daily_log_reads
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
