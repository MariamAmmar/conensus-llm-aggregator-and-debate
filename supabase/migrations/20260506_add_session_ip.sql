-- Run this once in Supabase SQL Editor: https://app.supabase.com → your project → SQL Editor
--
-- Adds IP tracking for anonymous sessions so pre-login chat history is automatically
-- claimed and associated with the user's account when they log in.

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS anon_ip text;

-- Index so the claim query (WHERE user_id IS NULL AND anon_ip = ?) is fast
CREATE INDEX IF NOT EXISTS idx_sessions_anon_ip ON sessions(anon_ip) WHERE user_id IS NULL;
