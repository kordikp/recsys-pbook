-- Run this in Supabase SQL Editor to create the user_profiles table
-- Dashboard: https://supabase.com/dashboard → your project → SQL Editor

CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  display_name text,
  session_token text,
  profile_data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for fast login lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles (email);

-- Only the serverless functions may read or write (password hashes and session tokens live
-- here): set SUPABASE_KEY to the service_role key, which bypasses RLS, and keep RLS on with NO
-- policy, so the public anon key reads nothing. Older projects were told to add an "allow all"
-- policy for the anon key; once the functions use the service_role key, drop it:
--   DROP POLICY IF EXISTS "Allow all via anon key" ON user_profiles;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
