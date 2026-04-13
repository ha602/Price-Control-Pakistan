-- Run once in Supabase SQL Editor if you already applied an older supabase-setup.sql
-- (adds staff registry + tightens RLS for existing projects)

CREATE TABLE IF NOT EXISTS admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own admin row" ON admin_users;
CREATE POLICY "Users can read own admin row"
  ON admin_users FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow public read on submissions" ON price_submissions;
DROP POLICY IF EXISTS "Admins can read submissions" ON price_submissions;
CREATE POLICY "Admins can read submissions"
  ON price_submissions FOR SELECT
  USING (EXISTS (SELECT 1 FROM admin_users au WHERE au.user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can update reference_prices" ON reference_prices;
CREATE POLICY "Admins can update reference_prices"
  ON reference_prices FOR UPDATE
  USING (EXISTS (SELECT 1 FROM admin_users au WHERE au.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM admin_users au WHERE au.user_id = auth.uid()));
